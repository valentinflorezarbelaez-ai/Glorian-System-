/**
 * @file eosSovereignWebCompiler.types.ts
 * @description Types and domain contracts for the Autonomous Sovereign Web Application
 * & High-Converting SaaS Compiler (SPEC-343 / CHANGE-205).
 *
 * Invariant: Pure Layer-0 interfaces, zero external runtime dependencies.
 */

export type DesignArchetype = "GLORIAN_SOLAR" | "SPOTIFY_XIRP" | "PALANTIR_FOUNDRY" | "ANDURIL_LATTICE";

export interface ColorPalette {
  readonly background: string;
  readonly surface: string;
  readonly textPrimary: string;
  readonly textSecondary: string;
  readonly accent: string;
  readonly accentText: string;
  readonly border: string;
}

export interface ThemeConfig {
  readonly dark: ColorPalette;
  readonly light: ColorPalette;
}

export interface FeatureItem {
  readonly title: string;
  readonly description: string;
  readonly iconSvg?: string;
  readonly badge?: string;
}

export interface MetricItem {
  readonly label: string;
  readonly value: string;
  readonly delta?: string;
}

export interface PricingTier {
  readonly id: string;
  readonly name: string;
  readonly priceMonthly: number;
  readonly priceAnnual: number;
  readonly currency: string;
  readonly description: string;
  readonly features: readonly string[];
  readonly isPopular?: boolean;
  readonly ctaText: string;
  readonly ctaHref: string;
}

export interface FaqItem {
  readonly question: string;
  readonly answer: string;
}

export interface TestimonialItem {
  readonly quote: string;
  readonly author: string;
  readonly role: string;
  readonly company?: string;
}

export interface WebAppCompilationConfig {
  readonly appName: string;
  readonly tagline: string;
  readonly description: string;
  readonly domain: string;
  readonly archetype: DesignArchetype;
  readonly theme?: Partial<ThemeConfig>;
  readonly features: readonly FeatureItem[];
  readonly metrics?: readonly MetricItem[];
  readonly pricingTiers?: readonly PricingTier[];
  readonly faqs?: readonly FaqItem[];
  readonly testimonials?: readonly TestimonialItem[];
  readonly locale?: string;
  readonly authorName?: string;
  readonly ogImage?: string;
  readonly enablePwa?: boolean;
}

export interface ContrastRatioDetail {
  readonly context: string;
  readonly fg: string;
  readonly bg: string;
  readonly contrastRatio: number;
  readonly requiredRatio: number;
  readonly passed: boolean;
}

export interface WcagContrastResult {
  readonly valid: boolean;
  readonly mode: "DARK" | "LIGHT" | "COMBINED";
  readonly details: readonly ContrastRatioDetail[];
  readonly minimumObservedRatio: number;
  readonly breachCount: number;
}

export interface SriDigestResult {
  readonly algorithm: "sha384";
  readonly digest: string;
  readonly verified: boolean;
}

export interface MetaTagEntry {
  readonly name?: string;
  readonly property?: string;
  readonly content: string;
}

export interface SeoGraphMetadata {
  readonly jsonLd: Record<string, unknown>;
  readonly metaTags: readonly MetaTagEntry[];
  readonly title: string;
  readonly canonicalUrl: string;
}

export interface CompiledWebAppResult {
  readonly html: string;
  readonly css: string;
  readonly js: string;
  readonly manifestJson: string;
  readonly sriDigests: Record<string, string>;
  readonly contrastProof: WcagContrastResult;
  readonly seoGraph: SeoGraphMetadata;
  readonly wcagAaaCertified: boolean;
  readonly archetype: DesignArchetype;
  readonly compiledAt: string;
}

export interface WebCompilerAuditReceipt {
  readonly schemaVersion: "1.0.0";
  readonly spec: "SPEC-343";
  readonly timestamp: string;
  readonly totalArchetypesValidated: number;
  readonly wcagAaaComplianceScore: number;
  readonly sriVerificationPassed: boolean;
  readonly seoCompletenessScore: number;
  readonly allPassed: boolean;
  readonly sha256: string;
}
