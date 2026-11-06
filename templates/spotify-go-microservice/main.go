package main

import (
	"context"
	"encoding/json"
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

// RecommendResponse represents a low-latency serving payload for Spotify BaRT / Nubank transaction.
type RecommendResponse struct {
	TrackID        string    `json:"track_id"`
	AcousticMu     float64   `json:"acoustic_mu"`
	ServingTs      time.Time `json:"serving_ts"`
	Squad          string    `json:"squad"`
	IdempotencyKey string    `json:"idempotency_key,omitempty"`
}

// MetricsCollector stores lockless atomic counters for Prometheus scrape targets.
type MetricsCollector struct {
	TotalRequests   uint64
	ActiveSessions  int64
	LatencySumMicro uint64
	IdempotentHits  uint64
}

// IdempotencyStore manages banking-grade deduplication (Nubank / Spotify royalty accounting).
type IdempotencyStore struct {
	mu    sync.RWMutex
	cache map[string]IdempotentRecord
}

type IdempotentRecord struct {
	Payload   []byte
	CreatedAt time.Time
}

func NewIdempotencyStore() *IdempotencyStore {
	return &IdempotencyStore{
		cache: make(map[string]IdempotentRecord, 1024),
	}
}

func (s *IdempotencyStore) GetOrSet(key string, compute func() ([]byte, error)) ([]byte, bool, error) {
	if key == "" {
		res, err := compute()
		return res, false, err
	}

	s.mu.RLock()
	rec, exists := s.cache[key]
	s.mu.RUnlock()

	if exists && time.Since(rec.CreatedAt) < 10*time.Minute {
		return rec.Payload, true, nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	// Double-check lock
	if rec, exists := s.cache[key]; exists && time.Since(rec.CreatedAt) < 10*time.Minute {
		return rec.Payload, true, nil
	}

	payload, err := compute()
	if err != nil {
		return nil, false, err
	}

	s.cache[key] = IdempotentRecord{
		Payload:   payload,
		CreatedAt: time.Now(),
	}
	return payload, false, nil
}

var (
	metrics          MetricsCollector
	idempotencyStore = NewIdempotencyStore()
)

func BuildMux() *http.ServeMux {
	mux := http.NewServeMux()

	// 1. CNCF SRE Health endpoint (sub-millisecond response)
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"UP","squad":"Personalization-Bandits","tier":"Tier-1","finops":"DISTROLESS_L0"}`))
	})

	// 2. Prometheus metrics exporter (/metrics)
	mux.HandleFunc("/metrics", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; version=0.0.4")
		reqs := atomic.LoadUint64(&metrics.TotalRequests)
		sessions := atomic.LoadInt64(&metrics.ActiveSessions)
		latSum := atomic.LoadUint64(&metrics.LatencySumMicro)
		hits := atomic.LoadUint64(&metrics.IdempotentHits)

		var avgLat float64
		if reqs > 0 {
			avgLat = float64(latSum) / float64(reqs)
		}

		fmt.Fprintf(w, "# HELP spotify_http_requests_total Total HTTP requests received\n")
		fmt.Fprintf(w, "# TYPE spotify_http_requests_total counter\n")
		fmt.Fprintf(w, "spotify_http_requests_total %d\n", reqs)

		fmt.Fprintf(w, "# HELP spotify_active_audio_sessions Current active streaming sessions\n")
		fmt.Fprintf(w, "# TYPE spotify_active_audio_sessions gauge\n")
		fmt.Fprintf(w, "spotify_active_audio_sessions %d\n", sessions)

		fmt.Fprintf(w, "# HELP spotify_avg_latency_microseconds Average serving latency\n")
		fmt.Fprintf(w, "# TYPE spotify_avg_latency_microseconds gauge\n")
		fmt.Fprintf(w, "spotify_avg_latency_microseconds %.2f\n", avgLat)

		fmt.Fprintf(w, "# HELP nubank_idempotent_deduplications_total Total duplicate transactions filtered\n")
		fmt.Fprintf(w, "# TYPE nubank_idempotent_deduplications_total counter\n")
		fmt.Fprintf(w, "nubank_idempotent_deduplications_total %d\n", hits)
	})

	// 3. Spotify BaRT recommendation / Nubank transaction endpoint with Idempotency
	mux.HandleFunc("/api/v1/recommend", func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		atomic.AddUint64(&metrics.TotalRequests, 1)
		atomic.AddInt64(&metrics.ActiveSessions, 1)
		defer atomic.AddInt64(&metrics.ActiveSessions, -1)

		idempotencyKey := r.Header.Get("X-Idempotency-Key")

		payload, isHit, err := idempotencyStore.GetOrSet(idempotencyKey, func() ([]byte, error) {
			resp := RecommendResponse{
				TrackID:        "spotify:track:4cOdK2wGLETKBW3PvgPWqT",
				AcousticMu:     0.942,
				ServingTs:      time.Now().UTC(),
				Squad:          "Personalization-Bandits",
				IdempotencyKey: idempotencyKey,
			}
			return json.Marshal(resp)
		})

		if err != nil {
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		if isHit {
			atomic.AddUint64(&metrics.IdempotentHits, 1)
			w.Header().Set("X-Cache", "IDEMPOTENT-HIT")
		} else {
			w.Header().Set("X-Cache", "MISS")
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(payload)

		latMicro := uint64(time.Since(start).Microseconds())
		atomic.AddUint64(&metrics.LatencySumMicro, latMicro)
	})

	return mux
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      BuildMux(),
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("[SPOTIFY/NUBANK GO SERVICE] Listening on port %s (Distroless Single-Binary)...", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server listen failed: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit
	log.Println("[SPOTIFY/NUBANK GO SERVICE] Shutdown signal received, draining active connections...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}
	log.Println("[SPOTIFY/NUBANK GO SERVICE] Exited cleanly (Zero Leakage).")
}
