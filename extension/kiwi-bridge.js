/**
 * kiwi-bridge.js
 * Browser-compatible Figma clipboard archive builder.
 *
 * Uses:
 *  - figma-schema-compiled.js  pre-compiled schema (NO eval / no compileSchema)
 *  - pako/dist/pako.esm.mjs    deflate compression
 *
 * The compiled schema was generated at build time via kiwi-schema's
 * compileSchemaJS(), so it requires NO eval / new Function at runtime.
 * This makes it fully CSP-safe for Chrome MV3 extensions.
 *
 * Produces fig-kiwi archives (version 15, deflateRaw compression).
 */

import { encodeMessage as kiwiEncode, decodeMessage as kiwiDecode } from './figma-schema-compiled.js';
import { deflateRaw } from './pako.esm.mjs';

// ── Base64 helpers ────────────────────────────────────────────────────────────

function b64ToU8(b64) {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function u8ToB64(u8) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    binary += String.fromCharCode(...u8.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// ── Schema chunk ──────────────────────────────────────────────────────────────
// The schema bytes are already deflate-compressed in figma-schema.bin.b64.
// We load them once and reuse for every archive we write.

let _schemaChunkPromise = null;

function loadSchemaChunk() {
  if (_schemaChunkPromise) return _schemaChunkPromise;
  _schemaChunkPromise = fetch(new URL('./figma-schema.bin.b64', import.meta.url).href)
    .then((r) => r.text())
    .then((b64) => b64ToU8(b64.trim()));  // already deflate-compressed
  return _schemaChunkPromise;
}

// ── Archive writer ────────────────────────────────────────────────────────────

function writeArchive(schemaDeflated, messageDeflated, version = 15) {
  const PRELUDE = 'fig-kiwi';
  const enc = new TextEncoder();
  const preludeBytes = enc.encode(PRELUDE);
  const totalSize =
    preludeBytes.length + 4 +
    (4 + schemaDeflated.length) +
    (4 + messageDeflated.length);
  const buf = new Uint8Array(totalSize);
  const view = new DataView(buf.buffer);
  let offset = 0;
  buf.set(preludeBytes, offset); offset += preludeBytes.length;
  view.setUint32(offset, version, true); offset += 4;
  view.setUint32(offset, schemaDeflated.length, true); offset += 4;
  buf.set(schemaDeflated, offset); offset += schemaDeflated.length;
  view.setUint32(offset, messageDeflated.length, true); offset += 4;
  buf.set(messageDeflated, offset);
  return buf;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Encode a NODE_CHANGES message into a fig-kiwi archive base64 string.
 * @param {object} message  The NODE_CHANGES message object.
 * @returns {Promise<string>} Base64-encoded archive ready for Figma clipboard.
 */
export async function encodeMessage(message) {
  const schemaDeflated = await loadSchemaChunk();
  const msgBytes = kiwiEncode(message);
  const msgDeflated = deflateRaw(msgBytes);
  const archive = writeArchive(schemaDeflated, msgDeflated, 15);
  return u8ToB64(archive);
}

/**
 * Decode a fig-kiwi archive base64 string back to a NODE_CHANGES message.
 * Useful for verification / debugging.
 */
export function decodeMessage(bytes) {
  return kiwiDecode(bytes);
}

/**
 * Verify that the kiwi pipeline round-trips correctly in the browser.
 * @param {object} message  Input message.
 * @returns {object} Decoded message for inspection.
 */
export async function testRoundTrip(message) {
  const encoded = kiwiEncode(message);
  const decoded = kiwiDecode(encoded);
  return decoded;
}

export async function isReady() {
  try {
    await loadSchemaChunk();
    return true;
  } catch (e) {
    return false;
  }
}
