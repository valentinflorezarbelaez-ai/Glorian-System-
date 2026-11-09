import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EosContractEvolutionGovernor } from "../src/core/eosContractEvolutionGovernor.ts";
import { EosDurableSqliteLedger } from "../src/core/eosDurableSqliteLedger.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

test("BDD-161: Backward-Compatible Expansion Acceptance", () => {
  const base = {
    contractId: "UserProfileContract",
    version: "1.0.0",
    fields: [
      { name: "id", type: "string", optional: false },
      { name: "name", type: "string", optional: false },
    ],
  };

  const candidate = {
    contractId: "UserProfileContract",
    version: "1.1.0",
    fields: [
      { name: "id", type: "string", optional: false },
      { name: "name", type: "string", optional: false },
      { name: "email", type: "string", optional: true },
    ],
  };

  const report = EosContractEvolutionGovernor.compareContracts(base, candidate);

  assert.equal(report.gateVerdict, "APPROVED");
  assert.equal(report.compatibleExpansionsCount, 1);
  assert.equal(report.breakingContractionsCount, 0);
  assert.equal(report.diffs.length, 1);
  assert.equal(report.diffs[0].mutationType, "FIELD_ADDED");
  assert.equal(report.diffs[0].classification, "COMPATIBLE_EXPANSION");
  assert.equal(report.sha256Receipt.length, 64);
});

test("BDD-162: Breaking Field Deletion Rejection (Fail-Closed)", () => {
  const base = {
    contractId: "PaymentEvent",
    version: "1.0.0",
    fields: [
      { name: "paymentId", type: "string", optional: false },
      { name: "amount", type: "number", optional: false },
      { name: "currency", type: "string", optional: false },
    ],
  };

  const candidate = {
    contractId: "PaymentEvent",
    version: "2.0.0-unauthorized",
    fields: [
      { name: "paymentId", type: "string", optional: false },
      { name: "amount", type: "number", optional: false },
      // currency removed
    ],
  };

  const report = EosContractEvolutionGovernor.compareContracts(base, candidate);

  assert.equal(report.gateVerdict, "BREAKING_CHANGE_REJECTED");
  assert.equal(report.breakingContractionsCount, 1);
  assert.equal(report.diffs[0].mutationType, "FIELD_REMOVED");
  assert.equal(report.diffs[0].classification, "BREAKING_CONTRACTION");

  // Verify explicit override approves
  const overrideReport = EosContractEvolutionGovernor.compareContracts(base, candidate, {
    allowBreakingChanges: true,
  });
  assert.equal(overrideReport.gateVerdict, "APPROVED");
});

test("BDD-163: Type Mutation and Nullability Tightening", () => {
  const base = {
    contractId: "AccountSettings",
    version: "1.0.0",
    fields: [{ name: "age", type: "number", optional: true }],
  };

  const candidate = {
    contractId: "AccountSettings",
    version: "1.0.1",
    fields: [
      { name: "age", type: "string", optional: false }, // type changed + optional -> required
    ],
  };

  const report = EosContractEvolutionGovernor.compareContracts(base, candidate);

  assert.equal(report.gateVerdict, "BREAKING_CHANGE_REJECTED");
  assert.equal(report.breakingContractionsCount, 2);

  const mutationTypes = report.diffs.map((d) => d.mutationType);
  assert.ok(mutationTypes.includes("FIELD_TYPE_CHANGED"));
  assert.ok(mutationTypes.includes("OPTIONAL_BECOMES_REQUIRED"));
});

test("BDD-164: SQL Migration DDL Hazard Detection", () => {
  const ddlScript = `
    -- Safe add table
    CREATE TABLE audit_log (id BIGINT PRIMARY KEY);

    -- Hazardous column drop
    ALTER TABLE orders DROP COLUMN legacy_discount;

    -- Hazardous NOT NULL add without default
    ALTER TABLE orders ADD COLUMN vat_rate NUMERIC NOT NULL;
  `;

  const hazards = EosContractEvolutionGovernor.scanSqlMigrationHazards(ddlScript);

  assert.equal(hazards.length, 2);
  const ruleIds = hazards.map((h) => h.ruleId);
  assert.ok(ruleIds.includes("DROP_COLUMN_BREAKING_HAZARD"));
  assert.ok(ruleIds.includes("NOT_NULL_WITHOUT_DEFAULT_HAZARD"));
});

test("BDD-165: Cryptographic Contract Attestation & SQLite WAL Attestation", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-contract-ledger-"));
  const ledgerDbPath = path.join(tmpDir, "contract_ledger.sqlite");

  try {
    const base = {
      contractId: "CatalogItem",
      version: "1.0.0",
      fields: [{ name: "sku", type: "string", optional: false }],
    };
    const cand = {
      contractId: "CatalogItem",
      version: "1.1.0",
      fields: [
        { name: "sku", type: "string", optional: false },
        { name: "barcode", type: "string", optional: true },
      ],
    };

    const report = EosContractEvolutionGovernor.compareContracts(base, cand);
    const entryId = EosContractEvolutionGovernor.recordEvolutionAttestation(report, {
      ledgerDbPath,
      projectId: "eos-system",
    });

    assert.ok(entryId.startsWith("EOS-LEDGER-"));

    const ledger = new EosDurableSqliteLedger(ledgerDbPath);
    try {
      const integrity = ledger.verifyChainIntegrity();
      assert.equal(integrity.intact, true);
      assert.equal(integrity.totalEntries, 1);
    } finally {
      ledger.close();
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("BDD-166: MCP Dispatch of eos_contract_governor", () => {
  const server = new EosMcpServer(projectRoot, "core");

  // 1. Verify existence in tools/list
  const listRes = server.handleRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  const tools = listRes?.result?.tools || [];
  const govTool = tools.find((t) => t.name === "eos_contract_governor");
  assert.ok(govTool, "eos_contract_governor must be present in core profile");

  // 2. Invoke diff via snippets
  const baseSnippet = `
    export interface Invoice {
      id: string;
      total: number;
    }
  `;
  const candSnippet = `
    export interface Invoice {
      id: string;
      total: number;
      notes?: string;
    }
  `;

  const diffRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "eos_contract_governor",
      arguments: {
        action: "diff",
        baseInterfaceSnippet: baseSnippet,
        candidateInterfaceSnippet: candSnippet,
      },
    },
  });

  assert.ok(!diffRes.error);
  const data = JSON.parse(diffRes.result.content[0].text);
  assert.equal(data.gateVerdict, "APPROVED");
  assert.equal(data.compatibleExpansionsCount, 1);
  assert.equal(data.breakingContractionsCount, 0);

  // 3. Invoke SQL lint via MCP
  const sqlRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "eos_contract_governor",
      arguments: {
        action: "sql_lint",
        ddlSql: "ALTER TABLE users DROP COLUMN phone;",
      },
    },
  });

  assert.ok(!sqlRes.error);
  const sqlData = JSON.parse(sqlRes.result.content[0].text);
  assert.equal(sqlData.hazardsCount, 1);
  assert.equal(sqlData.hazards[0].ruleId, "DROP_COLUMN_BREAKING_HAZARD");
});
