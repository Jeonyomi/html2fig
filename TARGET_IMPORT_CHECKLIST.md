# Target Import Checklist

This document defines the first real import benchmark for `html2fig`.

The target should be a **presentation-style HTML screen set** that contains:

- a cover/hero screen
- a structured informational slide with columns or cards
- a summary slide with emphasis blocks

The purpose is to evaluate the importer against a real presentation layout and identify what must improve for the result to be editable and usable in Figma.

---

## Screen 1 — Cover / Hero

### Expected structure in Figma

- one root frame for the screen
- one primary cover container/frame
- separate text nodes for:
  - main title
  - subtitle
  - footer lines
- badge/chip row represented as separate frames/text groups
- dark or branded background preserved
- visual grouping should remain understandable in the layers panel

### Likely current gaps

- nested absolute positioning may drift
- badge/chip pills may import as noisy wrappers
- dark cover background may flatten into too many frames
- footer grouping may not remain clean

### Success condition

A designer can:
- edit the title
- edit subtitle/footer copy
- recolor the main cover frame
- move/reorder badge/chip pills

---

## Screen 2 — Two-block information layout

### Expected structure in Figma

- root frame for the screen
- title and top header preserved
- two major content frames
- bullets remain editable text
- relative spacing between the two blocks remains intact

### Likely current gaps

- bullets may fragment into too many text nodes
- card/frame hierarchy may contain extra wrapper layers
- padding may not map clearly to frame bounds

### Success condition

A designer can:
- edit bullet text directly
- recolor the two major cards independently
- reuse the two-column layout as a template

---

## Screen 3 — Summary with emphasis block

### Expected structure in Figma

- title + lead text
- two upper cards or grouped summary sections
- lower emphasis block for a key takeaway
- clean card hierarchy with editable text and frame backgrounds

### Likely current gaps

- lead text box width/height may be off
- cards may include extra DOM-driven wrappers
- emphasis block may import as a generic frame instead of a clearly editable summary frame

### Success condition

A designer can:
- edit lead text
- edit both upper cards independently
- reuse the emphasis block style without rebuilding it

---

## Cross-screen evaluation checklist

When testing the first target screens, evaluate these dimensions:

### 1. Frame fidelity
- Are major layout groups imported as frames?
- Are backgrounds, borders, and radii preserved enough to edit?

### 2. Text editability
- Are headings and paragraphs imported as text nodes?
- Are bullets editable without excessive fragmentation?

### 3. Hierarchy quality
- Is the layer tree understandable?
- Are there too many meaningless wrappers?

### 4. Positioning quality
- Do child nodes land in approximately the correct place?
- Does nesting distort local coordinates?

### 5. Asset handling
- Are image-like areas imported meaningfully?
- Are background-based visuals lost?

### 6. Figma usability
- Can the imported result be used as a design starting point?
- Or would the user still need to rebuild most of the screen manually?

---

## Priority fixes implied by this target

### Highest priority
1. nested frame positioning accuracy
2. cleaner text import and fewer unnecessary wrappers
3. better grouping of card-like containers

### Medium priority
4. background-image / decorative background handling
5. smarter naming of imported nodes
6. more usable bullet/text grouping

### Later priority
7. auto-layout inference
8. component/button heuristics
9. broader site/page support beyond presentation screens

---

## Immediate next engineering step

Use this checklist while testing actual imports of the first target screens.
The first code-improvement cycle should optimize for:

- clearer hierarchy
- more stable frame positioning
- more usable editable text output

Not for perfect visual parity.
