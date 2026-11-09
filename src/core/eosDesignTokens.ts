/**
 * EOS DESIGN TOKEN SYSTEM — CLOSED GOVERNANCE LAYER (Layer 0)
 * SPEC-052: Visual Governance — Token Enjaulamiento (Capa 1)
 *
 * Defines the ONLY allowed design values. Any CSS or HTML that uses
 * a color, spacing, or shadow NOT in this list is a violation.
 *
 * Inspired by Palantir/Anduril/Linear aesthetic:
 *   - Deep blacks (#050505, #090A0F)
 *   - White-optic text (#F4F4F5, never #FFF pure)
 *   - Single blue accent (#2563EB, #3B82F6)
 *   - 1px hairline borders (rgba(255,255,255,0.09))
 *   - No rounded-2xl, no shadow-xl, no arbitrary values
 *
 * Zero external runtime dependencies.
 */

// ============================================================================
// 1. CLOSED COLOR PALETTE (the ONLY colors allowed)
// ============================================================================

export const ALLOWED_COLORS: Record<string, string> = Object.freeze({
  // ── Backgrounds ──────────────────────────────────────────────────────
  void: "#050505", // Fondo base absoluto (Palantir / Anduril)
  surface: "#0A0C12", // Capa elevada 1
  panel: "#11141D", // Capa elevada 2
  glass: "rgba(255,255,255,0.03)",

  // ── Borders ───────────────────────────────────────────────────────────
  "border-hairline": "rgba(255,255,255,0.09)",
  "border-focus": "rgba(59,130,246,0.50)",

  // ── Text (Ink) ────────────────────────────────────────────────────────
  "ink-primary": "#F4F4F5", // Blanco óptico — NUNCA #FFFFFF puro
  "ink-secondary": "#94A3B8", // Lectura técnica descansada
  "ink-muted": "#475569", // Coordenadas y telemetría
  "ink-inverted": "#050505", // Texto sobre fondos claros

  // ── Accent ────────────────────────────────────────────────────────────
  "accent-blue": "#2563EB", // Azul majestuoso / técnico
  "accent-glow": "#3B82F6", // Luz direccional
  "accent-status": "#10B981", // Indicador operacional (verde)
  "accent-warn": "#F59E0B", // Advertencia (ámbar)
  "accent-error": "#EF4444", // Error (rojo)
  "accent-cyan": "#06B6D4", // Información técnica

  // ── Semantic CSS variable names (for the CSS file) ─────────────────────
  "--bg-base": "#090A0F",
  "--bg-surface": "#11131A",
  "--bg-elevated": "#0D0E14",
  "--text-white": "#F8FAFC",
  "--text-zinc": "#E4E4E7",
  "--text-muted": "#A1A1AA",
  "--text-dim": "#71717A",
});

// ============================================================================
// 2. FORBIDDEN PATTERNS (what the linter rejects)
// ============================================================================

export const FORBIDDEN_COLOR_PATTERNS: readonly RegExp[] = Object.freeze([
  // Reject pure white text (should use #F4F4F5 or #F8FAFC)
  /color:\s*#fff\b/gi,
  /color:\s*#ffffff\b/gi,
  // Reject generic Tailwind colors that aren't in the system
  /#[0-9a-f]{6}/gi, // Any hex color not in ALLOWED_COLORS
]);

export const FORBIDDEN_BORDER_RADIUS: Record<string, string> = Object.freeze({
  "rounded-2xl": "Use rounded-sm (4px max) — no large radii allowed",
  "rounded-3xl": "Use rounded-sm (4px max) — no large radii allowed",
  "rounded-xl": "Use rounded-sm (4px max) — no large radii allowed",
  "rounded-full": "Only allowed for status dots (max 9999px)",
  "border-radius: 1rem": "Use 4px max — no 16px radii",
  "border-radius: 2rem": "Use 4px max — no 32px radii",
  "border-radius: 9999px": "Only for status dots",
});

export const FORBIDDEN_SHADOWS: Record<string, string> = Object.freeze({
  "shadow-lg": "Only box-shadow: glow (blue) or inner (1px cenital) allowed",
  "shadow-xl": "Only box-shadow: glow (blue) or inner (1px cenital) allowed",
  "shadow-2xl": "Only box-shadow: glow (blue) or inner (1px cenital) allowed",
  "shadow-md": "Only box-shadow: glow (blue) or inner (1px cenital) allowed",
  "shadow-sm": "Only box-shadow: glow (blue) or inner (1px cenital) allowed",
  "box-shadow: 0 4px 6px": "Generic shadow — use glow or inner only",
  "box-shadow: 0 10px 15px": "Generic shadow — use glow or inner only",
  "box-shadow: 0 20px 25px": "Generic shadow — use glow or inner only",
});

export const ALLOWED_BORDER_RADIUS = Object.freeze({
  "0px": "none",
  "2px": "xs (micro-redondeo técnico)",
  "4px": "sm (máximo para paneles)",
  "0.5rem": "md (máximo para tarjetas)",
  "0.75rem": "lg (máximo para ventanas)",
  "1rem": "xl (solo mockup windows)",
  "9999px": "full (solo status dots)",
});

export const ALLOWED_SHADOWS = Object.freeze({
  none: "none",
  glow: "0 0 24px -4px rgba(59,130,246,0.25)",
  inner: "inset 0 1px 0 0 rgba(255,255,255,0.08)",
  window: "0 25px 50px -12px rgba(0,0,0,0.50)",
});

// ============================================================================
// 3. ALLOWED FONTS
// ============================================================================

export const ALLOWED_FONTS = Object.freeze({
  sans: "'Inter', system-ui, -apple-system, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', monospace",
  display: "'Inter', system-ui, sans-serif",
});

