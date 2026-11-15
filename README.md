# NETBI — React frontend

A frontend-only React application built with Vite and strict TypeScript, TanStack Router, English/Persian localization with use-intl, Tailwind/Radix components, and TanStack Query.

See [frontend architecture](docs/frontend-architecture.md) for code ownership and extension rules.

## Development

Use Node.js 22.22+ and pnpm 12.16.1 (pinned in `package.json`). Enable pnpm with `corepack enable` if your Node.js installation includes Corepack, or install the pinned pnpm CLI using its official installation instructions. Run `pnpm install --frozen-lockfile`, then `pnpm run dev` (port 3001). Vite provides React Fast Refresh.

## Build and hosting

Run `pnpm run build`. Deploy the generated `dist/` directory to a static web host. Configure the host to serve `index.html` for application routes so direct links and browser refresh work. Asset URLs must continue to resolve to their actual files. Use `pnpm run preview` to check the production bundle locally on port 3001.

No application backend, database, environment secrets, or API routes are required. Docker is an optional way to run the frontend.

## Available UI

Configuration: `/en/data-platform` or `/fa/data-platform`. Analytics: `/en/analytics/reports` or `/fa/analytics/reports`, with KPI and data-browser pages alongside it. The root opens the Persian configuration page. Invalid locales and unknown paths display a 404 view. Navigation preserves locale and query parameters, including legacy `?report=` links.

CSV parsing and preview run entirely in the browser. Configuration and production workspace lists start empty. The login page provides preview navigation only; there is no authentication, authorization, persistent storage, source discovery, ingestion, CDC, warehouse execution, or publication. Actions requiring these services report unavailability; no fake successful operations or live data are supplied. Report edits are temporary UI state.

## Verification

Run `pnpm run lint`, `pnpm run format:check`, `pnpm run check-types`, and `pnpm run build`.

The extracted shared loading skeleton is preserved unchanged.

## Code quality and commits

ESLint uses one shared Airbnb-inspired flat configuration for all supported JavaScript and TypeScript files, adapted for ESLint 10 and strict TypeScript. The legacy `eslint-config-airbnb` package supports ESLint 7/8, so its package is not extended here.

The rules cover strict equality (with intentional nullish checks allowed), safe callbacks, parameter mutation, unsafe evaluation, promise handling, type-only imports, and non-null assertions. `eslint-plugin-import-x` checks import resolution, order, cycles, duplicate imports, and undeclared dependencies with the TypeScript path aliases. Application components keep named exports by project convention. The shared configuration recognizes browser and Node.js globals together because it also checks tooling. A single scope permits default exports and Node.js imports across all checked files; the application remains browser-only by project convention. Development dependencies are allowed only in tooling configuration files.

`@eslint-react/eslint-plugin` adds stable-key, component-definition, conditional-rendering, DOM-safety, and resource-cleanup checks. Existing React Hooks/compiler checks and Vite Fast Refresh checks remain enabled. The extracted shared loading skeleton is globally ignored so its source stays untouched. Prettier handles formatting separately; eslint-config-prettier disables conflicting style rules. The Tailwind CSS Prettier plugin sorts utility classes using `src/global.css`, including class lists passed to `cn` and `cva`.

- `pnpm run lint` checks source and tooling with no warnings allowed.
- `pnpm run lint:fix` applies available ESLint fixes.
- `pnpm run format` formats supported project files; `pnpm run format:check` checks formatting.
- `pnpm run check-types` checks strict TypeScript types.

`pnpm install` and `pnpm install --frozen-lockfile` install Husky hooks through the `prepare` script. The pre-commit hook runs lint-staged to fix ESLint issues and format staged code and text files. The commit-msg hook enforces Conventional Commits, for example `feat: add report navigation` or `fix: correct Persian layout`. The pre-push hook runs full-project lint and formatting checks, then the production build, which includes TypeScript checking. Pre-commit and pre-push print short playful status messages; failed checks preserve their exit code and block the Git operation.

Generated output, dependencies, and local private files are excluded from formatting. The extracted shared loading skeleton is excluded from formatting to preserve it exactly. Fast Refresh allows the existing named UI variant helpers through the shared configuration.

For dependency installs in CI or an exported source tree without Git, use `HUSKY=0 pnpm install --frozen-lockfile` to skip hook installation.

