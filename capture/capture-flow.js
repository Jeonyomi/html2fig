function walk(node, parentEl, parentId, out, options) {
  const visibilityHelpers = window.html2figCaptureVisibility || {};
  const styleHelpers = window.html2figCaptureStyle || {};
  const nodeBuilders = window.html2figCaptureNodeBuilders || {};
  const { isVisibleElement, isMeaningfulText } = visibilityHelpers;
  const { normalizeText } = styleHelpers;
  const { buildElementNode, buildTextNode } = nodeBuilders;

  if (!isVisibleElement || !isMeaningfulText || !normalizeText) {
    throw new Error('html2fig capture helpers are not available for walk()');
  }
  if (!buildElementNode || !buildTextNode) {
    throw new Error('html2fig capture node builders are not available for walk()');
  }

  const TEXT_NODE = 3;
  const IGNORED_TAGS = new Set(['script', 'style', 'noscript', 'template']);

  if (node.nodeType === TEXT_NODE) {
    if (!parentEl || !isMeaningfulText(node.textContent, normalizeText)) return;
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
  const styleHelpers = window.html2figCaptureStyle || {};
  const { safeName, rectForNode } = styleHelpers;
  if (!safeName || !rectForNode) {
    throw new Error('html2figCaptureStyle helpers are not available for captureCurrentPage()');
  }

  const rootElement = resolveRootElement(options.selector);
  const rootRect = rootElement.getBoundingClientRect();
  const bodyRect = document.body.getBoundingClientRect();
  const root = {
    version: '1',
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
      format: 'html2fig-local@0.2',
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

window.html2figCaptureFlow = {
  walk,
  resolveRootElement,
  captureCurrentPage,
};
