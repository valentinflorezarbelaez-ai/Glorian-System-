// Glorian System — Sovereign Fleet Edge Gateway
// Zero-dependency Go binary with Goroutine-based concurrent fleet routing.
// Architecture: Netflix Zuul / Envoy-lite pattern for multi-repo dispatch.
//
// Build:  go build -ldflags="-s -w" -o glorian-gateway .
// Run:    ./glorian-gateway --port 8090 --fleet ../../docs/projects/registry.json
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

// FleetProject mirrors the registry.json schema.
type FleetProject struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	LocalPath     string `json:"localPath,omitempty"`
	RemoteURL     string `json:"remoteUrl"`
	ProductionURL string `json:"productionUrl,omitempty"`
	Type          string `json:"type"`
	Status        string `json:"status"`
	Authorization string `json:"authorization"`
}

// Registry is the parsed fleet configuration.
type Registry struct {
	Projects []FleetProject `json:"projects"`
	Seal     string         `json:"seal"`
}

// GatewayState holds the live connection pool and metrics.
type GatewayState struct {
	registry       *Registry
	mu             sync.RWMutex
	healthCache    map[string]*HealthResult
	totalRequests  atomic.Uint64
	activeConns    atomic.Int64
	p90LatencyUs   atomic.Uint64
	startTime      time.Time
}

// HealthResult caches per-project health probe responses.
type HealthResult struct {
	ProjectID   string    `json:"project_id"`
	Endpoint    string    `json:"endpoint"`
	Healthy     bool      `json:"healthy"`
	LatencyMs   float64   `json:"latency_ms"`
	ProbeAt     time.Time `json:"probe_at"`
}

// RouteDispatch is the response for fleet routing requests.
type RouteDispatch struct {
	ProjectID    string `json:"project_id"`
	ResolvedURL  string `json:"resolved_url"`
	Authorization string `json:"authorization_level"`
	LatencyUs    int64  `json:"latency_us"`
	GatewayID    string `json:"gateway_id"`
}

var gatewayID = fmt.Sprintf("glorian-gw-%d", os.Getpid())

func loadRegistry(path string) (*Registry, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("registry read: %w", err)
	}
	var reg Registry
	if err := json.Unmarshal(data, &reg); err != nil {
		// Handle alternate schema with projects nested
		var alt struct {
			Projects []FleetProject `json:"projects"`
		}
		if err2 := json.Unmarshal(data, &alt); err2 != nil {
			return nil, fmt.Errorf("registry parse: %w", err)
		}
		reg.Projects = alt.Projects
	}
	return &reg, nil
}

func (gs *GatewayState) handleRoute(w http.ResponseWriter, r *http.Request) {
	gs.totalRequests.Add(1)
	gs.activeConns.Add(1)
	defer gs.activeConns.Add(-1)

	start := time.Now()
	projectID := r.URL.Query().Get("project")
	if projectID == "" {
		http.Error(w, "missing ?project=<id>", http.StatusBadRequest)
		return
	}

	gs.mu.RLock()
	var target *FleetProject
	for i := range gs.registry.Projects {
		if gs.registry.Projects[i].ID == projectID {
			target = &gs.registry.Projects[i]
			break
		}
	}
	gs.mu.RUnlock()

	if target == nil {
		http.Error(w, fmt.Sprintf("project %q not registered", projectID), http.StatusNotFound)
		return
	}

	// Law IV enforcement: block routing to unauthorized write targets
	if r.Method != "GET" && target.Authorization != "LEVEL_3_PRODUCTION_AUTHORIZED" {
		http.Error(w, "Law IV: write operations require LEVEL_3 authorization", http.StatusForbidden)
		return
	}

	resolved := target.ProductionURL
	if resolved == "" {
		resolved = target.RemoteURL
	}

	dispatch := RouteDispatch{
		ProjectID:     target.ID,
		ResolvedURL:   resolved,
		Authorization: target.Authorization,
		LatencyUs:     time.Since(start).Microseconds(),
		GatewayID:     gatewayID,
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Gateway-ID", gatewayID)
	w.Header().Set("X-Fleet-Seal", gs.registry.Seal)
	json.NewEncoder(w).Encode(dispatch)
}

func (gs *GatewayState) handleHealth(w http.ResponseWriter, r *http.Request) {
	// Concurrent health probe: fan-out to all fleet endpoints
	gs.mu.RLock()
	projects := make([]FleetProject, len(gs.registry.Projects))
	copy(projects, gs.registry.Projects)
	gs.mu.RUnlock()

	results := make([]HealthResult, len(projects))
	var wg sync.WaitGroup

	client := &http.Client{Timeout: 3 * time.Second}

	for i, p := range projects {
		wg.Add(1)
		go func(idx int, proj FleetProject) {
			defer wg.Done()
			endpoint := proj.ProductionURL
			if endpoint == "" {
				endpoint = proj.RemoteURL
			}
			result := HealthResult{
				ProjectID: proj.ID,
				Endpoint:  endpoint,
				ProbeAt:   time.Now(),
			}
			start := time.Now()
			resp, err := client.Get(endpoint)
			result.LatencyMs = float64(time.Since(start).Microseconds()) / 1000.0
			if err == nil && resp.StatusCode == 200 {
				result.Healthy = true
				resp.Body.Close()
			}
			results[idx] = result
		}(i, p)
	}

	wg.Wait()

	// Cache results
	gs.mu.Lock()
	for _, r := range results {
		gs.healthCache[r.ProjectID] = &r
	}
	gs.mu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"gateway":      gatewayID,
		"uptime_s":     int(time.Since(gs.startTime).Seconds()),
		"total_req":    gs.totalRequests.Load(),
		"active_conns": gs.activeConns.Load(),
		"fleet_size":   len(projects),
		"healthy":      countHealthy(results),
		"probe":        "concurrent-goroutine-fanout",
	})
}

