import {
  buildProbeVariants,
  serializeFigmaStyleHtmlProbe,
  serializeFigmaStyleRichProbe,
  serializeSingleProbeVariantHtml,
} from './native-clipboard.js';
import { assertMinimalIR } from '../capture/ir-validator.js';
import {
  exportAcceptanceMatrix,
  getVariantRecord,
  loadAcceptanceLog,
  renderVariantMatrix,
  saveAcceptanceLog,
  setVariantNotes,
  setVariantVerdict,
} from './probe-acceptance.js';

const statusEl = document.getElementById('status');
const variantMatrixEl = document.getElementById('variantMatrix');
const variantRowsEl = document.getElementById('variantRows');
const bestProbeBtn = document.getElementById('bestProbeBtn');
const exportMatrixBtn = document.getElementById('exportMatrixBtn');
const variantNotesEl = document.getElementById('variantNotes');

let lastCapturedData = null;
let lastProbeVariants = [];
let acceptanceLog = loadAcceptanceLog();
const DEFAULT_PROBE_LABEL = 'splice-mixed-tail';

function escapeHtml(text) {
  return String(text).replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
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
  if (!lastCapturedData) throw new Error('No captured data available');
  assertMinimalIR(lastCapturedData);
  await writePayloadToClipboard(lastCapturedData, 'figma-html-rich', { singleVariant: label });
  if (variantNotesEl) variantNotesEl.value = getVariantRecord(acceptanceLog, label).notes || '';
}

function getPreferredProbeLabel() {
  if (lastProbeVariants.some((variant) => variant.label === DEFAULT_PROBE_LABEL)) return DEFAULT_PROBE_LABEL;
  return lastProbeVariants[0]?.label || null;
}

async function copyPreferredProbe() {
  const label = getPreferredProbeLabel();
  if (!label) throw new Error('No probe variants available yet');
  await copySingleVariant(label);
  statusEl.textContent = `Copied Figma test payload (${label}). Paste into Figma and record what happened.`;
}


async function writePayloadToClipboard(data, mode, options = {}) {
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
}

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab found');
  return tab;
}

async function injectCaptureScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['../capture/capture-style.js', '../capture/capture-visibility.js', '../capture/capture-node-builders.js', '../capture/capture-flow.js', 'inject-capture.js'],
  });
}

async function captureData(tabId, selector) {
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
  return result.data;
}

async function runCapture() {
  try {
    statusEl.textContent = 'Preparing Figma test payload…';
    const tab = await getCurrentTab();
    statusEl.textContent = 'Injecting capture helpers…';
    await injectCaptureScript(tab.id);
    statusEl.textContent = 'Capturing current page…';
    const data = await captureData(tab.id, null);
    assertMinimalIR(data);
    lastCapturedData = data;
    lastProbeVariants = buildProbeVariants(data);
    renderVariantMatrix({ lastCapturedData, lastProbeVariants, acceptanceLog, variantMatrixEl, variantRowsEl });
    if (bestProbeBtn) bestProbeBtn.style.display = 'block';
    if (variantNotesEl) {
      const preferredLabel = getPreferredProbeLabel();
      variantNotesEl.value = preferredLabel ? getVariantRecord(acceptanceLog, preferredLabel).notes || '' : '';
    }
    statusEl.textContent = `Prepared Figma test payload for:\n${data?.meta?.title || 'Untitled Page'}\nNow click Copy Figma Test Payload, then paste into Figma.`;
  } catch (error) {
    console.error('[html2fig popup] prepare failed', error);
    statusEl.textContent = `Prepare failed: ${error.message}`;
  }
}

document.getElementById('captureBtn').addEventListener('click', () => runCapture());
bestProbeBtn.addEventListener('click', async () => {
  try {
    if (!lastCapturedData) {
      statusEl.textContent = 'Capture a page first, then copy the Figma test payload.';
      return;
    }
    await copyPreferredProbe();
    renderVariantMatrix({ lastCapturedData, lastProbeVariants, acceptanceLog, variantMatrixEl, variantRowsEl });
  } catch (error) {
    statusEl.textContent = `Copy failed: ${error.message}`;
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
  acceptanceLog = setVariantNotes(acceptanceLog, label, variantNotesEl.value);
  acceptanceLog = setVariantVerdict(acceptanceLog, label, 'tested', { notes: variantNotesEl.value.trim(), attempts: Math.max(0, getVariantRecord(acceptanceLog, label).attempts - 1) });
  saveAcceptanceLog(acceptanceLog);
  renderVariantMatrix({ lastCapturedData, lastProbeVariants, acceptanceLog, variantMatrixEl, variantRowsEl });
});
