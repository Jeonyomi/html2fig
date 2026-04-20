import {
  buildFallbackTextRuns,
  serializeFigmaStyleHtmlProbe as serializeProbeCarrier,
  serializeFigmaStyleRichProbe as serializeRichProbeCarrier,
  serializeSingleProbeVariantHtml as serializeSingleVariantCarrier,
  toBase64Utf8,
} from './clipboard-carrier.js';
import {
  buildProbeVariants,
  createProbeMetadata,
} from './ir-to-probe.js';

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
