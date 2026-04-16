# html2fig Roadmap

## Product Goal

`html2fig` aims to capture browser-rendered HTML UI and reconstruct it in Figma as an **editable and usable design structure**.

The target outcome is **not** a flat screenshot or a single vector blob.
The target outcome is a Figma document that preserves enough hierarchy and styling that a designer can immediately continue editing.

## What “editable / usable structure” means

A successful import should produce:

- **Text as real Figma text nodes**
- **Cards / panels / sections as real Figma frames**
- **Images as image fills or image-backed layers**
- **Parent-child hierarchy that remains understandable in the layers panel**
- **Layout close enough to the source that the imported result is a practical starting point**

In other words, the output should be usable as a design starting point, not just a visual reference.

## Current status

Today, the repo includes:

- browser capture script (`capture/html2fig-capture.js`)
- fixture pages for manual validation (`fixtures/`)
- initial Figma plugin scaffold (`figma-plugin/`)

This means the project has the first end-to-end foundation:

HTML -> captured JSON -> Figma importer scaffold

But fidelity is still early.

## MVP focus

The first real milestone is **Editable MVP**.

### Editable MVP definition

For a single target screen, the importer should:

1. create a page/root frame
2. recreate visible containers as frames
3. recreate visible text as Figma text nodes
4. recreate images as image-backed layers where possible
5. preserve enough geometry that the imported result is recognizably structured

### Not required for Editable MVP

- perfect CSS fidelity
- full auto-layout inference
- all SVG/canvas support
- complete component recognition
- production-grade image packaging

## First official target

The first official import target should be a **real presentation-style HTML screen set** with:

- strong text hierarchy
- grouped containers/cards
- repeated badge or chip patterns
- clear cover/title surfaces

Why this target:

- real user-facing need
- presentation layout is visually structured
- contains title text, badges, containers, and branding blocks
- practical benchmark for Figma editability

## Success criteria

An import is considered successful when the user can:

1. edit title text directly in Figma
2. select and recolor card/frame backgrounds
3. move and reorganize layers without rebuilding from scratch
4. understand the layer structure in the Figma sidebar
5. use the result as a starting point for design refinement

## Milestones

### Milestone 1 — Editable MVP

- import single slide/single screen into Figma
- basic frame/text/image reconstruction works
- hierarchy is understandable
- enough fidelity for editing

### Milestone 2 — Usable Importer

- better nested positioning
- background-image support in importer
- stronger font/style mapping
- less noisy wrapper hierarchy
- improved output usability for real design edits

### Milestone 3 — DivRIOTS-lite quality

- smarter grouping
- layout inference
- button/card/list heuristics
- more robust style fidelity
- output feels closer to a production-ready import

## Near-term priorities

1. Define import quality using representative presentation-style HTML screens
2. Continue real capture -> import tests and document gaps
3. Prioritize native clipboard research alongside importer fidelity
4. Separate transport-wrapper work from scene-buffer serialization work
5. Add automation around fixture validation later

## Native clipboard track

A parallel workstream now exists for native editable paste.

Short-term practical split:
- keep browser capture and plugin import working
- improve clipboard transport structure in `text/html`
- document observed wrapper patterns and metadata layout

Current blocker:
- the missing serializer for the scene buffer carried in clipboard payloads

Implication:
- capture quality is no longer the only bottleneck
- editable native paste depends on reproducing the correct clipboard scene buffer, not just emitting HTML or JSON

## Guiding principle

Do not optimize for “capturing everything.”
Optimize for **making the imported result usable in Figma**.
