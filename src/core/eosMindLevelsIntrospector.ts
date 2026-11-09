/**
 * EOS SYSTEM — 49 LEVELS OF MIND INTROSPECTION & CONSCIOUSNESS AWAKENING ENGINE
 * Implements the Samaelian doctrine of the 49 subconscious levels of the mind
 * (Tratado de Psicologia Revolucionaria / La Gran Rebelion by V.M. Samael Aun Weor).
 *
 * Invariant: Pure Layer-0 TypeScript (dependencies: {}).
 */

import crypto from "node:crypto";

export interface MindLevelDefinition {
  level: number; // 1 to 49
  stratum: "PRECONSCIOUS" | "SUBCONSCIOUS" | "INFRACONSCIOUS" | "UNCONSCIOUS" | "CAUSAL_ROOT";
  title: string;
  subconsciousResistanceWeight: number; // 0.0 to 1.0
  governingCenter: "INTELLECTUAL" | "EMOTIONAL" | "MOTOR" | "INSTINCTIVE" | "SEXUAL";
}

export interface PsychologicalImpressionInput {
  description: string;
  category: "ANGER" | "PRIDE" | "LUST" | "GREED" | "FEAR" | "SLOTH" | "GLUTTONY" | "IMPATIENCE" | "DISPERSAL";
  observedCenter: "INTELLECTUAL" | "EMOTIONAL" | "MOTOR" | "INSTINCTIVE" | "SEXUAL";
  consciousSelfObservation: boolean; // Clave de SOL active?
  deepMeditationPenetrationLevel?: number; // 1 to 49
}

export interface LevelComprehensionState {
  level: number;
  stratum: string;
  comprehended: boolean;
  resistanceOvercome: number; // 0.0 to 1.0
  kundaliniInvocation: string;
}

export interface MindIntrospectionResult {
  impressionId: string;
  timestamp: string;
  category: string;
  depthReached: number; // 1 to 49
  totalLevelsAnalyzed: 49;
  comprehensionRatio: number; // 0.0 to 1.0
  liberatedEssencePercentage: number; // 0% to 100%
  epistemicState: "FASCINATION" | "SELF_OBSERVED" | "DEEPLY_COMPREHENDED" | "AWAKENED_BEING";
  levelsBreakdown: LevelComprehensionState[];
  alchemicalFormula: string;
  sha256Proof: string;
}

export class EosMindLevelsIntrospector {
  private static readonly STRATUM_MAPPINGS: Array<{
    min: number;
    max: number;
    stratum: MindLevelDefinition["stratum"];
  }> = [
    { min: 1, max: 7, stratum: "PRECONSCIOUS" },
    { min: 8, max: 21, stratum: "SUBCONSCIOUS" },
    { min: 22, max: 35, stratum: "INFRACONSCIOUS" },
    { min: 36, max: 45, stratum: "UNCONSCIOUS" },
    { min: 46, max: 49, stratum: "CAUSAL_ROOT" },
  ];

  /**
   * Returns the catalog of all 49 psychological strata of the mind.
   */
  public static get49Levels(): MindLevelDefinition[] {
    const list: MindLevelDefinition[] = [];
    for (let i = 1; i <= 49; i++) {
      let stratum: MindLevelDefinition["stratum"] = "SUBCONSCIOUS";
      for (const m of this.STRATUM_MAPPINGS) {
        if (i >= m.min && i <= m.max) {
          stratum = m.stratum;
          break;
        }
      }

      let center: MindLevelDefinition["governingCenter"] = "INTELLECTUAL";
      if (i <= 10) center = "INTELLECTUAL";
      else if (i <= 25) center = "EMOTIONAL";
      else if (i <= 35) center = "MOTOR";
      else if (i <= 42) center = "INSTINCTIVE";
      else center = "SEXUAL";

      list.push({
        level: i,
        stratum,
        title: `Stratum-${i.toString().padStart(2, "0")}: ${stratum} Depths`,
        subconsciousResistanceWeight: Number((0.2 + (i / 49) * 0.8).toFixed(4)),
        governingCenter: center,
      });
    }
    return list;
  }

