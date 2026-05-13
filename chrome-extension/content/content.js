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
      <button class="bi-btn bi-btn-upgrade">Upgrade for unlimited access</button>
    `;
    panel.appendChild(body);
    attachClickOutside();
  }
}
