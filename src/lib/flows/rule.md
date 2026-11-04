# Frontend workspace rules

- This project contains UI only. No API routes, authentication, persistent server storage, database clients, ingestion workers, or infrastructure provisioning belong here.
- Workspace contracts describe presentation data only. Never treat client-side state or UI visibility as authorization.
- Start with empty workspace lists. Never represent fixtures as live PBRS/SSAS/LDAP, CDC, or warehouse integrations.
- CSV parsing and preview run in the browser with UTF-8 quoted-field support and limits of 2 MiB/5,000 rows. Preview does not import or publish data.
- Server-dependent actions must explicitly report unavailability and must never pretend to save or publish.
- Keep English/Persian message parity, strict TypeScript, named component exports, and TanStack Query interfaces for future server-state integration.
- Preserve the shared loading skeleton without edits.
- Reports and maps remain presentation components. Explicitly mapped WGS84 fields are required for maps; do not infer locations or add arbitrary tile URLs.
