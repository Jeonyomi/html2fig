/**
 * ir-to-scene.js
 * Converts html2fig IR (Intermediate Representation) into a Figma
 * NODE_CHANGES message suitable for clipboard paste.
 *
 * IR node types:
 *   'element' → FRAME (container) or ROUNDED_RECTANGLE (leaf / styled box)
 *   'text'    → TEXT
 *
 * The message always wraps content in the standard Figma clipboard hierarchy:
 *   DOCUMENT → CANVAS ("Page 1") → [content nodes] → Internal Only CANVAS
 */

// ─── GUID helpers ────────────────────────────────────────────────────────────

const SESSION_CONTENT = 1;       // session ID for IR-derived nodes
const SESSION_DOC = 0;           // reserved session ID for DOCUMENT / CANVAS
const SESSION_INTERNAL = 20000008; // reserved for "Internal Only Canvas"

function guid(sessionID, localID) {
  return { sessionID, localID };
}

// ─── Fractional-indexing position helpers ────────────────────────────────────

// Simple sequential fractional index strings (Figma uses these for ordering).
// We generate lowercase single-char positions for up to 26 siblings.
// For larger trees, we combine them: "a", "b", ..., "z", "aa", "ab", ...
function positionForIndex(i) {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  if (i < 26) return chars[i];
  return chars[Math.floor(i / 26) - 1] + chars[i % 26];
}

// ─── Color helpers ───────────────────────────────────────────────────────────

function cssColorToFigma(colorObj) {
  if (!colorObj || typeof colorObj !== 'object') return null;
  const { r, g, b, a } = colorObj;
  if (typeof r !== 'number') return null;
  return { r, g, b, a: typeof a === 'number' ? a : 1 };
}

function solidPaint(colorObj, opacity = 1) {
  const color = cssColorToFigma(colorObj);
  if (!color) return null;
  return {
    type: 'SOLID',
    color,
    opacity: color.a < 1 ? color.a : opacity,
    visible: true,
    blendMode: 'NORMAL',
  };
}

// ─── IR node tree helpers ─────────────────────────────────────────────────────

/**
 * Build a lookup map from IR node id → node, and a children map.
 */
function buildTreeMaps(nodes) {
  const byId = new Map();
  const childrenOf = new Map(); // parentId → [node, ...]
  for (const node of nodes) {
    byId.set(node.id, node);
    if (!childrenOf.has(node.parentId)) childrenOf.set(node.parentId, []);
    childrenOf.get(node.parentId).push(node);
  }
  return { byId, childrenOf };
}

// ─── Node change builders ─────────────────────────────────────────────────────

function identityTransform() {
  return { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 };
}

function makeDocument() {
  return {
    guid: guid(SESSION_DOC, 0),
    phase: 'CREATED',
    type: 'DOCUMENT',
    name: 'Document',
    visible: true,
    opacity: 1,
    transform: identityTransform(),
    slideThemeMap: { entries: [] },
  };
}

function makeCanvas(localID, name, parentLocalID, parentSessionID = SESSION_DOC, position = '!') {
  return {
    guid: guid(SESSION_DOC, localID),
    phase: 'CREATED',
    parentIndex: { guid: guid(parentSessionID, parentLocalID), position },
    type: 'CANVAS',
    name,
    visible: true,
    opacity: 1,
    transform: identityTransform(),
    backgroundOpacity: 1,
    backgroundEnabled: true,
  };
}

function makeInternalCanvas() {
  return {
    guid: guid(SESSION_INTERNAL, 2),
    phase: 'CREATED',
    parentIndex: { guid: guid(SESSION_DOC, 0), position: '"' },
    type: 'CANVAS',
    name: 'Internal Only Canvas',
    visible: false,
    opacity: 1,
    transform: identityTransform(),
    backgroundOpacity: 1,
    backgroundEnabled: true,
    internalOnly: true,
  };
}

/**
 * Convert an IR element node to a FRAME (container) or ROUNDED_RECTANGLE (leaf).
 *
 * @param {object} irNode        IR node
 * @param {object} parentGuid    Parent GUID in Figma
 * @param {string} position      Fractional-index position string
 * @param {number} localID       This node's localID
 * @param {boolean} hasChildren  Whether the IR node has children
 */
