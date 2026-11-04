# BI Control Center — React frontend

A frontend-only React application built with Vite and strict TypeScript, React Router, English/Persian localization with use-intl, Tailwind/Radix components, and TanStack Query.

## Development

Use Node.js 22.22+ and pnpm 12.16.1 (pinned in `package.json`). Enable pnpm with `corepack enable` if your Node.js installation includes Corepack, or install the pinned pnpm CLI using its official installation instructions. Run `pnpm install --frozen-lockfile`, then `pnpm run dev` (port 3001). Vite provides React Fast Refresh.

## Build and hosting

Run `pnpm run build`. Deploy the generated `dist/` directory to a static web host. Configure the host to serve `index.html` for application routes so direct links and browser refresh work. Asset URLs must continue to resolve to their actual files. Use `pnpm run preview` to check the production bundle locally on port 3001.

No application backend, database, Docker services, environment secrets, or API routes are required.

## Available UI

Configuration: `/en/data-platform` or `/fa/data-platform`. Analytics: `/en/analytics/reports` or `/fa/analytics/reports`, with KPI and data-browser pages alongside it. The root opens the Persian configuration page. Invalid locales and unknown paths display a 404 view. Navigation preserves locale and query parameters, including legacy `?report=` links.

CSV parsing and preview run entirely in the browser. Workspace lists start empty. There is no login, authentication, authorization, persistent storage, source discovery, ingestion, CDC, warehouse execution, or publication. Actions requiring these services report unavailability; no fake successful operations or live data are supplied. Report edits are temporary UI state.

## Verification

Run `pnpm run lint`, `pnpm run format:check`, `pnpm run check-types`, and `pnpm run build`.

The extracted shared loading skeleton is preserved unchanged.

## Code quality and commits

ESLint uses one shared Airbnb-inspired flat configuration for all supported JavaScript and TypeScript files, adapted for ESLint 10 and strict TypeScript. The legacy `eslint-config-airbnb` package supports ESLint 7/8, so its package is not extended here.

The rules cover strict equality (with intentional nullish checks allowed), safe callbacks, parameter mutation, unsafe evaluation, promise handling, type-only imports, and non-null assertions. `eslint-plugin-import-x` checks import resolution, order, cycles, duplicate imports, and undeclared dependencies with the TypeScript path aliases. Application components keep named exports by project convention. The shared configuration recognizes browser and Node.js globals together because it also checks tooling. A single scope permits default exports and Node.js imports across all checked files; the application remains browser-only by project convention. Development dependencies are allowed only in tooling configuration files.

`@eslint-react/eslint-plugin` adds stable-key, component-definition, conditional-rendering, DOM-safety, and resource-cleanup checks. Existing React Hooks/compiler checks and Vite Fast Refresh checks remain enabled. The extracted shared loading skeleton is globally ignored so its source stays untouched. Prettier handles formatting separately; eslint-config-prettier disables conflicting style rules. The Tailwind CSS Prettier plugin sorts utility classes using `src/styles/globals.css`, including class lists passed to `cn` and `cva`.

- `pnpm run lint` checks source and tooling with no warnings allowed.
- `pnpm run lint:fix` applies available ESLint fixes.
- `pnpm run format` formats supported project files; `pnpm run format:check` checks formatting.
- `pnpm run check-types` checks strict TypeScript types.

`pnpm install` and `pnpm install --frozen-lockfile` install Husky hooks through the `prepare` script. The pre-commit hook runs lint-staged to fix ESLint issues and format staged code and text files. The commit-msg hook enforces Conventional Commits, for example `feat: add report navigation` or `fix: correct Persian layout`.

Generated output, dependencies, and local private files are excluded from formatting. The extracted shared loading skeleton is excluded from formatting to preserve it exactly. Fast Refresh allows the existing named UI variant helpers through the shared configuration.

For dependency installs in CI or an exported source tree without Git, use `HUSKY=0 pnpm install --frozen-lockfile` to skip hook installation.

Commit `pnpm-lock.yaml` with dependency changes. Use `pnpm add <package>` and `pnpm add -D <package>` to add dependencies. Use `pnpm install --frozen-lockfile` in CI; avoid creating lockfiles for other package managers.

## VS Code integration

Install the workspace-recommended ESLint, Prettier, and Tailwind CSS IntelliSense extensions. Workspace settings enable all configured ESLint rules while typing, automatic ESLint fixes on explicit save, and Prettier formatting with Tailwind class sorting on save. Built-in JavaScript/TypeScript, CSS, and JSON validation is enabled. The workspace TypeScript SDK is configured; select **Use Workspace Version** when prompted. Tailwind validation uses `src/styles/globals.css` and recognizes the `cn` and `cva` helpers. Stylesheets use the Tailwind language mode so its directives are understood. Issues without automatic fixes remain highlighted in the editor and Problems panel. Extension recommendations do not install extensions automatically.

Use **Tasks: Run Task → Check: all** for full-project lint, formatting, and TypeScript checks. **Build: production** runs the production build and is the default build task. These full-project tasks run on demand; they do not run on each keystroke or save. The pre-commit hook checks staged files, and commitlint checks commit messages through the existing commit-msg hook.
