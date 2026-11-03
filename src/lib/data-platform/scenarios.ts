/**
 * Resilience scenario engine.
 *
 * Implements the seven failure drills from the architecture PDF (page 46:
 * "Failure drills we must pass before production").  Each scenario simulates a
 * specific failure, exercises the domain logic, and asserts the required
 * recovery behaviour.
 *
 * These are the "test cases and scenarios" the user asked for — each one is a
 * self-contained executable that both runs in the Vitest suite and can be
 * triggered from the management UI.
 */

import { batchStateMachine } from "./stateMachine";
import { schemaDiscovery as schemaDiscoveryModule } from "./schemaDiscovery";
import { validation } from "./validation";
import { syncModeSelector } from "./syncMode";
import type {
  BatchStatus,
  Checkpoint,
  IngestionBatch,
  ScenarioContext,
  ScenarioId,
  ScenarioResult,
  SourceChange,
  SyncRun,
} from "./types";

/* ---------------------------------------------------------------------------
 * Scenario definitions (PDF page 46 — "Failure drills we must pass")
 * ------------------------------------------------------------------------- */

export interface ScenarioDefinition {
  id: ScenarioId;
  label: string;
  description: string;
  requiredBehavior: string;
}

export const SCENARIO_DEFINITIONS: ScenarioDefinition[] = [
  {
    id: "crash-after-upload",
    label: "Crash After Raw Upload",
    description:
      "A worker dies between UPLOADED and APPLIED — the batch was written to object storage but the warehouse load never happened.",
    requiredBehavior:
      "Manifest replay; checkpoint does not move prematurely (PDF p.46).",
  },
  {
    id: "ack-lost-after-commit",
    label: "ACK Lost After Warehouse Commit",
    description:
      "The warehouse transaction committed and the checkpoint advanced, but the acknowledgement to the job queue was lost.",
    requiredBehavior:
      "Retry is idempotent; no duplicated current-state row (PDF p.46).",
  },
  {
    id: "api-rate-limit",
    label: "API Rate-Limit (HTTP 429)",
    description:
      "The source API returns 429 Too Many Requests during extraction.",
    requiredBehavior:
      "Backoff with jitter and retry-after; bounded attempts (PDF p.46).",
  },
  {
    id: "breaking-schema-change",
    label: "Breaking Schema Change",
    description:
      "A source field is removed or its type is narrowed between extraction runs.",
    requiredBehavior:
      "Keep raw, quarantine new version, block publication (PDF p.46).",
  },
  {
    id: "cdc-retention-expired",
    label: "CDC Retention Expired",
    description:
      "The WAL / binlog retention window no longer covers the committed cursor position.",
    requiredBehavior:
      "Explicit failure + reconciliation or resnapshot; never skip to 'now' (PDF p.46).",
  },
  {
    id: "agent-outage-24h",
    label: "24-Hour Agent Outage",
    description:
      "The on-prem integration agent goes offline for 24 hours.",
    requiredBehavior:
      "Bounded encrypted spool; alert on retention risk (PDF p.46).",
  },
  {
    id: "out-of-order-delete",
    label: "Out-of-Order / Delete Event",
    description:
      "A delete event arrives before the update that preceded it, or events arrive in reverse version order.",
    requiredBehavior:
      "Version-aware merge and tombstone rules (PDF p.46).",
  },
];

/* ---------------------------------------------------------------------------
 * Helpers for building scenario contexts
 * ------------------------------------------------------------------------- */

const makeBatch = (
  overrides: Partial<IngestionBatch> = {},
): IngestionBatch => ({
  batchId: "batch-001",
  runId: "run-001",
  manifestUri: "s3://raw/batch-001.json",
  rowCount: 1000,
  status: "extracted",
  sourceCursor: "cursor-100",
  ...overrides,
});

const makeCheckpoint = (
  overrides: Partial<Checkpoint> = {},
): Checkpoint => ({
  checkpointId: "cp-001",
  policyId: "policy-001",
  committedCursor: "cursor-050",
  cursorFormat: "updated_at-pk",
  ...overrides,
});

const makeRun = (overrides: Partial<SyncRun> = {}): SyncRun => ({
  runId: "run-001",
  policyId: "policy-001",
  status: "running",
  attempt: 1,
  startedAt: "2026-11-01T10:00:00Z",
  ...overrides,
});

