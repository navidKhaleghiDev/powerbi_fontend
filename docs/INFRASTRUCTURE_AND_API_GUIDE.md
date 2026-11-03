# Infrastructure and background API guide — راهنمای زیرساخت

This guide describes the integrated local stack in the repository-root `compose.yaml`. It explains what to prepare first, which actions to run, and what the application does behind each action. It documents the implementation; it is not a certificate of current service health.

## 1. Understand the two setups

| Setup | Source | Purpose |
| --- | --- | --- |
| Root `compose.yaml` | `bi_source.sales.orders` | Application-connected local pilot; use this guide |
| `cdc/docker-compose.yml` | `financial_db.public.orders` | Separate standalone CDC example |

Do not register `cdc/connectors/postgres-source.json` into the integrated stack. The application generates connector configuration for each saved flow. The root stack uses synthetic orders and real local CDC infrastructure; it does not establish a live PBRS, SSAS, LDAP, or external Power BI integration.

## 2. Architecture — اجزای زیرساخت

```text
Browser: Configuration / Analytics
                  |
                  v
Next.js application: authenticated workspace API
     |                  |                  |
     v                  v                  v
PostgreSQL SQL     Kafka Connect REST   ClickHouse HTTP
schema discovery  connector management  DDL / publish / analytics

Background data movement:
PostgreSQL WAL -> Debezium in Kafka Connect -> Kafka topic
    -> ClickHouse Kafka table -> materialized view -> raw history

Explicit publication:
raw history -> validated current-state snapshot -> analytics
```

The application manages configuration and publication. Debezium and ClickHouse continue capturing data independently of an open browser. Starting capture, publishing data, and publishing a dashboard are separate actions.

## 3. What must be ready first? — پیش‌نیازها

1. Install Docker Engine and the Docker Compose plugin. Your terminal user must be able to access the Docker daemon.
2. Have Node.js available to run the repository's wrapper scripts; the application image uses Node 22.
3. Run commands from the repository root, where `compose.yaml` and `package.json` exist.
4. Provide internet access for the initial image pulls and application dependency installation during the image build.
5. Ensure the configured host ports are available. Defaults are listed below.
6. Provide sufficient memory and disk for PostgreSQL, Kafka, Connect, ClickHouse, and the application. Declared service memory limits total about 5.5 GiB, excluding Docker/OS overhead and the image build.
7. Preserve existing `.env.compose`, application metadata, encryption key, and database volumes when restarting an existing installation.

Read-only prerequisite checks:

```bash
node --version
docker version
docker compose version
```

The application does not install Docker, start containers through an API, or mount the Docker management socket.

## 4. Start in this order — مراحل راه‌اندازی

### Step A: Prepare private configuration

```bash
npm run stack:init
```

This generates `.env.compose` if missing, creates the private metadata directory, and writes login instructions to `.data/compose-access.txt`. It preserves existing generated passwords. It does not start services or create application accounts.

Do not put these files or `master.key` into source control or shared documentation.

### Step B: Start the infrastructure and application

```bash
npm run stack:up
npm run stack:status
```

The `up` wrapper also runs initialization, then executes Docker Compose with `.env.compose`, builds the application, and waits for health checks.

On new volumes:

- PostgreSQL creates `bi_source`, the replication user `bi_cdc`, and `sales.orders`, then inserts synthetic starting rows.
- Kafka initializes persistent storage and starts its combined broker/controller.
- Connect starts after PostgreSQL and Kafka are healthy.
- ClickHouse initializes its database and user.
- The application starts after its declared dependencies are healthy.

SQL initialization scripts run only when the corresponding database volume is first initialized. Editing an init script does not update an existing database automatically.

### Step C: Provision the local walkthrough

```bash
npm run stack:provision
```

This is an explicit, mutating setup action. It runs the provisioning script inside the dedicated application container with `LOCAL_STACK_ENABLED=1`.

It authenticates through the application, sets up local provider/customer accounts, saves service settings and the source connection, tests dependencies, creates/configures the local flow, starts capture, waits for captured data, publishes a snapshot, reconciles KPI results against independent PostgreSQL totals, and prepares the governed dashboard. Failures must be resolved; configured services are not substitutes for passing checks.

For a manual setup, use the Configuration panel and follow the API sequence in section 6 instead. Provisioning is the repository's automated local walkthrough of those actions.

### Step D: Verify and open the application

```bash
npm run stack:verify
```

Verification checks the existing installation; it is not the initial provisioning step. A connector reporting `RUNNING` alone is insufficient: inspect the complete verification result, including published results and reconciliation.

Open `http://localhost:3003/fa/login` or `/en/login` using the private credentials in `.data/compose-access.txt`. Configuration is under `/fa/data-platform`; Analytics is under `/fa/analytics` (or use `/en/`).

### Step E: Exercise actual CDC changes, optionally

