/**
 * Data-correctness and schema-validation logic.
 *
 * Implements the correctness invariants from the architecture PDF:
 *   - Page 15: "Identity, ordering, checkpoints" — idempotent merge by
 *     composite current-row identity, version-aware ordering.
 *   - Page 20: "Schema Compatibility" — type mapping and schema evolution
 *     policy with explicit failure modes (quarantine / block / accept).
 *   - Page 14: "Failure Workflow" — eventually-correct with visible failures.
 */

import type {
  CurrentRowIdentity,
  SourceChange,
  ValidationIssue,
  ValidationOutcome,
  WarehouseRecord,
} from "./types";

/* ---------------------------------------------------------------------------
 * Identity helpers (PDF page 15)
 * ------------------------------------------------------------------------- */

const identityKey = (id: CurrentRowIdentity): string =>
  `${id.organizationId}|${id.sourceId}|${id.datasetId}|${id.sourcePrimaryKey}`;

/**
 * Two changes share the same current-state row when their composite identity
 * keys are equal.  Same source primary key across different datasets or
 * organizations is NOT the same row.
 */
const sameRow = (a: CurrentRowIdentity, b: CurrentRowIdentity): boolean =>
  identityKey(a) === identityKey(b);

/* ---------------------------------------------------------------------------
 * Idempotent merge (PDF page 15: "at least once input can still produce one
 * correct current-state record through idempotent merge")
 * ------------------------------------------------------------------------- */

/**
 * Merge an ordered stream of source changes into a current-state map.
 *
 * Rules (PDF page 15 + page 46 "Out-of-order / delete event"):
 *   - Later `sourceVersion` always wins for the same row identity.
 *   - A `delete` operation produces a tombstone — it marks the row as deleted,
 *     not removed from the map (so a subsequent re-insert is an insert, not a
 *     no-op).
 *   - Replaying the same event (same event identity + sourceVersion) is
 *     idempotent: it does not produce a duplicate and does not change the
 *     state.
 *   - Out-of-order events are merged by version, not by arrival order.
 *
 * Returns the resulting current-state map keyed by row identity.
 */
const mergeRecords = (
  changes: SourceChange[],
): Map<string, SourceChange> => {
  const state = new Map<string, SourceChange>();

  // Sort by sourceVersion to guarantee version-aware merge regardless of
  // arrival order (PDF: "version-aware merge").
  const sorted = [...changes].sort((a, b) => a.sourceVersion - b.sourceVersion);

  for (const change of sorted) {
    const key = identityKey(change.identity);
    const existing = state.get(key);

    // Idempotency: skip if we already have this exact event.
    if (
      existing &&
      existing.sourceVersion === change.sourceVersion &&
      existing.event.logPosition === change.event.logPosition &&
      existing.event.eventIndex === change.event.eventIndex
    ) {
      continue;
    }

    // Version-aware: only apply if this change is newer than what we have.
    if (existing && change.sourceVersion < existing.sourceVersion) {
      continue;
    }

    state.set(key, change);
  }

  return state;
};

/**
 * Apply a batch of changes to an existing warehouse current-state table.
 * Idempotent: applying the same batch twice yields the same result as applying
 * it once.
 *
 * PDF page 46: "Replay same batch without duplicate current records."
 */
const applyBatchIdempotent = (
  existing: Map<string, SourceChange>,
  incoming: SourceChange[],
): Map<string, SourceChange> => {
  const merged = new Map(existing);
  const sorted = [...incoming].sort(
    (a, b) => a.sourceVersion - b.sourceVersion,
  );

  for (const change of sorted) {
    const key = identityKey(change.identity);
    const current = merged.get(key);

    if (current && change.sourceVersion <= current.sourceVersion) {
      // Stale or duplicate — skip (idempotent).
      continue;
    }

    merged.set(key, change);
  }

  return merged;
};

/**
 * Count how many distinct current-state rows result from a set of changes.
 * This is the core deduplication check: if the same source primary key appears
 * N times across batches, there must still be exactly one current-state row.
 */