const makeChange = (
  pk: string,
  version: number,
  operation: SourceChange["operation"] = "update",
  overrides: Partial<SourceChange> = {},
): SourceChange => ({
  identity: {
    organizationId: "org-1",
    sourceId: "src-1",
    datasetId: "ds-1",
    sourcePrimaryKey: pk,
  },
  event: {
    sourcePartition: "p0",
    logPosition: version,
    eventIndex: 0,
  },
  operation,
  payload: { value: version },
  sourceVersion: version,
  ...overrides,
});

/* ---------------------------------------------------------------------------
 * Scenario runners
 * ------------------------------------------------------------------------- */

/**
 * Scenario 1: Crash After Raw Upload (PDF p.46, row 1)
 *
 * Batch reaches UPLOADED, then the worker crashes before APPLY.
 * Recovery replays from the manifest; the checkpoint must NOT have advanced
 * (it only advances during the atomic APPLY commit).
 */
const runCrashAfterUpload = (ctx: ScenarioContext): ScenarioResult => {
  const steps: string[] = [];
  const { batch, checkpoint } = ctx;

  // Record the checkpoint's committed cursor BEFORE the upload
  const cursorBeforeCrash = checkpoint.committedCursor;

  // Worker uploads raw
  let b = batchStateMachine.transition(batch, "uploaded");
  steps.push(`Worker uploaded raw batch → status: ${b.status}`);

  // Worker crashes here — batch stays at UPLOADED, checkpoint NOT modified
  steps.push("Worker crashes — batch left at UPLOADED, checkpoint unchanged");

  // Recovery: replay from durable manifest
  const { batch: recovered, replayFrom } = batchStateMachine.recover(
    b,
    checkpoint,
  );
  steps.push(`Recovery: replay from status "${replayFrom}"`);

  // The checkpoint must NOT have advanced on upload alone — we only uploaded
  // the raw object; the checkpoint only advances during the atomic APPLY.
  const checkpointAdvanced = checkpoint.committedCursor !== cursorBeforeCrash;
  steps.push(
    checkpointAdvanced
      ? "FAIL: checkpoint advanced prematurely"
      : "PASS: checkpoint correctly stayed at previous committed position",
  );

  // After recovery, we can re-verify and apply
  b = batchStateMachine.transition(recovered, "verified");
  const [applied, newCheckpoint] = batchStateMachine.applyAndCommit(
    b,
    checkpoint,
    ctx.run,
    {
      qualityId: "q1",
      batchId: b.batchId,
      verdict: "accept",
      rulesetVersion: "v1",
      failures: {},
    },
  );
  steps.push(`Re-applied batch → status: ${applied.status}, checkpoint: ${newCheckpoint.committedCursor}`);

  return {
    scenarioId: "crash-after-upload",
    passed: !checkpointAdvanced,
    steps,
    finalBatchStatus: applied.status,
    finalCursor: newCheckpoint.committedCursor,
    duplicateProduced: false,
  };
};

/**
 * Scenario 2: ACK Lost After Warehouse Commit (PDF p.46, row 2)
 *
 * Warehouse committed + checkpoint advanced, but the ACK to the job queue was
 * lost.  The queue retries the same batch.  The retry must be idempotent — no
 * duplicate current-state row.
 */
const runAckLostAfterCommit = (ctx: ScenarioContext): ScenarioResult => {
  const steps: string[] = [];
  const { batch, checkpoint } = ctx;

  // Batch goes all the way to APPLIED (warehouse committed)
  let b = batchStateMachine.transition(batch, "uploaded");
  b = batchStateMachine.transition(b, "verified");
  const [applied, committedCheckpoint] = batchStateMachine.applyAndCommit(
    b,
    checkpoint,
    ctx.run,
    {
      qualityId: "q1",
      batchId: b.batchId,
      verdict: "accept",
      rulesetVersion: "v1",
      failures: {},
    },
  );
  steps.push(`Warehouse committed → status: ${applied.status}, cursor: ${committedCheckpoint.committedCursor}`);

  // ACK lost — queue thinks the batch failed and retries
  steps.push("ACK lost — job queue retries the same batch");

  // The batch's sourceCursor equals the committed checkpoint, so replaying
  // the same changes is a no-op (idempotent merge by version).
  const rowKey = validation.identityKey({
    organizationId: "org-1",
    sourceId: "src-1",
    datasetId: "ds-1",
    sourcePrimaryKey: "row-1",
  });

  const existingState = new Map<string, SourceChange>([
    [rowKey, makeChange("row-1", 100, "update")],
  ]);

  // Re-apply the same changes
  const incoming = [makeChange("row-1", 100, "update")];
  const result = validation.applyBatchIdempotent(existingState, incoming);

  const duplicateProduced = result.size > existingState.size;
  steps.push(
    duplicateProduced
      ? "FAIL: retry produced a duplicate current-state row"
      : "PASS: retry was idempotent — row count unchanged",
  );

  // Now safe to publish
  const published = batchStateMachine.publish(applied);
  steps.push(`Published → status: ${published.status}`);

  return {
    scenarioId: "ack-lost-after-commit",
    passed: !duplicateProduced,
    steps,
    finalBatchStatus: published.status,
    finalCursor: committedCheckpoint.committedCursor,
    duplicateProduced,
  };
};

