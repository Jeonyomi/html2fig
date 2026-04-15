# html2fig-local

Minimal local MVP for **current HTML capture -> Figma-friendly JSON export**.

See also: `ROADMAP.md` for the product goal, editable MVP definition, and success criteria.

## Goal

This project captures the **currently rendered page in the browser** and exports a JSON structure that is suitable as an intermediate format for a future Figma importer/plugin.

This MVP is intentionally narrow:
- browser-side capture only
- JSON export only
- no Figma plugin yet

## What it captures

- visible DOM elements
- visible text nodes
- images (`img`)
- bounding boxes via `getBoundingClientRect()`
- basic computed style information:
  - background color
  - background image URL extraction
  - text color
  - border radius
  - border width/color
  - opacity
  - box shadow
  - text alignment
  - font family / size / weight / line-height / letter spacing
- multi-rect text ranges (`rects`) for wrapped text
- optional subtree capture via selector

## Output model

The exporter creates a JSON document with:
- `meta`
- `root`
- `nodes`

Node types currently used:
- `frame`
- `text`
- `image`

The output is **Figma-friendly**, not yet a direct Figma plugin payload.
It is intended as the intermediate structure for a later importer.

## Files

- `capture/html2fig-capture.js` ??browser-side capture script
- `schema/figma-friendly-schema.json` ??minimal schema description

## Usage

### Option A: paste into DevTools console

1. Open the target webpage in Chrome.
2. Open DevTools.
3. Paste the contents of `capture/html2fig-capture.js` into the console.
4. Run:

```js
html2figLocal.captureCurrentPage()
```

This returns the JSON object in memory.

To download it directly:

```js
html2figLocal.downloadCapture()
```

This downloads `html2fig-export.json`.

### Capture a specific subtree only

```js
html2figLocal.captureCurrentPage({ selector: '#app' })
html2figLocal.downloadCapture('app-export.json', { selector: '#app' })
```

This is useful when the full page contains browser chrome, floating widgets, or unrelated layout outside the target surface.

### Option B: save as a local snippet/bookmarklet source

You can also load the same script as a local snippet in DevTools and run it repeatedly.

## Example workflow

1. Open a webpage
2. Inject the script
3. Export JSON
4. Feed that JSON into a future Figma plugin/importer

## Current limitations

This is still an MVP and does **not** yet handle everything well.

Known limitations:
- no Figma plugin/importer yet
- no auto-layout inference
- no CSS pseudo-element support
- limited support for SVG/canvas/video/iframe
- no responsive variant capture
- no interaction state capture (hover/focus/open/active)
- element hierarchy is DOM-driven, not layout-optimized
- background images are extracted only as URL references, not binary assets
- no font asset packaging

## What was improved in this iteration

- optional selector-based capture
- wrapped text now exports `rects` in addition to a primary `rect`
- background-image URL extraction
- basic ignored-tag filtering (`script`, `style`, `noscript`, `template`)
- safer node naming and metadata for selection scope

## Fixtures / validation baseline

A small manual validation set now lives under `fixtures/`:

- `fixtures/basic-card.html`
- `fixtures/wrapped-text.html`
- `fixtures/background-image.html`
- `fixtures/expected-output-notes.md`

Open a fixture in Chrome, inject `capture/html2fig-capture.js`, and run capture against either the full page or a selector root.

These fixtures are not a full automated test suite yet, but they provide a repeatable baseline for:
- visible frame/text/image extraction
- selector-based capture
- wrapped text `rects`
- background-image URL extraction

## Figma plugin MVP scaffold

A first-pass importer scaffold now exists under:

- `figma-plugin/manifest.json`
- `figma-plugin/code.js`
- `figma-plugin/ui.html`

What it currently does:
- paste html2fig JSON into the plugin UI
- create a root frame in Figma
- import basic `frame`, `text`, and `image` nodes
- attempt remote image fetching for `img` sources

What it does **not** yet fully solve:
- robust font mapping
- background-image fills as first-class Figma image fills
- layout optimization / auto-layout inference
- precise nested relative positioning for all cases
- production-grade asset packaging

## Recommended next steps

1. Improve importer fidelity for nested coordinates and fills
2. Map background-image references to Figma image fills
3. Add first-class SVG mapping and canvas export fallbacks
4. Add asset packaging / image download helpers
5. Add a cleaner bookmarklet or extension wrapper
6. Add an automated browser test harness around the fixtures

## One-line summary

`html2fig-local` is a practical local MVP for capturing the current browser-rendered HTML UI and exporting a Figma-friendly editable layer structure in JSON form.

