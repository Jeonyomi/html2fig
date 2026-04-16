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

function inferSceneType(payload) {
  const title = payload?.meta?.title || '';
  const nodes = Array.isArray(payload?.nodes) ? payload.nodes : [];
  const slideLikeCount = nodes.filter((node) => node.exportHints?.likelySlide).length;
  const cardLikeCount = nodes.filter((node) => node.exportHints?.likelyCard).length;
  if (/deck|slide/i.test(title) || slideLikeCount > 0) return 'slides';
  if (cardLikeCount > 3) return 'cards';
  return 'page';
}

function toFigmaLayoutMode(layoutMode) {
  if (layoutMode === 'VERTICAL') return 'VERTICAL';
  if (layoutMode === 'HORIZONTAL') return 'HORIZONTAL';
  return null;
}

function applyAutoLayoutHints(node, source) {
  const hints = source?.exportHints;
  if (!hints || !('layoutMode' in node)) return;
  const layoutMode = toFigmaLayoutMode(hints.layoutMode);
  if (!layoutMode) return;
  try {
    node.layoutMode = layoutMode;
    node.primaryAxisSizingMode = 'FIXED';
    node.counterAxisSizingMode = 'FIXED';
    node.itemSpacing = Math.max(0, Math.round(hints.gap || 0));
    node.paddingTop = Math.round(hints.padding?.top || 0);
    node.paddingRight = Math.round(hints.padding?.right || 0);
    node.paddingBottom = Math.round(hints.padding?.bottom || 0);
    node.paddingLeft = Math.round(hints.padding?.left || 0);
  } catch (_) {}
}

function isFiniteRect(rect) {
  return rect && [rect.x, rect.y, rect.width, rect.height].every((n) => Number.isFinite(n));
}

function hasVisiblePaint(style) {
  return !!(style?.backgroundColor || style?.backgroundImage || ((style?.border?.topWidth || 0) > 0 && style?.border?.color));
}

function isWrapperLike(source) {
  if (!source || source.type !== 'frame') return false;
  const tag = source.tag || '';
  const hasVisual = hasVisiblePaint(source.style);
  const named = !!(source.name && source.name !== tag && source.name !== 'frame');
  if (hasVisual) return false;
  if (tag === 'body' || tag === 'section' || tag === 'main') return false;
  if (named && source.name.length > 2) return false;
  return true;
}

function resizeIfPossible(node, rect) {
  if (!('resize' in node) || !isFiniteRect(rect)) return;
  if (rect.width > 0 && rect.height > 0) {
    node.resize(Math.max(1, rect.width), Math.max(1, rect.height));
  }
}

function setAbsoluteGeometry(node, rect) {
  if (!isFiniteRect(rect)) return;
  resizeIfPossible(node, rect);
  node.x = rect.x;
  node.y = rect.y;
}

