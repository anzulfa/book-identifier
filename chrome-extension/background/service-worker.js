importScripts('../config.js');

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

async function getAuthHeaders() {
  return new Promise(resolve => {
    chrome.storage.sync.get(['authToken'], result => {
      if (result.authToken) {
        resolve({ 'Authorization': `Bearer ${result.authToken}` });
      } else {
        getOrCreateDeviceId().then(id => resolve({ 'X-Device-ID': id }));
      }
    });
  });
}

async function handleRegionSelected(region, tabId) {
  chrome.tabs.sendMessage(tabId, { type: 'SHOW_LOADING' });

  try {
    const [authHeaders, backendUrl] = await Promise.all([
      getAuthHeaders(),
      getBackendUrl(),
    ]);

    await sleep(80);
    const screenshotDataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
    const imageBase64 = await cropImage(screenshotDataUrl, region);

    const resp = await fetch(`${backendUrl}/api/lookup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
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
    saveToHistory(data, backendUrl, authHeaders).catch(() => {});
  } catch (err) {
    chrome.tabs.sendMessage(tabId, { type: 'SHOW_ERROR', payload: { message: err.message } });
  }
}

async function saveToHistory(data, backendUrl, authHeaders) {
  if (!authHeaders['Authorization']) return; // only for signed-in users
  await fetch(`${backendUrl}/api/history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({
      title: data.title,
      author: data.author ?? null,
      year: data.year ?? null,
      cover_image_url: data.cover_image_url ?? null,
      goodreads_rating: data.goodreads_rating ?? null,
      google_rating: data.google_rating ?? null,
      genres: data.genres ?? null,
    }),
  });
}

chrome.action.onClicked.addListener(async tab => {
  const tabId = tab.id;
  await chrome.scripting.insertCSS({ target: { tabId }, files: ['content/content.css'] });
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content/content.js'] });
  await sleep(50);
  chrome.tabs.sendMessage(tabId, { type: 'ACTIVATE_SELECTOR' });
});

async function handleGoogleLogin(tabId) {
  try {
    const redirectUri = `https://${chrome.runtime.id}.chromiumapp.org/`;
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'token',
      scope: 'openid email profile',
    });
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

    const responseUrl = await new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, url => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        resolve(url);
      });
    });

    const fragment = new URL(responseUrl).hash.substring(1);
    const accessToken = new URLSearchParams(fragment).get('access_token');
    if (!accessToken) throw new Error('No access token received');

    const backendUrl = await getBackendUrl();
    const resp = await fetch(`${backendUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: accessToken }),
    });
    if (!resp.ok) throw new Error((await resp.json()).detail || 'Google login failed');

    const data = await resp.json();
    await new Promise(resolve => chrome.storage.sync.set({
      authToken: data.access_token,
      userName: data.name || '',
      userEmail: data.email || '',
      userPicture: data.picture || '',
      isPremium: data.is_premium || false,
      usageCount: 0,
    }, resolve));

    chrome.tabs.sendMessage(tabId, { type: 'LOGIN_SUCCESS', payload: { email: data.email, name: data.name, isPremium: data.is_premium || false } });
  } catch (err) {
    chrome.tabs.sendMessage(tabId, { type: 'LOGIN_ERROR', payload: { message: err.message } });
  }
}

async function handleEmailLogin(email, password, tabId) {
  try {
    const backendUrl = await getBackendUrl();
    const resp = await fetch(`${backendUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!resp.ok) throw new Error((await resp.json()).detail || 'Login failed');

    const data = await resp.json();
    await new Promise(resolve => chrome.storage.sync.set({
      authToken: data.access_token,
      userName: data.name || '',
      userEmail: data.email || '',
      userPicture: '',
      isPremium: data.is_premium || false,
      usageCount: 0,
    }, resolve));

    chrome.tabs.sendMessage(tabId, { type: 'LOGIN_SUCCESS', payload: { email: data.email, name: data.name, isPremium: data.is_premium || false } });
  } catch (err) {
    chrome.tabs.sendMessage(tabId, { type: 'LOGIN_ERROR', payload: { message: err.message } });
  }
}

async function handleEmailRegister(email, password, name, tabId) {
  try {
    const backendUrl = await getBackendUrl();
    const resp = await fetch(`${backendUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name: name || undefined }),
    });
    if (!resp.ok) throw new Error((await resp.json()).detail || 'Registration failed');

    const data = await resp.json();
    await new Promise(resolve => chrome.storage.sync.set({
      authToken: data.access_token,
      userName: data.name || '',
      userEmail: data.email || '',
      userPicture: '',
      isPremium: data.is_premium || false,
      usageCount: 0,
    }, resolve));

    chrome.tabs.sendMessage(tabId, { type: 'LOGIN_SUCCESS', payload: { email: data.email, name: data.name, isPremium: data.is_premium || false } });
  } catch (err) {
    chrome.tabs.sendMessage(tabId, { type: 'LOGIN_ERROR', payload: { message: err.message } });
  }
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'REGION_SELECTED' && sender.tab?.id) {
    handleRegionSelected(message.payload, sender.tab.id);
  }
  if (message.type === 'DO_GOOGLE_LOGIN' && sender.tab?.id) {
    handleGoogleLogin(sender.tab.id);
  }
  if (message.type === 'DO_EMAIL_LOGIN' && sender.tab?.id) {
    handleEmailLogin(message.payload.email, message.payload.password, sender.tab.id);
  }
  if (message.type === 'DO_EMAIL_REGISTER' && sender.tab?.id) {
    handleEmailRegister(message.payload.email, message.payload.password, message.payload.name, sender.tab.id);
  }
});
