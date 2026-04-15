# Expected Output Notes

These fixtures are intended as **manual validation baselines** for the browser capture MVP.

## 1. `basic-card.html`
Expected:
- one main frame for `#app`
- one frame for `.card`
- text nodes for:
  - `Fixture`
  - `Simple Card Layout`
  - `This page is used to validate a basic frame + text capture flow.`
  - `Primary Action`
- link should still appear as a frame/text combination
- rounded corners and card shadow should be present in style output

## 2. `wrapped-text.html`
Expected:
- root limited to `#capture-root` if selector capture is used
- body copy text node should include both:
  - `rect`
  - `rects` array with multiple entries
- title and body should appear as separate text nodes

Suggested command:
```js
html2figLocal.captureCurrentPage({ selector: '#capture-root' })
```

## 3. `background-image.html`
Expected:
- outer frame for `#fixture-bg`
- `style.backgroundImage` populated with a URL
- overlay frame captured separately
- text node for `Background Image Fixture`

Suggested command:
```js
html2figLocal.captureCurrentPage({ selector: '#fixture-bg' })
```

## Validation heuristic

This repo does not yet have an automated browser test harness.
For now, a fixture is considered "passing" if:
- the expected visible nodes appear in output
- selector capture limits scope correctly
- wrapped text emits `rects`
- background image URLs are extracted when present
