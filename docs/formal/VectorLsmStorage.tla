------------------------- MODULE VectorLsmStorage -------------------------
EXTENDS Integers, FiniteSets, Sequences

CONSTANTS
  Keys,
  Values,
  MaxMemTableSize,
  MaxL0Segments

VARIABLES
  memTable,
  memCount,
  l0Segments,
  l1Segment,
  latestWrite

vars == <<memTable, memCount, l0Segments, l1Segment, latestWrite>>

TOMBSTONE == -1
ABSENT == 0

TypeOK ==
  /\ memTable \in [Keys -> Values \cup {TOMBSTONE, ABSENT}]
  /\ memCount \in 0..MaxMemTableSize
  /\ Len(l0Segments) <= MaxL0Segments
  /\ l1Segment \in [Keys -> Values \cup {ABSENT}]
  /\ latestWrite \in [Keys -> Values \cup {TOMBSTONE, ABSENT}]

Init ==
  /\ memTable = [k \in Keys |-> ABSENT]
  /\ memCount = 0
  /\ l0Segments = <<>>
  /\ l1Segment = [k \in Keys |-> ABSENT]
  /\ latestWrite = [k \in Keys |-> ABSENT]

Put(k, v) ==
  /\ memCount < MaxMemTableSize
  /\ memTable[k] # v
  /\ memTable' = [memTable EXCEPT ![k] = v]
  /\ memCount' = IF memTable[k] = ABSENT THEN memCount + 1 ELSE memCount
  /\ latestWrite' = [latestWrite EXCEPT ![k] = v]
  /\ UNCHANGED <<l0Segments, l1Segment>>

Delete(k) ==
  /\ memCount < MaxMemTableSize
  /\ memTable[k] # TOMBSTONE
  /\ memTable' = [memTable EXCEPT ![k] = TOMBSTONE]
  /\ memCount' = IF memTable[k] = ABSENT THEN memCount + 1 ELSE memCount
  /\ latestWrite' = [latestWrite EXCEPT ![k] = TOMBSTONE]
  /\ UNCHANGED <<l0Segments, l1Segment>>

FlushMemTable ==
  /\ memCount > 0
  /\ Len(l0Segments) < MaxL0Segments
  /\ l0Segments' = Append(l0Segments, memTable)
  /\ memTable' = [k \in Keys |-> ABSENT]
  /\ memCount' = 0
  /\ UNCHANGED <<l1Segment, latestWrite>>

GetFromL0(k) ==
  IF Len(l0Segments) = 0 THEN ABSENT
  ELSE IF Len(l0Segments) = 1 THEN l0Segments[1][k]
  ELSE IF l0Segments[2][k] # ABSENT THEN l0Segments[2][k]
  ELSE l0Segments[1][k]

CompactL0ToL1 ==
  /\ Len(l0Segments) > 0
  /\ l1Segment' = [k \in Keys |->
       LET v0 == GetFromL0(k) IN
       IF v0 = TOMBSTONE THEN ABSENT
       ELSE IF v0 \in Values THEN v0
       ELSE l1Segment[k]]
  /\ l0Segments' = <<>>
  /\ UNCHANGED <<memTable, memCount, latestWrite>>

Next ==
  \/ \E k \in Keys, v \in Values : Put(k, v)
  \/ \E k \in Keys : Delete(k)
  \/ FlushMemTable
  \/ CompactL0ToL1

Spec == Init /\ [][Next]_vars

Get(k) ==
  IF memTable[k] # ABSENT THEN memTable[k]
  ELSE LET v0 == GetFromL0(k) IN
       IF v0 # ABSENT THEN v0
       ELSE l1Segment[k]

LiveReadConsistency ==
  \A k \in Keys :
    latestWrite[k] \in Values => Get(k) = latestWrite[k]

NoResurrectedValues ==
  \A k \in Keys :
    latestWrite[k] = TOMBSTONE => Get(k) \notin Values

TombstonePurgedInL1 ==
  \A k \in Keys :
    l1Segment[k] # TOMBSTONE

=============================================================================