function makeElementNode(irNode, parentGuid, position, localID, hasChildren) {
  const { rect, style = {} } = irNode;
  const nodeType = hasChildren ? 'FRAME' : 'ROUNDED_RECTANGLE';

  const nc = {
    guid: guid(SESSION_CONTENT, localID),
    phase: 'CREATED',
    parentIndex: { guid: parentGuid, position },
    type: nodeType,
    name: irNode.name || irNode.tag || 'Box',
    visible: true,
    opacity: typeof style.opacity === 'number' ? style.opacity : 1,
    size: { x: Math.max(1, rect.width), y: Math.max(1, rect.height) },
    transform: { m00: 1, m01: 0, m02: rect.x, m10: 0, m11: 1, m12: rect.y },
    strokeWeight: 1,
    strokeAlign: 'INSIDE',
    strokeJoin: 'MITER',
    fillPaints: [],
    strokePaints: [],
  };

  // Background fill
  if (style.backgroundColor) {
    const paint = solidPaint(style.backgroundColor);
    if (paint) nc.fillPaints.push(paint);
  }
  if (nc.fillPaints.length === 0) {
    // Transparent fill so the node is visible
    nc.fillPaints.push({ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 0 }, opacity: 0, visible: true, blendMode: 'NORMAL' });
  }

  // Border (stroke)
  if (style.border) {
    const bw = Math.max(
      style.border.topWidth || 0,
      style.border.rightWidth || 0,
      style.border.bottomWidth || 0,
      style.border.leftWidth || 0,
    );
    if (bw > 0 && style.border.color) {
      const strokePaint = solidPaint(style.border.color);
      if (strokePaint) {
        nc.strokePaints.push(strokePaint);
        nc.strokeWeight = bw;
      }
    }
  }

  // Corner radius
  if (style.borderRadius) {
    const { topLeft = 0, topRight = 0, bottomRight = 0, bottomLeft = 0 } = style.borderRadius;
    const allSame = topLeft === topRight && topRight === bottomRight && bottomRight === bottomLeft;
    if (allSame && topLeft > 0) {
      nc.cornerRadius = topLeft;
    } else if (topLeft + topRight + bottomRight + bottomLeft > 0) {
      nc.cornerRadius = Math.max(topLeft, topRight, bottomRight, bottomLeft);
    }
  }

  // FRAME-specific layout
  if (nodeType === 'FRAME') {
    nc.clipsContent = style.overflow === 'hidden';
  }

  return nc;
}

/**
 * Convert an IR text node to a Figma TEXT node change.
 */
