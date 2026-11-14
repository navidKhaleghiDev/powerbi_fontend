# Theme notes

`src/global.css` imports Tailwind CSS v4 and uses its default color variables and utilities. The former Figma color palette and semantic Tailwind color aliases were removed at the user’s request. Legacy component selectors still contain some direct color values; these are presentation rules, not a configured palette.

The stylesheet remains the only CSS file under `src`. Before changing its colors or layout, check the affected dashboard, login, dataset, and data-flow views in both English and Persian.
