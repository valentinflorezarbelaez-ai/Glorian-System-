---------------- MODULE HarnessTokenEconomics ----------------
EXTENDS Integers

CONSTANTS
    MaxFilesBudget,          \* Maximum files allowed per scoped mission (e.g. 5)
    MinConfidencePct,        \* Minimum calibrated confidence to avoid Frontier escalation (e.g. 75)
    ContextRotThresholdPct   \* Context fill threshold triggering compaction alert (e.g. 70)

VARIABLES
    phase,                   \* "PLANNING", "EXECUTION", "VERIFICATION"
    activeTier,              \* "FRONTIER_OPUS", "BALANCED_SONNET", "DETERMINISTIC_LOCAL"
    forbiddenTouched,        \* BOOLEAN: whether diff touched a forbidden path
    filesTouched,            \* 0..MaxFilesBudget+1
    boundaryVerdict,         \* "ALLOW", "HARD_BLOCK"
    confidencePct,           \* 50..100
    escalatedToFrontier,     \* BOOLEAN
    prefixHasDynamicToken,   \* BOOLEAN
    cacheStable,             \* BOOLEAN
    contextFillPct,          \* 0..100
    compactionRequired       \* BOOLEAN

vars == <<phase, activeTier, forbiddenTouched, filesTouched, boundaryVerdict, confidencePct, escalatedToFrontier, prefixHasDynamicToken, cacheStable, contextFillPct, compactionRequired>>

TypeOK ==
    /\ phase \in {"PLANNING", "EXECUTION", "VERIFICATION"}
    /\ activeTier \in {"FRONTIER_OPUS", "BALANCED_SONNET", "DETERMINISTIC_LOCAL"}
    /\ forbiddenTouched \in BOOLEAN
    /\ filesTouched \in 0..(MaxFilesBudget + 1)
    /\ boundaryVerdict \in {"ALLOW", "HARD_BLOCK"}
    /\ confidencePct \in {60, 85}
    /\ escalatedToFrontier \in BOOLEAN
    /\ prefixHasDynamicToken \in BOOLEAN
    /\ cacheStable \in BOOLEAN
    /\ contextFillPct \in {40, 75}
    /\ compactionRequired \in BOOLEAN

Init ==
    /\ phase = "PLANNING"
    /\ activeTier = "FRONTIER_OPUS"
    /\ forbiddenTouched = FALSE
    /\ filesTouched = 0
    /\ boundaryVerdict = "ALLOW"
    /\ confidencePct = 85
    /\ escalatedToFrontier = FALSE
    /\ prefixHasDynamicToken = FALSE
    /\ cacheStable = TRUE
    /\ contextFillPct = 40
    /\ compactionRequired = FALSE

EvaluateBoundary(forb, count) ==
    /\ forb \in BOOLEAN
    /\ count \in {1, MaxFilesBudget + 1}
    /\ forbiddenTouched' = forb
    /\ filesTouched' = count
    /\ boundaryVerdict' = IF forb \/ count > MaxFilesBudget THEN "HARD_BLOCK" ELSE "ALLOW"
    /\ UNCHANGED <<phase, activeTier, confidencePct, escalatedToFrontier, prefixHasDynamicToken, cacheStable, contextFillPct, compactionRequired>>

TransitionMilestone(nextPhase, nextTier) ==
    /\ nextPhase \in {"PLANNING", "EXECUTION", "VERIFICATION"}
    /\ nextPhase # phase
    /\ nextTier \in {"FRONTIER_OPUS", "BALANCED_SONNET", "DETERMINISTIC_LOCAL"}
    /\ phase' = nextPhase
    /\ activeTier' = nextTier
    /\ UNCHANGED <<forbiddenTouched, filesTouched, boundaryVerdict, confidencePct, escalatedToFrontier, prefixHasDynamicToken, cacheStable, contextFillPct, compactionRequired>>

ClassifyDecision(conf) ==
    /\ conf \in {60, 85}
    /\ confidencePct' = conf
    /\ escalatedToFrontier' = (conf < MinConfidencePct)
    /\ UNCHANGED <<phase, activeTier, forbiddenTouched, filesTouched, boundaryVerdict, prefixHasDynamicToken, cacheStable, contextFillPct, compactionRequired>>

AuditCacheAndContext(dyn, fill) ==
    /\ dyn \in BOOLEAN
    /\ fill \in {40, 75}
    /\ prefixHasDynamicToken' = dyn
    /\ cacheStable' = (~dyn)
    /\ contextFillPct' = fill
    /\ compactionRequired' = (fill >= ContextRotThresholdPct)
    /\ UNCHANGED <<phase, activeTier, forbiddenTouched, filesTouched, boundaryVerdict, confidencePct, escalatedToFrontier>>

Next ==
    \/ \E forb \in BOOLEAN, c \in {1, MaxFilesBudget + 1} : EvaluateBoundary(forb, c)
    \/ \E p \in {"PLANNING", "EXECUTION", "VERIFICATION"}, t \in {"FRONTIER_OPUS", "BALANCED_SONNET", "DETERMINISTIC_LOCAL"} : TransitionMilestone(p, t)
    \/ \E conf \in {60, 85} : ClassifyDecision(conf)
    \/ \E dyn \in BOOLEAN, fill \in {40, 75} : AuditCacheAndContext(dyn, fill)

Spec == Init /\ [][Next]_vars

\* Safety Invariants
SafetyForbiddenTouchBlocks ==
    (forbiddenTouched \/ filesTouched > MaxFilesBudget) => (boundaryVerdict = "HARD_BLOCK")

SafetyLowConfidenceEscalates ==
    (confidencePct < MinConfidencePct) => escalatedToFrontier

SafetyDynamicPrefixBreaksCache ==
    prefixHasDynamicToken => (~cacheStable)

SafetyContextRotAlerts ==
    (contextFillPct >= ContextRotThresholdPct) => compactionRequired

=============================================================================
