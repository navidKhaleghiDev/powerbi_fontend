/**
 * Batch lifecycle state machine.
 *
 * Implements the EXTRACTED → UPLOADED → VERIFIED → APPLIED → PUBLISHED
 * transition model from the architecture PDF (page 13: "State Machine").
 *
 * Key invariants enforced here:
 *   - Transitions are strictly linear; no status may be skipped.
 *   - A checkpoint must NOT advance on upload alone — only after APPLY
 *     succeeds (page 13: "do not advance checkpoints on upload alone").
 *   - Warehouse effects + checkpoint advance must be atomic within the
 *     database transaction (page 15: "Commit invariant").
 *   - If a worker dies between UPLOADED and APPLIED, replay from the durable
 *     manifest (page 13).
 */

import type {
  BatchStatus,
  Checkpoint,
  IngestionBatch,
  QualityResult,
  RunStatus,
  SyncRun,
} from "./types";

/* ---------------------------------------------------------------------------
 * Transition ordering and validation
 * ------------------------------------------------------------------------- */

const ORDER: BatchStatus[] = [
  "extracted",
  "uploaded",
  "verified",
  "applied",
  "published",
];

/**
 * Returns the ordinal of a batch status (0-based) or -1 if unknown.
 */
const ordinal = (status: BatchStatus): number => ORDER.indexOf(status);

/**
 * Two statuses are a valid forward transition only if the target is exactly
 * one step ahead.  No skipping, no going backwards, no self-transitions.
 */
const isValidForwardTransition = (
  from: BatchStatus,
  to: BatchStatus,
): boolean => ordinal(to) === ordinal(from) + 1;

/**
 * Is `status` terminal — i.e. nothing more should happen to this batch?
 * PUBLISHED is the happy-path terminal state.  A batch that failed validation
 * is removed from the pipeline and handled separately, so it is also terminal
 * from the state machine's perspective.
 */
const isTerminal = (status: BatchStatus): boolean => status === "published";

/* ---------------------------------------------------------------------------
 * Public API
 * ------------------------------------------------------------------------- */

/**
 * Advance a batch by one status.
 *
 * Throws if the transition is invalid (skipping a step, going backwards, or
 * transitioning from a terminal state).  This is the only way a batch's status
 * should ever change — direct mutation would bypass the ordering guarantee.
 */
const transition = (
  batch: IngestionBatch,
  target: BatchStatus,
): IngestionBatch => {
  if (isTerminal(batch.status)) {
    throw new Error(
      `Cannot transition batch ${batch.batchId}: status "${batch.status}" is terminal`,
    );
  }

  if (!isValidForwardTransition(batch.status, target)) {
    throw new Error(
      `Invalid transition for batch ${batch.batchId}: ${batch.status} → ${target}`,
    );
  }

  return { ...batch, status: target };
};

/**
 * Gate between UPLOADED and APPLIED: a batch may only advance to APPLIED after
 * the quality result has accepted it (PDF page 10: step 03 Validate, step 07
 * Publish with "Quality watermark").
 *
 * If the quality result rejects the batch, the batch stays at VERIFIED and the
 * caller is expected to quarantine it.
 */
const canApply = (quality: QualityResult): boolean => quality.verdict === "accept";

/**
 * The atomic commit operation (PDF page 15: "Commit invariant").
 *
 * Warehouse effects and the checkpoint must advance together within the
 * database transaction.  This function returns the new batch status AND the new
 * checkpoint atomically — there is no code path that advances one without the
 * other.
 *
 * Pre-conditions enforced:
 *   - Batch must be at VERIFIED status (APPLY happens after validate).
 *   - Quality must have accepted the batch.
 *
 * Returns a tuple of the updated batch, the updated checkpoint, and the
 * updated sync run, so the caller can persist all three in one transaction.
 */
const applyAndCommit = (
  batch: IngestionBatch,
  checkpoint: Checkpoint,
  run: SyncRun,
  quality: QualityResult,
): readonly [IngestionBatch, Checkpoint, SyncRun] => {
  if (batch.status !== "verified") {
    throw new Error(
      `Cannot APPLY batch ${batch.batchId}: expected status "verified", got "${batch.status}"`,
    );
  }

  if (!canApply(quality)) {
    throw new Error(
      `Cannot APPLY batch ${batch.batchId}: quality result was "${quality.verdict}", not "accept"`,
    );
  }

  // The checkpoint advances to the cursor captured at extraction time —
  // this is what makes the pipeline "exactly-once" on the current-state side.
  const newBatch = transition(batch, "applied");
  const newCheckpoint: Checkpoint = {
    ...checkpoint,
    committedCursor: batch.sourceCursor,
  };
  const newRun: SyncRun = { ...run, status: "running" };

  return [newBatch, newCheckpoint, newRun] as const;
};

/**
 * Publish a batch that has been applied — the final transition.
 *
 * PUBLISHED means the mart is watermarked and visible for BI queries
 * (PDF page 13: "PUBLISHED — Mart watermarked").
 */
const publish = (batch: IngestionBatch): IngestionBatch => {
  if (batch.status !== "applied") {
    throw new Error(
      `Cannot PUBLISH batch ${batch.batchId}: expected status "applied", got "${batch.status}"`,
    );
  }

  return transition(batch, "published");
};

/**
 * On a worker restart, recover a batch that was left mid-flight.
 *
 * The batch is replayed from its current durable status:
 *   - EXTRACTED / UPLOADED: re-extract or replay manifest, then re-load.
 *   - VERIFIED: re-attempt APPLY (idempotent — see validation.mergeRecords).
 *   - APPLIED: safe to PUBLISH (the commit already happened).
 *
 * The checkpoint is NOT advanced on replay — only the normal APPLY path
 * does that.  This is the "manifest replay; checkpoint does not move
 * prematurely" rule from page 46.
 */
const recover = (
  batch: IngestionBatch,
  checkpoint: Checkpoint,
): { batch: IngestionBatch; replayFrom: BatchStatus } => {
  // APPLIED batches can proceed straight to PUBLISHED — the warehouse commit
  // already happened, so the checkpoint is already correct.
  if (batch.status === "applied") {
    return { batch, replayFrom: "applied" };
  }

  // For any earlier status, we replay from the current durable position.
  // The checkpoint stays exactly where it was.
  return { batch, replayFrom: batch.status };
};

/**
 * Run a batch through the full happy-path pipeline (for testing / simulation).
 * Each step validates pre-conditions and transitions atomically.
 */
const runPipeline = (
  batch: IngestionBatch,
  checkpoint: Checkpoint,
  run: SyncRun,
  quality: QualityResult,
): { batch: IngestionBatch; checkpoint: Checkpoint; run: SyncRun } => {
  let b = transition(batch, "uploaded");
  let c = checkpoint;
  let r = run;

  // VERIFY
  b = transition(b, "verified");

  // APPLY (atomic with checkpoint)
  [b, c, r] = applyAndCommit(b, c, r, quality);

  // PUBLISH
  b = publish(b);

  r = { ...r, status: "succeeded" as RunStatus };

  return { batch: b, checkpoint: c, run: r };
};

export const batchStateMachine = {
  ORDER,
  ordinal,
  isValidForwardTransition,
  isTerminal,
  transition,
  canApply,
  applyAndCommit,
  publish,
  recover,
  runPipeline,
};
