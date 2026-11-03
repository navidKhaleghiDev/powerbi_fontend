/**
 * Mock data layer for the Data Platform Control Center.
 *
 * Since the standalone data platform has no backend API,
 * this module generates realistic state using the domain logic.  The domain
 * hooks in `src/lib/hook/data-platform/` consume this through TanStack Query
 * so the UI has the same data-fetching shape as every other feature.
 *
 * The integration contract is explicit: every type returned here matches what
 * a real backend would return.  Replacing the mock functions with HTTP calls
 * to `http.get(...)` is a one-function swap.
 */

import { organization } from "./organization";
import { scenarioEngine } from "./scenarios";
import { schemaDiscovery } from "./schemaDiscovery";
import { batchStateMachine } from "./stateMachine";
import type {
  BatchStatus,
  Checkpoint,
  Connection,
  Dataset,
  IngestionBatch,
  ObservabilityMetrics,
  Organization,
  QualityResult,
  SchemaVersion,
  SyncPolicy,
  SyncRun,
  WarehouseRecord,
} from "./types";

/* ---------------------------------------------------------------------------
 * Organizations
 * ------------------------------------------------------------------------- */

/* ---------------------------------------------------------------------------
 * Connections
 * ------------------------------------------------------------------------- */

const connections: Connection[] = [
  {
    connectionId: "conn-1",
    organizationId: organization.organizationId,
    secretRef: "secret/conn-1",
    engineType: "postgres",
  },
  {
    connectionId: "conn-2",
    organizationId: organization.organizationId,
    secretRef: "secret/conn-2",
    engineType: "api",
  },
  {
    connectionId: "conn-3",
    organizationId: organization.organizationId,
    secretRef: "secret/conn-3",
    agentId: "agent-1",
    engineType: "mysql",
  },
  {
    connectionId: "conn-4",
    organizationId: organization.organizationId,
    secretRef: "secret/conn-4",
    agentId: "agent-2",
    engineType: "files",
  },
];

/* ---------------------------------------------------------------------------
 * Datasets
 * ------------------------------------------------------------------------- */

const datasets: Dataset[] = [
  {
    datasetId: "ds-1",
    sourceId: "conn-1",
    sourceLocator: "public.sales_orders",
    recordGrain: "order-line",
  },
  {
    datasetId: "ds-2",
    sourceId: "conn-1",
    sourceLocator: "public.order_lines",
    recordGrain: "order-line",
  },
  {
    datasetId: "ds-3",
    sourceId: "conn-2",
    sourceLocator: "/api/v1/customers",
    recordGrain: "order-line",
  },
  {
    datasetId: "ds-4",
    sourceId: "conn-3",
    sourceLocator: "erp.clients",
    recordGrain: "order-line",
  },
  {
    datasetId: "ds-5",
    sourceId: "conn-4",
    sourceLocator: "inventory/*.csv",
    recordGrain: "stock-movement",
  },
];

/* ---------------------------------------------------------------------------
 * Schema versions
 * ------------------------------------------------------------------------- */

const schemaVersions: SchemaVersion[] = [
  {
    versionId: "sv-1",
    datasetId: "ds-1",
    fingerprint: "fp_abc123",
    fields: [
      {
        name: "order_id",
        sourceType: "UUID",
        nullable: false,
        pii: false,
        classification: "identifier",
      },
      {
        name: "customer_id",
        sourceType: "UUID",
        nullable: false,
        pii: false,
        classification: "identifier",
      },
      {
        name: "total_amount",
        sourceType: "DECIMAL(18,2)",
        nullable: false,
        pii: false,
        classification: "money",
      },
      {
        name: "created_at",
        sourceType: "TIMESTAMPTZ",
        nullable: false,
        pii: false,
        classification: "timestamp",
      },
    ],
  },
  {
    versionId: "sv-2",
    datasetId: "ds-3",
    fingerprint: "fp_def456",
    fields: [
      {
        name: "client_uuid",
        sourceType: "UUID",
        nullable: false,
        pii: false,
        classification: "identifier",
      },
      {
        name: "name",
        sourceType: "TEXT",
        nullable: true,
        pii: true,
        classification: "pii",
      },
      {
        name: "email",
        sourceType: "TEXT",
        nullable: true,
        pii: true,
        classification: "pii",
      },
      {
        name: "created_at",
        sourceType: "TIMESTAMPTZ",
        nullable: false,
        pii: false,
        classification: "timestamp",
      },
    ],
  },
];

/* ---------------------------------------------------------------------------
 * Sync policies
 * ------------------------------------------------------------------------- */

