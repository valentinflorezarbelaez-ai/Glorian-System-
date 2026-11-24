import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  EosContainerSandbox,
  detectAvailableRuntimes,
  resolveSandboxRuntime,
} from "../src/core/eosContainerSandbox.ts";
import {
  applyWorkspaceChanges,
  assertWorkspaceWithinLimits,
  copyFilteredWorkspace,
  isExcluded,
  scanWorkspace,
} from "../src/core/eosContainerSandbox.types.ts";

function git(cwd, args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

const VALID_HEX = "a".repeat(64);
const VALID_IMAGE = `node:22-alpine@sha256:${VALID_HEX}`;

function makeDockerSyncMock(overrides = {}) {
  return (args) => {
    const key = args.join(" ");
    if (overrides.throwFor && key.includes(overrides.throwFor)) {
      throw new Error(overrides.throwMessage || "mock docker error");
    }
    if (key.includes("{{.OSType}}")) return overrides.osType ?? "linux";
    if (key.includes("{{json .SecurityOptions}}"))
      return JSON.stringify(overrides.securityOptions ?? ["name=seccomp,profile=builtin"]);
    if (key.includes("{{.CgroupVersion}}")) return overrides.cgroupVersion ?? "2";
    if (key.includes("{{.CgroupDriver}}")) return overrides.cgroupDriver ?? "systemd";
    if (key.includes("{{json .Warnings}}")) return JSON.stringify(overrides.warnings ?? []);
    if (key.startsWith("context show")) return "default";
    if (key.startsWith("context inspect")) {
      return JSON.stringify([{ Endpoints: { docker: { Host: overrides.host ?? "unix:///var/run/docker.sock" } } }]);
    }
    if (key.startsWith("image inspect")) {
      return JSON.stringify(overrides.repoDigests ?? [VALID_IMAGE]);
    }
    return "";
  };
}

test("BDD-SANDBOX-FAULT-001: scanWorkspace rejects symlinks disguised under excluded names and applyWorkspaceChanges rolls back atomically", (t) => {
  const tmpSb = fs.mkdtempSync(path.join(os.tmpdir(), "eos-sb-atomic-"));
  t.after(() => fs.rmSync(tmpSb, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }));

  const hostDir = path.join(tmpSb, "host");
  const snapDir = path.join(tmpSb, "snap");
  fs.mkdirSync(hostDir, { recursive: true });
  fs.mkdirSync(snapDir, { recursive: true });

  assert.equal(isExcluded(".env", false), true);
  assert.equal(isExcluded(".env.example", false), false);
  assert.equal(isExcluded(".ssh/id_rsa", false), true);
  assert.equal(isExcluded("id_ed25519", false), true);
  assert.equal(isExcluded("node_modules", true), true);
  assert.equal(isExcluded("credentials.json", false), true);
  assert.equal(isExcluded("prod-firebase-adminsdk-key.json", false), true);
  assert.equal(isExcluded("config/service-account.json", false), true);
  assert.equal(isExcluded("keys/tls.pem", false), true);
  assert.equal(isExcluded(".git/config", false), true);
  assert.equal(isExcluded("dir/.git/config", false), true);
  assert.equal(isExcluded("src/index.ts", false), false);

  assert.throws(() => copyFilteredWorkspace(hostDir, snapDir), /enumerate non-ignored worktree files/);

  git(hostDir, ["init", "--initial-branch=main"]);
  git(hostDir, ["config", "user.name", "Sandbox Test"]);
  git(hostDir, ["config", "user.email", "sandbox-test@example.invalid"]);
  fs.writeFileSync(path.join(hostDir, "a.txt"), "baseline-a\n", "utf8");
  fs.writeFileSync(path.join(hostDir, "b.txt"), "baseline-b\n", "utf8");
  fs.writeFileSync(path.join(hostDir, "c.txt"), "baseline-c\n", "utf8");
  fs.writeFileSync(path.join(hostDir, "deleted-cached.txt"), "gone-on-disk\n", "utf8");
  fs.mkdirSync(path.join(hostDir, "dir"), { recursive: true });
  fs.writeFileSync(path.join(hostDir, "dir", "in.txt"), "in-dir\n", "utf8");
  fs.writeFileSync(path.join(hostDir, ".env"), "SECRET_VAL=placeholder\n", "utf8");
  git(hostDir, ["add", "a.txt", "b.txt", "c.txt", "deleted-cached.txt", "dir/in.txt", ".env"]);
  git(hostDir, ["commit", "-m", "Init"]);
  fs.unlinkSync(path.join(hostDir, "deleted-cached.txt"));

  const copied = copyFilteredWorkspace(hostDir, snapDir);
  assert.ok(copied.excludedPaths.includes(".env"));
  fs.mkdirSync(path.join(snapDir, "node_modules"), { recursive: true });
  fs.writeFileSync(path.join(snapDir, "node_modules", "ignored.js"), "export {};\n", "utf8");
  const baseSnap = scanWorkspace(snapDir, undefined, copied.originalModes);
  assert.equal(baseSnap.files.size, 4);

  assertWorkspaceWithinLimits(snapDir);
  assert.throws(() => assertWorkspaceWithinLimits(snapDir, { maxFiles: 1 }), /live 64 MiB\/file/);
  assert.throws(() => assertWorkspaceWithinLimits(snapDir, { maxSingleFileBytes: 1 }), /live 64 MiB\/file/);
  assert.throws(() => scanWorkspace(snapDir, undefined, copied.originalModes, { maxFiles: 1 }), /20,000-file/);

  fs.unlinkSync(path.join(snapDir, "a.txt"));
  fs.writeFileSync(path.join(snapDir, "b.txt"), "updated-b\n", "utf8");
  fs.writeFileSync(path.join(snapDir, "c.txt"), "updated-c\n", "utf8");
  fs.mkdirSync(path.join(snapDir, "00_new"), { recursive: true });
  fs.writeFileSync(path.join(snapDir, "00_new", "d.txt"), "created-first\n", "utf8");
  fs.mkdirSync(path.join(snapDir, "nested"), { recursive: true });
  fs.writeFileSync(path.join(snapDir, "nested", "d.txt"), "created-d\n", "utf8");
  const afterSnap = scanWorkspace(snapDir, baseSnap);

  // 0. Path escape and non-directory parent conflict fail closed in Phase 1 preflight
  const escapeAfter = { files: new Map(afterSnap.files), bytes: afterSnap.bytes, symlinks: [] };
  escapeAfter.files.set("../escape.txt", { sha256: "a".repeat(64), size: 1, mode: 0o644, sandboxMode: 0o644 });
  assert.deepEqual(applyWorkspaceChanges(hostDir, snapDir, baseSnap, escapeAfter).conflicts, ["../escape.txt"]);

  const nonDirParentAfter = { files: new Map(baseSnap.files), bytes: baseSnap.bytes, symlinks: [] };
  nonDirParentAfter.files.set("a.txt/child.txt", { sha256: "a".repeat(64), size: 1, mode: 0o644, sandboxMode: 0o644 });
  assert.deepEqual(applyWorkspaceChanges(hostDir, snapDir, baseSnap, nonDirParentAfter).conflicts, ["a.txt/child.txt"]);

  // 1. Concurrent host drift on c.txt fails preflight: zero mutations occur anywhere
  fs.writeFileSync(path.join(hostDir, "c.txt"), "concurrent-host-edit\n", "utf8");
  const preflightConflict = applyWorkspaceChanges(hostDir, snapDir, baseSnap, afterSnap);
  assert.deepEqual(preflightConflict.applied, []);
  assert.deepEqual(preflightConflict.conflicts, ["c.txt"]);
  assert.equal(fs.existsSync(path.join(hostDir, "a.txt")), true);
  assert.equal(fs.readFileSync(path.join(hostDir, "b.txt"), "utf8"), "baseline-b\n");
  assert.equal(fs.existsSync(path.join(hostDir, "nested", "d.txt")), false);

  // 2. Restore c.txt and inject mid-flight fault on c.txt -> undo journal restores a.txt, b.txt, and removes 00_new
  fs.writeFileSync(path.join(hostDir, "c.txt"), "baseline-c\n", "utf8");
  const midFault = applyWorkspaceChanges(hostDir, snapDir, baseSnap, afterSnap, (relPath) => {
    if (relPath === "c.txt") throw new Error("Simulated ENOSPC mid-writeback");
  });
  assert.deepEqual(midFault.applied, []);
  assert.deepEqual(midFault.conflicts, ["c.txt"]);
  assert.equal(fs.readFileSync(path.join(hostDir, "a.txt"), "utf8"), "baseline-a\n");
  assert.equal(fs.readFileSync(path.join(hostDir, "b.txt"), "utf8"), "baseline-b\n");
  assert.equal(fs.readFileSync(path.join(hostDir, "c.txt"), "utf8"), "baseline-c\n");
  assert.equal(fs.existsSync(path.join(hostDir, "00_new")), false);
  assert.equal(fs.existsSync(path.join(hostDir, "nested", "d.txt")), false);

  // 3. Clean commit succeeds atomically
  const cleanCommit = applyWorkspaceChanges(hostDir, snapDir, baseSnap, afterSnap);
  assert.equal(cleanCommit.conflicts.length, 0);
  assert.deepEqual(cleanCommit.applied, ["00_new/d.txt", "a.txt", "b.txt", "c.txt", "nested/d.txt"]);
  assert.equal(fs.existsSync(path.join(hostDir, "a.txt")), false);
  assert.equal(fs.readFileSync(path.join(hostDir, "b.txt"), "utf8"), "updated-b\n");
  assert.equal(fs.readFileSync(path.join(hostDir, "nested", "d.txt"), "utf8"), "created-d\n");

  // 4. Symlink disguised under excluded name (.git) inside post-run snapshot MUST be caught before exclusion skip
  const outsideFile = path.join(tmpSb, "outside.txt");
  fs.writeFileSync(outsideFile, "secret\n", "utf8");
  let symlinkCreated = false;
  try {
    fs.symlinkSync(outsideFile, path.join(snapDir, ".git"));
    symlinkCreated = true;
  } catch {
    // Windows without Developer Mode symlink privilege skips symlink creation
  }
  if (symlinkCreated) {
    const symlinkScan = scanWorkspace(snapDir, baseSnap);
    assert.ok(symlinkScan.symlinks.includes(".git"));
    assert.throws(
      () => applyWorkspaceChanges(hostDir, snapDir, baseSnap, symlinkScan),
      /Sandbox output contains symlinks/,
    );
  }
});

