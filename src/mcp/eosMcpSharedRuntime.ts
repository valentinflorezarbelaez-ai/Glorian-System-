/**
 * Shared MCP runtime singletons — used by god-file residuals and Phase modules.
 * Keeps stateful tools coherent across SPEC-155 extracts (WITHIN_TESTED_SCOPE).
 */

import { EosTailBasedTraceSampler } from "../core/eosTailBasedTraceSampler.ts";

export const globalTraceSampler = new EosTailBasedTraceSampler();
