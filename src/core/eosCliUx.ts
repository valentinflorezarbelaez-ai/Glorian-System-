/**
 * EOS CLI UX ENGINE (Layer 0)
 * SPEC-050: Jakob Nielsen 10 Usability Heuristics applied to the EOS CLI.
 *
 * Implements:
 *   1. Command suggestion engine (Levenshtein distance) — "Did you mean...?"
 *   2. Input validation with helpful error messages
 *   3. ANSI color output (zero-dep, native terminal)
 *   4. Status dashboard (visibility of system state)
 *   5. Interactive command menu (recognition over recall)
 *   6. First-run onboarding detection
 *   7. Quiet mode for scripting
 *
 * Zero external runtime dependencies.
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

// ============================================================================
// 1. ANSI COLORS (zero-dep — native terminal escape codes)
// ============================================================================

export const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

/** Checks if stdout supports color (respects NO_COLOR env var). */
export function supportsColor(): boolean {
  return process.env["NO_COLOR"] === undefined && process.stdout.isTTY === true;
}

/** Output boundary for this module: the CLI presentation layer owns stdout. */
function out(line: string): void {
  process.stdout.write(`${line}\n`);
}

/** Error boundary for this module: diagnostics go to stderr, never stdout. */
function writeErr(line: string): void {
  process.stderr.write(`${line}\n`);
}

/** Wraps text in color if terminal supports it, otherwise returns plain. */
function color(text: string, code: string): string {
  if (!supportsColor()) return text;
  return `${code}${text}${C.reset}`;
}

export const cl = {
  green: (t: string) => color(t, C.green),
  red: (t: string) => color(t, C.red),
  yellow: (t: string) => color(t, C.yellow),
  blue: (t: string) => color(t, C.blue),
  cyan: (t: string) => color(t, C.cyan),
  magenta: (t: string) => color(t, C.magenta),
  gray: (t: string) => color(t, C.gray),
  bold: (t: string) => color(t, C.bold),
  dim: (t: string) => color(t, C.dim),
};

// ============================================================================
// 2. DYNAMIC VERSION (Heuristic: Consistency and Standards)
// ============================================================================

let _cachedVersion: string | null = null;