```bash
npm run stack:exercise
```

This deliberately changes reserved synthetic `cdc-proof-*` rows in the dedicated local source. It checks insert/update/delete behavior through raw history and the published snapshot. It is a mutating test, not a read-only health check.

## 5. Addresses and networking

| Service | Address used inside Docker | Default host access |
| --- | --- | --- |
| Application | `app:3001` | `http://localhost:3003` |
| PostgreSQL | `postgres:5432` | `127.0.0.1:55432` |
| Kafka broker | `kafka:9092` | Not exposed |
| Kafka Connect REST | `http://connect:8083` | `http://127.0.0.1:18083` |
| ClickHouse HTTP | `http://clickhouse:8123` | `http://127.0.0.1:18123` |

Use container addresses in settings for the Compose application. `localhost` inside a container means that container itself. Host ports can be overridden through the Compose environment.

The web application defaults to binding on all host interfaces; infrastructure HTTP/SQL ports bind to loopback. This pilot uses internal plaintext Kafka and is not a production security or high-availability deployment.

## 6. API workflow — هر API در پشت صحنه چه می‌کند؟

Workspace endpoints use the prefix `/api/workspace/`. Use an authenticated browser session; these are not anonymous provisioning endpoints. The normal UI supplies request bodies and session cookies.

| Order | Method and path after prefix | Required previous action | Background work / result |
| --- | --- | --- | --- |
| 1 | `GET state` | Sign in | Returns role-filtered saved workspace metadata; does not expose raw passwords |
| 2 | `POST settings` | Provider session; services started | Validates and saves ClickHouse and Kafka Connect settings; does not launch containers |
| 3 | `POST test/clickhouse` | Saved warehouse settings | Runs `SELECT version()` over ClickHouse HTTP |
| 4 | `POST test/kafka` | Saved Connect settings | Calls Connect `GET /connector-plugins` and checks for the PostgreSQL Debezium plugin |
| 5 | `POST connections` | Provider session; source details known | Saves a PostgreSQL connection and assigns a server-generated ID |
| 6 | `POST test/postgres` | Saved connection; body includes `connectionId` | Connects to PostgreSQL and returns `SHOW wal_level`; confirm it is `logical` |
| 7 | `GET connections/<id>/discover` | Reachable source | Reads table/column/type/nullability/primary-key metadata |
| 8 | `POST flows` | Discovered source; explicit field mapping | Validates the mapping, requires a single-column source primary key, saves the schema contract and a draft flow |
| 9 | `GET flows/<id>/plan` | Saved flow and infrastructure settings | Returns generated warehouse DDL and topic name; does not execute them |
| 10 | `POST flows/<id>/capture` | Valid source contract; logical replication permissions; healthy dependencies | Validates Debezium configuration, creates ClickHouse capture objects, registers/updates the connector |
| 11 | `GET flows/<id>/status` | Connector registered | Reads actual connector/task state from Connect |
| 12 | `POST flows/<id>/publish` | Raw events captured; source contract still valid | Freezes captured offset bounds, validates current rows, writes and verifies a snapshot, activates its load ID |
| 13 | `GET preview/<id>?page=0` | Active published snapshot and data-access grant | Returns mapped published rows, 50 per page; does not expose raw events |

The Kafka test checks Connect availability and the installed plugin. It does not independently prove broker health, successful replication, or end-to-end data correctness.

Infrastructure/source/capture actions require the provider role. Analytics and preview require an explicit data-access grant; provider status alone does not grant access to customer data. Requests are authenticated, authorized, and audited where implemented. Mutation requests with an Origin header are checked for same-origin access.

The HTTP handlers execute setup/publication work during the request. This implementation has no distributed background job scheduler. A per-flow in-process guard rejects overlapping mutation requests with `flowBusy`.

## 7. What happens when capture starts?

The generated configuration lives in `src/server/flows/sql.ts`; execution is in `src/server/flows/handler.ts`.

1. Re-discover the PostgreSQL table and check that mapped fields still match the saved schema contract.
2. Send the generated configuration to Connect's connector-validation endpoint.
3. Create app-owned ClickHouse raw, queue, capture-view, and mart objects.
4. Call Connect `PUT /connectors/app_<flow-id>/config`.
5. Save the connector identity in application metadata. Task readiness is checked separately through the status endpoint.

Debezium uses `pgoutput`, `snapshot.mode=initial`, one task, and stable per-flow slot/publication/topic identities. The topic is `app_<flow-id>.<schema>.<table>`. The publication is auto-created for the filtered capture scope; the PostgreSQL account must have the necessary table/publication rights in addition to replication and SELECT access. The local initialization makes `bi_cdc` the table owner and grants database CREATE.

PostgreSQL is configured for logical WAL, ten replication slots, ten WAL senders, and a 1024 MB slot WAL retention limit. A replication slot tracks the log position needed by Debezium. An extended outage can exhaust retained WAL; do not silently skip missing changes—an explicit recovery/resnapshot is required.

