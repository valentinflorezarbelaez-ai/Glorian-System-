import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function markdownFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...markdownFiles(full));
    } else if (entry.name.endsWith(".md")) {
      files.push(full);
    }
  }
  return files;
}

test("Docs consistency: Markdown links are repository-relative, never local absolute paths", () => {
  const files = [
    path.join(projectRoot, "README.md"),
    path.join(projectRoot, "CONTRIBUTING.md"),
    path.join(projectRoot, "SECURITY.md"),
    path.join(projectRoot, "ARCHITECTURE-S0.md"),
    ...markdownFiles(path.join(projectRoot, "docs"))
  ];

  for (const file of files) {
    const rel = path.relative(projectRoot, file).replace(/\\/g, "/");
    const content = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(
      content,
      /file:\/\/\/[A-Za-z]:[\\/]/,
      `${rel} must use repository-relative links, not file:/// absolute paths`
    );
    // Intake, plan, and task records may cite a local target workspace; published docs must not.
    const published =
      !rel.startsWith("docs/") || rel.startsWith("docs/releases/") || rel.startsWith("docs/operations/");
    if (!published) continue;
    assert.doesNotMatch(content, /C:\\Users\\/i, `${rel} must not embed local Windows paths`);
  }
});

test("Docs consistency: root documentation links resolve", () => {
  const rootFiles = ["README.md", "CONTRIBUTING.md", "SECURITY.md", "ARCHITECTURE-S0.md"].map((name) =>
    path.join(projectRoot, name)
  );

  for (const file of rootFiles) {
    const rel = path.relative(projectRoot, file).replace(/\\/g, "/");
    const content = fs.readFileSync(file, "utf8");
    for (const [, target] of content.matchAll(/\]\(([^)\s]+)\)/g)) {
      if (/^(?:https?:|mailto:|#)/.test(target)) continue;
      const clean = target.split("#")[0];
      if (!clean) continue;
      const resolved = path.resolve(path.dirname(file), decodeURI(clean));
      assert.ok(fs.existsSync(resolved), `${rel} links to missing file: ${target}`);
    }
  }
});

test("Docs consistency: README avoids hard-coded counters that drift", () => {
  const readme = fs.readFileSync(path.join(projectRoot, "README.md"), "utf8");
  assert.doesNotMatch(readme, /\b\d+\s+(?:test\s+)?suites\b/i, "README must not hard-code suite counts");
});
