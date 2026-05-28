# PCDIGITAL Moodboard

Design references gathered for PCDIGITAL client work. Each folder is a UI surface or
visual theme. Each folder's `notes.md` is the source of truth: screenshots, hero/motion
clips, and a read-between-the-lines analysis of why each reference works, with a
"steal this" line of concrete reusable lessons.

This repo also hosts the **moodboard capture agent** that drives all of this. See
[`CLAUDE.md`](CLAUDE.md) for the agent spec, tools, and invocation pattern.

## Folders

- [`pdp-ecommerce/`](pdp-ecommerce/notes.md) — Product detail pages
- `hero-sections/`, `cart-checkout/`, `navigation/`, `type-inspiration/`,
  `color-palettes/`, `layouts-grids/`, `motion-interaction/`, `misc/`
  (empty until populated)

## Capture agent (top-level scripts)

| Tool | Use |
|---|---|
| `capture-deep.mjs` | Default full-page screenshot, clears bot walls |
| `capture.mjs` | Fast headless full-page for simple sites |
| `explore.mjs` | Lists interactive triggers on a page |
| `capture-modals.mjs` | Opens triggers and screenshots each modal/drawer open state |
| `capture-motion.mjs` | Scroll-through `.webm` + 8 viewport frames |
| `capture-hero.mjs` | Dwells at top of page for auto-advancing hero sliders |

Sources: every screenshot is captured from a publicly accessible web page. This
collection exists for reference and design analysis only.
