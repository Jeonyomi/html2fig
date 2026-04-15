figma.showUI(__html__, { width: 420, height: 430 });

function rgbaToPaint(color) {
  if (!color) return null;
  return {
    type: 'SOLID',
    color: {
      r: color.r ?? 0,
      g: color.g ?? 0,
      b: color.b ?? 0,
    },
    opacity: color.a ?? 1,
  };
}

function isFiniteRect(rect) {
  return rect && [rect.x, rect.y, rect.width, rect.height].every((n) => Number.isFinite(n));
}

function applyBaseGeometry(node, rect) {
  if (!isFiniteRect(rect)) return;
  node.x = rect.x;
  node.y = rect.y;
  if ('resize' in node && rect.width > 0 && rect.height > 0) {
    node.resize(rect.width, rect.height);
  }
}

function applyCornerRadius(node, style) {
  if (!style?.borderRadius || !('cornerRadius' in node)) return;
  const radius = Math.max(
    style.borderRadius.topLeft || 0,
    style.borderRadius.topRight || 0,
    style.borderRadius.bottomLeft || 0,
    style.borderRadius.bottomRight || 0,
  );
  node.cornerRadius = radius;
}

function applyFrameStyle(node, style) {
  const fills = [];
  const bg = rgbaToPaint(style?.backgroundColor);
  if (bg) fills.push(bg);
  node.fills = fills;

  const stroke = rgbaToPaint(style?.border?.color);
  if (stroke && (style?.border?.topWidth || 0) > 0) {
    node.strokes = [stroke];
    node.strokeWeight = style.border.topWidth || 1;
  }

  if (typeof style?.opacity === 'number') {
    node.opacity = style.opacity;
  }

  applyCornerRadius(node, style);
}

async function ensureFont(style) {
  const familyRaw = style?.fontFamily || 'Arial';
  const family = familyRaw.split(',')[0].replace(/["']/g, '').trim() || 'Arial';
  const weightNum = Number(style?.fontWeight);
  const styleName = weightNum >= 700 ? 'Bold' : 'Regular';

  try {
    await figma.loadFontAsync({ family, style: styleName });
    return { family, style: styleName };
  } catch (_) {
    await figma.loadFontAsync({ family: 'Arial', style: 'Regular' });
    return { family: 'Arial', style: 'Regular' };
  }
}

async function createTextNode(source) {
  const node = figma.createText();
  const fontName = await ensureFont(source.style || {});
  node.fontName = fontName;
  node.characters = source.text || '';
  node.fontSize = source.style?.fontSize || 16;
  const fill = rgbaToPaint(source.style?.color);
  node.fills = fill ? [fill] : [];
  applyBaseGeometry(node, source.rect);
  return node;
}

async function createImageNode(source) {
  const frame = figma.createFrame();
  frame.name = source.name || 'image';
  applyBaseGeometry(frame, source.rect);
  applyFrameStyle(frame, source.style || {});

  const src = source.src;
  if (!src) return frame;

  try {
    const res = await fetch(src);
    const bytes = await res.arrayBuffer();
    const image = figma.createImage(new Uint8Array(bytes));
    frame.fills = [{
      type: 'IMAGE',
      scaleMode: 'FILL',
      imageHash: image.hash,
    }];
  } catch (_) {
    // Leave as frame fallback if image fetch fails.
  }
  return frame;
}

function createFrameNode(source) {
  const node = figma.createFrame();
  node.name = source.name || source.tag || 'frame';
  applyBaseGeometry(node, source.rect);
  applyFrameStyle(node, source.style || {});
  return node;
}

async function createNodeFromSource(source) {
  if (source.type === 'text') return createTextNode(source);
  if (source.type === 'image') return createImageNode(source);
  return createFrameNode(source);
}

async function importHtml2Fig(payload) {
  if (!payload?.root || !Array.isArray(payload?.nodes)) {
    throw new Error('Invalid html2fig payload');
  }

  const pageRoot = figma.createFrame();
  pageRoot.name = payload.root.name || payload.meta?.title || 'Imported HTML';
  applyBaseGeometry(pageRoot, payload.root.rect || { x: 0, y: 0, width: 1200, height: 800 });
  pageRoot.fills = [];
  pageRoot.strokes = [];

  figma.currentPage.appendChild(pageRoot);

  const nodeMap = new Map();
  nodeMap.set('root', pageRoot);

  for (const source of payload.nodes) {
    const node = await createNodeFromSource(source);
    node.name = source.name || source.tag || source.type;
    nodeMap.set(source.id, node);

    const parent = nodeMap.get(source.parentId) || pageRoot;
    if ('appendChild' in parent) {
      parent.appendChild(node);
      if (source.parentId !== 'root' && isFiniteRect(source.rect) && parent !== pageRoot) {
        node.x = source.rect.x - (parent.x || 0);
        node.y = source.rect.y - (parent.y || 0);
      }
    } else {
      pageRoot.appendChild(node);
    }
  }

  figma.viewport.scrollAndZoomIntoView([pageRoot]);
  figma.currentPage.selection = [pageRoot];
  return pageRoot;
}

figma.ui.onmessage = async (msg) => {
  if (msg.type !== 'import-html2fig') return;

  try {
    const root = await importHtml2Fig(msg.payload);
    figma.ui.postMessage({ type: 'status', message: `Imported: ${root.name}` });
  } catch (error) {
    figma.ui.postMessage({ type: 'status', message: `Import failed: ${error.message}` });
  }
};
