// scripts/mcp-server-http.mjs
// EOS System — Bi-Directional MCP Live Stream Server (SSE & Stdio)
// Governed by ADR-034, SPEC-027, FR-066..FR-070
// Zero external dependencies.

import path from "node:path";
import { fileURLToPath } from "node:url";
import packageMetadata from "../package.json" with { type: "json" };
import { EosMcpStreamServer } from "../src/mcp/eosMcpStreamServer.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3333;
const HOST = process.env.HOST || "127.0.0.1";

const streamServer = new EosMcpStreamServer(projectRoot);

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("mcp-server-http.mjs")) {
  await streamServer.listen(PORT, HOST);

  console.log(`======================================================================`);
  console.log(` EOS SYSTEM v${packageMetadata.version} — LOCAL MCP HTTP/SSE SERVER             `);
  console.log(` Scope: authenticated HTTP read-only allowlist | Port: ${PORT}  `);
  console.log(`======================================================================`);
  console.log(` [SSE Stream Endpoint]  : http://${HOST}:${PORT}/sse`);
  console.log(` [Message Backchannel]  : http://${HOST}:${PORT}/message?sessionId=<id>`);
  console.log(` [Health & Telemetry]   : http://${HOST}:${PORT}/health`);
  console.error(` [Bearer Token]         : ${streamServer.authToken} (local only; configure Authorization: Bearer <token>)`);
  console.error(` [Allowed Origins]      : ${process.env.EOS_MCP_ALLOWED_ORIGINS || "none; configure exact origins for browser clients"}`);
  console.log(` [Capabilities]         : read-only HTTP tools; mutations are disabled`);
  console.log(`======================================================================`);

  process.on("SIGINT", async () => {
    console.log("\n[EOS MCP] Shutting down live stream server...");
    await streamServer.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await streamServer.close();
    process.exit(0);
  });
}

export default streamServer;
