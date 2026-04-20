function isVisibleElement(el) {
  if (!(el instanceof Element)) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  return true;
}

function isMeaningfulText(text, normalizeText = (value) => String(value || '').trim()) {
  return normalizeText(text).length > 0;
}

window.html2figCaptureVisibility = {
  isVisibleElement,
  isMeaningfulText,
};
