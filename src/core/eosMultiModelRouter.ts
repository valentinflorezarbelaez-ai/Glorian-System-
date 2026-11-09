/**
 * EOS MULTI-MODEL COGNITIVE ROUTER (Layer 0)
 * SPEC-047: Frontier Agent Harness — Multi-Model Routing Engine
 *
 * Routes AI tasks to the optimal model based on task type, complexity, and cost:
 *   - ARCHITECT tasks  → heavy reasoning model (Claude Opus / Gemini Pro)
 *   - CODE tasks       → fast execution model (DeepSeek Coder / Claude Haiku / Gemini Flash)
 *   - REVIEW tasks     → balanced model (Claude Sonnet / Gemini 1.5 Pro)
 *   - SECURITY tasks   → paranoid model (Claude Opus with extended thinking)
 *
 * The router also:
 *   - Injects the EosAxiomMemory rules block into every system prompt
 *   - Enforces JSON-only responses (Zero Vibe Coding — no prose output)
 *   - Implements retry with exponential backoff (max 3 attempts per call)
 *   - Tracks token usage per model for FinOps budget control
 *
 * Designed to work with any HTTP-based model API (Anthropic, Google, OpenAI, Groq).
 * Zero external npm dependencies — uses native node:https.
 */

import https from "node:https";
import crypto from "node:crypto";

import { assertPrecondition, deepFreeze, Ok, Err, type Result } from "./eosKernelPrimitives.ts";

import type { ThoughtBranch } from "./eosAgiCore.ts";

// ============================================================================
// 1. DATA CONTRACTS
// ============================================================================

export type ModelFamily = "anthropic" | "google" | "openai" | "groq" | "deepseek";

export type TaskType =
  | "ARCHITECT" // Design, SDD, ADR, spec writing — use heavy model
  | "CODE" // Code generation, refactoring — use fast model
  | "REVIEW" // Code review, security audit — use balanced model
  | "SECURITY" // Vulnerability analysis, zero-trust — use paranoid model
  | "COMPRESS"; // Context compression, summarization — use cheapest model

export interface ModelConfig {
  readonly family: ModelFamily;
  readonly model: string;
  readonly apiBaseUrl: string;
  readonly maxTokens: number;
  readonly temperature: number;
  /** Approximate cost per 1M input tokens in USD (for FinOps tracking). */
  readonly costPer1MInputTokens: number;
  /** Approximate cost per 1M output tokens in USD. */
  readonly costPer1MOutputTokens: number;
}

export interface RouterConfig {
  /** Model to use for ARCHITECT tasks. */
  readonly architectModel: ModelConfig;
  /** Model to use for CODE tasks. */
  readonly codeModel: ModelConfig;
  /** Model to use for REVIEW tasks. */
  readonly reviewModel: ModelConfig;
  /** Model to use for SECURITY tasks. */
  readonly securityModel: ModelConfig;
  /** Model to use for COMPRESS tasks. */
  readonly compressModel: ModelConfig;
  /** Maximum retries per call. Default: 3. */
  readonly maxRetries?: number;
  /** Base delay in ms for exponential backoff. Default: 1000. */
  readonly retryBaseDelayMs?: number;
}

export interface ModelMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

export interface ModelCallResult {
  readonly model: string;
  readonly taskType: TaskType;
  readonly rawContent: string;
  readonly inputTokensEstimate: number;
  readonly outputTokensEstimate: number;
  readonly estimatedCostUsd: number;
  readonly latencyMs: number;
  readonly retryCount: number;
  readonly callHash: string;
}

/** Request to generate ThoughtBranches for the AGI Core. */
export interface BranchGenerationRequest {
  readonly objective: string;
  /** Number of orthogonal branches to generate (default: 3). */
  readonly branchCount?: number;
  /** Target file to modify. */
  readonly targetRelPath: string;
  /** Current content of the target file (for context). */
  readonly currentContent?: string;
  /** The learned rules block from EosAxiomMemory. */
  readonly rulesBlock?: string;
  /** Extra context (blast radius, spec, etc.). */
  readonly extraContext?: string;
}

/** FinOps budget tracker. */
export interface RouterUsageStats {
  readonly totalCalls: number;
  readonly totalEstimatedCostUsd: number;
  readonly callsByTaskType: Record<TaskType, number>;
  readonly callsByModel: Record<string, number>;
}

