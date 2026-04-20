# Figma Native Paste Plan

## Decision

We are choosing **Path A — continue pursuing true native paste compatibility**.

Target workflow:
1. click browser extension button
2. copy payload to clipboard
3. switch to Figma
4. press `Ctrl+V`
5. editable structure appears on the canvas

This means plugin-based import remains only a fallback path.
The primary product goal becomes native paste compatibility.

---

## What this changes

The hardest problem is no longer capture quality alone.
The hardest problem is now:

> How does Figma encode and accept clipboard payloads for editable paste?

So the roadmap priority changes from:
- importer fidelity first

to:
- **clipboard format discovery first**

---

## Core hypothesis

Figma native paste likely depends on HTML clipboard content carrying:
- special attributes
- metadata blobs
- encoded binary buffers
- a recognizable wrapper structure

Observed clipboard samples suggest patterns such as:
- `data-metadata`
- `data-buffer`
- HTML wrappers used as clipboard carriers
- HTML comment wrapper markers inside attribute values such as `figmeta` and `figma`

But exact scene-buffer compatibility is still unknown.

---

## Required workstreams

## Workstream 1 — Payload capture / inspection

### Goal
Collect real clipboard payloads produced by Figma when copying editable objects.

### Needed outcomes
- raw `text/html` clipboard examples
- raw `text/plain` clipboard examples
- identify whether metadata attributes exist
- identify whether buffers are base64 encoded
- compare simple text, frame, and mixed object copies

### Priority test objects in Figma
1. single rectangle
2. single text node
3. rectangle + text
4. grouped frame
5. image-filled frame

---

## Workstream 2 — Payload decomposition

### Goal
Understand what in the copied payload is:
- structural wrapper
- metadata
- binary buffer
- text fallback

### Questions
- is the HTML wrapper stable?
- do `data-*` keys change by object type?
- are positions encoded inside metadata or buffer?
- is plain HTML used only as a transport shell?
- is `data-metadata` mostly descriptive while `data-buffer` carries the true editable scene serialization?

---

## Workstream 3 — Minimal reproducible paste payload

### Goal
Create the smallest synthetic clipboard payload that Figma accepts as editable paste.

### Milestone targets
1. get any synthetic payload to trigger Figma reaction
2. get a simple rectangle to paste
3. get a text node to paste
4. get a rectangle + text group to paste

---

## Workstream 4 — html2fig payload adaptation

### Goal
Translate html2fig capture output into the discovered Figma-compatible clipboard structure.

### Translation layers likely needed
- html2fig IR -> clipboard metadata model
- html2fig geometry -> Figma paste geometry
- html2fig text/image/frame -> Figma-compatible encoded buffer elements

### IR contract rule
- native clipboard experiments should consume the documented html2fig IR contract
- the minimum current contract is documented in `IR_CONTRACT.md`
- breaking IR shape changes should be paired with an explicit version update

---

## Immediate experiment plan

### Phase 1 — Observe real Figma clipboard payloads
Need a reproducible method to inspect clipboard after copying from Figma.

Potential routes:
- dedicated clipboard inspector page
- clipboard debugging tools
- browser-based paste target that logs `text/html`
- community tools / public extractor references

### Phase 2 — Build comparator fixtures
For each captured Figma payload:
- store a sanitized sample
- document what was copied
- compare against html2fig experimental outputs

### Phase 3 — Create synthetic probes
Generate payloads that progressively resemble accepted clipboard output.

Priority order:
1. reproduce wrapper format faithfully
2. reproduce metadata structure faithfully
3. isolate and classify the scene buffer encoding
4. generate a minimal synthetic buffer for rectangle/text paste

---

## Success criteria for Path A

Path A is considered viable only if we can demonstrate at least one of the following:

1. synthetic clipboard HTML causes Figma to paste editable content
2. synthetic metadata/buffer payload causes Figma to paste editable content
3. a stable minimal pattern is identified that html2fig can reproduce

If none of these become true after meaningful experimentation, Path A may need to be downgraded in favor of a plugin-assisted workflow.

---

## Practical rule for implementation

Do not guess endlessly.
Each new payload experiment should be based on one of:
- observed real Figma clipboard output
- a documented structural hypothesis
- a direct comparison with a captured payload sample

The next true blocker to remove is **clipboard payload visibility**.
