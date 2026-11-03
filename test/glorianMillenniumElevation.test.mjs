import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { EosDurableSqliteLedger } from "../src/core/eosDurableSqliteLedger.ts";
import { EosDurableWal } from "../src/core/eosDurableWal.ts";

test("BDD-362: Materialización y Verificación de data/eos_bitemporal.wal", () => {
  const walPath = path.resolve("data/eos_bitemporal.wal");
  assert.ok(fs.existsSync(walPath), "data/eos_bitemporal.wal must exist on disk");
  const stat = fs.statSync(walPath);
  assert.ok(stat.size > 0, "WAL file size must be greater than zero bytes");

  const wal = new EosDurableWal(walPath, true);
  const records = wal.readAll();
  assert.ok(records.length >= 1, "WAL must contain at least one valid committed frame");
  wal.close();
});

test("BDD-363: Armonización Canónica de index.html hacia glorian-system.vercel.app", () => {
  const html = fs.readFileSync("index.html", "utf8");
  assert.match(html, /<link rel="canonical" href="https:\/\/glorian-system\.vercel\.app\/" \/>/);
  assert.match(html, /<meta property="og:url" content="https:\/\/glorian-system\.vercel\.app\/" \/>/);
  assert.match(html, /"url":\s*"https:\/\/glorian-system\.vercel\.app\/"/);
  assert.doesNotMatch(html, /<link rel="canonical" href="https:\/\/eos-system\.vercel\.app\/" \/>/);
  assert.match(html, /137 Specs/);
  assert.match(html, /137 SPECS/);
  assert.match(html, /137 OpenSpecs/);
});

test("BDD-364: Elevación del Cockpit en eosStudioConsole.html", () => {
  const html = fs.readFileSync("src/ui/eosStudioConsole.html", "utf8");
  assert.match(html, /GLORIAN SYSTEM \/\/ MATRIX &amp; SOVEREIGN FLEET COCKPIT v75\.0\.0/);
  assert.match(html, /184/);
  assert.match(html, /137/);
  assert.match(html, /1\.000 Entries \(MMR Certified\)/);
  assert.match(html, /100% NOMINAL/);
});

test("BDD-365: Atestación Criptográfica del Hito 1.000 en el Ledger", () => {
  const ledgerPath = EosDurableSqliteLedger.defaultLedgerPath(process.cwd());
  const ledger = new EosDurableSqliteLedger(ledgerPath);
  
  const searchResults = ledger.searchEntries("EOS-LEDGER-001000-GLORIAN-MILLENNIUM-SOVEREIGN-SEAL", 5);
  const entry1000 = searchResults.find((e) => e.seq === 1000) || ledger.getEntriesUpTo(1000).find((e) => e.seq === 1000);
  assert.ok(entry1000, "Ledger must contain transaction sequence 1000");
  assert.equal(entry1000.category, "MILESTONE_SEAL");
  assert.equal(entry1000.title, "EOS-LEDGER-001000-GLORIAN-MILLENNIUM-SOVEREIGN-SEAL");

  const integrity = ledger.verifyChainIntegrity();
  assert.equal(integrity.intact, true, "SHA-256 hash chain must be 100% intact");
  assert.ok(integrity.totalEntries >= 1000, "Total entries must be at least 1000");
  assert.equal(integrity.corruptedSequences.length, 0, "Zero corrupted sequences");
  ledger.close();
});
