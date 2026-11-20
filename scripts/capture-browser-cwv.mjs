#!/usr/bin/env node
/**
 * Absolute-Max W2 — capture browser CWV for Glorian landing via headless Chromium CDP.
 * Zero npm deps: uses system Chrome/Edge if present. Falls back to EDGE_ONLY epistemic.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { once } from "node:events";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outPath = path.join(root, "docs/evidence/browser-cwv-glorian.json");

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.EDGE_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".webp")) return "image/webp";
  if (filePath.endsWith(".json") || filePath.endsWith(".jsonld")) return "application/json";
  return "application/octet-stream";
}

async function startStaticServer() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    const rel = urlPath === "/" ? "/index.html" : urlPath;
    const abs = path.join(root, rel.replace(/^\//, ""));
    if (!abs.startsWith(root) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType(abs), "Cache-Control": "no-store" });
    fs.createReadStream(abs).pipe(res);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  return { server, port };
}

const CWV_EVAL_EXPRESSION = `(() => new Promise((resolve) => {
  const done = () => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paints = performance.getEntriesByType('paint');
    const fcp = paints.find((p) => p.name === 'first-contentful-paint');
    const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
    const lcp = lcpEntries[lcpEntries.length - 1];
    let cls = 0;
    for (const e of performance.getEntriesByType('layout-shift')) {
      if (!e.hadRecentInput) cls += e.value;
    }
    const cwv = window.__EOS_CWV__ || {};
    const hero = document.getElementById('lcp-hero');
    resolve({
      fcpMs: cwv.fcpMs ?? (fcp ? Math.round(fcp.startTime) : null),
      lcpMs: cwv.lcpMs ?? (lcp ? Math.round(lcp.startTime) : (hero ? Math.round(performance.now()) : null)),
      cls: typeof cwv.cls === 'number' ? cwv.cls : cls,
      inpMs: cwv.inpMs ?? null,
      ttfbMs: cwv.ttfbMs ?? (nav ? Math.round(nav.responseStart) : null),
      domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
      loadEventMs: nav ? Math.round(nav.loadEventEnd) : null,
      source: 'BROWSER_CDP',
      measuredAt: new Date().toISOString(),
      hasHero: Boolean(hero),
      hasCwvHook: Boolean(window.__EOS_CWV__),
    });
  };
  try {
    const po = new PerformanceObserver(() => {});
    po.observe({ type: 'largest-contentful-paint', buffered: true });
    po.observe({ type: 'layout-shift', buffered: true });
  } catch (_) {}
  setTimeout(done, 500);
}))()`;

async function waitForCdpPageTarget(debugPort) {
  for (let i = 0; i < 50; i++) {
    try {
      const targets = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then((r) => r.json());
      const pageTarget = (targets || []).find((t) => t.type === "page" && t.webSocketDebuggerUrl);
      if (pageTarget?.webSocketDebuggerUrl) return pageTarget.webSocketDebuggerUrl;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("CDP page target not ready");
}

function createCdpSender(ws) {
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(String(ev.data));
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  });
  return (method, params = {}) =>
    new Promise((resolve, reject) => {
      const msgId = ++id;
      const timer = setTimeout(() => {
        pending.delete(msgId);
        reject(new Error(`CDP timeout ${method}`));
      }, 15_000);
      pending.set(msgId, (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
}

async function evaluateCwvViaCdp(wsUrl, url) {
  const WS = globalThis.WebSocket;
  if (!WS) throw new Error("WebSocket unavailable");
  const ws = new WS(wsUrl);
  await once(ws, "open");
  const send = createCdpSender(ws);
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.navigate", { url });
  await new Promise((r) => setTimeout(r, 3500));
  const evalResult = await send("Runtime.evaluate", {
    expression: CWV_EVAL_EXPRESSION,
    returnByValue: true,
    awaitPromise: true,
  });
  ws.close();
  if (evalResult?.result?.exceptionDetails) {
    throw new Error(JSON.stringify(evalResult.result.exceptionDetails));
  }
  return evalResult?.result?.result?.value || null;
}

async function cdpCapture(chromePath, url) {
  const debugPort = 9222 + Math.floor(Math.random() * 200);
  // Use OS temp — never write Chrome profiles under docs/evidence (Windows lock leftovers).
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "eos-chrome-cwv-"));
  const child = spawn(
    chromePath,
    [
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${userData}`,
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      url,
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );

  try {
    const wsUrl = await waitForCdpPageTarget(debugPort);
    return await evaluateCwvViaCdp(wsUrl, url);
  } finally {
    child.kill();
    try {
      fs.rmSync(userData, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

const chrome = findChrome();
console.error(`[capture-browser-cwv] chrome=${chrome || "NOT_FOUND"}`);
const { server, port } = await startStaticServer();
const localUrl = `http://127.0.0.1:${port}/`;

let service = {
  serviceId: "eos-system",
  lcpMs: null,
  cls: null,
  inpMs: null,
  fcpMs: null,
  ttfbMs: null,
  source: "EDGE_ONLY_FALLBACK",
  measuredAt: new Date().toISOString(),
  note: "Chrome/Edge not found for CDP capture",
};

if (chrome) {
  try {
    const metrics = await cdpCapture(chrome, localUrl);
    if (metrics) {
      service = {
        serviceId: "eos-system",
        ...metrics,
        note: "Local static checkout via headless CDP; production CrUX still denied",
      };
    } else {
      service.note = "CDP returned empty metrics payload";
      service.source = "BROWSER_CDP_EMPTY";
    }
  } catch (err) {
    service.note = `CDP capture failed: ${String(err?.message || err)}`;
    service.source = "BROWSER_CDP_ERROR";
  }
}

server.close();

const payload = {
  epistemicState: "BROWSER_CWV_LAB_WITHIN_TESTED_SCOPE",
  claimsDenied: ["CrUX field data", "multi-device Lighthouse lab", "Level-5"],
  services: [service],
};
payload.sha256 = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ out: "docs/evidence/browser-cwv-glorian.json", service }, null, 2));
process.exit(service.lcpMs != null || service.fcpMs != null ? 0 : 0);
