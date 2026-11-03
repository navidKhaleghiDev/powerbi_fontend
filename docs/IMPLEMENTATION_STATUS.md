# Connected BI pilot — implementation and acceptance status

Sources: `Data_Platform_Architecture_V4_OLAP_PowerBI_Delivery.pdf` (53 pages) and `bi_platform_product_requirements.md` v1.0. This document describes the implemented pilot, not completion of every PRD phase.

## Explicit decisions from this session

- Keep the existing standalone application; do not merge it back into CRM.
- One organization per deployment. The PRD's pooled multi-tenant product is a future capability, not silently enabled.
- PostgreSQL is the first database source. Existing Debezium, Kafka and ClickHouse can be configured. An optional isolated Docker Compose stack now provisions local services and a synthetic source database; the web UI does not install system packages.
- Two routes: provider configuration `/[locale]/data-platform`, customer analytics `/[locale]/analytics`, with a top panel toggle.
- User requested the easiest initial permissions approach: local pilot accounts. This supersedes the earlier “no local auth / LDAP only” plan for this pilot. LDAP/SSO remains a future integration; no AD/SSAS access-management feature was reintroduced.
- Native charts are a pilot renderer. This is not Microsoft Power BI embedding, a DAX engine, or a complete Power BI clone. Actual Microsoft delivery still needs a verified deployment/integration decision.

## Implemented flow

1. First-time local setup requires a one-time key in `.data/bootstrap.key`. Create the initial provider account and explicitly choose whether it may inspect customer data.
2. Provider saves real ClickHouse and Kafka Connect settings; passwords are encrypted at rest and never returned through the workspace API.
3. Provider adds PostgreSQL sources. Discovery uses a read-only PostgreSQL session, parameter-safe catalog SQL, connection/statement timeouts, and one primary-key-column prerequisite for the initial CDC slice.
4. Define a dataset, declared row grain, stable primary key and exact target types. Mappings are fixed per flow; a changed contract creates a new flow.
5. CSV path: UTF-8 CSV preview, bounded upload (2 MiB / 5,000 records), raw file archive, required/type/precision/uniqueness validation, bounded ClickHouse inserts, verified row count, publication-pointer activation. Errors preserve the previously published snapshot. CSV is a complete replacement snapshot, not an incremental append; retries of the same content have a deterministic load ID.
6. Database path: review dedicated ClickHouse DDL, validate/register a Debezium PostgreSQL connector through Kafka Connect, consume its JSON envelopes with ClickHouse's Kafka engine into raw history. PostgreSQL WAL, replication and publication privileges must be supplied by the database owner. Starting Debezium may create its dedicated publication and replication slot; no operational source business rows are written by the app.
7. CDC publication freezes per-partition Kafka offset bounds, resolves current rows with source LSN/order and deletes, checks mapped source-schema drift and data validity, and publishes a separate typed snapshot. Stream capture alone does not activate a customer dataset. Kafka transport and ClickHouse writes are not claimed to be a cross-system atomic transaction.
8. Customer starts at a KPI catalog. Requests can be recorded before data exists. Missing sources/mappings/reviews remain visible. Net profit, retention, gross margin and completed-payment revenue are intentionally unsupported until their multi-entity/history/accounting models exist.
9. Supported fixed formulas: record count, distinct customers, distinct orders, approved monetary sum, and average order value. Currency measures require Decimal(18,2) and an explicit currency. Definition prose is explanatory, not executable SQL or an inferred accounting policy; the published dataset must satisfy the reviewed inclusion/exclusion assumptions.
10. Provider explicitly approves a definition. A data-authorized user reconciles its unfiltered warehouse result against an independent control total using exact scaled-integer tolerance comparison. A new dataset publication invalidates reconciliation for the older data version.
11. Only ready KPIs generate a draft dashboard. Charts, tables, KPIs, text/date filters, visual ordering, CSV export and server-persisted report drafts are available. Free-form exploratory visuals are allowed in drafts but cannot pass governed publication.
12. Publishing checks every visual's binding and current validation server-side. Published layouts are snapshotted; other users see the published layout, not another user's private draft. Query errors/stale validation are shown rather than silently generating substitute numbers.

## Authorization boundaries

- HttpOnly, SameSite=Strict signed sessions expire after eight hours. Passwords use salted scrypt; failed sign-ins have a per-process limit. No default username/password is shipped.
- Both protected layouts and API handlers enforce permissions. UI toggles are not authorization.
- Customers cannot change infrastructure, add sources, start capture, create accounts, or approve definitions. They can request/propose KPIs, validate permitted data, and manage their own reports.
- Provider data inspection is an explicit grant. Providers without it cannot execute analytics and do not receive reconciliation amounts in workspace responses.
- Customer workspace responses omit provider connection records, service addresses, account lists, import runs and provider audit records. Account switches clear query caches.
- Changes to control metadata are audited with actor IDs, operation and target; no raw passwords or source records are included in audit payloads. Audited metadata updates use the same local atomic file replacement.
- This is a private single-organization pilot, not enterprise multi-tenant RBAC/ABAC/RLS. Use HTTPS and a deployment/network boundary before production use. No cloud account, billing, shared tenant service, directory integration, or support impersonation is implied.

## Storage / operational boundary

