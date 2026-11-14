---- MODULE CbdcRtgsGridlock ----
EXTENDS Integers, Sequences, FiniteSets

CONSTANTS MIN_THROUGHPUT_RATIO_X100, MAX_LSM_EFFICIENCY_X100, MAX_STEPS

VARIABLES step, bankCount, queuedGrossUsdM, settledGrossUsdM, unsettledGrossUsdM, conservationResidualUsdM, throughputRatioX100, herfindahlIndex, regime

Init ==
  /\ step = 0
  /\ bankCount = 18
  /\ queuedGrossUsdM = 48500
  /\ settledGrossUsdM = 48500
  /\ unsettledGrossUsdM = 0
  /\ conservationResidualUsdM = 0
  /\ throughputRatioX100 = 100
  /\ herfindahlIndex = 1280
  /\ regime = "MULTILATERAL_LSM_CLEARED"

GrossObligationConservationInvariant ==
  /\ conservationResidualUsdM = 0
  /\ settledGrossUsdM + unsettledGrossUsdM = queuedGrossUsdM
  /\ bankCount >= 2

LsmCompressionBounds ==
  /\ throughputRatioX100 > 0 /\ throughputRatioX100 <= 100
  /\ MAX_LSM_EFFICIENCY_X100 <= 95

SettlementThroughputBounds ==
  /\ throughputRatioX100 >= MIN_THROUGHPUT_RATIO_X100
  /\ regime \in {"MULTILATERAL_LSM_CLEARED", "PARTIAL_QUEUE_COMPRESSION", "SYSTEMIC_LIQUIDITY_GRIDLOCK"}

Next ==
  /\ step < MAX_STEPS
  /\ step' = step + 1
  /\ settledGrossUsdM' = IF step % 10 = 0 THEN 43650 ELSE 48500
  /\ unsettledGrossUsdM' = queuedGrossUsdM - settledGrossUsdM'
  /\ conservationResidualUsdM' = queuedGrossUsdM - (settledGrossUsdM' + unsettledGrossUsdM')
  /\ throughputRatioX100' = (settledGrossUsdM' * 100) \div queuedGrossUsdM
  /\ herfindahlIndex' = IF step % 15 = 0 THEN 2100 ELSE 1280
  /\ regime' =
      IF throughputRatioX100' < MIN_THROUGHPUT_RATIO_X100 THEN "SYSTEMIC_LIQUIDITY_GRIDLOCK"
      ELSE IF throughputRatioX100' < 100 \/ herfindahlIndex' > 2500 THEN "PARTIAL_QUEUE_COMPRESSION"
      ELSE "MULTILATERAL_LSM_CLEARED"

Spec == Init /\ [][Next]_<<step, bankCount, queuedGrossUsdM, settledGrossUsdM, unsettledGrossUsdM, conservationResidualUsdM, throughputRatioX100, herfindahlIndex, regime>>

====
