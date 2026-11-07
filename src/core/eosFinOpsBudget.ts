/**
 * EOS INVIOLABLE FINOPS BUDGET SHIELD & CAJITAS ALLOCATOR (SPEC-031, CHANGE-024)
 * Enforces zero-surprise cloud expenditures with micro-cent token tracking,
 * a fail-closed circuit breaker at $15.00 USD/month, and sacred Cajitas partitions.
 *
 * Invariant: Pure Layer-0 TypeScript (dependencies: {}).
 */

export interface TokenUsageRecord {
  id: string;
  timestamp: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
}

export interface CajitaPartition {
  name: string;
  purpose: string;
  monthlyTargetCop?: number;
  monthlyTargetUsd?: number;
  isStrict: boolean;
  notes: string;
}

export interface FinOpsBudgetReport {
  monthlyCapUsd: number;
  accumulatedSpendUsd: number;
  remainingBudgetUsd: number;
  budgetUtilizationPercent: number;
  circuitBreakerState: "CLOSED_BUDGET_HEALTHY" | "OPEN_BUDGET_EXHAUSTED";
  fallbackToLocalEngine: boolean;
  totalUsageEvents: number;
  cajitas: CajitaPartition[];
  guarantee: "INVIOLABLE_ZERO_SURPRISE_FINOPS_DEFENSE";
}

export class EosFinOpsBudget {
  private monthlyCapUsd: number;
  private accumulatedSpendUsd: number = 0;
  private usageHistory: TokenUsageRecord[] = [];
  private circuitBreakerTripped: boolean = false;

  // Rates in USD per 1,000,000 tokens
  private ratesPerMillion: Record<string, { prompt: number; completion: number }> = {
    "deepseek-reasoner": { prompt: 0.14, completion: 0.28 },
    "deepseek-chat": { prompt: 0.14, completion: 0.28 },
    "gemini-2.0-flash": { prompt: 0.075, completion: 0.3 },
    "gemini-2.5-pro": { prompt: 1.25, completion: 5.0 },
    "claude-3-7-sonnet": { prompt: 3.0, completion: 15.0 },
    "gpt-4o": { prompt: 2.5, completion: 10.0 },
    "grok-2": { prompt: 2.0, completion: 10.0 },
  };

  private sacredCajitas: CajitaPartition[] = [
    {
      name: "El Refugio",
      purpose: "Cuotas sagradas de la finca de descanso y templo natural",
      isStrict: true,
      notes: "Prioridad número 1 en ahorro e inversión patrimonial",
    },
    {
      name: "Comida Nutritiva",
      purpose: "Alimentación vitalizante, limpia y balanceada del templo biológico",
      isStrict: true,
      notes: "Cero chatarra, máximo vigor para el gimnasio y la transmutación",
    },
    {
      name: "Hogar y Servicios",
      purpose: "Arriendo, servicios públicos y base material",
      isStrict: true,
      notes: "Aseo impecable y orden financiero absoluto",
    },
    {
      name: "Tercer Factor / Donaciones",
      purpose: "Ayuda desinteresada y consciente a los demás",
      isStrict: true,
      notes: "Ley cósmica de causa y efecto: quien da luz, recibe luz",
    },
    {
      name: "IA & Herramientas de Cúspide",
      purpose: "Tope mensual estricto de tokens de IA",
      monthlyTargetUsd: 15.0,
      isStrict: true,
      notes: "Máximo $15 USD/mes. Fallback local Go WASM ante límite alcanzado",
    },
    {
      name: "Spotify Premium & Cultura",
      purpose: "Música en afinación áurea y descanso consciente",
      monthlyTargetCop: 15000,
      isStrict: true,
      notes: "Pago anual preferencial de $180.000 COP / año ($15.000 COP / mes)",
    },
  ];

  constructor(monthlyCapUsd = 15.0) {
    this.monthlyCapUsd = monthlyCapUsd;
  }

  /**
   * Calculates the exact micro-cost of a token interaction.
   */
  public calculateCost(model: string, promptTokens: number, completionTokens: number): number {
    const rate = this.ratesPerMillion[model.toLowerCase()] || { prompt: 1.0, completion: 3.0 };
    const promptCost = (promptTokens / 1_000_000) * rate.prompt;
    const completionCost = (completionTokens / 1_000_000) * rate.completion;
    return Number((promptCost + completionCost).toFixed(6));
  }

  /**
   * Checks if an estimated expense is allowed before executing an API call (fail-closed).
   */
  public isBudgetAvailable(estimatedCostUsd = 0.001): boolean {
    return this.accumulatedSpendUsd + estimatedCostUsd <= this.monthlyCapUsd;
  }

  /**
   * Records a token usage event and updates the financial ledger.
   */
  public recordUsage(
    provider: string,
    model: string,
    promptTokens: number,
    completionTokens: number,
  ): { costUsd: number; allowed: boolean; breakerTripped: boolean } {
    const cost = this.calculateCost(model, promptTokens, completionTokens);

    if (this.accumulatedSpendUsd + cost > this.monthlyCapUsd) {
      this.circuitBreakerTripped = true;
      return {
        costUsd: cost,
        allowed: false,
        breakerTripped: true,
      };
    }

    this.accumulatedSpendUsd = Number((this.accumulatedSpendUsd + cost).toFixed(6));
    this.usageHistory.push({
      id: `USE-${this.usageHistory.length + 1}`,
      timestamp: new Date().toISOString(),
      provider,
      model,
      promptTokens,
      completionTokens,
      costUsd: cost,
    });

    return {
      costUsd: cost,
      allowed: true,
      breakerTripped: false,
    };
  }

  /**
   * Resets the monthly cycle or sets custom cap.
   */
  public resetMonthlyCycle(newCap?: number): void {
    this.accumulatedSpendUsd = 0;
    this.usageHistory = [];
    this.circuitBreakerTripped = false;
    if (newCap !== undefined) this.monthlyCapUsd = newCap;
  }

  /**
   * Returns comprehensive audit report of current FinOps state.
   */
  public getReport(): FinOpsBudgetReport {
    const remaining = Math.max(0, Number((this.monthlyCapUsd - this.accumulatedSpendUsd).toFixed(6)));
    const utilPercent = Number(((this.accumulatedSpendUsd / this.monthlyCapUsd) * 100).toFixed(2));
    const isExhausted = this.accumulatedSpendUsd >= this.monthlyCapUsd || this.circuitBreakerTripped;

    return {
      monthlyCapUsd: this.monthlyCapUsd,
      accumulatedSpendUsd: this.accumulatedSpendUsd,
      remainingBudgetUsd: remaining,
      budgetUtilizationPercent: utilPercent,
      circuitBreakerState: isExhausted ? "OPEN_BUDGET_EXHAUSTED" : "CLOSED_BUDGET_HEALTHY",
      fallbackToLocalEngine: isExhausted,
      totalUsageEvents: this.usageHistory.length,
      cajitas: this.sacredCajitas,
      guarantee: "INVIOLABLE_ZERO_SURPRISE_FINOPS_DEFENSE",
    };
  }
}
