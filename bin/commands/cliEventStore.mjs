/**
 * EOS SYSTEM — BITEMPORAL EVENT STORE & CDC CLI (Layer 0)
 * Governed by SPEC-281, CHANGE-143
 */

import fs from "node:fs";
import path from "node:path";
import { EosBitemporalEventStore } from "../../src/core/eosBitemporalEventStore.ts";

export const HANDLERS = {};

const defaultStore = new EosBitemporalEventStore();

function loadSampleStream(root) {
  const samplePath = path.join(root, "templates/events/sample-bitemporal-event-stream.json");
  if (fs.existsSync(samplePath)) {
    const raw = JSON.parse(fs.readFileSync(samplePath, "utf8"));
    if (Array.isArray(raw.events)) {
      for (const ev of raw.events) {
        defaultStore.appendEvent({
          streamId: raw.streamId,
          eventType: ev.eventType,
          payload: ev.payload,
          validTime: ev.validTime,
          idempotencyKey: ev.idempotencyKey,
        });
      }
    }
  }
}

async function cmd_toolchain_events_append(commandContext) {
  const { args, root, printBanner } = commandContext;
  const isJson = args.includes("--json");
  if (!isJson) printBanner();
  const fileArg =
    args.slice(1).find((a) => !a.startsWith("-")) || "templates/events/sample-bitemporal-event-stream.json";

  const filePath = path.isAbsolute(fileArg) ? fileArg : path.join(root, fileArg);
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found at ${filePath}`);
    process.exitCode = 1;
    return;
  }

  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const appended = [];

  if (Array.isArray(raw.events)) {
    for (const ev of raw.events) {
      const res = defaultStore.appendEvent({
        streamId: raw.streamId,
        eventType: ev.eventType,
        payload: ev.payload,
        validTime: ev.validTime,
        idempotencyKey: ev.idempotencyKey,
      });
      appended.push(res);
    }
  } else if (raw.streamId && raw.eventType) {
    const res = defaultStore.appendEvent(raw);
    appended.push(res);
  }

  const receipt = defaultStore.generateReceipt();

  if (isJson) {
    console.log(JSON.stringify({ appendedCount: appended.length, receipt, events: appended }, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN BITEMPORAL EVENT STORE (SPEC-281)`);
  console.log(`===============================================================`);
  console.log(`  Target Stream        : ${raw.streamId || "unknown"}`);
  console.log(`  Events Appended      : ${appended.length}`);
  console.log(`  Total Store Events   : ${receipt.totalEvents}`);
  console.log(`  Total Active Streams : ${receipt.totalStreams}`);
  console.log(`  Store Receipt SHA256 : sha256:${receipt.sha256}`);
  console.log(`===============================================================\n`);
}

async function cmd_toolchain_events_replay(commandContext) {
  const { args, root, printBanner } = commandContext;
  const isJson = args.includes("--json");
  if (!isJson) printBanner();
  const streamId = args.slice(1).find((a) => !a.startsWith("-")) || "account-vault-88992";

  // Pre-load sample if empty
  if (defaultStore.getEvents(streamId).length === 0) {
    loadSampleStream(root);
  }

  const asOfArg = args.find((a) => a.startsWith("--as-of="));
  const asOfValidTime = asOfArg ? asOfArg.slice("--as-of=".length) : undefined;

  const state = defaultStore.replayEvents(streamId, { asOfValidTime });

  if (isJson) {
    console.log(JSON.stringify({ streamId, asOfValidTime: asOfValidTime || "LATEST", state }, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN DETERMINISTIC EVENT REPLAY (SPEC-281)`);
  console.log(`===============================================================`);
  console.log(`  Stream ID            : ${streamId}`);
  console.log(`  As-Of Valid Time     : ${asOfValidTime || "LATEST (HEAD)"}`);
  console.log(`  Reconstructed State  :`);
  console.log(JSON.stringify(state, null, 2));
  console.log(`===============================================================\n`);
}

async function cmd_toolchain_events_cdc(commandContext) {
  const { args, root, printBanner } = commandContext;
  const isJson = args.includes("--json");
  if (!isJson) printBanner();
  const streamId = args.slice(1).find((a) => !a.startsWith("-")) || "account-vault-88992";

  if (defaultStore.getEvents(streamId).length === 0) {
    loadSampleStream(root);
  }

  const cdcStream = defaultStore.getChangeStream(streamId);

  if (isJson) {
    console.log(JSON.stringify(cdcStream, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN CHANGE DATA CAPTURE (CDC) STREAM (SPEC-281)`);
  console.log(`===============================================================`);
  console.log(`  Stream ID            : ${streamId}`);
  console.log(`  Mutations Captured   : ${cdcStream.length}`);
  for (const c of cdcStream) {
    console.log(`  [SEQ ${c.sequenceNumber}] ${c.operation} (${c.eventType}) @ ${c.timestamp}`);
    if (Object.keys(c.diff).length > 0) {
      console.log(`    Diff: ${JSON.stringify(c.diff)}`);
    }
  }
  console.log(`===============================================================\n`);
}

HANDLERS["toolchain:events:append"] = cmd_toolchain_events_append;
HANDLERS["toolchain:events:replay"] = cmd_toolchain_events_replay;
HANDLERS["toolchain:events:cdc"] = cmd_toolchain_events_cdc;

export async function handleEventStoreCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (handler) {
    await handler(commandContext);
    return true;
  }
  return false;
}
