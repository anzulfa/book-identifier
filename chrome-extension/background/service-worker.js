const DEFAULT_BACKEND_URL = 'http://localhost:8000';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getOrCreateDeviceId() {
  return new Promise(resolve => {
    chrome.storage.local.get(['deviceId'], result => {
      if (result.deviceId) {
        resolve(result.deviceId);
      } else {
        const id = crypto.randomUUID();
        chrome.storage.local.set({ deviceId: id }, () => resolve(id));
      }
    });
  });
}

async function getBackendUrl() {
  return new Promise(resolve => {
    chrome.storage.sync.get(['backendUrl'], result => {
      resolve(result.backendUrl || DEFAULT_BACKEND_URL);
    });
  });
}

async function cropImage(dataUrl, { x, y, width, height, devicePixelRatio }) {
  const dpr = devicePixelRatio || 1;
  const sx = Math.round(x * dpr);
  const sy = Math.round(y * dpr);
  const sw = Math.round(width * dpr);
  const sh = Math.round(height * dpr);

  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  const canvas = new OffscreenCanvas(sw, sh);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);

  const croppedBlob = await canvas.convertToBlob({ type: 'image/png' });
  return blobToBase64(croppedBlob);
}

async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return 'data:image/png;base64,' + btoa(binary);
}

async function handleRegionSelected(region, tabId) {
  chrome.tabs.sendMessage(tabId, { type: 'SHOW_LOADING' });

  try {
    const [deviceId, backendUrl] = await Promise.all([
      getOrCreateDeviceId(),
      getBackendUrl(),
    ]);

    await sleep(80);
    const screenshotDataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
    const imageBase64 = await cropImage(screenshotDataUrl, region);

    const resp = await fetch(`${backendUrl}/api/lookup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-ID': deviceId,
      },
      body: JSON.stringify({ image_base64: imageBase64 }),
    });

    if (resp.status === 429) {
      chrome.tabs.sendMessage(tabId, { type: 'SHOW_RATE_LIMIT' });
      return;
    }

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || `Server error ${resp.status}`);
    }

    const data = await resp.json();
    chrome.tabs.sendMessage(tabId, { type: 'SHOW_RESULT', payload: data });
  } catch (err) {
    chrome.tabs.sendMessage(tabId, { type: 'SHOW_ERROR', payload: { message: err.message } });
  }
}

chrome.action.onClicked.addListener(async tab => {
  const tabId = tab.id;
  await chrome.scripting.insertCSS({ target: { tabId }, files: ['content/content.css'] });
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content/content.js'] });
  await sleep(50);
  chrome.tabs.sendMessage(tabId, { type: 'ACTIVATE_SELECTOR' });
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'REGION_SELECTED' && sender.tab?.id) {
    handleRegionSelected(message.payload, sender.tab.id);
  }
});