const syncPolicies: SyncPolicy[] = [
  {
    policyId: "pol-1",
    datasetId: "ds-1",
    mode: "log-cdc",
    schedule: "*/5 * * * *",
    deleteStrategy: "cdc-tombstone",
  },
  {
    policyId: "pol-2",
    datasetId: "ds-2",
    mode: "incremental-polling",
    schedule: "*/15 * * * *",
    deleteStrategy: "reconciliation",
  },
  {
    policyId: "pol-3",
    datasetId: "ds-3",
    mode: "incremental-polling",
    schedule: "0 * * * *",
    deleteStrategy: "soft",
  },
  {
    policyId: "pol-4",
    datasetId: "ds-4",
    mode: "full-snapshot",
    schedule: "0 2 * * *",
    deleteStrategy: "soft",
  },
  {
    policyId: "pol-5",
    datasetId: "ds-5",
    mode: "full-snapshot",
    schedule: "0 4 * * *",
    deleteStrategy: "soft",
  },
];

/* ---------------------------------------------------------------------------
 * Sync runs
 * ------------------------------------------------------------------------- */

const syncRuns: SyncRun[] = [
  {
    runId: "run-1",
    policyId: "pol-1",
    status: "succeeded",
    attempt: 1,
    startedAt: "2026-11-01T09:00:00Z",
  },
  {
    runId: "run-2",
    policyId: "pol-2",
    status: "succeeded",
    attempt: 1,
    startedAt: "2026-11-01T09:15:00Z",
  },
  {
    runId: "run-3",
    policyId: "pol-1",
    status: "running",
    attempt: 2,
    startedAt: "2026-11-01T10:00:00Z",
  },
  {
    runId: "run-4",
    policyId: "pol-3",
    status: "failed",
    attempt: 3,
    startedAt: "2026-11-01T09:30:00Z",
  },
  {
    runId: "run-5",
    policyId: "pol-4",
    status: "quarantined",
    attempt: 1,
    startedAt: "2026-11-01T02:00:00Z",
  },
];

/* ---------------------------------------------------------------------------
 * Ingestion batches (using the state machine for realistic lifecycle)
 * ------------------------------------------------------------------------- */

const makeBatch = (
  batchId: string,
  runId: string,
  status: BatchStatus,
  cursor: string,
): IngestionBatch => ({
  batchId,
  runId,
  manifestUri: `s3://raw/${batchId}.json`,
  rowCount: Math.floor(Math.random() * 5000) + 500,
  status,
  sourceCursor: cursor,
});

const ingestionBatches: IngestionBatch[] = [
  makeBatch("batch-1", "run-1", "published", "cursor-500"),
  makeBatch("batch-2", "run-1", "published", "cursor-600"),
  makeBatch("batch-3", "run-2", "applied", "cursor-700"),
  makeBatch("batch-4", "run-2", "verified", "cursor-750"),
  makeBatch("batch-5", "run-3", "uploaded", "cursor-800"),
  makeBatch("batch-6", "run-3", "extracted", "cursor-850"),
  makeBatch("batch-7", "run-4", "verified", "cursor-900"),
  makeBatch("batch-8", "run-5", "verified", "cursor-950"),
];

/* ---------------------------------------------------------------------------
 * Checkpoints
 * ------------------------------------------------------------------------- */

const checkpoints: Checkpoint[] = [
  {
    checkpointId: "cp-1",
    policyId: "pol-1",
    committedCursor: "cursor-600",
    cursorFormat: "lsn-binlog",
  },
  {
    checkpointId: "cp-2",
    policyId: "pol-2",
    committedCursor: "cursor-700",
    cursorFormat: "updated_at-pk",
  },
  {
    checkpointId: "cp-3",
    policyId: "pol-3",
    committedCursor: "cursor-650",
    cursorFormat: "provider-token",
  },
  {
    checkpointId: "cp-4",
    policyId: "pol-4",
    committedCursor: "cursor-0",
    cursorFormat: "file-version",
  },
];

/* ---------------------------------------------------------------------------
 * Quality results
 * ------------------------------------------------------------------------- */

const qualityResults: QualityResult[] = [
  {
    qualityId: "qr-1",
    batchId: "batch-3",
    verdict: "accept",
    rulesetVersion: "v1",
    failures: {},
  },
  {
    qualityId: "qr-2",
    batchId: "batch-4",
    verdict: "accept",
    rulesetVersion: "v1",
    failures: {},
  },
  {
    qualityId: "qr-3",
    batchId: "batch-7",
    verdict: "reject",
    rulesetVersion: "v1",
    failures: { "currency-rounding": 12 },
  },
  {
    qualityId: "qr-4",
    batchId: "batch-8",
    verdict: "reject",
    rulesetVersion: "v1",
    failures: { "field-removed": 1 },
  },
];

