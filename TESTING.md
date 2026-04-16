# html2fig Testing Guide

## Quick local test flow

### 1. Serve fixture pages
From the repo root:

```bash
npm run serve:fixtures
```

This serves fixture pages at:
- http://localhost:4173/basic-card.html
- http://localhost:4173/wrapped-text.html
- http://localhost:4173/background-image.html

### 2. Test browser capture
Open a fixture page in Chrome, open DevTools, paste `capture/html2fig-capture.js`, then run:

```js
html2figLocal.captureCurrentPage()
html2figLocal.captureCurrentPage({ selector: '#app' })
html2figLocal.downloadCapture('fixture.json')
```

### 3. Test Figma import
In Figma:
1. Load the plugin from `figma-plugin/manifest.json`
2. After using the browser extension or clipboard capture, open the plugin
3. Click `Paste + Import`

## Recommended manual validation order

1. `basic-card.html`
   - frame hierarchy
   - text editability
   - button/card grouping
2. `wrapped-text.html`
   - wrapped text handling
   - text box positioning
3. `background-image.html`
   - background image fill handling
   - overlay hierarchy

## Expected current readiness

Current repo should now support meaningful manual end-to-end testing for:
- browser capture
- selector capture
- JSON export
- initial Figma frame/text/image reconstruction
- basic background-image import attempts
- reduced wrapper noise in layer hierarchy

## Native clipboard testing loop

### Extension probe retest
1. Load the unpacked extension from `extension/manifest.json`
2. Open a target page
3. Choose one of:
   - `Figma wrapper HTML probe`
   - `Figma wrapper rich multi-mime probe`
4. Click `Copy Current Page`
5. Switch to Figma and press `Ctrl+V`

Current expectation:
- wrapper realism has improved
- metadata realism has improved
- fallback HTML is richer
- editable native paste may still fail because scene-buffer serialization is not yet reproduced

### Clipboard sample inspection
Use:
- `tools/clipboard-inspector.html`

Recommended capture order:
1. rectangle 1개
2. text 1개
3. rectangle + text
4. complex frame / slide

### Buffer analysis
Use:
- `tools/figma-buffer-analyzer.html`

Paste either:
- exported clipboard report JSON
- raw `data-metadata` wrapper
- raw `data-buffer` wrapper

Current goal:
- compare real scene buffers across simple object types
- identify stable header/prefix structure
- determine whether compression or a custom binary serializer is involved
