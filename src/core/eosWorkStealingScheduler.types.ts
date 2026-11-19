/**
 * EOS Self-Rebalancing Work-Stealing Scheduler — Type Definitions
 *
 * SPEC-356 / CHANGE-218: Self-Rebalancing Ephemeral Micro-Thread Work-Stealing Scheduler.
 * Types for Chase-Lev lock-free deques, micro-tasks, randomized victim selection,
 * and multi-core scheduler performance telemetry.
 *
 * @module eosWorkStealingScheduler.types
 */

/**
 * Execution priority tiers for micro-tasks.
 */
export type TaskPriority = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";

/**
 * Lifecycle state of an ephemeral micro-task.
 */
export type TaskState = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "STOLEN";

/**
 * Ephemeral micro-task executed cooperatively by scheduler worker threads.
 */
export interface MicroTask<T = unknown, R = unknown> {
  readonly id: string;
  readonly priority: TaskPriority;
  readonly payload: T;
  readonly execute: (payload: T) => R;
  readonly createdAtNs: bigint;
  epoch: number;
  state: TaskState;
  assignedWorkerId?: number;
  stolenCount: number;
}

/**
 * Outcome status of an attempted task steal operation from a peer worker deque.
 */
export type StealStatus = "SUCCESS" | "EMPTY" | "ABORT";

/**
 * Result of attempting to steal from a victim worker's Chase-Lev deque.
 */
export interface StealResult<T = unknown, R = unknown> {
  readonly status: StealStatus;
  readonly task?: MicroTask<T, R>;
  readonly victimId: number;
}

/**
 * Operational telemetry per worker thread.
 */
export interface WorkerTelemetry {
  readonly workerId: number;
  readonly tasksExecuted: number;
  readonly tasksStolen: number;
  readonly stealAttempts: number;
  readonly successfulSteals: number;
  readonly queueDepth: number;
}

/**
 * Aggregate performance and load balancing metrics for the work-stealing pool.
 */
export interface SchedulerMetrics {
  readonly workerCount: number;
  readonly totalTasksProcessed: number;
  readonly totalSteals: number;
  readonly stealSuccessRate: number;
  readonly throughputTasksPerSec: number;
  readonly avgExecutionLatencyNs: number;
  readonly loadImbalanceFactor: number;
}

/**
 * Formal verification receipt emitted by EosWorkStealingSchedulerCore.
 */
export interface WorkStealingAuditReceipt {
  readonly specId: "SPEC-356";
  readonly changeId: "CHANGE-218";
  readonly timestamp: string;
  readonly workerCount: number;
  readonly tasksTested: number;
  readonly metrics: SchedulerMetrics;
  readonly tlcModelVerified: boolean;
  readonly verdict: "CONFORMANT" | "DEVIATION_DETECTED";
  readonly epistemicState: "PRODUCTION_READY_WITHIN_TESTED_SCOPE";
}
