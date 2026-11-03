/**
 * Domain types for the Multi-Source Data Platform (Architecture V4).
 *
 * Every type maps directly to a concept or entity defined in the architecture
 * PDF — control-plane metadata, execution state, batch lifecycle, sync modes,
 * schema discovery, data-correctness invariants, and resilience drills.
 *
 * These are pure data structures with no runtime behaviour; the logic lives in
 * the sibling modules (stateMachine, validation, syncMode, schemaDiscovery,
 * scenarios).  Keeping them separate makes the domain rules trivially unit
 * testable.
 */

/* ---------------------------------------------------------------------------
 * Control-plane entities (PDF ERD / Control Plane, page 17)
 * ------------------------------------------------------------------------- */

export type ResidencyPolicy = "cloud-first" | "hybrid-restricted" | "fully-onprem";

export interface Organization {
  organizationId: string;
  name: string;
  residencyPolicy: ResidencyPolicy;
}

export type EngineType = "postgres" | "mysql" | "api" | "files" | "webhook";

export interface Connection {
  connectionId: string;
  organizationId: string;
  secretRef: string; // never plaintext — a reference to a secret store
  agentId?: string; // present only for private / on-prem sources
  engineType: EngineType;
}

export interface DataSource {
  sourceId: string;
  organizationId: string;
  connectionId: string;
  engineType: EngineType;
}

export type RecordGrain = "order-line" | "journal-line" | "employee-event" | "stock-movement";

export interface Dataset {
  datasetId: string;
  sourceId: string;
  sourceLocator: string; // table name / API path / file pattern
  recordGrain: RecordGrain;
}

export type ApprovalState = "draft" | "proposed" | "in-review" | "approved" | "rejected";

export interface SchemaVersion {
  versionId: string;
  datasetId: string;
  fingerprint: string; // structural hash of the discovered schema
  fields: SchemaField[];
}

export interface SchemaField {
  name: string;
  sourceType: string; // e.g. "VARCHAR", "UUID", "DECIMAL(18,2)", "TIMESTAMPTZ"
  nullable: boolean;
  pii: boolean;
  classification: FieldClassification;
}

export type FieldClassification =
  | "identifier"
  | "pii"
  | "money"
  | "timestamp"
  | "dimension"
  | "measure"
  | "reference"
  | "unknown";

export interface MappingVersion {
  mappingId: string;
  datasetId: string;
  schemaVersionId: string;
  approvalState: ApprovalState;
  /** Maps source field names to canonical contract field names. */
  fieldMap: Record<string, string>;
}

/* ---------------------------------------------------------------------------
 * Sync configuration (PDF: Synchronization + Asynchronous Design)
 * ------------------------------------------------------------------------- */

export type SyncMode = "full-snapshot" | "incremental-polling" | "log-cdc";

export type DeleteStrategy = "soft" | "cdc-tombstone" | "reconciliation";

export interface SyncPolicy {
  policyId: string;
  datasetId: string;
  mode: SyncMode;
  schedule: string; // cron expression
  deleteStrategy: DeleteStrategy;
}

/* ---------------------------------------------------------------------------
 * Execution state (PDF ERD / Execution State, page 18)
 * ------------------------------------------------------------------------- */

export type RunStatus = "pending" | "running" | "succeeded" | "failed" | "quarantined";

export interface SyncRun {
  runId: string;
  policyId: string;
  status: RunStatus;
  attempt: number;
  startedAt: string;
}

/**
 * The five phases of the batch lifecycle (PDF: State Machine, page 13).
 *
 * Transitions are strictly linear and enforced by the state machine:
 *
 *   EXTRACTED → UPLOADED → VERIFIED → APPLIED → PUBLISHED
 *
 * No status may be skipped.  A worker that dies mid-flight leaves the batch
 * in its last durable state so it is always inspectable.
 */
export type BatchStatus =
  | "extracted"
  | "uploaded"
  | "verified"
  | "applied"
  | "published";

export interface IngestionBatch {
  batchId: string;
  runId: string;
  manifestUri: string;
  rowCount: number;
  status: BatchStatus;
  /** Source cursor captured at extraction time (for incremental / CDC). */
  sourceCursor: string;
}

export type CursorFormat = "updated_at-pk" | "provider-token" | "lsn-binlog" | "file-version";

export interface Checkpoint {
  checkpointId: string;
  policyId: string;
  committedCursor: string;
  cursorFormat: CursorFormat;
}

export type QualityVerdict = "accept" | "reject";

export interface QualityResult {
  qualityId: string;
  batchId: string;
  verdict: QualityVerdict;
  rulesetVersion: string;
  /** Row-level validation failures, keyed by rule name. */
  failures: Record<string, number>;
}

