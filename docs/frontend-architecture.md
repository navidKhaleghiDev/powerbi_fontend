# Frontend architecture

This is a React/Vite SPA. TanStack Router owns URL routing; TanStack Query owns server state. Components keep named exports and use-intl messages have English/Persian parity.

## Ownership

| Directory                    | Owns                                                                                                                                                     |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app`                    | Router registration, QueryClient configuration, provider composition, locale workspace, and application layout.                                          |
| `src/routes`                 | File routes, redirects, route guards, and composition of feature pages. The generated `routeTree.gen.ts` is tooling output.                              |
| `src/features/auth`          | Login page and its presentation.                                                                                                                         |
| `src/features/dashboards`    | Dashboard components, sheet and widget types, and explicitly synthetic sample data. Its styles are collected in the single `src/global.css` entry point. |
| `src/features/datasets`      | Analytics metadata and dataset management requests and UI.                                                                                               |
| `src/features/data-flows`    | CDC connection and consumer contracts, API calls, and screens. Read `lib/rule.md` before changing this behavior.                                         |
| `src/features/data-platform` | Cube client and data platform UI.                                                                                                                        |
| `src/features/assistant`     | Assistant context, prompt logic, and tests.                                                                                                              |
| `src/shared`                 | Business-independent UI, chart primitive, hooks, configuration, formatting, and the authenticated HTTP client.                                           |

Routes should import feature pages and shared network guards, but contain little UI logic. A feature may use `shared`; `shared` must not import from a feature. Keep API contracts and business rules beside the owning feature. Cross-feature imports are appropriate only where one capability explicitly consumes another, such as dashboards using dataset metadata types.

## Atomic UI boundaries

- `src/shared/ui/atoms` contains business-independent controls such as buttons, inputs, selects, checkboxes, and typography.
- `src/shared/components/molecules` combines small interactions, including dialogs and icon tooltips.
- `src/shared/components/organisms` contains larger reusable presentation units such as toast notifications and charts.
- Feature `molecules` and `organisms` compose these shared pieces with feature behavior. Feature `pages` assemble route-level screens.
- `src/app/layouts` provides the workspace template around route content. `src/routes` remains a routing layer; route files should point to feature pages and should not contain atomic UI components.

These names describe composition, not visual size. Keep a component in its feature when it knows BI data or workflow rules; move it to `shared` only when it is business-independent.

## Data flow

- `src/shared/network/api.ts` remains the single HTTP transport and token-refresh implementation. Feature API modules call it; components use TanStack Query for server responses.
- `src/app/query-client.ts` sets global query and mutation feedback. `WorkspaceProviders` clears server cache when the session changes.
- The dashboard's sample adapter uses synthetic sales records and browser storage. Its sample badge must remain visible; it is not a live warehouse integration.
- All application CSS lives in `src/global.css`, with section comments for theme, layout, and feature rules. This is the only CSS entry point imported by `src/main.tsx`.
- Add `ui-border-trail` to a rounded container for the reusable animated border. Customize it with `--ui-border-trail-color`, `--ui-border-trail-width`, and `--ui-border-trail-duration`; reduced-motion users see a static border.
- English and Persian strings live in `public/locales/en.json` and `public/locales/fa.json`.

## Adding a feature

1. Add `src/features/<name>` with only the directories the capability needs, such as `pages`, `organisms`, `molecules`, `api`, `lib`, or `types`.
2. Put route definitions in `src/routes`, pointing at named exports from the feature.
3. Put reusable business-independent code in `src/shared`; keep business rules within the feature.
4. Add English and Persian messages together, then run `pnpm check-types`, `pnpm lint`, and `pnpm build`.
