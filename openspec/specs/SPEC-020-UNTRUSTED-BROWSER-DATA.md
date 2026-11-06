# BASE SPECIFICATION: UNTRUSTED BROWSER DATA (SPEC-020)

## 1. Scope
Governs rendering and recovery of data originating from user input, browser storage, URL parameters, and API responses in the EOS landing page and interactive control plane.

## 2. Requirements (EARS)
- **UBIQUITOUS**: THE SYSTEM SHALL treat user-controlled and externally sourced values as untrusted. Dynamic values inserted into the DOM SHALL use `textContent` or context-appropriate encoding; dynamic attribute and style values SHALL be validated against their intended context.
- **EVENT-DRIVEN**: WHEN a user saves text containing HTML markup in a browser-backed feature, THE SYSTEM SHALL display that text as inert content and SHALL NOT execute it as markup or script.
- **ERROR-DRIVEN**: IF a browser-storage record is malformed or has an unexpected shape, THEN THE SYSTEM SHALL discard the invalid record, retain valid records where possible, and continue rendering with safe defaults without an uncaught exception.
- **UBIQUITOUS**: THE SYSTEM SHALL preserve its zero-runtime-dependency browser architecture while applying these protections.

## 3. Invariants
- Browser-storage contents are untrusted input and may be malformed or attacker-controlled.
- HTML encoding is applied at the DOM rendering boundary, not to stored canonical values.
- Existing valid user text remains readable and is not silently rewritten.
