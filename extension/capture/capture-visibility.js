/**
 * Returns true if `el` lies entirely outside the visible area of any
 * overflow-clipping ancestor.
 *
 * Presentation frameworks (Reveal.js, Swiper, GSAP decks, etc.) keep all
 * slides in the DOM but move the inactive ones off-screen via CSS transforms
 * or absolute positioning inside an overflow:hidden container.  Those slides
 * are not `display:none`, not `visibility:hidden`, have non-zero dimensions —
 * but are invisible because the container clips them.  This function detects
 * that case.
 *
 * @param {Element}  el      Element to test
 * @param {DOMRect}  elRect  Pre-computed getBoundingClientRect() for `el`
 * @returns {boolean} true → element is fully clipped, should be skipped
 */
function isClippedByAncestor(el, elRect) {
  let ancestor = el.parentElement;
  while (ancestor && ancestor !== document.documentElement) {
    const as = window.getComputedStyle(ancestor);
    const ov  = as.overflow;
    const ovX = as.overflowX;
    const ovY = as.overflowY;
    const clips =
      ov === 'hidden' || ov === 'clip' ||
      ovX === 'hidden' || ovX === 'clip' ||
      ovY === 'hidden' || ovY === 'clip';

    if (clips) {
      const aRect = ancestor.getBoundingClientRect();
      // Only apply the check when the clipping ancestor itself has size
      if (aRect.width > 0 && aRect.height > 0) {
        const noOverlapX = elRect.right <= aRect.left || elRect.left >= aRect.right;
        const noOverlapY = elRect.bottom <= aRect.top || elRect.top >= aRect.bottom;
        if (noOverlapX || noOverlapY) return true;
      }
    }

    ancestor = ancestor.parentElement;
  }
  return false;
}

function isVisibleElement(el) {
  if (!(el instanceof Element)) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  // Skip elements that are entirely outside an overflow-clipping container
  // (e.g. off-screen slides in a presentation framework)
  if (isClippedByAncestor(el, rect)) return false;
  return true;
}

function isMeaningfulText(text, normalizeText = (value) => String(value || '').trim()) {
  return normalizeText(text).length > 0;
}

window.html2figCaptureVisibility = {
  isVisibleElement,
  isMeaningfulText,
};
