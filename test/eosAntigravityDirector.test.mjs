import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EosAntigravityDirector } from "../src/core/eosAntigravityDirector.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";
import { evaluateHookEvent } from "../integrations/antigravity/eos-governance/scripts/eos-hook.mjs";
import { installAntigravityIntegration } from "../scripts/install-antigravity-mcp.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

test("BDD-124: EosAntigravityDirector classifies all 6 mission profiles and enforces Law IV write barrier", () => {
  assert.equal(
    EosAntigravityDirector.classifyProfile("Implement new SDD specification and feature module"),
    "SDD_FULL_21_STEP",
  );
  assert.equal(
    EosAntigravityDirector.classifyProfile("Audit OWASP security boundaries and secret rotation"),
    "SECURITY_HARDENING",
  );
  assert.equal(
    EosAntigravityDirector.classifyProfile("Run multi-repo fleet soundcheck and progressive canary rollout"),
    "FLEET_ORCHESTRATION",
  );
  assert.equal(
    EosAntigravityDirector.classifyProfile("Optimize p99 latency benchmark with MCTS tuning"),
    "PERFORMANCE_TUNING",
  );
  assert.equal(
    EosAntigravityDirector.classifyProfile("Audit hexagonal architecture and dead code refactor"),
    "ARCHITECTURE_AUDIT",
  );
  assert.equal(EosAntigravityDirector.classifyProfile("Fix broken regression error in worktree test"), "BUGFIX_FDIR");

  const authorizedPlan = EosAntigravityDirector.directMission(
    "Build new sovereign governance capability with formal EARS and BDD",
    "eos-system",
    projectRoot,
  );
  assert.equal(Object.isFrozen(authorizedPlan), true);
  assert.equal(authorizedPlan.profile, "SDD_FULL_21_STEP");
  assert.equal(authorizedPlan.matchedProjectId, "eos-system");
  assert.equal(authorizedPlan.writeBarrierStatus, "AUTHORIZED");
  assert.deepEqual(authorizedPlan.missingPreconditions, []);
  assert.ok(authorizedPlan.requiredSkills.includes("eos-director"));
  assert.ok(authorizedPlan.requiredSkills.includes("eos-sdd-pipeline"));
  assert.ok(authorizedPlan.prescribedMcpDag.length >= 4);
  assert.equal(authorizedPlan.sha256Receipt.length, 64);

  const crudSlackPlan = EosAntigravityDirector.directMission(
    "Execute fleet soundcheck and canary rollout across repositories",
    "crud-slack",
    projectRoot,
  );
  assert.equal(crudSlackPlan.profile, "FLEET_ORCHESTRATION");
  assert.equal(crudSlackPlan.matchedProjectId, "crud-slack");
  assert.equal(crudSlackPlan.writeBarrierStatus, "AUTHORIZED");
  assert.ok(crudSlackPlan.requiredSkills.includes("eos-fleet-ops"));

  const blockedPlan = EosAntigravityDirector.directMission(
    "Modify unregistered external directory directly",
    "C:/Unregistered/External/Project",
    projectRoot,
  );
  assert.equal(blockedPlan.writeBarrierStatus, "BLOCKED_BY_LAW_IV");
  assert.equal(blockedPlan.matchedProjectId, null);
  assert.ok(blockedPlan.missingPreconditions.length >= 4);
  assert.equal(blockedPlan.sha256Receipt.length, 64);
});