// ============================================================================
// 2. BUILT-IN MODEL CONFIGS (sensible defaults — override via constructor)
// ============================================================================

export const CLAUDE_OPUS: ModelConfig = {
  family: "anthropic",
  model: "claude-opus-4-5",
  apiBaseUrl: "https://api.anthropic.com",
  maxTokens: 8192,
  temperature: 0.2,
  costPer1MInputTokens: 15.0,
  costPer1MOutputTokens: 75.0,
};

export const CLAUDE_SONNET: ModelConfig = {
  family: "anthropic",
  model: "claude-sonnet-4-5",
  apiBaseUrl: "https://api.anthropic.com",
  maxTokens: 8192,
  temperature: 0.3,
  costPer1MInputTokens: 3.0,
  costPer1MOutputTokens: 15.0,
};

export const CLAUDE_HAIKU: ModelConfig = {
  family: "anthropic",
  model: "claude-haiku-4-5",
  apiBaseUrl: "https://api.anthropic.com",
  maxTokens: 4096,
  temperature: 0.1,
  costPer1MInputTokens: 0.25,
  costPer1MOutputTokens: 1.25,
};

export const GEMINI_PRO: ModelConfig = {
  family: "google",
  model: "gemini-1.5-pro",
  apiBaseUrl: "https://generativelanguage.googleapis.com",
  maxTokens: 8192,
  temperature: 0.2,
  costPer1MInputTokens: 3.5,
  costPer1MOutputTokens: 10.5,
};

export const GEMINI_FLASH: ModelConfig = {
  family: "google",
  model: "gemini-1.5-flash",
  apiBaseUrl: "https://generativelanguage.googleapis.com",
  maxTokens: 4096,
  temperature: 0.1,
  costPer1MInputTokens: 0.075,
  costPer1MOutputTokens: 0.3,
};

export const DEEPSEEK_CODER: ModelConfig = {
  family: "deepseek",
  model: "deepseek-coder",
  apiBaseUrl: "https://api.deepseek.com",
  maxTokens: 4096,
  temperature: 0.1,
  costPer1MInputTokens: 0.14,
  costPer1MOutputTokens: 0.28,
};

/** Default router config — Anthropic-first, cost-optimized. */
export const DEFAULT_ROUTER_CONFIG: RouterConfig = {
  architectModel: CLAUDE_OPUS,
  codeModel: CLAUDE_HAIKU,
  reviewModel: CLAUDE_SONNET,
  securityModel: CLAUDE_OPUS,
  compressModel: CLAUDE_HAIKU,
  maxRetries: 3,
  retryBaseDelayMs: 1000,
};

// ============================================================================
// 3. HTTP TRANSPORT (zero-dep, native node:https)
// ============================================================================

function httpsPost(
  url: string,
  headers: Record<string, string>,
  body: string,
  timeoutMs: number = 60_000,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: { ...headers, "Content-Length": Buffer.byteLength(body) },
      timeout: timeoutMs,
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk: Buffer) => {
        data += chunk.toString();
      });
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: data }));
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`HTTP request timed out after ${timeoutMs}ms`));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ============================================================================
// 4. ADAPTER: Anthropic Messages API
// ============================================================================

async function callAnthropic(config: ModelConfig, messages: ModelMessage[], apiKey: string): Promise<string> {
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const userMessages = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content }));

  const body = JSON.stringify({
    model: config.model,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    system,
    messages: userMessages,
  });

  const response = await httpsPost(
    `${config.apiBaseUrl}/v1/messages`,
    {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body,
  );

  if (response.status !== 200) {
    throw new Error(`Anthropic API error ${response.status}: ${response.body.slice(0, 200)}`);
  }

  const parsed = JSON.parse(response.body) as {
    content: Array<{ type: string; text: string }>;
  };
  return parsed.content.find((c) => c.type === "text")?.text ?? "";
}

// ============================================================================
// 5. ADAPTER: Google Generative Language API
// ============================================================================

