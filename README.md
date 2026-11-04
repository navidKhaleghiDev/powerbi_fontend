# BI Control Center — React frontend

A frontend-only React application built with Vite and strict TypeScript, TanStack Router, English/Persian localization with use-intl, Tailwind/Radix components, and TanStack Query.

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

`@eslint-react/eslint-plugin` adds stable-key, component-definition, conditional-rendering, DOM-safety, and resource-cleanup checks. Existing React Hooks/compiler checks and Vite Fast Refresh checks remain enabled. The extracted shared loading skeleton is globally ignored so its source stays untouched. Prettier handles formatting separately; eslint-config-prettier disables conflicting style rules. The Tailwind CSS Prettier plugin sorts utility classes using `src/styles/globals.css`, including class lists passed to `cn` and `cva`.

- `pnpm run lint` checks source and tooling with no warnings allowed.
- `pnpm run lint:fix` applies available ESLint fixes.
- `pnpm run format` formats supported project files; `pnpm run format:check` checks formatting.
- `pnpm run check-types` checks strict TypeScript types.

`pnpm install` and `pnpm install --frozen-lockfile` install Husky hooks through the `prepare` script. The pre-commit hook runs lint-staged to fix ESLint issues and format staged code and text files. The commit-msg hook enforces Conventional Commits, for example `feat: add report navigation` or `fix: correct Persian layout`. The pre-push hook runs full-project lint and formatting checks, then the production build, which includes TypeScript checking. Pre-commit and pre-push print short playful status messages; failed checks preserve their exit code and block the Git operation.

Generated output, dependencies, and local private files are excluded from formatting. The extracted shared loading skeleton is excluded from formatting to preserve it exactly. Fast Refresh allows the existing named UI variant helpers through the shared configuration.

For dependency installs in CI or an exported source tree without Git, use `HUSKY=0 pnpm install --frozen-lockfile` to skip hook installation.

Commit `pnpm-lock.yaml` with dependency changes. Use `pnpm add <package>` and `pnpm add -D <package>` to add dependencies. Use `pnpm install --frozen-lockfile` in CI; avoid creating lockfiles for other package managers.

## VS Code integration

Install the workspace-recommended ESLint, Prettier, and Tailwind CSS IntelliSense extensions. Workspace settings enable all configured ESLint rules while typing, automatic ESLint fixes on explicit save, and Prettier formatting with Tailwind class sorting on save. Built-in JavaScript/TypeScript, CSS, and JSON validation is enabled. The workspace TypeScript SDK is configured; select **Use Workspace Version** when prompted. Tailwind validation uses `src/styles/globals.css` and recognizes the `cn` and `cva` helpers. Stylesheets use the Tailwind language mode so its directives are understood. Issues without automatic fixes remain highlighted in the editor and Problems panel. Extension recommendations do not install extensions automatically.

Use **Tasks: Run Task → Check: all** for full-project lint, formatting, and TypeScript checks. **Build: production** runs the production build and is the default build task. These full-project tasks run on demand; they do not run on each keystroke or save. The pre-commit hook checks staged files, and commitlint checks commit messages through the existing commit-msg hook.

## Nexus package registry

The project `.npmrc` configures `https://nexus.npd-co.com/repository/npm/` as the package source for local development and Docker builds. Keep TLS verification enabled. The registry was checked without credentials and returned metadata for the pinned React 19.3.0 and pnpm 12.16.1 versions. No public-registry fallback is configured. This is a dependency registry; the browser application does not call Nexus.

```bash
pnpm config get registry
pnpm install --frozen-lockfile
pnpm run dev
```

If authentication is required in your environment, keep registry-scoped credentials in your user-level `~/.npmrc`, not the committed project `.npmrc`. Docker builds can receive that file through the optional BuildKit `npmrc` secret:

```bash
docker build --secret id=npmrc,src="$HOME/.npmrc" -t powerbi-control-center:local .
```

## Docker frontend

Use Docker Engine with the Buildx/BuildKit plugin.

The Dockerfile installs the pinned pnpm version and frozen dependencies through Nexus, builds the Vite application, and copies `dist/` into an unprivileged Nginx runtime. The runtime uses the image's default Nginx configuration and listens on port 8080. Its health check requests `/`. Git hooks are skipped inside image builds. Base images come from their Docker image registries; Nexus supplies npm packages.

```bash
# Production frontend at http://localhost:8080
docker build -t powerbi-control-center:local .
docker run --rm -p 8080:8080 powerbi-control-center:local

# Development frontend with source updates at http://localhost:3001
docker build --target development -t powerbi-control-center:dev .
docker run --rm -it -p 3001:3001 \
  --mount type=bind,src="$(pwd)/src",dst=/app/src,readonly \
  --mount type=bind,src="$(pwd)/public",dst=/app/public,readonly \
  --mount type=bind,src="$(pwd)/index.html",dst=/app/index.html,readonly \
  --mount type=bind,src="$(pwd)/vite.config.ts",dst=/app/vite.config.ts,readonly \
  --mount type=bind,src="$(pwd)/postcss.config.mjs",dst=/app/postcss.config.mjs,readonly \
  --mount type=bind,src="$(pwd)/tsconfig.json",dst=/app/tsconfig.json,readonly \
  powerbi-control-center:dev
```

Stop either foreground container with Ctrl+C. Change the host side of `-p` if a port is already in use. Development mounts preserve the container's dependencies; rebuild the development image after dependency or package-manager configuration changes.

If Nexus requires credentials, add `--secret id=npmrc,src="$HOME/.npmrc"` to the appropriate `docker build` command. Keep credentials out of the committed project `.npmrc`.

The default production Nginx configuration serves static files without a TanStack Router fallback. Open `/` and navigate within the app. Direct requests or refreshes on paths such as `/en/analytics/reports` return 404 unless your hosting layer rewrites frontend routes to `/index.html`. Custom asset caching and the former `/healthz` endpoint are not configured.

Local environment files, credentials, Git metadata, dependencies, and generated builds are excluded from the Docker context. Runtime package installation and backend services are not included in the production image.

## Reports development fixtures

During `pnpm run dev`, the Reports panel automatically loads clearly labeled fictional data: 72 orders across six months, four regions, and three categories; two sample reports; KPI bindings; and paginated dataset rows. Charts, filters, CSV export, and local draft visualization work in the browser. Approval/publication metadata and timestamps are simulated, and all backend mutations still report unavailability. Configuration remains empty.

The fixtures live in `src/lib/mocks/reports.ts` and are loaded through TanStack Query only on Analytics routes. Set `VITE_REPORTS_MOCKS=false` in `.env.local` and restart Vite to return to empty states. Production builds exclude the fixture module and never enable it, even if the environment flag is set. Mock edits are not persisted across reloads.
