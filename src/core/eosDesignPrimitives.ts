/**
 * EOS DESIGN PRIMITIVES — IMMUTABLE ARCHITECTURAL COMPONENTS (Capa 2)
 * SPEC-052: Visual Governance — Primitivas Inmutables.
 *
 * Three architectural primitives that every UI section must be assembled from.
 * These are HTML string generators (zero-dep, no React needed) that enforce
 * the Palantir/Anduril/Linear aesthetic deterministically:
 *
 *   1. ArchitecturalGrid — Container with exposed 1px hairline grid
 *   2. TelemetryHeader  — Section header with monospace index + status
 *   3. SpotlightPanel   — Card with cursor-tracking glow + inner light
 *
 * Usage:
 * ```ts
 * import { architecturalGrid, telemetryHeader, spotlightPanel } from "./eosDesignPrimitives.ts";
 *
 * const html = architecturalGrid({
 *   columns: 3,
 *   children: telemetryHeader({ index: "01", title: "AGI Pipeline" }) +
 *             spotlightPanel({ content: "<p>Hello</p>" }),
 * });
 * ```
 *
 * Zero external runtime dependencies.
 */

// ============================================================================
// 1. ARCHITECTURAL GRID — Exposed 1px hairline container
// ============================================================================

export interface GridOptions {
  readonly columns?: 1 | 2 | 3 | 4 | 6 | 12;
  readonly children: string;
  readonly id?: string;
  readonly max?: string; // max-width override
}

/**
 * Generates an HTML container with exposed 1px hairline grid lines.
 * Each child cell gets a 1px border creating the Palantir/Anduril effect.
 */
export function architecturalGrid(opts: GridOptions): string {
  const cols = opts.columns ?? 3;
  const max = opts.max ?? "1200px";
  const id = opts.id ?? "";

  return `<div${id ? ` id="${id}"` : ""} class="arch-grid" style="--grid-cols:${cols};--grid-max:${max}">
  ${opts.children}
</div>`;
}

/**
 * Generates a grid cell with 1px hairline borders.
 */
export function gridCell(content: string, span = 1): string {
  return `<div class="arch-grid__cell" style="grid-column:span ${span}">
  ${content}
</div>`;
}

// ============================================================================
// 2. TELEMETRY HEADER — Monospace index + status indicator
// ============================================================================

export interface TelemetryHeaderOptions {
  readonly index: string;       // e.g. "01", "02", "SYS_MODULE"
  readonly title: string;       // Section title
  readonly status?: "ONLINE" | "ACTIVE" | "IDLE" | "ALERT" | "VERIFIED";
  readonly statusColor?: string; // override status dot color
}

/**
 * Generates a section header with:
 *   - Monospace index in uppercase (01 // SYS_MODULE)
 *   - Title in tracking-tighter typography
 *   - Status indicator with pulse animation
 *
 * Every section MUST start with this primitive.
 */
export function telemetryHeader(opts: TelemetryHeaderOptions): string {
  const statusColors: Record<string, string> = {
    ONLINE: "var(--accent-status, #10B981)",
    ACTIVE: "var(--accent-glow, #3B82F6)",
    IDLE: "var(--text-dim, #71717A)",
    ALERT: "var(--accent-error, #EF4444)",
    VERIFIED: "var(--accent-status, #10B981)",
  };
  const status = opts.status ?? "ONLINE";
  const dotColor = opts.statusColor ?? statusColors[status] ?? statusColors["ONLINE"]!;

  return `<div class="telemetry-header">
  <div class="telemetry-header__meta">
    <span class="telemetry-header__index">${opts.index}</span>
    <span class="telemetry-header__separator">//</span>
    <span class="telemetry-header__status-dot" style="background:${dotColor}"></span>
    <span class="telemetry-header__status-text">${status}</span>
  </div>
  <h2 class="telemetry-header__title">${opts.title}</h2>
</div>`;
}

// ============================================================================
// 3. SPOTLIGHT PANEL — Cursor-tracking glow + inner light
// ============================================================================

export interface SpotlightPanelOptions {
  readonly content: string;
  readonly index?: string;      // Optional telemetry index for the card
  readonly title?: string;      // Optional card title
  readonly status?: string;     // Optional status indicator
  readonly wide?: boolean;      // Span 2 columns
}

/**
 * Generates a card with:
 *   - 1px hairline border
 *   - Inner top light (1px cenital — box-shadow inset)
 *   - Cursor-tracking radial glow (via CSS variable --mouse-x/--mouse-y)
 *   - Monospace index in top-left corner
 *
 * The spotlight effect requires this CSS:
 * ```css
 * .spotlight-card::before {
 *   background: radial-gradient(600px circle at var(--mouse-x,0) var(--mouse-y,0), rgba(255,255,255,0.07), transparent 40%);
 *   opacity: 0;
 *   transition: opacity 0.3s;
 * }
 * .spotlight-card:hover::before { opacity: 1; }
 * ```
 */
