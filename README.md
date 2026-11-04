# BI Control Center — React frontend

A frontend-only React application built with Vite and strict TypeScript, React Router, English/Persian localization with use-intl, Tailwind/Radix components, and TanStack Query.

## Development

Use Node.js 22.22+ and run `npm ci`, then `npm run dev` (port 3001). Vite provides React Fast Refresh.

## Build and hosting

Run `npm run build`. Deploy the generated `dist/` directory to a static web host. Configure the host to serve `index.html` for application routes so direct links and browser refresh work. Asset URLs must continue to resolve to their actual files. Use `npm run preview` to check the production bundle locally on port 3001.

No application backend, database, Docker services, environment secrets, or API routes are required.

## Available UI

Configuration: `/en/data-platform` or `/fa/data-platform`. Analytics: `/en/analytics/reports` or `/fa/analytics/reports`, with KPI and data-browser pages alongside it. The root opens the Persian configuration page. Invalid locales and unknown paths display a 404 view. Navigation preserves locale and query parameters, including legacy `?report=` links.

CSV parsing and preview run entirely in the browser. Workspace lists start empty. There is no login, authentication, authorization, persistent storage, source discovery, ingestion, CDC, warehouse execution, or publication. Actions requiring these services report unavailability; no fake successful operations or live data are supplied. Report edits are temporary UI state.

## Verification

Run `npm run check-types` and `npm run build`.

The extracted shared loading skeleton is preserved unchanged.
