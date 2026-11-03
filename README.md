# BI Control Center — connected single-organization pilot

Provider configuration: `/fa/data-platform`. Customer KPI and report workspace: `/fa/analytics`. Top-level navigation switches panels according to server-checked permissions. The app remains independent of CRM.

## Run

Node.js 22.12+. `npm ci`, `npm run build`, `npm start`. Servers use port 3001 and all interfaces in the installed project. Use `npm run dev` for development.

## Optional local Docker Compose stack

The complete local PostgreSQL → Debezium/Kafka → ClickHouse → application stack is described in [the Persian Compose guide](docs/DOCKER_COMPOSE_FA.md). It uses isolated named volumes and `.data/compose-workspace`, with the application on port **3003** by default. The existing host app on 3001 and its accounts remain unchanged.

```bash
npm run stack:init
npm run stack:up
npm run stack:provision
npm run stack:verify
```

Generated local account passwords are in private `.data/compose-access.txt`. `stack:exercise` performs insert/update/delete acceptance checks on reserved synthetic rows and republishes/reconciles the dashboard. `stack:stop` preserves data. Runtime verification is only complete when the evidence file has been written successfully; prepared configuration alone is not a passing live test.

## Initial sign-in

Open `/fa/login`. The first setup requires the one-time key at `.data/bootstrap.key` (generated when the sign-in page requests setup status). Choose your own provider username and password (12+ characters). There are no default credentials. Provider data inspection requires an explicit grant. Create customer accounts in the provider pilot-account section.

## Implemented stack

PostgreSQL discovery; Debezium provisioning via Kafka Connect; Kafka-engine raw landing and typed published snapshots in ClickHouse; CSV preview/mapping/import; KPI readiness, definition review, reconciliation, generated draft dashboards, persisted report editing and governed publication. Native report visuals query only published ClickHouse snapshots. No real service addresses were supplied; users must configure their own services.

## Storage

Keep `.data` on a private persistent volume. Metadata is encrypted and sessions are signed using server-private key material. Back up workspace.enc and master.key together. CSV raw files are private local archives. This implementation supports one Node process and one organization; it is not a pooled multi-tenant deployment or distributed scheduler. Use HTTPS for a production deployment.

## Verification

`npm run check-types`, `npm test`, `npm run build`. Browser integration checks used isolated HTTP contract fixtures, not production PostgreSQL/Kafka/ClickHouse services.

## Documentation

- [Persian getting started](docs/GETTING_STARTED_FA.md)
- [Implementation / PRD acceptance matrix and remaining work](docs/IMPLEMENTATION_STATUS.md)
- [Product requirements baseline](docs/bi_platform_product_requirements.md)
- `docs/Data_Platform_Architecture_V4_OLAP_PowerBI_Delivery.pdf`

Microsoft Power BI/SSAS/PBRS integration, canonical multi-source business models, directory SSO, production RLS, scheduling/backfills, alerts and billing remain outside this pilot. Unsupported financial KPIs are blocked. Legacy monitoring demo pages and navigation have been removed; the active application contains Configuration and Analytics only.

## See progress and data in the application

Configuration opens on Pipeline overview, showing saved source/connector/publication counts and read-only local-stack readiness. Browse published data is available in both panels and reads mapped rows from the current ClickHouse snapshot with server-enforced data grants and bounded pagination. Empty/unavailable states do not generate substitute rows.

## Explicit sample dashboard

For a visual walkthrough without infrastructure, run `node --import tsx scripts/seed-sample.ts <existing-username>`, then open `/fa/analytics` or `/en/analytics`. This creates a labeled draft dashboard with six visuals and 180 fictional orders, plus paginated data browsing. The selected account receives data access. Existing workspace records are preserved and an encrypted backup is created beside `workspace.enc` (keep the matching master key). Rerunning does not duplicate the sample flow or report.

Only flows explicitly marked `sampleData` use the synthetic query path. Real flows still require ClickHouse and never fall back to samples. Synthetic rows are not CDC, source connectivity, governed KPI reconciliation, or live Power BI evidence. Sample reports remain exploratory drafts.
