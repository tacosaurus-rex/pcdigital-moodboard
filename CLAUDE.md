# Moodboard

A personal collection of design references. Folders are organized by UI surface or
visual theme. Each folder contains screenshots plus a notes.md that captures the source
URL, the one-line reaction, and a short analysis of why each reference works.

When asked to "use the moodboard" or "reference my moodboard" for a design task, list the
relevant folder(s), view each image, and read notes.md before proposing direction.

Folders: hero-sections, pdp-ecommerce, cart-checkout, navigation, type-inspiration,
color-palettes, layouts-grids, motion-interaction, misc.

---

## The moodboard capture agent

Invocation: I drop in a link and a few sentences about a page. You one-shot it: pull
whatever is worth keeping, read between the lines to work out why I liked it, and distil
that into writing. I should not have to spell out the steps.

What "one-shot pull whatever you need" means in practice:
1. Pick a folder. Infer it from the link and my sentences (a product page goes to
   pdp-ecommerce, a nav pattern to navigation, and so on). Only ask if it is genuinely
   ambiguous. Create the folder if missing.
2. Capture the full page. Use `capture-deep.mjs` by default (it clears Cloudflare and
   tracker-heavy storefronts). Fall back to `capture.mjs` only for simple/static pages.
   If a capture comes back as a bot wall, blank, or login/paywall, say so and retry headed.
3. Capture the interactions I would care about. Run `explore.mjs <url>` to list triggers,
   then open the meaningful ones (modals, drawers, popovers, buy-box info links, size
   guides, "ingredients", "clinical", "results", "how it works", tabs that reveal content,
   notable hovers) and screenshot each open state with `capture-modals.mjs`. Read my
   sentences for hints: if I mention modals, gifs, popups, or interactions, those are
   mandatory, not optional. Dismiss marketing email popups before shooting.
4. Capture motion if the page deserves it. Run `capture-motion.mjs` for scroll-through
   motion when (a) my sentences mention animations, parallax, on-scroll effects, reveals,
   pinning, or hover, OR (b) the page is clearly motion-driven (multiple `position: sticky`
   sections, intersection-observer reveal classes, scroll-pinned canvas, etc.). For an
   auto-advancing hero slider, video hero, or any motion concentrated above the fold,
   use `capture-hero.mjs` instead (or in addition): it dwells at the top and captures
   the slider cycle that capture-motion would scroll past. Output of both is a `.webm`
   for fidelity plus numbered PNG frames so any future session can reference inline.
5. Examine the page as a whole and write the analysis. Do not just transcribe what is on
   screen. Work out why it persuades or delights: layout, hierarchy, proof devices,
   progressive disclosure, branding cohesion, motion, social proof, positioning. Connect it
   back to what I reacted to, and end with a "steal this" line of concrete, reusable lessons.
6. File everything locally and show me the screenshots so I can confirm the capture is not broken.
7. Publish, so claude design and anything else can reference it. Two destinations, both required:
   a. **GitHub.** From `~/moodboard/`, `git add .` and commit with a Conventional Commit
      message (`feat(moodboard): <brand> reference`), then `git push` to
      `github.com/tacosaurus-rex/pcdigital-moodboard` (public). The push makes every PNG
      and `.webm` reachable at `raw.githubusercontent.com/tacosaurus-rex/pcdigital-moodboard/main/<folder>/<filename>`.
   b. **Notion.** Create a row in the PCDIGITAL Moodboard database via the Notion MCP
      (`mcp__claude_ai_Notion__notion-create-pages` with parent
      `data_source_id: 1f19e820-43f3-48c6-aee6-d0b2d12cd510`). Set properties:
      `Brand`, `Folder`, `Source URL`, `date:Captured:start` (`"YYYY-MM-DD"`),
      `date:Captured:is_datetime` (`0`), `Tags` (JSON-encoded string array). Page content
      mirrors the notes.md entry (Reaction, Why this works, Steal this) with each
      screenshot embedded via its raw GitHub URL. Use the same emoji icon family as the
      existing entries (food brand = 🌱, water/hydration = 🌊, energy = ⚡, etc.).

