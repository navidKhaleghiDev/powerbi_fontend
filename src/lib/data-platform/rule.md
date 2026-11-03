# Data Platform Domain Rules

Business rules for the Multi-Source Data Platform control center, derived
from the architecture PDF (V4 — OLAP + Power BI Delivery).  These rules are
encoded as pure functions in `src/lib/data-platform/` and verified by the test
suite in `src/lib/data-platform/__tests__/`.

## Batch Lifecycle (stateMachine.ts)

- The batch state machine is strictly linear:
  `EXTRACTED → UPLOADED → VERIFIED → APPLIED → PUBLISHED`.
- No status may be skipped. No backwards transitions. No self-transitions.
- A checkpoint advances **only** during the atomic APPLY commit, never on
  upload alone (PDF p.13).
- Warehouse effects + checkpoint advance are atomic within the database
  transaction (PDF p.15: commit invariant).
- A batch may advance to APPLIED only after the quality result accepts it
  (PDF p.10: "Quality watermark").
- If a worker dies between UPLOADED and APPLIED, recovery replays from the
  durable manifest — the checkpoint does not move (PDF p.46).

## Sync Mode Selection (syncMode.ts)

- Decision tree (PDF p.11):
  - Change log + retention → **log-cdc** (low latency + deletes).
  - Cursor (updated_at / token), no change log → **incremental-polling**.
  - Neither → **full-snapshot**.
- Polling alone may miss hard deletes → pair with reconciliation.
- CDC with expired retention → **explicit resnapshot**, never skip to "now"
  (PDF p.46).
- Delete strategy depends on mode: CDC → tombstone; polling without
  soft-delete flag → reconciliation; otherwise soft.

## Data Correctness (validation.ts)

- Current-row identity is composite:
  `(organization_id, source_id, dataset_id, source_primary_key)`.
- Same source PK across different datasets/organizations is **not** the same
  row (PDF p.15).
- Merge is version-aware: later `sourceVersion` wins, regardless of arrival
  order (PDF p.46: "version-aware merge").
- Replaying the same event is idempotent — no duplicate current-state row
  (PDF p.46: "Replay same batch without duplicate current records").
- A delete followed by a re-insert resolves to "insert", not "delete"
  (tombstone handling, PDF p.20).

## Schema Compatibility (validation.ts)

- Currency: exact decimal required; float/double → reject (PDF p.20).
- Timestamp without timezone: quarantine ambiguous values (PDF p.20).
- PK: stable typed/text identity; never cast with collisions (PDF p.20).
- New nullable field: record new schema version; stage if safe (PDF p.20).
- Field removed or type narrowed: **block** publication (PDF p.20).
- Delete semantics differ: CDC tombstone or reconciliation; never assume hard
  delete (PDF p.20).

## Retry / Backoff (validation.ts)

- HTTP 429 and 5xx: retry with exponential backoff + jitter (PDF p.46).
- HTTP 4xx (except 429): do not retry — it won't help.
- Bounded max attempts (default 5).

## Schema Discovery (schemaDiscovery.ts)

- Six-phase pipeline: `DISCOVER → PROFILE → CLASSIFY → VERSION → REVIEW →
  PROPOSE` (PDF p.16).
- Discovery (detect tables, types) is automated; interpretation and sensitive
  semantic mappings require human review (PDF p.9, p.16).
- Identical field names do **not** prove shared business identity or safe
  joins (PDF p.16).
- Schema fingerprint includes field names, types, nullability — not values.
- Breaking change (field removed or type narrowed) blocks publication.

## Resilience Scenarios (scenarios.ts)

Seven failure drills that must pass before production (PDF p.46):

1. **Crash after raw upload** — manifest replay; checkpoint does not move.
2. **ACK lost after commit** — retry is idempotent; no duplicate row.
3. **API rate-limit (429)** — backoff with jitter; bounded attempts.
4. **Breaking schema change** — quarantine; block publication.
5. **CDC retention expired** — explicit resnapshot; never skip ahead.
6. **24h agent outage** — bounded encrypted spool; alert on retention risk.
7. **Out-of-order / delete** — version-aware merge; correct final state.

## Observability (PDF p.45)

Five metrics: P95 data age, sync backlog, error rate, throughput (rows/s),
query performance (P95 ms).  Successful job completion is not sufficient —
measure correctness and freshness of the published dataset.

## Single organization workspace

- Each standalone deployment has exactly one organization, configured in `src/lib/data-platform/organization.ts`. There is no organization picker or organization list.
- The demo uses the existing Acme Industries profile. All four connections and five datasets belong to it; connection, dataset, policy, run, and batch identifiers are preserved.
- Organization lookup returns one object through `getOrganization` / `useGetOrganization`. Dashboard statistics count sources rather than organizations; the Sources page renders one profile.
- The GIS view includes only sources owned by this organization. Geographic placement remains a demo based on its residency policy, not real source geolocation.
- Keep organization IDs in connections and composite record identities for data correctness. A future backend must enforce this configured organization scope; no client-side organization switching is supported.
- Existing authentication and real data integrations remain pending. Single organization operation does not provide authentication.
