import { EosCuckooFilterCore } from "../../src/core/eosCuckooFilterCore.ts";

const HANDLERS = {};

async function cmd_cuckoo_demo(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");

  // Create Cuckoo Filter for 1,000 items
  const filter = new EosCuckooFilterCore({ capacity: 1000, fingerprintBits: 8 });

  // Insert items
  const items = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta"];
  for (const item of items) {
    filter.insert(item);
  }

  const alphaPresent = filter.contains("alpha");
  const uninsertedPresent = filter.contains("non_existent_key_xyz");

  // Test deletion
  const deleted = filter.delete("beta");
  const betaAfterDelete = filter.contains("beta");
  const alphaAfterDelete = filter.contains("alpha");

  // Test serialization round-trip
  const serialized = filter.serialize();
  const restored = EosCuckooFilterCore.deserialize(serialized);
  const restoredContainsAlpha = restored.contains("alpha");
  const restoredContainsBeta = restored.contains("beta");

  const stats = filter.stats();

  const report = {
    stats,
    itemsInserted: items.length,
    alphaPresent,
    uninsertedPresent,
    deletedBeta: deleted,
    betaAfterDelete,
    alphaAfterDelete,
    serializedSizeBytes: serialized.length,
    restoredContainsAlpha,
    restoredContainsBeta,
  };

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN LAYER-0 CUCKOO FILTER DEMO (SPEC-231)`);
  console.log(`===============================================================`);
  console.log(`  Target Capacity        : ${stats.capacity} items`);
  console.log(`  Bucket Count           : ${stats.bucketCount} (4 slots/bucket)`);
  console.log(`  Fingerprint Size       : ${stats.fingerprintBits} bits`);
  console.log(`  Current Element Count  : ${stats.count}`);
  console.log(`  Current Load Factor    : ${(stats.loadFactor * 100).toFixed(2)}%`);
  console.log(`  Memory Footprint       : ${stats.memoryBytes} bytes`);
  console.log(`  Contains("alpha")      : ${alphaPresent} (expected: true)`);
  console.log(`  Delete("beta")         : ${deleted} (success)`);
  console.log(`  Contains("beta") after : ${betaAfterDelete} (expected: false)`);
  console.log(`  Serialization Roundtrip: ${serialized.length} bytes -> restored: ${restoredContainsAlpha}`);
  console.log(`===============================================================\n`);
}

async function cmd_cuckoo_insert(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");
  const keyArg = args.find((a) => !a.startsWith("--") && a !== "cuckoo:insert");
  const item = keyArg || "sample_ledger_entry_001";

  const filter = new EosCuckooFilterCore({ capacity: 500 });
  const result = filter.insert(item);
  const present = filter.contains(item);

  const report = {
    item,
    insertSuccess: result.success,
    kickedCount: result.kickedCount,
    contains: present,
    stats: filter.stats(),
  };

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN CUCKOO FILTER INSERT (SPEC-231)`);
  console.log(`===============================================================`);
  console.log(`  Item Key               : "${item}"`);
  console.log(`  Insert Success         : ${result.success}`);
  console.log(`  Cuckoo Kicks           : ${result.kickedCount}`);
  console.log(`  Membership Verified    : ${present}`);
  console.log(`===============================================================\n`);
}

async function cmd_cuckoo_query(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");
  const keyArg = args.find((a) => !a.startsWith("--") && a !== "cuckoo:query");
  const item = keyArg || "sample_ledger_entry_001";

  const filter = new EosCuckooFilterCore({ capacity: 500 });
  filter.insert(item);
  const present = filter.contains(item);
  const absent = filter.contains(`${item}_not_found`);

  const report = {
    queriedItem: item,
    containsInserted: present,
    containsAbsent: absent,
  };

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN CUCKOO FILTER QUERY (SPEC-231)`);
  console.log(`===============================================================`);
  console.log(`  Query Item             : "${item}"`);
  console.log(`  Contains Item          : ${present}`);
  console.log(`  Contains Absent Item   : ${absent}`);
  console.log(`===============================================================\n`);
}

HANDLERS["cuckoo:demo"] = cmd_cuckoo_demo;
HANDLERS["cuckoo:insert"] = cmd_cuckoo_insert;
HANDLERS["cuckoo:query"] = cmd_cuckoo_query;

export async function handleCuckooCommands(command, commandContext) {
  const handler = HANDLERS[command];
  if (!handler) return false;
  await handler(commandContext);
  return true;
}
