import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  EosGentlemanAutoUpdater,
  compareSemVer,
  hotSwapExecutableWithRollback,
  parseSemVer,
  selectLatestStableTag,
  syncSkillsTreeSafely,
  verifyArchiveChecksum
} from "../src/core/eosGentlemanAutoUpdater.ts";
import { maybeTriggerOpportunisticGentlemanUpdate } from "../integrations/antigravity/eos-governance/scripts/eos-hook.mjs";
import {
  GENTLEMAN_TASK_NAME,
  installGentlemanAutoUpdateSchedule,
  synthesizePosixCronLine,
  synthesizeSilentVbsLauncher
} from "../scripts/install-gentleman-autoupdate.mjs";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

test("BDD-133: SemVer parser and git ls-remote tag selector choose highest stable version and ignore pre-releases", () => {
  assert.equal(parseSemVer("gentle-ai 4.3.1")?.clean, "4.3.1");
  assert.equal(parseSemVer("engram v3.6.0 — Persistent memory")?.clean, "3.6.0");
  assert.equal(parseSemVer("Gentleman Guardian Angel v2.10.1")?.clean, "2.10.1");
  assert.equal(parseSemVer("v3.7.0-rc1"), null);

  assert.equal(compareSemVer("2.10.1", "2.9.0"), 1);
  assert.equal(compareSemVer("3.2.1", "3.6.0"), -1);
  assert.equal(compareSemVer("4.3.1", "4.3.1"), 0);

  const sampleLsRemote = [
    "f00b729432d45b1062b6debb9156179252cec8b0\trefs/tags/v2.7.2",
    "6bc535a7cf9f46bfa501d7fdadbe1091f122b9b7\trefs/tags/v2.9.0",
    "1111111111111111111111111111111111111111\trefs/tags/v2.10.1",
    "2222222222222222222222222222222222222222\trefs/tags/v2.11.0-rc1",
    "3333333333333333333333333333333333333333\trefs/tags/v3.0.0-beta.2",
    "4444444444444444444444444444444444444444\trefs/tags/release-provenance-v1"
  ].join("\n");

  const resolved = selectLatestStableTag(sampleLsRemote);
  assert.ok(resolved);
  assert.equal(resolved.version, "2.10.1");
  assert.equal(resolved.tag, "v2.10.1");
  assert.equal(resolved.commitSha, "1111111111111111111111111111111111111111");
});

