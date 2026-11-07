/**
 * EOS GNOSTIC TEMPLE SENTINEL & THREE-BRAIN HARMONIZER (SPEC-031, CHANGE-024)
 * Codifies the supreme doctrine of V.M. Samael Aun Weor:
 * 1. Three-Brain Harmonization (Intellectual, Emotional, Motor-Instinctive-Sexual).
 * 2. Clave de SOL (Subject, Object, Place) Awakening Evaluator.
 * 3. Daily Psychological Impression Journal for Mystical Death (Devi Kundalini).
 * 4. Circadian Temple Sentinel & Nightly Screen Veto (Preservation of Vital Energy).
 * 5. Law of Octaves Conscious Shock Injector (Heptaparaparshinokh).
 *
 * Invariant: Pure Layer-0 TypeScript (dependencies: {}).
 */

import crypto from "node:crypto";

export interface ThreeBrainsReport {
  intellectualHours: number;
  emotionalHours: number;
  motorHours: number;
  totalHours: number;
  intellectualRatio: number;
  emotionalRatio: number;
  motorRatio: number;
  status: "HARMONIC_EQUILIBRIUM" | "INTELLECTUAL_HYPERTROPHY" | "DISPERSED";
  prescriptions: string[];
}

export interface ClaveDeSolInput {
  subjectAware: boolean; // Conscious of oneself as the observer
  objectFocused: boolean; // Immersed in work without mental daydreaming
  placePresent: boolean; // Grounded in physical body and surrounding room
  customObservation?: string;
}

export interface ClaveDeSolResult {
  consciousnessAwakeScore: number; // 0 - 100
  state: "DESPIERTO" | "FASCINADO_SUEÑO_CONCIENCIA" | "AUTO_OBSERVADOR";
  subjectState: string;
  objectState: string;
  placeState: string;
  theurgicAdvice: string;
}

export interface PsychologicalImpression {
  id: string;
  timestamp: string;
  triggerEvent: string;
  identifiedEgo: "ORGULLO" | "IRA" | "PEREZA" | "FASCINACION" | "IMPACIENCIA" | "LUJURIA" | "CODICIA";
  intensity: number; // 1 - 10
  dissolutionFormula: string;
}

export interface CircadianCheckResult {
  currentHour: number;
  vetoActive: boolean;
  status: "CIRCADIAN_REST_VETO_ACTIVE" | "SOLAR_ACTIVITY_AUTHORIZED";
  message: string;
  suggestedAction: string;
}

export interface OctaveShockResult {
  note: "DO" | "RE" | "MI" | "FA" | "SOL" | "LA" | "SI";
  isSemiToneInterval: boolean;
  needsConsciousShock: boolean;
  shockType?: "PHYSICAL_POWER" | "THIRD_FACTOR_SERVICE" | "SILENT_MEDITATION";
  prescription: string;
}

export class EosGnosticTemple {
  private impressionLog: PsychologicalImpression[] = [];

  /**
   * Evaluates the distribution of vital energy across the Three Brains.
   * If intellectual exceeds 70%, flags intellectual hypertrophy.
   */
  public auditThreeBrains(intellectualHours: number, emotionalHours: number, motorHours: number): ThreeBrainsReport {
    const total = Math.max(0.1, intellectualHours + emotionalHours + motorHours);
    const intRatio = Number((intellectualHours / total).toFixed(2));
    const emoRatio = Number((emotionalHours / total).toFixed(2));
    const motRatio = Number((motorHours / total).toFixed(2));

    const prescriptions: string[] = [];
    let status: "HARMONIC_EQUILIBRIUM" | "INTELLECTUAL_HYPERTROPHY" | "DISPERSED" = "HARMONIC_EQUILIBRIUM";

    if (intRatio > 0.7) {
      status = "INTELLECTUAL_HYPERTROPHY";
      prescriptions.push("ALERTA: Hipertrofia del Cerebro Intelectual (> 70%). Riesgo de fatiga nerviosa.");
      prescriptions.push("Compensación Inmediata: Calistenia o levantamiento de fuerza (Cerebro Motor).");
      prescriptions.push("Compensación Emocional: Escucha de música clásica a 432Hz (Beethoven / Wagner).");
    } else if (motRatio < 0.15) {
      prescriptions.push("Bajo vigor motor: Se prescribe caminata consciente al aire libre o entrenamiento físico.");
    } else {
      prescriptions.push("Equilibrio armónico preservado. Los tres cerebros cooperan al servicio del Íntimo.");
    }

    return {
      intellectualHours,
      emotionalHours,
      motorHours,
      totalHours: Number(total.toFixed(2)),
      intellectualRatio: intRatio,
      emotionalRatio: emoRatio,
      motorRatio: motRatio,
      status,
      prescriptions,
    };
  }

