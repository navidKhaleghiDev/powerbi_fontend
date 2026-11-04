# Design-system review

Reviewed against the user-supplied **CRM Design System** document. This is a source-code comparison of the current independent Power BI Control Center, not a claim of pixel-perfect or accessibility compliance. No application UI or primitives were changed during this review.

## Result

The application is **partially aligned**. Its localization, RTL structure, shared skeleton, component reuse, and server-state separation follow the reference's direction. Its control density, navigation styling, typography, decorative treatments, and dark-mode coverage do not fully match.

The reference describes CRM-specific component families that are not present in this repository. The user's earlier requests explicitly selected shadcn/ui, custom Power BI workflow components, full-width report items, and blurred surfaces. Those choices must be distinguished from accidental inconsistencies; adopting the reference does not require importing the CRM application or changing data/security behavior.

## Findings, in priority order

### 1. Dark-mode coverage is incomplete

**Evidence:** `src/components/workspace/FormParts.tsx` defines white controls, slate text, and light borders without corresponding dark states. `DataBrowser.tsx` uses a fixed light table header. Similar light-only classes remain across workspace forms and cards. `src/styles/theme/colors.css` has `.dark` token values and `src/styles/shadcn.css` provides aliases, but many custom classes bypass those tokens. `WorkspaceProviders.tsx` provides the query client, not a theme controller.

**Impact:** A class-based dark theme cannot be considered complete just because primitives and semantic tokens support it. Controls, tables, badges, charts, and geographic backgrounds require a consistent review.

**Recommended correction:** Migrate custom surface/text/border classes to semantic utilities or add paired `dark:` states. Review chart/map palettes independently. Verify both languages, light/dark states, and focus/disabled/error states in the browser before describing dark mode as supported throughout.

### 2. Control and navigation density differ from the reference

**Evidence:** `FormParts.tsx` uses `min-h-11` (44px) and `rounded-xl` for shared controls. Labels use `text-sm`. `AnalyticsSidebar.tsx` uses `min-h-12` (48px), `rounded-xl`, and a solid teal active background. The reference specifies 40px controls/sidebar rows, 8px control radii, smaller labels, and a subtle teal active navigation surface. Generated Button defaults also have their own 36px size, while application actions override it.

**Impact:** The controls are reusable, but the sizing and visual hierarchy do not yet form the single compact family described by the document.

**Recommended correction:** Define explicit application control/navigation variants in the existing CVA layer and shared compositions. Use a compact desktop size and a deliberate touch-friendly size where needed. Keep the input font large enough on mobile and allow translated labels to wrap; do not force fixed widths that clip Persian text.

### 3. Typography does not follow the requested family consistently

**Evidence:** `src/App.tsx` applies Kalameh to Persian and `font-sans` to English. `PageHeading.tsx` and `LoginPanel.tsx` use `font-bold`; several actions use `font-semibold`. The reference calls for Kalameh and `font-medium` for its bold variants. `src/styles/globals.css` currently declares weights through 600, while `font-bold` requests 700.

**Impact:** Text weight and language appearance vary. Weight 700 has no matching locally declared font face and may be synthesized by the browser.

**Recommended correction:** Decide the intended English font explicitly, use shared typography variants, and align requested weights with the registered font faces. Do not apply the document's largest heading sizes to dense operational sections; its compact-control guidance is more relevant there.

### 4. Decorative gradients and colored shadows conflict with the reference

**Evidence:** `src/styles/glass.css` defines radial gradients, a colored custom shadow, and translucent blurred surfaces. `PageHeading.tsx` uses a decorative four-pixel start border. The reference disallows ornamental gradients, arbitrary colored shadows, and thick decorative borders.

**Important context:** The glass treatment was explicitly requested earlier in this conversation. It is a known design-policy conflict, not an accidental implementation error. The large login introduction and report introduction have already been removed at the user's request.

**Recommended correction:** If strict conformance is desired, remove the decorative background gradients/colored shadow and use quiet semantic surfaces with `shadow-sm`. If glass remains a deliberate Power BI exception, document exactly where it is allowed. Blur can remain restrained without requiring gradients or colored shadows.

### 5. Some report sections still nest card-like surfaces

**Evidence:** `AnalyticsPanel.tsx` wraps the report canvas in a bordered, rounded surface and places rounded white widget articles inside it. Multiple form areas also use independent card containers for structural grouping.

