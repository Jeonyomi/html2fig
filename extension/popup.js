const statusEl = document.getElementById('status');
const modeEl = document.getElementById('mode');

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

function serializeFigmaStyleRichProbe(data) {
  const json = JSON.stringify(data);
  const encodedMeta = toBase64Utf8(createProbeMetadata(data, {
    version: 1,
    type: 'figma-rich-probe',
  }));
  const encodedBuffer = toBase64Utf8(json);
  const metadataWrapper = escapeHtml(wrapFigmaComment('figmeta', encodedMeta));
  const bufferWrapper = escapeHtml(wrapFigmaComment('figma', encodedBuffer));
  const fallback = buildFallbackTextRuns(data);
  return `
    <html><body><!--StartFragment--><meta charset="utf-8"><meta name="html2fig-format" content="figma-rich-probe" />
      <span data-metadata="${metadataWrapper}"></span>
      <span data-buffer="${bufferWrapper}"></span>
      <span data-figma-metadata="${metadataWrapper}" data-figma-buffer="${bufferWrapper}"></span>
      ${fallback}
    <!--EndFragment--></body></html>
  `;
}

function serializeSvgPayload(data) {
  const title = escapeHtml(data?.meta?.title || 'html2fig capture');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="120"><rect width="100%" height="100%" fill="#ffffff"/><text x="24" y="48" font-size="28" font-family="Arial, sans-serif" fill="#102a43">${title}</text><text x="24" y="86" font-size="16" font-family="Arial, sans-serif" fill="#486581">html2fig experimental SVG clipboard payload</text></svg>`;
}

async function writePayloadToClipboard(data, mode) {
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
        ? serializeFigmaStyleRichProbe(data)
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
    await writePayloadToClipboard(data, mode);
    statusEl.textContent = `Copied ${mode} payload for:\n${data?.meta?.title || 'Untitled Page'}\nNow try Ctrl+V in Figma.`;
  } catch (error) {
    statusEl.textContent = `Capture failed: ${error.message}`;
  }
}

document.getElementById('captureBtn').addEventListener('click', () => runCapture(null));
document.getElementById('captureAppBtn').addEventListener('click', () => runCapture('#app'));
