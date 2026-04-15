(() => {
  const TEXT_NODE = 3;

  function px(value) {
    const n = Number.parseFloat(value || '0');
    return Number.isFinite(n) ? n : 0;
  }

  function isVisibleElement(el) {
    if (!(el instanceof Element)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    return true;
  }

  function isMeaningfulText(text) {
    return !!text && text.replace(/\s+/g, ' ').trim().length > 0;
  }

  function colorToFigma(color) {
    if (!color || color === 'transparent') return null;
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

  function extractCommonStyle(el, style) {
    return {
      backgroundColor: colorToFigma(style.backgroundColor),
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

  function buildElementNode(el, parentId) {
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const tag = el.tagName.toLowerCase();
    const base = {
      id: crypto.randomUUID(),
      parentId,
      type: 'frame',
      tag,
      name: el.getAttribute('data-testid') || el.getAttribute('aria-label') || el.id || el.className || tag,
      rect: rectForNode(rect),
      style: extractCommonStyle(el, style),
      children: [],
    };

    if (tag === 'img') {
      base.type = 'image';
      base.src = el.currentSrc || el.getAttribute('src') || null;
      base.alt = el.getAttribute('alt') || '';
    }

    return base;
  }

  function buildTextNode(textNode, parentEl, parentId) {
    const range = document.createRange();
    range.selectNodeContents(textNode);
    const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
    if (rects.length === 0) return null;

    const firstRect = rects[0];
    const style = window.getComputedStyle(parentEl);
    const text = textNode.textContent.replace(/\s+/g, ' ').trim();
    return {
      id: crypto.randomUUID(),
      parentId,
      type: 'text',
      name: text.slice(0, 40),
      text,
      rect: rectForNode(firstRect),
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

  function walk(node, parentEl, parentId, out) {
    if (node.nodeType === TEXT_NODE) {
      if (!parentEl || !isMeaningfulText(node.textContent)) return;
      const textNode = buildTextNode(node, parentEl, parentId);
      if (textNode) out.push(textNode);
      return;
    }

    if (!(node instanceof Element)) return;
    if (!isVisibleElement(node)) return;

    const current = buildElementNode(node, parentId);
    out.push(current);

    for (const child of Array.from(node.childNodes)) {
      walk(child, node, current.id, out);
    }
  }

  function captureCurrentPage() {
    const bodyRect = document.body.getBoundingClientRect();
    const root = {
      meta: {
        title: document.title,
        url: location.href,
        capturedAt: new Date().toISOString(),
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        page: {
          width: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth, Math.round(bodyRect.width)),
          height: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
        },
        format: 'html2fig-local@0.1',
      },
      root: {
        id: 'root',
        type: 'frame',
        name: document.title || 'Page',
        rect: {
          x: 0,
          y: 0,
          width: Math.max(document.documentElement.clientWidth, document.body.clientWidth, window.innerWidth),
          height: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
        },
      },
      nodes: [],
    };

    for (const child of Array.from(document.body.childNodes)) {
      walk(child, document.body, 'root', root.nodes);
    }

    return root;
  }

  function downloadCapture(filename = 'html2fig-export.json') {
    const data = captureCurrentPage();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return data;
  }

  window.html2figLocal = {
    captureCurrentPage,
    downloadCapture,
  };

  console.log('[html2fig-local] Ready. Run html2figLocal.captureCurrentPage() or html2figLocal.downloadCapture().');
})();
