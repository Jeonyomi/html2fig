const statusEl = document.getElementById('status');
const modeEl = document.getElementById('mode');
const variantMatrixEl = document.getElementById('variantMatrix');
const variantRowsEl = document.getElementById('variantRows');
const nextVariantBtn = document.getElementById('nextVariantBtn');
const exportMatrixBtn = document.getElementById('exportMatrixBtn');

const ACCEPTANCE_STORAGE_KEY = 'html2fig-native-paste-matrix-v1';

let lastCapturedData = null;
let lastProbeVariants = [];
let acceptanceLog = loadAcceptanceLog();
let nextVariantIndex = 0;

function escapeHtml(text) {
  return String(text).replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}

function toBase64Utf8(value) {
  return btoa(unescape(encodeURIComponent(typeof value === 'string' ? value : JSON.stringify(value))));
}

function wrapFigmaComment(tag, encodedValue) {
  return `<!--(${tag})${encodedValue}(/${tag})-->`;
}

function serializeHtmlPayload(data) {
  const json = JSON.stringify(data);
  return `<div data-html2fig="1" data-format="${data?.meta?.format || 'html2fig-local'}"><pre>${escapeHtml(json)}</pre></div>`;
}

function randomAlphaNum(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < length; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function randomPasteId() {
  return Math.floor(Date.now() % 2147483647);
}

function createProbeMetadata(data, extra = {}) {
  return {
    fileKey: randomAlphaNum(22),
    pasteID: randomPasteId(),
    dataType: 'scene',
    source: 'html2fig-local',
    format: data?.meta?.format || 'html2fig-local@0.2',
    title: data?.meta?.title || 'Untitled',
    url: data?.meta?.url || '',
    capturedAt: data?.meta?.capturedAt || new Date().toISOString(),
    nodeCount: Array.isArray(data?.nodes) ? data.nodes.length : 0,
    textNodeCount: Array.isArray(data?.nodes) ? data.nodes.filter((node) => node?.type === 'text').length : 0,
    imageNodeCount: Array.isArray(data?.nodes) ? data.nodes.filter((node) => node?.type === 'image').length : 0,
    ...extra,
  };
}

function buildFallbackTextRuns(data) {
  const textNodes = (data?.nodes || []).filter((node) => node?.type === 'text' && node?.text);
  if (textNodes.length === 0) {
    return '<span style="white-space:pre-wrap;">Paste from html2fig</span>';
  }

  return textNodes.slice(0, 40).map((node) => {
    const fontWeight = Number(node?.style?.fontWeight) || 400;
    const fontSize = Number(node?.style?.fontSize) || 12;
    const safeText = escapeHtml(node.text);
    return `<span style="font-weight: ${fontWeight >= 600 ? 'bold' : 'normal'}; font-size: ${Math.max(11, Math.min(fontSize, 76))}px; white-space: pre-wrap;">${safeText}</span>`;
  }).join('<br>');
}

function serializeFigmaStyleHtmlProbe(data) {
  const json = JSON.stringify(data);
  const encodedMeta = toBase64Utf8(createProbeMetadata(data));
  const encodedBuffer = toBase64Utf8(json);
  const metadataWrapper = escapeHtml(wrapFigmaComment('figmeta', encodedMeta));
  const bufferWrapper = escapeHtml(wrapFigmaComment('figma', encodedBuffer));
  const fallback = buildFallbackTextRuns(data);
  return `<html><body><!--StartFragment--><meta charset="utf-8"><span data-metadata="${metadataWrapper}"></span><span data-buffer="${bufferWrapper}"></span>${fallback}<!--EndFragment--></body></html>`;
}

const REAL_BUFFER_SPLICE_TEMPLATES = {
  rectangle: {
    prefixHex: '6669672d6b6977696a00000073730000',
    spliceStart: 29571,
    tailHex: 'f300000028b52ffd6048004d0700428e3132406f331ca4501d1eabe3a0a240d22fe471c4c3165da06ecddf36ac302640fa07981ca1ec5472fa03c34129fc4ad4ee6e5ba6df9e8c59948d640661896cd2c2da3209a27192223e0c002acb00587397631ab3fb0f1666614943436615bba89fe2d05845a2bb8019',
    trailerHex: '0c002acb00587397631ab3fb0f1666614943436615bba89fe2d05845a2bb8019',
  },
  text: {
    prefixHex: '6669672d6b6977696a00000073730000',
    spliceStart: 29571,
    tailHex: 'be11000028b52ffd600b1da58d000a0f1937552010d2693a55feb7d8bd1d9e13b757a3e18a01506bff3a7cd44489f49776bd828f9763a23e1ff87a04e79b6df1ca741fa72ff4e19d8b52aa5c4b43dac03e931c62b661a80b08fd4fba3cf06ab0f3e1ee075df3501b7660244b8b7cd174c47e9cd546dd46d10a',
    trailerHex: 'fd4fba3cf06ab0f3e1ee075df3501b7660244b8b7cd174c47e9cd546dd46d10a',
  },
  mixed: {
    prefixHex: '6669672d6b6977696a00000073730000',
    spliceStart: 29571,
    tailHex: 'f500000028b52ffd6048005d0700420e3234506f321c10330bb403b5c4d4bcaaaa66056fa0cbdac079b0cf69a4190503081a1d4ec4244cadc34fb4f50f9e9e8f68b5bdc99629dfa69c59948d642661916c12c3da3229a271d20c002acb00587397631ab3fb0f1666614943436615bba89fe2d05845a2bb8019',
    trailerHex: '0c002acb00587397631ab3fb0f1666614943436615bba89fe2d05845a2bb8019',
  },
};

function hexToBytes(hex) {
  const clean = (hex || '').replace(/\s+/g, '');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) out[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  return out;
}

function base64FromBytes(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function buildSyntheticSceneBuffer(data, options = {}) {
  const encoder = new TextEncoder();
  const json = JSON.stringify({
    meta: data?.meta || {},
    root: data?.root || null,
    nodes: Array.isArray(data?.nodes) ? data.nodes.slice(0, 128) : [],
  });
  const jsonBytes = encoder.encode(json);
  const prefix = encoder.encode('fig-kiwij\u0000\u0000\u0000ss\u0000\u0000');
  const nodeCount = Array.isArray(data?.nodes) ? data.nodes.length : 0;
  const textCount = Array.isArray(data?.nodes) ? data.nodes.filter((node) => node?.type === 'text').length : 0;
  const imageCount = Array.isArray(data?.nodes) ? data.nodes.filter((node) => node?.type === 'image').length : 0;
  const header = new Uint8Array([
    nodeCount & 0xff, (nodeCount >> 8) & 0xff,
    textCount & 0xff, (textCount >> 8) & 0xff,
    imageCount & 0xff, (imageCount >> 8) & 0xff,
    options.variantId || 0,
    jsonBytes.length & 0xff,
    (jsonBytes.length >> 8) & 0xff,
    (jsonBytes.length >> 16) & 0xff,
    (jsonBytes.length >> 24) & 0xff,
  ]);
  const trailer = encoder.encode(options.trailer || 'html2fig-probe');
  const out = new Uint8Array(prefix.length + header.length + jsonBytes.length + trailer.length);
  out.set(prefix, 0);
  out.set(header, prefix.length);
  out.set(jsonBytes, prefix.length + header.length);
  out.set(trailer, prefix.length + header.length + jsonBytes.length);
  return base64FromBytes(out);
}

function buildSpliceProbeBuffer(data, templateKey, options = {}) {
  const template = REAL_BUFFER_SPLICE_TEMPLATES[templateKey];
  if (!template) return null;
  const encoder = new TextEncoder();
  const payload = encoder.encode(JSON.stringify({
    t: data?.meta?.title || '',
    u: data?.meta?.url || '',
    n: Array.isArray(data?.nodes) ? data.nodes.slice(0, 32).map((node) => ({
      type: node?.type,
      text: node?.type === 'text' ? String(node.text || '').slice(0, 64) : undefined,
      rect: node?.rect,
    })) : [],
    v: options.variantLabel || templateKey,
  }));
  const prefix = hexToBytes(template.prefixHex);
  const tail = hexToBytes(template.tailHex);
  const spliceHeadLength = Math.min(16, tail.length);
  const spliceHead = tail.slice(0, spliceHeadLength);
  const trailer = hexToBytes(template.trailerHex);
  const middleBudget = Math.max(0, tail.length - spliceHeadLength - trailer.length);
  const middle = new Uint8Array(middleBudget);
  for (let i = 0; i < middle.length; i += 1) {
    middle[i] = payload.length ? payload[i % payload.length] : 0;
  }
  const out = new Uint8Array(prefix.length + spliceHead.length + middle.length + trailer.length);
  out.set(prefix, 0);
  out.set(spliceHead, prefix.length);
  out.set(middle, prefix.length + spliceHead.length);
  out.set(trailer, prefix.length + spliceHead.length + middle.length);
  return base64FromBytes(out);
}

function buildProbeVariants(data) {
  const json = JSON.stringify(data);
  return [
    {
      label: 'base64-json',
      metadata: createProbeMetadata(data, { version: 1, type: 'figma-rich-probe', variant: 'base64-json' }),
      buffer: toBase64Utf8(json),
    },
    {
      label: 'synthetic-scene-v1',
      metadata: createProbeMetadata(data, { version: 1, type: 'figma-rich-probe', variant: 'synthetic-scene-v1' }),
      buffer: buildSyntheticSceneBuffer(data, { variantId: 1, trailer: 'scene-v1' }),
    },
    {
      label: 'synthetic-scene-v2',
      metadata: createProbeMetadata(data, { version: 2, type: 'figma-rich-probe', variant: 'synthetic-scene-v2' }),
      buffer: buildSyntheticSceneBuffer(data, { variantId: 2, trailer: 'scene-v2:tail' }),
    },
    {
      label: 'splice-rect-tail',
      metadata: createProbeMetadata(data, { version: 3, type: 'figma-rich-probe', variant: 'splice-rect-tail', spliceTemplate: 'rectangle' }),
      buffer: buildSpliceProbeBuffer(data, 'rectangle', { variantLabel: 'splice-rect-tail' }),
    },
    {
      label: 'splice-text-tail',
      metadata: createProbeMetadata(data, { version: 3, type: 'figma-rich-probe', variant: 'splice-text-tail', spliceTemplate: 'text' }),
      buffer: buildSpliceProbeBuffer(data, 'text', { variantLabel: 'splice-text-tail' }),
    },
    {
      label: 'splice-mixed-tail',
      metadata: createProbeMetadata(data, { version: 3, type: 'figma-rich-probe', variant: 'splice-mixed-tail', spliceTemplate: 'mixed' }),
      buffer: buildSpliceProbeBuffer(data, 'mixed', { variantLabel: 'splice-mixed-tail' }),
    },
  ].filter((variant) => !!variant.buffer);
}

function serializeSingleProbeVariantHtml(data, variant) {
  const fallback = buildFallbackTextRuns(data);
  const metadataWrapper = escapeHtml(wrapFigmaComment('figmeta', toBase64Utf8(variant.metadata)));
  const bufferWrapper = escapeHtml(wrapFigmaComment('figma', variant.buffer));
  return `
    <html><body><!--StartFragment--><meta charset="utf-8"><meta name="html2fig-format" content="figma-rich-probe" />
      <span data-html2fig-variant="${variant.label}" data-metadata="${metadataWrapper}" data-buffer="${bufferWrapper}" data-figma-metadata="${metadataWrapper}" data-figma-buffer="${bufferWrapper}" style="display:none"></span>
      <div data-html2fig-probe-summary="variant:${variant.label}"></div>
      ${fallback}
    <!--EndFragment--></body></html>
  `;
}

function serializeFigmaStyleRichProbe(data) {
  const variants = buildProbeVariants(data);
  const fallback = buildFallbackTextRuns(data);
  const spans = variants.map((variant) => {
    const metadataWrapper = escapeHtml(wrapFigmaComment('figmeta', toBase64Utf8(variant.metadata)));
    const bufferWrapper = escapeHtml(wrapFigmaComment('figma', variant.buffer));
    return `<span data-html2fig-variant="${variant.label}" data-metadata="${metadataWrapper}" data-buffer="${bufferWrapper}" data-figma-metadata="${metadataWrapper}" data-figma-buffer="${bufferWrapper}" style="display:none"></span>`;
  }).join('');
  return `
    <html><body><!--StartFragment--><meta charset="utf-8"><meta name="html2fig-format" content="figma-rich-probe" />
      ${spans}
      <div data-html2fig-probe-summary="variants:${variants.map((variant) => variant.label).join(',')}"></div>
      ${fallback}
    <!--EndFragment--></body></html>
  `;
}

function serializeSvgPayload(data) {
  const title = escapeHtml(data?.meta?.title || 'html2fig capture');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="120"><rect width="100%" height="100%" fill="#ffffff"/><text x="24" y="48" font-size="28" font-family="Arial, sans-serif" fill="#102a43">${title}</text><text x="24" y="86" font-size="16" font-family="Arial, sans-serif" fill="#486581">html2fig experimental SVG clipboard payload</text></svg>`;
}

function loadAcceptanceLog() {
  try {
    return JSON.parse(localStorage.getItem(ACCEPTANCE_STORAGE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function saveAcceptanceLog() {
  try {
    localStorage.setItem(ACCEPTANCE_STORAGE_KEY, JSON.stringify(acceptanceLog));
  } catch {}
}

function getVariantRecord(label) {
  return acceptanceLog[label] || { verdict: null, attempts: 0, notes: '' };
}

function setVariantVerdict(label, verdict) {
  const record = getVariantRecord(label);
  const nextRecord = {
    ...record,
    verdict,
    attempts: record.attempts + 1,
    updatedAt: new Date().toISOString(),
  };
  if (!verdict && !nextRecord.notes && !nextRecord.attempts) delete acceptanceLog[label];
  else acceptanceLog[label] = nextRecord;
  saveAcceptanceLog();
}

function exportAcceptanceMatrix() {
  const lines = lastProbeVariants.map((variant, index) => {
    const record = getVariantRecord(variant.label);
    return {
      index: index + 1,
      variant: variant.label,
      verdict: record.verdict || '',
      attempts: record.attempts || 0,
      updatedAt: record.updatedAt || '',
      notes: record.notes || '',
      metadata: variant.metadata,
    };
  });
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    title: lastCapturedData?.meta?.title || '',
    url: lastCapturedData?.meta?.url || '',
    variants: lines,
  }, null, 2);
}

async function copySingleVariant(label) {
  if (!lastCapturedData) throw new Error('No captured data available');
  await writePayloadToClipboard(lastCapturedData, 'figma-html-rich', { singleVariant: label });
}

async function copyNextVariant() {
  if (!lastProbeVariants.length) throw new Error('No probe variants available yet');
  const variant = lastProbeVariants[nextVariantIndex % lastProbeVariants.length];
  nextVariantIndex = (nextVariantIndex + 1) % lastProbeVariants.length;
  await copySingleVariant(variant.label);
  statusEl.textContent = `Copied next variant ${variant.label}. Paste into Figma and mark result.`;
}

function renderVariantMatrix() {
  if (!lastCapturedData || !lastProbeVariants.length) {
    variantMatrixEl.hidden = true;
    variantRowsEl.innerHTML = '';
    return;
  }
  variantMatrixEl.hidden = false;
  variantRowsEl.innerHTML = '';
  lastProbeVariants.forEach((variant) => {
    const row = document.createElement('div');
    row.className = 'matrix-row';

    const label = document.createElement('div');
    label.className = 'matrix-label';
    const record = getVariantRecord(variant.label);
    const verdict = record.verdict;
    const attemptText = record.attempts ? `, tries:${record.attempts}` : '';
    label.textContent = verdict ? `${variant.label} (${verdict}${attemptText})` : variant.label;

    const copyBtn = document.createElement('button');
    copyBtn.className = 'secondary mini';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', async () => {
      try {
        await copySingleVariant(variant.label);
        statusEl.textContent = `Copied variant ${variant.label}. Paste into Figma and mark result.`;
      } catch (error) {
        statusEl.textContent = `Variant copy failed: ${error.message}`;
      }
    });

    const acceptBtn = document.createElement('button');
    acceptBtn.className = `mini ${verdict === 'accepted' ? 'primary' : 'secondary'}`;
    acceptBtn.textContent = 'Accept';
    acceptBtn.addEventListener('click', () => {
      setVariantVerdict(variant.label, verdict === 'accepted' ? null : 'accepted');
      renderVariantMatrix();
      statusEl.textContent = `Updated test matrix: ${variant.label} -> ${verdict === 'accepted' ? 'unset' : 'accepted'}`;
    });

    const ignoreBtn = document.createElement('button');
    ignoreBtn.className = `mini ${verdict === 'ignored' ? 'primary' : 'secondary'}`;
    ignoreBtn.textContent = 'Ignore';
    ignoreBtn.addEventListener('click', () => {
      setVariantVerdict(variant.label, verdict === 'ignored' ? null : 'ignored');
      renderVariantMatrix();
      statusEl.textContent = `Updated test matrix: ${variant.label} -> ${verdict === 'ignored' ? 'unset' : 'ignored'}`;
    });

    row.appendChild(label);
    row.appendChild(copyBtn);
    row.appendChild(acceptBtn);
    row.appendChild(ignoreBtn);
    variantRowsEl.appendChild(row);
  });
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
      ? serializeFigmaStyleHtmlProbe(data)
      : mode === 'figma-html-rich'
        ? (() => {
            const variants = buildProbeVariants(data);
            lastProbeVariants = variants;
            if (options.singleVariant) {
              const found = variants.find((variant) => variant.label === options.singleVariant);
              if (!found) throw new Error(`Unknown probe variant: ${options.singleVariant}`);
              return serializeSingleProbeVariantHtml(data, found);
            }
            return serializeFigmaStyleRichProbe(data);
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
    files: ['inject-capture.js'],
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

async function runCapture(selector) {
  try {
    statusEl.textContent = 'Preparing capture…';
    const tab = await getCurrentTab();
    await injectCaptureScript(tab.id);
    const mode = modeEl.value;
    const data = await captureData(tab.id, selector);
    lastCapturedData = data;
    await writePayloadToClipboard(data, mode);
    renderVariantMatrix();
    statusEl.textContent = `Copied ${mode} payload for:\n${data?.meta?.title || 'Untitled Page'}\nNow try Ctrl+V in Figma.`;
  } catch (error) {
    statusEl.textContent = `Capture failed: ${error.message}`;
  }
}

document.getElementById('captureBtn').addEventListener('click', () => runCapture(null));
document.getElementById('captureAppBtn').addEventListener('click', () => runCapture('#app'));
nextVariantBtn.addEventListener('click', async () => {
  try {
    await copyNextVariant();
  } catch (error) {
    statusEl.textContent = `Copy next failed: ${error.message}`;
  }
});
exportMatrixBtn.addEventListener('click', async () => {
  try {
    const exported = exportAcceptanceMatrix();
    await navigator.clipboard.writeText(exported);
    statusEl.textContent = 'Acceptance matrix JSON copied to clipboard.';
  } catch (error) {
    statusEl.textContent = `Export failed: ${error.message}`;
  }
});
