#!/usr/bin/env node
/**
 * README Link Checker — validate links in markdown files.
 *
 * Big Tech standard (lychee link checker, markdown-link-check): scan markdown
 * files for links and verify they point to existing files (relative links) or
 * valid URLs (absolute links). For absolute links, only checks the format
 * (no network requests — stays hermetic per Law VII).
 *
 * Usage:
 *   node scripts/link-checker.mjs
 *   npm run links:check
 *
 * Zero external dependencies (Law V).
 */

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const TARGET_FILES = ["README.md", "CONTRIBUTING.md", "SECURITY.md"];

const violations = [];
let checked = 0;

for (const file of TARGET_FILES) {
  const filePath = path.join(root, file);
  if (!fs.existsSync(filePath)) continue;

  const content = fs.readFileSync(filePath, "utf8");
  // Match [text](url) — exclude image links ![alt](url) and code blocks
  const linkRegex = /(?<!!)\[([^\]]*)\]\(([^)]+)\)/g;
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    const [, , url] = match;
    checked++;

    // Skip anchor-only links (#section)
    if (url.startsWith("#")) continue;

    // Skip absolute URLs (http/https) — only validate format
    if (url.startsWith("http://") || url.startsWith("https://")) {
      try {
        new URL(url);
      } catch {
        violations.push(`${file}: invalid URL "${url}"`);
      }
      continue;
    }

    // Skip mailto: links
    if (url.startsWith("mailto:")) continue;

    // Relative file link — check if file exists
    const linkPath = url.split("#")[0].split("?")[0]; // strip anchor and query
    const resolved = path.resolve(path.dirname(filePath), linkPath);

    if (!fs.existsSync(resolved)) {
      violations.push(`${file}: broken relative link "${url}" → ${path.relative(root, resolved)}`);
    }
  }
}

console.log("======================================================================");
console.log(" EOS MARKDOWN LINK CHECKER");
console.log("======================================================================");
console.log(`  Files: ${TARGET_FILES.join(", ")}`);
console.log(`  Links checked: ${checked}`);

if (violations.length === 0) {
  console.log(" PASS — All markdown links are valid.");
  console.log("======================================================================");
  process.exit(0);
}

console.error(`\n FAIL — ${violations.length} broken link(s):`);
for (const v of violations) console.error(`  ${v}`);
console.error("\nFix the links above. Absolute URLs are format-validated only (no network check).");
process.exit(1);
