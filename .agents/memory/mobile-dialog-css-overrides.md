---
name: Mobile dialog CSS overrides
description: Global mobile [role="dialog"] rules in discover-barefoot-bay hijack ANY dialog-role element, including Vaul bottom sheets.
---

The web app's `src/index.css` mobile media blocks contain sweeping `[role="dialog"]` rules (center + translate(-50%,-50%) positioning, width/max-height caps, full-width stacked buttons, forcing `.flex`/`.grid` children into columns, many with `!important` and `html body div` specificity).

**Why:** They were written for Radix modal Dialogs, but Vaul drawers also render `role="dialog"`, so any bottom sheet gets detached from the bottom edge, clipped, and its row layouts stacked. This caused the broken Filters drawer (floating sheet, clipped title, dead space, stacked footer).

**How to apply:** Any new bottom-sheet/drawer or non-modal dialog on mobile must be excluded via `:not([data-vaul-drawer])` (Vaul sets `data-vaul-drawer` on its content) or the rules scoped tighter. When a fixed-position overlay looks mispositioned only on mobile, grep `index.css` for `[role="dialog"]` before debugging the component.