export function getEosVersion(): string {
  if (_cachedVersion) return _cachedVersion;
  try {
    const pkgPath = path.resolve(process.cwd(), "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    _cachedVersion = pkg.version ?? "unknown";
  } catch {
    _cachedVersion = "unknown";
  }
  return _cachedVersion ?? "unknown";
}

// ============================================================================
// 3. COMMAND REGISTRY (Heuristic: Recognition over Recall)
// ============================================================================

export interface CommandInfo {
  readonly name: string;
  readonly aliases: readonly string[];
  readonly category: "CORE" | "AGI" | "PLATFORM" | "SPOTIFY" | "ADVANCED" | "SPIRITUAL";
  readonly summary: string;
  readonly usage: string;
  readonly example?: string;
}

export const EOS_COMMANDS: readonly CommandInfo[] = Object.freeze([
  // CORE
  {
    name: "turbo",
    aliases: ["fast"],
    category: "CORE",
    summary: "Verificación ultrarrápida en memoria (<350ms)",
    usage: "eos turbo",
    example: "eos turbo",
  },
  {
    name: "verify",
    aliases: [],
    category: "CORE",
    summary: "7 aduanas SecDevOps fail-closed",
    usage: "eos verify",
    example: "eos verify",
  },
  {
    name: "test",
    aliases: [],
    category: "CORE",
    summary: "Pruebas unitarias y de caos",
    usage: "eos test",
    example: "eos test",
  },
  {
    name: "health",
    aliases: [],
    category: "CORE",
    summary: "Telemetría CNCF / SRE en vivo",
    usage: "eos health",
    example: "eos health",
  },
  {
    name: "guard",
    aliases: [],
    category: "CORE",
    summary: "Audita pureza Hexagonal y ciclos circulares",
    usage: "eos guard [dir]",
    example: "eos guard src",
  },
  {
    name: "blast",
    aliases: [],
    category: "CORE",
    summary: "Radio de impacto transitivo y PTS",
    usage: "eos blast <file>",
    example: "eos blast src/core/eosTurboEngine.ts",
  },
  {
    name: "graph",
    aliases: [],
    category: "CORE",
    summary: "Grafo semántico y código huérfano",
    usage: "eos graph",
    example: "eos graph",
  },
  {
    name: "heal",
    aliases: [],
    category: "CORE",
    summary: "Auto-sanación FDIR con recibo sellado",
    usage: "eos heal [file] [--dry]",
    example: "eos heal --dry",
  },
  {
    name: "spec",
    aliases: [],
    category: "CORE",
    summary: "Audita specs OpenSpec y previene deriva",
    usage: "eos spec [check|list]",
    example: "eos spec check",
  },
  {
    name: "guide",
    aliases: ["glossary"],
    category: "CORE",
    summary: "Glosario de arquitectura y equivalencias de industria",
    usage: "eos guide",
    example: "eos guide",
  },
  // AGI
  {
    name: "consult",
    aliases: ["solve"],
    category: "AGI",
    summary: "Consultor de élite: 5-Whys, ADR, código, riesgos",
    usage: "eos consult <problema>",
    example: 'eos consult "N+1 query en ORM"',
  },
  {
    name: "agi",
    aliases: [],
    category: "AGI",
    summary: "AGI Core: axiomas cristalizados y reglas",
    usage: "eos agi [axioms|rules]",
    example: "eos agi axioms",
  },
  {
    name: "pipeline",
    aliases: [],
    category: "AGI",
    summary: "Flujo end-to-end: contexto → router → tribunal",
    usage: "eos pipeline <p> <f> <t>",
    example: 'eos pipeline "Fix cache" src/core/eosTurboEngine.ts "npm test"',
  },
  {
    name: "forge",
    aliases: [],
    category: "AGI",
    summary: "Crea herramientas MCP en runtime",
    usage: "eos forge [list|mcp]",
    example: "eos forge list",
  },
  {
    name: "amplify",
    aliases: [],
    category: "AGI",
    summary: "Amplifica prompt informal a EARS/BDD formal",
    usage: "eos amplify <prompt>",
    example: 'eos amplify "diseñar auth biométrica"',
  },
  // PLATFORM
  {
    name: "context",
    aliases: ["context-window"],
    category: "PLATFORM",
    summary: "Ensambla contexto con presupuesto de tokens",
    usage: "eos context <obj> <file> [budget]",
    example: 'eos context "Analyze" src/core/eosTurboEngine.ts 16000',
  },
  {
    name: "drift",
    aliases: ["spec:drift"],
    category: "PLATFORM",
    summary: "Detecta deriva código/spec",
    usage: "eos drift [dias]",
    example: "eos drift 7",
  },
  {
    name: "flow",
    aliases: [],
    category: "PLATFORM",
    summary: "Flujo de ingeniería con worktree y revisión por hash",
    usage: "eos flow <acción>",
    example: "eos flow inspect /ruta/repo",
  },
  {
    name: "mcp",
    aliases: [],
    category: "PLATFORM",
    summary: "Servidor MCP para Cursor/Claude Code",
    usage: "eos mcp [--sse|status]",
    example: "eos mcp",
  },
  {
    name: "status",
    aliases: [],
    category: "PLATFORM",
    summary: "Dashboard unificado del estado del sistema",
    usage: "eos status",
    example: "eos status",
  },
  // SPOTIFY
  {
    name: "spotify",
    aliases: [],
    category: "SPOTIFY",
    summary: "Herramientas Spotify (audit, standup, scaffold)",
    usage: "eos spotify <sub>",
    example: "eos spotify audit",
  },
  {
    name: "titan",
    aliases: ["titans"],
    category: "SPOTIFY",
    summary: "Benchmarks de los Titanes Big Tech",
    usage: "eos titan [xirp|spacex]",
    example: "eos titan xirp",
  },
  // ADVANCED
  {
    name: "disruptor",
    aliases: [],
    category: "ADVANCED",
    summary: "Ring buffer LMAX (>10M ops/s)",
    usage: "eos disruptor [eventos]",
    example: "eos disruptor 1000000",
  },
  {
    name: "edge",
    aliases: [],
    category: "ADVANCED",
    summary: "Arbitro Anycast global y Hedged Requests",
    usage: "eos edge [city|bench]",
    example: "eos edge bogota",
  },
  {
    name: "dst",
    aliases: [],
    category: "ADVANCED",
    summary: "Simulación determinista FoundationDB/Antithesis",
    usage: "eos dst [seed] [steps]",
    example: "eos dst 42 200",
  },
  {
    name: "refactor",
    aliases: [],
    category: "ADVANCED",
    summary: "Auditoría de deuda técnica y dieta de código",
    usage: "eos refactor [audit|dbc]",
    example: "eos refactor audit",
  },
]);

// ============================================================================
// 4. COMMAND SUGGESTION ENGINE (Heuristic: Error Prevention & Recovery)
// ============================================================================

/**
 * Computes Levenshtein edit distance between two strings.
 * Used to suggest the closest command when the user makes a typo.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/**
 * Finds the closest matching command for a potentially misspelled input.
 * Returns up to 3 suggestions sorted by edit distance.
 */
export function suggestCommands(input: string): CommandInfo[] {
  const all: Array<{ cmd: CommandInfo; dist: number }> = [];
  for (const cmd of EOS_COMMANDS) {
    const names = [cmd.name, ...cmd.aliases];
    let minDist = Infinity;
    for (const name of names) {
      const d = levenshtein(input.toLowerCase(), name.toLowerCase());
      if (d < minDist) minDist = d;
    }
    // Only suggest if reasonably close (within 3 edits or 50% of the word length)
    const threshold = Math.max(2, Math.floor(input.length / 2));
    if (minDist <= threshold) {
      all.push({ cmd, dist: minDist });
    }
  }
  all.sort((a, b) => a.dist - b.dist);
  return all.slice(0, 3).map((a) => a.cmd);
}

// ============================================================================
// 5. INPUT VALIDATION (Heuristic: Error Prevention)
// ============================================================================

export interface ValidationError {
  readonly param: string;
  readonly message: string;
  readonly example: string;
}

export function validateArgs(
  command: string,
  args: readonly string[],
  required: readonly string[],
): ValidationError | null {
  for (let i = 0; i < required.length; i++) {
    if (!args[i] || args[i].trim().length === 0) {
      const cmd = EOS_COMMANDS.find((c) => c.name === command || c.aliases.includes(command));
      return {
        param: required[i],
        message: `Falta el parámetro requerido: ${required[i]}`,
        example: cmd?.example ?? `eos ${command} <${required[i]}>`,
      };
    }
  }
  return null;
}

/** Prints a user-friendly error with suggestion when validation fails. */
export function printValidationError(err: ValidationError): void {
  writeErr(`\n${cl.red("✘ Error")}: ${err.message}`);
  writeErr(`  ${cl.gray("Parámetro")}: ${err.param}`);
  writeErr(`  ${cl.green("Ejemplo")}: ${err.example}\n`);
}

// ============================================================================
// 6. STATUS DASHBOARD (Heuristic: Visibility of System State)
// ============================================================================

export interface StatusDashboard {
  readonly version: string;
  readonly nodeVersion: string;
  readonly platform: string;
  readonly uptime: string;
  readonly memoryRssMb: string;
  readonly totalModules: number;
  readonly totalTests: number;
  readonly totalSpecs: number;
  readonly axiomsLearned: number;
  readonly driftScore: number | null;
  readonly fleetHealthy: boolean | null;
  readonly lastCiResult: "PASS" | "FAIL" | "UNKNOWN";
  readonly timestamp: string;
}

/**
 * Collects system status from multiple sources into one dashboard snapshot.
 * Comparable to `kubectl get all` — one glance at the entire system.
 */
export async function collectStatus(projectRoot: string): Promise<StatusDashboard> {
  const version = getEosVersion();
  const mem = process.memoryUsage();

  // Count modules
  let totalModules = 0;
  const coreDir = path.join(projectRoot, "src", "core");
  if (fs.existsSync(coreDir)) {
    totalModules = fs.readdirSync(coreDir).filter((f) => f.endsWith(".ts")).length;
  }

  // Count tests
  let totalTests = 0;
  const testDir = path.join(projectRoot, "test");
  if (fs.existsSync(testDir)) {
    totalTests = fs.readdirSync(testDir).filter((f) => f.endsWith(".test.mjs")).length;
  }

  // Count specs
  let totalSpecs = 0;
  const specsDir = path.join(projectRoot, "openspec", "specs");
  if (fs.existsSync(specsDir)) {
    totalSpecs = fs.readdirSync(specsDir).filter((f) => f.endsWith(".md")).length;
  }

  // Count axioms
  let axiomsLearned = 0;
  const axiomPath = path.join(projectRoot, "docs", "memory", "agi_axioms.json");
  if (fs.existsSync(axiomPath)) {
    try {
      const axioms = JSON.parse(fs.readFileSync(axiomPath, "utf8"));
      axiomsLearned = Array.isArray(axioms) ? axioms.length : 0;
    } catch {
      /* skip */
    }
  }

  // Check last CI receipt
  let lastCiResult: "PASS" | "FAIL" | "UNKNOWN" = "UNKNOWN";
  const receiptPath = path.join(projectRoot, "docs", "evidence", "SBOM-CICD-RECEIPT.json");
  if (fs.existsSync(receiptPath)) {
    try {
      const receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
      lastCiResult = receipt.exitCode === 0 ? "PASS" : "FAIL";
    } catch {
      /* skip */
    }
  }

  return {
    version,
    nodeVersion: process.version,
    platform: `${process.platform}-${process.arch}`,
    uptime: `${Math.floor(process.uptime())}s`,
    memoryRssMb: `${(mem.rss / 1024 / 1024).toFixed(1)} MB`,
    totalModules,
    totalTests,
    totalSpecs,
    axiomsLearned,
    driftScore: null, // requires running drift detector
    fleetHealthy: null, // requires fleet check
    lastCiResult,
    timestamp: new Date().toISOString(),
  };
}

/** Formats the status dashboard for terminal output. */
export function formatStatusDashboard(s: StatusDashboard): string {
  const lines: string[] = [];
  const v = cl.bold(`EOS v${s.version}`);
  const ciIcon =
    s.lastCiResult === "PASS"
      ? cl.green("✔ PASS")
      : s.lastCiResult === "FAIL"
        ? cl.red("✘ FAIL")
        : cl.gray("? UNKNOWN");

  lines.push("");
  lines.push(`  ${cl.cyan("╔════════════════════════════════════════════════════════════╗")}`);
  lines.push(`  ${cl.cyan("║")}  ${v} — ${cl.gray("System Status Dashboard")}                        ${cl.cyan("║")}`);
  lines.push(`  ${cl.cyan("╠════════════════════════════════════════════════════════════╣")}`);
  lines.push(
    `  ${cl.cyan("║")}  Runtime      ${cl.gray("│")} ${s.nodeVersion} on ${s.platform.padEnd(20)}    ${cl.cyan("║")}`,
  );
  lines.push(`  ${cl.cyan("║")}  Memory RSS   ${cl.gray("│")} ${s.memoryRssMb.padEnd(34)}    ${cl.cyan("║")}`);
  lines.push(`  ${cl.cyan("║")}  Uptime       ${cl.gray("│")} ${s.uptime.padEnd(34)}    ${cl.cyan("║")}`);
  lines.push(`  ${cl.cyan("╠════════════════════════════════════════════════════════════╣")}`);
  lines.push(`  ${cl.cyan("║")}  Módulos Core ${cl.gray("│")} ${String(s.totalModules).padEnd(34)}    ${cl.cyan("║")}`);
  lines.push(`  ${cl.cyan("║")}  Test Suites  ${cl.gray("│")} ${String(s.totalTests).padEnd(34)}    ${cl.cyan("║")}`);
  lines.push(`  ${cl.cyan("║")}  OpenSpecs     ${cl.gray("│")} ${String(s.totalSpecs).padEnd(34)}    ${cl.cyan("║")}`);
  lines.push(
    `  ${cl.cyan("║")}  Axiomas AGI  ${cl.gray("│")} ${String(s.axiomsLearned).padEnd(34)}    ${cl.cyan("║")}`,
  );
  lines.push(`  ${cl.cyan("╠════════════════════════════════════════════════════════════╣")}`);
  lines.push(`  ${cl.cyan("║")}  Último CI    ${cl.gray("│")} ${ciIcon.padEnd(32)}    ${cl.cyan("║")}`);
  lines.push(
    `  ${cl.cyan("║")}  Timestamp    ${cl.gray("│")} ${s.timestamp.slice(0, 19).padEnd(34)}    ${cl.cyan("║")}`,
  );
  lines.push(`  ${cl.cyan("╚════════════════════════════════════════════════════════════╝")}`);
  lines.push("");
  lines.push(`  ${cl.gray("Comandos rápidos:")}`);
  lines.push(`    ${cl.green("eos turbo")}     Verificación rápida    ${cl.green("eos consult")}  Consultar problema`);
  lines.push(`    ${cl.green("eos test")}     Correr pruebas         ${cl.green("eos context")}  Ensamblar contexto`);
  lines.push(`    ${cl.green("eos status")}   Este dashboard         ${cl.green("eos drift")}    Detectar deriva`);
  lines.push("");

  return lines.join("\n");
}

// ============================================================================
// 7. INTERACTIVE MODE (Heuristic: Recognition over Recall)
// ============================================================================

/**
 * Launches an interactive command menu where the user selects what to do
 * from a categorized list — no need to memorize commands.
 */
export async function interactiveMode(): Promise<void> {
  out(`\n${cl.bold("EOS System v" + getEosVersion())} — Modo Interactivo`);
  out(`${cl.gray("Selecciona una categoría o escribe un comando. Ctrl+C para salir.\n")}`);

  const categories = ["CORE", "AGI", "PLATFORM", "SPOTIFY", "ADVANCED"] as const;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  const ask = (q: string) => new Promise<string>((resolve) => rl.question(q, resolve));

  while (true) {
    out(`\n${cl.cyan("Categorías:")}`);
    categories.forEach((cat, i) => {
      const count = EOS_COMMANDS.filter((c) => c.category === cat).length;
      out(`  ${cl.green(`[${i + 1}]`)} ${cat.padEnd(10)} ${cl.gray(`(${count} comandos)`)}`);
    });
    out(`  ${cl.green("[q]")} Salir`);

    const choice = await ask(`\n${cl.bold("→ Selección: ")}`);
    const trimmed = choice.trim().toLowerCase();

    if (trimmed === "q" || trimmed === "quit" || trimmed === "exit") {
      out(cl.gray("\n¡Hasta luego, Arquitecto! 👋\n"));
      rl.close();
      return;
    }

    const catIdx = parseInt(trimmed, 10) - 1;
    if (isNaN(catIdx) || catIdx < 0 || catIdx >= categories.length) {
      // Maybe they typed a command directly
      const cmd = EOS_COMMANDS.find((c) => c.name === trimmed || c.aliases.includes(trimmed));
      if (cmd) {
        out(`\n${cl.green(cmd.name)} — ${cmd.summary}`);
        out(`  ${cl.gray("Uso:")} ${cmd.usage}`);
        if (cmd.example) out(`  ${cl.gray("Ej:")} ${cl.cyan(cmd.example)}`);
        continue;
      }
      // Suggest
      const suggestions = suggestCommands(trimmed);
      if (suggestions.length > 0) {
        out(`\n${cl.yellow("¿Quisiste decir...?")}`);
        suggestions.forEach((s) => out(`  ${cl.green(s.name)} — ${s.summary}`));
      } else {
        out(cl.red(`\n✘ Opción no válida: "${trimmed}"`));
      }
      continue;
    }

    const category = categories[catIdx];
    const commands = EOS_COMMANDS.filter((c) => c.category === category);

    out(`\n${cl.cyan(category)} — ${commands.length} comandos:\n`);
    commands.forEach((cmd, i) => {
      out(`  ${cl.green(`[${i + 1}]`)} ${cl.bold(cmd.name.padEnd(14))} ${cmd.summary}`);
    });

    const cmdChoice = await ask(`\n${cl.bold("→ Comando (número o nombre): ")}`);
    const cmdTrimmed = cmdChoice.trim().toLowerCase();

    if (cmdTrimmed === "b" || cmdTrimmed === "back") continue;

    const cmdIdx = parseInt(cmdTrimmed, 10) - 1;
    const selected =
      isNaN(cmdIdx) || cmdIdx < 0 || cmdIdx >= commands.length
        ? commands.find((c) => c.name === cmdTrimmed || c.aliases.includes(cmdTrimmed))
        : commands[cmdIdx];

    if (!selected) {
      out(cl.red("✘ Selección no válida"));
      continue;
    }

    out(`\n${cl.green(selected.name)} — ${selected.summary}`);
    out(`  ${cl.gray("Uso:")} ${selected.usage}`);
    if (selected.example) out(`  ${cl.gray("Ej:")} ${cl.cyan(selected.example)}`);
    out(`\n${cl.gray("Ejecuta este comando directamente con:")}`);
    out(`  ${cl.bold(selected.example ?? selected.usage)}\n`);
  }
}

// ============================================================================
// 8. FIRST-RUN ONBOARDING (Heuristic: Learnability)
// ============================================================================

/**
 * Checks if this is the first time the user runs EOS in this project.
 * If so, shows a quick-start guide instead of dumping the full help.
 */
export function isFirstRun(projectRoot: string): boolean {
  const marker = path.join(projectRoot, ".eos-initialized");
  return !fs.existsSync(marker);
}

/**
 * Marks the project as initialized — subsequent runs skip onboarding.
 */
export function markInitialized(projectRoot: string): void {
  const marker = path.join(projectRoot, ".eos-initialized");
  fs.writeFileSync(marker, new Date().toISOString(), "utf8");
}

/**
 * Shows the first-run onboarding guide.
 */
export function showOnboarding(): void {
  const v = getEosVersion();
  out(`
${cl.cyan("╔════════════════════════════════════════════════════════════════╗")}
${cl.cyan("║")}  ${cl.bold("EOS System v" + v)} — Engineering Operating System               ${cl.cyan("║")}
${cl.cyan("║")}  ${cl.gray("Primera ejecución detectada — Bienvenido, Arquitecto 👋")}         ${cl.cyan("║")}
${cl.cyan("╚════════════════════════════════════════════════════════════════╝")}

${cl.bold("INICIO RÁPIDO (3 comandos para empezar):")}

  ${cl.green("1.")} ${cl.bold("eos status")}      — Ve el estado del sistema en un vistazo
  ${cl.green("2.")} ${cl.bold("eos turbo")}       — Verificación ultrarrápida del proyecto
  ${cl.green("3.")} ${cl.bold("eos consult")}     — Pregúntale a EOS sobre cualquier problema

${cl.bold("COMANDOS POR CATEGORÍA:")}

  ${cl.cyan("CORE")}     turbo · verify · test · health · guard · blast · graph · heal · spec
  ${cl.cyan("AGI")}      consult · pipeline · agi · forge · amplify
  ${cl.cyan("PLATFORM")} context · drift · mcp · status

${cl.gray("Tip: Ejecuta 'eos interactive' para un menú guiado sin memorizar comandos.")}
${cl.gray("Tip: Ejecuta 'eos help' para ver el manual completo con todos los 50+ comandos.")}

${cl.dim("Este mensaje no se mostrará de nuevo. Ejecuta 'eos --onboarding' para verlo otra vez.")}
`);
}

// ============================================================================
// 9. CLEAN BANNER (Heuristic: Aesthetic and Minimalist Design)
// ============================================================================

/**
 * Prints a minimal banner — just the version line, no full box.
 * Used for quiet mode or when the user wants less noise.
 */
export function printMinimalBanner(): void {
  const v = getEosVersion();
  out(`${cl.cyan("EOS")} ${cl.gray("v" + v)} ${cl.gray("·")} ${cl.gray("Zero Vibe Coding")}`);
}

/**
 * Prints the full banner with box drawing.
 */
export function printFullBanner(): void {
  const v = getEosVersion();
  out("======================================================================");
  out(` GLORIAN SYSTEM v${v} — SOVEREIGN CONTROL PLANE & ENGINEERING ENGINE`);
  out(" Zero Vibe Coding · Layer-0 Hexagonal · Big Tech Tier 1 · SLSA Level 4");
  out("======================================================================");
}
