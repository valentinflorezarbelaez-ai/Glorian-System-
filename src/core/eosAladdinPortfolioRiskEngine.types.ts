/**
 * EOS Aladdin Institutional Portfolio & Multi-Factor Risk Engine Types
 * Part of SPEC-372 / CHANGE-234 (Layer-0 Pure Financial Architecture)
 */

export type VaultType = "VAULT_ALPHA_FIDUCIARY" | "VAULT_BETA_QUANT_LAB";

export type AssetClass =
  | "AAA_SOVEREIGN_BOND"
  | "BANK_CDT_FIXED"
  | "GLOBAL_EQUITY_INDEX"
  | "PHYSICAL_GOLD"
  | "COMMODITIES"
  | "SPECULATIVE_DERIVATIVE";

export interface PortfolioAsset {
  name: string;
  assetClass: AssetClass;
  weight: number;
  expectedAnnualReturn: number;
  annualVolatility: number;
}

export type HistoricalCrisis = "LEHMAN_2008" | "COVID_2020" | "BLACK_MONDAY_1987" | "STAGFLATION_1970S";

export interface CrisisStressResult {
  crisis: HistoricalCrisis;
  name: string;
  equityShock: number;
  portfolioDrawdown: number;
  survived: boolean;
  benchmark100EquityDrawdown: number;
  resilienceDelta: number;
}

export interface MonteCarloSimulationResult {
  paths: number;
  horizonDays: number;
  initialPrincipal: number;
  medianTerminalEquity: number;
  percentile5: number;
  percentile95: number;
  probabilityOfRuin: number;
  maxExpectedDrawdownPercent: number;
  seed: number;
}

export interface PortfolioRiskMetrics {
  annualExpectedReturn: number;
  annualPortfolioVolatility: number;
  var95: number;
  var99: number;
  cvar99: number;
  sharpeRatio: number;
  sortinoRatio: number;
  fractionalKellyFraction: number;
}

export interface AllWeatherAssetAllocation {
  name: string;
  assetClass: AssetClass;
  targetWeightPercent: number;
  currentWeightPercent: number;
  driftPercent: number;
  rebalanceAction: "BUY" | "SELL" | "HOLD";
}

export interface AllWeatherAllocationReport {
  timestamp: number;
  totalTargetWeightPercent: number;
  assets: AllWeatherAssetAllocation[];
  rebalanceRequired: boolean;
  maxDriftPercent: number;
}

export interface FiduciaryValidationResult {
  vault: VaultType;
  permitted: boolean;
  reason: string;
  capitalProtected: number;
}

export interface AladdinAuditReceipt {
  receiptId: string;
  status: "VERIFIED" | "FAILED";
  fiduciaryVaultSecurity: "SECURED" | "BREACHED";
  invariants: {
    zeroFiduciaryRuin: boolean;
    varThresholdBound: boolean;
    maxDrawdownGuard: boolean;
    deterministicAllocationSum: boolean;
  };
  metrics: {
    vaultAlphaPrincipal: number;
    probabilityOfRuin: number;
    var99Percent: number;
    cvar99Percent: number;
  };
  receiptHash: string;
  timestamp: number;
}
