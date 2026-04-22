import {
  buildFallbackTextRuns,
  serializeFigmaStyleHtmlProbe as serializeProbeCarrier,
  serializeFigmaStyleRichProbe as serializeRichProbeCarrier,
  serializeSingleProbeVariantHtml as serializeSingleVariantCarrier,
  toBase64Utf8,
  wrapFigmaComment,
} from './clipboard-carrier.js';
import {
  buildProbeVariants,
  createProbeMetadata,
} from './ir-to-probe.js';
import { irToNodeChanges } from './ir-to-scene.js';
import { encodeMessage, testRoundTrip } from './kiwi-bridge.js';

export { buildProbeVariants, createProbeMetadata };

export function serializeFigmaStyleHtmlProbe(data, escapeHtml) {
  const json = JSON.stringify(data);
  const metadata = createProbeMetadata(data);
  const buffer = toBase64Utf8(json);
  return serializeProbeCarrier(data, metadata, buffer, escapeHtml);
}

export function serializeSingleProbeVariantHtml(data, variant, escapeHtml) {
  return serializeSingleVariantCarrier(data, variant, escapeHtml);
}

export function serializeFigmaStyleRichProbe(data, escapeHtml) {
  const variants = buildProbeVariants(data);
  return serializeRichProbeCarrier(data, variants, escapeHtml);
}

export { buildFallbackTextRuns };

/**
 * Build a native Figma clipboard HTML string using the real kiwi/fig-kiwi pipeline.
 *
 * This produces a properly structured NODE_CHANGES message encoded with the
 * real Figma kiwi schema, yielding a fig-kiwi archive that Figma should accept
 * on paste as actual vector nodes (not a probe/fallback).
 *
 * @param {object} data       Validated html2fig IR payload
 * @param {Function} escapeHtml  HTML entity escaper
 * @returns {Promise<string>}  Full clipboard HTML string
 */
export async function serializeFigmaNativeScene(data, escapeHtml) {
  const message = irToNodeChanges(data);
  const archiveBase64 = await encodeMessage(message);

  const metadata = {
    fileKey: message.pasteFileKey,
    pasteID: message.pasteID,
    dataType: 'scene',
  };

  const metaB64 = toBase64Utf8(metadata);
  const metadataWrapper = escapeHtml(wrapFigmaComment('figmeta', metaB64));
  const bufferWrapper = escapeHtml(wrapFigmaComment('figma', archiveBase64));
  const fallback = buildFallbackTextRuns(data, escapeHtml);

  return `<html><body><!--StartFragment--><meta charset="utf-8"><span data-metadata="${metadataWrapper}"></span><span data-buffer="${bufferWrapper}"></span>${fallback}<!--EndFragment--></body></html>`;
}

/**
 * Round-trip test: encode the IR as a NODE_CHANGES message, then decode it
 * back to verify the kiwi pipeline is working in the browser.
 *
 * @param {object} data  IR payload
 * @returns {Promise<object>}  Decoded message (for inspection in devtools)
 */
export async function testKiwiRoundTrip(data) {
  const message = irToNodeChanges(data);
  const decoded = await testRoundTrip(message);
  return { original: message, decoded };
}
