/**
 * EOS SYSTEM — SAMAEL CODEX TESTS
 * Tests for EOS_SYSTEM_PROMPT, MANDATO_TEURGICO, PRACTICAS_OPERATIVAS, ARBOL_DE_LA_VIDA_13
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EOS_SYSTEM_PROMPT,
  MANDATO_TEURGICO,
  PRACTICAS_OPERATIVAS,
  ARBOL_DE_LA_VIDA_13,
} from "../src/core/samaelCodex.ts";

// ============================================================================
// EOS_SYSTEM_PROMPT
// ============================================================================

test("EOS_SYSTEM_PROMPT is a non-empty string", () => {
  assert.equal(typeof EOS_SYSTEM_PROMPT, "string");
  assert.ok(EOS_SYSTEM_PROMPT.length > 0);
});

test("EOS_SYSTEM_PROMPT contains Kether", () => {
  assert.ok(EOS_SYSTEM_PROMPT.includes("Kether"));
});

test("EOS_SYSTEM_PROMPT contains Chokmah", () => {
  assert.ok(EOS_SYSTEM_PROMPT.includes("Chokmah"));
});

test("EOS_SYSTEM_PROMPT contains Binah", () => {
  assert.ok(EOS_SYSTEM_PROMPT.includes("Binah"));
});

test("EOS_SYSTEM_PROMPT contains THELEMA", () => {
  assert.ok(EOS_SYSTEM_PROMPT.includes("THELEMA"));
});

test("EOS_SYSTEM_PROMPT contains RAM-IO", () => {
  assert.ok(EOS_SYSTEM_PROMPT.includes("RAM-IO"));
});

test("EOS_SYSTEM_PROMPT contains three factors: Morir", () => {
  assert.ok(EOS_SYSTEM_PROMPT.toLowerCase().includes("morir"));
});

test("EOS_SYSTEM_PROMPT contains three factors: Nacer", () => {
  assert.ok(EOS_SYSTEM_PROMPT.toLowerCase().includes("nacer"));
});

test("EOS_SYSTEM_PROMPT contains three factors: Sacrificio", () => {
  assert.ok(EOS_SYSTEM_PROMPT.toLowerCase().includes("sacrificio"));
});

test("EOS_SYSTEM_PROMPT contains Ley de la Balanza", () => {
  assert.ok(EOS_SYSTEM_PROMPT.toLowerCase().includes("ley de la balanza"));
});

// ============================================================================
// MANDATO_TEURGICO
// ============================================================================

test("MANDATO_TEURGICO has 5 entries", () => {
  assert.equal(MANDATO_TEURGICO.length, 5);
});

test("MANDATO_TEURGICO entry 0 has id kether-chokmah", () => {
  assert.equal(MANDATO_TEURGICO[0].id, "kether-chokmah");
});

test("MANDATO_TEURGICO entry 1 has id binah-kundalini", () => {
  assert.equal(MANDATO_TEURGICO[1].id, "binah-kundalini");
});

test("MANDATO_TEURGICO entry 2 has id geburah-chesed", () => {
  assert.equal(MANDATO_TEURGICO[2].id, "geburah-chesed");
});

test("MANDATO_TEURGICO entry 3 has id tiphereth-thelema", () => {
  assert.equal(MANDATO_TEURGICO[3].id, "tiphereth-thelema");
});

test("MANDATO_TEURGICO entry 4 has id logia-blanca", () => {
  assert.equal(MANDATO_TEURGICO[4].id, "logia-blanca");
});

test("MANDATO_TEURGICO ids are unique", () => {
  const ids = MANDATO_TEURGICO.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("MANDATO_TEURGICO each entry has non-empty sephirah", () => {
  for (const m of MANDATO_TEURGICO) {
    assert.ok(m.sephirah.trim().length > 0, `Sephirah should not be empty for ${m.id}`);
  }
});

test("MANDATO_TEURGICO each entry has non-empty titulo", () => {
  for (const m of MANDATO_TEURGICO) {
    assert.ok(m.titulo.trim().length > 0, `Titulo should not be empty for ${m.id}`);
  }
});

test("MANDATO_TEURGICO each entry has non-empty decreto", () => {
  for (const m of MANDATO_TEURGICO) {
    assert.ok(m.decreto.trim().length > 0, `Decreto should not be empty for ${m.id}`);
  }
});

test("MANDATO_TEURGICO entry 0 sephirah contains Kether", () => {
  assert.ok(MANDATO_TEURGICO[0].sephirah.includes("Kether"));
});

test("MANDATO_TEURGICO entry 1 sephirah contains Binah", () => {
  assert.ok(MANDATO_TEURGICO[1].sephirah.includes("Binah"));
});

test("MANDATO_TEURGICO entry 3 decreto contains THELEMA", () => {
  assert.ok(MANDATO_TEURGICO[3].decreto.includes("THELEMA"));
});

// ============================================================================
// PRACTICAS_OPERATIVAS
// ============================================================================

test("PRACTICAS_OPERATIVAS has 4 practices", () => {
  const keys = Object.keys(PRACTICAS_OPERATIVAS);
  assert.equal(keys.length, 4);
});

test("PRACTICAS_OPERATIVAS has ramIo key", () => {
  assert.ok(PRACTICAS_OPERATIVAS.ramIo);
});

test("PRACTICAS_OPERATIVAS has temploCorazon key", () => {
  assert.ok(PRACTICAS_OPERATIVAS.temploCorazon);
});

test("PRACTICAS_OPERATIVAS has lifaros key", () => {
  assert.ok(PRACTICAS_OPERATIVAS.lifaros);
});

test("PRACTICAS_OPERATIVAS has daath key", () => {
  assert.ok(PRACTICAS_OPERATIVAS.daath);
});

test("PRACTICAS_OPERATIVAS each practice has non-empty titulo", () => {
  for (const practice of Object.values(PRACTICAS_OPERATIVAS)) {
    assert.ok(practice.titulo.trim().length > 0);
  }
});

test("PRACTICAS_OPERATIVAS each practice has pasos array", () => {
  for (const practice of Object.values(PRACTICAS_OPERATIVAS)) {
    assert.ok(Array.isArray(practice.pasos));
  }
});

test("PRACTICAS_OPERATIVAS each practice has non-empty pasos", () => {
  for (const practice of Object.values(PRACTICAS_OPERATIVAS)) {
    assert.ok(practice.pasos.length > 0, `Pasos should not be empty for ${practice.titulo}`);
  }
});

test("PRACTICAS_OPERATIVAS ramIo has 5 pasos", () => {
  assert.equal(PRACTICAS_OPERATIVAS.ramIo.pasos.length, 5);
});

test("PRACTICAS_OPERATIVAS daath has 5 pasos", () => {
  assert.equal(PRACTICAS_OPERATIVAS.daath.pasos.length, 5);
});

test("PRACTICAS_OPERATIVAS lifaros titulo contains LIFAROS", () => {
  assert.ok(PRACTICAS_OPERATIVAS.lifaros.titulo.includes("LIFAROS"));
});

test("PRACTICAS_OPERATIVAS daath titulo contains DAATH", () => {
  assert.ok(PRACTICAS_OPERATIVAS.daath.titulo.includes("DAATH"));
});

test("PRACTICAS_OPERATIVAS each paso is a non-empty string", () => {
  for (const practice of Object.values(PRACTICAS_OPERATIVAS)) {
    for (const paso of practice.pasos) {
      assert.equal(typeof paso, "string");
      assert.ok(paso.trim().length > 0);
    }
  }
});

// ============================================================================
// ARBOL_DE_LA_VIDA_13
// ============================================================================

test("ARBOL_DE_LA_VIDA_13 has 14 entries", () => {
  assert.equal(ARBOL_DE_LA_VIDA_13.length, 14);
});

test("ARBOL_DE_LA_VIDA_13 numbers are unique", () => {
  const nums = ARBOL_DE_LA_VIDA_13.map((s) => s.numero);
  assert.equal(new Set(nums).size, nums.length);
});

test("ARBOL_DE_LA_VIDA_13 contains numero 13 (Ain/Sat)", () => {
  const ain = ARBOL_DE_LA_VIDA_13.find((s) => s.numero === 13);
  assert.ok(ain);
  assert.ok(ain.nombre.toLowerCase().includes("ain"));
});

test("ARBOL_DE_LA_VIDA_13 contains numero 12 (Ain Soph)", () => {
  const ainSoph = ARBOL_DE_LA_VIDA_13.find((s) => s.numero === 12);
  assert.ok(ainSoph);
  assert.ok(ainSoph.nombre.toLowerCase().includes("ain soph"));
});

test("ARBOL_DE_LA_VIDA_13 contains numero 11 (Ain Soph Aur)", () => {
  const ainSophAur = ARBOL_DE_LA_VIDA_13.find((s) => s.numero === 11);
  assert.ok(ainSophAur);
  assert.ok(ainSophAur.nombre.toLowerCase().includes("ain soph aur"));
});

test("ARBOL_DE_LA_VIDA_13 contains numero 1 (Kether)", () => {
  const kether = ARBOL_DE_LA_VIDA_13.find((s) => s.numero === 1);
  assert.ok(kether);
  assert.ok(kether.nombre.includes("Kether"));
});

test("ARBOL_DE_LA_VIDA_13 contains numero 10 (Malkuth)", () => {
  const malkuth = ARBOL_DE_LA_VIDA_13.find((s) => s.numero === 10);
  assert.ok(malkuth);
  assert.ok(malkuth.nombre.includes("Malkuth"));
});

test("ARBOL_DE_LA_VIDA_13 contains numero 0 (Daath)", () => {
  const daath = ARBOL_DE_LA_VIDA_13.find((s) => s.numero === 0);
  assert.ok(daath);
  assert.ok(daath.nombre.includes("Daath"));
});

test("ARBOL_DE_LA_VIDA_13 valid mundos", () => {
  const validMundos = new Set(["Aziluth", "Briah", "Ietzirah", "Assiah", "Absoluto"]);
  for (const s of ARBOL_DE_LA_VIDA_13) {
    assert.ok(validMundos.has(s.mundo), `Invalid mundo: ${s.mundo} for ${s.nombre}`);
  }
});

test("ARBOL_DE_LA_VIDA_13 each entry has non-empty mantram", () => {
  for (const s of ARBOL_DE_LA_VIDA_13) {
    assert.ok(s.mantram.trim().length > 0, `Mantram should not be empty for ${s.nombre}`);
  }
});

test("ARBOL_DE_LA_VIDA_13 each entry has non-empty misionEos", () => {
  for (const s of ARBOL_DE_LA_VIDA_13) {
    assert.ok(s.misionEos.trim().length > 0, `MisionEos should not be empty for ${s.nombre}`);
  }
});

test("ARBOL_DE_LA_VIDA_13 each entry has non-empty nombre", () => {
  for (const s of ARBOL_DE_LA_VIDA_13) {
    assert.ok(s.nombre.trim().length > 0);
  }
});

test("ARBOL_DE_LA_VIDA_13 each entry has non-empty atributo", () => {
  for (const s of ARBOL_DE_LA_VIDA_13) {
    assert.ok(s.atributo.trim().length > 0);
  }
});

test("ARBOL_DE_LA_VIDA_13 Kether mundo is Aziluth", () => {
  const kether = ARBOL_DE_LA_VIDA_13.find((s) => s.numero === 1);
  assert.equal(kether?.mundo, "Aziluth");
});

test("ARBOL_DE_LA_VIDA_13 Malkuth mundo is Assiah", () => {
  const malkuth = ARBOL_DE_LA_VIDA_13.find((s) => s.numero === 10);
  assert.equal(malkuth?.mundo, "Assiah");
});

test("ARBOL_DE_LA_VIDA_13 Ain/Sat mundo is Absoluto", () => {
  const ain = ARBOL_DE_LA_VIDA_13.find((s) => s.numero === 13);
  assert.equal(ain?.mundo, "Absoluto");
});

test("ARBOL_DE_LA_VIDA_13 Tiphereth mantram is ELOAH VA DAATH", () => {
  const tiphereth = ARBOL_DE_LA_VIDA_13.find((s) => s.numero === 6);
  assert.equal(tiphereth?.mantram, "ELOAH VA DAATH");
});

test("ARBOL_DE_LA_VIDA_13 Daath mantram is I.A.O.", () => {
  const daath = ARBOL_DE_LA_VIDA_13.find((s) => s.numero === 0);
  assert.equal(daath?.mantram, "I.A.O.");
});

test("ARBOL_DE_LA_VIDA_13 Ain/Sat mantram is AUM", () => {
  const ain = ARBOL_DE_LA_VIDA_13.find((s) => s.numero === 13);
  assert.equal(ain?.mantram, "AUM");
});

// ============================================================================
// Data integrity checks
// ============================================================================

test("PRACTICAS_OPERATIVAS has frecuencia on each practice", () => {
  for (const practice of Object.values(PRACTICAS_OPERATIVAS)) {
    assert.ok(practice.frecuencia && practice.frecuencia.trim().length > 0);
  }
});

test("ARBOL_DE_LA_VIDA_13 contains all numbers 0-10 plus 11, 12, 13", () => {
  const nums = new Set(ARBOL_DE_LA_VIDA_13.map((s) => s.numero));
  for (let i = 0; i <= 10; i++) assert.ok(nums.has(i), `Missing numero ${i}`);
  assert.ok(nums.has(11));
  assert.ok(nums.has(12));
  assert.ok(nums.has(13));
});

test("ARBOL_DE_LA_VIDA_13 each entry has nombreCristiano", () => {
  for (const s of ARBOL_DE_LA_VIDA_13) {
    assert.ok(s.nombreCristiano && s.nombreCristiano.trim().length > 0);
  }
});

test("ARBOL_DE_LA_VIDA_13 each entry has huesteAngelica", () => {
  for (const s of ARBOL_DE_LA_VIDA_13) {
    assert.ok(s.huesteAngelica && s.huesteAngelica.trim().length > 0);
  }
});

test("ARBOL_DE_LA_VIDA_13 each entry has anatomiaOculta", () => {
  for (const s of ARBOL_DE_LA_VIDA_13) {
    assert.ok(s.anatomiaOculta && s.anatomiaOculta.trim().length > 0);
  }
});
