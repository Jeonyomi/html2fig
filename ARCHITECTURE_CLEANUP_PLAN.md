# html2fig Architecture Cleanup Plan

## Non-negotiable product goal

Keep the primary user flow unchanged:

1. copy on web via extension
2. switch to Figma
3. paste
4. get editable structure

Native paste remains the primary goal.
This cleanup only reorganizes code so native-paste research can move faster and more safely.

## Current policy

- Native clipboard paste stays first-class
- Plugin/import fallback stays secondary
- `gntb_deck` remains only a stress-test fixture, not a product-specific path
- Reverse-engineering tools stay in the repo, but should be isolated from product-path code

## Why clean up now

Current code is good enough for experimentation, but too coupled for fast iteration.
The main problems are:

- capture logic is too concentrated
- IR/schema is not yet a strict contract
- native-paste transport logic is mixed into extension UI logic
- reverse-engineering tools and product-flow code are not clearly separated

That makes it harder to:

- test one hypothesis at a time
- compare serializer experiments cleanly
- keep product UX simple while research stays flexible

## Cleanup order

### Step 1. Separate research from product-path code

Create a clearer conceptual split:

- product path
  - capture
  - IR creation
  - extension UX
  - native paste payload writing
- research path
  - clipboard analyzers
  - sample decoding tools
  - serializer notes and fixtures

Initial rule:
- `tools/` and sample-analysis helpers are research-facing
- extension popup should only consume stable helper functions, not contain deep serializer experimentation inline forever

### Step 2. Make IR/schema a real contract

Short-term target:
- define a versioned IR contract
- centralize validation/helpers in one place
- make both capture and downstream mapping read the same structure

Minimum required fields:
- version
- meta
- root
- nodes

This does not need a full package split yet.
A lightweight local contract layer is enough to start.

### Step 3. Split native paste transport helpers from popup UI

The popup should become orchestration only.
Move payload-building logic behind dedicated helpers, for example:

- metadata helpers
- buffer probe builders
- clipboard HTML wrapper builders
- acceptance log helpers

Goal:
- popup.js should describe flow
- helper modules should describe serializer experiments

### Step 4. Start separating capture concerns

Without changing behavior yet, begin splitting capture into clearer boundaries:

- DOM walk
- visibility
- style resolution
- text extraction
- IR assembly

This is not a rewrite.
It is a behavior-preserving extraction pass so future fixes become safer.

### Step 5. Prepare a shared downstream mapping layer

Even with native paste as the priority, we still need a common conceptual layer:

- captured IR
- postprocessed IR
- Figma-oriented node model
- transport-specific output

That means native clipboard experiments should eventually consume a more stable Figma-facing structure, not raw popup-local ad hoc transforms.

## Immediate first implementation

Start with the lowest-risk structural improvement:

1. create a small `native/` helper area under `extension/` or nearby
2. move probe-building and wrapper-building logic out of popup.js
3. leave UI behavior unchanged
4. keep current native-paste experiments working during the move

## Success criteria for cleanup

Cleanup is successful if:

- native paste remains the main product direction
- popup UX gets simpler, not more complex
- serializer experiments become easier to swap and compare
- capture and transport layers stop bleeding into each other
- research tools stay available without polluting product-path logic

## What not to do

- do not pivot the product to plugin-first
- do not remove native-paste research tools
- do not do a full monorepo rewrite first
- do not rewrite capture behavior and transport behavior in the same step

## Practical next move

First concrete refactor:
- extract popup native-paste builder code into dedicated helper modules
- keep current behavior intact
- then iterate on wrapper/buffer experiments from that cleaner boundary
