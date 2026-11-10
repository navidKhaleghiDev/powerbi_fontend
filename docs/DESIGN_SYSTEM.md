# Application design system

The application uses project-owned React controls and workspace compositions, styled with Tailwind utilities and the existing semantic theme. It does not use shadcn/ui or a component generator.

## Layers

- `src/components/ui/`: project-owned Button, Input, Textarea, checkbox, tooltip, and dialog controls. These contain no workspace permissions or server requests.
- `src/styles/component-compatibility.css`: legacy utility aliases mapped to the existing semantic palette. The original theme token values remain unchanged.
- `src/lib/utils.ts`: shared class merging via `cn`.
- `src/components/workspace/`: custom compositions such as PageHeading, StatusBadge, WorkspaceJourney, DataBrowser, and the login panel. They retain English/Persian text, RTL layout, and existing access checks.
- Workspace forms use native labels and controls alongside the project-owned controls where shared behavior is needed.

## Usage

```tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, buttonClass, inputClass } from "@/components/workspace/FormParts";

<Field label={t("username")} error={errorText}>
  <Input className={inputClass} autoComplete="username" {...register("username")} />
</Field>
<Button type="submit" className={buttonClass}>{t("saved")}</Button>
```

Use translated product-specific action labels in actual forms. Explicitly set `type="button"` for actions inside forms that must not submit. Keep React Hook Form registrations and refs attached to the actual input component.

The local Button `auto` size supports custom workflow cards and navigation buttons without imposing a fixed height or single-line text. Primary and secondary action styles retain comfortable touch targets. Custom classes are merged with primitive defaults rather than concatenated blindly.

Native select, checkbox, and radio controls retain their existing behavior and keyboard semantics. Do not replace their form wiring with custom state without verifying submission, keyboard access, and RTL interaction. TanStack Query supplies the empty frontend workspace and retains interfaces for a future external service. The extracted shared loading skeleton is unchanged.

## Adding components

Add new shared controls under `src/components/ui/` using native HTML behavior where practical, preserve keyboard and RTL behavior, and use `@/lib/utils` for class merging. New theme colors must map to reviewed semantic tokens; do not overwrite the existing theme files with a stock palette.

After structural changes, run `pnpm run check-types` and `pnpm run build`, and verify the relevant English/Persian browser flows at desktop and mobile widths.

## Glassmorphism presentation

The user-supplied November 4 dashboard screenshots guide the composed layout: a compact circular icon rail, horizontal pill navigation, a blue-gray canvas, rounded panels, and a teal/green/rose chart palette. The application uses light mode: `index.html` sets the native light color scheme before first paint, independently of the operating system. The requested treatment is glassmorphism, implemented in `src/styles/workspace.css` with translucent light backgrounds, white highlight borders, static backdrop blur, and soft shadows. `src/styles/glass.css` remains a shared base. The extracted semantic palette in `src/styles/theme/colors.css` is preserved; app-specific `brand-*` utilities and workspace variables define the new visual layer separately.

`WorkspaceHeader` provides contextual page tabs, workspace-home and language links, and working comfortable/compact layout controls. `ApplicationSidebar` is a circular icon rail with accessible labels and hover/focus tooltips; it becomes a horizontally scrollable navigation row on narrow screens. RTL mirrors the desktop layout, and Persian uses larger Kalameh labels for readability.

The snapshot overview includes real workspace record counts, publication history, source/flow breakdowns, setup shortcuts and a dataset summary. Charts use only provided workspace records and lazy-load their rendering library when records exist. Empty workspaces show labeled empty states and an empty status ring. The screenshot's workforce figures are not copied, and no live integration is implied. CSV preview remains browser-local.

Reduced transparency uses opaque panels, reduced motion disables decorative transitions, and forced-color/print styles provide readable fallbacks. The shared loading skeleton remains unchanged.

## Analytics charts

`WarehouseChart.tsx` uses Chart.js through `react-chartjs-2` for bars, lines, and doughnut distributions. It is dynamically imported by the report canvas, so KPI-only and table-only views do not need the chart library. Chart containers fill the available width and control their height; Chart.js uses responsive sizing with `maintainAspectRatio: false`.

Axes use localized compact numbers; tooltips and the expandable data table use original values through `formatExactValue`. Numeric coordinates are approximate and must not become KPI/reconciliation inputs. Missing values remain gaps. Distributions with negative/missing values or a non-positive total show an explanation instead of misleading slices. Doughnut legends use wrapping, scrollable HTML to keep long category lists from consuming the canvas. Persian charts use the application's font and RTL tooltips. Animations are disabled for predictable resizing and reduced motion.

## GIS report visualization

