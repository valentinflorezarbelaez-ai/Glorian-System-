/**
 * EOS SYSTEM — THREE MOUNTAINS COMPASS UNIT & MUTATION SUITE
 *
 * Verifies EosThreeMountainsCompass alignment evaluations, mountain statuses,
 * tactical directives, and codified pillars with rigorous assertion contracts
 * to kill all semantic mutants.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { EosThreeMountainsCompass } from "../src/core/eosThreeMountainsCompass.ts";

describe("EosThreeMountainsCompass — Unit & Mutation Suite", () => {
  const compass = new EosThreeMountainsCompass();

  it("evaluates all true checklist producing elevated status and sublime directives", () => {
    const res = compass.evaluateDailyAlignment({
      nutritiousFoodLogged: true,
      impeccableCleanliness: true,
      dailyExerciseCompleted: true,
      layer0SoftwareFocusOnly: true,
      cajitasBudgetRespected: true,
      claveDeSolPracticed: true,
      circadianScreenVetoRespected: true,
      selflessServiceOrDonation: true,
    });

    assert.equal(res.architect, "Valentin Florez Arbelaez");
    assert.equal(res.coPilot, "EOS System (JARVIS)");
    assert.ok(res.auditId.startsWith("COMPASS-"));
    assert.equal(res.overallAlignmentIndex, 1.0);
    assert.equal(res.sacredCovenantPreserved, true);

    // Mountain 1 assertions
    assert.equal(res.mountains[0].mountain, "FIRST_MOUNTAIN_INITIATION");
    assert.equal(res.mountains[0].title, "Primera Montaña: Iniciación, Templo Físico y Fundación Material");
    assert.equal(
      res.mountains[0].pillar,
      "Trilogía de Bienestar (Comida, Aseo, Ejercicio) + Maestría de Software Capa 0",
    );
    assert.equal(res.mountains[0].score, 1.0);
    assert.equal(res.mountains[0].status, "ELEVATED_VIBRATION");
    assert.equal(res.mountains[0].insights.length, 0);

    // Mountain 2 assertions
    assert.equal(res.mountains[1].mountain, "SECOND_MOUNTAIN_RESURRECTION");
    assert.equal(res.mountains[1].title, "Segunda Montaña: Muerte Psicológica, Transmutación y Regeneración");
    assert.equal(res.mountains[1].pillar, "Clave de SOL continua + Veto Circadiano 22:30 + Regeneración Celular");
    assert.equal(res.mountains[1].score, 1.0);
    assert.equal(res.mountains[1].status, "ELEVATED_VIBRATION");
    assert.equal(res.mountains[1].insights.length, 0);

    // Mountain 3 assertions
    assert.equal(res.mountains[2].mountain, "THIRD_MOUNTAIN_ASCENSION");
    assert.equal(res.mountains[2].title, "Tercera Montaña: Ascensión, Cajitas Sagradas y Tercer Factor");
    assert.equal(res.mountains[2].pillar, "Independencia Financiera (El Refugio) + Donaciones y Sacrificio Consciente");
    assert.equal(res.mountains[2].score, 1.0);
    assert.equal(res.mountains[2].status, "ELEVATED_VIBRATION");
    assert.equal(res.mountains[2].insights.length, 0);

    assert.ok(res.tacticalDirectives.some((d) => d.includes("Alineación sublime")));
    assert.ok(
      res.tacticalDirectives.some((d) =>
        d.includes("El templo físico, el propósito económico y el Ser interior están perfectamente sincronizados."),
      ),
    );
    assert.equal(res.sha256Seal.length, 64);
  });

  it("evaluates all false checklist producing attention required and all gap insights", () => {
    const res = compass.evaluateDailyAlignment({
      nutritiousFoodLogged: false,
      impeccableCleanliness: false,
      dailyExerciseCompleted: false,
      layer0SoftwareFocusOnly: false,
      cajitasBudgetRespected: false,
      claveDeSolPracticed: false,
      circadianScreenVetoRespected: false,
      selflessServiceOrDonation: false,
    });

    assert.equal(res.overallAlignmentIndex, 0.0);
    assert.equal(res.sacredCovenantPreserved, false);
    assert.equal(res.mountains[0].status, "ATTENTION_REQUIRED");
    assert.equal(res.mountains[1].status, "ATTENTION_REQUIRED");
    assert.equal(res.mountains[2].status, "ATTENTION_REQUIRED");

    // Exact insights checks
    assert.equal(
      res.mountains[0].insights[0],
      "Registrar o priorizar alimento puro y nutritivo para el cuerpo físico.",
    );
    assert.equal(res.mountains[0].insights[1], "Mantener el espacio de trabajo y el entorno con pulcritud impecable.");
    assert.equal(res.mountains[0].insights[2], "Completar la sesión diaria de entrenamiento físico consciente.");
    assert.equal(
      res.mountains[0].insights[3],
      "Concentración total en 'SOLO EOS': blindar Capa 0 y mantener la landing sellada.",
    );

    assert.equal(
      res.mountains[1].insights[0],
      "Activar la Clave de SOL (Sujeto, Objeto, Lugar) de instante en instante.",
    );
    assert.equal(
      res.mountains[1].insights[1],
      "Apagar pantallas estrictamente a las 22:30 para asegurar el sueño reparador.",
    );

    assert.equal(
      res.mountains[2].insights[0],
      "Blindar las Cajitas sagradas (El Refugio, cuotas, arriendo, servicios) dentro del tope de $15 USD.",
    );
    assert.equal(
      res.mountains[2].insights[1],
      "Practicar el Tercer Factor: caridad consciente, ayuda al prójimo o donación desinteresada.",
    );

    assert.ok(res.tacticalDirectives.some((d) => d.includes("Reajustar los puntos de atención")));
    assert.ok(res.tacticalDirectives.some((d) => d.includes("Prioridad 1: Desconectar a las 22:30")));
    assert.ok(res.tacticalDirectives.some((d) => d.includes("Prioridad 2: Enfoque exclusivo en EOS")));
  });

  it("verifies sacred covenant boundary: overall >= 0.7 requires layer0SoftwareFocusOnly to be true", () => {
    // 6 out of 8 true (nutritiousFoodLogged: false, layer0SoftwareFocusOnly: false)
    // m1Score = 0.50, m2Score = 1.0, m3Score = 1.0
    // overall = 0.5 * 0.4 + 1.0 * 0.35 + 1.0 * 0.25 = 0.80 >= 0.70
    const resNoFocus = compass.evaluateDailyAlignment({
      nutritiousFoodLogged: false,
      impeccableCleanliness: true,
      dailyExerciseCompleted: true,
      layer0SoftwareFocusOnly: false,
      cajitasBudgetRespected: true,
      claveDeSolPracticed: true,
      circadianScreenVetoRespected: true,
      selflessServiceOrDonation: true,
    });

    assert.ok(resNoFocus.overallAlignmentIndex >= 0.7);
    assert.ok(resNoFocus.overallAlignmentIndex < 0.9);
    // But covenant MUST BE FALSE because layer0SoftwareFocusOnly is false
    assert.equal(resNoFocus.sacredCovenantPreserved, false);
    assert.ok(resNoFocus.tacticalDirectives.some((d) => d.includes("Prioridad 2: Enfoque exclusivo en EOS")));
  });

  it("verifies status boundary at 0.75 score for Mountain 2 and Mountain 3", () => {
    // Score exactly 0.5 < 0.75 => ATTENTION_REQUIRED
    const resM2Half = compass.evaluateDailyAlignment({
      nutritiousFoodLogged: true,
      impeccableCleanliness: true,
      dailyExerciseCompleted: true,
      layer0SoftwareFocusOnly: true,
      cajitasBudgetRespected: true,
      claveDeSolPracticed: true,
      circadianScreenVetoRespected: false,
      selflessServiceOrDonation: true,
    });
    assert.equal(resM2Half.mountains[1].score, 0.5);
    assert.equal(resM2Half.mountains[1].status, "ATTENTION_REQUIRED");

    const resM3Half = compass.evaluateDailyAlignment({
      nutritiousFoodLogged: true,
      impeccableCleanliness: true,
      dailyExerciseCompleted: true,
      layer0SoftwareFocusOnly: true,
      cajitasBudgetRespected: false,
      claveDeSolPracticed: true,
      circadianScreenVetoRespected: true,
      selflessServiceOrDonation: true,
    });
    assert.equal(resM3Half.mountains[2].score, 0.5);
    assert.equal(resM3Half.mountains[2].status, "ATTENTION_REQUIRED");
  });

  it("returns codified pillars correctly with full structural assertions", () => {
    const pillars = compass.getCodifiedPillars();
    assert.equal(pillars.length, 5);

    assert.equal(pillars[0].pillarNumber, 1);
    assert.equal(pillars[0].title, "Bóveda Sellada & Clausura de Landing");
    assert.equal(
      pillars[0].commitment,
      "Landing page formalmente clausurada y sellada en v39+. Portafolio, Aberamentho y plataformas en modo local.",
    );

    assert.equal(pillars[1].pillarNumber, 2);
    assert.equal(pillars[1].title, "Foco Único: 'SOLO EOS'");
    assert.equal(
      pillars[1].commitment,
      "Concentración total y veloz en el núcleo de EOS, pureza de Capa 0 (dependencies: {}) y verificación matemática.",
    );

    assert.equal(pillars[2].pillarNumber, 3);
    assert.equal(pillars[2].title, "Estrategia IA & FinOps Blindado");
    assert.equal(
      pillars[2].commitment,
      "Tope inviolable de $15 USD mensuales. Uso inteligente de modelos económicos y fail-closed automático.",
    );

    assert.equal(pillars[3].pillarNumber, 4);
    assert.equal(pillars[3].title, "Independencia Financiera & Templo Físico");
    assert.equal(
      pillars[3].commitment,
      "Seguridad de El Refugio, Cajitas sagradas y estricta práctica diaria de Comida nutritiva, Aseo y Ejercicio.",
    );

    assert.equal(pillars[4].pillarNumber, 5);
    assert.equal(pillars[4].title, "Propósito Gnóstico & Tercer Factor");
    assert.equal(
      pillars[4].commitment,
      "Disolución del ego, transmutación de la energía vital, donaciones y despertar del Cristo Cósmico interior.",
    );
  });
});