**Impact:** This differs from the document's section-wrapper/repeated-item distinction and adds visual layers around dense reporting content.

**Recommended correction:** Use a lightweight application section composition for grouping and reserve Cards for repeated report items or actual content records. Preserve full-width charts, map controls, and published-data boundaries.

### 6. Tables are semantic HTML, not the CRM's grid-table family

**Evidence:** `DataBrowser.tsx` uses `<table>`, scoped headers, a scroll region, and 12px radius rather than a `PageLayout.PageTable` 12-column grid and 24px container radius. Similar tables appear in chart and map data disclosures.

**Impact:** Styling differs, but semantic HTML is not inherently a defect. The reference's 11-column budget applies to its particular grid table with a pinned actions column; these tables do not use that component and should not inherit the budget mechanically.

**Recommended correction:** Standardize table surfaces, padding, header colors, hover states, and dark variants using a shared local table composition. Preserve scoped headers, keyboard scrolling, and accessible captions. Do not replace semantic tables solely to imitate an unavailable CRM grid implementation.

## What already aligns

| Area                     | Current evidence                                                           | Assessment                                                                 |
| ------------------------ | -------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Reusable primitives      | `src/components/ui/`, CVA Button/Badge/Alert variants, `FormParts.tsx`     | Aligned approach; shadcn is the explicitly chosen local foundation         |
| Server state             | `src/hooks/useWorkspace.ts`, TanStack Query, shared workspace cache        | Aligned separation; primitive UI components contain no data-fetching logic |
| Loading                  | Existing extracted `LoadingSkeleton.tsx` reused without edits              | Aligned                                                                    |
| Localization             | English/Persian locale files and `use-intl` hooks                          | Aligned for reviewed UI; keep parity checks                                |
| RTL structure            | Document direction, logical `ms`/`me`/`text-start`, locale-prefixed links  | Aligned approach; placeholder alignment can be made more explicit          |
| Dense operational text   | Most form and metadata text uses `text-sm`/`text-xs`                       | Mostly aligned, despite inconsistent weights and label sizing              |
| Responsive content       | `min-w-0`, bounded scrolling, responsive sidebar, full-width report column | Aligned with the application's explicit layout requirements                |
| Status semantics         | Shared StatusBadge and Notice; fictional data remains identified           | Aligned approach; dark states need work                                    |
| Chart/map drawing colors | Fixed colors are confined to visualization drawing code                    | Consistent with the reference's allowance for fixed drawing palettes       |
| Modal/grid-table rules   | No corresponding CRM modal/PageTable family is present                     | Not applicable until an equivalent feature is introduced                   |

## Component-family mapping for this repository

| CRM reference           | Current Power BI equivalent                                                           |
| ----------------------- | ------------------------------------------------------------------------------------- |
| BaseButton / CVA styles | shadcn Button + application action variants in FormParts                              |
| BaseInput               | shadcn Input/Textarea + Field                                                         |
| BaseTypography          | Native semantic headings/text today; shared typography variants are a gap             |
| SectionWrapper          | No dedicated equivalent yet; current pages compose Card/details/section               |
| Badge/status family     | shadcn Badge + StatusBadge/Notice                                                     |
| Table family            | Semantic HTML tables and published DataBrowser                                        |
| Skeleton loader         | Existing extracted shared LoadingSkelton                                              |
| BaseIcon                | Local decorative SVG/CSS marks and visualization drawing; no matching BaseIcon family |

Do not install CRM-specific dependencies or copy unrelated CRM domain logic to satisfy naming differences. The reference's instruction not to edit atoms is compatible with reviewing and adjusting application compositions first; no atom edits were made for this audit.

## Suggested implementation order

1. Establish shared compact application variants for controls, typography, and navigation.
2. Complete semantic surface/text/border and dark-state coverage in shared compositions.
3. Standardize sections and tables while preserving semantic HTML and full-width reports.
4. Resolve the documented glass-versus-strict-reference conflict explicitly.
5. Verify login, Configuration, KPI selection, report editing, published data, charts, and GIS in English/Persian at desktop/mobile sizes, including focus, disabled, error, and empty states.

## Validation scope

This review inspected source files and the provided reference. It did not modify the application, inspect a CRM runtime, measure contrast, or perform a fresh pixel comparison. The build was not rerun for this documentation-only change. Build success does not establish visual conformance with this newly supplied document.
