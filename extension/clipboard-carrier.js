export function toBase64Utf8(value) {
  return btoa(unescape(encodeURIComponent(typeof value === 'string' ? value : JSON.stringify(value))));
}

export function wrapFigmaComment(tag, encodedValue) {
  return `<!--(${tag})${encodedValue}(/${tag})-->`;
}

export function buildFallbackTextRuns(data, escapeHtml) {
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

export function buildFigmaClipboardCarrier(metadataWrapper, bufferWrapper, variantLabel = '', fallback = '') {
  const variantAttr = variantLabel ? ` data-html2fig-variant="${variantLabel}"` : '';
  return `<span style="white-space:pre-wrap;display:block;"${variantAttr}><span data-metadata="${metadataWrapper}"></span><span data-buffer="${bufferWrapper}"></span>${fallback}</span>`;
}

export function serializeFigmaStyleHtmlProbe(data, metadata, buffer, escapeHtml) {
  const metadataWrapper = escapeHtml(wrapFigmaComment('figmeta', toBase64Utf8(metadata)));
  const bufferWrapper = escapeHtml(wrapFigmaComment('figma', buffer));
  const fallback = buildFallbackTextRuns(data, escapeHtml);
  return `<html><body><!--StartFragment--><meta charset="utf-8"><span data-metadata="${metadataWrapper}"></span><span data-buffer="${bufferWrapper}"></span>${fallback}<!--EndFragment--></body></html>`;
}

export function serializeSingleProbeVariantHtml(data, variant, escapeHtml) {
  const fallback = buildFallbackTextRuns(data, escapeHtml);
  const metadataWrapper = escapeHtml(wrapFigmaComment('figmeta', toBase64Utf8(variant.metadata)));
  const bufferWrapper = escapeHtml(wrapFigmaComment('figma', variant.buffer));
  const carrier = buildFigmaClipboardCarrier(metadataWrapper, bufferWrapper, variant.label, fallback);
  return `<html><body><!--StartFragment--><meta charset="utf-8">${carrier}<!--EndFragment--></body></html>`;
}

export function serializeFigmaStyleRichProbe(data, variants, escapeHtml) {
  const fallback = buildFallbackTextRuns(data, escapeHtml);
  const carriers = variants.map((variant, index) => {
    const metadataWrapper = escapeHtml(wrapFigmaComment('figmeta', toBase64Utf8(variant.metadata)));
    const bufferWrapper = escapeHtml(wrapFigmaComment('figma', variant.buffer));
    return buildFigmaClipboardCarrier(metadataWrapper, bufferWrapper, variant.label, index === 0 ? fallback : '');
  }).join('');
  return `<html><body><!--StartFragment--><meta charset="utf-8">${carriers}<!--EndFragment--></body></html>`;
}
