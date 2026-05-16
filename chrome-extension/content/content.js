if (!window.__biInjected) {
  window.__biInjected = true;

  let overlay = null;
  let selectionBox = null;
  let startX = 0, startY = 0;
  let isDragging = false;
  let clickOutsideHandler = null;

  // ── Message Router ──────────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener(message => {
    if (message.type === 'ACTIVATE_SELECTOR') activateRegionSelector();
    if (message.type === 'SHOW_LOADING')      showLoadingPanel();
    if (message.type === 'SHOW_RESULT')       showResultPanel(message.payload);
    if (message.type === 'SHOW_ERROR')        showErrorPanel(message.payload.message);
    if (message.type === 'SHOW_RATE_LIMIT')   showRateLimitPanel();
    if (message.type === 'LOGIN_SUCCESS')     handleLoginSuccess(message.payload);
    if (message.type === 'LOGIN_ERROR')       handleLoginError(message.payload);
  });

  // ── Drag-Select Overlay ──────────────────────────────────────────────────────

  function activateRegionSelector() {
    removePanel();

    overlay = document.createElement('div');
    overlay.id = 'bi-overlay';

    selectionBox = document.createElement('div');
    selectionBox.id = 'bi-selection-box';

    document.body.appendChild(overlay);
    document.body.appendChild(selectionBox);
    document.body.style.overflow = 'hidden';

    overlay.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keydown', onKeyDown);
  }

  function onMouseDown(e) {
    e.preventDefault();
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    selectionBox.style.display = 'block';
    selectionBox.style.left   = startX + 'px';
    selectionBox.style.top    = startY + 'px';
    selectionBox.style.width  = '0px';
    selectionBox.style.height = '0px';
  }

  function onMouseMove(e) {
    if (!isDragging) return;
    const left   = Math.min(startX, e.clientX);
    const top    = Math.min(startY, e.clientY);
    const width  = Math.abs(e.clientX - startX);
    const height = Math.abs(e.clientY - startY);
    selectionBox.style.left   = left   + 'px';
    selectionBox.style.top    = top    + 'px';
    selectionBox.style.width  = width  + 'px';
    selectionBox.style.height = height + 'px';
  }

  function onMouseUp(e) {
    if (!isDragging) return;
    isDragging = false;

    const left   = Math.min(startX, e.clientX);
    const top    = Math.min(startY, e.clientY);
    const width  = Math.abs(e.clientX - startX);
    const height = Math.abs(e.clientY - startY);

    if (width < 10 || height < 10) {
      deactivateSelector();
      return;
    }

    deactivateSelector();
    chrome.runtime.sendMessage({
      type: 'REGION_SELECTED',
      payload: { x: left, y: top, width, height, devicePixelRatio: window.devicePixelRatio || 1 },
    });
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') deactivateSelector();
  }

  function deactivateSelector() {
    isDragging = false;
    overlay?.remove();
    selectionBox?.remove();
    overlay = null;
    selectionBox = null;
    document.body.style.overflow = '';
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('keydown', onKeyDown);
  }

  // ── Panel Helpers ────────────────────────────────────────────────────────────

  function removePanel() {
    document.getElementById('bi-panel')?.remove();
    if (clickOutsideHandler) {
      document.removeEventListener('mousedown', clickOutsideHandler);
      clickOutsideHandler = null;
    }
  }

  function createPanel(headerExtras = '') {
    removePanel();
    const panel = document.createElement('div');
    panel.id = 'bi-panel';
    panel.innerHTML = `
      <div class="bi-header">
        <span class="bi-header-title">📖 Book Identifier</span>
        <div class="bi-header-actions">
          ${headerExtras}
          <button class="bi-btn-icon bi-close" title="Close">✕</button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
    panel.querySelector('.bi-close').addEventListener('click', removePanel);
    return panel;
  }

  function attachClickOutside() {
    if (clickOutsideHandler) return;
    clickOutsideHandler = e => {
      const panel = document.getElementById('bi-panel');
      if (panel && !panel.contains(e.target)) removePanel();
    };
    setTimeout(() => document.addEventListener('mousedown', clickOutsideHandler), 0);
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(str) {
    return String(str ?? '').replace(/"/g, '&quot;');
  }

  function formatCount(n) {
    if (!n && n !== 0) return '';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 10_000)    return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return n.toLocaleString();
  }

  function ratingColor(value, max = 5) {
    const ratio = value / max;
    if (ratio >= 0.8)  return '#4ade80';
    if (ratio >= 0.6)  return '#fbbf24';
    return '#f87171';
  }

  // ── Loading Panel ────────────────────────────────────────────────────────────

  function showLoadingPanel() {
    const panel = createPanel();
    const body = document.createElement('div');
    body.className = 'bi-skeleton-body';
    body.innerHTML = `
      <div class="bi-sk bi-sk-cover"></div>
      <div class="bi-sk-lines">
        <div class="bi-sk bi-sk-title"></div>
        <div class="bi-sk bi-sk-author"></div>
        <div class="bi-sk bi-sk-meta"></div>
        <div class="bi-sk bi-sk-r1"></div>
        <div class="bi-sk bi-sk-r2"></div>
        <div class="bi-sk bi-sk-plot"></div>
      </div>
    `;
    panel.appendChild(body);
    attachClickOutside();
  }

  // ── Result Panel ─────────────────────────────────────────────────────────────

  function showResultPanel(data) {
    const panel = createPanel(`<button class="bi-btn-icon bi-new-search" title="Search again">+</button>`);

    const {
      title = '', author = '', year = '',
      cover_image_url,
      google_rating, google_ratings_count,
      goodreads_rating, goodreads_ratings_count,
      genres = [],
      plot_summary = '',
      reviews_summary,
    } = data;

    // Cover
    const coverHtml = cover_image_url
      ? `<img class="bi-cover" src="${escapeAttr(cover_image_url)}" alt="${escapeAttr(title)}" loading="lazy" onerror="this.outerHTML='<div class=\\'bi-no-cover\\'>No<br>Cover</div>'">`
      : `<div class="bi-no-cover">No<br>Cover</div>`;

    // Meta (year + genres)
    const yearHtml = year ? `<span class="bi-year">${escapeHtml(year)}</span>` : '';
    const genreHtml = (genres || [])
      .slice(0, 3)
      .map(g => `<span class="bi-genre-pill">${escapeHtml(g)}</span>`)
      .join('');
    const metaHtml = (yearHtml || genreHtml)
      ? `<div class="bi-meta">${yearHtml}${genreHtml}</div>`
      : '';

    // Ratings
    let ratingsHtml = '';
    if (goodreads_rating) {
      const color = ratingColor(goodreads_rating, 5);
      const count = goodreads_ratings_count ? formatCount(goodreads_ratings_count) + ' ratings' : '';
      ratingsHtml += `
        <div class="bi-rating-row">
          <span class="bi-star">★</span>
          <span class="bi-rating-value" style="color:${color}">${goodreads_rating.toFixed(2)}</span>
          <span class="bi-rating-max">/ 5</span>
          <span class="bi-rating-source">Goodreads</span>
          ${count ? `<span class="bi-rating-count">${escapeHtml(count)}</span>` : ''}
        </div>`;
    }
    if (google_rating) {
      const color = ratingColor(google_rating, 5);
      const count = google_ratings_count ? formatCount(google_ratings_count) + ' ratings' : '';
      ratingsHtml += `
        <div class="bi-rating-row">
          <span class="bi-star">★</span>
          <span class="bi-rating-value" style="color:${color}">${google_rating.toFixed(1)}</span>
          <span class="bi-rating-max">/ 5</span>
          <span class="bi-rating-source">Google Books</span>
          ${count ? `<span class="bi-rating-count">${escapeHtml(count)}</span>` : ''}
        </div>`;
    }

    // Plot (collapsible)
    const plotHtml = plot_summary
      ? `<details class="bi-plot-details">
          <summary class="bi-plot-summary-label">
            <span class="bi-plot-arrow">▶</span> Plot Summary
          </summary>
          <p class="bi-plot-text">${escapeHtml(plot_summary)}</p>
        </details>`
      : '';

    // Reviews summary (collapsible, only if present)
    const reviewsHtml = reviews_summary
      ? `<details class="bi-plot-details">
          <summary class="bi-plot-summary-label">
            <span class="bi-plot-arrow">▶</span> Reader Reviews
          </summary>
          <p class="bi-plot-text">${escapeHtml(reviews_summary)}</p>
        </details>`
      : '';

    const body = document.createElement('div');
    body.className = 'bi-body';
    body.innerHTML = `
      ${coverHtml}
      <div class="bi-info">
        <h2 class="bi-title">${escapeHtml(title)}</h2>
        ${author ? `<p class="bi-author">${escapeHtml(author)}</p>` : ''}
        ${metaHtml}
        ${ratingsHtml ? `<div class="bi-ratings">${ratingsHtml}</div>` : ''}
        ${plotHtml}
        ${reviewsHtml}
      </div>
    `;
    panel.appendChild(body);

    panel.querySelector('.bi-new-search')?.addEventListener('click', activateRegionSelector);
    appendLoginSection(panel);
    attachClickOutside();
  }

  // ── Error Panel ──────────────────────────────────────────────────────────────

  function showErrorPanel(message) {
    const panel = createPanel();
    const body = document.createElement('div');
    body.className = 'bi-state-body';
    body.innerHTML = `
      <div class="bi-state-icon">⚠️</div>
      <p class="bi-state-message">${escapeHtml(message)}</p>
      <p class="bi-state-hint">Tip: Check the extension options to verify your backend URL.</p>
      <button class="bi-btn bi-retry">Try Again</button>
    `;
    panel.appendChild(body);
    body.querySelector('.bi-retry').addEventListener('click', activateRegionSelector);
    attachClickOutside();
  }

  // ── Rate Limit Panel ─────────────────────────────────────────────────────────

  function showRateLimitPanel() {
    const panel = createPanel();
    const body = document.createElement('div');
    body.className = 'bi-state-body';
    body.innerHTML = `
      <div class="bi-state-icon">🚫</div>
      <p class="bi-state-message">You've reached the free tier limit of 10 lookups today.</p>
      <p class="bi-state-hint">Your limit resets automatically at midnight UTC.</p>
    `;
    panel.appendChild(body);
    appendLoginSection(panel);
    attachClickOutside();
  }

  // ── Inline Login Section ──────────────────────────────────────────────────

  function appendLoginSection(panel) {
    chrome.storage.sync.get(['authToken', 'isPremium'], result => {
      if (result.authToken && result.isPremium) return;

      const footer = document.createElement('div');
      footer.id = 'bi-login-footer';

      if (result.authToken && !result.isPremium) {
        footer.className = 'bi-login-footer bi-login-collapsed';
        footer.innerHTML = `<button class="bi-signin-toggle" id="bi-upgrade-toggle">Upgrade plan</button>`;
        panel.appendChild(footer);
        footer.querySelector('#bi-upgrade-toggle').addEventListener('click', () => showUpgradeCard(footer));
      } else {
        footer.className = 'bi-login-footer bi-login-collapsed';
        footer.innerHTML = `<button class="bi-signin-toggle" id="bi-signin-toggle">Sign In / Sign Up</button>`;
        panel.appendChild(footer);
        footer.querySelector('#bi-signin-toggle').addEventListener('click', () => showLoginForm(footer));
      }
    });
  }

  function showLoginForm(footer) {
    footer.classList.remove('bi-login-collapsed');
    footer.innerHTML = `
      <div class="bi-login-label">Log in to sync your usage across devices</div>
      <button class="bi-google-btn" id="bi-google-btn">
        <svg width="16" height="16" viewBox="0 0 18 18" style="flex-shrink:0">
          <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
          <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
          <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
          <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
        </svg>
        Continue with Google
      </button>
      <div class="bi-or-row"><span>or</span></div>
      <input class="bi-field" type="email" id="bi-login-email" placeholder="Email">
      <input class="bi-field" type="password" id="bi-login-password" placeholder="Password">
      <button class="bi-btn bi-login-submit" id="bi-login-submit">Log in</button>
      <div class="bi-login-status" id="bi-login-status"></div>
    `;

    footer.querySelector('#bi-google-btn').addEventListener('click', () => {
      footer.querySelector('#bi-google-btn').disabled = true;
      footer.querySelector('#bi-login-status').textContent = '';
      chrome.runtime.sendMessage({ type: 'DO_GOOGLE_LOGIN' });
    });

    footer.querySelector('#bi-login-submit').addEventListener('click', () => {
      const email = footer.querySelector('#bi-login-email').value.trim();
      const password = footer.querySelector('#bi-login-password').value;
      if (!email || !password) {
        footer.querySelector('#bi-login-status').textContent = 'Enter email and password.';
        return;
      }
      footer.querySelector('#bi-login-submit').disabled = true;
      footer.querySelector('#bi-login-status').textContent = '';
      chrome.runtime.sendMessage({ type: 'DO_EMAIL_LOGIN', payload: { email, password } });
    });
  }

  function showUpgradeCard(footer) {
    footer.classList.remove('bi-login-collapsed');
    footer.innerHTML = `
      <div class="bi-upgrade-card">
        <div class="bi-upgrade-title">✨ Book Identifier Premium</div>
        <ul class="bi-upgrade-benefits">
          <li>Unlimited daily lookups</li>
          <li>Usage synced across all your devices</li>
          <li>Priority support</li>
        </ul>
        <button class="bi-btn bi-upgrade-cta" id="bi-upgrade-cta">Upgrade to Premium</button>
        <div class="bi-login-status" id="bi-upgrade-status"></div>
      </div>
    `;
    footer.querySelector('#bi-upgrade-cta').addEventListener('click', () => {
      footer.querySelector('#bi-upgrade-status').textContent = 'Coming soon — payment not yet available.';
    });
  }

  function handleLoginSuccess(payload) {
    const footer = document.getElementById('bi-login-footer');
    if (!footer) return;
    if (payload.isPremium) {
      footer.innerHTML = `<div class="bi-login-success">✓ Signed in as ${escapeHtml(payload.email)}</div>`;
    } else {
      footer.className = 'bi-login-footer bi-login-collapsed';
      footer.innerHTML = `
        <div class="bi-login-success" style="margin-bottom:6px">✓ Signed in as ${escapeHtml(payload.email)}</div>
        <button class="bi-signin-toggle" id="bi-upgrade-toggle">Upgrade plan</button>
      `;
      footer.querySelector('#bi-upgrade-toggle').addEventListener('click', () => showUpgradeCard(footer));
    }
  }

  function handleLoginError(payload) {
    const status = document.getElementById('bi-login-status');
    if (status) status.textContent = payload.message || 'Login failed.';
    const btn = document.getElementById('bi-login-submit');
    const googleBtn = document.getElementById('bi-google-btn');
    if (btn) btn.disabled = false;
    if (googleBtn) googleBtn.disabled = false;
  }
}