- ClickHouse contains only dedicated `app_*_<flow-id>` objects created by this application in the configured existing database. Existing business warehouse tables are not replaced or dropped.
- The control plane uses encrypted local metadata, an atomic replacement file and one Node server process. `.data` must be a persistent private volume. Back up `.data/workspace.enc` and `.data/master.key` together. CSV raw files remain private local archives and require a retention policy.
- Current CSV work is bounded request-time processing with persisted states. It is not a distributed scheduler or automatic crash-resume worker. Retry a failed import with the same file; publication remains guarded.
- Kafka brokers must be reachable from the ClickHouse server, not merely from the web server/browser. Initial Kafka-engine configuration targets private PLAINTEXT brokers; TLS/SASL/named-collection operations require an additional configured integration.
- This implementation has no separate staging/core canonical business models, cross-source identity resolution, joins, automated source resnapshot/backfills, scheduling console, raw archive retention automation, or automatic semantic model provisioning in Microsoft Power BI.
- Legacy overview/monitoring screens, launch control and child routes have been removed. Only the connected Configuration and Analytics panels remain. Architecture helper tests retain isolated fixtures.

## PRD acceptance mapping

| ID    | Implemented evidence                                                                          | Remaining acceptance work                                                               |
| ----- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| FR-01 | Local role-based pilot sign-in, protected routes and APIs                                     | Existing organizational SSO / directory integration                                     |
| FR-02 | KPI-first catalog, persisted requests, dependencies and five readiness states                 | Additional pilot-specific KPI definitions/history                                       |
| FR-03 | Encrypted credentials, role checks, real service tests, read-only discovery                   | Production vault, network policy, delegated credentials                                 |
| FR-04 | PostgreSQL table/column/PK discovery and mapped-schema drift gate                             | Profiling and sensitive-field review workflows                                          |
| FR-05 | Definition approval, exact reconciliation, publication blockers                               | Business-owner signoff on actual customer control totals                                |
| FR-06 | Saved reusable flows, Debezium provisioning, CSV run states and retries                       | Durable orchestration, schedules, automatic backfills, approved KPI-to-pipeline planner |
| FR-07 | Typed published ClickHouse snapshots, fixed governed metric formulas                          | Canonical star models, approved joins and Microsoft semantic models                     |
| FR-08 | Draft dashboards generated from ready KPI bindings                                            | Industry templates and actual Power BI provisioning                                     |
| FR-09 | Visual types, grouping, text/date filters, ordering, saved drafts and publication             | Cross-filtering/drill-through, comparisons, targets, governed sharing policies          |
| FR-10 | Published timestamps, query errors and stale KPI-validation indication                        | Measured end-to-end source freshness and BI visibility SLOs                             |
| FR-11 | One isolated organization per process/metadata store with scoped APIs                         | Shared multi-tenant isolation testing, row-level entitlements and export/embed policies |
| FR-12 | Protected provider source/configuration, flows, reviews and audit                             | Fleet-wide tenant administration and warehouse tuning                                   |
| FR-13 | KPI definitions, field mappings, source contract, frozen load IDs and validation evidence     | Full transformation/semantic lineage graph                                              |
| FR-14 | Named actors and audited configuration/approval/publication changes                           | Tamper-resistant remote audit, retention and support-grant workflows                    |
| FR-15 | Safe CSV replay, stable connector identity, drift blocking, previous publication preservation | Live outage drills, CDC retention recovery and distributed transaction acceptance       |

## Verification and live integration

- TypeScript, targeted ESLint, the existing domain suite and new CSV/API/auth/publication/governance tests.
- Browser walkthroughs cover source configuration and CSV through report persistence, plus provider/customer isolation, failed reconciliation, approval, KPI-generated publication, Persian RTL and mobile.
- Browser external services are isolated HTTP contract fixtures. No real PostgreSQL/Kafka/Debezium/ClickHouse endpoint or credentials were provided during implementation. These walkthroughs do not certify real connector privileges, Kafka delivery semantics, ClickHouse SQL compatibility for the installed version, production volume or freshness.
- A live acceptance run needs: PostgreSQL host/database and replication account; Kafka Connect URL and installed PostgreSQL plugin; brokers reachable from ClickHouse; ClickHouse HTTP(S) address, existing database and permitted account; Kafka security settings; and an independently agreed business control total.

## Primary technical references consulted

- https://debezium.io/documentation/reference/stable/connectors/postgresql.html
- https://kafka.apache.org/42/kafka-connect/user-guide/
- https://clickhouse.com/docs/reference/engines/table-engines/integrations/kafka
- https://clickhouse.com/docs/reference/formats/JSON/JSONAsString
- https://clickhouse.com/docs/concepts/features/interfaces/http
- Installed Next.js 16 route handler documentation.

## Local Compose extension

- Added PostgreSQL with logical WAL and a dedicated source role; Kafka in single-node KRaft mode; Debezium Connect; ClickHouse; and a containerized copy of this application.
- Default local application port is 3003. Existing host application/accounts on 3001 are preserved. New local metadata and generated private passwords are isolated.
- Setup uses the existing protected API workflow to publish a snapshot, propose/approve/reconcile KPIs against PostgreSQL control totals and publish an eight-visual dashboard.
- Verification and an explicit insert/update/delete exercise are available as commands. Live outcome must be read from the dated work report/evidence, not inferred from this implementation list.