test("BDD-SANDBOX-FAULT-002: doctor and run enforce engine security policies, image pinning, and isolated worktree writeback", async (t) => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "eos-sb-engine-"));
  const repoRoot = path.join(tmpRoot, "repo");
  fs.mkdirSync(repoRoot, { recursive: true });
  git(repoRoot, ["init", "--initial-branch=main"]);
  git(repoRoot, ["config", "user.name", "Sandbox Test"]);
  git(repoRoot, ["config", "user.email", "sandbox-test@example.invalid"]);
  fs.writeFileSync(path.join(repoRoot, "tracked.txt"), "hello\n", "utf8");
  git(repoRoot, ["add", "tracked.txt"]);
  git(repoRoot, ["commit", "-m", "Init"]);
  const wtRel = path.join(".worktrees", "wt-sandbox");
  git(repoRoot, ["worktree", "add", "-b", "eos/sb-test", wtRel]);
  const wtAbs = path.join(repoRoot, wtRel);

  const prevImage = process.env.EOS_SANDBOX_IMAGE;
  const prevDockerHost = process.env.DOCKER_HOST;
  delete process.env.DOCKER_HOST;
  process.env.EOS_SANDBOX_IMAGE = VALID_IMAGE;

  t.after(() => {
    if (prevImage === undefined) delete process.env.EOS_SANDBOX_IMAGE;
    else process.env.EOS_SANDBOX_IMAGE = prevImage;
    if (prevDockerHost === undefined) delete process.env.DOCKER_HOST;
    else process.env.DOCKER_HOST = prevDockerHost;
    try {
      git(repoRoot, ["worktree", "remove", "--force", wtRel]);
    } catch {
      /* worktree already cleaned up */
    }
    fs.rmSync(tmpRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  // 1. Doctor readiness & negative security probes
  const readySb = new EosContainerSandbox(repoRoot, { runDockerSync: makeDockerSyncMock() });
  assert.equal(readySb.doctor().ready, true);

  assert.match(
    new EosContainerSandbox(repoRoot, { runDockerSync: makeDockerSyncMock({ osType: "windows" }) }).doctor().message,
    /Linux container engine/,
  );
  assert.match(
    new EosContainerSandbox(repoRoot, {
      runDockerSync: makeDockerSyncMock({ securityOptions: ["name=apparmor"] }),
    }).doctor().message,
    /seccomp profile/,
  );
  assert.match(
    new EosContainerSandbox(repoRoot, {
      runDockerSync: makeDockerSyncMock({ throwFor: "SecurityOptions", throwMessage: "daemon down" }),
    }).doctor().message,
    /daemon down/,
  );
  assert.match(
    new EosContainerSandbox(repoRoot, { runDockerSync: makeDockerSyncMock({ cgroupVersion: "1" }) }).doctor().message,
    /cgroup v2/,
  );
  assert.match(
    new EosContainerSandbox(repoRoot, { runDockerSync: makeDockerSyncMock({ cgroupDriver: "none" }) }).doctor().message,
    /cgroup resource controllers/,
  );
  assert.match(
    new EosContainerSandbox(repoRoot, {
      runDockerSync: makeDockerSyncMock({
        securityOptions: ["name=rootless", "name=seccomp,profile=builtin"],
        cgroupDriver: "cgroupfs",
      }),
    }).doctor().message,
    /systemd cgroup driver/,
  );
  assert.match(
    new EosContainerSandbox(repoRoot, { runDockerSync: makeDockerSyncMock({ warnings: ["No memory limit"] }) }).doctor()
      .message,
    /unsupported resource limits/,
  );
  assert.match(
    new EosContainerSandbox(repoRoot, {
      runDockerSync: makeDockerSyncMock({ host: "tcp://10.0.0.5:2375" }),
    }).doctor().message,
    /Remote Docker contexts/,
  );
  process.env.EOS_SANDBOX_IMAGE = "node:latest";
  assert.match(readySb.doctor().message, /immutable repository@sha256/);
  delete process.env.EOS_SANDBOX_IMAGE;
  assert.match(readySb.doctor().message, /Set EOS_SANDBOX_IMAGE/);
  process.env.EOS_SANDBOX_IMAGE = VALID_IMAGE;

  // 2. Run COMPLETED + applyChanges: true writes container mutations (modify + create nested + delete) back safely
  fs.writeFileSync(path.join(wtAbs, "to-delete.txt"), "remove me\n", "utf8");
  git(wtAbs, ["add", "to-delete.txt"]);
  git(wtAbs, ["commit", "-m", "Add to-delete"]);

  const capturedDockerArgs = [];
  const mockSpawnOk = (_cmd, args) => {
    capturedDockerArgs.push(args);
    const proc = new EventEmitter();
    proc.kill = () => {};
    const mountArg = args.find((a) => a.startsWith("type=bind,source="));
    const snapDir = mountArg.slice("type=bind,source=".length, mountArg.indexOf(",target="));
    queueMicrotask(() => {
      fs.writeFileSync(path.join(snapDir, "tracked.txt"), "mutated-in-container\n", "utf8");
      fs.unlinkSync(path.join(snapDir, "to-delete.txt"));
      fs.mkdirSync(path.join(snapDir, "sub", "deep"), { recursive: true });
      fs.writeFileSync(path.join(snapDir, "sub", "deep", "added.txt"), "new-file\n", "utf8");
      proc.emit("close", 0, null);
    });
    return proc;
  };

  const sbRun = new EosContainerSandbox(repoRoot, {
    runDockerSync: makeDockerSyncMock(),
    spawnDocker: mockSpawnOk,
  });
  const okReport = await sbRun.run({
    worktreePath: wtRel,
    command: "node",
    commandArgs: ["-e", "process.exit(0)"],
    applyChanges: true,
    timeoutMs: 5000,
  });
  assert.equal(okReport.success, true);
  assert.equal(okReport.status, "COMPLETED");
  assert.equal(okReport.appliedChanges, true);
  assert.deepEqual(okReport.changedFiles, ["sub/deep/added.txt", "to-delete.txt", "tracked.txt"]);
  assert.equal(fs.readFileSync(path.join(wtAbs, "tracked.txt"), "utf8"), "mutated-in-container\n");
  assert.equal(fs.existsSync(path.join(wtAbs, "to-delete.txt")), false);
  assert.equal(fs.readFileSync(path.join(wtAbs, "sub", "deep", "added.txt"), "utf8"), "new-file\n");
  assert.ok(capturedDockerArgs[0].includes("--network=none"));

  // 3. Conflict during run --apply when host mutates tracked.txt concurrently
  const mockSpawnConflict = (_cmd, args) => {
    const proc = new EventEmitter();
    proc.kill = () => {};
    const mountArg = args.find((a) => a.startsWith("type=bind,source="));
    const snapDir = mountArg.slice("type=bind,source=".length, mountArg.indexOf(",target="));
    queueMicrotask(() => {
      fs.writeFileSync(path.join(wtAbs, "tracked.txt"), "host-raced-edit\n", "utf8");
      fs.writeFileSync(path.join(snapDir, "tracked.txt"), "container-edit\n", "utf8");
      proc.emit("close", 0, null);
    });
    return proc;
  };
  const conflictSb = new EosContainerSandbox(repoRoot, {
    runDockerSync: makeDockerSyncMock(),
    spawnDocker: mockSpawnConflict,
  });
  const conflictReport = await conflictSb.run({
    worktreePath: wtRel,
    command: "node",
    applyChanges: true,
  });
  assert.equal(conflictReport.status, "CONFLICT");
  assert.deepEqual(conflictReport.conflicts, ["tracked.txt"]);

  // 4. Spawn error, timeout kill path, and non-zero exit
  const mockSpawnTimeout = () => {
    const proc = new EventEmitter();
    proc.kill = (sig) => {
      if (sig === "SIGTERM") {
        setTimeout(() => proc.emit("close", null, "SIGTERM"), 10);
      }
    };
    return proc;
  };
  const timeoutReport = await new EosContainerSandbox(repoRoot, {
    runDockerSync: makeDockerSyncMock(),
    spawnDocker: mockSpawnTimeout,
  }).run({ worktreePath: wtRel, command: "sleep", commandArgs: ["10"], timeoutMs: 1000 });
  assert.equal(timeoutReport.status, "TIMED_OUT");
  assert.match(timeoutReport.error || "", /exceeded its time limit/);

  const mockSpawnErr = () => {
    const proc = new EventEmitter();
    proc.kill = () => {};
    queueMicrotask(() => proc.emit("error", new Error("spawn ENOENT")));
    return proc;
  };
  const errReport = await new EosContainerSandbox(repoRoot, {
    runDockerSync: makeDockerSyncMock(),
    spawnDocker: mockSpawnErr,
  }).run({ worktreePath: wtRel, command: "node" });
  assert.equal(errReport.status, "FAILED");
  assert.match(errReport.error || "", /Could not start Docker/);

  const mockSpawnFail = () => {
    const proc = new EventEmitter();
    proc.kill = () => {};
    queueMicrotask(() => proc.emit("close", 2, null));
    return proc;
  };
  const failSb = new EosContainerSandbox(repoRoot, {
    runDockerSync: makeDockerSyncMock(),
    spawnDocker: mockSpawnFail,
  });
  const failReport = await failSb.run({ worktreePath: wtRel, command: "npm", commandArgs: ["test"] });
  assert.equal(failReport.success, false);
  assert.equal(failReport.status, "COMMAND_FAILED");
  assert.equal(failReport.appliedChanges, false);

  // Digest mismatch & outside repo check
  await assert.rejects(
    () =>
      new EosContainerSandbox(repoRoot, {
        runDockerSync: makeDockerSyncMock({ repoDigests: [`node@sha256:${"b".repeat(64)}`] }),
      }).run({ worktreePath: wtRel, command: "node" }),
    /digest is not present/,
  );

  // Input guards & unregistered folder guard on run()
  const nonWtDir = path.join(repoRoot, "not-a-wt");
  fs.mkdirSync(nonWtDir);
  await assert.rejects(() => sbRun.run({ worktreePath: ".", command: "node" }), /non-primary worktree/);
  await assert.rejects(() => sbRun.run({ worktreePath: "..", command: "node" }), /non-primary worktree/);
  await assert.rejects(() => sbRun.run({ worktreePath: "not-a-wt", command: "node" }), /registered Git worktree/);
  await assert.rejects(() => sbRun.run({ worktreePath: wtRel, command: "-bad" }), /Provide an executable/);
  await assert.rejects(
    () => sbRun.run({ worktreePath: wtRel, command: "node", commandArgs: ["a".repeat(130 * 1024)] }),
    /exceed 128 KiB/,
  );
  await assert.rejects(() => sbRun.run({ worktreePath: wtRel, command: "node", timeoutMs: 100 }), /timeout must be/);
  await assert.rejects(() => sbRun.run({ worktreePath: 123, command: "node" }), /worktree path must be a string/);
  await assert.rejects(() => sbRun.run({ worktreePath: wtRel, command: 123 }), /must be a string/);
  await assert.rejects(() => sbRun.run({ worktreePath: wtRel, command: "node", commandArgs: [1] }), /512 strings/);
  await assert.rejects(() => sbRun.run({ worktreePath: wtRel, command: "node", applyChanges: "yes" }), /boolean/);
});

test("BDD-SANDBOX-RUNTIME-001: detects gVisor runsc runtime, validates --runtime flags, and injects --runtime=runsc", async (t) => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "eos-sb-runsc-"));
  const repoRoot = path.join(tmpRoot, "repo");
  fs.mkdirSync(repoRoot, { recursive: true });
  git(repoRoot, ["init", "--initial-branch=main"]);
  git(repoRoot, ["config", "user.name", "Sandbox Test"]);
  git(repoRoot, ["config", "user.email", "sandbox-test@example.invalid"]);
  fs.writeFileSync(path.join(repoRoot, "file.txt"), "hello\n", "utf8");
  git(repoRoot, ["add", "file.txt"]);
  git(repoRoot, ["commit", "-m", "Init"]);
  const wtRel = path.join(".worktrees", "wt-runsc");
  git(repoRoot, ["worktree", "add", "-b", "eos/sb-runsc", wtRel]);

  const prevImage = process.env.EOS_SANDBOX_IMAGE;
  process.env.EOS_SANDBOX_IMAGE = VALID_IMAGE;
  t.after(() => {
    if (prevImage === undefined) delete process.env.EOS_SANDBOX_IMAGE;
    else process.env.EOS_SANDBOX_IMAGE = prevImage;
    try {
      git(repoRoot, ["worktree", "remove", "--force", wtRel]);
    } catch {
      /* worktree already cleaned up */
    }
    fs.rmSync(tmpRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  // 1. Unit rules for resolveSandboxRuntime & detectAvailableRuntimes
  const withRunsc = new Set(["runc", "runsc"]);
  const withoutRunsc = new Set(["runc"]);
  assert.equal(resolveSandboxRuntime(undefined, withRunsc), "runc");
  assert.equal(resolveSandboxRuntime("runc", withRunsc), "runc");
  assert.equal(resolveSandboxRuntime("auto", withRunsc), "runsc");
  assert.equal(resolveSandboxRuntime("auto", withoutRunsc), "runc");
  assert.equal(resolveSandboxRuntime("runsc", withRunsc), "runsc");
  assert.throws(() => resolveSandboxRuntime("runsc", withoutRunsc), /gVisor runtime 'runsc' is not registered/);
  assert.throws(() => resolveSandboxRuntime("kvm-custom", withRunsc), /Sandbox runtime must be/);

  const detected = detectAvailableRuntimes((args) =>
    args.join(" ").includes("Runtimes") ? JSON.stringify({ runc: {}, runsc: {} }) : "",
  );
  assert.equal(detected.has("runsc"), true);

  // 2. doctor() surfaces gvisorAvailable & runtimes, run() injects --runtime=runsc
  const withRunscMock = (args) => {
    if (args.join(" ").includes("{{json .Runtimes}}")) return JSON.stringify({ runc: {}, runsc: {} });
    return makeDockerSyncMock()(args);
  };
  const captured = [];
  const sbGvisor = new EosContainerSandbox(repoRoot, {
    runDockerSync: withRunscMock,
    spawnDocker: (_cmd, args) => {
      captured.push(args);
      const proc = new EventEmitter();
      proc.kill = () => {};
      queueMicrotask(() => proc.emit("close", 0, null));
      return proc;
    },
  });
  const doc = sbGvisor.doctor();
  assert.equal(doc.ready, true);
  assert.equal(doc.gvisorAvailable, true);
  assert.deepEqual(doc.runtimes, ["runc", "runsc"]);

  const repRunsc = await sbGvisor.run({ worktreePath: wtRel, command: "node", runtime: "runsc" });
  assert.equal(repRunsc.success, true);
  assert.equal(repRunsc.runtime, "runsc");
  assert.ok(captured[0].includes("--runtime=runsc"));

  // CLI validation rejects invalid --runtime with exit 2
  const cliBad = spawnSync(
    process.execPath,
    [path.join(process.cwd(), "bin/eos.mjs"), "sandbox", "run", wtRel, "--runtime", "bogus", "--", "node"],
    { encoding: "utf8", cwd: repoRoot },
  );
  assert.equal(cliBad.status, 2);
  assert.match(cliBad.stderr || "", /runc.*runsc.*auto/);
});