function makeTextNode(irNode, parentGuid, position, localID) {
  const { rect, style = {}, text = '' } = irNode;

  // Map fontWeight string to Figma style name
  const fw = parseInt(style.fontWeight, 10) || 400;
  let fontStyle = 'Regular';
  if (fw >= 700) fontStyle = 'Bold';
  else if (fw >= 600) fontStyle = 'SemiBold';
  else if (fw >= 500) fontStyle = 'Medium';

  // Map lineHeight string (e.g. "1.5", "24px", "150%") to Figma lineHeight
  let lineHeight = { value: 100, units: 'PERCENT' };
  if (style.lineHeight) {
    const lhStr = String(style.lineHeight);
    if (lhStr.endsWith('px')) {
      lineHeight = { value: parseFloat(lhStr), units: 'PIXELS' };
    } else if (lhStr.endsWith('%')) {
      lineHeight = { value: parseFloat(lhStr), units: 'PERCENT' };
    } else {
      const lhNum = parseFloat(lhStr);
      if (!isNaN(lhNum)) lineHeight = { value: lhNum * 100, units: 'PERCENT' };
    }
  }

  // Map letterSpacing string (e.g. "0px", "0.05em", "2%")
  let letterSpacing = { value: 0, units: 'PERCENT' };
  if (style.letterSpacing) {
    const lsStr = String(style.letterSpacing);
    if (lsStr.endsWith('px')) {
      letterSpacing = { value: parseFloat(lsStr), units: 'PIXELS' };
    } else if (lsStr.endsWith('%')) {
      letterSpacing = { value: parseFloat(lsStr), units: 'PERCENT' };
    }
  }

  const fontSize = style.fontSize || 12;
  const fontFamily = style.fontFamily ? style.fontFamily.split(',')[0].trim().replace(/['"]/g, '') : 'Inter';

  // Map textAlign to Figma's enum
  const alignMap = { left: 'LEFT', center: 'CENTER', right: 'RIGHT', justify: 'JUSTIFIED' };
  const textAlignHorizontal = alignMap[style.textAlign] || 'LEFT';

  const nc = {
    guid: guid(SESSION_CONTENT, localID),
    phase: 'CREATED',
    parentIndex: { guid: parentGuid, position },
    type: 'TEXT',
    name: text.slice(0, 64) || irNode.name || 'Text',
    visible: true,
    opacity: typeof style.opacity === 'number' ? style.opacity : 1,
    size: { x: Math.max(1, rect.width), y: Math.max(1, rect.height) },
    transform: { m00: 1, m01: 0, m02: rect.x, m10: 0, m11: 1, m12: rect.y },
    fontSize,
    fontName: { family: fontFamily, style: fontStyle, postscript: '' },
    textAlignHorizontal,
    textAlignVertical: 'TOP',
    lineHeight,
    letterSpacing,
    strokeWeight: 1,
    strokeAlign: 'OUTSIDE',
    strokeJoin: 'MITER',
    textAutoResize: 'NONE',
    textData: {
      characters: text,
      lines: [{
        lineType: 'PLAIN',
        styleId: 0,
        indentationLevel: 0,
        sourceDirectionality: 'AUTO',
        listStartOffset: 0,
        isFirstLineOfList: false,
      }],
    },
    fillPaints: [],
    strokePaints: [],
  };

  // Text color
  if (style.color) {
    const paint = solidPaint(style.color);
    if (paint) nc.fillPaints.push(paint);
  }
  if (nc.fillPaints.length === 0) {
    nc.fillPaints.push({ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true, blendMode: 'NORMAL' });
  }

  return nc;
}

// ─── Main conversion entry point ──────────────────────────────────────────────

/**
 * Build a Figma NODE_CHANGES message from an html2fig IR payload.
 *
 * @param {object} data  Validated html2fig IR payload
 * @returns {object}     Kiwi NODE_CHANGES message (ready for encodeMessage)
 */
export function irToNodeChanges(data) {
  const nodes = data.nodes || [];
  const root = data.root;
  const { byId, childrenOf } = buildTreeMaps(nodes);

  // Counter for Figma localIDs within SESSION_CONTENT
  let nextLocalID = 1;

  // Map from IR node.id → Figma GUID
  const idToGuid = new Map();

  // All node changes to include in the message (content nodes only)
  const contentChanges = [];

  // The root frame occupies the first localID
  const rootGuid = guid(SESSION_CONTENT, nextLocalID++);
  const canvasGuid = guid(SESSION_DOC, 1);
  idToGuid.set(root.id, rootGuid);

  /**
   * Recursively convert an IR node and its children.
   * @param {object} irNode
   * @param {object} parentFigmaGuid
   * @param {number} siblingIndex
   */
  function convertNode(irNode, parentFigmaGuid, siblingIndex) {
    const children = childrenOf.get(irNode.id) || [];
    const myGuid = idToGuid.get(irNode.id) || guid(SESSION_CONTENT, nextLocalID++);
    idToGuid.set(irNode.id, myGuid);
    const position = positionForIndex(siblingIndex);

    let nc;
    if (irNode.type === 'text') {
      nc = makeTextNode(irNode, parentFigmaGuid, position, myGuid.localID);
    } else {
      nc = makeElementNode(irNode, parentFigmaGuid, position, myGuid.localID, children.length > 0);
    }
    contentChanges.push(nc);

    // Recurse into children
    children.forEach((child, childIdx) => {
      // Pre-assign child GUID so children of this node get sequential IDs
      idToGuid.set(child.id, guid(SESSION_CONTENT, nextLocalID++));
      convertNode(child, myGuid, childIdx);
    });
  }

  // Convert the root node (position "!" = first child of canvas)
  const rootIrNode = byId.get(root.id) || {
    id: root.id,
    type: root.type,
    name: root.name,
    tag: 'div',
    rect: root.rect,
    style: {},
    children: [],
  };
  // Ensure root GUID is pre-assigned to 1
  idToGuid.set(root.id, rootGuid);

  const rootChildren = childrenOf.get(root.id) || [];
  const rootNC = makeElementNode(rootIrNode, canvasGuid, '!', rootGuid.localID, rootChildren.length > 0);
  contentChanges.push(rootNC);

  // Pre-assign IDs for root's immediate children
  rootChildren.forEach((child) => {
    idToGuid.set(child.id, guid(SESSION_CONTENT, nextLocalID++));
  });

  rootChildren.forEach((child, idx) => {
    convertNode(child, rootGuid, idx);
  });

  // Build the complete message
  const pasteID = Math.floor(Date.now() % 2147483647);
  const fileKey = randomAlphaNum(22);

  // clipboardSelectionRegions lists the root frame as the top-level pasted node
  const clipboardSelectionRegions = [
    {
      parent: canvasGuid,
      nodes: [rootGuid],
      pasteIsPartiallyOutsideEnclosingFrame: false,
      focusType: 'NONE',
    },
  ];

  return {
    type: 'NODE_CHANGES',
    sessionID: 0,
    ackID: 0,
    pasteID,
    pasteFileKey: fileKey,
    pasteIsPartiallyOutsideEnclosingFrame: false,
    pastePageId: canvasGuid,
    isCut: false,
    pasteEditorType: 'DESIGN',
    publishedAssetGuids: [],
    clipboardSelectionRegions,
    pasteAssetType: 'UNKNOWN',
    nodeChanges: [
      makeDocument(),
      makeCanvas(1, 'Page 1', 0),
      ...contentChanges,
      makeInternalCanvas(),
    ],
  };
}

function randomAlphaNum(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