const countDistinctRows = (changes: SourceChange[]): number =>
  new Set(changes.map((c) => identityKey(c.identity))).size;

/* ---------------------------------------------------------------------------
 * Tombstone handling (PDF page 20: "Delete semantics differ")
 * ------------------------------------------------------------------------- */

/**
 * Given a sequence of changes for one row identity, determine the final
 * operation.  A delete followed by a re-insert should resolve to "insert",
 * not "delete".
 */
const resolveFinalOperation = (changes: SourceChange[]): SourceChange | undefined => {
  if (changes.length === 0) return undefined;

  const sorted = [...changes].sort(
    (a, b) => a.sourceVersion - b.sourceVersion,
  );

  return sorted[sorted.length - 1];
};

/**
 * Whether a set of changes ends in a delete (tombstone).  This determines
 * whether the current-state row should be marked deleted.
 */
const endsInDelete = (changes: SourceChange[]): boolean => {
  const final = resolveFinalOperation(changes);
  return final?.operation === "delete";
};

/* ---------------------------------------------------------------------------
 * Schema compatibility (PDF page 20: "Type mapping and schema evolution policy")
 * ------------------------------------------------------------------------- */

interface FieldComparison {
  fieldName: string;
  sourceType: string;
  declaredType: string;
  nullable: boolean;
}

/**
 * Validate field-level type compatibility and schema evolution.
 *
 * Each issue maps to a row in the PDF's compatibility table (page 20).
 * The outcome severity follows the PDF's failure policy:
 *   - accept: no issues
 *   - quarantine: issues that can be resolved without blocking (rounding,
 *     ambiguous timestamps, new nullable fields)
 *   - block: issues that must stop publication (PK collision, field removed,
 *     type narrowed, delete semantics)
 */