  /**
   * Evaluates the Clave de SOL (Sujeto, Objeto, Lugar).
   */
  public evaluateClaveDeSol(input: ClaveDeSolInput): ClaveDeSolResult {
    let score = 0;
    if (input.subjectAware) score += 35;
    if (input.objectFocused) score += 35;
    if (input.placePresent) score += 30;

    let state: "DESPIERTO" | "FASCINADO_SUEÑO_CONCIENCIA" | "AUTO_OBSERVADOR" = "FASCINADO_SUEÑO_CONCIENCIA";
    let theurgicAdvice = "";

    if (score >= 90) {
      state = "DESPIERTO";
      theurgicAdvice = "Conciencia despierta. Estás recordando al Ser Íntimo en este instante eterno.";
    } else if (score >= 60) {
      state = "AUTO_OBSERVADOR";
      theurgicAdvice = "Auto-observación activa. Afianza el Sujeto para no caer en la hipnosis del objeto.";
    } else {
      state = "FASCINADO_SUEÑO_CONCIENCIA";
      theurgicAdvice =
        "¡Alto! Estás fascinado por la forma externa. Haz un alto, siente tu respiración y pregúntate: ¿Quién soy yo? ¿Qué estoy haciendo? ¿En qué lugar me encuentro?";
    }

    return {
      consciousnessAwakeScore: score,
      state,
      subjectState: input.subjectAware
        ? "Auto-recuerdo presente (Sujeto activo)"
        : "Sujeto olvidado (Identificación con el ego)",
      objectState: input.objectFocused ? "Acción sin dispersión (Objeto enfocado)" : "Mente mecánica dispersa",
      placeState: input.placePresent ? "Enraizamiento físico total (Lugar consciente)" : "Cuerpo ausente en el espacio",
      theurgicAdvice,
    };
  }

  /**
   * Logs a psychological impression to the Ego Dissolution Ledger.
   */
  public recordImpression(
    triggerEvent: string,
    identifiedEgo: "ORGULLO" | "IRA" | "PEREZA" | "FASCINACION" | "IMPACIENCIA" | "LUJURIA" | "CODICIA",
    intensity: number,
  ): PsychologicalImpression {
    const formulas: Record<string, string> = {
      ORGULLO: "Madre Divina Kundalini, desintegra en mí este yo del orgullo y la vanidad intelectual.",
      IRA: "Madre Mía, aniquila la impaciencia y la ira, restituye la serenidad del Ser.",
      PEREZA: "Madre Divina, quema esta pereza y falta de voluntad con tu fuego sagrado.",
      FASCINACION: "Madre Mía, despiértame de esta hipnosis, hazme recordar a mi Cristo Íntimo.",
      IMPACIENCIA: "Madre Divina, dame la paciencia y el ritmo del infinito cosmos.",
      LUJURIA: "Madre Divina, transmuta la energía creadora hacia el corazón y el cerebro.",
      CODICIA: "Madre Mía, arranca la avaricia y hazme generoso con el Tercer Factor.",
    };

    const entry: PsychologicalImpression = {
      id: `IMP-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
      timestamp: new Date().toISOString(),
      triggerEvent,
      identifiedEgo,
      intensity: Math.min(10, Math.max(1, intensity)),
      dissolutionFormula: formulas[identifiedEgo] || "Madre Divina Kundalini, disuelve este agregado.",
    };

    this.impressionLog.push(entry);
    return entry;
  }

  public getImpressionLog(): PsychologicalImpression[] {
    return [...this.impressionLog];
  }

  /**
   * Circadian Sentinel: Checks if the physical temple should disconnect from screens.
   * Window: 22:30 to 05:00 local time.
   */
  public checkCircadianVeto(date = new Date()): CircadianCheckResult {
    const hour = date.getHours();
    const minute = date.getMinutes();
    const isNightVeto = hour >= 23 || (hour === 22 && minute >= 30) || hour < 5;

    if (isNightVeto) {
      return {
        currentHour: hour,
        vetoActive: true,
        status: "CIRCADIAN_REST_VETO_ACTIVE",
        message: "HORA SAGRADA DE REPOSO: El Templo Físico debe descansar para regenerar el Cuerpo Astral.",
        suggestedAction:
          "Cerrar pantallas, vocalizar Ham-Sah con respiración profunda y permitir la restauración del templo.",
      };
    }

    return {
      currentHour: hour,
      vetoActive: false,
      status: "SOLAR_ACTIVITY_AUTHORIZED",
      message: "Ciclo Solar Activo: Trabajo consciente y creación rigurosa autorizados.",
      suggestedAction: "Mantener la Clave de SOL mientras ejecutas arquitectura de software.",
    };
  }

  /**
   * Law of Octaves (Heptaparaparshinokh) Conscious Shock Injector.
   */
  public prescribeOctaveShock(note: "DO" | "RE" | "MI" | "FA" | "SOL" | "LA" | "SI"): OctaveShockResult {
    if (note === "MI") {
      return {
        note,
        isSemiToneInterval: true,
        needsConsciousShock: true,
        shockType: "PHYSICAL_POWER",
        prescription:
          "Intervalo Semitonal MI-FA: Desaceleración mecánica inminente. Aplicar Shock Consciente mediante esfuerzo físico voluntario o cambio total de polaridad.",
      };
    }

    if (note === "SI") {
      return {
        note,
        isSemiToneInterval: true,
        needsConsciousShock: true,
        shockType: "THIRD_FACTOR_SERVICE",
        prescription:
          "Intervalo Semitonal SI-DO: Cierre de la octava. Aplicar Tercer Factor (Sacrificio y servicio desinteresado por la humanidad) para iniciar una octava superior.",
      };
    }

    return {
      note,
      isSemiToneInterval: false,
      needsConsciousShock: false,
      prescription: `Nota ${note} en progresión armónica continua. Mantener el ritmo sin deriva.`,
    };
  }
}
