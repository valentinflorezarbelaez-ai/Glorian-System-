/**
 * src/core/eosNumericContractGuards.ts
 * Shared Layer-0 Numeric & String Precondition Helpers (`CHANGE-128`).
 * Zero external runtime dependencies (EOS Law V).
 */

import { assertPrecondition } from "./eosKernelPrimitives.ts";

export function pickDefined<T>(value: T | undefined, fallback: T): T {
  return value === undefined ? fallback : value;
}

export function pickNonEmptyString(value: string | undefined, fallback: string): string {
  if (value === undefined) return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

export function assertFinitePositive(value: number, name: string): number {
  assertPrecondition(Number.isFinite(value) && value > 0, `${name} must be > 0.`);
  return value;
}

export function assertFiniteNonNegative(value: number, name: string): number {
  assertPrecondition(Number.isFinite(value) && value >= 0, `${name} must be >= 0.`);
  return value;
}

export function assertFiniteMin(value: number, min: number, message: string): number {
  assertPrecondition(Number.isFinite(value) && value >= min, message);
  return value;
}

export function assertFiniteGreaterThan(value: number, lower: number, message: string): number {
  assertPrecondition(Number.isFinite(value) && value > lower, message);
  return value;
}

export function assertIntMin(value: number, min: number, name: string): number {
  assertPrecondition(Number.isInteger(value) && value >= min, `${name} must be integer >= ${min}.`);
  return value;
}

export function assertClosedRange(value: number, min: number, max: number, message: string): number {
  assertPrecondition(Number.isFinite(value) && value >= min && value <= max, message);
  return value;
}

export function assertHalfOpenRightRange(
  value: number,
  minExclusive: number,
  maxInclusive: number,
  message: string,
): number {
  assertPrecondition(Number.isFinite(value) && value > minExclusive && value <= maxInclusive, message);
  return value;
}

export function assertOpenRange(value: number, minExclusive: number, maxExclusive: number, message: string): number {
  assertPrecondition(Number.isFinite(value) && value > minExclusive && value < maxExclusive, message);
  return value;
}

export function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function round12(value: number): number {
  return Math.round(value * 1e12) / 1e12;
}
