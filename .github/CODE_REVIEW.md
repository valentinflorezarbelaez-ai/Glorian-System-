# Code Review Guidelines

<!-- Big Tech standard (Google Eng Practices, Meta code review guide):
     every PR must be reviewed against a shared checklist so quality is
     consistent regardless of who reviews. -->

## Pre-Review Checklist

- [ ] PR title follows Conventional Commits (`feat(core): ...`)
- [ ] PR description includes the "Type", "Verification", and "Breaking Changes" sections
- [ ] All status checks pass (typecheck, lint, format, tests, coverage)
- [ ] No merge conflicts with `main`

## Review Checklist

### Architecture & Layer Isolation

- [ ] `src/core/` modules only import from `node:` builtins or other `src/core/` files
- [ ] No new runtime dependencies added to `package.json` `dependencies` (Law V)
- [ ] No circular imports introduced
- [ ] Module follows the hexagonal pattern (domain logic isolated from I/O)

### Type Safety

- [ ] No `any` types (use proper types or generics)
- [ ] No `@ts-ignore` without a justified comment explaining why
- [ ] All exported functions have JSDoc with `@param` and `@returns`
- [ ] Optional chaining (`?.`) and nullish coalescing (`??`) used appropriately

### Security

- [ ] No plaintext secrets, tokens, or API keys in code or config
- [ ] External inputs are validated, bounded, and sanitized (Law VI)
- [ ] No `eval()`, `Function()`, or `child_process.exec` with user input
- [ ] Error messages don't leak internal paths or stack traces

### Testing

- [ ] Tests are deterministic (no `Date.now()`, `Math.random()`, or network calls)
- [ ] New `src/core/` modules have a corresponding `test/*.test.mjs` file
- [ ] Test names follow BDD `Given-When-Then` or `BDD-XXX` convention
- [ ] Edge cases covered: empty input, null, overflow, concurrent access

### Performance

- [ ] No unnecessary allocations in hot paths (use pre-allocated buffers)
- [ ] No synchronous I/O in async functions
- [ ] Module size within the budget (800 lines default, grandfathered exceptions OK)
- [ ] No O(n²) or worse algorithms where O(n log n) or better exists

### Determinism (Law VII)

- [ ] Tests use seeded PRNGs, not `Math.random()`
- [ ] Time-dependent logic uses injectable clocks, not `Date.now()`
- [ ] No `setTimeout` with hardcoded values in test assertions
- [ ] Generous sanity ceilings, not tight timing budgets

## Review Etiquette

- Be kind. Critique the code, not the author.
- Explain _why_, not just _what_. "Prefer `?.` to avoid null deref" > "Use optional chaining."
- If you request a change, suggest the fix in a code block.
- Distinguish blocking issues from suggestions: use "Blocking:" and "Nit:" prefixes.
- Approve when the only remaining comments are nits.
