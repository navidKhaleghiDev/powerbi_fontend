# CRM theme colors

Source: Figma file `21KkH5EcXapaUsMyAuDLX2`, semantic documentation frame
`34487:97564` (57 variables). The initial import includes 50 verified light/dark
pairs. Access hit the Figma MCP plan limit before both frames could be
inspected.

Pending verification: `icon/warning`, `interaction/selected`,
`interaction/transparent`, `overlay/scrim`, `surface/brand-hover`,
`surface/brand-subtle`, and `surface/card`. Do not guess their missing values.
The second requested frame, `34487:97703`, remains uninspected and unimported.

- Figma `text/primary` maps to CSS `--text-primary` and the Tailwind color
  `text-primary`, used as `text-text-primary`.
- The color-token section of `src/global.css` owns complete CSS color values and maps them to utilities with
  Tailwind v4 `@theme inline`. Opacity modifiers use v4's native color mixing.
- Light values live on `:root`; `.dark` overrides values. The existing theme
  provider controls that class. Token utilities need no duplicate `dark:` color.
- Preserve exact source values, including canvas/muted `#f4f7fa` and dark raised
  `#0b1220`; they are not interchangeable with nearby Tailwind palette colors.
- Keep role tokens separate even when their values match.
- Existing Tailwind colors and legacy background/foreground values remain
  available. This adds utilities; existing components have not been migrated.
- This project uses Tailwind v4 with `@tailwindcss/postcss`. The single global stylesheet imports Tailwind with `source("./")` to scan `src`.
- The compatibility section of `src/global.css` retains the v3 palette, shape/effect values, default
  borders, placeholders, rings, outline-none behavior, and legacy flex/opacity
  utilities. Do not remove compatibility rules until their consumers have been
  migrated.
- Dark mode follows the `.dark` class for both tokens and legacy body colors.
  RTL/LTR variants preserve ancestor direction selectors; built-in v4 hover
  behavior only applies on devices that support hover.
- Tailwind v4 requires modern browsers (Safari 16.4+, Chrome 111+, Firefox
  128+). The compatibility stylesheet preserves design values, not support for
  browsers below that baseline.
- Radius, spacing, typography and shadow semantic values still require designer
  input. Existing scales remain available; no new design values were invented.

Example: `bg-surface-default text-text-primary border border-border-default`;
`bg-action-brand-default/50` supports opacity.

## Avatar and badge screenshot import

Added 28 light/dark pairs from `Screenshot From 2026-10-28 05-30-53.png`, from
`avatar/bg` through `badge/neutral/border/disabled`. This screenshot is a
partial source; the rest of the component-token frame is still pending. Use the
printed hex labels as the source, preserving eight-digit hex alpha:
`badge/danger/border/default` dark `#7f1d1d80`, `badge/gold/bg/default` dark
`#cfae802e`, and `badge/info/bg/default` dark `#1e3a8ab2`. Names preserve
Figma's category hierarchy without its `crm-` namespace. For example,
`badge/brand/bg/default` becomes `bg-badge-brand-bg-default`.

## Additional component screenshot import

The screenshots `Screenshot From 2026-10-28 05-31-56.png` and
`Screenshot From 2026-10-28 05-32-04.png` extend coverage through
`button/danger/text/disabled`: 30 additional pairs (108 total color tokens).
Overlapping rows are reused, not duplicated. The clearer screenshot corrects
`badge/neutral/border/disabled` light to `#e5e7eb`. Preserve alpha in dark badge
backgrounds: purple `#581c8780`, success `#14532d80`, warning `#713f1280`. Read
the printed hex labels rather than inferring colors from swatches, which can
differ in these screenshots. `breadcrumb/icon/def` preserves the source name
exactly. The screenshots show no layout values or danger-button tokens beyond
`text/disabled`; those remain pending rather than inferred.

## Button and control screenshot import

Screenshots `Screenshot From 2026-10-28 05-32-40.png`,
`Screenshot From 2026-10-28 05-32-46.png`, and
`Screenshot From 2026-10-28 05-32-52.png` add 58 pairs (166 total), from
`button/danger/text/hover` through `dropdown/border/default`. Preserve
`counter/control/icon/disable` exactly as named in the source. The light
secondary disabled/hover backgrounds use `#0000000a` and the light tertiary
pressed border uses `#00000000`. Other values follow printed hex labels,
including where the adjacent swatch appears inconsistent. Only visible tokens
are imported; do not infer absent component states.

## Modal background

- The supplied screenshot defines `modal/bg` as light `#ffffff` and dark
  `#111827`. Use `bg-modal-bg`, mapped to `--modal-bg`, for this surface.

## Dropdown item and state tokens

- Imported all 15 dropdown pairs from the supplied 2026-10-31 screenshot, from
  `border/disabled` through `text/secondary`. Preserve alpha: default item light
  `#00000000`, hover light `#0000000a`, pressed dark `#134e4a80`.
- Item default, hover and pressed backgrounds describe interaction states;
  alternating row backgrounds must not replace them.

- Notice-card warning background and border aliases reuse the existing
  surface-warning-subtle and border-warning semantic values in both themes.
