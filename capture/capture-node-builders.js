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

  const style = window.getComputedStyle(parentEl);
  const text = normalizeText(textNode.textContent);
  return {
    id: crypto.randomUUID(),
    parentId,
    type: 'text',
    name: text.slice(0, 40),
    text,
    rect: rectForNode(rects[0]),
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
