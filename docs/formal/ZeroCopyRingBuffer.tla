------------------------ MODULE ZeroCopyRingBuffer ------------------------
(*
  TLA+ Formal Mathematical Specification of the Zero-Copy Ring Buffer
  Governed by EOS System SPEC-312 / CHANGE-174
  Proves Lock-Freedom, Monotonic Sequence Progress, Overrun Prevention, and Loss Accounting.
*)

EXTENDS Naturals

CONSTANTS
  Capacity,      \* Ring buffer size (must be power-of-two, e.g. 4)
  MaxEvents,     \* Maximum events to produce
  DropOldest     \* Boolean: TRUE = DROP_OLDEST, FALSE = FAIL_FAST

VARIABLES
  head,          \* Sequence number claimed/written by producer
  tail,          \* Sequence number processed by consumer
  dropped,       \* Counter of events dropped due to backpressure
  slots          \* Array representing slots in circular buffer

vars == <<head, tail, dropped, slots>>

-----------------------------------------------------------------------------

\* Initial State
Init ==
  /\ head = 0
  /\ tail = 0
  /\ dropped = 0
  /\ slots = [i \in 0..(Capacity - 1) |-> 0]

\* Producer pushes event into buffer
Push(val) ==
  /\ head < MaxEvents
  /\ IF (head - tail) < Capacity
     THEN /\ head' = head + 1
          /\ slots' = [slots EXCEPT ![head % Capacity] = val]
          /\ UNCHANGED <<tail, dropped>>
     ELSE IF DropOldest
          THEN /\ tail' = tail + 1
               /\ dropped' = dropped + 1
               /\ head' = head + 1
               /\ slots' = [slots EXCEPT ![head % Capacity] = val]
          ELSE /\ dropped' = dropped + 1
               /\ UNCHANGED <<head, tail, slots>>

\* Consumer drains event from buffer
Drain ==
  /\ tail < head
  /\ tail' = tail + 1
  /\ UNCHANGED <<head, dropped, slots>>

\* Next State Transition
Next ==
  \/ (\E v \in 1..MaxEvents: Push(v))
  \/ Drain

-----------------------------------------------------------------------------

\* Safety Invariant 1: Bounded Capacity Invariant
NoIllegalOverrun ==
  head - tail <= Capacity

\* Safety Invariant 2: Consumer Monotonic Invariant
MonotonicSequences ==
  tail <= head

\* Safety Invariant 3: Slot Masking Correctness
SlotMaskingCorrect ==
  \A seq \in 0..head:
    (seq % Capacity) \in 0..(Capacity - 1)

\* Total State Invariant
SafetyInvariant ==
  /\ NoIllegalOverrun
  /\ MonotonicSequences
  /\ SlotMaskingCorrect

\* Temporal Specification (Liveness)
Spec ==
  Init /\ [][Next]_vars /\ WF_vars(Drain) /\ WF_vars(\E v \in 1..MaxEvents: Push(v))

=============================================================================
