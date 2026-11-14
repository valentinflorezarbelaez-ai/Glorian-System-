/**
 * SPEC-240 / CHANGE-121 — Layer-0 Property-Based Testing & Counterexample Shrinking Types.
 * Zero external runtime dependencies (EOS Law V).
 */

export interface NumericPropertyOptions {
  readonly name: string;
  readonly seed?: number;
  readonly runs?: number;
  readonly min?: number;
  readonly max?: number;
  readonly maxShrinkSteps?: number;
  readonly predicate: (value: number) => boolean;
}

export interface StringPropertyOptions {
  readonly name: string;
  readonly seed?: number;
  readonly runs?: number;
  readonly maxLength?: number;
  readonly alphabet?: string;
  readonly maxShrinkSteps?: number;
  readonly predicate: (value: string) => boolean;
}

export interface PropertyCheckResult<T> {
  readonly name: string;
  readonly passed: boolean;
  readonly runsExecuted: number;
  readonly seed: number;
  readonly initialFailingInput?: T;
  readonly minimalCounterexample?: T;
  readonly shrinkStepsTaken: number;
  readonly resultDigestSha256: string;
}

export interface PropertySuiteReport {
  readonly seed: number;
  readonly totalProperties: number;
  readonly passedProperties: number;
  readonly allPassed: boolean;
  readonly results: ReadonlyArray<PropertyCheckResult<number | string>>;
  readonly suiteDigestSha256: string;
}
