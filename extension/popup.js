const statusEl = document.getElementById('status');

function bootLog(step, detail = '') {
  const message = detail ? `[boot] ${step}: ${detail}` : `[boot] ${step}`;
  console.log(message);
  if (statusEl) statusEl.textContent = message;
}

bootLog('script start');

const nativeClipboardModule = await import('./native-clipboard.js');
bootLog('native-clipboard imported');
const irValidatorModule = await import('./ir-validator.js');
bootLog('ir-validator imported');
const probeAcceptanceModule = await import('./probe-acceptance.js');
bootLog('probe-acceptance imported');

const {
  buildProbeVariants,
  serializeFigmaStyleHtmlProbe,
  serializeFigmaStyleRichProbe,
  serializeSingleProbeVariantHtml,
  serializeFigmaNativeScene,
  testKiwiRoundTrip,
} = nativeClipboardModule;
const { assertMinimalIR } = irValidatorModule;
const {
  exportAcceptanceMatrix,
  getVariantRecord,
  loadAcceptanceLog,
  renderVariantMatrix,
  saveAcceptanceLog,
  setVariantNotes,
  setVariantVerdict,
} = probeAcceptanceModule;

const variantMatrixEl = document.getElementById('variantMatrix');
const variantRowsEl = document.getElementById('variantRows');
const nativeSceneBtn = document.getElementById('nativeSceneBtn');
const bestProbeBtn = document.getElementById('bestProbeBtn');
const schemaRectBtn = document.getElementById('schemaRectBtn');
const kiwiTestBtn = document.getElementById('kiwiTestBtn');
const exportMatrixBtn = document.getElementById('exportMatrixBtn');
const variantNotesEl = document.getElementById('variantNotes');

function debugLog(step, detail = '') {
  const message = detail ? `[popup] ${step}: ${detail}` : `[popup] ${step}`;
  console.log(message);
  if (statusEl) statusEl.textContent = message;
}

window.addEventListener('error', (event) => {
  const message = event?.error?.message || event?.message || 'unknown popup error';
  console.error('[html2fig popup] window error', event?.error || event);
  if (statusEl) statusEl.textContent = `[popup] error: ${message}`;
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event?.reason?.message || String(event?.reason || 'unknown rejection');
  console.error('[html2fig popup] unhandled rejection', event?.reason);
  if (statusEl) statusEl.textContent = `[popup] unhandled rejection: ${reason}`;
});

bootLog('event handlers attached');

let lastCapturedData = null;
let lastProbeVariants = [];
let acceptanceLog = loadAcceptanceLog();
const DEFAULT_PROBE_LABEL = 'scene-template-figma-slide';
const PRIMARY_PROBE_LABELS = [
  'scene-template-figma-slide',
  'scene-template-html2design',
  'scene-template-primitive-mixed',
  'splice-mixed-tail',
  'splice-rect-tail',
  'splice-text-tail',
];
const PROBE_ROTATION_STORAGE_KEY = 'html2fig-preferred-probe-index-v1';

function escapeHtml(text) {
  return String(text).replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}

async function copySchemaRectangleSpike() {
  const response = await fetch(chrome.runtime.getURL('../tmp_schema_spike/rectangle-payload.html'));
  if (!response.ok) throw new Error(`Failed to load schema spike payload: ${response.status}`);
  const html = await response.text();
  const item = new ClipboardItem({
    'text/plain': new Blob(['schema rectangle spike'], { type: 'text/plain' }),
    'text/html': new Blob([html], { type: 'text/html' }),
  });
  await navigator.clipboard.write([item]);
}

function serializeHtmlPayload(data) {
  const json = JSON.stringify(data);
  return `<div data-html2fig="1" data-format="${data?.meta?.format || 'html2fig-local'}"><pre>${escapeHtml(json)}</pre></div>`;
}