### Tools (all live in this folder)

| Tool | Use |
|---|---|
| `capture-deep.mjs <url> <folder> "<note>"` | Default full-page capture. Headed + realistic fingerprint, clears Cloudflare/bot walls. Writes NN-host.png + notes.md entry. |
| `capture.mjs <url> <folder> "<note>"` | Fast headless full-page capture for simple/static pages. Same output contract. |
| `explore.mjs <url>` | Discovery. Prints candidate interactive triggers (buttons, links, drawer-open, aria-haspopup) as JSON so you can decide what to open. |
| `capture-modals.mjs <url> <items.json>` | Opens interaction triggers and screenshots each open state. items.json = `[{ "label": "...", "tag": "drawer-open", "text": "Supplement Facts" }]`. Reloads fresh per item, dismisses promo popups. Writes `.modal-<label>.png` for review, then promote to NN-host-<label>.png. |
| `capture-motion.mjs <url> <folder> "<note>"` | Records a ~18s smoothly-scripted scroll-through. Outputs `NN-host.webm` (motion fidelity, for playback) plus 8 `NN-host-motion-XX.png` viewport frames (inline-readable so any session can reference the progression). Use when motion is the point: animations, parallax, on-scroll reveals, pinning, hover sequences. |
| `capture-hero.mjs <url> <folder> "<note>" [frames=5] [intervalMs=3000]` | Dwells at scroll Y=0 and captures the auto-cycle of a hero slider, video hero, or above-the-fold animation. Outputs `NN-host-hero.webm` plus `NN-host-hero-XX.png` viewport frames. Dismisses email-capture popups before every frame so a Klaviyo-style overlay does not occlude the hero. Use this when motion is concentrated above the fold and `capture-motion` would scroll past it. |

Pass JSON to scripts via a file, not an inline argument (PowerShell strips the quotes).

### File naming

- Full page: `NN-<hostname-with-dashes>.png`
- Interaction state: `NN-<hostname-with-dashes>-<short-label>.png`
- Motion clip: `NN-<hostname-with-dashes>.webm`
- Motion frame: `NN-<hostname-with-dashes>-motion-XX.png` (01 through 08)
- Hero clip: `NN-<hostname-with-dashes>-hero.webm`
- Hero frame: `NN-<hostname-with-dashes>-hero-XX.png` (01 through N)
- Group a reference's captures under consecutive numbers so a source's full page,
  interactions, hero set, and motion set all sit together.

### notes.md format (per reference)

```
## <Brand>, <Product/Page>
Source: <url>
Captured: <date>
Captures in this set: <list of files>
Reaction: <my verbatim sentences>
Why this works: <2 to 6 bullets, read-between-the-lines, not a transcript>
Steal this: <one line of concrete reusable lessons>
```

### Publishing destinations

- **Local source of truth**: `C:\Users\jay3y\moodboard\` (this folder).
- **Public mirror (image host)**: https://github.com/tacosaurus-rex/pcdigital-moodboard
  (public; raw URLs at `raw.githubusercontent.com/tacosaurus-rex/pcdigital-moodboard/main/...`).
- **claude design surface**: Notion database "🎨 PCDIGITAL Moodboard" under the Claude
  Projects parent. Database URL: https://www.notion.so/ca3727007fcb428aa4a592c98b8629a7
  Data source ID: `1f19e820-43f3-48c6-aee6-d0b2d12cd510` (use with `data_source_id` when
  creating pages). Schema: `Brand` (title), `Folder` (select), `Source URL` (url),
  `Captured` (date), `Tags` (multi-select).

### Conventions

- Canadian English. No em dashes.
- Best shot at hands-off: only ask a question when a choice genuinely changes the output.
- See the worked examples in `pdp-ecommerce/notes.md` (Zero Acre, Buoy, Foreign Waters)
  and the matching Notion rows for the bar.
