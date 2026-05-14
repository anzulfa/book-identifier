function showStatus(el, message, isError = false) {
  el.textContent = message;
  el.classList.toggle('error', isError);
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), 3500);
}

// ── Backend URL ──────────────────────────────────────────────────────────────

const urlInput    = document.getElementById('backendUrl');
const saveUrlBtn  = document.getElementById('saveUrl');
const urlStatus   = document.getElementById('urlStatus');

chrome.storage.sync.get(['backendUrl'], result => {
  urlInput.value = result.backendUrl || DEFAULT_BACKEND_URL;
});

saveUrlBtn.addEventListener('click', () => {
  const url = urlInput.value.trim().replace(/\/$/, '');
  if (!url) {
    showStatus(urlStatus, 'Please enter a valid URL.', true);
    return;
  }
  chrome.storage.sync.set({ backendUrl: url }, () => {
    showStatus(urlStatus, 'Saved.');
  });
});

// ── Device ID / Usage Reset ──────────────────────────────────────────────────

const deviceIdDisplay = document.getElementById('deviceIdDisplay');
const resetBtn        = document.getElementById('resetStats');
const resetStatus     = document.getElementById('resetStatus');

function loadDeviceId() {
  chrome.storage.local.get(['deviceId'], result => {
    if (result.deviceId) {
      deviceIdDisplay.textContent = 'Current ID: ' + result.deviceId;
    } else {
      deviceIdDisplay.textContent = 'No ID yet — will be created on first lookup.';
    }
  });
}

loadDeviceId();

resetBtn.addEventListener('click', () => {
  chrome.storage.local.remove(['deviceId'], () => {
    deviceIdDisplay.textContent = 'No ID yet — will be created on first lookup.';
    showStatus(resetStatus, 'Device ID reset. A new ID will be generated on next lookup.');
  });
});
