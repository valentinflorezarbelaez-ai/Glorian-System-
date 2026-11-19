export function printBanner(packageMetadata, args = process.argv) {
  if (args && (args.includes("--json") || args.includes("--sarif"))) {
    return;
  }
  console.log("======================================================================");
  console.log(` GLORIAN SYSTEM v${packageMetadata.version} — SOVEREIGN CONTROL PLANE & ENGINEERING ENGINE`);
  console.log(" Local checks · drafts · repository tools · bounded sandbox");
  console.log("======================================================================");
}