/* ---------------------------------------------------------------------------
 * Data-correctness identities (PDF: Data Correctness, page 15)
 * ------------------------------------------------------------------------- */

/**
 * The composite identity that makes a *current-state* row unique across
 * companies, databases, and datasets.  Two records with the same
 * (organization_id, source_id, dataset_id, source_primary_key) are the same
 * logical row — a merge, not an insert.
 */
export interface CurrentRowIdentity {
  organizationId: string;
  sourceId: string;
  datasetId: string;
  sourcePrimaryKey: string;
}

/**
 * The identity of a single source event / change, used for ordering and
 * deduplication on the ingestion side.
 */
export interface EventIdentity {
  sourcePartition: string;
  logPosition: number;
  eventIndex: number;
}

export type ChangeOperation = "insert" | "update" | "delete";

/** A single change row coming from the source (snapshot page, poll result, or CDC event). */
export interface SourceChange {
  identity: CurrentRowIdentity;
  event: EventIdentity;
  operation: ChangeOperation;
  payload: Record<string, unknown>;
  /** Monotonically increasing source version for merge ordering. */
  sourceVersion: number;
}

/* ---------------------------------------------------------------------------
 * Warehouse layers (PDF: Warehouse Storage, page 21)
 * ------------------------------------------------------------------------- */

export type WarehouseLayer = "raw" | "staging" | "core" | "marts";

export interface WarehouseRecord {
  recordKey: string;
  layer: WarehouseLayer;
  identity: CurrentRowIdentity;
  data: Record<string, unknown>;
  schemaVersionId: string;
  batchId: string;
  sourceVersion: number;
}

/* ---------------------------------------------------------------------------
 * Schema discovery pipeline (PDF: Schema Discovery, page 16)
 * ------------------------------------------------------------------------- */

export type DiscoveryPhase =
  | "discover"
  | "profile"
  | "classify"
  | "version"
  | "review"
  | "propose";

export interface DiscoveryResult {
  phase: DiscoveryPhase;
  datasetId: string;
  completed: boolean;
  notes: string;
}

/* ---------------------------------------------------------------------------
 * Schema compatibility / validation (PDF: Schema Compatibility, page 20)
 * ------------------------------------------------------------------------- */

export type ValidationIssue =
  | { type: "currency-rounding"; field: string; detail: string }
  | { type: "timezone-ambiguous"; field: string; detail: string }
  | { type: "pk-collision"; field: string; detail: string }
  | { type: "new-nullable-field"; field: string; detail: string }
  | { type: "field-removed"; field: string; detail: string }
  | { type: "type-narrowed"; field: string; detail: string }
  | { type: "delete-semantics-differ"; detail: string };

export type ValidationOutcome =
  | { status: "accept" }
  | { status: "quarantine"; issues: ValidationIssue[] }
  | { status: "block"; issues: ValidationIssue[] };

/* ---------------------------------------------------------------------------
 * Resilience drills (PDF: Resilience / Failure Workflow, pages 14, 46)
 * ------------------------------------------------------------------------- */

export type ScenarioId =
  | "crash-after-upload"
  | "ack-lost-after-commit"
  | "api-rate-limit"
  | "breaking-schema-change"
  | "cdc-retention-expired"
  | "agent-outage-24h"
  | "out-of-order-delete";

export interface ScenarioContext {
  batch: IngestionBatch;
  checkpoint: Checkpoint;
  run: SyncRun;
}

export interface ScenarioResult {
  scenarioId: ScenarioId;
  passed: boolean;
  steps: string[];
  finalBatchStatus: BatchStatus;
  finalCursor: string;
  /** Whether a duplicate current-state row would have been produced (must be false). */
  duplicateProduced: boolean;
}

/* ---------------------------------------------------------------------------
 * Observability metrics (PDF: Observability, page 45)
 * ------------------------------------------------------------------------- */

export interface ObservabilityMetrics {
  p95DataAgeSeconds: number;
  syncBacklog: number;
  errorRate: number; // 0–1
  throughputRowsPerSecond: number;
  queryPerformanceP95Ms: number;
}

/* ---------------------------------------------------------------------------
 * Watermarks (PDF: Publication Correctness, OLAP edition)
 * ------------------------------------------------------------------------- */

export interface PublicationRecord {
  datasetId: string;
  contractVersion: string;
  martVersion: string;
  sourceWatermark: string;
  publishedAt: string;
  biAdapter: string;
  visibleAt: string;
  status: "published" | "pending" | "failed";
}
