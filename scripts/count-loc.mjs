import fs from "node:fs";
import path from "node:path";

const EXCLUDED_DIRS = new Set([".git", "node_modules", ".gemini", "dist", "coverage"]);
const EXTENSIONS = new Set([".ts", ".js", ".mjs", ".html", ".css", ".json", ".md", ".go", ".rs"]);

const stats = {
  byExt: {},
  byDir: {},
  totalFiles: 0,
  totalLines: 0,
  codeLines: 0,
  docLines: 0,
  configLines: 0,
};

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name));
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (!EXTENSIONS.has(ext)) continue;
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(process.cwd(), fullPath).replace(/\\/g, "/");
      const topDir = relPath.includes("/") ? relPath.split("/")[0] : "root";

      const content = fs.readFileSync(fullPath, "utf8");
      const lines = content.split("\n").length;

      stats.totalFiles++;
      stats.totalLines += lines;
      stats.byExt[ext] = (stats.byExt[ext] || 0) + lines;
      stats.byDir[topDir] = (stats.byDir[topDir] || 0) + lines;

      if ([".ts", ".js", ".mjs", ".go", ".rs"].includes(ext)) {
        stats.codeLines += lines;
      } else if ([".md"].includes(ext)) {
        stats.docLines += lines;
      } else {
        stats.configLines += lines;
      }
    }
  }
}

walk(process.cwd());

console.log("=== RESUMEN TOTAL DE LÍNEAS DE CÓDIGO EOS SYSTEM ===");
console.log("Total Archivos:", stats.totalFiles);
console.log("Total Líneas de Todo el Proyecto:", stats.totalLines.toLocaleString());
console.log("  - Código Fuente Ejecutable (TS, JS, MJS, Go, Rust):", stats.codeLines.toLocaleString());
console.log("  - Documentación & Especificaciones (Markdown / OpenSpec / SDD):", stats.docLines.toLocaleString());
console.log("  - Frontend, Configuración y Esquemas (HTML, CSS, JSON):", stats.configLines.toLocaleString());

console.log("\n=== DESGLOSE POR DIRECTORIO PRINCIPAL ===");
Object.entries(stats.byDir)
  .sort((a, b) => b[1] - a[1])
  .forEach(([dir, count]) => {
    console.log(`- ${dir.padEnd(16)}: ${count.toLocaleString().padStart(8)} líneas`);
  });

console.log("\n=== DESGLOSE POR EXTENSIÓN ===");
Object.entries(stats.byExt)
  .sort((a, b) => b[1] - a[1])
  .forEach(([ext, count]) => {
    console.log(`- ${ext.padEnd(8)}: ${count.toLocaleString().padStart(8)} líneas`);
  });
