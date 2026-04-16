# Figma Clipboard Research

## Objective

The product goal is not just:
- capture HTML
- export JSON
- import via plugin UI

The stronger target workflow is:

1. click browser extension button
2. copy structured payload to system clipboard
3. switch to Figma
4. press `Ctrl+V`
5. get an editable structure on the canvas

This document tracks the research needed to move from a plugin-import workflow to a **native paste-compatible workflow**.

---

## Why this research matters

Current `html2fig` MVP already supports:
- browser-side HTML capture
- clipboard handoff of JSON
- Figma plugin import scaffold

But this is still too many steps for the desired UX.
The critical missing piece is understanding how Figma accepts clipboard content during native paste.

---

## Working hypothesis

Figma native paste likely does **not** rely on plain text JSON.
It appears to rely on HTML clipboard content with embedded metadata and/or encoded buffers.

This means the next milestone may require generating a clipboard payload that is closer to Figma's internal or quasi-internal clipboard representation.

---

## Research questions

### 1. What clipboard MIME types does Figma react to?
Candidate categories:
- `text/plain`
- `text/html`
- `image/png`
- `image/svg+xml`
- custom/embedded metadata inside HTML

### 2. Is editable paste triggered by HTML markers?
Hypothesis:
- HTML payloads with special `data-*` attributes or embedded metadata may be used.

### 3. Does Figma require binary buffers encoded in HTML?
Observed clipboard samples indicate that editable paste payloads may include:
- metadata blocks
- encoded buffers
- span-based or HTML-wrapper-based serialization
- HTML comment wrappers embedded inside attribute values

### 4. What is realistically reproducible?
Need to determine whether:
- native editable paste is reproducible externally, or
- plugin-assisted paste is the only robust path.

---

## Strategy options

## Option A — True native paste compatibility

### Goal
Generate clipboard payloads that Figma directly interprets as editable pasted structure.

### Pros
- matches target UX exactly
- browser extension -> clipboard -> Ctrl+V

### Risks
- reverse-engineering required
- may depend on undocumented internal format
- brittle if Figma changes internal clipboard conventions

---

## Option B — Paste-like hybrid workflow

### Goal
Use clipboard plus a Figma-side receiver path that feels close to native paste.

### Example
- extension copies structured payload
- Figma plugin intercepts / reads clipboard and imports with one action

### Pros
- much easier to make reliable
- still close to user goal

### Risks
- not true native paste
- one extra step may remain

---

## Near-term experimental plan

### Experiment 1 — HTML clipboard only
Write structured HTML to the clipboard and test whether Figma pastes anything meaningful.

Current implementation status:
- extension popup payload mode: `HTML wrapper (text/html)`

Success criteria:
- Figma reacts to paste
- more than plain text appears

### Experiment 2 — SVG clipboard payload
Write SVG markup to clipboard.

Current implementation status:
- extension popup payload mode: `SVG snapshot (text/plain + text/html)`

Success criteria:
- Figma pastes vector or grouped structure
- determine whether SVG is editable enough for MVP fallback

### Experiment 3 — HTML with embedded metadata markers
Construct HTML wrappers with `data-*` metadata and compare behavior.

Current implementation status:
- extension popup payload mode: `Experimental rich clipboard`
- uses HTML wrappers with `data-html2fig` markers as a first probe

Success criteria:
- Figma treats payload differently than plain HTML

### Experiment 4 — Structured HTML wrapper probe
Construct an HTML payload that uses a more specific clipboard wrapper structure with HTML elements carrying:
- `data-metadata`
- `data-buffer`

and attribute values wrapped as:
- `<!--(figmeta)...(/figmeta)-->`
- `<!--(figma)...(/figma)-->`

Current implementation status:
- extension popup payload mode: `Figma-style HTML probe`
- initial implementation writes base64 metadata and payload buffers into `text/html`
- next revision should use the observed wrapper-comment format inside attribute values

Success criteria:
- determine whether Figma reacts differently to this structure than to generic HTML wrappers
- separate wrapper correctness from buffer correctness

### Experiment 5 — Clipboard sample decomposition
Analyze captured clipboard samples to distinguish:
- transport HTML wrapper
- metadata payload
- scene buffer payload

Current understanding:
- `data-metadata` appears to hold base64-encoded JSON-like scene metadata
- `data-buffer` appears to hold a non-JSON encoded scene buffer
- editable paste likely depends more on `data-buffer` correctness than on plain HTML shape alone

Success criteria:
- identify which parts are easy to synthesize immediately
- narrow the true blocker to scene-buffer serialization

### Experiment 5 — Figma-style rich multi-mime probe
Write a richer clipboard bundle that combines:
- `text/plain`
- `text/html`
- `image/svg+xml`
- multiple metadata attribute variants

Current implementation status:
- extension popup payload mode: `Figma-style rich multi-mime probe`

Success criteria:
- determine whether Figma reacts differently when multiple mime types and metadata variants are present together

---

## Interim product decision

Until native paste compatibility is proven, `html2fig` should continue supporting:
- extension -> clipboard
- plugin-side import

This remains the fallback path.

But all new UX decisions should preserve the ability to switch to:
- extension -> clipboard -> native Figma paste
if research proves it is feasible.

---

## Practical engineering rule

Do not over-optimize the plugin importer if native paste becomes achievable.
Do not over-invest in native paste assumptions until at least one clipboard experiment shows a plausible path.

The correct next step is experimentation, not speculation.
