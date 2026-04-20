(() => {
  if (window.html2figLocal) return;

  const { captureCurrentPage } = window.html2figCaptureFlow || {};

  if (!captureCurrentPage) {
    throw new Error('html2figCaptureFlow helpers are not available');
  }




  async function copyCaptureToClipboard(options = {}) {
    const data = captureCurrentPage(options);
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    return data;
  }

  window.html2figLocal = {
    captureCurrentPage,
    copyCaptureToClipboard,
  };
})();