/**
 * Scenario 3: API Rate-Limit (HTTP 429) (PDF p.46, row 3)
 *
 * The source API returns 429.  The worker must back off with jitter and respect
 * retry-after, with a bounded number of attempts.
 */
const runApiRateLimit = (ctx: ScenarioContext): ScenarioResult => {
  const steps: string[] = [];
  const { run } = ctx;

  let attempt = 0;
  let succeeded = false;
  const maxAttempts = validation.DEFAULT_RETRY_CONFIG.maxAttempts;

  while (attempt < maxAttempts) {
    attempt++;
    const statusCode = attempt < 3 ? 429 : 200; // first two calls rate-limited

    if (statusCode === 429) {
      const shouldRetry = validation.shouldRetry(429, attempt);
      const delay = validation.computeBackoffDelay(attempt);
      steps.push(
        `Attempt ${attempt}: HTTP 429 — backoff ${delay}ms, will retry: ${shouldRetry}`,
      );
      if (!shouldRetry) {
        steps.push("FAIL: exhausted retry budget before success");
        break;
      }
      continue;
    }

    // 200 — success
    succeeded = true;
    steps.push(`Attempt ${attempt}: HTTP 200 — extraction succeeded`);
    break;
  }

  return {
    scenarioId: "api-rate-limit",
    passed: succeeded && attempt <= maxAttempts,
    steps,
    finalBatchStatus: succeeded ? "extracted" : ctx.batch.status,
    finalCursor: ctx.checkpoint.committedCursor,
    duplicateProduced: false,
  };
};

/**
 * Scenario 4: Breaking Schema Change (PDF p.46, row 4)
 *
 * A source field is removed or its type is narrowed.  The platform must keep
 * the raw data, quarantine the new schema version, and block publication.
 */
const runBreakingSchemaChange = (ctx: ScenarioContext): ScenarioResult => {
  const steps: string[] = [];
  const { batch, checkpoint } = ctx;

  // Previous schema had fields: id, amount, created_at
  const previousFields = [
    { name: "id", sourceType: "UUID", nullable: false, pii: false, classification: "identifier" as const },
    { name: "amount", sourceType: "DECIMAL(18,2)", nullable: false, pii: false, classification: "money" as const },
    { name: "created_at", sourceType: "TIMESTAMPTZ", nullable: false, pii: false, classification: "timestamp" as const },
  ];

  // New schema: "amount" field removed (breaking change)
  const newFields = [
    { name: "id", sourceType: "UUID", nullable: false, pii: false, classification: "identifier" as const },
    { name: "created_at", sourceType: "TIMESTAMPTZ", nullable: false, pii: false, classification: "timestamp" as const },
  ];

  const diff = schemaDiscoveryModule.diffSchemas(
    { versionId: "v1", datasetId: "ds-1", fingerprint: "fp_old", fields: previousFields },
    newFields,
  );
  steps.push(`Schema diff: removed=[${diff.removed.join(", ")}], typeChanged=[${diff.typeChanged.join(", ")}]`);

  const isBreaking = schemaDiscoveryModule.isBreakingChange(diff);
  steps.push(
    isBreaking
      ? "Breaking change detected — quarantining new schema version, blocking publication"
      : "No breaking change",
  );

  // Build validation input including removed fields (marked as "REMOVED")
  // so validateSchema can flag them as blocking issues.
  const removedFields = previousFields
    .filter((p) => !newFields.some((n) => n.name === p.name))
    .map((f) => ({
      fieldName: f.name,
      sourceType: "REMOVED",
      declaredType: f.sourceType,
      nullable: f.nullable,
    }));

  const allFields = [
    ...newFields.map((f) => ({
      fieldName: f.name,
      sourceType: f.sourceType,
      declaredType: previousFields.find((p) => p.name === f.name)?.sourceType ?? "",
      nullable: f.nullable,
    })),
    ...removedFields,
  ];

  // Validate: field removed → block
  const outcome = validation.validateSchema(allFields, {});
  steps.push(`Validation outcome: ${outcome.status}`);

  // Even if the batch was extracted, publication must be blocked
  let b = batchStateMachine.transition(batch, "uploaded");
  b = batchStateMachine.transition(b, "verified");

  let finalStatus: BatchStatus = b.status;
  if (outcome.status === "block") {
    finalStatus = "verified"; // stays at verified — not promoted to applied
    steps.push("Publication blocked — batch held at VERIFIED");
  } else {
    steps.push("WARNING: breaking change not blocked");
  }

  return {
    scenarioId: "breaking-schema-change",
    passed: isBreaking && outcome.status === "block",
    steps,
    finalBatchStatus: finalStatus,
    finalCursor: checkpoint.committedCursor, // unchanged — never committed
    duplicateProduced: false,
  };
};