Commit `pnpm-lock.yaml` with dependency changes. Use `pnpm add <package>` and `pnpm add -D <package>` to add dependencies. Use `pnpm install --frozen-lockfile` in CI; avoid creating lockfiles for other package managers.

## VS Code integration

Install the workspace-recommended ESLint, Prettier, and Tailwind CSS IntelliSense extensions. Workspace settings enable all configured ESLint rules while typing, automatic ESLint fixes on explicit save, and Prettier formatting with Tailwind class sorting on save. Built-in JavaScript/TypeScript, CSS, and JSON validation is enabled. The workspace TypeScript SDK is configured; select **Use Workspace Version** when prompted. Tailwind validation uses `src/global.css` and recognizes the `cn` and `cva` helpers. Stylesheets use the Tailwind language mode so its directives are understood. Issues without automatic fixes remain highlighted in the editor and Problems panel. Extension recommendations do not install extensions automatically.

Use **Tasks: Run Task → Check: all** for full-project lint, formatting, and TypeScript checks. **Build: production** runs the production build and is the default build task. These full-project tasks run on demand; they do not run on each keystroke or save. The pre-commit hook checks staged files, and commitlint checks commit messages through the existing commit-msg hook.

## Nexus package registry

The project `.npmrc` configures `https://nexus.npd-co.com/repository/npm/` as the package source for local development and Docker builds. Keep TLS verification enabled. The registry was checked without credentials and returned metadata for the pinned React 19.3.0 and pnpm 12.16.1 versions. No public-registry fallback is configured. This is a dependency registry; the browser application does not call Nexus.

```bash
pnpm config get registry
pnpm install --frozen-lockfile
pnpm run dev
```

## Reports development fixtures

During `pnpm run dev`, the Reports panel automatically loads clearly labeled fictional data: 72 orders across six months, four regions, and three categories; two sample reports; KPI bindings; and paginated dataset rows. Charts, filters, CSV export, and local draft visualization work in the browser. Approval/publication metadata and timestamps are simulated, and all backend mutations still report unavailability. Configuration remains empty.

The fixtures live in `src/lib/mocks/reports.ts` and are loaded through TanStack Query only on Analytics routes. Set `VITE_REPORTS_MOCKS=false` in `.env` and restart Vite to return to empty states. Production builds exclude the fixture module and never enable it, even if the environment flag is set. Mock edits are not persisted across reloads.

### Sales Mart dashboard demo (no services required)

Run `pnpm dev` and open the dashboard after login. The income and expense sheets use
local synthetic data based on the [current sales definition](docs/mart-sales-definition-current.fa.pdf).
No Cube.js, management API, database, token, or environment variable is required.
The widget editor and searchable field pane also use local sample fields. Income includes independent formal/informal and cash/credit classifications with reconciled totals; see [the income sheet guide](docs/dashboard-income.fa.md).
The demo is available in development and production builds by explicit request;
all data is labeled fictional. Widget edits last for the current session only.

The sample contains 36 goods invoices, separate allocated payment events,
supplier purchases and hypothetical income/expense recognition entries in IRR
for January–June 2026. The as-of date and customer filter recalculate widgets.
Settled invoices use issue dates; successful collections use payment dates.
Unconfirmed purchases are excluded, and purchase totals are never treated as
recognized expenses. Financial entries have no customer attribution, so those
widgets show an unavailable state when a customer is selected. No profit is
calculated. Recognition policy, tax, returns, foreign exchange and salesperson
mapping remain unapproved or outside this demo. The financial entries illustrate
presentation only and do not resolve the PDF's open accounting definitions.

Visualizations and Data have collapse/expand buttons inside their own headers;
field sections can be collapsed individually. Existing Cube tooling is retained
for future integration but is not mounted by the dashboard.

## Live dashboard data

The dashboard now reads published KPIs through the Django `/api/analytics/` API.
Set the existing `VITE_API_BASE_URL` to the Django deployment. Staff users can
open **Datasets & mappings** to create, preview and publish mappings; published
KPIs populate the widget editor automatically. No mock amounts are used as a
fallback. Dashboard layouts are saved per account with **Save dashboard**.
Period filters use Gregorian date inputs with an exclusive end date; reporting
groups support Persian and Gregorian calendars. Historical mode requires retained
history and an explicit cutoff. **View records** provides paginated mapped rows.
The separate Cube client settings are not required for this dashboard.
Backend setup and contracts: [analytics guide](../backend/docs/analytics.md).
