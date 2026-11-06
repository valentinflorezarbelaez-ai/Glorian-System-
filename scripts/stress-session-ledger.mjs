#!/usr/bin/env node
/**
 * SPEC-153 cross-process stress for the shared agent session ledger.
 *
 * N concurrent workers open and complete sessions against one control-plane
 * root. The parent proves that merge-on-reload, the writer lock and atomic
 * replacement keep every session visible to every process (Windows included).
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  EosUniversalAgentSessionContract,
  SUPPORTED_IDE_FAMILIES
} from "../src/core/eosUniversalAgentSessionContract.ts";

const RESULT_MARKER = "__LEDGER_STRESS_RESULT__";
const scriptPath = fileURLToPath(import.meta.url);

function readOption(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    console.error(`[FAIL] --${name} requires a value.`);
    process.exit(2);
  }
  return value;
}

function createControlPlaneRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "eos-ledger-stress-"));
  const projects = ["eos-system", "fixture-alpha", "fixture-beta"].map((id) => ({
    id,
    name: id,
    status: "REGISTERED",
    intake: "INTAKE_COMPLETE",
    specification: "SPECIFICATION_APPROVED",
    audit: "AUDIT_COMPLETE",
    ownerApproval: "OWNER_APPROVAL",
    authorization: "LEVEL_3_PRODUCTION_AUTHORIZED"
  }));
  fs.mkdirSync(path.join(root, "docs", "projects"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "docs", "projects", "registry.json"),
    `${JSON.stringify({ projects }, null, 2)}\n`
  );
  fs.writeFileSync(
    path.join(root, "package.json"),
    `${JSON.stringify({ name: "ledger-stress-fixture", version: "0.0.0", private: true }, null, 2)}\n`
  );
  return root;
}

function cleanup(root) {
  try {
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch {
    // Leaking a temp directory is harmless; failing the stress run is not.
  }
}

function runWorker(root, ideFamily, sessionCount) {
  assert.ok(
    SUPPORTED_IDE_FAMILIES.includes(ideFamily),
    `unsupported ideFamily for stress worker: ${ideFamily}`
  );
  const contract = new EosUniversalAgentSessionContract(root);
  const sessionIds = [];

  for (let index = 0; index < sessionCount; index++) {
    const opened = contract.openSession({
      ideFamily,
      directive: `Stress ${ideFamily} session ${index + 1}/${sessionCount} under shared-ledger contention`,
      target: "eos-system"
    });
    for (const toolName of opened.mandatoryTools) {
      const recorded = contract.recordToolInvocation(opened.sessionId, toolName);
      assert.equal(recorded.recorded, true, `tool ${toolName} not recorded for ${opened.sessionId}`);
    }
    sessionIds.push(opened.sessionId);
  }

  for (const sessionId of sessionIds) {
    const status = contract.getSessionStatus(sessionId);
    assert.equal(status.found, true, `worker lost its own session ${sessionId}`);
    assert.equal(status.remainingMandatory.length, 0, `worker session ${sessionId} missed mandatory tools`);
  }

  console.log(`${RESULT_MARKER} ${JSON.stringify({ ideFamily, sessionIds })}`);
}

async function runWorkerProcess(root, ideFamily, sessionCount) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [scriptPath, "--worker", root, ideFamily, String(sessionCount)],
      { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] }
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`worker ${ideFamily} exited ${code}: ${stderr.trim() || stdout.trim()}`));
        return;
      }
      const line = stdout
        .split(/\r?\n/)
        .find((candidate) => candidate.startsWith(RESULT_MARKER));
      if (!line) {
        reject(new Error(`worker ${ideFamily} produced no result line: ${stdout.trim()}`));
        return;
      }
      resolve(JSON.parse(line.slice(RESULT_MARKER.length).trim()));
    });
  });
}

async function runCoordinator(processCount, sessionCount) {
  const root = createControlPlaneRoot();
  try {
    const ides = Array.from(
      { length: processCount },
      (_, index) => SUPPORTED_IDE_FAMILIES[index % SUPPORTED_IDE_FAMILIES.length]
    );
    const results = await Promise.all(
      ides.map((ideFamily) => runWorkerProcess(root, ideFamily, sessionCount))
    );

    const sessionIds = results.flatMap((result) => result.sessionIds);
    assert.equal(
      new Set(sessionIds).size,
      processCount * sessionCount,
      "session identifiers must be unique across workers"
    );

    const ledgerPath = path.join(root, EosUniversalAgentSessionContract.LEDGER_REL_PATH);
    const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
    for (const sessionId of sessionIds) {
      assert.ok(ledger.sessions[sessionId], `ledger on disk lost session ${sessionId}`);
    }

    // A brand-new process must observe every session written by the workers.
    const observer = new EosUniversalAgentSessionContract(root);
    for (const sessionId of sessionIds) {
      assert.equal(observer.getSessionStatus(sessionId).found, true, `observer cannot see ${sessionId}`);
    }

    console.log(
      `[PASS] Session ledger stress: ${processCount} processes × ${sessionCount} sessions ` +
        `(${sessionIds.length} sessions, ${ides.join(", ")}).`
    );
  } finally {
    cleanup(root);
  }
}

const workerIndex = process.argv.indexOf("--worker");
if (workerIndex !== -1) {
  const [workerRoot, ideFamily, rawCount] = process.argv.slice(workerIndex + 1);
  runWorker(path.resolve(workerRoot), ideFamily, Number(rawCount));
} else {
  const processCount = Number(readOption("processes", "4"));
  const sessionCount = Number(readOption("sessions", "3"));
  if (!Number.isInteger(processCount) || processCount < 2 || processCount > 16) {
    console.error("[FAIL] --processes must be an integer between 2 and 16.");
    process.exit(2);
  }
  if (!Number.isInteger(sessionCount) || sessionCount < 1 || sessionCount > 20) {
    console.error("[FAIL] --sessions must be an integer between 1 and 20.");
    process.exit(2);
  }
  runCoordinator(processCount, sessionCount).catch((error) => {
    console.error(`[FAIL] Session ledger stress failed: ${error.message}`);
    process.exit(1);
  });
}
