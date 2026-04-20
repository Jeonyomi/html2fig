(() => {
  const { captureCurrentPage } = window.html2figCaptureFlow || {};

  if (!captureCurrentPage) {
    throw new Error('html2figCaptureFlow helpers are not available');
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
