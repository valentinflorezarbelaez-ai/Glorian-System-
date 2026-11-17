/**
 * Glorian System — Universal Reverse Engineering Anything (REA) Engine Types
 * Governed by SPEC-327 / CHANGE-189 / ADR-189-001..003
 */

export type BinaryFormat = "ASAR" | "WASM" | "ELF" | "PE_COFF" | "JS_BUNDLE" | "UNKNOWN";

export interface FormatDetectionResult {
  format: BinaryFormat;
  magic: string;
  architecture?: string;
  details: Record<string, unknown>;
}

export interface AsarFileEntry {
  path: string;
  size: number;
  offset: number;
  unpacked?: boolean;
}

export interface AsarExtractionResult {
  headerSize: number;
  fileCount: number;
  totalBytes: number;
  files: AsarFileEntry[];
  virtualTree: Record<string, unknown>;
}

export interface JsModuleInfo {
  id: string | number;
  size: number;
  exportCount: number;
  imports: string[];
}

export interface JsBundleAnalysis {
  moduleCount: number;
  modules: JsModuleInfo[];
  identifierFrequencies: Record<string, number>;
  detectedFrameworks: string[];
}

export interface SectionEntropy {
  sectionIndex: number;
  offset: number;
  size: number;
  entropy: number; // 0.0 to 8.0
  isPacked: boolean; // entropy >= 7.2
}

export interface DisassemblyInstruction {
  address: number;
  mnemonic: string;
  operands: string;
}

export type TerminatorType = "JUMP" | "BRANCH" | "CALL" | "RETURN" | "FALLTHROUGH";

export interface BasicBlock {
  id: string;
  startAddress: number;
  endAddress: number;
  instructions: DisassemblyInstruction[];
  predecessors: string[];
  successors: string[];
  terminatorType: TerminatorType;
}

export interface ControlFlowGraph {
  entryBlockId: string;
  blockCount: number;
  edgeCount: number;
  cyclomaticComplexity: number;
  blocks: BasicBlock[];
}

export interface ReverseEngineeringAuditReceipt {
  status: "VERIFIED" | "FAILED";
  formatsDetected: BinaryFormat[];
  asarExtractionVerified: boolean;
  entropyAnalysisVerified: boolean;
  cfgSynthesisVerified: boolean;
  zeroHostContamination: boolean;
  timestamp: string;
  sha256?: string;
}
