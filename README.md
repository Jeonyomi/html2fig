# html2fig-local

Minimal local MVP for **current HTML capture -> Figma-friendly JSON export**.

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
  - text color
  - border radius
  - border width/color
  - opacity
  - box shadow
  - text alignment
  - font family / size / weight / line-height / letter spacing

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

- `capture/html2fig-capture.js` — browser-side capture script
- `schema/figma-friendly-schema.json` — minimal schema description

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

### Option B: save as a local snippet/bookmarklet source

You can also load the same script as a local snippet in DevTools and run it repeatedly.

## Example workflow

1. Open a webpage
2. Inject the script
3. Export JSON
4. Feed that JSON into a future Figma plugin/importer

## Current limitations

This is an MVP and does **not** yet handle everything well.

Known limitations:
- no Figma plugin/importer yet
- no auto-layout inference
- no CSS pseudo-element support
- limited support for SVG/canvas/video/iframe
- no responsive variant capture
- no interaction state capture (hover/focus/open/active)
- element hierarchy is DOM-driven, not layout-optimized
- text rects use the first client rect only
- background images are not extracted as first-class image nodes

## Recommended next steps

1. Add a Figma plugin that imports this JSON
2. Infer grouping/frame hierarchy more intelligently
3. Add support for background images and SVG mapping
4. Add a selectable-area export mode
5. Add a cleaner bookmarklet or extension wrapper

## One-line summary

`html2fig-local` is a practical local MVP for capturing the current browser-rendered HTML UI and exporting a Figma-friendly editable layer structure in JSON form.