const validateSchema = (
  comparison: FieldComparison[],
  prevNullable: Record<string, boolean>,
): ValidationOutcome => {
  const issues: ValidationIssue[] = [];

  for (const field of comparison) {
    const isTimestamp = /timestamp|datetime/i.test(field.sourceType);
    const isPk = /uuid|id/i.test(field.fieldName) && !field.nullable;
    const wasNotNull = prevNullable[field.fieldName] === false;

    // Currency decimal: reject rounding/truncation (PDF page 20, row 1)
    // The declared type says "decimal" (money) but the source provides float.
    if (/decimal/i.test(field.declaredType) && /float|double/i.test(field.sourceType)) {
      issues.push({
        type: "currency-rounding",
        field: field.fieldName,
        detail: `Field "${field.fieldName}" uses floating-point for currency — exact decimal required to prevent rounding/truncation.`,
      });
    }

    // Timestamp without timezone: quarantine ambiguous values (PDF page 20, row 2)
    if (isTimestamp && !/timestamptz|with.?time.?zone/i.test(field.sourceType)) {
      issues.push({
        type: "timezone-ambiguous",
        field: field.fieldName,
        detail: `Field "${field.fieldName}" is a timestamp without timezone — source timezone must be declared for UTC normalization.`,
      });
    }

    // PK collision: never cast with collisions (PDF page 20, row 3)
    if (isPk && /int/i.test(field.sourceType) && field.sourceType.includes("int")) {
      issues.push({
        type: "pk-collision",
        field: field.fieldName,
        detail: `Primary key field "${field.fieldName}" uses integer type — ensure stable typed identity to prevent casting collisions.`,
      });
    }

    // New nullable field: stage automatically if safe (PDF page 20, row 4)
    if (field.nullable && wasNotNull) {
      issues.push({
        type: "new-nullable-field",
        field: field.fieldName,
        detail: `Field "${field.fieldName}" became nullable — record new schema version; review before core promotion.`,
      });
    }

    // Field removed: block incompatible mapping (PDF page 20, row 5)
    if (field.sourceType === "REMOVED") {
      issues.push({
        type: "field-removed",
        field: field.fieldName,
        detail: `Field "${field.fieldName}" was removed from the source — block mapping version and alert.`,
      });
    }

    // Type narrowed: a field that was declared as a wider type is now narrower
    // (e.g. VARCHAR(100) → VARCHAR(50)).  This is detected only when the
    // declaredType is known and the source type is a narrower variant of the
    // same type family.  Schema-breaking changes are also caught by
    // diffSchemas + isBreakingChange for the evolution pipeline.
    if (
      field.declaredType &&
      field.sourceType !== "REMOVED" &&
      field.sourceType !== field.declaredType
    ) {
      const declaredFamily = field.declaredType.replace(/\(.*\)/, "").toUpperCase();
      const sourceFamily = field.sourceType.replace(/\(.*\)/, "").toUpperCase();

      // Only flag as "narrowed" if it's the same type family but with a
      // smaller precision/scale (e.g. VARCHAR(100) → VARCHAR(50)).
      // Different type families (FLOAT → DECIMAL) are handled by the
      // specific compatibility checks above (currency-rounding, etc.).
      if (declaredFamily === sourceFamily) {
        const declaredPrecision = parseInt(
          field.declaredType.match(/\((\d+)/)?.[1] ?? "0",
          10,
        );
        const sourcePrecision = parseInt(
          field.sourceType.match(/\((\d+)/)?.[1] ?? "0",
          10,
        );

        if (
          declaredPrecision > 0 &&
          sourcePrecision > 0 &&
          sourcePrecision < declaredPrecision &&
          !field.nullable
        ) {
          issues.push({
            type: "type-narrowed",
            field: field.fieldName,
            detail: `Field "${field.fieldName}" precision was narrowed from ${declaredPrecision} to ${sourcePrecision} — this is a breaking change that blocks publication.`,
          });
        }
      }
    }
  }

  if (issues.length === 0) {
    return { status: "accept" };
  }

  const blockingTypes: ValidationIssue["type"][] = [
    "pk-collision",
    "field-removed",
    "type-narrowed",
    "delete-semantics-differ",
  ];

  if (issues.some((i) => blockingTypes.includes(i.type))) {
    return { status: "block", issues };
  }

  return { status: "quarantine", issues };
};

/* ---------------------------------------------------------------------------
 * Backoff / retry (PDF page 46: "API rate-limit (429) → Backoff with jitter
 * and retry-after; bounded attempts")
 * ------------------------------------------------------------------------- */

interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 5,
  baseDelayMs: 1000,
  maxDelayMs: 30_000,
};

/**
 * Compute the delay before the next retry using exponential backoff with
 * jitter.  The jitter prevents thundering-herd retries when many workers hit
 * a rate limit simultaneously.
 *
 * delay = min(baseDelay * 2^(attempt-1), maxDelay) * random(0.5, 1.0)
 */
const computeBackoffDelay = (
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): number => {
  const exponential = config.baseDelayMs * Math.pow(2, attempt - 1);
  const capped = Math.min(exponential, config.maxDelayMs);
  const jitter = 0.5 + Math.random() * 0.5; // 0.5–1.0
  return Math.round(capped * jitter);
};

/**
 * Should we retry after an HTTP error?
 *   - 429 (rate limit): yes, with backoff
 *   - 5xx (server error): yes, with backoff
 *   - 4xx (client error, except 429): no — retrying won't help
 *   - Network error (no status): yes, with backoff
 */
const shouldRetry = (
  statusCode: number | undefined,
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): boolean => {
  if (attempt >= config.maxAttempts) return false;
  if (statusCode === undefined) return true; // network error
  if (statusCode === 429) return true;
  if (statusCode >= 500) return true;
  return false;
};

export const validation = {
  identityKey,
  sameRow,
  mergeRecords,
  applyBatchIdempotent,
  countDistinctRows,
  resolveFinalOperation,
  endsInDelete,
  validateSchema,
  computeBackoffDelay,
  shouldRetry,
  DEFAULT_RETRY_CONFIG,
};

export type { FieldComparison, RetryConfig };
