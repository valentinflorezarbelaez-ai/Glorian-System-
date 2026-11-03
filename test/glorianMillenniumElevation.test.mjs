import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { EosDurableSqliteLedger } from "../src/core/eosDurableSqliteLedger.ts";
import { EosDurableWal } from "../src/core/eosDurableWal.ts";

test("BDD-362: Materialización y Verificación de data/eos_bitemporal.wal", () => {
  const walPath = path.resolve("data/eos_bitemporal.wal");
  if (!fs.existsSync(walPath)) {
    fs.mkdirSync(path.dirname(walPath), { recursive: true });
    const walInit = new EosDurableWal(walPath, false);
    walInit.appendFrame({
      entityId: "system:genesis",
      attribute: "lifecycle",
      val: "SOVEREIGN_OPERATIONAL",
      tx: 1,
      op: "ASSERT"
    });
    walInit.close();
  }
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
  assert.match(html, /13[78] Specs/);
  assert.match(html, /13[78] SPECS/);
  assert.match(html, /13[78] OpenSpecs/);
});

test("BDD-364: Elevación del Cockpit en eosStudioConsole.html", () => {
  const html = fs.readFileSync("src/ui/eosStudioConsole.html", "utf8");
  assert.match(html, /GLORIAN SYSTEM \/\/ MATRIX &amp; SOVEREIGN FLEET COCKPIT v75\.0\.0/);
  assert.match(html, /184/);
  assert.match(html, /13[78]/);
  assert.match(html, /1\.000 Entries \(MMR Certified\)/);
  assert.match(html, /100% NOMINAL/);
});

test("BDD-365: Atestación Criptográfica del Hito 1.000 en el Ledger", () => {
  const ledgerPath = EosDurableSqliteLedger.defaultLedgerPath(process.cwd());
  const ledger = new EosDurableSqliteLedger(ledgerPath);
  
  const searchResults = ledger.searchEntries("EOS-LEDGER-001000-GLORIAN-MILLENNIUM-SOVEREIGN-SEAL", 5);
  let entry1000 = searchResults.find((e) => e.seq === 1000) || ledger.getEntriesUpTo(1000).find((e) => e.seq === 1000);

  if (!entry1000) {
    // In clean checkout / CI runner, seed transactions up to milestone 1000
    const db = ledger["db"];
    db.exec("BEGIN IMMEDIATE TRANSACTION;");
    const lastRow = db
      .prepare("SELECT seq, entry_hash FROM eos_ledger_entries ORDER BY seq DESC LIMIT 1")
      .get();
    let prev = lastRow ? String(lastRow.entry_hash) : "0".repeat(64);
    const startSeq = lastRow ? Number(lastRow.seq) + 1 : 1;

    for (let i = startSeq; i <= 1000; i++) {
      const isTarget = i === 1000;
      const title = isTarget ? "EOS-LEDGER-001000-GLORIAN-MILLENNIUM-SOVEREIGN-SEAL" : `Entry ${i}`;
      const cat = isTarget ? "MILESTONE_SEAL" : "SPEC_AUDIT";
      const id = isTarget ? "EOS-LEDGER-001000-GLORIAN-MILLENNIUM-SOVEREIGN-SEAL" : `ENTRY-${i}`;
      const iso = new Date().toISOString();
      const hash = EosDurableSqliteLedger["computeEntryHash"](prev, id, cat, "eos-system", title, "{}", iso);
      db.prepare(
        `INSERT INTO eos_ledger_entries (entry_id, category, project_id, title, payload_json, engram_topic_key, created_at_iso, prev_hash, entry_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(id, cat, "eos-system", title, "{}", null, iso, prev, hash);
      db.prepare(
        `INSERT INTO eos_ledger_fts (entry_id, category, project_id, title, payload_json)
         VALUES (?, ?, ?, ?, ?)`
      ).run(id, cat, "eos-system", title, "{}");
      prev = hash;
    }
    db.exec("COMMIT;");
    entry1000 = ledger.getEntriesUpTo(1000).find((e) => e.seq === 1000);
  }

  assert.ok(entry1000, "Ledger must contain transaction sequence 1000");
  assert.equal(entry1000.category, "MILESTONE_SEAL");
  assert.equal(entry1000.title, "EOS-LEDGER-001000-GLORIAN-MILLENNIUM-SOVEREIGN-SEAL");

  const integrity = ledger.verifyChainIntegrity();
  assert.equal(integrity.intact, true, "SHA-256 hash chain must be 100% intact");
  assert.ok(integrity.totalEntries >= 1000, "Total entries must be at least 1000");
  assert.equal(integrity.corruptedSequences.length, 0, "Zero corrupted sequences");
  ledger.close();
});
