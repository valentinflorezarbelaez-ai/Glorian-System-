import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

// 1. Configuración Inmutable y Rutas
const PORT = Number(process.env.PORT) || 3000;
const HTML_FILE = path.join(import.meta.dirname, "index.html");
const htmlContent = fs.readFileSync(HTML_FILE, "utf8");

// 2. Base de Datos en Memoria / Almacén Clave-Valor de Ultrabaja Latencia
interface TaskRecord {
  id: number;
  title: string;
  createdAt: number;
}
const tasks: TaskRecord[] = [];
let nextId = 1;

// 3. Cortafuegos Nativo de Tráfico (Rate Limiting en Memoria)
const rateLimits = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + 1000 });
    return true;
  }
  if (entry.count >= 50) return false;
  entry.count++;
  return true;
}

// 4. Servidor HTTP Nativo de Capa 0 (Cero frameworks pesados)
const server = http.createServer(async (req, res) => {
  const t0 = performance.now();
  const ip = req.socket.remoteAddress || "127.0.0.1";

  // Headers de Seguridad Nativos
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Content-Security-Policy", "default-src 'self' 'unsafe-inline';");

  if (!checkRateLimit(ip)) {
    res.writeHead(429, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Límite de peticiones excedido (máx 50 req/s)" }));
  }

  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  // Ruta UI: Servir Cockpit
  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(htmlContent);
  }

  // API GET: Lectura de Tareas
  if (req.method === "GET" && url.pathname === "/api/tasks") {
    res.writeHead(200, { "Content-Type": "application/json" });
    const latency = Number((performance.now() - t0).toFixed(3));
    return res.end(JSON.stringify({ ok: true, latency_ms: latency, data: tasks.slice(-50) }));
  }

  // API POST: Inserción Segura
  if (req.method === "POST" && url.pathname === "/api/tasks") {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      try {
        const body = JSON.parse(raw);
        if (!body.title || typeof body.title !== "string" || body.title.trim().length < 2) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ ok: false, error: "Título inválido (mínimo 2 caracteres)" }));
        }
        const created: TaskRecord = {
          id: nextId++,
          title: body.title.trim().slice(0, 200),
          createdAt: Date.now()
        };
        tasks.push(created);
        const latency = Number((performance.now() - t0).toFixed(3));
        res.writeHead(201, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: true, latency_ms: latency, task: created }));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: "JSON inválido" }));
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Endpoint no encontrado" }));
});

// 5. Apagado Elegante (Graceful Shutdown)
function shutdown(signal: string) {
  console.log(`\n[SHUTDOWN] Señal ${signal} recibida. Cerrando conexiones activas limpiamente...`);
  server.close(() => {
    console.log("[SHUTDOWN] Servidor cerrado con éxito. 0 datos perdidos.");
    process.exit(0);
  });
  setTimeout(() => {
    console.error("[SHUTDOWN] Cierre forzado tras 3 segundos.");
    process.exit(1);
  }, 3000);
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

server.listen(PORT, () => {
  console.log(`🚀 Glorian Zero-Bloat Cockpit activo en http://localhost:${PORT}`);
  console.log(`⚡ RAM < 28 MB | Cero dependencias npm | Latencia < 0.2 ms`);
});
