## Summary

What changes and why. Link the governing issue or OpenSpec change.

## Verification

- [ ] `CI=true npm run verify:strict` passes locally (7/7 stages)
- [ ] `npm run test:coverage` meets the committed floor
- [ ] `npm run hygiene` passes (no new size or `any` debt)
- [ ] Affected suites were run directly and are hermetic (no fixed ports, no network, no wall-clock SLA)
- [ ] User-facing claims are backed by evidence or removed

## Risk and rollback

Blast radius, deployment notes, and how to revert safely (revert commit, not force-push).

## Evidence

Attach command output, SARIF receipt, or ledger receipt. Never include secrets or customer data.
