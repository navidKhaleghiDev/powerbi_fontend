# Power BI Control Center

Standalone extraction of the Kiro Data Platform module from the CRM. No CRM shell, credentials, APIs, or business modules are included.

## Run

Requires Node.js 22.12 or later. Run `npm ci`, then `npm run dev`. Open http://localhost:3001/fa/data-platform (English: /en/data-platform). The development and production servers bind to all network interfaces on port 3001. Open http://<this-computer-IP>:3001/fa/data-platform from another device on the same network.

## Verification

`npm run check-types`, `npm test`, `npm run build`.

## Data and authentication

This is the existing demo frontend, not Microsoft Power BI Desktop. TanStack Query hooks use the preserved `src/lib/data-platform/mockData.ts` fixtures; There is no real LDAP authentication, SSAS connector, PBRS integration, or persistence backend. Security and report-management screens document planned functionality. No production access controls have been implemented here. Do not deploy with real data until organizational LDAP and server-enforced authorization are integrated. CRM authentication remains in the CRM; it was not copied or bypassed.

## Contents

Eight routes: overview, sources, ingestion, schema, scenarios, pivot, security, reports. Includes charts, GIS, live demo polling, Jalali dates, Persian/English messages, Kalameh fonts, domain logic and original tests. Original feature requirements and domain rules are colocated. `docs/` contains the original architecture PDF and presentation. No Nexa files or PostgreSQL credentials are included.

Original CRM files before extraction are preserved in `crm-extraction-backup.tar.gz`. This archive is excluded from Git.

## Single organization

This deployment serves one organization. Its profile is configured in `src/lib/data-platform/organization.ts`; the existing Acme Industries name is retained as the demo. All four sources and five datasets are preserved under this organization. Sources renders a single profile, the dashboard counts source connections, and no organization switching is available. Keep the organization identity in backend records and enforce it on the server when adding real integrations.
