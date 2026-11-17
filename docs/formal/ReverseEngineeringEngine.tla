---------------- MODULE ReverseEngineeringEngine ----------------
EXTENDS Naturals, Sequences, FiniteSets, TLC

CONSTANTS
    NumInstructions,    \* Total instructions in routine (e.g. 6)
    MaxBlocks           \* Max basic blocks possible (e.g. 4)

VARIABLES
    reaPhase,                   \* "INIT" | "DETECTED" | "EXTRACTED" | "ENTROPY_ANALYZED" | "CFG_BUILT" | "AUDITED"
    detectedFormat,             \* "UNKNOWN" | "ASAR" | "WASM" | "ELF" | "PE" | "JS"
    instructionsPartitioned,    \* Nat: total instructions assigned to basic blocks
    blocksCreated,              \* Nat: number of basic blocks formed
    entropyStatus               \* "UNCHECKED" | "NORMAL" | "PACKED"

vars == <<reaPhase, detectedFormat, instructionsPartitioned, blocksCreated, entropyStatus>>

Formats == {"ASAR", "WASM", "ELF", "PE", "JS"}

TypeOK ==
    /\ reaPhase \in {"INIT", "DETECTED", "EXTRACTED", "ENTROPY_ANALYZED", "CFG_BUILT", "AUDITED"}
    /\ detectedFormat \in {"UNKNOWN"} \cup Formats
    /\ instructionsPartitioned \in 0..NumInstructions
    /\ blocksCreated \in 0..MaxBlocks
    /\ entropyStatus \in {"UNCHECKED", "NORMAL", "PACKED"}

Init ==
    /\ reaPhase = "INIT"
    /\ detectedFormat = "UNKNOWN"
    /\ instructionsPartitioned = 0
    /\ blocksCreated = 0
    /\ entropyStatus = "UNCHECKED"

\* Action 1: Identify target binary format via magic bytes
DetectFormat(fmt) ==
    /\ reaPhase = "INIT"
    /\ fmt \in Formats
    /\ detectedFormat' = fmt
    /\ reaPhase' = "DETECTED"
    /\ UNCHANGED <<instructionsPartitioned, blocksCreated, entropyStatus>>

\* Action 2: Extract virtual archive or AST modules
ExtractArchive ==
    /\ reaPhase = "DETECTED"
    /\ reaPhase' = "EXTRACTED"
    /\ UNCHANGED <<detectedFormat, instructionsPartitioned, blocksCreated, entropyStatus>>

\* Action 3: Profile section Shannon entropy (normal vs packed)
ProfileEntropy(status) ==
    /\ reaPhase = "EXTRACTED"
    /\ status \in {"NORMAL", "PACKED"}
    /\ entropyStatus' = status
    /\ reaPhase' = "ENTROPY_ANALYZED"
    /\ UNCHANGED <<detectedFormat, instructionsPartitioned, blocksCreated>>

\* Action 4: Partition linear instructions into basic blocks
BuildBasicBlock(size) ==
    /\ reaPhase \in {"ENTROPY_ANALYZED", "CFG_BUILT"}
    /\ size > 0
    /\ instructionsPartitioned + size =< NumInstructions
    /\ blocksCreated < MaxBlocks
    /\ instructionsPartitioned' = instructionsPartitioned + size
    /\ blocksCreated' = blocksCreated + 1
    /\ reaPhase' = IF instructionsPartitioned + size = NumInstructions THEN "CFG_BUILT" ELSE "ENTROPY_ANALYZED"
    /\ UNCHANGED <<detectedFormat, entropyStatus>>

\* Action 5: Complete audit and generate cryptographic receipt
FinalizeAudit ==
    /\ reaPhase = "CFG_BUILT"
    /\ instructionsPartitioned = NumInstructions
    /\ reaPhase' = "AUDITED"
    /\ UNCHANGED <<detectedFormat, instructionsPartitioned, blocksCreated, entropyStatus>>

Next ==
    \/ \E fmt \in Formats : DetectFormat(fmt)
    \/ ExtractArchive
    \/ \E status \in {"NORMAL", "PACKED"} : ProfileEntropy(status)
    \/ \E size \in 1..NumInstructions : BuildBasicBlock(size)
    \/ FinalizeAudit

Spec == Init /\ [][Next]_vars

\* --- INVARIANTS ---

\* All instructions are fully accounted for in the CFG
ConservationOfInstructions ==
    (reaPhase = "AUDITED") => (instructionsPartitioned = NumInstructions)

\* Number of basic blocks cannot exceed instruction count
ValidBlockBoundaries ==
    blocksCreated =< NumInstructions

\* Zero unclassified binaries upon audit completion
ZeroUnclassifiedAudit ==
    (reaPhase = "AUDITED") => (detectedFormat # "UNKNOWN" /\ entropyStatus # "UNCHECKED")

=============================================================================
