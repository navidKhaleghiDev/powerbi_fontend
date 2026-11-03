# Data Platform Control Center — Feature Requirements

This document captures all requirements from the architecture PDF and user
steering messages.  Features marked **✅ Built** are implemented; features
marked **📋 Planned** have route pages, translations, and documentation in
place and are ready for backend integration.

## Architecture Foundation (from PDF)

- ✅ **Batch lifecycle state machine** — EXTRACTED → UPLOADED → VERIFIED →
  APPLIED → PUBLISHED with atomic checkpoint commit.
- ✅ **Sync mode selection** — Full snapshot, incremental polling, log-based
  CDC decision tree.
- ✅ **Data correctness** — Idempotent merge by composite identity,
  version-aware ordering, tombstone handling.
- ✅ **Schema discovery pipeline** — Discover → Profile → Classify → Version →
  Review → Propose with fingerprinting and breaking-change detection.
- ✅ **Resilience scenarios** — Seven failure drills (crash recovery, ACK loss,
  rate-limit, schema change, CDC expiry, agent outage, out-of-order events).
- ✅ **Test cases** — 113 Vitest tests covering all domain logic.

## UI & Localization

- ✅ **Farsi (Persian) support** — All UI text via next-intl locale files
  (`fa.json` + `en.json`).  Kalameh font applied via `kalameh.className` in
  the root layout when `locale === "fa"`.
- ✅ **RTL layout** — All components use logical CSS properties (`text-start`,
  `ms-`, `me-`).  HTML `dir="rtl"` set by the locale layout.
- ✅ **Solar (Jalali) calendar filter** — `react-multi-date-picker` with
  Persian calendar for date-range filtering on the dashboard.
- ✅ **Mobile responsiveness** — All layouts use responsive Tailwind grids
  (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-N`).

## Dashboard Features

- ✅ **Reports with charts** — Throughput trend (line), batch status
  distribution (donut), error rate trend (area) using recharts.
- ✅ **GIS / Geographic map** — SVG-based world map showing data residency
  by region with source location markers and data flow lines.
- ✅ **GIS analytics** — Region throughput bar chart, residency distribution
  bar, cloud vs on-prem summary stats.
- ✅ **Real-time monitor** — Auto-refresh polling (5s interval) with live
  gauges for throughput, backlog, and active batches.  Pause/resume toggle.
- ✅ **Observability metrics** — P95 data age, sync backlog, error rate,
  throughput, query performance with health status indicators.

## PBRS Management Features (from steering messages)

### Pivot Table — Online Data Analysis
- ✅ **Drag & drop pivot table** — Fields dragged to rows/columns/values zones
  using `@dnd-kit`.  Aggregations: sum, count, average.
- ✅ **CSV export** — One-click CSV download of pivot results.
- ✅ **RTL + Persian support** — All labels via locale files.
- 📋 **Load data from database/warehouse/files** — Frontend ready, needs
  backend API for SSAS Tabular queries.
- 📋 **Query, stored procedure, function support** — Needs SSAS connector.
- 📋 **Parameter definition for data fetching** — Needs parameter API.
- 📋 **CSV/JSON file upload** — Needs file upload endpoint.
- 📋 **Advanced filtering & sorting** — UI structure in place, needs wiring.
- 📋 **Conditional cell formatting & highlighting** — Needs formatting engine.
- 📋 **Calculated fields** — Needs expression evaluator.
- 📋 **Chart drill-down** — Needs chart integration with pivot.
- 📋 **Save & share layout/color** — Needs persistence API.
- 📋 **Pixel-perfect RTL print** — Needs print stylesheet.
- 📋 **Excel export with formatting** — Needs Excel library (e.g. ExcelJS).
- 📋 **Self-service pivot on SSAS Tabular** — Users pivot directly on SSAS
  data with their role-based access restrictions applied.

### Security & Authentication
- 📋 **Independent login page** — Not a popup. Shows which system the user is
  logging into. The CRM already has a standalone login page at `/login`;
  the standalone demo does not inherit CRM login. Production LDAP integration remains required.
- 📋 **MFA** — TOTP (Google Authenticator), Passkey/FIDO2, Email OTP, SMS OTP.
- 📋 **Adaptive risk scoring** — Risk-based authentication decisions.
- 📋 **Anti-brute-force lockout** — Account lock after N failed attempts.
- 📋 **Device trust** — Recognized device management.
- 📋 **Security audit log** — Complete logging of all auth events.
- 📋 **LDAP authentication** — Organizational LDAP for auth, no custom auth,
  no alternative solutions.  SSAS as semantic layer, PBRS as presentation
  layer.

### Report Management
- 📋 **Report version history** — Each `.pbix` upload stores uploader,
  upload time, file size.  Admins browse version list per report, download
  previous versions, or delete old versions.
- 📋 **Report view statistics** — Admin view showing daily report views,
  top reports by view count, most active users, paginated log of every
  view event.  Filterable by report path or username.
- 📋 **Scheduled report subscriptions** — Users subscribe to reports for
  scheduled delivery (daily, weekly, monthly).  Each delivery produced
  with recipient's RLS — users only receive data they're authorized to see.

### Deployment
- 📋 **On-premises deployment** — Installed alongside existing PBRS server.
  Each customer has their own isolated instance.  Data never leaves the
  network.  PBRS configuration remains untouched.

## Architecture Notes

- **SSAS as semantic layer** — Tabular models provide the semantic model.
- **PBRS as presentation layer** — Power BI Report Server for report
  delivery and viewing.
- **LDAP authentication** — Organizational LDAP handles all authentication.
  No custom auth, no alternative solutions.
- **Client-side implementation** — All UI is client-side React/Next.js.
- **Responsive UI** — Mobile, tablet, and desktop responsive layouts.
- **High performance** — Designed for large datasets with virtualized
  rendering where needed.

## Standalone boundary

- The Power BI workspace runs independently of CRM on port 3001.
- All feature navigation retains the active English/Persian locale.
- Existing sample data and planned integrations are preserved and identified as demo mode. No CRM credentials or APIs are copied.
- LDAP authentication and server authorization must be integrated before connecting real organizational data.

- The live monitor shows the last successful query update time in the active locale and Tehran time zone; it must not render the current wall clock during server rendering. Pausing polling retains the last update time.

## Single organization workspace

- Each standalone deployment has exactly one organization, configured in `src/lib/data-platform/organization.ts`. There is no organization picker or organization list.
- The demo uses the existing Acme Industries profile. All four connections and five datasets belong to it; connection, dataset, policy, run, and batch identifiers are preserved.
- Organization lookup returns one object through `getOrganization` / `useGetOrganization`. Dashboard statistics count sources rather than organizations; the Sources page renders one profile.
- The GIS view includes only sources owned by this organization. Geographic placement remains a demo based on its residency policy, not real source geolocation.
- Keep organization IDs in connections and composite record identities for data correctness. A future backend must enforce this configured organization scope; no client-side organization switching is supported.
- Existing authentication and real data integrations remain pending. Single organization operation does not provide authentication.

- Security & Authentication is omitted from header navigation and dashboard cards. The legacy informational route is retained; this UI change does not introduce or disable authentication. 

- Centralized Access Management is removed entirely: no menu entry, dashboard card, page route, demo component, or translation namespace. Requests to `/[locale]/data-platform/access` return 404.
