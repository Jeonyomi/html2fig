const statusEl = document.getElementById('status');

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab found');
  return tab;
}

async function injectCaptureScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['inject-capture.js'],
  });
}

async function captureViaInjected(tabId, selector) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: async (captureSelector) => {
      if (!window.html2figLocal) {
        throw new Error('html2figLocal is not available on this page');
      }
      const options = captureSelector ? { selector: captureSelector } : {};
      const data = await window.html2figLocal.copyCaptureToClipboard(options);
      return { ok: true, title: data?.meta?.title || document.title };
    },
    args: [selector || null],
  });
  return result;
}

async function runCapture(selector) {
  try {
    statusEl.textContent = 'Preparing capture…';
    const tab = await getCurrentTab();
    await injectCaptureScript(tab.id);
    const result = await captureViaInjected(tab.id, selector);
    statusEl.textContent = `Copied capture for: ${result.title}`;
  } catch (error) {
    statusEl.textContent = `Capture failed: ${error.message}`;
  }
}

document.getElementById('captureBtn').addEventListener('click', () => runCapture(null));
document.getElementById('captureAppBtn').addEventListener('click', () => runCapture('#app'));