Choose **GIS map** in the report visualization builder, map two distinct numeric warehouse columns to latitude and longitude, optionally select a location label, and choose count/sum/average as with exploratory charts. Coordinates must be WGS84 degrees. The map renders supplied rows and excludes missing, non-finite, or out-of-range coordinates. This frontend has no analytics API or live warehouse connection. A future service must supply authorized, bounded published results. The component never geocodes city names or queries source rows.

Map configuration is persisted with the report draft. GIS widgets remain exploratory and cannot bypass existing governed KPI publication gates. The existing sample dataset has no coordinate fields and does not invent locations.

`WarehouseMap.tsx` lazy-loads Leaflet and React Leaflet. The offline coordinate canvas is the default; selecting OpenStreetMap downloads the visible-area background tiles directly from its tile service and includes attribution. Data markers and popup content render locally. The map supports zoom, drag, fit-all, coordinate/value popups, and an accessible location table. No browser geolocation permission or geocoding service is used.

## Analytics pages and navigation

The frontend application shell renders `WorkspaceHeader` and one `ApplicationSidebar` across both panels. There is no login, account identity, logout, or access control. Analytics retains `analytics/kpis`, `analytics/reports`, and `analytics/data`. Links preserve the locale and query parameters and mark the active page with `aria-current="page"`. The workspace starts empty and makes no backend requests.

The Analytics root and Report Panel login default to the Report Editor. Existing `/analytics?report=<id>` links redirect to `/analytics/reports?report=<id>`. The report editor remains full-width within its content column. Save report edits before navigating to a different page.

The top header uses contextual navigation and exposes language switching on every workspace page. Configuration uses a validated `section` query parameter, so direct links and browser Back/Forward select the matching section. Density changes affect presentation only and remain in React state.

## Financial visual character

Workspace compositions use translucent rounded panels, subtle white borders and a soft blue-gray canvas. Tailwind teal indicates selection and actions; green and rose distinguish chart categories. Warning and error notices retain their distinct treatments. Exact numeric formatting, explicit empty states, and accessible chart tables remain intact.

## Sidebar iconography and branding

Navigation uses statically imported Lucide line icons beside 12px regular-weight labels, with visible active states and unchanged accessible text. Icons inherit the item color and are decorative (`aria-hidden`) because each control retains a text label. Language, account, and logout controls use the same lightweight treatment.

The sidebar brand row uses local assets under `public/brand`: the existing Control Center mark, Microsoft's Power BI SVG, and a vector recreation of the user-supplied Netsep symbol. See `public/brand/README.md` for asset provenance and the included Power BI license. The Netsep recreation can be replaced by an original master SVG without changing the layout. Branding does not imply that a live Power BI integration is configured.

## Restrained feedback and brand hierarchy

Visible workspace errors use amber surfaces and readable error text while retaining `role="alert"`, linked field errors, and validation behavior. Remove/Exclude actions use neutral text. Original imported theme definitions are preserved. Chart drawing colors use teal, blue, amber, purple, cyan, and slate rather than pink/red tones.

The header gives the local Netsep mark primary placement beside the workspace name. Brand provenance remains in `public/brand/README.md`. The logo is not evidence of a connected Power BI service.

### Minimal presentation

Keep the light glass surfaces and detached sidebar/header. Use a restrained border and shadow treatment, consistent rounded cards, and generous spacing. Page titles and short descriptions establish hierarchy; avoid decorative window dots, repeated eyebrow labels, and gridlines in empty chart placeholders. Keep data, action labels, validation messages, and contextual help visible. Application navigation lives in the sidebar, with the language switcher in its footer.

The `brand-*` utilities alias the installed Tailwind `teal-*` scale. Primary buttons and links use teal-700 for readable contrast; teal-500 highlights charts. The blue-gray canvas and neutral text remain unchanged.

### Shared control dimensions

Inputs, selects, and textareas follow the supplied control reference: 14px regular text, 12px corners (`rounded-xl`), a 1px border, and 10px padding (`p-2.5`). Single-line fields are at least 42px high; password icons are 16px. Touch inputs retain 16px text to avoid browser zoom. Text buttons use 16px semibold text, 8px corners (`rounded-lg`), and 8px padding (`p-2`). Outline and login buttons use the teal brand border. Focus remains border-only for text inputs; icon-only buttons and navigation keep their compact sizes.

### Typography variants

`src/lib/typography.ts` defines the supplied heading, body, label, button, and caption variants. Use the named `Typography` component in `src/components/ui/typography.tsx` with an explicit `as` for semantic headings. The size scale is 32/28/24/20/18/16/14/12/10px; headings use semibold and 1.4 line height, body and button variants follow their specified weights and line heights. Page headers and login headings consume these variants. Workspace values and KPI figures are capped at 32px, and legacy 9/11/13/30px text has been aligned with the supplied scale. Text inputs remain regular-weight per the input specification.
