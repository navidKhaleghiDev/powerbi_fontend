export type ColumnType =
  "String" | "Int64" | "Float64" | "Decimal(18,2)" | "Date";
export interface ColumnMapping {
  source: string;
  target: string;
  type: ColumnType;
  required: boolean;
}
export interface PostgresConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
}
export interface Infrastructure {
  clickhouse: { url: string; database: string; user: string; password: string };
  kafka: {
    connectUrl: string;
    brokers: string;
    user: string;
    password: string;
  };
}
export interface DataFlow {
  /** Explicit synthetic sample; never a live warehouse source. */
  sampleData?: boolean;
  id: string;
  name: string;
  kind: "postgres" | "csv";
  connectionId?: string;
  schema?: string;
  table?: string;
  columns: ColumnMapping[];
  primaryKey: string;
  grain: string;
  status: "draft" | "capture_started" | "published" | "failed";
  activeLoadId?: string;
  sourceWatermark?: { partition: number | string; offset: string }[];
  rowCount?: number;
  publishedAt?: string;
  error?: string;
  connectorName?: string;
  schemaContract?: SourceColumn[];
  createdAt: string;
}
export interface ImportRun {
  id: string;
  flowId: string;
  checksum: string;
  fileName: string;
  rowCount: number;
  status: "uploaded" | "verified" | "applied" | "published" | "failed";
  createdAt: string;
  error?: string;
}
export type ChartKind = "bar" | "line" | "pie" | "table" | "kpi";
export type Aggregation = "sum" | "count" | "avg";
export interface ReportWidget {
  filterField?: string;
  filterValue?: string;
  dateField?: string;
  dateFrom?: string;
  dateTo?: string;
  bindingId?: string;
  id: string;
  title: string;
  flowId: string;
  kind: ChartKind;
  dimension: string;
  measure: string;
  aggregation: Aggregation;
}
export interface SavedReport {
  publishedRevision?: number;
  ownerId?: string;
  revision?: number;
  publishedAt?: string;
  publishedWidgets?: ReportWidget[];
  id: string;
  name: string;
  widgets: ReportWidget[];
  updatedAt: string;
}
export interface FlowStore {
  version: 1;
  users: WorkspaceUser[];
  audit: AuditEntry[];
  bindings: MetricBinding[];
  infrastructure: Infrastructure;
  connections: PostgresConnection[];
  flows: DataFlow[];
  runs: ImportRun[];
  reports: SavedReport[];
}
export interface PublicConnection extends Omit<PostgresConnection, "password"> {
  hasPassword: boolean;
}
export interface PublicInfrastructure {
  clickhouse: Omit<Infrastructure["clickhouse"], "password"> & {
    hasPassword: boolean;
  };
  kafka: Omit<Infrastructure["kafka"], "password"> & { hasPassword: boolean };
}
export interface WorkspaceState {
  currentUser: SessionUser;
  users?: SessionUser[];
  audit?: AuditEntry[];
  bindings: MetricBinding[];
  infrastructure: PublicInfrastructure;
  connections: PublicConnection[];
  flows: DataFlow[];
  runs: ImportRun[];
  reports: SavedReport[];
}
export interface SourceColumn {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
}
export interface SourceTable {
  schema: string;
  name: string;
  columns: SourceColumn[];
}
export interface CsvPreview {
  columns: string[];
  rows: Record<string, string>[];
  rowCount: number;
}
export interface AnalyticsResult {
  rows: Record<string, string | number | null>[];
  queriedAt: string;
  publishedAt?: string;
  limit: number;
}
export interface WorkspaceUser {
  id: string;
  username: string;
  role: "provider" | "customer";
  dataAccess: boolean;
  passwordHash: string;
  credentialVersion: number;
}
export type SessionUser = Pick<
  WorkspaceUser,
  "id" | "username" | "role" | "dataAccess"
>;
export interface AuditEntry {
  id: string;
  at: string;
  actorId: string;
  action: string;
  targetId: string;
}
export type MetricId =
  | "record_count"
  | "customer_count"
  | "order_count"
  | "sales_amount"
  | "average_order_value"
  | "completed_revenue"
  | "gross_margin"
  | "retention"
  | "net_profit";
export interface MetricBinding {
  requestResolved?: boolean;
  id: string;
  metricId: MetricId;
  flowId: string;
  fields: Record<string, string>;
  currency: string;
  definition: string;
  ownerId: string;
  approvedBy?: string;
  approvedAt?: string;
  validatedLoadId?: string;
  expected?: string;
  tolerance?: string;
  actual?: string;
  validatedAt?: string;
}

export interface DeploymentStatus {
  localAppPort: number;
  docker: "missing" | "permission_required" | "accessible" | "external";
  composePrepared: boolean;
  verifiedAt: string | null;
  checkedAt: string;
}
export interface PublishedDataPreview {
  columns: string[];
  rows: Record<string, string | number | null>[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  loadId: string;
  publishedAt?: string;
  queriedAt: string;
}