Connect stores configuration, offsets, and status in Kafka topics named `powerbi_connect_configs`, `powerbi_connect_offsets`, and `powerbi_connect_status`.

## 8. Kafka and ClickHouse background processing

Kafka runs one node with both broker and KRaft controller roles, with no ZooKeeper. The internal broker address is `kafka:9092`, controller port is `9093`, default partition count is one, and internal-topic replication factors are one. Default log retention is 24 hours. There is no broker redundancy.

For each captured change, Debezium produces a JSON envelope containing `before`, `after`, `op`, and source metadata such as `lsn`. Operations are snapshot read (`r`), insert (`c`), update (`u`), and delete (`d`). Decimal values use string representation to preserve precision. Kafka null tombstones are disabled, but delete envelopes remain enabled.

ClickHouse consumes directly; there is no separate ClickHouse sink connector:

| Object | Purpose |
| --- | --- |
| `app_queue_<flow-id>` | Kafka engine, one consumer, reads the flow topic as JSON strings |
| `app_capture_<flow-id>` | Materialized view forwarding messages to raw storage |
| `app_raw_<flow-id>` | MergeTree history with event, topic, partition, offset, and receipt time |
| `app_mart_<flow-id>` | ReplacingMergeTree storing published snapshots by load ID and primary key |

Kafka offsets identify positions within a partition; PostgreSQL LSN identifies the source log position. Current-state reconstruction selects the latest event per mapped primary key ordered by LSN, partition, and offset. A latest delete removes that row from current results while retaining its event in raw history.

## 9. Publication and dashboards — انتشار

Continuous capture does not continuously refresh the published dashboard data.

`POST flows/<id>/publish` freezes the maximum offsets already present in raw storage, constructs current rows within those bounds, validates types/required fields, writes a snapshot, checks its row count, and only then changes `activeLoadId`. Its bounds describe captured data; they do not by themselves prove the source has fully caught up. Independent source reconciliation supplies additional correctness evidence.

On failed publication, the previous active snapshot remains available. Writes across Kafka, ClickHouse, and local metadata are not one distributed atomic transaction.

For a governed report, metric bindings also need provider approval and exact reconciliation against independent expected totals for the active load. A new active load requires renewed validation. `POST /api/workspace/reports/<id>/publish` checks widget readiness and snapshots the report layout. Publishing a report does not start CDC or publish a new data snapshot.

## 10. Persistence, restart, and troubleshooting

Application configuration is encrypted using AES-256-GCM in the private `.data/compose-workspace` directory. `master.key` decrypts that metadata; it is not a Kafka credential. Back it up together with the encrypted metadata. Back up PostgreSQL, Kafka, and ClickHouse volumes separately.

```bash
npm run stack:logs
npm run stack:stop
npm run stack:up
```

Stop preserves data. Do not use `docker compose down --volumes` as a repair step: it deletes database/broker volumes. Current application control metadata requires one Node process and persistent private storage.

| Symptom | Next check |
| --- | --- |
| Docker permission denied | Host Docker-daemon access; this is different from an unhealthy database |
| Missing login accounts | Confirm `stack:provision` completed successfully |
| `kafkaUnavailable` | Connect reachability, plugin availability, connector/task status, and logs |
| Connector RUNNING but no published rows | Initial snapshot progress, raw capture, ClickHouse consumption, and separate publication action |
| Dashboard still shows previous values | Confirm new raw events arrived, then publish and reconcile the new snapshot |
| `schemaChanged` | Compare the mapped source fields to the saved schema contract |
| `qualityFailed` | Inspect mapped types, required values, primary key, and snapshot verification |
| `dataAccessRequired` | Check the signed-in account's explicit data grant |
| Changed init SQL has no effect | Existing volumes were already initialized; apply a reviewed migration |

## 11. Implementation references

- `compose.yaml`: images, network addresses, health checks, volumes, broker settings.
- `deploy/postgres/01-source.sh`: source schema, account, and synthetic rows.
- `scripts/init-local-stack.mjs`: private configuration initialization.
- `scripts/local-stack.mjs`: Docker Compose command wrappers.
- `scripts/provision-local-stack.ts`: local provisioning, independent reconciliation, and CDC exercise.
- `src/app/api/workspace/[...path]/route.ts`: Next.js workspace API entry point.
- `src/server/flows/handler.ts`: authorization and API action orchestration.
- `src/server/flows/services.ts`: PostgreSQL, Connect REST, and ClickHouse HTTP clients.
- `src/server/flows/sql.ts`: connector configuration, capture DDL, current-state and analytics SQL.
- `src/server/flows/import.ts`: snapshot validation and activation.
- `src/server/flows/store.ts`: encrypted application metadata persistence.
