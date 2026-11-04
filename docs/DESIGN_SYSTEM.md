# Application design system

The application uses official shadcn/ui components as its foundation, with custom workspace components for the product's data workflows. Components were installed through the shadcn CLI. See the [official documentation](https://ui.shadcn.com/docs) and [Tailwind v4 guidance](https://ui.shadcn.com/docs/tailwind-v4).

## Layers

- `src/components/ui/`: owned shadcn Button, Input, Textarea, Label, Card, Badge, Alert, and Separator primitives. These contain no workspace permissions or server requests.
- `src/styles/shadcn.css`: aliases shadcn theme variables to the existing semantic palette. The original theme token values remain unchanged.
- `src/lib/utils.ts`: shared class merging via `cn`.
- `src/components/workspace/`: custom compositions such as PageHeading, StatusBadge, WorkspaceJourney, DataBrowser, and the login panel. They retain English/Persian text, RTL layout, and existing access checks.
- `FormParts.tsx`: labeled fields with linked hints/errors, semantic notices, and shared action/control styles. Notices compose shadcn Alert; field labels compose Radix-backed Label.

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

Use translated product-specific action labels in actual forms. Explicitly set `type="button"` for actions inside forms that must not submit. Keep React Hook Form registrations and refs attached to the actual input component. Button's `asChild` supports composing links without nesting interactive elements.

The local Button `auto` size supports custom workflow cards and navigation buttons without imposing a fixed height or single-line text. Primary and secondary action styles retain comfortable touch targets. Custom classes are merged with primitive defaults rather than concatenated blindly.

Native select, checkbox, and radio controls retain their existing behavior and keyboard semantics. Do not replace their form wiring with custom state without verifying submission, keyboard access, and RTL interaction. TanStack Query supplies the empty frontend workspace and retains interfaces for a future external service. The extracted shared loading skeleton is unchanged.

## Adding components

`components.json` configures the source directories, Tailwind v4 stylesheet, Radix-based style, and RTL support. Add further primitives through the official CLI, review generated dependencies and theme changes, and use `@/lib/utils` for class merging. New theme colors must map to reviewed semantic tokens; do not overwrite the existing theme files with a stock palette.

After structural changes, run `npm run check-types` and `npm run build`, and verify the relevant English/Persian browser flows at desktop and mobile widths.

## Frosted surfaces

`src/styles/glass.css` provides the decorative canvas, `glass-surface`, and `glass-hero` treatments. Glass is limited to the shell, page heading, navigation, login, and setup summary. Forms, tables, and charts retain readable solid surfaces. The stylesheet uses the existing semantic colors, supplies an opaque fallback when backdrop filtering is unavailable, and disables transparency for reduced-transparency preferences, forced colors, and printing. No animated blur or moving backgrounds are used.

## Analytics charts

`WarehouseChart.tsx` uses Chart.js through `react-chartjs-2` for bars, lines, and doughnut distributions. It is dynamically imported by the report canvas, so KPI-only and table-only views do not need the chart library. Chart containers fill the available width and control their height; Chart.js uses responsive sizing with `maintainAspectRatio: false`.

Axes use localized compact numbers; tooltips and the expandable data table use original values through `formatExactValue`. Numeric coordinates are approximate and must not become KPI/reconciliation inputs. Missing values remain gaps. Distributions with negative/missing values or a non-positive total show an explanation instead of misleading slices. Doughnut legends use wrapping, scrollable HTML to keep long category lists from consuming the canvas. Persian charts use the application's font and RTL tooltips. Animations are disabled for predictable resizing and reduced motion.

## GIS report visualization

Choose **GIS map** in the report visualization builder, map two distinct numeric warehouse columns to latitude and longitude, optionally select a location label, and choose count/sum/average as with exploratory charts. Coordinates must be WGS84 degrees. The map reads the active published snapshot through the authenticated analytics API, applies existing report filters, excludes missing/non-finite/out-of-range coordinates, and displays at most 50 grouped locations. It never geocodes city names or queries unpublished source rows.

Map configuration is persisted with the report draft. GIS widgets remain exploratory and cannot bypass existing governed KPI publication gates. The existing sample dataset has no coordinate fields and does not invent locations.

`WarehouseMap.tsx` lazy-loads Leaflet and React Leaflet. The offline coordinate canvas is the default; selecting OpenStreetMap downloads the visible-area background tiles directly from its tile service and includes attribution. Data markers and popup content render locally. The map supports zoom, drag, fit-all, coordinate/value popups, and an accessible location table. No browser geolocation permission or geocoding service is used.

## Analytics pages and navigation

The frontend application shell renders one `ApplicationSidebar` for both panels, including current-panel navigation, language choices, and a panel switch link. There is no login, account identity, logout, or access control. Analytics retains `analytics/kpis`, `analytics/reports`, and `analytics/data`. Links preserve the locale and use `aria-current="page"`. The desktop sidebar becomes an expandable Menu on mobile. Workspace lists start empty; no API requests are issued.

The Analytics root and Report Panel login default to the Report Editor. Existing `/analytics?report=<id>` links redirect to `/analytics/reports?report=<id>`. The report editor remains full-width within its content column. Save report edits before navigating to a different page.

There is no global top header. Language links preserve the current page and query parameters. Configuration sidebar links use a validated `section` query parameter, so direct links and browser Back/Forward select the matching section. The login page remains standalone with its own language control and no sidebar. Server-side role/data-access checks remain in the panel layouts and APIs; sidebar visibility does not grant access.

## Financial visual character

Workspace compositions use restrained medium-weight text, fine borders, neutral shadows, and subtle glass/background tints. Teal primarily indicates actions, selection, and status; KPI values use neutral dark text with tabular digits. Shared controls use an 8px radius and compact 40px desktop sizing while retaining 44px minimum touch sizing. Numeric published-data columns are end-aligned with left-to-right numeric direction in both locales and use exact string-preserving formatting; primary-key identities are not reformatted as amounts. The existing monetary calculations and KPI definitions remain unchanged.

## Sidebar iconography and branding

Navigation uses statically imported Lucide line icons beside 12px regular-weight labels, with visible active states and unchanged accessible text. Icons inherit the item color and are decorative (`aria-hidden`) because each control retains a text label. Language, account, and logout controls use the same lightweight treatment.

The sidebar brand row uses local assets under `public/brand`: the existing Control Center mark, Microsoft's Power BI SVG, and a vector recreation of the user-supplied Netsep symbol. See `public/brand/README.md` for asset provenance and the included Power BI license. The Netsep recreation can be replaced by an original master SVG without changing the layout. Branding does not imply that a live Power BI integration is configured.

## Restrained feedback and brand hierarchy

Visible workspace errors use amber surfaces and readable error text while retaining `role="alert"`, linked field errors, and validation behavior. Remove/Exclude actions use neutral text. The shadcn destructive alias maps to the existing warning token; original imported theme definitions are preserved. Chart drawing colors use teal, blue, amber, purple, cyan, and slate rather than pink/red tones.

The sidebar now gives the Netsep mark primary placement next to the title, with Power BI as a small secondary badge. The earlier three-equal-logo row is no longer rendered. Brand asset provenance and the Netsep recreation note remain in `public/brand/README.md`.
