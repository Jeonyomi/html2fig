# html2fig IR Contract

## Status

This document defines the current minimum IR contract for `html2fig`.
It is intended to stabilize the boundary between:

- capture
- native clipboard experiment code
- future mapper / postprocessor layers

This contract is intentionally minimal.
It should describe the data shape the code actually depends on today, while creating a clean path for versioned evolution.

## Non-goal

This does not change the product goal.
The primary goal remains:

1. capture HTML from the web
2. generate a Figma-native clipboard payload
3. paste into Figma
4. get editable structure

The IR contract exists to make native-paste work safer to iterate on.

## Contract level

Current level: `IR v0`

Meaning:
- stable enough to document and code against
- not yet migration-backed
- can still evolve in small steps while native-paste research continues

Planned next level: `IR v1`
- explicit version field required
- documented migration rules for breaking changes
- validator-backed loading path

## Current minimum top-level shape

```json
{
  "meta": { ... },
  "root": { ... },
  "nodes": [ ... ]
}
```

## Current minimum required fields

### Top-level object

| Field | Required | Type | Notes |
|---|---|---|---|
| `meta` | yes | object | Capture metadata and document context |
| `root` | yes | object | Root frame-like scene description |
| `nodes` | yes | array | Flat array of captured nodes |

## `meta`

Minimum required fields:

| Field | Required | Type | Notes |
|---|---|---|---|
| `title` | yes | string | Source page title |
| `url` | yes | string | Source page URL |
| `capturedAt` | yes | string | ISO timestamp |
| `viewport` | yes | object | Capture viewport bounds |
| `page` | yes | object | Page dimensions |
| `selection` | yes | string | Selector used for scoped capture, or `body` |
| `format` | yes | string | Current producer format tag |

### `meta.viewport`

| Field | Required | Type |
|---|---|---|
| `width` | yes | number |
| `height` | yes | number |

### `meta.page`

| Field | Required | Type |
|---|---|---|
| `width` | yes | number |
| `height` | yes | number |

## `root`

The root object represents the capture root as a frame-like scene root.

Minimum required fields:

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | string | Currently `root` |
| `type` | yes | string | Currently `frame` |
| `name` | yes | string | Human-readable root name |
| `rect` | yes | object | Absolute capture rectangle |

### `rect`

| Field | Required | Type |
|---|---|---|
| `x` | yes | number |
| `y` | yes | number |
| `width` | yes | number |
| `height` | yes | number |

## `nodes`

`nodes` is currently a flat array of scene nodes.
Hierarchy is represented through `parentId`.

Every node must include:

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | string | Stable only within one capture today |
| `parentId` | yes | string | Parent node id or `root` |
| `type` | yes | string | `frame`, `image`, or `text` today |
| `name` | yes | string | Debug/display name |
| `rect` | yes | object | Absolute rectangle |
| `style` | yes | object | Node style subset |

### Element-like nodes

Current additional fields used for non-text nodes:

| Field | Required | Type | Notes |
|---|---|---|---|
| `tag` | yes | string | Lowercased DOM tag |
| `children` | yes | array | Currently present but not authoritative hierarchy |

### Image nodes

If `type === "image"`, these fields may appear:

| Field | Required | Type |
|---|---|---|
| `src` | no | string or null |
| `alt` | no | string |

### Background image marker

For non-image elements with CSS background images, this field may appear:

| Field | Required | Type |
|---|---|---|
| `backgroundImageNode` | no | object |

Current shape:

```json
{
  "type": "image-ref",
  "src": "https://..."
}
```

### Text nodes

If `type === "text"`, these fields are currently required:

| Field | Required | Type |
|---|---|---|
| `text` | yes | string |
| `rects` | yes | array |

`rects` contains one or more text fragment rectangles.

## Current style subset

The current code depends on only a limited style subset.
That subset is the contract for now.

### Common style fields

| Field | Required | Type |
|---|---|---|
| `backgroundColor` | yes | color or null |
| `backgroundImage` | yes | string or null |
| `color` | yes | color or null |
| `borderRadius` | yes | object |
| `border` | yes | object |
| `opacity` | yes | number |
| `boxShadow` | yes | string |
| `textAlign` | yes | string |
| `overflow` | yes | string |
| `objectFit` | yes | string or null |
| `zIndex` | yes | string |

### Text style fields

For text nodes, the current `style` object additionally uses:

| Field | Required | Type |
|---|---|---|
| `fontFamily` | yes | string |
| `fontSize` | yes | number |
| `fontWeight` | yes | string |
| `lineHeight` | yes | string |
| `letterSpacing` | yes | string |

### Color object

Current color shape:

```json
{
  "r": 0,
  "g": 0,
  "b": 0,
  "a": 1,
  "css": "rgba(...)"
}
```

All channels are normalized to 0..1 except `css`, which preserves the original CSS string.

## Current consumer expectations

### Capture output

Current capture code produces:
- `meta`
- `root`
- `nodes`

### Popup UI

Current popup UI depends mainly on:
- `meta.title`
- `meta.url`

### Native clipboard experiments

Current native clipboard experiment code depends on:
- `meta`
- `root`
- `nodes`
- node `type`
- text node `text`
- optional node `rect`
- optional text/image counts derived from `nodes`

That means any contract change that removes or renames those fields must be treated as breaking for the current native-paste path.

## Versioning direction

## Current recommendation

Introduce a top-level `version` field as the next safe contract step.

Planned shape:

```json
{
  "version": "1",
  "meta": { ... },
  "root": { ... },
  "nodes": [ ... ]
}
```

### Why top-level version first

This gives us:
- an explicit migration hook
- safer fixture evolution
- a stable contract for native clipboard code
- room to change node/style layout later without silent breakage

## Proposed rules for `IR v1`

1. `version` becomes required at top level
2. producer must emit string version values
3. consumers must reject missing/unknown versions unless a compatibility shim exists
4. breaking field renames require a version bump
5. additive fields do not require a version bump if existing required fields remain valid

## Breaking vs non-breaking examples

### Breaking
- renaming `meta.format`
- replacing flat `nodes` with nested `children` only
- renaming `parentId`
- moving text content from `text` to `content.text`

### Non-breaking
- adding `meta.sourceApp`
- adding `node.constraints`
- adding `root.layout`
- adding richer text-run information while keeping `text`

## Native clipboard contract rule

The native clipboard path should consume IR through this rule:

- it may derive experimental payloads from IR
- it must not silently depend on undocumented ad hoc fields outside this contract

If a new field becomes necessary for serializer experiments, update this document first or in the same change.

## Lightweight runtime validation

A lightweight runtime validator is now appropriate at this stage.

Recommended scope:
- validate the minimum documented top-level shape
- validate minimum `meta`, `root`, and `nodes` fields
- validate current text-node and common-style subsets
- avoid full schema tooling until the contract settles further

Suggested API:
- `validateMinimalIR(data)` -> `{ ok, errors }`
- `assertMinimalIR(data)` -> throws on invalid IR

Use it at low-risk boundaries first:
- immediately after capture output is produced
- before native clipboard probe generation

## Recommended next code step

Lowest-risk next step:

1. add top-level `version: "1"` emission in capture
2. add a lightweight runtime validator for the documented minimum contract
3. update native clipboard helpers to preserve/read the version without requiring deeper behavior changes
4. treat current documented shape as `IR v1`

## Future contract growth

Likely future additions:
- stable node ids
- richer text runs
- explicit fills/strokes/effects model
- layout hints
- postprocessed grouping metadata
- image asset refs separate from raw node style

Those should be layered on top of this minimum contract, not introduced by hidden drift.
