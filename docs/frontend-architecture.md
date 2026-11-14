# Frontend architecture

This is a React/Vite SPA. TanStack Router owns URL routing; TanStack Query owns server state. Components keep named exports and use-intl messages have English/Persian parity.

## Ownership

| Directory                    | Owns                                                                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `src/app`                    | Router registration, QueryClient configuration, provider composition, locale workspace, and application layout.             |
| `src/routes`                 | File routes, redirects, route guards, and composition of feature pages. The generated `routeTree.gen.ts` is tooling output. |
| `src/features/auth`          | Login page and its presentation.                                                                                            |
| `src/features/dashboards`    | Dashboard components, sheet and widget types, and explicitly synthetic sample data.                                         |
| `src/features/datasets`      | Analytics metadata and dataset management requests and UI.                                                                  |
| `src/features/data-flows`    | CDC connection and consumer contracts, API calls, and screens. Read `lib/rule.md` before changing this behavior.            |
| `src/features/data-platform` | Cube client and data platform UI.                                                                                           |
| `src/features/assistant`     | Assistant context, prompt logic, and tests.                                                                                 |
| `src/shared`                 | Business-independent UI, chart primitive, hooks, configuration, formatting, and the authenticated HTTP client.              |

Routes should import feature pages and shared network guards, but contain little UI logic. A feature may use `shared`; `shared` must not import from a feature. Keep API contracts and business rules beside the owning feature. Cross-feature imports are appropriate only where one capability explicitly consumes another, such as dashboards using dataset metadata types.

## Data flow

- `src/shared/network/api.ts` remains the single HTTP transport and token-refresh implementation. Feature API modules call it; components use TanStack Query for server responses.
- `src/app/query-client.ts` sets global query and mutation feedback. `WorkspaceProviders` clears server cache when the session changes.
- The dashboard's sample adapter uses synthetic sales records and browser storage. Its sample badge must remain visible; it is not a live warehouse integration.
- English and Persian strings live in `public/locales/en.json` and `public/locales/fa.json`.

## Adding a feature

1. Add `src/features/<name>` with only the directories the capability needs, such as `components`, `api`, `lib`, or `types`.
2. Put route definitions in `src/routes`, pointing at named exports from the feature.
3. Put reusable business-independent code in `src/shared`; keep business rules within the feature.
4. Add English and Persian messages together, then run `pnpm check-types`, `pnpm lint`, and `pnpm build`.