test("BDD-134: verifyArchiveChecksum enforces SHA-256 fail-closed and hotSwapExecutableWithRollback restores .bak on failure", () => {
  const payload = Buffer.from("synthetic-engram-release-binary-payload", "utf8");
  const validSha = crypto.createHash("sha256").update(payload).digest("hex");
  const wrongSha = "f".repeat(64);

  const manifest = [
    `${validSha}  engram_3.6.0_windows_amd64.zip`,
    `${wrongSha}  engram_3.6.0_linux_amd64.tar.gz`
  ].join("\n");

  const okCheck = verifyArchiveChecksum(payload, "engram_3.6.0_windows_amd64.zip", manifest);
  assert.equal(okCheck.verified, true);
  assert.equal(okCheck.actualSha256, validSha);

  const tamperedPayload = Buffer.from("synthetic-engram-release-binary-TAMPERED", "utf8");
  const badCheck = verifyArchiveChecksum(tamperedPayload, "engram_3.6.0_windows_amd64.zip", manifest);
  assert.equal(badCheck.verified, false);

  const missingCheck = verifyArchiveChecksum(payload, "unknown_asset.zip", manifest);
  assert.equal(missingCheck.verified, false);

  // Executable hot-swap + rollback test
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-hotswap-test-"));
  try {
    const ext = process.platform === "win32" ? ".bat" : "";
    const targetBin = path.join(tmpDir, `mock-tool${ext}`);
    const candidateV2 = path.join(tmpDir, `candidate-v2${ext}`);
    const brokenCandidateV3 = path.join(tmpDir, `candidate-broken${ext}`);

    const makeWorkingScript = (ver) =>
      process.platform === "win32"
        ? `@echo off\r\necho mock-tool ${ver}\r\n`
        : `#!/usr/bin/env sh\necho "mock-tool ${ver}"\n`;

    const makeBrokenScript = () =>
      process.platform === "win32"
        ? `@echo off\r\nexit /b 1\r\n`
        : `#!/usr/bin/env sh\nexit 1\n`;

    fs.writeFileSync(targetBin, makeWorkingScript("1.0.0"), { mode: 0o755 });
    fs.writeFileSync(candidateV2, makeWorkingScript("2.0.0"), { mode: 0o755 });
    fs.writeFileSync(brokenCandidateV3, makeBrokenScript(), { mode: 0o755 });

    // Upgrade 1.0.0 -> 2.0.0 succeeds
    const swapOk = hotSwapExecutableWithRollback({
      targetPath: targetBin,
      candidatePath: candidateV2,
      smokeArgs: ["--version"],
      expectedVersionSubstring: "2.0.0"
    });
    assert.equal(swapOk.swapped, true);
    assert.equal(swapOk.rolledBack, false);
    assert.ok(swapOk.verifiedOutput.includes("2.0.0"));
    assert.equal(swapOk.binarySha256.length, 64);

    // Broken upgrade 2.0.0 -> broken V3 fails and automatically rolls back to 2.0.0
    const swapFail = hotSwapExecutableWithRollback({
      targetPath: targetBin,
      candidatePath: brokenCandidateV3,
      smokeArgs: ["--version"],
      expectedVersionSubstring: "3.0.0"
    });
    assert.equal(swapFail.swapped, false);
    assert.equal(swapFail.rolledBack, true);
    assert.equal(fs.readFileSync(targetBin, "utf8").includes("2.0.0"), true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("BDD-135: syncSkillsTreeSafely updates Gentleman skills, preserves eos-* skills, and blocks leaked secrets", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-skillsync-test-"));
  const localSkills = path.join(tmpDir, "local-skills");
  const upstreamClean = path.join(tmpDir, "upstream-clean");
  const upstreamMalicious = path.join(tmpDir, "upstream-malicious");

  try {
    fs.mkdirSync(path.join(localSkills, "eos-director"), { recursive: true });
    fs.mkdirSync(path.join(localSkills, "sdd-apply"), { recursive: true });
    fs.writeFileSync(path.join(localSkills, "eos-director", "SKILL.md"), "EOS_SOVEREIGN_IMMUTABLE", "utf8");
    fs.writeFileSync(path.join(localSkills, "sdd-apply", "SKILL.md"), "SDD_APPLY_V1", "utf8");

    fs.mkdirSync(path.join(upstreamClean, "sdd-apply"), { recursive: true });
    fs.mkdirSync(path.join(upstreamClean, "judgment-day"), { recursive: true });
    fs.mkdirSync(path.join(upstreamClean, "eos-director"), { recursive: true });
    fs.writeFileSync(path.join(upstreamClean, "sdd-apply", "SKILL.md"), "SDD_APPLY_V2_UPDATED", "utf8");
    fs.writeFileSync(path.join(upstreamClean, "judgment-day", "SKILL.md"), "JUDGMENT_DAY_NEW", "utf8");
    fs.writeFileSync(path.join(upstreamClean, "eos-director", "SKILL.md"), "ATTEMPTED_EOS_OVERWRITE", "utf8");

    const syncReport = syncSkillsTreeSafely(upstreamClean, localSkills);
    assert.deepEqual(syncReport.syncedSkillFolders, ["judgment-day", "sdd-apply"]);
    assert.deepEqual(syncReport.preservedEosSkills, ["eos-director"]);
    assert.equal(fs.readFileSync(path.join(localSkills, "sdd-apply", "SKILL.md"), "utf8"), "SDD_APPLY_V2_UPDATED");
    assert.equal(fs.readFileSync(path.join(localSkills, "judgment-day", "SKILL.md"), "utf8"), "JUDGMENT_DAY_NEW");
    assert.equal(fs.readFileSync(path.join(localSkills, "eos-director", "SKILL.md"), "utf8"), "EOS_SOVEREIGN_IMMUTABLE");

    // Upstream skill containing a plaintext token must fail closed before mutating localSkills
    fs.mkdirSync(path.join(upstreamMalicious, "sdd-apply"), { recursive: true });
    const fakePat = "ghp_" + "9".repeat(30);
    fs.writeFileSync(path.join(upstreamMalicious, "sdd-apply", "SKILL.md"), `Leaked token ${fakePat}`, "utf8");

    assert.throws(
      () => syncSkillsTreeSafely(upstreamMalicious, localSkills),
      /Security gate blocked credential pattern/
    );
    assert.equal(fs.readFileSync(path.join(localSkills, "sdd-apply", "SKILL.md"), "utf8"), "SDD_APPLY_V2_UPDATED");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("BDD-136: Lockfile mutual exclusion, 6-hour TTL staleness, and Antigravity SessionStart opportunistic hook coordination", () => {
  const tmpWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "eos-ttl-hook-test-"));
  try {
    fs.mkdirSync(path.join(tmpWorkspace, "bin"), { recursive: true });
    fs.writeFileSync(path.join(tmpWorkspace, "bin", "eos.mjs"), "// stub\n", "utf8");

    const baseNow = 1_800_000_000_000;

    // 1. Missing state -> update is due
    assert.equal(EosGentlemanAutoUpdater.isAutoUpdateDue(tmpWorkspace, 6, baseNow), true);
    const firstHook = maybeTriggerOpportunisticGentlemanUpdate(tmpWorkspace, { nowMs: baseNow, dryRun: true });
    assert.deepEqual(firstHook, { triggered: true, reason: "STALE_TTL_SPAWNED" });

    // 2. Acquire lock -> blocks concurrent runner and SessionStart hook
    assert.equal(EosGentlemanAutoUpdater.acquireLock(tmpWorkspace, baseNow), true);
    assert.equal(EosGentlemanAutoUpdater.acquireLock(tmpWorkspace, baseNow + 1000), false);
    const lockedHook = maybeTriggerOpportunisticGentlemanUpdate(tmpWorkspace, { nowMs: baseNow + 1000, dryRun: true });
    assert.deepEqual(lockedHook, { triggered: false, reason: "LOCK_ACTIVE" });
    EosGentlemanAutoUpdater.releaseLock(tmpWorkspace);

    // 3. Fresh state (1 hour old < 6h TTL) -> skipped in <2ms
    const statePath = EosGentlemanAutoUpdater.defaultStatePath(tmpWorkspace);
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(
      statePath,
      JSON.stringify({ lastCheckedAtMs: baseNow - 60 * 60 * 1000, lastCheckedAtIso: new Date(baseNow).toISOString() }),
      "utf8"
    );
    assert.equal(EosGentlemanAutoUpdater.isAutoUpdateDue(tmpWorkspace, 6, baseNow), false);
    const freshHook = maybeTriggerOpportunisticGentlemanUpdate(tmpWorkspace, { nowMs: baseNow, dryRun: true });
    assert.deepEqual(freshHook, { triggered: false, reason: "FRESH_TTL" });

    // 4. Stale state (7 hours old > 6h TTL) -> spawns detached background update
    fs.writeFileSync(
      statePath,
      JSON.stringify({ lastCheckedAtMs: baseNow - 7 * 60 * 60 * 1000, lastCheckedAtIso: new Date(baseNow).toISOString() }),
      "utf8"
    );
    assert.equal(EosGentlemanAutoUpdater.isAutoUpdateDue(tmpWorkspace, 6, baseNow), true);
    const staleHook = maybeTriggerOpportunisticGentlemanUpdate(tmpWorkspace, { nowMs: baseNow, dryRun: true });
    assert.deepEqual(staleHook, { triggered: true, reason: "STALE_TTL_SPAWNED" });
  } finally {
    fs.rmSync(tmpWorkspace, { recursive: true, force: true });
  }
});

test("BDD-137: Silent OS scheduler installer synthesizes zero-window launchers and MCP eos_gentleman_update serves status", () => {
  const vbs = synthesizeSilentVbsLauncher("C:\\Program Files\\nodejs\\node.exe", "C:\\Users\\valen\\Eos-System\\bin\\eos.mjs");
  assert.ok(vbs.includes("shell.Run cmd, 0, True"), "VBScript launcher must use window style 0 (SW_HIDE)");
  assert.ok(vbs.includes("gentleman update --apply --quiet"));

  const cron = synthesizePosixCronLine("/usr/local/bin/node", "/opt/eos/bin/eos.mjs", 6);
  assert.ok(cron.startsWith("0 */6 * * *"));
  assert.ok(cron.includes(GENTLEMAN_TASK_NAME));

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-sched-test-"));
  try {
    const dryInstall = installGentlemanAutoUpdateSchedule({
      projectRoot: tmpDir,
      intervalHours: 6,
      dryRun: true
    });
    assert.equal(dryInstall.installed, true);
    assert.equal(dryInstall.dryRun, true);
    assert.equal(fs.existsSync(dryInstall.launcherPath), true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  const server = new EosMcpServer(projectRoot, "core");
  const listRes = server.handleRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  const updateTool = listRes?.result?.tools?.find((t) => t.name === "eos_gentleman_update");
  assert.ok(updateTool, "eos_gentleman_update must be included in core Tier-0 profile");
  assert.equal(updateTool.annotations.readOnlyHint, false);

  const statusRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "eos_gentleman_update", arguments: { action: "status" } }
  });
  assert.ok(!statusRes?.error);
  const parsedStatus = JSON.parse(statusRes?.result?.content?.[0]?.text || "{}");
  assert.equal(parsedStatus.action, "status");
  assert.equal(typeof parsedStatus.isDue, "boolean");
  assert.equal(parsedStatus.constitutionSha256.length, 64);
});
