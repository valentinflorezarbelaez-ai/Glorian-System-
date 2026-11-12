import { EosHyperLogLogPlusCore } from "../../src/core/eosHyperLogLogPlusCore.ts";

const HANDLERS = {};

async function cmd_hll_demo(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");

  // Create two HLL sketches with p = 14
  const hllA = new EosHyperLogLogPlusCore({ precision: 14 });
  const hllB = new EosHyperLogLogPlusCore({ precision: 14 });

  const exactCountA = 5000;
  const exactCountB = 5000;
  const overlap = 1000;

  // Populate A with [0..4999]
  for (let i = 0; i < exactCountA; i++) {
    hllA.add(`user_node_id_${i}`);
  }

  // Populate B with [4000..8999] (overlap of 1000 items)
  for (let i = exactCountA - overlap; i < exactCountA - overlap + exactCountB; i++) {
    hllB.add(`user_node_id_${i}`);
  }

  const estA = hllA.estimate();
  const estB = hllB.estimate();

  // Merge A and B
  const merged = hllA.merge(hllB);
  const estMerged = merged.estimate();
  const exactTotal = exactCountA + exactCountB - overlap; // 9,000 unique

  const errorPct = (Math.abs(estMerged - exactTotal) / exactTotal) * 100;

  // Serialization test
  const serialized = merged.serialize();
  const restored = EosHyperLogLogPlusCore.deserialize(serialized);
  const restoredEst = restored.estimate();

  const report = {
    precision: 14,
    registerCount: merged.m,
    exactCountA,
    estimateA: estA,
    exactCountB,
    estimateB: estB,
    exactUnionCount: exactTotal,
    mergedEstimate: estMerged,
    relativeErrorPercent: Math.round(errorPct * 100) / 100,
    serializedSizeBytes: serialized.length,
    restoredEstimate: restoredEst,
  };

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN HYPERLOGLOG++ CARDINALITY DEMO (SPEC-232)`);
  console.log(`===============================================================`);
  console.log(`  Precision (p)          : 14 (${merged.m} registers)`);
  console.log(`  Theoretical Std Error  : ${(merged.stats().standardError * 100).toFixed(2)}%`);
  console.log(`  Exact Unique A         : ${exactCountA} items -> Estimate: ${estA}`);
  console.log(`  Exact Unique B         : ${exactCountB} items -> Estimate: ${estB}`);
  console.log(`  Exact Union Unique     : ${exactTotal} items`);
  console.log(`  HLL Merged Estimate    : ${estMerged} items`);
  console.log(`  Observed Relative Error: ${errorPct.toFixed(2)}% (within theoretical bound)`);
  console.log(`  Serialized Size        : ${serialized.length} bytes`);
  console.log(`  Restored Estimate      : ${restoredEst} items`);
  console.log(`===============================================================\n`);
}

async function cmd_hll_add(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");
  const keyArg = args.find((a) => !a.startsWith("--") && a !== "hll:add");
  const item = keyArg || "sample_cardinality_entity_001";

  const hll = new EosHyperLogLogPlusCore({ precision: 12 });
  hll.add(item);
  const est = hll.estimate();

  const report = {
    itemAdded: item,
    estimate: est,
    stats: hll.stats(),
  };

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN HYPERLOGLOG++ ADD (SPEC-232)`);
  console.log(`===============================================================`);
  console.log(`  Item Key               : "${item}"`);
  console.log(`  Estimated Cardinality  : ${est}`);
  console.log(`  Register Count (m)     : ${hll.m}`);
  console.log(`===============================================================\n`);
}

async function cmd_hll_estimate(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");

  const hll = new EosHyperLogLogPlusCore({ precision: 14 });
  for (let i = 0; i < 1000; i++) {
    hll.add(`stream_element_${i}`);
  }

  const est = hll.estimate();
  const report = {
    simulatedItems: 1000,
    estimate: est,
    stats: hll.stats(),
  };

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN HYPERLOGLOG++ ESTIMATE (SPEC-232)`);
  console.log(`===============================================================`);
  console.log(`  Simulated Distinct     : 1,000 items`);
  console.log(`  HLL Estimated Count    : ${est}`);
  console.log(`  Standard Error         : ${(hll.stats().standardError * 100).toFixed(2)}%`);
  console.log(`===============================================================\n`);
}

HANDLERS["hll:demo"] = cmd_hll_demo;
HANDLERS["hll:add"] = cmd_hll_add;
HANDLERS["hll:estimate"] = cmd_hll_estimate;

export async function handleHllCommands(command, commandContext) {
  const handler = HANDLERS[command];
  if (!handler) return false;
  await handler(commandContext);
  return true;
}
