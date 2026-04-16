(() => {
  const TEXT_NODE = 3;
  const IGNORED_TAGS = new Set(['script', 'style', 'noscript', 'template']);

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

  function isVisibleElement(el) {
    if (!(el instanceof Element)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    return true;
  }

  function isMeaningfulText(text) {
    return normalizeText(text).length > 0;
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
      boxShadowTokens: serializeBoxShadow(style.boxShadow),
      textAlign: style.textAlign,
      overflow: style.overflow,
      objectFit: style.objectFit || null,
      zIndex: style.zIndex,
      display: style.display,
      position: style.position,
      gap: px(style.gap || 0),
      justifyContent: style.justifyContent,
      alignItems: style.alignItems,
      fontFamily: style.fontFamily,
      fontSize: px(style.fontSize),
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight,
      letterSpacing: style.letterSpacing,
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

  function serializeBoxShadow(value) {
    if (!value || value === 'none') return [];
    return value.split(/,(?![^()]*\))/).map((entry) => entry.trim()).filter(Boolean);
  }

  function getNodeRole(el, tag) {
    if (tag === 'img') return 'image';
    if (/^(h1|h2|h3|h4|h5|h6)$/.test(tag)) return 'heading';
    if (tag === 'button') return 'button';
    if (tag === 'a') return 'link';
    if (tag === 'li') return 'list-item';
    if (tag === 'ul' || tag === 'ol') return 'list';
    if (tag === 'section' || tag === 'article' || tag === 'main') return 'section';
    if (tag === 'svg') return 'vector';
    return 'frame';
  }

  function estimateLayoutMode(style) {
    if (!style) return 'NONE';
    if (style.display === 'flex') {
      return style.flexDirection && style.flexDirection.startsWith('column') ? 'VERTICAL' : 'HORIZONTAL';
    }
    if (style.display === 'grid') return 'GRID';
    return 'NONE';
  }

  function buildExportHints(el, style, rect) {
    const childElements = Array.from(el.children || []).filter((child) => isVisibleElement(child));
    return {
      layoutMode: estimateLayoutMode(style),
      childCount: childElements.length,
      isTextContainer: childElements.length === 0,
      likelyCard: rect.width > 120 && rect.height > 80 && (style.backgroundColor !== 'rgba(0, 0, 0, 0)' || px(style.borderTopWidth) > 0 || style.boxShadow !== 'none'),
      likelySlide: rect.width >= Math.max(window.innerWidth * 0.6, 800) && rect.height >= Math.max(window.innerHeight * 0.45, 400),
      padding: {
        top: px(style.paddingTop),
        right: px(style.paddingRight),
        bottom: px(style.paddingBottom),
        left: px(style.paddingLeft),
      },
      display: style.display,
      position: style.position,
      gap: px(style.gap || 0),
      justifyContent: style.justifyContent,
      alignItems: style.alignItems,
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

  function buildElementNode(el, parentId) {
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const tag = el.tagName.toLowerCase();
    const absoluteRect = rectForNode(rect);
    const base = {
      id: crypto.randomUUID(),
      parentId,
      type: 'frame',
      role: getNodeRole(el, tag),
      tag,
      name: getElementName(el, tag),
      rect: absoluteRect,
      style: extractCommonStyle(el, style),
      exportHints: buildExportHints(el, style, absoluteRect),
      textContent: normalizeText(el.textContent || ''),
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
      role: 'text',
      name: text.slice(0, 40),
      text,
      rect: rectForNode(rects[0]),
      rects: rects.map(rectForNode),
      exportHints: {
        inline: parentEl.tagName.toLowerCase() === 'span',
        parentTag: parentEl.tagName.toLowerCase(),
      },
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

  function walk(node, parentEl, parentId, out, options) {
    if (node.nodeType === TEXT_NODE) {
      if (!parentEl || !isMeaningfulText(node.textContent)) return;
      const textNode = buildTextNode(node, parentEl, parentId);
      if (textNode) out.push(textNode);
      return;
    }

    if (!(node instanceof Element)) return;
    const tag = node.tagName.toLowerCase();
    if (IGNORED_TAGS.has(tag)) return;
    if (!isVisibleElement(node)) return;
    if (options.selector && !node.closest(options.selector) && node !== options.rootElement) return;

    const current = buildElementNode(node, parentId);
    out.push(current);

    for (const child of Array.from(node.childNodes)) {
      walk(child, node, current.id, out, options);
    }
  }

  function resolveRootElement(selector) {
    if (!selector) return document.body;
    return document.querySelector(selector) || document.body;
  }

  function captureCurrentPage(options = {}) {
    const rootElement = resolveRootElement(options.selector);
    const rootRect = rootElement.getBoundingClientRect();
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
        selection: options.selector || 'body',
        format: 'html2fig-local@0.3',
        exportTarget: options.exportTarget || 'figma-plugin',
      },
      root: {
        id: 'root',
        type: 'frame',
        name: safeName(document.title, 'Page'),
        rect: options.selector
          ? rectForNode(rootRect)
          : {
              x: 0,
              y: 0,
              width: Math.max(document.documentElement.clientWidth, document.body.clientWidth, window.innerWidth),
              height: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
            },
      },
      nodes: [],
    };

    const walkOptions = {
      selector: options.selector || null,
      rootElement,
    };

    const startNodes = options.selector ? [rootElement] : Array.from(document.body.childNodes);
    for (const child of startNodes) {
      walk(child, options.selector ? rootElement.parentElement || document.body : document.body, 'root', root.nodes, walkOptions);
    }

    return root;
  }

  function downloadCapture(filename = 'html2fig-export.json', options = {}) {
    const data = captureCurrentPage(options);
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

  async function copyCaptureToClipboard(options = {}) {
    const data = captureCurrentPage(options);
    const text = JSON.stringify(data, null, 2);
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      throw new Error('Clipboard API unavailable in this browser context');
    }
    await navigator.clipboard.writeText(text);
    return data;
  }

  window.html2figLocal = {
    captureCurrentPage,
    downloadCapture,
    copyCaptureToClipboard,
  };

  console.log('[html2fig-local] Ready. Run html2figLocal.captureCurrentPage(), html2figLocal.downloadCapture(), or html2figLocal.copyCaptureToClipboard(). Optional: pass { selector: "#app" }.');
})();