export function spotlightPanel(opts: SpotlightPanelOptions): string {
  const spanAttr = opts.wide ? ' style="grid-column:span 2"' : "";
  const indexHtml = opts.index
    ? `<div class="spotlight-card__index">${opts.index}</div>`
    : "";
  const titleHtml = opts.title
    ? `<h3 class="spotlight-card__title">${opts.title}</h3>`
    : "";
  const statusHtml = opts.status
    ? `<span class="spotlight-card__status">${opts.status}</span>`
    : "";

  return `<div class="spotlight-card"${spanAttr}>
  <div class="spotlight-card__header">
    ${indexHtml}
    ${statusHtml}
  </div>
  ${titleHtml}
  <div class="spotlight-card__content">${opts.content}</div>
</div>`;
}

// ============================================================================
// 4. CODE BLOCK — With copy button (DeepSeek style)
// ============================================================================

export interface CodeBlockOptions {
  readonly language: string;
  readonly code: string;
  readonly copyCommand?: string; // What to copy (defaults to code)
}

/**
 * Generates a code block with a copy-to-clipboard button.
 * Uses monospace font, dark background, and syntax highlighting classes.
 */
export function codeBlock(opts: CodeBlockOptions): string {
  const copyText = (opts.copyCommand ?? opts.code).replace(/"/g, "&quot;");
  return `<div class="codeblock">
  <div class="codeblock__header">
    <span class="codeblock__lang">${opts.language}</span>
    <button class="codeblock__copy" onclick="navigator.clipboard.writeText('${copyText}')">Copy</button>
  </div>
  <pre class="codeblock__pre"><code>${opts.code}</code></pre>
</div>`;
}

// ============================================================================
// 5. CONSOLE TRACE TABLE — Developer Tools traceability view
// ============================================================================

export interface TraceRow {
  readonly turn: number;
  readonly role: "SYSTEM" | "USER" | "TOOL" | "ASSISTANT";
  readonly content: string;
  readonly duration: string; // e.g. "34 ms"
}

/**
 * Generates a traceability table showing pipeline execution turns.
 * Each role gets a color: SYSTEM=cyan, USER=blue, TOOL=amber, ASSISTANT=green.
 */
export function consoleTrace(rows: readonly TraceRow[]): string {
  const body = rows.map(r => {
    const roleClass = `trace__turn-${r.role.toLowerCase()}`;
    return `<tr>
  <td>${r.turn}</td>
  <td class="${roleClass}">${r.role}</td>
  <td>${r.content}</td>
  <td>${r.duration}</td>
</tr>`;
  }).join("\n");

  return `<div class="trace__window">
  <div class="trace__header">eos pipeline — trace · Turn ${rows.length} · ${rows.length} steps</div>
  <table class="trace__table">
    <thead>
      <tr><th>Turn</th><th>Role</th><th>Content</th><th>Duration</th></tr>
    </thead>
    <tbody>
${body}
    </tbody>
  </table>
</div>`;
}

// ============================================================================
// 6. CSS GENERATOR — Primitives styles for the above components
// ============================================================================

/**
 * Returns the CSS string for all design primitives.
 * Paste this into your CSS file or inject it dynamically.
 */
export function generatePrimitivesCSS(): string {
  return `
/* ── Architectural Grid ──────────────────────────────────────────────── */
.arch-grid {
  max-width: var(--grid-max, 1200px);
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(var(--grid-cols, 3), 1fr);
  gap: 1px;
  background: var(--border-10, rgba(255,255,255,0.10));
  border: 1px solid var(--border-10, rgba(255,255,255,0.10));
}
.arch-grid__cell {
  background: var(--bg-base, #090A0F);
  padding: 2rem;
}
@media (max-width: 768px) { .arch-grid { grid-template-columns: 1fr; } }

/* ── Telemetry Header ────────────────────────────────────────────────── */
.telemetry-header { margin-bottom: 1.5rem; }
.telemetry-header__meta {
  display: flex; align-items: center; gap: 0.5rem;
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em;
  color: var(--text-dim, #71717A); margin-bottom: 0.75rem;
}
.telemetry-header__index { font-weight: 600; }
.telemetry-header__separator { opacity: 0.4; }
.telemetry-header__status-dot {
  width: 6px; height: 6px; border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}
.telemetry-header__status-text { font-weight: 500; }
.telemetry-header__title {
  font-size: 1.5rem; font-weight: 500; letter-spacing: -0.03em;
  line-height: 1.1; color: var(--text-white, #F8FAFC);
}

/* ── Spotlight Panel ────────────────────────────────────────────────── */
.spotlight-card {
  position: relative; overflow: hidden;
  border: 1px solid var(--border-10, rgba(255,255,255,0.10));
  background: var(--surface-2, rgba(255,255,255,0.02));
  border-radius: 4px; padding: 1.5rem;
  box-shadow: inset 0 1px 0 0 rgba(255,255,255,0.08);
  transition: border-color 0.2s cubic-bezier(0.16,1,0.3,1);
}
.spotlight-card::before {
  content: ""; position: absolute; inset: 0;
  background: radial-gradient(600px circle at var(--mouse-x,0) var(--mouse-y,0), rgba(255,255,255,0.07), transparent 40%);
  opacity: 0; transition: opacity 0.3s; pointer-events: none;
}
.spotlight-card:hover { border-color: rgba(59,130,246,0.20); }
.spotlight-card:hover::before { opacity: 1; }
.spotlight-card__header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 0.75rem;
}
.spotlight-card__index {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em;
  color: var(--text-dim, #71717A);
}
.spotlight-card__status {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 11px; color: var(--accent-status, #10B981);
}
.spotlight-card__title {
  font-size: 1rem; font-weight: 600; color: var(--text-white, #F8FAFC);
  margin-bottom: 0.5rem;
}
.spotlight-card__content { font-size: 0.875rem; color: var(--text-muted, #A1A1AA); line-height: 1.6; }

/* ── Pulse Animation ────────────────────────────────────────────────── */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* ── Code Block ──────────────────────────────────────────────────────── */
.codeblock { max-width: 700px; margin: 0 auto; }
.codeblock__header {
  display: flex; align-items: center; justify-content: space-between;
  border-bottom: 1px solid var(--border-10, rgba(255,255,255,0.10));
  padding: 0.625rem 1rem;
}
.codeblock__lang { font-family: var(--font-mono, 'JetBrains Mono', monospace); font-size: 0.75rem; color: var(--text-dim, #71717A); }
.codeblock__copy {
  background: var(--surface-5, rgba(255,255,255,0.05));
  border: 1px solid var(--border-10, rgba(255,255,255,0.10));
  color: var(--text-muted, #A1A1AA);
  border-radius: 4px; padding: 0.25rem 0.625rem;
  font-size: 0.75rem; cursor: pointer; font-family: var(--font-mono, 'JetBrains Mono', monospace);
  transition: background 0.15s cubic-bezier(0.16,1,0.3,1);
}
.codeblock__copy:hover { background: rgba(255,255,255,0.10); color: var(--text-white, #F8FAFC); }
.codeblock__pre {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 0.8125rem; color: #D4D4D8; padding: 1rem; overflow-x: auto; line-height: 1.7;
}

/* ── Console Trace Table ─────────────────────────────────────────────── */
.trace__window {
  border: 1px solid var(--border-10, rgba(255,255,255,0.10));
  background: var(--bg-surface, #11131A); border-radius: 4px; overflow: hidden;
}
.trace__header {
  border-bottom: 1px solid var(--border-10, rgba(255,255,255,0.10));
  padding: 0.75rem 1rem; font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 0.75rem; color: var(--text-dim, #71717A);
}
.trace__table { width: 100%; font-family: var(--font-mono, 'JetBrains Mono', monospace); font-size: 0.8125rem; }
.trace__table th {
  text-align: left; color: var(--text-dim, #71717A); font-weight: 600;
  padding: 0.625rem 1rem; border-bottom: 1px solid var(--border-10, rgba(255,255,255,0.10));
  font-size: 0.6875rem; text-transform: uppercase;
}
.trace__table td { padding: 0.625rem 1rem; border-bottom: 1px solid var(--border-5, rgba(255,255,255,0.05)); color: var(--text-muted, #A1A1AA); }
.trace__table td:first-child { color: var(--text-zinc, #E4E4E7); font-weight: 500; }
.trace__turn-system { color: #06B6D4; }
.trace__turn-user { color: #3B82F6; }
.trace__turn-tool { color: #F59E0B; }
.trace__turn-assistant { color: #10B981; }
`;
}

// ============================================================================
// 7. SPOTLIGHT TRACKING SCRIPT — Cursor glow follower
// ============================================================================

/**
 * Returns the JavaScript needed for the spotlight cursor-tracking effect.
 * Inject this as a <script> tag to enable the mouse-following glow on cards.
 */
export function generateSpotlightScript(): string {
  return `
<script>
(function() {
  var containers = document.querySelectorAll('.arch-grid, .bento__grid, [data-spotlight]');
  containers.forEach(function(container) {
    container.addEventListener('mousemove', function(e) {
      var cards = container.querySelectorAll('.spotlight-card, .bento__card');
      cards.forEach(function(card) {
        var rect = card.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        card.style.setProperty('--mouse-x', x + 'px');
        card.style.setProperty('--mouse-y', y + 'px');
      });
    });
  });
})();
</script>`;
}
