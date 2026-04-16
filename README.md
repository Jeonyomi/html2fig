# html2fig

`html2fig` is now aimed at one specific end-user flow:

1. click a browser action
2. copy the current page/selection
3. go to Figma
4. press `Ctrl+V`
5. get editable structure on the canvas

That means the current top-priority problem is **not** HTML capture anymore.
The active problem is:

> **how to generate a Figma-native clipboard `data-buffer` scene payload from captured HTML/IR**

## Current status

The project already has working pieces for:

- browser-side HTML capture
- intermediate JSON / IR generation
- clipboard wrapper experiments
- clipboard inspection and export
- Figma plugin import scaffolding
- a practical DOM -> Figma-oriented scene export path for deck/page import MVP

The main blocker for native paste is now clearly isolated:

- realistic wrapper HTML alone is **not enough**
- realistic metadata alone is **not enough**
- fallback `text/html` richness is **not enough**
- the missing piece is the real **scene serializer** used in `data-buffer`

## What has been confirmed

Real Figma clipboard samples show that native copy uses HTML containing:

- `data-metadata="<!--(figmeta)...(/figmeta)-->"`
- `data-buffer="<!--(figma)...(/figma)-->"`

Observed metadata baseline:

```json
{
  "fileKey": "...",
  "pasteID": 1234567890,
  "dataType": "scene"
}
```

Observed buffer facts:

- base64-decoded `data-buffer` is **not plain JSON**
- real payloads begin with the `fig-kiwij...` family prefix
- real payloads look like a binary/custom serialized scene format
- synthetic html2fig JSON payloads are ignored by Figma, even with realistic wrapper structure

## Working hypothesis

The unknown transform is now treated as:

> **HTML capture IR -> Figma-native scene binary**

So the current reverse-engineering approach is evidence-first:

1. collect real Figma-authored clipboard samples
2. compare real-vs-real samples
3. isolate stable framing vs object-specific segments
4. infer serializer layers
5. only then attempt synthetic scene generation

## Why the current tooling exists

Recent tooling work is focused on serializer reverse engineering, not on generic capture polish.

The analyzer and inspector now exist to answer questions like:

- how much of the buffer is shared between samples?
- where is the first divergence?
- is the difference concentrated in a tail/object block?
- do text-only and rectangle-only samples share a large envelope?
- are there field / chunk / length / varint-like patterns?

## Current real-sample workflow

Use only **real Figma-authored clipboard copies** for serializer analysis.
Do **not** treat extension-generated probe payloads as reverse-engineering evidence.

Recommended minimal sample order:

1. rectangle-only
2. text-only
3. rectangle + text
4. small frame with children
5. larger complex scene

## Tools

### Clipboard inspector

- `tools/clipboard-inspector.html`

Use it to:
- paste clipboard content from a real Figma copy
- inspect MIME types
- extract wrapped `figmeta` / `figma` payloads
- export a report JSON

### Buffer analyzer

- `tools/figma-buffer-analyzer.html`

It now supports:

- single-sample decode
- A/B compare mode
- metadata diff
- common prefix / suffix length
- first differing offset
- divergence hex / ascii / utf8 windows
- tail analysis
- field / chunk heuristics
- tail delta view
- compare JSON export

This tool is now the main workspace for real-vs-real buffer decomposition.

## Capture / importer components still present

These parts still matter, but they are no longer the main uncertainty:

- `capture/html2fig-capture.js`
- `extension/`
- `figma-plugin/`

They remain useful because:

- capture IR is still needed as source input
- the extension is still a practical UX shell
- the plugin path remains the fallback if native paste cannot be solved cleanly

## Current direction

Near-term engineering direction:

- keep collecting minimal real clipboard samples
- use compare tooling to isolate object-specific blocks
- keep public documentation centered on observed clipboard structure
- avoid over-investing in wrapper-only tweaks unless a real sample comparison proves a missing contract field

## Fallback path

If native paste remains blocked after enough minimal-sample analysis, the practical fallback remains:

- **Chrome Extension -> Local Bridge Server -> Figma Plugin**

Current MVP direction for real documents like `gntb_deck/index.html` is:

- capture DOM into richer `html2fig-local@0.3` scene JSON
- preserve enough layout/style hints for cards, sections, headings, lists, and slide-like frames
- support slide-by-slide deck export via `captureDeckSlides()` / `downloadDeckSlides()`
- import that JSON through the Figma plugin as editable nodes or as a grouped deck frame

This is not native paste, but it is the current shortest path to a usable Figma import workflow.

## Related docs

- `ROADMAP.md`
- `FIGMA_CLIPBOARD_RESEARCH.md`
- `FIGMA_NATIVE_PASTE_PLAN.md`
- `TESTING.md`

## One-line summary

`html2fig` is currently a reverse-engineering project for **Figma-native clipboard scene serialization**, with HTML capture as the already-established front half of the pipeline.
