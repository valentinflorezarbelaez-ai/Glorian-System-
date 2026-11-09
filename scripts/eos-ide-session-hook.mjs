/**
 * EOS IDE session hook (pass-through).
 * Restored after tip merge removed .cursor/hooks; fail-open for edit tooling.
 * Usage: node scripts/eos-ide-session-hook.mjs <ide> <event>
 */
const event = process.argv[3] || "unknown";
process.stdout.write(JSON.stringify({ ok: true, event, epistemic: "PASS_THROUGH" }) + "\n");
process.exit(0);
