function buildElementNode(el, parentId) {
  const styleHelpers = window.html2figCaptureStyle || {};
  const { extractCommonStyle, rectForNode, getElementName } = styleHelpers;
  if (!extractCommonStyle || !rectForNode || !getElementName) {
    throw new Error('html2figCaptureStyle helpers are not available');
  }

  const style = window.getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  const tag = el.tagName.toLowerCase();
  const base = {
    id: crypto.randomUUID(),
    parentId,
    type: 'frame',
    tag,
    name: getElementName(el, tag),
    rect: rectForNode(rect),
    style: extractCommonStyle(el, style),
    children: [],
  };

  if (tag === 'img') {
    base.type = 'image';
    base.src = el.currentSrc || el.getAttribute('src') || null;
    base.alt = el.getAttribute('alt') || '';
  } else if (base.style.backgroundImage) {
    base.backgroundImageNode = {
      type: 'image-ref',
      src: base.style.backgroundImage,
    };
  }

  return base;
}

function buildTextNode(textNode, parentEl, parentId) {
  const styleHelpers = window.html2figCaptureStyle || {};
  const { normalizeText, colorToFigma, rectForNode, px } = styleHelpers;
  if (!normalizeText || !colorToFigma || !rectForNode || !px) {
    throw new Error('html2figCaptureStyle helpers are not available');
  }

  const range = document.createRange();
  range.selectNodeContents(textNode);
  const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
  if (rects.length === 0) return null;

  // Union of all line rects → correct bounding box for multiline text
  const unionRect = rects.reduce((acc, r) => ({
    left:   Math.min(acc.left,   r.left),
    top:    Math.min(acc.top,    r.top),
    right:  Math.max(acc.right,  r.right),
    bottom: Math.max(acc.bottom, r.bottom),
    width:  0,
    height: 0,
  }), { left: rects[0].left, top: rects[0].top, right: rects[0].right, bottom: rects[0].bottom, width: 0, height: 0 });
  unionRect.width  = unionRect.right  - unionRect.left;
  unionRect.height = unionRect.bottom - unionRect.top;

  const style = window.getComputedStyle(parentEl);
  const text = normalizeText(textNode.textContent);
  return {
    id: crypto.randomUUID(),
    parentId,
    type: 'text',
    name: text.slice(0, 40),
    text,
    rect: rectForNode(unionRect),
    rects: rects.map(rectForNode),
    style: {
      color: colorToFigma(style.color),
      fontFamily: style.fontFamily,
      fontSize: px(style.fontSize),
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight,
      letterSpacing: style.letterSpacing,
      textAlign: style.textAlign,
    },
  };
}

window.html2figCaptureNodeBuilders = {
  buildElementNode,
  buildTextNode,
};