func (gs *GatewayState) handleMetrics(w http.ResponseWriter, r *http.Request) {
	// Prometheus exposition format
	fmt.Fprintf(w, "# HELP glorian_gateway_requests_total Total routed requests\n")
	fmt.Fprintf(w, "# TYPE glorian_gateway_requests_total counter\n")
	fmt.Fprintf(w, "glorian_gateway_requests_total %d\n", gs.totalRequests.Load())
	fmt.Fprintf(w, "# HELP glorian_gateway_active_connections Active connections\n")
	fmt.Fprintf(w, "# TYPE glorian_gateway_active_connections gauge\n")
	fmt.Fprintf(w, "glorian_gateway_active_connections %d\n", gs.activeConns.Load())
	fmt.Fprintf(w, "# HELP glorian_gateway_uptime_seconds Gateway uptime\n")
	fmt.Fprintf(w, "# TYPE glorian_gateway_uptime_seconds counter\n")
	fmt.Fprintf(w, "glorian_gateway_uptime_seconds %d\n", int(time.Since(gs.startTime).Seconds()))
	fmt.Fprintf(w, "# HELP glorian_gateway_fleet_size Registered fleet projects\n")
	fmt.Fprintf(w, "# TYPE glorian_gateway_fleet_size gauge\n")
	fmt.Fprintf(w, "glorian_gateway_fleet_size %d\n", len(gs.registry.Projects))
}

func countHealthy(results []HealthResult) int {
	h := 0
	for _, r := range results {
		if r.Healthy {
			h++
		}
	}
	return h
}

func main() {
	port := flag.Int("port", 8090, "HTTP listen port")
	registryPath := flag.String("fleet", "docs/projects/registry.json", "Path to fleet registry JSON")
	flag.Parse()

	reg, err := loadRegistry(*registryPath)
	if err != nil {
		log.Printf("WARN: %v — starting with empty fleet", err)
		reg = &Registry{Projects: []FleetProject{}, Seal: "empty"}
	}

	gs := &GatewayState{
		registry:    reg,
		healthCache: make(map[string]*HealthResult),
		startTime:   time.Now(),
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/route", gs.handleRoute)
	mux.HandleFunc("/health", gs.handleHealth)
	mux.HandleFunc("/metrics", gs.handleMetrics)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"service": "glorian-fleet-gateway",
			"id":      gatewayID,
			"fleet":   fmt.Sprintf("%d projects", len(gs.registry.Projects)),
		})
	})

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", *port),
		Handler:      mux,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown with 10s drain
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh
		log.Println("draining...")
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		srv.Shutdown(ctx)
	}()

	log.Printf("Glorian Fleet Gateway %d listening on :%d (registry: %s, projects: %d)",
		os.Getpid(), *port, *registryPath, len(gs.registry.Projects))

	if err := srv.ListenAndServe(); err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
