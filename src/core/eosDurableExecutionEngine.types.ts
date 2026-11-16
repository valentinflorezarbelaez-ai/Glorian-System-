/**
 * EOS Event-Sourced Durable Execution Engine Types
 *
 * SPEC-294 / CHANGE-156 / Step 7
 * Zero third-party runtime dependencies (Law V).
 */

export type WorkflowEventType =
  | "WorkflowStarted"
  | "ActivityScheduled"
  | "ActivityStarted"
  | "ActivityCompleted"
  | "ActivityFailed"
  | "ActivityCompensated"
  | "WorkflowSuspended"
  | "WorkflowResumed"
  | "WorkflowCompleted"
  | "WorkflowFailed";

export interface WorkflowEvent {
  workflowId: string;
  seq: number;
  timestamp: string;
  type: WorkflowEventType;
  payload: Record<string, unknown>;
  stateHash: string;
}

export interface ActivityContext {
  workflowId: string;
  activityName: string;
  isReplaying: boolean;
  attempt: number;
}

export interface ActivityDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  execute: (input: TInput, ctx: ActivityContext) => Promise<TOutput> | TOutput;
  compensate?: (input: TInput, ctx: ActivityContext) => Promise<void> | void;
  maxRetries?: number;
}

export type WorkflowStatus = "RUNNING" | "PAUSED" | "COMPLETED" | "FAILED" | "COMPENSATED";

export interface WorkflowExecutionState {
  workflowId: string;
  workflowName: string;
  status: WorkflowStatus;
  currentSeq: number;
  completedActivities: string[];
  compensatedActivities: string[];
  results: Record<string, unknown>;
  error?: string;
  stateHash: string;
}

export interface DurableAuditReceipt {
  timestampIso: string;
  specRef: string;
  totalEventsRecorded: number;
  replayDeterministicMatch: boolean;
  sagaCompensationsVerified: boolean;
  sidecarOutboxTested: boolean;
  sha256Signature: string;
}
