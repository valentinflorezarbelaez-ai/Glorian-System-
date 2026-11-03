const MAX_REQUEST_BYTES = 1024 * 1024;
const MAX_TEXT_BYTES = 16 * 1024;
const MAX_CONTEXT_BYTES = 256 * 1024;
const EXPOSED_TOOLS = new Set([
  "eos_health_check",
  "eos_amplify_prompt",
  "eos_check_architecture",
  "eos_evaluate_decision",
  "eos_spotify_shuffle",
  "eos_optimize_context",
  "eos_slsa_provenance_sbom"
]);
const ALLOWED_MODELS = new Set(["grok", "claude", "openai", "gemini", "deepseek", "llama", "universal"]);
const ALLOWED_STRICTNESS = new Set(["standard", "hardened", "sovereign"]);

let serverPromise;

function isPlainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requestId(value) {
  if (!isPlainRecord(value)) return null;
  if (typeof value.id === "string" && Buffer.byteLength(value.id, "utf8") <= 128) return value.id;
  if (typeof value.id === "number" && Number.isFinite(value.id)) return value.id;
  return null;
}

function rpcError(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function boundedString(value, maximumBytes, allowEmpty = false) {
  return typeof value === "string" && Buffer.byteLength(value, "utf8") <= maximumBytes && (allowEmpty || value.length > 0);
}

function validatePublicTool(toolName, rawArguments) {
  if (!EXPOSED_TOOLS.has(toolName)) {
    return { error: rpcError(null, -32601, "Tool is not exposed by the read-only HTTP MCP endpoint.") };
  }
  if (!isPlainRecord(rawArguments)) {
    return { error: rpcError(null, -32602, "Tool arguments must be a JSON object.") };
  }
  const args = { ...rawArguments };

  switch (toolName) {
    case "eos_amplify_prompt":
      if (!boundedString(args.rawPrompt, 8192)) return { error: rpcError(null, -32602, "rawPrompt must be a non-empty string no larger than 8 KiB.") };
      if (args.targetModel !== undefined && (typeof args.targetModel !== "string" || !ALLOWED_MODELS.has(args.targetModel))) {
        return { error: rpcError(null, -32602, "targetModel is not supported.") };
      }
      if (args.strictLevel !== undefined && (typeof args.strictLevel !== "string" || !ALLOWED_STRICTNESS.has(args.strictLevel))) {
        return { error: rpcError(null, -32602, "strictLevel is not supported.") };
      }
      break;
    case "eos_check_architecture":
      if (args.targetDir !== undefined && args.targetDir !== "src") {
        return { error: rpcError(null, -32602, "The public endpoint only scans the repository src directory.") };
      }
      break;
    case "eos_evaluate_decision":
      for (const field of ["title", "description", "proposedAction"]) {
        if (!boundedString(args[field], MAX_TEXT_BYTES)) {
          return { error: rpcError(null, -32602, `${field} must be a non-empty string no larger than 16 KiB.`) };
        }
      }
      if (args.codeSnippet !== undefined && !boundedString(args.codeSnippet, MAX_TEXT_BYTES, true)) {
        return { error: rpcError(null, -32602, "codeSnippet must be a string no larger than 16 KiB.") };
      }
      if (args.targetDomain !== undefined && !boundedString(args.targetDomain, 128, true)) {
        return { error: rpcError(null, -32602, "targetDomain must be a string no larger than 128 bytes.") };
      }
      break;
    case "eos_spotify_shuffle":
      if (args.tracks !== undefined) {
        if (!Array.isArray(args.tracks) || args.tracks.length < 1 || args.tracks.length > 128) {
          return { error: rpcError(null, -32602, "tracks must contain between 1 and 128 local track records.") };
        }
        for (const track of args.tracks) {
          if (!isPlainRecord(track) || !boundedString(track.id, 128) || !boundedString(track.artistId, 128) ||
            typeof track.bpm !== "number" || !Number.isFinite(track.bpm) || track.bpm <= 0 || track.bpm > 400 ||
            typeof track.camelotKey !== "string" || !/^(?:[1-9]|1[0-2])[AB]$/.test(track.camelotKey)) {
            return { error: rpcError(null, -32602, "Each track requires bounded id/artistId text, BPM in (0, 400], and a valid Camelot key.") };
          }
        }
      }
      if (args.seed !== undefined && (typeof args.seed !== "number" || !Number.isSafeInteger(args.seed))) {
        return { error: rpcError(null, -32602, "seed must be a safe integer.") };
      }
      break;
    case "eos_optimize_context":
      if (Object.prototype.hasOwnProperty.call(args, "filePath")) {
        return { error: rpcError(null, -32602, "The public endpoint accepts submitted text only; repository file reads are disabled.") };
      }
      if (!boundedString(args.content, MAX_CONTEXT_BYTES)) {
        return { error: rpcError(null, -32602, "content must be non-empty text no larger than 256 KiB.") };
      }
      args.filePath = "submitted-context.txt";
      break;
    case "eos_health_check":
      break;
    case "eos_slsa_provenance_sbom":
      if (args.mode !== undefined && (typeof args.mode !== "string" || !["verify", "sbom", "slsa", "both"].includes(args.mode))) {
        return { error: rpcError(null, -32602, "mode must be one of: verify, sbom, slsa, both.") };
      }
      if (args.commitSha !== undefined && typeof args.commitSha !== "string") {
        return { error: rpcError(null, -32602, "commitSha must be a string.") };
      }
      break;
  }

  return { args };
}

async function getServer() {
  if (!serverPromise) {
    serverPromise = import("../src/mcp/eosMcpServer.ts")
      .then(({ EosMcpServer }) => new EosMcpServer(process.cwd()))
      .catch((error) => {
        serverPromise = undefined;
        throw error;
      });
  }
  return serverPromise;
}

function limitPublicTools(response) {
  if (!response?.result || !Array.isArray(response.result.tools)) return response;
  const descriptions = {
    eos_health_check: "Reports this handler's liveness and process memory. Subsystems and external services are not probed.",
    eos_amplify_prompt: "Creates a local EARS/BDD draft. No remote model is called and the output is not verified.",
    eos_check_architecture: "Runs a bounded static analysis on the repository src directory; it does not execute tests or establish production readiness.",
    eos_evaluate_decision: "Applies deterministic local keyword heuristics. Its score is a screening signal, not a verified decision.",
    eos_spotify_shuffle: "Runs a local deterministic track-ordering algorithm on at most 128 supplied tracks. It does not call Spotify.",
    eos_optimize_context: "Compresses caller-supplied text only. It does not read repository files; savings vary by input.",
    eos_slsa_provenance_sbom: "Verifies or generates pure Layer-0 CycloneDX v1.5 SBOM and SLSA Provenance attestations."
  };

  response.result.tools = response.result.tools
    .filter((tool) => EXPOSED_TOOLS.has(tool.name))
    .map((tool) => {
      if (tool.name === "eos_optimize_context") {
        return {
          ...tool,
          description: descriptions[tool.name],
          inputSchema: {
            type: "object",
            properties: { content: { type: "string", description: "Text submitted for local compression; maximum 256 KiB." } },
            required: ["content"]
          }
        };
      }
      if (tool.name === "eos_check_architecture") {
        return {
          ...tool,
          description: descriptions[tool.name],
          inputSchema: {
            type: "object",
            properties: { targetDir: { type: "string", enum: ["src"], description: "Only the repository src directory can be scanned." }
            }
          }
        };
      }
      if (tool.name === "eos_spotify_shuffle") {
        const schema = { ...tool.inputSchema, properties: { ...tool.inputSchema.properties } };
        if (schema.properties.tracks) schema.properties.tracks = { ...schema.properties.tracks, minItems: 1, maxItems: 128 };
        return { ...tool, description: descriptions[tool.name], inputSchema: schema };
      }
      if (tool.name === "eos_slsa_provenance_sbom") {
        return {
          ...tool,
          description: descriptions[tool.name],
          inputSchema: {
            type: "object",
            properties: {
              mode: { type: "string", enum: ["verify", "sbom", "slsa", "both"], description: "Execution mode (verify, sbom, slsa, both)." },
              commitSha: { type: "string", description: "Optional commit SHA for SLSA statement." }
            }
          }
        };
      }
      return { ...tool, description: descriptions[tool.name] };
    });
  return response;
}

function addLocalScope(response, toolName) {
  const text = response?.result?.content?.[0]?.text;
  if (typeof text !== "string") return response;
  let result = text;
  try { result = JSON.parse(text); } catch {}
  response.result.content[0].text = JSON.stringify({
    scope: "LOCAL_ONLY",
    tool: toolName,
    externalSystemsQueried: false,
    deploymentPerformed: false,
    certificationIssued: false,
    result
  });
  return response;
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  const origin = req.headers?.origin;
  if (typeof origin === "string" && origin && !/[\r\n]/.test(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization, Mcp-Session-Id, MCP-Protocol-Version");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({
      status: "METHOD_NOT_ALLOWED",
      transport: "stateless JSON-RPC POST; server-sent events are not supported in serverless mode (ADR-0172)"
    });
  }

  const contentTypeValue = req.headers?.["content-type"];
  const contentType = Array.isArray(contentTypeValue) ? contentTypeValue[0] : contentTypeValue;
  if (typeof contentType !== "string" || !/^application\/json(?:\s*;|$)/i.test(contentType)) {
    return res.status(415).json({ status: "UNSUPPORTED_MEDIA_TYPE", expected: "application/json" });
  }
  const acceptValue = req.headers?.accept;
  const accept = Array.isArray(acceptValue) ? acceptValue.join(",") : acceptValue;
  if (typeof accept === "string" && accept && !accept.includes("application/json") && !accept.includes("*/*")) {
    if (accept.includes("text/event-stream")) {
      return res.status(406).json({
        status: "NOT_ACCEPTABLE",
        message: "Serverless MCP transport operates in stateless JSON-RPC mode only (ADR-0172). For persistent streaming sessions (text/event-stream), connect to the local persistent daemon (src/mcp/eosMcpStreamServer.ts).",
        supported: "application/json"
      });
    }
    return res.status(406).json({ status: "NOT_ACCEPTABLE", supported: "application/json" });
  }

  let rawBody = req.body;
  let bodyText;
  if (Buffer.isBuffer(rawBody)) {
    if (rawBody.byteLength > MAX_REQUEST_BYTES) return res.status(413).json(rpcError(null, -32600, "Request exceeds the 1 MiB limit."));
    bodyText = rawBody.toString("utf8");
  } else if (typeof rawBody === "string") {
    if (Buffer.byteLength(rawBody, "utf8") > MAX_REQUEST_BYTES) return res.status(413).json(rpcError(null, -32600, "Request exceeds the 1 MiB limit."));
    bodyText = rawBody;
  } else if (isPlainRecord(rawBody)) {
    try { bodyText = JSON.stringify(rawBody); } catch {
      return res.status(400).json(rpcError(null, -32600, "Invalid JSON-RPC request."));
    }
    if (typeof bodyText !== "string" || Buffer.byteLength(bodyText, "utf8") > MAX_REQUEST_BYTES) {
      return res.status(413).json(rpcError(null, -32600, "Request exceeds the 1 MiB limit."));
    }
  } else {
    return res.status(400).json(rpcError(null, -32600, "Request body must be a JSON object."));
  }

  let message;
  try { message = JSON.parse(bodyText); } catch {
    return res.status(400).json(rpcError(null, -32700, "Parse error: Invalid JSON."));
  }
  if (!isPlainRecord(message) || message.jsonrpc !== "2.0" || typeof message.method !== "string" || message.method.length > 128) {
    return res.status(400).json(rpcError(requestId(message), -32600, "Invalid JSON-RPC request."));
  }
  if (message.params !== undefined && !isPlainRecord(message.params)) {
    return res.status(400).json(rpcError(requestId(message), -32602, "MCP params must be a JSON object."));
  }
  const hasId = Object.prototype.hasOwnProperty.call(message, "id");
  if (!hasId && message.method.startsWith("notifications/")) return res.status(202).end();
  if (!hasId || message.id === null ||
    (typeof message.id !== "string" && (typeof message.id !== "number" || !Number.isFinite(message.id))) ||
    (typeof message.id === "string" && Buffer.byteLength(message.id, "utf8") > 128)) {
    return res.status(400).json(rpcError(requestId(message), -32600, "A bounded JSON-RPC request ID is required."));
  }

  if (!["initialize", "ping", "tools/list", "tools/call"].includes(message.method)) {
    return res.status(200).json(rpcError(message.id, -32601, "Method is not exposed by the stateless HTTP transport."));
  }

  if (message.method === "tools/call") {
    const suppliedArgs = message.params?.arguments === undefined ? {} : message.params.arguments;
    const validated = validatePublicTool(message.params?.name, suppliedArgs);
    if (validated.error) {
      validated.error.id = message.id;
      return res.status(200).json(validated.error);
    }
    message.params.arguments = validated.args;
  }

  try {
    const server = await getServer();
    let response = server.handleRequest(message);
    if (!response) return res.status(202).end();
    if (message.method === "tools/list") response = limitPublicTools(response);
    if (message.method === "initialize" && response.result) {
      response.result.capabilities = { tools: { listChanged: false } };
    }
    if (message.method === "tools/call" && !response.error) {
      response = addLocalScope(response, message.params.name);
    }
    const serialized = JSON.stringify(response);
    if (Buffer.byteLength(serialized, "utf8") > MAX_REQUEST_BYTES) {
      return res.status(500).json(rpcError(message.id, -32603, "MCP response exceeds the 1 MiB limit."));
    }
    return res.status(200).json(response);
  } catch {
    return res.status(503).json({ status: "MCP_ENGINE_UNAVAILABLE", externalSystemsQueried: false });
  }
}