async function callGoogle(config: ModelConfig, messages: ModelMessage[], apiKey: string): Promise<string> {
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const body = JSON.stringify({
    system_instruction: system ? { parts: [{ text: system }] } : undefined,
    contents,
    generationConfig: {
      temperature: config.temperature,
      maxOutputTokens: config.maxTokens,
    },
  });

  const response = await httpsPost(
    `${config.apiBaseUrl}/v1beta/models/${config.model}:generateContent?key=${apiKey}`,
    { "Content-Type": "application/json" },
    body,
  );

  if (response.status !== 200) {
    throw new Error(`Google API error ${response.status}: ${response.body.slice(0, 200)}`);
  }

  const parsed = JSON.parse(response.body) as {
    candidates: Array<{
      content: { parts: Array<{ text: string }> };
    }>;
  };
  return parsed.candidates[0]?.content?.parts[0]?.text ?? "";
}

// ============================================================================
// 6. ADAPTER: OpenAI-compatible API (OpenAI, Groq, DeepSeek all use same schema)
// ============================================================================

async function callOpenAICompat(config: ModelConfig, messages: ModelMessage[], apiKey: string): Promise<string> {
  const body = JSON.stringify({
    model: config.model,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const response = await httpsPost(
    `${config.apiBaseUrl}/v1/chat/completions`,
    {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body,
  );

  if (response.status !== 200) {
    throw new Error(`API error ${response.status}: ${response.body.slice(0, 200)}`);
  }

  const parsed = JSON.parse(response.body) as {
    choices: Array<{ message: { content: string } }>;
  };
  return parsed.choices[0]?.message?.content ?? "";
}

// ============================================================================
// 7. MULTI-MODEL ROUTER
// ============================================================================

/**
 * Routes tasks to the right model, injects learned rules, and enforces
 * JSON-only output format (Zero Vibe Coding).
 *
 * API keys are read from environment variables at call time (never stored).
 * Required env vars (only needed for the model families you configure):
 *   ANTHROPIC_API_KEY
 *   GOOGLE_API_KEY
 *   OPENAI_API_KEY
 *   GROQ_API_KEY
 *   DEEPSEEK_API_KEY
 */
export class EosMultiModelRouter {
  private readonly config: RouterConfig;
  private _totalCalls = 0;
  private _totalCostUsd = 0;
  private readonly _callsByTaskType: Record<TaskType, number> = {
    ARCHITECT: 0,
    CODE: 0,
    REVIEW: 0,
    SECURITY: 0,
    COMPRESS: 0,
  };
  private readonly _callsByModel: Record<string, number> = {};
  private readonly _responseCache = new Map<string, { content: string; cachedAt: number }>();
  private readonly _cacheTtlMs: number;
  private readonly _callsPerMinute: Map<ModelFamily, number[]> = new Map();
  private readonly _maxCallsPerMinute: number;

  constructor(config: Partial<RouterConfig> = {}, options?: { cacheTtlMs?: number; maxCallsPerMinute?: number }) {
    this.config = { ...DEFAULT_ROUTER_CONFIG, ...config };
    this._cacheTtlMs = options?.cacheTtlMs ?? 5 * 60 * 1000; // 5 minutes default
    this._maxCallsPerMinute = options?.maxCallsPerMinute ?? 30; // 30 calls/min default
  }

  private _selectModel(taskType: TaskType): ModelConfig {
    switch (taskType) {
      case "ARCHITECT":
        return this.config.architectModel;
      case "CODE":
        return this.config.codeModel;
      case "REVIEW":
        return this.config.reviewModel;
      case "SECURITY":
        return this.config.securityModel;
      case "COMPRESS":
        return this.config.compressModel;
    }
  }

  private _getApiKey(family: ModelFamily): string {
    const envMap: Record<ModelFamily, string> = {
      anthropic: "ANTHROPIC_API_KEY",
      google: "GOOGLE_API_KEY",
      openai: "OPENAI_API_KEY",
      groq: "GROQ_API_KEY",
      deepseek: "DEEPSEEK_API_KEY",
    };
    // Try direct env var first (fast path), then SecretsManager async fallback
    const key = process.env[envMap[family]];
    if (!key) {
      throw new Error(
        `Missing API key: set environment variable ${envMap[family]} ` +
          `(or configure EOS_SECRETS_PROVIDER=aws|vault|doppler for production secrets management)`,
      );
    }
    return key;
  }

  /**
   * Async version — uses EosSecretsManager for production secret fetching.
   * Falls back to env var if SecretsManager returns null.
   */
  private async _getApiKeyAsync(family: ModelFamily): Promise<string> {
    const envMap: Record<ModelFamily, string> = {
      anthropic: "ANTHROPIC_API_KEY",
      google: "GOOGLE_API_KEY",
      openai: "OPENAI_API_KEY",
      groq: "GROQ_API_KEY",
      deepseek: "DEEPSEEK_API_KEY",
    };
    const secretKey = envMap[family];
    // Dynamic import to keep this zero-dep when secrets manager isn't used
    try {
      const { secrets } = await import("./eosSecretsManager.ts");
      const value = await secrets.get(secretKey);
      if (value) return value;
    } catch {
      /* fall through */
    }
    const fallback = process.env[secretKey];
    if (!fallback) {
      throw new Error(`Missing API key: ${secretKey} — set env var or configure EOS_SECRETS_PROVIDER`);
    }
    return fallback;
  }

  private async _callWithRetry(
    config: ModelConfig,
    messages: ModelMessage[],
  ): Promise<{ content: string; retryCount: number }> {
    const maxRetries = this.config.maxRetries ?? 3;
    const baseDelay = this.config.retryBaseDelayMs ?? 1000;
    // Use async key fetch — reads from SecretsManager if configured
    const apiKey = await this._getApiKeyAsync(config.family);

    // Content-addressed cache check
    const cacheKey = crypto
      .createHash("sha256")
      .update(config.model + JSON.stringify(messages))
      .digest("hex")
      .slice(0, 32);
    const cached = this._responseCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < this._cacheTtlMs) {
      return { content: cached.content, retryCount: 0 };
    }

    // Rate limiting per model family
    const now = Date.now();
    const windowMs = 60_000;
    const calls = this._callsPerMinute.get(config.family) ?? [];
    const recentCalls = calls.filter((t) => now - t < windowMs);
    this._callsPerMinute.set(config.family, recentCalls);
    if (recentCalls.length >= this._maxCallsPerMinute) {
      throw new Error(
        `Rate limit exceeded for ${config.family}: ${recentCalls.length} calls in last 60s (max ${this._maxCallsPerMinute})`,
      );
    }
    recentCalls.push(now);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        await sleep(baseDelay * Math.pow(2, attempt - 1)); // exponential backoff
      }
      try {
        let content: string;
        switch (config.family) {
          case "anthropic":
            content = await callAnthropic(config, messages, apiKey);
            break;
          case "google":
            content = await callGoogle(config, messages, apiKey);
            break;
          case "openai":
          case "groq":
          case "deepseek":
            content = await callOpenAICompat(config, messages, apiKey);
            break;
        }
        // Cache the successful response
        this._responseCache.set(cacheKey, { content, cachedAt: Date.now() });
        return { content, retryCount: attempt };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`[ROUTER] Attempt ${attempt + 1} failed: ${lastError.message.slice(0, 80)}`);
      }
    }
    throw lastError ?? new Error("Model call failed after retries");
  }

  /**
   * Calls the appropriate model for the given task type.
   * Enforces JSON-only response by appending the JSON instruction to the system prompt.
   */
  public async call(
    taskType: TaskType,
    messages: ModelMessage[],
    rulesBlock?: string,
  ): Promise<Result<ModelCallResult, Error>> {
    const model = this._selectModel(taskType);
    const t0 = Date.now();

    // Inject learned axioms + JSON enforcement into system prompt
    const jsonInstruction = `
RESPONSE FORMAT INVARIANT (Zero Vibe Coding):
- You MUST respond with ONLY valid JSON. No prose, no markdown, no explanation outside JSON.
- Any non-JSON response will be rejected by the deterministic tribunal.`;

    const rulesInjection = rulesBlock ? `\n\n${rulesBlock}` : "";

    const messagesWithRules: ModelMessage[] = messages.map((m, i) => {
      if (m.role === "system") {
        return { ...m, content: m.content + rulesInjection + jsonInstruction };
      }
      // If no system message exists, prepend one
      if (i === 0 && messages[0]?.role !== "system") {
        return m;
      }
      return m;
    });

    // Ensure system message exists
    const hasSystem = messagesWithRules.some((m) => m.role === "system");
    const finalMessages: ModelMessage[] = hasSystem
      ? messagesWithRules
      : [{ role: "system", content: rulesInjection + jsonInstruction }, ...messagesWithRules];

    try {
      const { content, retryCount } = await this._callWithRetry(model, finalMessages);

      const inputTokensEstimate = Math.ceil(finalMessages.reduce((sum, m) => sum + m.content.length, 0) / 4);
      const outputTokensEstimate = Math.ceil(content.length / 4);
      const estimatedCostUsd =
        (inputTokensEstimate / 1_000_000) * model.costPer1MInputTokens +
        (outputTokensEstimate / 1_000_000) * model.costPer1MOutputTokens;

      // Track usage
      this._totalCalls++;
      this._totalCostUsd += estimatedCostUsd;
      this._callsByTaskType[taskType]++;
      this._callsByModel[model.model] = (this._callsByModel[model.model] ?? 0) + 1;

      const callHash = crypto
        .createHash("sha256")
        .update(`${model.model}:${Date.now()}:${content.slice(0, 64)}`)
        .digest("hex")
        .slice(0, 16);

      return Ok(
        deepFreeze({
          model: model.model,
          taskType,
          rawContent: content,
          inputTokensEstimate,
          outputTokensEstimate,
          estimatedCostUsd,
          latencyMs: Date.now() - t0,
          retryCount,
          callHash,
        }),
      );
    } catch (err) {
      return Err(err instanceof Error ? err : new Error(String(err)));
    }
  }

  /**
   * Generates N orthogonal ThoughtBranches for the AGI Core.
   *
   * The AI is asked to produce N distinct strategies with different trade-offs:
   *   Branch 1: minimum complexity / fewest lines of code
   *   Branch 2: maximum robustness / most defensive
   *   Branch N: most elegant / best long-term architecture
   *
   * Returns an empty array on failure (caller should handle gracefully).
   */
  public async generateBranches(req: BranchGenerationRequest): Promise<ThoughtBranch[]> {
    const branchCount = req.branchCount ?? 3;

    const systemPrompt = `You are the EOS Sovereign Code Architect. Your task is to generate ${branchCount} orthogonal solution strategies for the given objective. Each strategy must take a fundamentally different approach.`;

    const userPrompt = `
OBJECTIVE: ${req.objective}
TARGET FILE: ${req.targetRelPath}
${req.currentContent ? `\nCURRENT FILE CONTENT:\n\`\`\`\n${req.currentContent.slice(0, 4000)}\n\`\`\`` : ""}
${req.extraContext ? `\nCONTEXT:\n${req.extraContext.slice(0, 2000)}` : ""}