test("BDD-125: EosMcpServer negotiates 2024-11-05 & 2025-03-26, serves instructions, ping, prompts, resources, and Antigravity tools", () => {
  const server = new EosMcpServer(projectRoot);

  const init2024 = server.handleRequest({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "antigravity", version: "1.0" } },
  });
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));
  assert.equal(init2024?.result?.protocolVersion, "2024-11-05");
  assert.equal(init2024?.result?.serverInfo?.version, pkg.version);
  assert.ok(init2024?.result?.capabilities?.prompts);
  assert.ok(
    typeof init2024?.result?.instructions === "string" &&
      init2024.result.instructions.includes("Sovereign Antigravity MCP Director Playbook"),
  );

  const init2025 = server.handleRequest({
    jsonrpc: "2.0",
    id: 2,
    method: "initialize",
    params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "antigravity", version: "2.0" } },
  });
  assert.equal(init2025?.result?.protocolVersion, "2025-03-26");

  const pingRes = server.handleRequest({ jsonrpc: "2.0", id: 3, method: "ping" });
  assert.deepEqual(pingRes, { jsonrpc: "2.0", id: 3, result: {} });

  const promptsList = server.handleRequest({ jsonrpc: "2.0", id: 4, method: "prompts/list" });
  const promptNames = promptsList?.result?.prompts?.map((p) => p.name) || [];
  assert.deepEqual(promptNames, ["eos-direct-mission", "eos-sdd-gate", "eos-fleet-audit"]);

  const promptGet = server.handleRequest({
    jsonrpc: "2.0",
    id: 5,
    method: "prompts/get",
    params: { name: "eos-direct-mission", arguments: { directive: "Audit security boundaries", target: "eos-system" } },
  });
  assert.equal(promptGet?.result?.messages?.length, 1);
  assert.ok(promptGet?.result?.messages[0]?.content?.text.includes("SECURITY_HARDENING"));

  const unknownPrompt = server.handleRequest({
    jsonrpc: "2.0",
    id: 6,
    method: "prompts/get",
    params: { name: "non-existent-prompt" },
  });
  assert.equal(unknownPrompt?.error?.code, -32603);

  const playbookResource = server.handleRequest({
    jsonrpc: "2.0",
    id: 7,
    method: "resources/read",
    params: { uri: "eos://antigravity/director-playbook" },
  });
  assert.ok(playbookResource?.result?.contents?.[0]?.text.includes("eos_antigravity_direct"));

  const directCall = server.handleRequest({
    jsonrpc: "2.0",
    id: 8,
    method: "tools/call",
    params: {
      name: "eos_antigravity_direct",
      arguments: { directive: "Optimize latency benchmark with MCTS", target: "eos-system" },
    },
  });
  const parsedDirect = JSON.parse(directCall?.result?.content?.[0]?.text || "{}");
  assert.equal(parsedDirect.profile, "PERFORMANCE_TUNING");
  assert.equal(parsedDirect.writeBarrierStatus, "AUTHORIZED");

  // Subprocess stdio JSON-RPC end-to-end verification
  const stdioRequests =
    [
      JSON.stringify({ jsonrpc: "2.0", id: 101, method: "initialize", params: { protocolVersion: "2025-03-26" } }),
      JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
      JSON.stringify({ jsonrpc: "2.0", id: 102, method: "ping" }),
      JSON.stringify({
        jsonrpc: "2.0",
        id: 103,
        method: "tools/call",
        params: {
          name: "eos_antigravity_direct",
          arguments: { directive: "Audit hexagonal architecture", target: "eos-system" },
        },
      }),
    ].join("\n") + "\n";

  const proc = spawnSync(process.execPath, [path.join(projectRoot, "src", "mcp", "eosMcpServer.ts")], {
    cwd: projectRoot,
    input: stdioRequests,
    encoding: "utf8",
    timeout: 30000,
  });
  assert.equal(proc.status, 0);
  const lines = proc.stdout
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));
  assert.equal(lines.length, 3);
  assert.equal(lines[0].id, 101);
  assert.equal(lines[0].result.protocolVersion, "2025-03-26");
  assert.equal(lines[1].id, 102);
  assert.deepEqual(lines[1].result, {});
  assert.equal(lines[2].id, 103);
  const stdioPlan = JSON.parse(lines[2].result.content[0].text);
  assert.equal(stdioPlan.profile, "ARCHITECTURE_AUDIT");
});

test("BDD-126: Antigravity eos-hook.mjs injects SessionStart context and enforces PreToolUse Gamma Security Barrier", () => {
  const sessionRes = evaluateHookEvent("SessionStart", "{}");
  assert.ok(Array.isArray(sessionRes.injectSteps));
  assert.ok(sessionRes.injectSteps[0].systemMessage.systemMessage.includes("eos_antigravity_direct"));

  const allowRes = evaluateHookEvent(
    "PreToolUse",
    JSON.stringify({ toolCall: { name: "run_command", args: { CommandLine: "npm run test" } } }),
  );
  assert.deepEqual(allowRes, { decision: "allow" });

  const destructiveCommands = [
    "rm -rf /",
    "git push --force origin main",
    "psql -c 'DROP DATABASE production;'",
    "Format-Volume -DriveLetter C",
    "rd /s /q C:\\",
  ];
  for (const cmd of destructiveCommands) {
    const denyRes = evaluateHookEvent(
      "PreToolUse",
      JSON.stringify({ toolCall: { name: "run_command", args: { CommandLine: cmd } } }),
    );
    assert.equal(denyRes.decision, "deny", `Expected Gamma barrier to deny: ${cmd}`);
    assert.ok(denyRes.reason.includes("EOS Gamma Security Barrier"));
  }

  // Execute actual hook script from plugin root CWD exactly as Antigravity invokes hooks.json
  const pluginDir = path.join(projectRoot, "integrations", "antigravity", "eos-governance");
  const hookProc = spawnSync(process.execPath, ["./scripts/eos-hook.mjs", "PreToolUse"], {
    cwd: pluginDir,
    input: JSON.stringify({ toolCall: { name: "run_command", args: { CommandLine: "git push -f origin main" } } }),
    encoding: "utf8",
    timeout: 30000, // generous for parallel CI subprocess spawn
  });
  assert.equal(hookProc.status, 0);
  const hookJson = JSON.parse(hookProc.stdout.trim());
  assert.equal(hookJson.decision, "deny");
});