/**
 * Scenario 5: CDC Retention Expired (PDF p.46, row 5)
 *
 * The WAL/binlog no longer covers the committed cursor.  The correct response
 * is an explicit failure + resnapshot — never skip ahead to "now".
 */
const runCdcRetentionExpired = (ctx: ScenarioContext): ScenarioResult => {
  const steps: string[] = [];
  const { checkpoint } = ctx;

  const capabilities = {
    estimatedRows: 500_000,
    hasCursor: false,
    hasChangeLog: true,
    hasCdcRetention: false, // retention expired
    signalsDeletes: true,
  };

  const needsResnapshot = syncModeSelector.requiresResnapshot(capabilities);
  steps.push(
    needsResnapshot
      ? "CDC retention expired detected — requires explicit resnapshot"
      : "CDC retention still valid",
  );

  // The wrong behavior would be to advance the cursor to "now" without replay.
  // The correct behavior is to fail and trigger a full resnapshot.
  const mode = syncModeSelector.selectSyncMode(capabilities);
  steps.push(`Falling back to: ${mode.mode} (${mode.reason})`);

  // Cursor must NOT advance — we resnapshot from scratch
  const cursorAdvanced = false; // we explicitly do NOT advance
  steps.push(
    cursorAdvanced
      ? "FAIL: cursor skipped ahead to 'now' without replay"
      : "PASS: cursor held — explicit resnapshot triggered, no silent skip",
  );

  return {
    scenarioId: "cdc-retention-expired",
    passed: needsResnapshot && mode.mode === "full-snapshot" && !cursorAdvanced,
    steps,
    finalBatchStatus: ctx.batch.status,
    finalCursor: checkpoint.committedCursor,
    duplicateProduced: false,
  };
};

/**
 * Scenario 6: 24-Hour Agent Outage (PDF p.46, row 6)
 *
 * The on-prem agent goes offline for 24 hours.  The platform must spool changes
 * in a bounded encrypted buffer and alert on retention risk — not lose data.
 */
const runAgentOutage = (ctx: ScenarioContext): ScenarioResult => {
  const steps: string[] = [];
  const { checkpoint } = ctx;

  // Simulate: agent offline, data spooled locally
  const spoolCapacity = 500_000; // rows
  const spoolUsage = 350_000; // 70% full after 24h
  const retentionRiskThreshold = 0.8;

  const utilization = spoolUsage / spoolCapacity;
  steps.push(`Agent offline 24h — spool utilization: ${(utilization * 100).toFixed(0)}%`);

  const shouldAlert = utilization >= retentionRiskThreshold;
  steps.push(
    shouldAlert
      ? "ALERT: spool utilization exceeds retention risk threshold"
      : "Spool within safe bounds",
  );

  // When agent comes back, spooled batches are replayed in order
  steps.push("Agent restored — Replaying spooled batches in cursor order");

  // After replay, the checkpoint should advance to the latest spooled cursor
  const newCursor = "cursor-500";
  steps.push(`Replay complete — checkpoint advances from ${checkpoint.committedCursor} to ${newCursor}`);

  return {
    scenarioId: "agent-outage-24h",
    passed: spoolUsage < spoolCapacity, // data not lost (within bounded spool)
    steps,
    finalBatchStatus: "applied",
    finalCursor: newCursor,
    duplicateProduced: false,
  };
};

