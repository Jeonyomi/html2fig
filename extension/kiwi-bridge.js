/**
 * kiwi-bridge.js
 * Browser-compatible Figma clipboard archive builder.
 *
 * Uses:
 *  - kiwi-schema/kiwi-esm.js  (pure JS, no Node.js deps)
 *  - pako/dist/pako.esm.mjs   (deflate compression)
 *  - figma-schema.bin.b64     (inline base64 schema extracted from real Figma clipboard)
 *
 * Produces fig-kiwi archives (version 15, deflateRaw compression) that Figma
 * can read on paste, matching the format used by the fig-kiwi library.
 */

// Dynamic imports resolved relative to extension root at runtime
let _kiwi = null;
let _pako = null;
let _compiledSchema = null;

async function loadDeps() {
  if (_compiledSchema) return _compiledSchema;

  const kiwiMod = await import('./kiwi-esm.js');
  const pakoMod = await import('./pako.esm.mjs');
  _kiwi = kiwiMod;
  _pako = pakoMod;

  // Load schema base64 and decode
  const schemaB64Response = await fetch(new URL('./figma-schema.bin.b64', import.meta.url).href);
  const schemaB64 = await schemaB64Response.text();
  const schemaDeflated = b64ToU8(schemaB64.trim());
  const schemaBytes = _pako.inflateRaw(schemaDeflated);
  const schema = _kiwi.decodeBinarySchema(schemaBytes);
  const compiled = _kiwi.compileSchema(schema);
  _compiledSchema = { compiled, schema, schemaBytes };
  return _compiledSchema;
}

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

/**
 * Encode a NODE_CHANGES message into a fig-kiwi archive base64 string.
 * @param {object} message  The kiwi NODE_CHANGES message object.
 * @returns {Promise<string>} Base64-encoded archive ready for Figma clipboard.
 */
export async function encodeMessage(message) {
  const { compiled, schemaBytes } = await loadDeps();

  // Encode message bytes
  const msgBytes = compiled.encodeMessage(message);

  // Compress both chunks with deflateRaw (version 15 format)
  const schemaDeflated = _pako.deflateRaw(schemaBytes);
  const msgDeflated = _pako.deflateRaw(msgBytes);

  const archive = writeArchive(schemaDeflated, msgDeflated, 15);
  return u8ToB64(archive);
}

/**
 * Encode a NODE_CHANGES message using the raw schema chunk from real Figma data.
 * This keeps the schema chunk as-is (already deflate-compressed) and only
 * re-encodes the message.
 * @param {object} message
 * @returns {Promise<string>} Base64-encoded archive.
 */
export async function encodeMessageWithRealSchema(message) {
  const { compiled, schemaBytes } = await loadDeps();

  // Re-compress schema
  const schemaDeflated = _pako.deflateRaw(schemaBytes);

  // Encode and compress message
  const msgBytes = compiled.encodeMessage(message);
  const msgDeflated = _pako.deflateRaw(msgBytes);

  const archive = writeArchive(schemaDeflated, msgDeflated, 15);
  return u8ToB64(archive);
}

/**
 * Verify that the kiwi pipeline round-trips correctly in the browser.
 * Returns decoded message for inspection.
 */
export async function testRoundTrip(message) {
  const { compiled } = await loadDeps();
  const encoded = compiled.encodeMessage(message);
  const decoded = compiled.decodeMessage(encoded);
  return decoded;
}

export async function isReady() {
  try {
    await loadDeps();
    return true;
  } catch (e) {
    return false;
  }
}