test("BDD-127: Hermetic Antigravity installer heals dangling junctions, preserves third-party MCP servers, and achieves 100/100 doctor score", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "eos-antigravity-test-"));
  const tempGeminiConfig = path.join(tempRoot, "gemini-config");
  const tempAppDataMcp = path.join(tempRoot, "appdata-mcp-eos");

  try {
    fs.mkdirSync(path.join(tempGeminiConfig, "plugins"), { recursive: true });
    fs.mkdirSync(tempAppDataMcp, { recursive: true });

    // Seed pre-existing third-party server entry to verify non-destructive preservation
    fs.writeFileSync(
      path.join(tempGeminiConfig, "mcp_config.json"),
      JSON.stringify(
        {
          mcpServers: {
            "third-party-mock": {
              command: "npx",
              args: ["-y", "mock-mcp"],
              env: { MOCK_SETTING: "preserve-intact" },
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    // Seed dangling junctions pointing to a non-existent legacy path
    const missingLegacyTarget = path.join(tempRoot, "non-existent-legacy-eos-dir");
    const linkType = process.platform === "win32" ? "junction" : "dir";
    try {
      fs.symlinkSync(missingLegacyTarget, path.join(tempGeminiConfig, "plugins", "eos-governance"), linkType);
      fs.symlinkSync(missingLegacyTarget, path.join(tempGeminiConfig, "skills"), linkType);
    } catch {
      // Fallback if environment restricts symlink creation
    }

    const beforeDoctor = EosAntigravityDirector.auditAntigravityIntegration(projectRoot, tempGeminiConfig);
    assert.ok(beforeDoctor.readinessScore < 95);

    // Run installer twice to prove idempotency
    const firstInstall = installAntigravityIntegration({
      projectRoot,
      geminiConfigDir: tempGeminiConfig,
      appDataMcpDir: tempAppDataMcp,
    });
    assert.equal(firstInstall.installed, true);
    assert.equal(firstInstall.doctorReport.readinessScore, 100);
    assert.equal(firstInstall.doctorReport.status, "SOVEREIGN_DIRECTING");
    assert.equal(firstInstall.doctorReport.singleServerInvariantVerified, true);

    const secondInstall = installAntigravityIntegration({
      projectRoot,
      geminiConfigDir: tempGeminiConfig,
      appDataMcpDir: tempAppDataMcp,
    });
    assert.equal(secondInstall.installed, true);
    assert.equal(secondInstall.doctorReport.readinessScore, 100);

    // Verify third-party server entry remained untouched and eos-system env bindings are populated
    const finalMcpDoc = JSON.parse(fs.readFileSync(path.join(tempGeminiConfig, "mcp_config.json"), "utf8"));
    assert.deepEqual(finalMcpDoc.mcpServers["third-party-mock"], {
      command: "npx",
      args: ["-y", "mock-mcp"],
      env: { MOCK_SETTING: "preserve-intact" },
    });
    assert.equal(finalMcpDoc.mcpServers["eos-system"].env.EOS_PROJECT_ROOT, projectRoot);

    const finalConfigDoc = JSON.parse(fs.readFileSync(path.join(tempGeminiConfig, "config.json"), "utf8"));
    assert.equal(finalConfigDoc.plugins["eos-governance"].enabled, true);

    assert.equal(fs.existsSync(path.join(tempAppDataMcp, "instructions.md")), true);
    assert.equal(fs.existsSync(path.join(tempAppDataMcp, "eos_antigravity_direct.json")), true);
    assert.equal(fs.existsSync(path.join(tempAppDataMcp, "eos_antigravity_doctor.json")), true);

    const mcpDoctorCall = new EosMcpServer(projectRoot).handleRequest({
      jsonrpc: "2.0",
      id: 99,
      method: "tools/call",
      params: { name: "eos_antigravity_doctor", arguments: { geminiConfigDir: tempGeminiConfig } },
    });
    const parsedDoctor = JSON.parse(mcpDoctorCall?.result?.content?.[0]?.text || "{}");
    assert.equal(parsedDoctor.readinessScore, 100);
    assert.equal(parsedDoctor.status, "SOVEREIGN_DIRECTING");
  } finally {
    // Detach junctions safely before removing tempRoot
    for (const rel of [path.join("plugins", "eos-governance"), "skills"]) {
      const candidate = path.join(tempGeminiConfig, rel);
      try {
        const st = fs.lstatSync(candidate);
        if (st.isSymbolicLink()) {
          try {
            fs.unlinkSync(candidate);
          } catch {
            fs.rmdirSync(candidate);
          }
        }
      } catch {
        // Ignore if already absent
      }
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("BDD-128: Director Edge Paths, Missing Registry, Gamma Empty Commands, and Diagnostic Invariants", () => {
  // 1. evaluateGammaCommand with empty/whitespace or non-string commands
  assert.equal(EosAntigravityDirector.evaluateGammaCommand("").decision, "allow");
  assert.equal(EosAntigravityDirector.evaluateGammaCommand("   ").decision, "allow");
  assert.equal(EosAntigravityDirector.evaluateGammaCommand(null).decision, "allow");

  // 2. classifyProfile fallback for generic/unrecognized prompts
  const fallbackProfile = EosAntigravityDirector.classifyProfile("just a general greeting or non-keyword task");
  assert.equal(fallbackProfile, "SDD_FULL_21_STEP");

  // 3. synthesizeAntigravityMcpEntry with fleet overrides
  const customConfig = EosAntigravityDirector.synthesizeAntigravityMcpEntry(projectRoot, {
    EOS_FLEET_CRUD_SLACK_PATH: path.join(projectRoot, "custom-fleet"),
  });
  assert.equal(customConfig.command, "node");
  assert.ok(customConfig.env.EOS_PROJECT_ROOT);
  assert.ok(customConfig.env.EOS_FLEET_CRUD_SLACK_PATH);

  // 4. Director mission plan when registry.json is missing in target directory
  const emptyTemp = fs.mkdtempSync(path.join(os.tmpdir(), "eos-missing-reg-"));
  try {
    const plan = EosAntigravityDirector.directMission(
      "Do something in an unconfigured project",
      "nonexistent",
      emptyTemp,
    );
    assert.equal(plan.writeBarrierStatus, "BLOCKED_BY_LAW_IV");
    assert.ok(plan.missingPreconditions.includes("REGISTRY_NOT_FOUND"));

    // Corrupted registry.json
    const docsProj = path.join(emptyTemp, "docs", "projects");
    fs.mkdirSync(docsProj, { recursive: true });
    fs.writeFileSync(path.join(docsProj, "registry.json"), "{ invalid json syntax", "utf8");

    const planCorrupt = EosAntigravityDirector.directMission("Try with corrupted registry", "corrupt", emptyTemp);
    assert.equal(planCorrupt.writeBarrierStatus, "BLOCKED_BY_LAW_IV");
    assert.ok(planCorrupt.missingPreconditions.includes("REGISTRY_PARSE_ERROR"));
  } finally {
    fs.rmSync(emptyTemp, { recursive: true, force: true });
  }
});

test("BDD-129: Gamma Destructive Patterns, BUGFIX_FDIR DAG, Doctor Diagnostics, and Write Barrier Preconditions", () => {
  // 1. All 5 GAMMA Destructive Rules
  const r1 = EosAntigravityDirector.evaluateGammaCommand("rm -rf /");
  assert.equal(r1.decision, "deny");
  assert.equal(r1.matchedRule, "GAMMA-001-ROOT-WIPE");

  const r2 = EosAntigravityDirector.evaluateGammaCommand("git push --force origin main");
  assert.equal(r2.decision, "deny");
  assert.equal(r2.matchedRule, "GAMMA-002-FORCE-PUSH-MAIN");

  const r3 = EosAntigravityDirector.evaluateGammaCommand("DROP TABLE users");
  assert.equal(r3.decision, "deny");
  assert.equal(r3.matchedRule, "GAMMA-003-SQL-DROP");

  const r4 = EosAntigravityDirector.evaluateGammaCommand("Format-Volume -DriveLetter C");
  assert.equal(r4.decision, "deny");
  assert.equal(r4.matchedRule, "GAMMA-004-DISK-FORMAT");

  const r5 = EosAntigravityDirector.evaluateGammaCommand("rd /s /q C:\\");
  assert.equal(r5.decision, "deny");
  assert.equal(r5.matchedRule, "GAMMA-005-WIN-SYSTEM-DEL");

  // 2. BUGFIX_FDIR Mission Directing
  const bugfixPlan = EosAntigravityDirector.directMission("Fix bug in kernel primitives", "eos-system", projectRoot);
  assert.equal(bugfixPlan.profile, "BUGFIX_FDIR");
  assert.equal(bugfixPlan.prescribedMcpDag.length, 4);
  assert.equal(bugfixPlan.prescribedMcpDag[0].toolName, "eos_semantic_search");
  assert.equal(bugfixPlan.prescribedMcpDag[1].toolName, "eos_get_blast_radius");
  assert.equal(bugfixPlan.prescribedMcpDag[2].toolName, "eos_validate_patch");
  assert.equal(bugfixPlan.prescribedMcpDag[3].toolName, "eos_turbo_verify");

  // 3. Write Barrier Preconditions with Incomplete Preconditions
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "eos-barrier-precond-"));
  try {
    const docsProj = path.join(tmpRoot, "docs", "projects");
    fs.mkdirSync(docsProj, { recursive: true });
    const registryContent = {
      projects: [
        {
          id: "incomplete-proj",
          status: "DRAFT",
          intake: "PENDING",
          specification: "PENDING",
          audit: "PENDING",
          authorization: "LEVEL_1",
          localPath: path.join(tmpRoot, "incomplete-proj"),
        },
      ],
    };
    fs.writeFileSync(path.join(docsProj, "registry.json"), JSON.stringify(registryContent), "utf8");

    // Match by localPath
    const planLocal = EosAntigravityDirector.directMission(
      "Update incomplete project",
      path.join(tmpRoot, "incomplete-proj"),
      tmpRoot,
    );
    assert.equal(planLocal.writeBarrierStatus, "BLOCKED_BY_LAW_IV");
    assert.ok(planLocal.missingPreconditions.includes("REGISTERED"));
    assert.ok(planLocal.missingPreconditions.includes("INTAKE_COMPLETE"));
    assert.ok(planLocal.missingPreconditions.includes("SPECIFICATION_APPROVED"));
    assert.ok(planLocal.missingPreconditions.includes("AUDIT_COMPLETE"));
    assert.ok(planLocal.missingPreconditions.includes("LEVEL_2_OR_LEVEL_3_AUTHORIZED"));

    // 4. Doctor with corrupted mcp_config.json
    const tmpGemini = fs.mkdtempSync(path.join(os.tmpdir(), "eos-gemini-corrupt-"));
    fs.writeFileSync(path.join(tmpGemini, "mcp_config.json"), "invalid json", "utf8");
    const docCorrupt = EosAntigravityDirector.auditAntigravityIntegration(tmpRoot, tmpGemini);
    assert.ok(docCorrupt.checks.some((c) => c.id === "GLOBAL_MCP_CONFIG" && c.detail.includes("Failed to parse")));

    // Doctor with mcp args pointing to non-existent file
    const badArgsMcp = {
      mcpServers: {
        "eos-system": {
          command: "node",
          args: [path.join(tmpRoot, "ghost-script.mjs")],
        },
      },
    };
    fs.writeFileSync(path.join(tmpGemini, "mcp_config.json"), JSON.stringify(badArgsMcp), "utf8");
    const docBadArgs = EosAntigravityDirector.auditAntigravityIntegration(tmpRoot, tmpGemini);
    assert.ok(docBadArgs.checks.some((c) => c.id === "GLOBAL_MCP_CONFIG" && c.detail.includes("non-existent file")));

    // Doctor with duplicate plugin mcp
    const pluginDir = path.join(tmpRoot, "integrations", "antigravity", "eos-governance");
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, "mcp_config.json"), "{}", "utf8");
    const docDup = EosAntigravityDirector.auditAntigravityIntegration(tmpRoot, tmpGemini);
    assert.equal(docDup.singleServerInvariantVerified, false);

    fs.rmSync(tmpGemini, { recursive: true, force: true });
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});