Generate exactly ${branchCount} solution branches. Each branch must:
1. Take a genuinely different approach from the others
2. Include the COMPLETE file content for targetRelPath
3. Be assigned a complexity score 1-10 (1=simplest, 10=most complex)

Respond with ONLY this JSON structure (no markdown, no prose):
{
  "branches": [
    {
      "id": "BRANCH-001",
      "strategy": "one sentence description",
      "targetRelPath": "${req.targetRelPath}",
      "proposedContent": "FULL FILE CONTENT HERE",
      "estimatedComplexity": 3
    }
  ]
}`;

    const result = await this.call(
      "CODE",
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      req.rulesBlock,
    );

    if (!result.ok) {
      console.error(`[ROUTER] Branch generation failed: ${result.error.message}`);
      return [];
    }

    try {
      // Extract JSON — strip any accidental markdown fences
      const raw = result.value.rawContent
        .replace(/^```(?:json)?\n?/m, "")
        .replace(/\n?```$/m, "")
        .trim();

      const parsed = JSON.parse(raw) as { branches: ThoughtBranch[] };
      return parsed.branches ?? [];
    } catch (err) {
      console.error(`[ROUTER] Failed to parse branches JSON: ${String(err)}`);
      return [];
    }
  }

  /** Returns current FinOps usage statistics. */
  public getUsageStats(): RouterUsageStats {
    return deepFreeze({
      totalCalls: this._totalCalls,
      totalEstimatedCostUsd: Number(this._totalCostUsd.toFixed(6)),
      callsByTaskType: { ...this._callsByTaskType },
      callsByModel: { ...this._callsByModel },
    });
  }
}