/* ---------------------------------------------------------------------------
 * Warehouse records (sample from the sales mart)
 * ------------------------------------------------------------------------- */

const warehouseRecords: WarehouseRecord[] = [
  {
    recordKey: "wr-1",
    layer: "raw",
    identity: {
      organizationId: organization.organizationId,
      sourceId: "conn-1",
      datasetId: "ds-1",
      sourcePrimaryKey: "ord-100",
    },
    data: {
      order_id: "ord-100",
      customer_id: "cust-1",
      total_amount: 1250.5,
      created_at: "2026-10-15T10:30:00Z",
    },
    schemaVersionId: "sv-1",
    batchId: "batch-1",
    sourceVersion: 500,
  },
  {
    recordKey: "wr-2",
    layer: "staging",
    identity: {
      organizationId: organization.organizationId,
      sourceId: "conn-1",
      datasetId: "ds-1",
      sourcePrimaryKey: "ord-100",
    },
    data: {
      order_id: "ord-100",
      customer_id: "cust-1",
      total_amount: 1250.5,
      created_at: "2026-10-15T10:30:00Z",
    },
    schemaVersionId: "sv-1",
    batchId: "batch-1",
    sourceVersion: 500,
  },
  {
    recordKey: "wr-3",
    layer: "core",
    identity: {
      organizationId: organization.organizationId,
      sourceId: "conn-1",
      datasetId: "ds-1",
      sourcePrimaryKey: "ord-100",
    },
    data: {
      order_id: "ord-100",
      customer_id: "cust-1",
      total_amount: 1250.5,
      created_at: "2026-10-15T10:30:00Z",
    },
    schemaVersionId: "sv-1",
    batchId: "batch-1",
    sourceVersion: 500,
  },
  {
    recordKey: "wr-4",
    layer: "marts",
    identity: {
      organizationId: organization.organizationId,
      sourceId: "conn-1",
      datasetId: "ds-1",
      sourcePrimaryKey: "ord-100",
    },
    data: {
      sales_line_key: "sl-1",
      order_id: "ord-100",
      product_key: "p-1",
      customer_key: "c-1",
      date_key: "2026-10-15",
      company_key: "co-1",
      quantity: 1,
      net_amount: 1250.5,
    },
    schemaVersionId: "sv-1",
    batchId: "batch-1",
    sourceVersion: 500,
  },
];

/* ---------------------------------------------------------------------------
 * Observability metrics
 * ------------------------------------------------------------------------- */

const observabilityMetrics: ObservabilityMetrics = {
  p95DataAgeSeconds: 320,
  syncBacklog: 3,
  errorRate: 0.02,
  throughputRowsPerSecond: 850,
  queryPerformanceP95Ms: 145,
};

/* ---------------------------------------------------------------------------
 * Public API — these are what the hooks call.  They return Promises so they
 * have the same shape as real HTTP calls.
 * ------------------------------------------------------------------------- */

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const dataPlatformApi = {
  async getOrganization(): Promise<Organization> {
    await delay(100);
    return organization;
  },

  async getConnections(): Promise<Connection[]> {
    await delay(100);
    return connections;
  },

  async getDatasets(): Promise<Dataset[]> {
    await delay(100);
    return datasets;
  },

  async getSchemaVersions(): Promise<SchemaVersion[]> {
    await delay(100);
    return schemaVersions;
  },

  async getSyncPolicies(): Promise<SyncPolicy[]> {
    await delay(100);
    return syncPolicies;
  },

  async getSyncRuns(): Promise<SyncRun[]> {
    await delay(100);
    return syncRuns;
  },

  async getIngestionBatches(): Promise<IngestionBatch[]> {
    await delay(100);
    return ingestionBatches;
  },

  async getCheckpoints(): Promise<Checkpoint[]> {
    await delay(100);
    return checkpoints;
  },

  async getQualityResults(): Promise<QualityResult[]> {
    await delay(100);
    return qualityResults;
  },

  async getWarehouseRecords(): Promise<WarehouseRecord[]> {
    await delay(100);
    return warehouseRecords;
  },

  async getObservabilityMetrics(): Promise<ObservabilityMetrics> {
    await delay(100);
    return observabilityMetrics;
  },

  async getScenarioResults() {
    await delay(150);
    return scenarioEngine.runAllScenarios();
  },

  async getBatchStatusOrder(): Promise<BatchStatus[]> {
    return batchStateMachine.ORDER;
  },

  async getDiscoveryPhases() {
    return schemaDiscovery.PHASE_ORDER;
  },
};
