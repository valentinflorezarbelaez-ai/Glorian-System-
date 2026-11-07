# DESIGN: SOVEREIGN DESIGN SYSTEM & VISUAL ENGINEERING SPECIFICATION

## Machine-Readable Design Contract for EOS System & Sovereign Fleet

---

## 1. DESIGN PHILOSOPHY

Every user interface within the EOS System and its governed fleet must look and feel like an instrument of high technology forged by Palantir, Anduril, Linear, and Vercel. We do not use arbitrary colors, generic drop shadows, or sluggish transitions. We operate on mathematical grids, 1px hairline precision, and hardware-accelerated feedback.

---

## 2. 3-TIER TOKEN SPECIFICATION

### Tier 1: Core Primitives (The Absolute Palette)

```css
:root {
  /* Obsidian Dark Foundation */
  --color-obsidian-950: #030303;
  --color-obsidian-900: #0a0a0a;
  --color-obsidian-850: #0f0f12;
  --color-obsidian-800: #141418;
  --color-obsidian-700: #1e1e24;

  /* Neutral Spectrum */
  --color-white: #ffffff;
  --color-zinc-100: #fafafa;
  --color-zinc-200: #f4f4f5;
  --color-zinc-400: #a1a1aa;
  --color-zinc-500: #71717a;
  --color-zinc-700: #3f3f46;

  /* Precision Sovereign Accents */
  --color-sovereign-blue: #2563eb;
  --color-sovereign-blue-glow: rgba(37, 99, 235, 0.25);
  --color-tactical-emerald: #10b981;
  --color-tactical-emerald-glow: rgba(16, 185, 129, 0.25);
  --color-alert-amber: #f59e0b;
  --color-danger-crimson: #ef4444;
}
```

### Tier 2: Semantic Tokens (Design Intent)

```css
:root {
  /* Surface Layers */
  --bg-canvas: var(--color-obsidian-950);
  --bg-surface: var(--color-obsidian-900);
  --bg-surface-elevated: var(--color-obsidian-850);
  --bg-surface-glass: rgba(10, 10, 10, 0.85);

  /* Borders & Hairlines */
  --border-hairline: rgba(255, 255, 255, 0.08);
  --border-subtle: rgba(255, 255, 255, 0.14);
  --border-accent: rgba(37, 99, 235, 0.5);
  --border-emerald: rgba(16, 185, 129, 0.5);

  /* Typography */
  --text-primary: var(--color-zinc-100);
  --text-secondary: var(--color-zinc-400);
  --text-muted: var(--color-zinc-500);
  --text-accent: var(--color-sovereign-blue);

  /* Typography Fonts */
  --font-sans: "Geist Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: "Geist Mono", "JetBrains Mono", "IBM Plex Mono", monospace;

  /* Spacing Scale (4px Geometric Base) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;

  /* Corner Radii */
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;
}
```

### Tier 3: Component-Level Tokens

```css
:root {
  /* Bento & Spotlight Cards */
  --card-border: 1px solid var(--border-hairline);
  --card-radius: var(--radius-md);
  --card-spotlight: radial-gradient(
    600px circle at var(--mouse-x, 0px) var(--mouse-y, 0px),
    rgba(255, 255, 255, 0.06),
    transparent 40%
  );
  --card-top-light: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.05) 0%,
    rgba(255, 255, 255, 0) 100%
  );

  /* Telemetry Tables */
  --table-border: 1px solid var(--border-hairline);
  --table-header-bg: rgba(255, 255, 255, 0.03);
  --table-row-hover: rgba(255, 255, 255, 0.02);
}
```

---

## 3. STRUCTURAL LAWS & GEOMETRIC RULES

1. **The 4px Rigid Grid**: Every margin, padding, height, width, and gap must be a multiple of 4px. Odd spacing (e.g., 7px, 11px, 13px) is prohibited.
2. **Hairline Precision**: Card, table, and modal dividers must use `1px` borders with low opacity (`border-hairline`). Never use borders thicker than 1px for structural boxes.
3. **Corner Crosshairs (`+`)**: Grid intersections on tactical sections must include technical `+` indicators at corner boundaries (font size 11px, opacity 0.35, monospace font).
4. **Tabular Numerics**: Any metric, latency indicator, monetary value, or timestamp must render with `font-variant-numeric: tabular-nums` to eliminate character jitter during live updates.
5. **Backdrop Blur & Glassmorphism**: Floating navbars and drawers must combine `backdrop-filter: blur(12px)` with a 1px bottom border.

---

## 4. STRICT ANTI-PATTERN BLACKLIST

Any code submitted containing the following elements will fail visual regression gates immediately:

- ❌ **BANNED**: `box-shadow: 0 10px 15px -3px ...` (generic blurry drop shadows).
- ❌ **BANNED**: Arbitrary hex values in markup (e.g. `style="background: #123456;"`). Always reference semantic CSS variables or tokens.
- ❌ **BANNED**: Multiple competing accent colors in one component (e.g., mixing neon purple, pink, and bright cyan).
- ❌ **BANNED**: Layout shifts on initial load (`Cumulative Layout Shift > 0.000`). All images, graphs, and canvas elements must declare explicit aspect ratios.
- ❌ **BANNED**: Linear transition curves (`transition: all 0.3s linear`). Always use spring timing functions or `cubic-bezier(0.16, 1, 0.3, 1)`.
- ❌ **BANNED**: Low contrast ratios violating WCAG 2.1 AA (text contrast ratio must be $\ge 4.5:1$ against surface background).

---

## 5. MASTER COMPONENT CATALOG (12 LUXURY BLOCKS)

1. **Translucent Hairline Navbar**: 48px height, 1px bottom border, brand logo + status beacon + ⌘K trigger.
2. **Tactical Hero with Live Canvas/WebGL Telemetry**: High-contrast headline, tabular stats badge, instant CTA.
3. **Bento Grid with Cursor Spotlight**: Asymmetric modular grid with radial light following cursor.
4. **Interactive Architecture Node Map**: High-density graph connecting inputs, engines, and outputs with animated data pulses.
5. **High-Density Telemetry Table**: Monospace metrics, status indicators, and one-click actions.
6. **Command Palette (cmdk ⌘K)**: Sub-millisecond fuzzy search modal with categorized actions.
7. **Odometer Mechanical Metric Counters (@number-flow)**: Digits roll individually on state mutation.
8. **Slide-Over Tactile Drawer (Vaul)**: Bottom or side drawer with native inertia drag dismissal.
9. **Stacked 3D Toast Notifications (Sonner)**: High-contrast toasts stacked in 3D perspective.
10. **Syntax-Highlighted Code Canvas (Shiki)**: Server-rendered code blocks with zero client JS overhead.
11. **Approval Diff Card (Human-in-the-Loop)**: Structured before/after diff with single-keypress approval.
12. **Sovereign Minimalist Footer**: Monospace system hash, git commit SHA, and legal/security attestations.
