#!/usr/bin/env node
/**
 * Thin Cursor adapter — delegates to scripts/eos-ide-session-hook.mjs (SPEC-153).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..", "..");
const shared = path.join(projectRoot, "scripts", "eos-ide-session-hook.mjs");
const eventName = process.argv[2] || "sessionStart";

let raw = "";
try {
  raw = fs.readFileSync(0, "utf8");
} catch {
  raw = "";
}

const proc = spawnSync(process.execPath, [shared, "cursor", eventName], {
  cwd: projectRoot,
  input: raw,
  encoding: "utf8",
  timeout: 15000,
  env: { ...process.env, EOS_PROJECT_ROOT: projectRoot }
});

if (proc.stdout) process.stdout.write(proc.stdout);
else {
  process.stdout.write(
    JSON.stringify({
      permission: "deny",
      decision: "deny",
      agent_message: proc.stderr || "Cursor session hook failed",
      user_message: proc.stderr || "Cursor session hook failed"
    }) + "\n"
  );
}
