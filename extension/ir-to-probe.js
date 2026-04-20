import { toBase64Utf8 } from './clipboard-carrier.js';

const REAL_SCENE_BUFFER_TEMPLATES = {
  primitiveMixed: {
    prefixHex: '6669672d6b6977696a00000073730000b5bd09986c4955e01ff7e65255afded2fbc6beefd87437ab6b6e5595efe546deac7add8c63999599f52a79599969deac',
    source: 'primitive-mixed',
  },
  html2design: {
    prefixHex: '6669672d6b6977696a00000038650000b4bd7b9c2c575528bcf6aeeaee9933e795f70308ef376812de5ef55add5d3d53e774773555d53339b95edb9aee9a99ca',
    source: 'html2design-scene',
  },
  figmaSlide: {
    prefixHex: '6669672d6b6977696a000000bd740000b5bd099c6c4955e01df7e65255afded6fbc2be2f024277b3bae65655f95e6ee4cdaad7dde358666566bd4a5e56669a37',
    source: 'figma-slide-scene',
  },
};

export const REAL_BUFFER_SPLICE_TEMPLATES = {
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

export const DERIVED_FIELD_PATCHES = [
  { name: 'zero-4-7', start: 4, length: 4, mode: 'zero' },
  { name: 'ff-4-7', start: 4, length: 4, mode: 'ff' },
  { name: 'zero-8-11', start: 8, length: 4, mode: 'zero' },
  { name: 'ff-8-11', start: 8, length: 4, mode: 'ff' },
  { name: 'zero-12-15', start: 12, length: 4, mode: 'zero' },
  { name: 'repeat-head-16-23', start: 16, length: 8, mode: 'repeat-head' },
];

export function createProbeMetadata(data, extra = {}) {
  return {
    fileKey: randomAlphaNum(22),
    pasteID: randomPasteId(),
    dataType: 'scene',
    source: 'html2fig-local',
    irVersion: data?.version || null,
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

export function buildProbeVariants(data) {
  const json = JSON.stringify(data);
  const baseVariants = [
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
    {
      label: 'scene-template-html2design',
      metadata: createProbeMetadata(data, { version: 5, type: 'figma-rich-probe', variant: 'scene-template-html2design', sceneTemplate: 'html2design' }),
      buffer: buildSceneTemplateProbeBuffer(data, 'html2design', { variantLabel: 'scene-template-html2design' }),
    },
    {
      label: 'scene-template-figma-slide',
      metadata: createProbeMetadata(data, { version: 5, type: 'figma-rich-probe', variant: 'scene-template-figma-slide', sceneTemplate: 'figmaSlide' }),
      buffer: buildSceneTemplateProbeBuffer(data, 'figmaSlide', { variantLabel: 'scene-template-figma-slide' }),
    },
    {
      label: 'scene-template-primitive-mixed',
      metadata: createProbeMetadata(data, { version: 5, type: 'figma-rich-probe', variant: 'scene-template-primitive-mixed', sceneTemplate: 'primitiveMixed' }),
      buffer: buildSceneTemplateProbeBuffer(data, 'primitiveMixed', { variantLabel: 'scene-template-primitive-mixed' }),
    },
  ];
  const derivedVariants = ['rectangle', 'text', 'mixed'].flatMap((templateKey) => DERIVED_FIELD_PATCHES.map((patch) => ({
    label: `splice-${templateKey}-${patch.name}`,
    metadata: createProbeMetadata(data, {
      version: 4,
      type: 'figma-rich-probe',
      variant: `splice-${templateKey}-${patch.name}`,
      spliceTemplate: templateKey,
      derivedPatch: patch.name,
    }),
    buffer: buildSpliceProbeBuffer(data, templateKey, { variantLabel: `splice-${templateKey}-${patch.name}`, patch }),
  })));
  return [...baseVariants, ...derivedVariants].filter((variant) => !!variant.buffer);
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
    version: data?.version || null,
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

function applyDerivedPatch(middle, patch) {
  const out = middle.slice();
  const start = Math.max(0, Math.min(out.length, patch.start || 0));
  const end = Math.max(start, Math.min(out.length, start + (patch.length || 0)));
  if (patch.mode === 'zero') {
    out.fill(0x00, start, end);
  } else if (patch.mode === 'ff') {
    out.fill(0xff, start, end);
  } else if (patch.mode === 'repeat-head') {
    for (let i = start; i < end; i += 1) out[i] = out[(i - start) % Math.max(1, start || 1)];
  }
  return out;
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
  let middle = new Uint8Array(middleBudget);
  for (let i = 0; i < middle.length; i += 1) {
    middle[i] = payload.length ? payload[i % payload.length] : 0;
  }
  if (options.patch) middle = applyDerivedPatch(middle, options.patch);
  const out = new Uint8Array(prefix.length + spliceHead.length + middle.length + trailer.length);
  out.set(prefix, 0);
  out.set(spliceHead, prefix.length);
  out.set(middle, prefix.length + spliceHead.length);
  out.set(trailer, prefix.length + spliceHead.length + middle.length);
  return base64FromBytes(out);
}

function buildSceneTemplateProbeBuffer(data, templateKey, options = {}) {
  const template = REAL_SCENE_BUFFER_TEMPLATES[templateKey];
  if (!template) return null;
  const header = hexToBytes(template.prefixHex);
  const encoder = new TextEncoder();
  const body = encoder.encode(JSON.stringify({
    variant: options.variantLabel || templateKey,
    source: template.source,
    title: data?.meta?.title || '',
    url: data?.meta?.url || '',
    version: data?.version || null,
    root: data?.root || null,
    nodes: Array.isArray(data?.nodes) ? data.nodes.slice(0, 48).map((node) => ({
      id: node?.id,
      type: node?.type,
      name: node?.name,
      text: node?.type === 'text' ? String(node.text || '').slice(0, 160) : undefined,
      rect: node?.rect,
      style: node?.style ? {
        fontSize: node.style.fontSize,
        fontWeight: node.style.fontWeight,
        color: node.style.color,
        backgroundColor: node.style.backgroundColor,
        borderRadius: node.style.borderRadius,
      } : undefined,
    })) : [],
  }));
  const out = new Uint8Array(header.length + body.length);
  out.set(header, 0);
  out.set(body, header.length);
  return base64FromBytes(out);
}
