# 🪶 Glorian Zero-Bloat Cockpit · Plantilla de Cúspide Minimalista

> **Filosofía**: La perfección no ocurre cuando no hay nada más que agregar, sino cuando ya no queda nada más que quitar.
> **Stack**: Node.js 22+ / Bun nativo · TypeScript sin build step · HTML5 + CSS Cabina de Vuelo puro.
> **Métricas**: <15 KB peso total · <28 MB RAM · <0.2 ms latencia de respuesta · 0 dependencias `node_modules`.

---

## ⚡ Inicio Rápido en 3 Segundos

### Con Node.js (v22+ nativo con TypeScript strip-types):
```bash
node templates/glorian-zero-bloat-cockpit/server.ts
```

### O con Bun:
```bash
bun templates/glorian-zero-bloat-cockpit/server.ts
```

Abre en tu navegador: **`http://localhost:3000`**

---

## 🛡️ Los 5 Blindajes Integrados

1. **Cabeceras de Seguridad Nativas**: CSP, `nosniff`, `X-Frame-Options: DENY`.
2. **Cortafuegos Anti-Bot en Memoria**: 50 req/s por IP con HTTP 429 automático.
3. **Apagado Elegante (Graceful Shutdown)**: Captura `SIGINT`/`SIGTERM` y drena conexiones.
4. **Telemetría Nanosegundo**: `performance.now()` reportado en cada JSON.
5. **Estética de Cabina de Vuelo**: Obsidiana pura `#050508`, Blanco `#F8FAFC`, Acento Cian `#00F0FF` y Oro Solar `#F59E0B`. Contraste WCAG 2.1 AAA (>14:1).
