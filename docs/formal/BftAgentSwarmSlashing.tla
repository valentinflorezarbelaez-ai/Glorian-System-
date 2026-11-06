----------------------- MODULE BftAgentSwarmSlashing -----------------------
EXTENDS Naturals, Sequences, FiniteSets

CONSTANTS TotalAgents, QuorumThreshold, InitialStake

VARIABLES
    agentStakes,
    activeVoters,
    slashedVoters,
    consensusReached,
    byzantineAttempts

vars == <<agentStakes, activeVoters, slashedVoters, consensusReached, byzantineAttempts>>

TypeOK ==
    /\ activeVoters \subseteq (1..TotalAgents)
    /\ slashedVoters \subseteq (1..TotalAgents)
    /\ consensusReached \in BOOLEAN
    /\ byzantineAttempts \in Nat

Init ==
    /\ agentStakes = [a \in 1..TotalAgents |-> InitialStake]
    /\ activeVoters = (1..TotalAgents)
    /\ slashedVoters = {}
    /\ consensusReached = FALSE
    /\ byzantineAttempts = 0

VoteConstitutional(a) ==
    /\ a \in activeVoters
    /\ agentStakes' = [agentStakes EXCEPT ![a] = agentStakes[a] + 5]
    /\ UNCHANGED <<activeVoters, slashedVoters, consensusReached, byzantineAttempts>>

SlashByzantineAgent(a) ==
    /\ a \in activeVoters
    /\ byzantineAttempts' = byzantineAttempts + 1
    /\ agentStakes' = [agentStakes EXCEPT ![a] = agentStakes[a] - 50]
    /\ activeVoters' = activeVoters \ {a}
    /\ slashedVoters' = slashedVoters \cup {a}
    /\ UNCHANGED <<consensusReached>>

DeclareConsensus ==
    /\ Cardinality(activeVoters) >= QuorumThreshold
    /\ consensusReached' = TRUE
    /\ UNCHANGED <<agentStakes, activeVoters, slashedVoters, byzantineAttempts>>

Next ==
    \/ (\E a \in activeVoters : VoteConstitutional(a))
    \/ (\E a \in activeVoters : SlashByzantineAgent(a))
    \/ DeclareConsensus

SafetyInvariant ==
    /\ activeVoters \cap slashedVoters = {}

SlashingSoundnessInvariant ==
    \A a \in slashedVoters : agentStakes[a] < InitialStake

QuorumThresholdInvariant ==
    consensusReached => (Cardinality(activeVoters) >= QuorumThreshold)

Spec == Init /\ [][Next]_vars

=============================================================================