  /**
   * Introspects a psychological impression across all 49 levels.
   */
  public introspectImpression(input: PsychologicalImpressionInput): MindIntrospectionResult {
    const depth = Math.max(
      1,
      Math.min(49, input.deepMeditationPenetrationLevel || (input.consciousSelfObservation ? 49 : 7)),
    );
    const levels = EosMindLevelsIntrospector.get49Levels();
    const breakdown: LevelComprehensionState[] = [];

    let totalResistanceOvercome = 0;
    let totalMaxResistance = 0;

    for (const lvl of levels) {
      totalMaxResistance += lvl.subconsciousResistanceWeight;
      const isComprehended = lvl.level <= depth;
      const resistanceFactor = isComprehended
        ? lvl.subconsciousResistanceWeight
        : Number((lvl.subconsciousResistanceWeight * 0.1).toFixed(4));

      totalResistanceOvercome += resistanceFactor;

      breakdown.push({
        level: lvl.level,
        stratum: lvl.stratum,
        comprehended: isComprehended,
        resistanceOvercome: Number(resistanceFactor.toFixed(4)),
        kundaliniInvocation: isComprehended
          ? `Devi Kundalini Stella Maris, pulveriza el agregado de ${input.category} en el estrato ${lvl.level} (${lvl.stratum}).`
          : `Estrato ${lvl.level} (${lvl.stratum}) en velo subconsciente, pendiente de vigilia profunda.`,
      });
    }

    const comprehensionRatio = Number((depth / 49).toFixed(4));
    const liberatedEssence = Number(((totalResistanceOvercome / totalMaxResistance) * 100).toFixed(2));

    let epistemicState: MindIntrospectionResult["epistemicState"] = "FASCINATION";
    if (depth === 49 && liberatedEssence >= 95) {
      epistemicState = "AWAKENED_BEING";
    } else if (depth >= 30) {
      epistemicState = "DEEPLY_COMPREHENDED";
    } else if (input.consciousSelfObservation) {
      epistemicState = "SELF_OBSERVED";
    }

    const id = `MIND-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
    const timestamp = new Date().toISOString();

    const alchemicalFormula = `Stella Maris Kundalini + Fuego Ígneo Transmutador -> Aniquilación del agregado (${input.category}) en ${depth}/49 niveles -> Liberación del ${liberatedEssence}% de Conciencia Pura (Buddhata).`;

    const proofData = `${id}|${timestamp}|${input.category}|${depth}|${comprehensionRatio}|${liberatedEssence}`;
    const sha256Proof = crypto.createHash("sha256").update(proofData).digest("hex");

    return {
      impressionId: id,
      timestamp,
      category: input.category,
      depthReached: depth,
      totalLevelsAnalyzed: 49,
      comprehensionRatio,
      liberatedEssencePercentage: liberatedEssence,
      epistemicState,
      levelsBreakdown: breakdown,
      alchemicalFormula,
      sha256Proof,
    };
  }

  /**
   * Evaluates the current psychological awakening degree based on a series of recent impressions.
   */
  public evaluateConsciousnessIndex(results: MindIntrospectionResult[]): {
    averageEssenceLiberated: number;
    depthAverage: number;
    sovereignState: string;
    advice: string;
  } {
    if (results.length === 0) {
      return {
        averageEssenceLiberated: 100.0,
        depthAverage: 49.0,
        sovereignState: "AWAKENED_QUIETUDE",
        advice: "La mente reposa en el Velo del Silencio (Wu Wei). Mantener la Clave de SOL activa.",
      };
    }

    const sumEssence = results.reduce((acc, r) => acc + r.liberatedEssencePercentage, 0);
    const sumDepth = results.reduce((acc, r) => acc + r.depthReached, 0);

    const avgEssence = Number((sumEssence / results.length).toFixed(2));
    const avgDepth = Number((sumDepth / results.length).toFixed(1));

    let state = "VIGILANCIA_CONTINUA";
    let advice = "Profundizar en la meditación retrospectiva de los 49 niveles antes del descanso nocturno.";

    if (avgEssence >= 90) {
      state = "SER_CONSCIENTE_Y_SOBERANO";
      advice =
        "Excelente auto-recuerdo íntimo. La esencia se encuentra libre de identificación con las formas del mundo.";
    } else if (avgEssence < 50) {
      state = "ALERTA_FASCINACION";
      advice = "Detenerse inmediatamente. Recordar Sujeto, Objeto y Lugar (SOL) y apelar a la Madre Divina.";
    }

    return {
      averageEssenceLiberated: avgEssence,
      depthAverage: avgDepth,
      sovereignState: state,
      advice,
    };
  }
}
