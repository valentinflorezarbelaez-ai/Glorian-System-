# PLAN-205: Autonomous Sovereign Web Application & High-Converting SaaS Compiler (`SPEC-343`)

- **Plan ID**: `PLAN-205`
- **Spec**: `SPEC-343`
- **Change**: `CHANGE-205`
- **Author**: Valentín Flórez Arbeláez (Principal Architect & System Owner)
- **Status**: `APPROVED`

---

## 1. Architectural Strategy & Hexagonal Isolation

The Sovereign Web Compiler operates as a pure domain compiler isolated behind clean boundaries:

1. **Domain Layer (`src/core/eosSovereignWebCompiler.ts`)**:
   - `WcagContrastProver`: Pure math for sRGB gamma decoding, CIE 1931 relative luminance $Y$, and contrast ratio calculation $CR = (L_1 + 0.05) / (L_2 + 0.05)$.
   - `SriCompiler`: Native Node.js `crypto.createHash("sha384")` digest generation.
   - `SeoGraphSynthesizer`: Structured JSON-LD object graph generation without external templating engines.
   - `ComponentCompiler`: Produces semantic, accessible HTML5/CSS3 components with responsive breakpoints.
2. **Application Layer (`EosSovereignWebCompilerCore`)**:
   - Orchestrates configuration validation, archetype token resolution, accessibility gating, asset bundling, and receipt generation.
3. **Infrastructure / CLI Layer (`bin/commands/cliWebCompiler.mjs`)**:
   - Provides commands `toolchain:web:compile`, `toolchain:web:contrast`, `toolchain:web:sri`, `toolchain:web:seo`, and `toolchain:web:audit` with clean `--json` support.

---

## 2. ADR-205: Native Mathematical Contrast Prover vs Headless Browser Auditing

- **Context**: Commercial tools rely on running headless browsers with axe-core or Lighthouse to verify accessibility, incurring high latency ($> 2000$ ms) and fragile runtime dependencies.
- **Decision**: Implement native closed-form sRGB relative luminance and contrast calculations directly in TypeScript.
- **Consequences**:
  - Positive: Instantaneous execution ($< 2$ ms), zero external npm packages, mathematical certainty at compile time.
  - Rejected Alternatives:
    1. _Puppeteer / Playwright axe-core_: Rejected due to heavy Chromium download, non-hermetic execution, and violation of Layer-0 purity.
    2. _Static Regex Linting_: Rejected as it cannot calculate chromatic contrast ratios or handle dynamic theme values.