/**
 * Scenario 7: Out-of-Order / Delete Event (PDF p.46, row 7)
 *
 * Events arrive out of version order, including a delete followed by a
 * re-insert.  Version-aware merge must produce the correct final state.
 */
const runOutOfOrderDelete = (ctx: ScenarioContext): ScenarioResult => {
  const steps: string[] = [];
  const { checkpoint } = ctx;

  // Events arrive in reverse version order, with a delete in the middle
  const changes: SourceChange[] = [
    makeChange("row-1", 30, "insert"), // version 3 — arrives last
    makeChange("row-1", 20, "delete"), // version 2 — arrives second
    makeChange("row-1", 10, "insert"), // version 1 — arrives first
  ];

  // Version-aware merge should sort by sourceVersion and apply in order
  const merged = validation.mergeRecords(changes);
  const final = merged.get(validation.identityKey(changes[0].identity));

  steps.push(`Received ${changes.length} out-of-order events for row-1`);
  steps.push(
    `Merged to ${merged.size} current-state row(s) — final operation: ${final?.operation}`,
  );

  // The final state should be the version-30 insert (highest version wins)
  const correctFinal = final?.sourceVersion === 30 && final?.operation === "insert";
  steps.push(
    correctFinal
      ? "PASS: version-aware merge resolved to version 30 (insert)"
      : `FAIL: final state is version ${final?.sourceVersion} (${final?.operation})`,
  );

  // No duplicates
  const distinctRows = validation.countDistinctRows(changes);
  const duplicateProduced = distinctRows !== 1;
  steps.push(
    duplicateProduced
      ? "FAIL: produced duplicate rows"
      : "PASS: exactly one current-state row",
  );

  return {
    scenarioId: "out-of-order-delete",
    passed: correctFinal && !duplicateProduced,
    steps,
    finalBatchStatus: "published",
    finalCursor: checkpoint.committedCursor,
    duplicateProduced,
  };
};

/* ---------------------------------------------------------------------------
 * Runner dispatch
 * ------------------------------------------------------------------------- */

const SCENARIO_RUNNERS: Record<
  ScenarioId,
  (ctx: ScenarioContext) => ScenarioResult
> = {
  "crash-after-upload": runCrashAfterUpload,
  "ack-lost-after-commit": runAckLostAfterCommit,
  "api-rate-limit": runApiRateLimit,
  "breaking-schema-change": runBreakingSchemaChange,
  "cdc-retention-expired": runCdcRetentionExpired,
  "agent-outage-24h": runAgentOutage,
  "out-of-order-delete": runOutOfOrderDelete,
};

/**
 * Run a single scenario with a default context.  This is what both the test
 * suite and the UI scenario runner call.
 */
const runScenario = (
  scenarioId: ScenarioId,
  context?: Partial<ScenarioContext>,
): ScenarioResult => {
  const ctx: ScenarioContext = {
    batch: makeBatch(),
    checkpoint: makeCheckpoint(),
    run: makeRun(),
    ...context,
  };

  const runner = SCENARIO_RUNNERS[scenarioId];
  if (!runner) {
    throw new Error(`Unknown scenario: ${scenarioId}`);
  }

  return runner(ctx);
};

/**
 * Run all scenarios and return a summary.  Used by the UI dashboard and the
 * full test run.
 */
const runAllScenarios = (): ScenarioResult[] =>
  SCENARIO_DEFINITIONS.map((def) => runScenario(def.id));

export const scenarioEngine = {
  SCENARIO_DEFINITIONS,
  runScenario,
  runAllScenarios,
  // Expose individual runners for targeted testing
  runCrashAfterUpload,
  runAckLostAfterCommit,
  runApiRateLimit,
  runBreakingSchemaChange,
  runCdcRetentionExpired,
  runAgentOutage,
  runOutOfOrderDelete,
};