function setRelativeGeometry(node, rect, parentRect) {
  if (!isFiniteRect(rect)) return;
  resizeIfPossible(node, rect);
  if (isFiniteRect(parentRect)) {
    node.x = rect.x - parentRect.x;
    node.y = rect.y - parentRect.y;
  } else {
    node.x = rect.x;
    node.y = rect.y;
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

function applyTextAlignment(node, style) {
  const align = (style?.textAlign || '').toLowerCase();
  if (align === 'center') node.textAlignHorizontal = 'CENTER';
  else if (align === 'right' || align === 'end') node.textAlignHorizontal = 'RIGHT';
  else if (align === 'justify') node.textAlignHorizontal = 'JUSTIFIED';
  else node.textAlignHorizontal = 'LEFT';
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

async function fetchImagePaint(src) {
  if (!src) return null;
  try {
    const res = await fetch(src);
    const bytes = await res.arrayBuffer();
    const image = figma.createImage(new Uint8Array(bytes));
    return {
      type: 'IMAGE',
      scaleMode: 'FILL',
      imageHash: image.hash,
    };
  } catch (_) {
    return null;
  }
}

async function applyBackgroundImage(node, style) {
  if (!style?.backgroundImage || !('fills' in node)) return false;
  const paint = await fetchImagePaint(style.backgroundImage);
  if (!paint) return false;

  const existing = Array.isArray(node.fills) ? node.fills.filter((fill) => fill.type !== 'SOLID') : [];
  node.fills = [paint, ...existing];
  return true;
}

async function createTextNode(source) {
  const node = figma.createText();
  const fontName = await ensureFont(source.style || {});
  node.fontName = fontName;
  node.characters = source.text || '';
  node.fontSize = source.style?.fontSize || 16;
  const fill = rgbaToPaint(source.style?.color);
  node.fills = fill ? [fill] : [];
  if (source.style?.lineHeight && source.style.lineHeight !== 'normal') {
    const lineHeightPx = Number.parseFloat(source.style.lineHeight);
    if (Number.isFinite(lineHeightPx) && lineHeightPx > 0) {
      node.lineHeight = { unit: 'PIXELS', value: lineHeightPx };
    }
  }
  if (source.style?.letterSpacing) {
    const letterSpacingPx = Number.parseFloat(source.style.letterSpacing);
    if (Number.isFinite(letterSpacingPx)) {
      node.letterSpacing = { unit: 'PIXELS', value: letterSpacingPx };
    }
  }
  applyTextAlignment(node, source.style || {});
  return node;
}

async function createImageNode(source) {
  const frame = figma.createFrame();
  frame.name = source.name || 'image';
  applyFrameStyle(frame, source.style || {});

  const src = source.src;
  if (!src) return frame;

  const paint = await fetchImagePaint(src);
  if (paint) {
    frame.fills = [paint];
  }
  return frame;
}

async function createFrameNode(source) {
  const node = figma.createFrame();
  node.name = source.name || source.tag || 'frame';
  applyFrameStyle(node, source.style || {});
  applyAutoLayoutHints(node, source);
  await applyBackgroundImage(node, source.style || {});
  return node;
}

async function createNodeFromSource(source) {
  if (source.type === 'text') return createTextNode(source);
  if (source.type === 'image') return createImageNode(source);
  return createFrameNode(source);
}

function sortSourcesByDepth(nodes) {
  const idMap = new Map(nodes.map((node) => [node.id, node]));
  const depthMemo = new Map();

  function getDepth(node) {
    if (!node) return 0;
    if (depthMemo.has(node.id)) return depthMemo.get(node.id);
    if (!node.parentId || node.parentId === 'root') {
      depthMemo.set(node.id, 1);
      return 1;
    }
    const parent = idMap.get(node.parentId);
    const depth = getDepth(parent) + 1;
    depthMemo.set(node.id, depth);
    return depth;
  }

  return [...nodes].sort((a, b) => getDepth(a) - getDepth(b));
}

function resolveEffectiveParentId(source, sourceMap) {
  let parentId = source.parentId || 'root';
  while (parentId !== 'root') {
    const parentSource = sourceMap.get(parentId);
    if (!parentSource || !isWrapperLike(parentSource)) break;
    parentId = parentSource.parentId || 'root';
  }
  return parentId;
}

async function importHtml2Fig(payload) {
  if (!payload?.root || !Array.isArray(payload?.nodes)) {
    throw new Error('Invalid html2fig payload');
  }

  const sceneType = inferSceneType(payload);
  const pageRoot = figma.createFrame();
  pageRoot.name = payload.root.name || payload.meta?.title || 'Imported HTML';
  const rootRect = payload.root.rect || { x: 0, y: 0, width: 1200, height: 800 };
  setAbsoluteGeometry(pageRoot, rootRect);
  pageRoot.fills = [];
  pageRoot.strokes = [];

  if (sceneType === 'slides') {
    pageRoot.layoutMode = 'VERTICAL';
    pageRoot.itemSpacing = 80;
    pageRoot.paddingTop = 40;
    pageRoot.paddingRight = 40;
    pageRoot.paddingBottom = 40;
    pageRoot.paddingLeft = 40;
  }

  figma.currentPage.appendChild(pageRoot);

  const sourceMap = new Map(payload.nodes.map((node) => [node.id, node]));
  const nodeMap = new Map();
  const rectMap = new Map();
  nodeMap.set('root', pageRoot);
  rectMap.set('root', rootRect);

  const orderedSources = sortSourcesByDepth(payload.nodes);

  for (const source of orderedSources) {
    if (isWrapperLike(source)) {
      rectMap.set(source.id, source.rect || null);
      continue;
    }

    const node = await createNodeFromSource(source);
    node.name = source.name || source.tag || source.type;
    nodeMap.set(source.id, node);
    rectMap.set(source.id, source.rect || null);

    const effectiveParentId = resolveEffectiveParentId(source, sourceMap);
    const parent = nodeMap.get(effectiveParentId) || pageRoot;
    const parentRect = rectMap.get(effectiveParentId) || rootRect;

    if ('appendChild' in parent) {
      parent.appendChild(node);
      if ('layoutMode' in parent && parent.layoutMode !== 'NONE' && source.type !== 'text') {
        resizeIfPossible(node, source.rect);
      } else {
        setRelativeGeometry(node, source.rect, effectiveParentId === 'root' ? rootRect : parentRect);
      }
    } else {
      pageRoot.appendChild(node);
      setRelativeGeometry(node, source.rect, rootRect);
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