// ============================================================================
// 4. ALLOWED ANIMATION CURVES
// ============================================================================

export const ALLOWED_TIMING_FUNCTIONS = Object.freeze({
  spring: "cubic-bezier(0.16, 1, 0.3, 1)", // Física exponencial obligatoria
  ease: "ease-out",
  fade: "ease-out 0.4s",
});

// ============================================================================
// 5. SPACING SYSTEM (1px grid — Palantir/Anduril standard)
// ============================================================================

export const ALLOWED_SPACING = Object.freeze({
  "1px": "hairline border gap",
  "4px": "xs",
  "8px": "sm",
  "12px": "base",
  "16px": "md",
  "24px": "lg",
  "32px": "xl",
  "48px": "2xl",
  "64px": "3xl",
  "96px": "4xl",
});

// ============================================================================
// 6. TOKEN VALIDATION API
// ============================================================================

export interface DesignViolation {
  readonly file: string;
  readonly line: number;
  readonly rule: string;
  readonly value: string;
  readonly message: string;
  readonly remediation: string;
}

/**
 * Validates a CSS file against the closed token system.
 * Returns an array of violations (empty = clean).
 */
export function validateCssAgainstTokens(content: string, filePath: string): DesignViolation[] {
  const violations: DesignViolation[] = [];
  const lines = content.split("\n");
  const allowedHexValues = new Set(
    Object.values(ALLOWED_COLORS)
      .filter((v) => v.startsWith("#"))
      .map((v) => v.toLowerCase()),
  );

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Check for forbidden border-radius values
    for (const [pattern, message] of Object.entries(FORBIDDEN_BORDER_RADIUS)) {
      if (line.includes(pattern)) {
        violations.push({
          file: filePath,
          line: lineNum,
          rule: "NO_LARGE_RADIUS",
          value: pattern,
          message,
          remediation: "Use border-radius: 4px max (rounded-sm)",
        });
      }
    }

    // Check for forbidden shadows
    for (const [pattern, message] of Object.entries(FORBIDDEN_SHADOWS)) {
      if (line.toLowerCase().includes(pattern.toLowerCase())) {
        violations.push({
          file: filePath,
          line: lineNum,
          rule: "NO_GENERIC_SHADOW",
          value: pattern,
          message,
          remediation: "Use box-shadow: glow or inner only",
        });
      }
    }

    // Check for hex colors not in the allowed set
    const hexMatches = line.matchAll(/(#[0-9a-fA-F]{3,8})\b/g);
    for (const match of hexMatches) {
      const hex = match[1].toLowerCase();
      // Allow if it's a CSS variable definition (--var: #hex)
      if (line.includes("--") && line.includes(":")) continue;
      // Allow if it's in the allowed set
      if (allowedHexValues.has(hex)) continue;
      // Allow 3-digit hex that could be a shorthand
      if (hex.length === 4 && allowedHexValues.has("#" + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3])) continue;

      violations.push({
        file: filePath,
        line: lineNum,
        rule: "NO_RAW_COLORS",
        value: hex,
        message: `Raw color "${hex}" is not in the allowed design token set`,
        remediation: `Use one of the semantic tokens from eosDesignTokens.ts (void, surface, panel, ink-primary, accent-blue, etc.)`,
      });
    }

    // Check for inline style attributes in HTML context
    if (line.includes("style=") && !line.includes("var(")) {
      violations.push({
        file: filePath,
        line: lineNum,
        rule: "NO_INLINE_STYLES",
        value: "style=...",
        message: "Inline style attribute detected — bypasses design token system",
        remediation: "Move to CSS class using design tokens",
      });
    }
  }

  return violations;
}

/**
 * Validates an HTML file against the closed token system.
 */
export function validateHtmlAgainstTokens(content: string, filePath: string): DesignViolation[] {
  const violations: DesignViolation[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Check for inline styles (except CSS variables)
    if (line.includes('style="') && !line.includes("var(--")) {
      violations.push({
        file: filePath,
        line: lineNum,
        rule: "NO_INLINE_STYLES",
        value: 'style="..."',
        message: "Inline style bypasses design system — use CSS classes",
        remediation: "Move inline styles to css/eos.css using design tokens",
      });
    }

    // Check for forbidden Tailwind classes (if Tailwind is used)
    for (const [pattern, message] of Object.entries(FORBIDDEN_BORDER_RADIUS)) {
      if (line.includes(pattern)) {
        violations.push({
          file: filePath,
          line: lineNum,
          rule: "NO_LARGE_RADIUS",
          value: pattern,
          message,
          remediation: "Use rounded-sm (4px) or rounded-none (0px)",
        });
      }
    }

    for (const [pattern, message] of Object.entries(FORBIDDEN_SHADOWS)) {
      if (line.includes(pattern)) {
        violations.push({
          file: filePath,
          line: lineNum,
          rule: "NO_GENERIC_SHADOW",
          value: pattern,
          message,
          remediation: "Only glow/inner shadows from the token system",
        });
      }
    }
  }

  return violations;
}

/**
 * Returns a summary of the design token system for documentation.
 */
export function getTokenSystemSummary(): {
  totalColors: number;
  totalAllowedRadii: number;
  totalAllowedShadows: number;
  totalFonts: number;
  totalTimingFunctions: number;
} {
  return {
    totalColors: Object.keys(ALLOWED_COLORS).length,
    totalAllowedRadii: Object.keys(ALLOWED_BORDER_RADIUS).length,
    totalAllowedShadows: Object.keys(ALLOWED_SHADOWS).length,
    totalFonts: Object.keys(ALLOWED_FONTS).length,
    totalTimingFunctions: Object.keys(ALLOWED_TIMING_FUNCTIONS).length,
  };
}
