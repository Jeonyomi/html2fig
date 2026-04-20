function px(value) {
  const n = Number.parseFloat(value || '0');
  return Number.isFinite(n) ? n : 0;
}

function normalizeText(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function safeName(value, fallback) {
  const name = normalizeText(value);
  return name || fallback;
}

function colorToFigma(color) {
  if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') return null;
  const m = color.match(/rgba?\(([^)]+)\)/i);
  if (!m) return null;
  const parts = m[1].split(',').map((s) => s.trim());
  const r = Number(parts[0]);
  const g = Number(parts[1]);
  const b = Number(parts[2]);
  const a = parts[3] !== undefined ? Number(parts[3]) : 1;
  if (![r, g, b].every(Number.isFinite)) return null;
  return {
    r: r / 255,
    g: g / 255,
    b: b / 255,
    a: Number.isFinite(a) ? a : 1,
    css: color,
  };
}

function extractBackgroundImage(style) {
  const backgroundImage = style.backgroundImage || '';
  const match = backgroundImage.match(/url\((['"]?)(.*?)\1\)/i);
  return match ? match[2] : null;
}

function extractCommonStyle(el, style) {
  return {
    backgroundColor: colorToFigma(style.backgroundColor),
    backgroundImage: extractBackgroundImage(style),
    color: colorToFigma(style.color),
    borderRadius: {
      topLeft: px(style.borderTopLeftRadius),
      topRight: px(style.borderTopRightRadius),
      bottomRight: px(style.borderBottomRightRadius),
      bottomLeft: px(style.borderBottomLeftRadius),
    },
    border: {
      topWidth: px(style.borderTopWidth),
      rightWidth: px(style.borderRightWidth),
      bottomWidth: px(style.borderBottomWidth),
      leftWidth: px(style.borderLeftWidth),
      color: colorToFigma(style.borderTopColor),
      style: style.borderTopStyle,
    },
    opacity: Number(style.opacity || 1),
    boxShadow: style.boxShadow,
    textAlign: style.textAlign,
    overflow: style.overflow,
    objectFit: style.objectFit || null,
    zIndex: style.zIndex,
  };
}

function rectForNode(rect) {
  return {
    x: Math.round(rect.left + window.scrollX),
    y: Math.round(rect.top + window.scrollY),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

function getElementName(el, tag) {
  return safeName(
    el.getAttribute('data-testid') ||
      el.getAttribute('aria-label') ||
      el.getAttribute('name') ||
      el.id ||
      el.className,
    tag,
  );
}

window.html2figCaptureStyle = {
  px,
  normalizeText,
  safeName,
  colorToFigma,
  extractBackgroundImage,
  extractCommonStyle,
  rectForNode,
  getElementName,
};