function serializeSvgPayload(data) {
  const title = escapeHtml(data?.meta?.title || 'html2fig capture');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="120"><rect width="100%" height="100%" fill="#ffffff"/><text x="24" y="48" font-size="28" font-family="Arial, sans-serif" fill="#102a43">${title}</text><text x="24" y="86" font-size="16" font-family="Arial, sans-serif" fill="#486581">html2fig experimental SVG clipboard payload</text></svg>`;
}


async function copySingleVariant(label) {
  debugLog('copySingleVariant:start', label);
  if (!lastCapturedData) throw new Error('No captured data available');
  assertMinimalIR(lastCapturedData);
  await writePayloadToClipboard(lastCapturedData, 'figma-html-rich', { singleVariant: label });
  if (variantNotesEl) variantNotesEl.value = getVariantRecord(acceptanceLog, label).notes || '';
  debugLog('copySingleVariant:done', label);
}

function getPrimaryProbeVariants() {
  const preferred = PRIMARY_PROBE_LABELS
    .map((label) => lastProbeVariants.find((variant) => variant.label === label))
    .filter(Boolean);
  return preferred.length ? preferred : lastProbeVariants.slice(0, 6);
}

function loadPreferredProbeIndex() {
  try {
    return Math.max(0, Number(localStorage.getItem(PROBE_ROTATION_STORAGE_KEY) || 0) || 0);
  } catch {
    return 0;
  }
}

function savePreferredProbeIndex(index) {
  try {
    localStorage.setItem(PROBE_ROTATION_STORAGE_KEY, String(Math.max(0, index || 0)));
  } catch {}
}

function getPreferredProbeLabel() {
  const primary = getPrimaryProbeVariants();
  if (!primary.length) return null;
  const defaultIndex = primary.findIndex((variant) => variant.label === DEFAULT_PROBE_LABEL);
  const storedIndex = loadPreferredProbeIndex();
  if (storedIndex > 0 && primary[storedIndex]) return primary[storedIndex].label;
  if (defaultIndex >= 0) return primary[defaultIndex].label;
  return primary[0]?.label || null;
}

function rotatePreferredProbe() {
  const primary = getPrimaryProbeVariants();
  if (!primary.length) return null;
  const currentLabel = getPreferredProbeLabel();
  const currentIndex = Math.max(0, primary.findIndex((variant) => variant.label === currentLabel));
  const nextIndex = (currentIndex + 1) % primary.length;
  savePreferredProbeIndex(nextIndex);
  return primary[nextIndex]?.label || null;
}

async function copyPreferredProbe() {
  const label = getPreferredProbeLabel();
  if (!label) throw new Error('No probe variants available yet');
  acceptanceLog = setVariantVerdict(acceptanceLog, label, 'copied');
  saveAcceptanceLog(acceptanceLog);
  await copySingleVariant(label);
  statusEl.textContent = `Copied Figma test payload (${label}). Paste into Figma and record what happened.`;
}


async function writePayloadToClipboard(data, mode, options = {}) {
  debugLog('writePayloadToClipboard:start', mode);
  const json = JSON.stringify(data, null, 2);

  if (mode === 'json') {
    await navigator.clipboard.writeText(json);
    return;
  }

  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard.write) {
    throw new Error('Rich clipboard API unavailable in popup context');
  }

  const html = mode === 'svg'
    ? serializeSvgPayload(data)
    : mode === 'figma-html'
      ? serializeFigmaStyleHtmlProbe(data, escapeHtml)
      : mode === 'figma-html-rich'
        ? (() => {
            const variants = buildProbeVariants(data);
            lastProbeVariants = variants;
            if (options.singleVariant) {
              const found = variants.find((variant) => variant.label === options.singleVariant);
              if (!found) throw new Error(`Unknown probe variant: ${options.singleVariant}`);
              return serializeSingleProbeVariantHtml(data, found, escapeHtml);
            }
            return serializeFigmaStyleRichProbe(data, escapeHtml);
          })()
        : serializeHtmlPayload(data);

  const clipboardMap = {
    'text/plain': new Blob([json], { type: 'text/plain' }),
    'text/html': new Blob([html], { type: 'text/html' }),
  };

  if (mode === 'figma-html-rich') {
    const svg = serializeSvgPayload(data);
    clipboardMap['image/svg+xml'] = new Blob([svg], { type: 'image/svg+xml' });
  }

  const item = new ClipboardItem(clipboardMap);
  await navigator.clipboard.write([item]);
  debugLog('writePayloadToClipboard:done', mode);
}

async function getCurrentTab() {
  debugLog('getCurrentTab:start');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  debugLog('getCurrentTab:done', String(tab?.id || 'no-tab'));
  if (!tab?.id) throw new Error('No active tab found');
  return tab;
}

async function injectCaptureScript(tabId) {
  debugLog('injectCaptureScript:start', String(tabId));
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['capture/capture-style.js', 'capture/capture-visibility.js', 'capture/capture-node-builders.js', 'capture/capture-flow.js', 'inject-capture.js'],
  });
  debugLog('injectCaptureScript:done', String(tabId));
}

async function captureData(tabId, selector) {
  debugLog('captureData:start', selector || 'body');
  const executionResults = await chrome.scripting.executeScript({
    target: { tabId },
    func: (captureSelector) => {
      try {
        if (!window.html2figLocal) {
          throw new Error('html2figLocal is not available on this page');
        }
        const options = captureSelector ? { selector: captureSelector } : {};
        const data = window.html2figLocal.captureCurrentPage(options);
        return { ok: true, data };
      } catch (error) {
        return { ok: false, error: error.message || String(error) };
      }
    },
    args: [selector || null],
  });

  const result = executionResults?.[0]?.result;
  if (!result) throw new Error('No result returned from capture execution');
  if (!result.ok) throw new Error(result.error || 'Capture execution failed');
  debugLog('captureData:done', `${result.data?.nodes?.length || 0} nodes`);
  return result.data;
}

async function runCapture() {
  try {
    debugLog('runCapture:start');
    const tab = await getCurrentTab();
    await injectCaptureScript(tab.id);
    const data = await captureData(tab.id, null);
    assertMinimalIR(data);
    lastCapturedData = data;
    lastProbeVariants = buildProbeVariants(data);
    renderVariantMatrix({ lastCapturedData, lastProbeVariants: getPrimaryProbeVariants(), acceptanceLog, variantMatrixEl, variantRowsEl });
    if (nativeSceneBtn) nativeSceneBtn.style.display = 'block';
    if (bestProbeBtn) bestProbeBtn.style.display = 'block';
    if (variantNotesEl) {
      const preferredLabel = getPreferredProbeLabel();
      variantNotesEl.value = preferredLabel ? getVariantRecord(acceptanceLog, preferredLabel).notes || '' : '';
    }
    debugLog('runCapture:done', data?.meta?.title || 'Untitled Page');
    const preferredLabel = getPreferredProbeLabel();
    statusEl.textContent = `Prepared Figma test payload for:\n${data?.meta?.title || 'Untitled Page'}\nCurrent probe: ${preferredLabel || 'n/a'}\nNow click Copy Figma Test Payload, then paste into Figma.`;
  } catch (error) {
    console.error('[html2fig popup] prepare failed', error);
    statusEl.textContent = `Prepare failed: ${error.message}`;
  }
}

debugLog('popup script loaded');

document.getElementById('captureBtn').addEventListener('click', () => {
  debugLog('captureBtn:click');
  runCapture();
});
bestProbeBtn.addEventListener('click', async () => {
  try {
    debugLog('bestProbeBtn:click');
    if (!lastCapturedData) {
      statusEl.textContent = 'Capture a page first, then copy the Figma test payload.';
      return;
    }
    await copyPreferredProbe();
    renderVariantMatrix({ lastCapturedData, lastProbeVariants: getPrimaryProbeVariants(), acceptanceLog, variantMatrixEl, variantRowsEl });
  } catch (error) {
    statusEl.textContent = `Copy failed: ${error.message}`;
  }
});
schemaRectBtn?.addEventListener('click', async () => {
  try {
    await copySchemaRectangleSpike();
    statusEl.textContent = 'Copied schema rectangle spike. Paste into Figma and note whether anything appears.';
  } catch (error) {
    statusEl.textContent = `Schema spike copy failed: ${error.message}`;
  }
});

nativeSceneBtn?.addEventListener('click', async () => {
  try {
    if (!lastCapturedData) {
      statusEl.textContent = 'Capture a page first.';
      return;
    }
    statusEl.textContent = 'Encoding with kiwi pipeline…';
    const html = await serializeFigmaNativeScene(lastCapturedData, escapeHtml);
    const item = new ClipboardItem({
      'text/plain': new Blob([lastCapturedData?.meta?.title || 'html2fig scene'], { type: 'text/plain' }),
      'text/html': new Blob([html], { type: 'text/html' }),
    });
    await navigator.clipboard.write([item]);
    const nodeCount = lastCapturedData?.nodes?.length || 0;
    statusEl.textContent = `⭐ Native scene copied (${nodeCount} nodes). Paste into Figma!`;
  } catch (error) {
    console.error('[html2fig] native scene copy failed', error);
    statusEl.textContent = `Native scene failed: ${error.message}`;
  }
});

kiwiTestBtn?.addEventListener('click', async () => {
  try {
    if (!lastCapturedData) {
      statusEl.textContent = 'Capture a page first, then run the round-trip test.';
      return;
    }
    statusEl.textContent = 'Running kiwi round-trip test…';
    const result = await testKiwiRoundTrip(lastCapturedData);
    const nodeCount = result.decoded?.nodeChanges?.length || 0;
    const types = result.decoded?.nodeChanges?.map((n) => n.type).join(', ') || '(none)';
    console.log('[html2fig] kiwi round-trip result:', result);
    statusEl.textContent = `Kiwi round-trip OK — ${nodeCount} nodeChanges: ${types}`;
  } catch (error) {
    console.error('[html2fig] kiwi test failed', error);
    statusEl.textContent = `Kiwi test failed: ${error.message}`;
  }
});

exportMatrixBtn.addEventListener('click', async () => {
  try {
    const exported = exportAcceptanceMatrix({ lastCapturedData, lastProbeVariants, acceptanceLog });
    await navigator.clipboard.writeText(exported);
    statusEl.textContent = 'Acceptance matrix JSON copied to clipboard.';
  } catch (error) {
    statusEl.textContent = `Export failed: ${error.message}`;
  }
});

variantNotesEl?.addEventListener('change', () => {
  const label = getPreferredProbeLabel();
  if (!label) return;
  const note = variantNotesEl.value.trim();
  acceptanceLog = setVariantNotes(acceptanceLog, label, note);
  acceptanceLog = setVariantVerdict(acceptanceLog, label, 'tested', { notes: note, attempts: Math.max(0, getVariantRecord(acceptanceLog, label).attempts - 1) });
  saveAcceptanceLog(acceptanceLog);
  if (/nothing happened|no reaction|무반응|아무 반응/i.test(note)) {
    rotatePreferredProbe();
  }
  renderVariantMatrix({ lastCapturedData, lastProbeVariants: getPrimaryProbeVariants(), acceptanceLog, variantMatrixEl, variantRowsEl });
});
