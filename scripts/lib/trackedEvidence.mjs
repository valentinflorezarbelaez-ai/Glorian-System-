import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function snapshotTrackedEvidence(root) {
  const names = execFileSync("git", ["ls-files", "-z", "--", "docs/evidence"], { cwd: root, encoding: "utf8" });
  const snapshot = new Map();
  for (const name of names.split("\0").filter(Boolean)) {
    const file = path.join(root, name);
    const stat = fs.lstatSync(file, { throwIfNoEntry: false });
    if (!stat) {
      snapshot.set(name, null);
    } else if (stat.isSymbolicLink()) {
      snapshot.set(name, `link:${fs.readlinkSync(file)}`);
    } else {
      snapshot.set(name, createHash("sha256").update(fs.readFileSync(file)).digest("hex"));
    }
  }
  return snapshot;
}

export function assertTrackedEvidenceUnchanged(before, after) {
  const names = new Set([...before.keys(), ...after.keys()]);
  const changed = [...names].filter((name) => before.get(name) !== after.get(name));
  if (changed.length) throw new Error(`Tracked evidence changed during verification:\n${changed.join("\n")}`);
}
