/* Settings side-sheet and theming. Generates a full tonal palette from one seed
   colour per light/dark mode, picks accent text colour by WCAG contrast, handles
   wallpapers (upload/URL/preset) with dominant-colour extraction, custom cursors
   (normalised once into a small PNG so tabs cost nothing), Raindrop CSV/JSON and
   browser bookmark import, backup/restore, and duplicate removal. */
'use strict';

const SettingsRenderer = (() => {
  let activeTab = 'theme';

  const PRESETS = [
    { id: 'pastel-pink',   name: 'Pastel Pink',   group: 'Pastel', mode: 'light', accent: '#f9c8d6', accent2: '#f18fae', radius: null },
    { id: 'pastel-blue',   name: 'Pastel Blue',   group: 'Pastel', mode: 'light', accent: '#bbd6fd', accent2: '#7db0f5', radius: null },
    { id: 'pastel-red',    name: 'Pastel Red',    group: 'Pastel', mode: 'light', accent: '#fdbdbd', accent2: '#f58585', radius: null },
    { id: 'pastel-yellow', name: 'Pastel Yellow', group: 'Pastel', mode: 'light', accent: '#ffed80', accent2: '#f5cf3d', radius: null },
    { id: 'pastel-green',  name: 'Pastel Green',  group: 'Pastel', mode: 'light', accent: '#c7e4c7', accent2: '#8ec98e', radius: null },
    { id: 'pastel-cyan',   name: 'Pastel Cyan',   group: 'Pastel', mode: 'light', accent: '#9cefef', accent2: '#4fd4d4', radius: null },
    { id: 'pastel-orange', name: 'Pastel Orange', group: 'Pastel', mode: 'light', accent: '#ffd8b2', accent2: '#f7ac68', radius: null },
    { id: 'pastel-purple', name: 'Pastel Purple', group: 'Pastel', mode: 'light', accent: '#dac2e8', accent2: '#b48fd0', radius: null },
    { id: 'pastel-silver', name: 'Pastel Silver', group: 'Pastel', mode: 'light', accent: '#c6c6c6', accent2: '#949494', radius: null },

    { id: 'neon',      name: 'Neon',      group: 'Gamer', mode: 'dark', accent: '#22d3ee', accent2: '#ff4655', radius: '0px', mono: true, cls: 'preset-neon' },
    { id: 'synthwave', name: 'Synthwave', group: 'Gamer', mode: 'dark', accent: '#f062ff', accent2: '#31d0ff', radius: '0px', mono: true, cls: 'preset-neon' },
    { id: 'matrix',    name: 'Matrix',    group: 'Gamer', mode: 'dark', accent: '#3ddc84', accent2: '#7bffb0', radius: '0px', mono: true, cls: 'preset-neon' },
    { id: 'amber',     name: 'Amber CRT', group: 'Gamer', mode: 'dark', accent: '#ffb300', accent2: '#ff6f3c', radius: '0px', mono: true, cls: 'preset-neon' }
  ];
  const PRESET_GROUPS = ['Pastel', 'Gamer'];
  const presetById = (id) => PRESETS.find(p => p.id === id) || null;

  const HEX6 = /^#[0-9a-f]{6}$/i;

  function liveVar(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return HEX6.test(v) ? v : fallback;
  }
  /* The colour picker must show what the USER picked, not what the theme
     resolved to. applyTheme may darken --accent-color so it stays visible
     against the page, and reading that back into the picker would silently
     persist the adjusted value -- the accent would drift a little darker every
     time the settings sheet was opened. Stored value wins; the live var is
     only a fallback for themes that never stored one. */
  function effectiveAccent() {
    const s = StorageManager.getSettings();
    if (HEX6.test(s.accentOverride || '')) return s.accentOverride;
    if (HEX6.test(s.accentColor || '')) return s.accentColor;
    return liveVar('--accent-color', '#6366f1');
  }

  async function ensureHostAccess(url) {
    if (!(HAS_EXT && EXT.permissions && EXT.permissions.request)) return false;
    let origin;
    try { origin = new URL(url).origin + '/*'; } catch { return false; }
    try {
      if (await EXT.permissions.contains({ origins: [origin] })) return true;
      return !!(await EXT.permissions.request({ origins: [origin] }));
    } catch { return false; }
  }

  const darkMedia = window.matchMedia('(prefers-color-scheme: dark)');
  const systemDark = () => darkMedia.matches;

  const MAX_WALLPAPERS = 5;
  const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
  const WP_MAX_PX = 2560;

  function rememberWallpaper(wp) {
    const arr = StorageManager.getData().wallpapers;
    const existing = arr.findIndex(w => w.value === wp.value);
    if (existing >= 0) arr.splice(existing, 1);
    arr.push(wp);
    if (arr.length > MAX_WALLPAPERS) arr.splice(0, arr.length - MAX_WALLPAPERS);
  }

  function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error('Could not read that file.'));
      r.readAsDataURL(file);
    });
  }

  function downscaleImage(file) {
    return new Promise((resolve, reject) => {
      let url = null;
      const done = (fn, arg) => { if (url) { URL.revokeObjectURL(url); url = null; } fn(arg); };
      try {
        url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          try {
            const scale = Math.min(1, WP_MAX_PX / Math.max(img.width, img.height));
            const w = Math.max(1, Math.round(img.width * scale));
            const h = Math.max(1, Math.round(img.height * scale));
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            /* WebP for everything: roughly 30% smaller than JPEG at the same
               quality and it keeps transparency, which matters because each
               wallpaper is stored as a data URL inside the storage quota.
               toDataURL silently falls back to PNG if the encoder is missing,
               so check what actually came back rather than assume. */
            let out = canvas.toDataURL('image/webp', 0.85);
            if (!out.startsWith('data:image/webp')) {
              out = canvas.toDataURL('image/jpeg', 0.86);
            }
            done(resolve, out);
          } catch (e) { done(reject, new Error('Could not process that image.')); }
        };
        img.onerror = () => done(reject, new Error('That file is not a readable image.'));
        img.src = url;
      } catch (e) {
        done(reject, new Error('Could not read that file.'));
      }
    });
  }

  /* Fetch a pasted image once and hand it to the same downscale + WebP pipeline
     an upload uses, so a URL wallpaper ends up as local bytes. Returns null on
     any failure so the caller can fall back to keeping the plain URL: pasting a
     link must never just break. Requires host permission, which the caller
     obtains first. */
  const MAX_REMOTE_BYTES = 25 * 1024 * 1024;

  async function localiseImage(url) {
    try {
      const res = await fetch(url, { credentials: 'omit', redirect: 'follow' });
      if (!res.ok) return null;
      const blob = await res.blob();
      if (!/^image\//i.test(blob.type)) return null;
      if (blob.size > MAX_REMOTE_BYTES) return null;
      return await downscaleImage(blob);
    } catch { return null; }
  }

  async function localiseAllRemoteWallpapers() {
    try {
      const data = StorageManager.getData();
      if (!data || !Array.isArray(data.wallpapers)) return;
      for (const wp of data.wallpapers) {
        if (wp.type === 'image' && typeof wp.value === 'string' && /^https?:\/\//i.test(wp.value)) {
          const oldVal = wp.value;
          const local = await localiseImage(oldVal);
          if (local) {
            const stored = await StorageManager.putMedia(uuid(), local);
            wp.value = stored;
            const settings = StorageManager.getSettings();
            if (settings.backgroundValue === oldVal) {
              settings.backgroundValue = stored;
              const photoBg = $('photo-bg');
              if (photoBg) photoBg.style.backgroundImage = `url("${String(local).replace(/"/g, '%22')}")`;
            }
            StorageManager.save();
            StorageManager.pruneMedia();
          }
        }
      }
    } catch {}
  }

  function init() {
    initSideSheet();
    setTimeout(localiseAllRemoteWallpapers, 200);

    darkMedia.addEventListener('change', () => {
      const s = StorageManager.getSettings();
      if (s.mode === 'system') {
        const hasCustomBg = ['image', 'video'].includes(s.backgroundType);
        if (!hasCustomBg) { applySeed(systemDark() ? '#0e1014' : '#f6f7fb'); s.mode = 'system'; StorageManager.save(); }
        applyTheme();
      }
    });
  }

  function initSideSheet() {
    const overlay = $('sidesheetOverlay');
    const closeBtn = $('sidesheetCloseBtn');
    const topBtn = $('topSettingsBtn');
    const tabBtns = $$('.et-set-tab');

    if (topBtn) topBtn.addEventListener('click', () => openSideSheet(null));
    if (closeBtn) closeBtn.addEventListener('click', closeSideSheet);

    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeSideSheet();
      });
      overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Tab' && overlay.classList.contains('open')) trapFocus(e, overlay);
      });
    }

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeTab = btn.dataset.tab;
        const settings = StorageManager.getSettings();
        settings.lastSettingsTab = activeTab;
        StorageManager.saveSettings();
        renderSideSheetContent();
      });
    });
  }

  let sheetReturnFocus = null;

  function openSideSheet(tab = null, section = null) {
    const overlay = $('sidesheetOverlay');
    const topBtn = $('topSettingsBtn');
    if (!overlay) return;

    sheetReturnFocus = document.activeElement;
    const settings = StorageManager.getSettings();
    activeTab = (tab && ['theme', 'widgets', 'data', 'help'].includes(tab)) ? tab : (settings.lastSettingsTab || 'theme');
    settings.lastSettingsTab = activeTab;
    StorageManager.saveSettings();

    $$('.et-set-tab').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === activeTab);
    });

    renderSideSheetContent();
    overlay.classList.add('open');
    if (topBtn) topBtn.classList.add('is-active');

    if (section === 'wallpaper') {
      $('themeWpToggle')?.closest('.st-card')?.scrollIntoView({ block: 'center' });
    }
    ($('sidesheetCloseBtn') || overlay).focus?.();
  }

  function closeSideSheet() {
    const overlay = $('sidesheetOverlay');
    const topBtn = $('topSettingsBtn');
    if (overlay) overlay.classList.remove('open');
    if (topBtn) topBtn.classList.remove('is-active');
    if (sheetReturnFocus && document.contains(sheetReturnFocus)) sheetReturnFocus.focus();
    sheetReturnFocus = null;
    const body = $('sidesheetBody');
    if (body) body.innerHTML = '';
  }

  function renderSideSheetContent() {
    const body = $('sidesheetBody');
    if (!body) return;

    const savedScrollTop = body.scrollTop;
    const settings = StorageManager.getSettings();
    const data = StorageManager.getData();

    if (activeTab === 'theme') {
      const isSolidMode = settings.backgroundType === 'solid' || !settings.backgroundType;

      const activePreset = settings.preset || '';
      const activeName = presetById(activePreset)?.name || 'Default';

      const presetBtn = (p) => {
        const full = p ? p.name : 'Default';
        const short = p ? full.replace(new RegExp('^' + p.group + ' '), '') : full;
        return `
        <button class="preset-btn ${activePreset === (p ? p.id : '') ? 'selected' : ''}"
                data-preset="${p ? p.id : ''}" aria-pressed="${activePreset === (p ? p.id : '')}"
                title="${escapeHtml(full)}">
          <span class="preset-dots">
            <i style="background:${p ? p.accent : 'var(--accent-color)'}"></i>
          </span>
          <span class="preset-name">${escapeHtml(short)}</span>
        </button>`;
      };

      let html = `
        <div class="st-container">
          <div class="st-group-title">Preset <span class="st-group-note">${escapeHtml(activeName)}</span></div>
          <div class="st-card">
            <div class="preset-sub">Default</div>
            <div class="preset-grid">${presetBtn(null)}</div>
            ${PRESET_GROUPS.map(g => `
              <div class="preset-sub">${g}</div>
              <div class="preset-grid">
                ${PRESETS.filter(p => p.group === g).map(presetBtn).join('')}
              </div>`).join('')}
          </div>

          <!-- Appearance -->
          <div class="st-group-title">Appearance</div>
          <div class="st-card" style="display:flex; flex-direction:column; gap:12px;">
            <div class="mynt-mode-seg" role="group" aria-label="Colour mode">
              <button class="mynt-seg-btn ${settings.mode === 'light' ? 'active' : ''}" data-mode="light" aria-pressed="${settings.mode === 'light'}">Light</button>
              <button class="mynt-seg-btn ${settings.mode === 'dark' ? 'active' : ''}" data-mode="dark" aria-pressed="${settings.mode === 'dark'}">Dark</button>
              <button class="mynt-seg-btn ${settings.mode === 'system' ? 'active' : ''}" data-mode="system" aria-pressed="${settings.mode === 'system'}">System</button>
            </div>
            <div class="st-row">
              <label class="st-label" for="myntColorPicker">Base colour</label>
              <input type="color" id="myntColorPicker" class="st-color"
                     value="${/^#[0-9a-f]{6}$/i.test(settings.solidSeed || '') ? settings.solidSeed : (settings.mode === 'light' ? '#c7d2fe' : '#0d1117')}" />
            </div>
            <div class="st-hint">The whole palette, including surfaces, borders and accent, is generated from this one colour.</div>
          </div>

          <div class="st-group-title">Colours &amp; Accents</div>
          <div class="st-card" style="display:flex; flex-direction:column; gap:12px;">
            <div class="st-row">
              <label class="st-label" for="stAccent1Picker">Primary accent</label>
              <input type="color" id="stAccent1Picker" class="st-color" value="${effectiveAccent()}" />
            </div>
            <button id="stAccentResetBtn" class="st-action-btn">Reset accent to the base colour</button>
          </div>

          <div class="st-group-title">Shape &amp; Type</div>
          <div class="st-card" style="display:flex; flex-direction:column; gap:12px;">
            <div class="st-row">
              <label class="st-label" for="stCornerRadius">Corner radius</label>
              ${CustomSelect.render({
                id: 'stCornerRadius',
                value: settings.cornerRadius || 'default',
                options: [
                  { value: 'default', label: 'Theme default' },
                  { value: '0px', label: 'Sharp (0px)' },
                  { value: '8px', label: 'Rounded (8px)' },
                  { value: '16px', label: 'Soft (16px)' },
                  { value: '9999px', label: 'Pill' }
                ],
                style: 'width:150px;'
              })}
            </div>
            <div class="st-row">
              <label class="st-label" for="stFontFamily">Font family</label>
              ${CustomSelect.render({
                id: 'stFontFamily',
                value: settings.fontFamily || 'default',
                options: [
                  { value: 'default', label: 'System UI (Default)' },
                  { value: 'sans-serif', label: 'Modern Sans (Inter)' },
                  { value: 'geometric', label: 'Geometric (Outfit)' },
                  { value: 'serif', label: 'Editorial Serif (Georgia)' },
                  { value: 'monospace', label: 'Developer Mono (JetBrains)' },
                  { value: 'rounded', label: 'Rounded Soft (Quicksand)' },
                  { value: 'slab', label: 'Slab Typewriter (Rockwell)' }
                ],
                style: 'width:200px;'
              })}
            </div>
            <div>
              <div class="se-label" style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span>Card opacity</span> <span id="seOpacityVal">${Math.round((settings.boardOpacity ?? 0.08) * 100)}%</span>
              </div>
              <input type="range" class="se-slider" id="seOpacitySlider" aria-label="Card opacity"
                     min="0" max="100" step="1" value="${Math.round((settings.boardOpacity ?? 0.08) * 100)}" style="width:100%;" />
            </div>
          </div>

          <!-- Wallpaper -->
          <div class="st-group-title">Wallpaper</div>
          <div class="st-card" style="display:flex; flex-direction:column; gap:12px;">
            <label class="st-row" style="cursor:pointer; justify-content:flex-start; gap:8px;">
              <input type="checkbox" id="themeWpToggle" ${!isSolidMode ? 'checked' : ''} />
              <span>Use Custom Wallpaper</span>
            </label>
            <div id="themeWpControls" style="display:${!isSolidMode ? 'flex' : 'none'}; flex-direction:column; gap:12px; margin-top:8px;">
              <button class="mynt-wp-upload-btn" id="wpUploadBtn" style="width:100%;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="20" height="20" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <span>+ Upload Photo or Video File</span>
              </button>
              <div style="display:flex; gap:8px;">
                <input type="text" id="wpUrlInp" class="st-input" placeholder="Paste photo or .mp4 URL…" style="flex:1;" />
                <button id="wpUrlApplyBtn" class="st-action-btn primary" style="padding:8px 14px; flex-shrink:0;">Apply URL</button>
              </div>

              <!-- Alignment & Zoom Controls -->
              <div style="display:flex; flex-direction:column; gap:8px; border-top:1px solid var(--border-soft); padding-top:10px;">
                <div class="se-label" style="display:flex; justify-content:space-between;">
                  <span>Wallpaper Zoom</span> <span id="stWpZoomVal">${settings.wallpaperZoom || 100}%</span>
                </div>
                <input type="range" class="se-slider" id="stWpZoom" min="25" max="350" step="5" value="${settings.wallpaperZoom || 100}" style="width:100%;" />

                <div class="se-label" style="display:flex; justify-content:space-between; margin-top:4px;">
                  <span>Horizontal Position (X)</span> <span id="stWpPosXVal">${settings.wallpaperPosX ?? 50}%</span>
                </div>
                <input type="range" class="se-slider" id="stWpPosX" min="-150" max="250" step="1" value="${settings.wallpaperPosX ?? 50}" style="width:100%;" />

                <div class="se-label" style="display:flex; justify-content:space-between; margin-top:4px;">
                  <span>Vertical Position (Y)</span> <span id="stWpPosYVal">${settings.wallpaperPosY ?? 50}%</span>
                </div>
                <input type="range" class="se-slider" id="stWpPosY" min="-150" max="250" step="1" value="${settings.wallpaperPosY ?? 50}" style="width:100%;" />
              </div>

              <!-- Video Sound Control -->
              ${settings.backgroundType === 'video' ? `
              <div style="display:flex; flex-direction:column; gap:8px; border-top:1px solid var(--border-soft); padding-top:10px;">
                <label class="st-row" style="cursor:pointer; justify-content:flex-start; gap:8px;">
                  <input type="checkbox" id="stWpMuteToggle" ${settings.wallpaperMuted !== false ? 'checked' : ''} />
                  <span>Mute Video Audio</span>
                </label>
                <div class="se-label" style="display:flex; justify-content:space-between;">
                  <span>Video Volume</span> <span id="stWpVolumeVal">${Math.round((settings.wallpaperVolume ?? 0.5) * 100)}%</span>
                </div>
                <input type="range" class="se-slider" id="stWpVolume" min="0" max="100" step="5" value="${Math.round((settings.wallpaperVolume ?? 0.5) * 100)}" style="width:100%;" />
              </div>` : ''}

              <!-- Saved Wallpapers Gallery -->
              ${data.wallpapers && data.wallpapers.length ? `
              <div style="border-top:1px solid var(--border-soft); padding-top:10px;">
                <div class="st-label" style="margin-bottom:6px;">Saved Wallpaper Gallery</div>
                <div class="wp-gallery-grid">
                  ${data.wallpapers.map(w => `
                    <div class="wp-gallery-item ${w.value === settings.backgroundValue ? 'active' : ''}" data-wp-val="${escapeHtml(w.value)}" data-wp-type="${w.type}">
                      <div class="wp-gallery-thumb" data-wp-thumb="${escapeHtml(w.value)}" data-wp-thumb-type="${w.type}"></div>
                      <button class="wp-gallery-del" data-wp-del="${escapeHtml(w.value)}" title="Delete wallpaper">&times;</button>
                    </div>
                  `).join('')}
                </div>
              </div>` : ''}
            </div>
          </div>

          <!-- Presets in / out -->
          <div class="st-group-title">Share Preset</div>
          <div class="st-card" style="display:flex; flex-direction:column; gap:10px;">
            <div style="display:flex; gap:8px;">
              <button id="btnExportPresetCode" class="st-action-btn primary" style="flex:1;">Copy preset code</button>
              <button id="btnExportPresetFile" class="st-action-btn" style="flex:1;">Export .json</button>
            </div>
            <div style="display:flex; gap:8px;">
              <input type="text" id="inpImportPresetCode" class="st-input" placeholder="Paste preset code (ESH-…) or JSON" style="flex:1;" />
              <button id="btnImportPresetCode" class="st-action-btn" style="padding:8px 14px; flex-shrink:0;">Apply</button>
            </div>
            <button id="btnImportPresetFileTrigger" class="st-action-btn" style="width:100%;">Upload .json preset file</button>
            <input type="file" id="inpImportPresetFile" accept=".json" aria-label="Preset file" style="display:none;" />
          </div>

        </div>
      `;

      body.innerHTML = html;
      const prev = $('cursorPreview');
      if (prev && typeof settings.cursorUrl === 'string' && settings.cursorUrl.startsWith('data:image/')) {
        prev.style.backgroundImage = `url("${settings.cursorUrl}")`;
      }
      bindThemeEvents();
    } else if (activeTab === 'widgets') {
      const w = settings.widgets || {};
      const enabledEngs = settings.enabledEngines || ['default', 'google', 'duckduckgo', 'bing', 'chatgpt', 'github', 'youtube'];
      body.innerHTML = `
        <div class="st-container">
          <div class="st-group-title">Identity</div>
          <div class="st-card">
            <div class="st-row">
              <label class="st-label" for="stDisplayName">Your name</label>
              <input type="text" id="stDisplayName" class="st-input" maxlength="24"
                     placeholder="Optional" value="${escapeHtml(settings.displayName || '')}" />
            </div>
            <div class="st-hint">Shown in the greeting on Home.</div>
          </div>

          <div class="st-group-title">Show on Home</div>
          <div class="st-card" style="display:flex; flex-direction:column; gap:12px;">
            <div class="st-row">
              <label class="st-label">Clock Widget</label>
              <input type="checkbox" id="wClockToggle" ${w.clock !== false ? 'checked' : ''} />
            </div>
            <div class="st-row">
              <label class="st-label">Search Bar</label>
              <input type="checkbox" id="wSearchToggle" ${w.navSearch !== false ? 'checked' : ''} />
            </div>
            <div class="st-row">
              <label class="st-label">Todo List Widget</label>
              <input type="checkbox" id="wTodoToggle" ${w.todo !== false ? 'checked' : ''} />
            </div>
            <div class="st-row">
              <label class="st-label">Google Workspace Launcher</label>
              <input type="checkbox" id="wWorkspaceToggle" ${w.workspace !== false ? 'checked' : ''} />
            </div>
            <div class="st-row">
              <label class="st-label">Weather Widget</label>
              <input type="checkbox" id="wWeatherToggle" ${w.weather ? 'checked' : ''} />
            </div>
            <div class="st-row">
              <label class="st-label">Pinned Links on Home</label>
              <input type="checkbox" id="wPinnedLinksToggle" ${!settings.hidePinnedOnHome ? 'checked' : ''} />
            </div>
            <div class="st-row">
              <label class="st-label" for="stClockPos">Clock Layout Position</label>
              ${CustomSelect.render({
                id: 'stClockPos',
                value: settings.clockPosition || 'auto',
                options: [
                  { value: 'auto', label: 'Auto (Center / Wallpaper Corner)' },
                  { value: 'center', label: 'Centered' },
                  { value: 'corner', label: 'Bottom-Left Corner' }
                ],
                style: 'width:220px;'
              })}
            </div>
          </div>

          <div class="st-group-title">Search Engine &amp; Dropdown Checklist</div>
          <div class="st-card" style="display:flex; flex-direction:column; gap:12px;">
            <div class="st-row">
              <label class="st-label" for="stSearchEngine">Default Search Engine</label>
              ${CustomSelect.render({
                id: 'stSearchEngine',
                value: settings.searchEngine || 'default',
                options: Object.entries(WidgetsRenderer.getEngines()).map(([key, eng]) => ({
                  value: key,
                  label: eng.name
                })),
                style: 'width:180px;'
              })}
            </div>
            <div class="st-hint">Select search engines to include in the search bar dropdown:</div>
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:8px;">
              ${Object.entries(WidgetsRenderer.getEngines()).map(([key, eng]) => `
                <label class="st-row" style="cursor:pointer; justify-content:flex-start; gap:6px;">
                  <input type="checkbox" class="st-eng-chk" data-eng-key="${key}" ${enabledEngs.includes(key) ? 'checked' : ''} />
                  <span>${escapeHtml(eng.name)}</span>
                </label>
              `).join('')}
            </div>
          </div>

          <div class="st-group-title">Weather</div>
          <div class="st-card" style="display:flex; flex-direction:column; gap:10px;">
            <div class="st-row">
              <label class="st-label">City Name</label>
              <input type="text" id="stWeatherCity" class="st-input" value="${escapeHtml(settings.weatherCity || '')}" placeholder="e.g. London" style="width:140px;" />
            </div>
            <div class="st-row">
              <label class="st-label">Temperature Unit</label>
              ${CustomSelect.render({
                id: 'stWeatherUnit',
                value: settings.weatherUnit || 'c',
                options: [
                  { value: 'c', label: 'Celsius (°C)' },
                  { value: 'f', label: 'Fahrenheit (°F)' }
                ],
                style: 'width:140px;'
              })}
            </div>
            <button id="stWeatherApplyBtn" class="st-action-btn primary">Save weather</button>
          </div>
        </div>
      `;

      bindWidgetEvents();
    } else if (activeTab === 'data') {
      body.innerHTML = `
        <div class="st-container">
          <div class="st-group-title">Preferences</div>
          <div class="st-card" style="display:flex; flex-direction:column; gap:10px;">
            <div class="st-row">
              <label class="st-label">Time Format</label>
              ${CustomSelect.render({
                id: 'stTimeFormat',
                value: settings.use12h ? '12' : '24',
                options: [
                  { value: '24', label: '24-Hour' },
                  { value: '12', label: '12-Hour (AM/PM)' }
                ],
                style: 'width:160px;'
              })}
            </div>
            <div>
              <div class="st-row" style="margin-bottom:6px;">
                <span class="st-label">Column width</span>
                <span class="st-val">${settings.boardWidth || 260}px</span>
              </div>
              <input type="range" id="stBoardWidth" min="200" max="560" step="10" value="${settings.boardWidth || 260}" style="width:100%; cursor:pointer;" />
            </div>
          </div>

          <div class="st-group-title">Import</div>
          <div class="st-card" style="display:flex; flex-direction:column; gap:10px;">
            <button id="btnImportBrowser" class="st-action-btn primary">Import Chrome Bookmarks Bar</button>
            <button id="btnRaindropTrigger" class="st-action-btn">Import Raindrop.io (.csv / .json)</button>
            <input type="file" id="btnImportRaindropFile" accept=".csv,.json" style="display:none;" />
          </div>

          <div class="st-group-title">Cleanup</div>
          <div class="st-card" style="display:flex; flex-direction:column; gap:10px;">
            <button id="stDedupeBtn" class="st-action-btn">Find &amp; Remove Duplicate Bookmarks</button>
            <div class="st-hint">Removes links whose URL already exists on another board (keeps the first).</div>
          </div>

          <div class="st-group-title">Privacy</div>
          <div class="st-card">
            <div class="st-row">
              <label class="st-label" for="stRemoteFavicons">Load icons from the web</label>
              <input type="checkbox" id="stRemoteFavicons" ${settings.remoteFavicons ? 'checked' : ''} />
            </div>
            <div class="st-hint">Off by default. When on, sites you bookmark are sent to DuckDuckGo and Google to fetch nicer icons. Your browser's own cached icons are always used first.</div>
          </div>

          <div class="st-group-title">Backup</div>
          <div class="st-card" style="display:flex; flex-direction:column; gap:10px;">
            <button id="stExportBtn" class="st-action-btn">Export Full JSON Backup</button>
            <div>
              <div class="st-hint" style="margin-bottom:6px;">Restore JSON File:</div>
              <input type="file" id="btnImportJsonFile" accept=".json" />
            </div>
          </div>

          <div class="st-group-title">Reset &amp; Data Wipe</div>
          <div class="st-card" style="display:flex; flex-direction:column; gap:12px; border:1px solid color-mix(in srgb, #ef4444 30%, var(--border-soft));">
            <div>
              <div class="st-label" style="margin-bottom:4px;">Remove All Boards</div>
              <div class="st-hint" style="margin-bottom:8px;">Deletes all bookmark boards and links. Your settings, notes, and wallpapers remain intact.</div>
              <button id="stClearBoardsBtn" class="st-action-btn" style="color:#ef4444; border-color:rgba(239, 68, 68, 0.4);">Clear All Boards</button>
            </div>
            <div style="border-top:1px solid var(--border-soft); padding-top:10px;">
              <div class="st-label" style="margin-bottom:4px;">Factory Reset Extension</div>
              <div class="st-hint" style="margin-bottom:8px;">Completely wipes all boards, notes, focus timers, wallpapers, and resets all settings to defaults.</div>
              <button id="stResetAllBtn" class="st-reset-btn" style="background:#ef4444; color:#ffffff; font-weight:600; width:100%;">Reset Extension Complete</button>
            </div>
          </div>
        </div>
      `;

      bindDataEvents();
    } else if (activeTab === 'help') {
      body.innerHTML = renderHelp();
    }
    CustomSelect.initAll(body);
    hydrateGalleryThumbs(body);
    if (savedScrollTop) body.scrollTop = savedScrollTop;
  }

  /* Wallpapers are stored out of line as "ref:<id>" and the binary lives under a
     separate storage key, so the gallery cannot paint a thumbnail straight from
     the stored value. It used to try, producing url('ref:abc') and a row of
     empty boxes with nothing but a delete button. Resolve each ref first, then
     paint. Video keeps a flat tint because a poster frame would mean decoding
     the whole file just to fill a 64px square. */
  async function hydrateGalleryThumbs(root) {
    const thumbs = root.querySelectorAll('[data-wp-thumb]');
    for (const el of thumbs) {
      const val = el.getAttribute('data-wp-thumb');
      if (el.getAttribute('data-wp-thumb-type') === 'video') {
        el.classList.add('is-video');
        continue;
      }
      try {
        const src = await StorageManager.resolveMedia(val);
        // Only data: and http(s) can reach a CSS url(); anything else is not a
        // paintable image and could otherwise break out of the quoted string.
        if (/^(data:image\/|https?:\/\/)/i.test(src || '')) {
          el.style.backgroundImage = `url("${src.replace(/["\\]/g, '')}")`;
        }
      } catch { /* missing media: leave the empty tile rather than break the panel */ }
    }
  }

  function renderHelp() {
    const item = (title, body, kbd) => `
      <div class="help-item">
        <div class="help-item-head">
          <span class="help-item-title">${title}</span>
          ${kbd ? `<span class="help-kbd">${kbd}</span>` : ''}
        </div>
        <div class="help-item-body">${body}</div>
      </div>`;

    return `
      <div class="st-container">
        <div class="help-intro">
          EshaalTab puts your boards, notes, focus timer and quick save on one page.
          Here is how each part works.
        </div>

        <div class="st-group-title">Save a page from anywhere</div>
        <div class="st-card help-card">
          ${item('Instant save', 'Press the shortcut on any site and the page goes straight into your <b>Inbox</b> board. No popup appears. A green tick flashes on the toolbar icon so you know it saved.', 'Alt+Shift+S')}
          ${item('Right-click save', 'Right-click any page or link and choose <b>Save to EshaalTab</b>.')}
          ${item('Choose board and tags', 'Click the EshaalTab toolbar icon when you want to pick a board and add tags instead of saving straight to the Inbox.')}
          <div class="st-hint">You can rebind the shortcut at any time from <b>chrome://extensions/shortcuts</b>.</div>
        </div>

        <div class="st-group-title">Boards and bookmarks</div>
        <div class="st-card help-card">
          ${item('Add and organise', 'Open the <b>Boards</b> tab, then use <b>+ Add link</b> or <b>+ New board</b>. You can drag boards and links to rearrange them, including from one board to another.')}
          ${item('Pin to Home', 'Right-click any link on a board and choose <b>Pin to Home</b>. You can also click <b>Add pin</b> on the Home screen to create a link and pin it in one step. Home holds up to five pins, and each one opens with a single click.')}
          ${item('Unpin', 'Hover a pinned link on Home and click the small x, or right-click it. Either way you get an undo option.')}
          ${item('Open all in tabs', 'A board menu has <b>Open all in tabs</b>, which reopens every link in that board at once. This is handy for getting back to a saved session.')}
          ${item('Reorder without dragging', 'The same menu has <b>Move up</b> and <b>Move down</b> if you would rather not drag.')}
        </div>

        <div class="st-group-title">Quick search</div>
        <div class="st-card help-card">
          ${item('Open the palette', 'Search your <b>open tabs</b>, <b>bookmarks</b> and <b>history</b> together in one list. Use the arrow keys to move and Enter to open.', 'Ctrl / ⌘ + K')}
          ${item('Slash commands', 'Type <b>/</b> to run a quick action: <b>/focus</b>, <b>/stash</b>, <b>/new</b>, <b>/notes</b>, <b>/mode</b>, <b>/wall</b>, <b>/import</b>, <b>/settings</b>.')}
          ${item('Stash your tabs', '<b>/stash</b> moves every open tab into a new board and closes them, which clears a crowded window in one step.')}
        </div>

        <div class="st-group-title">Focus, notes and tasks</div>
        <div class="st-card help-card">
          ${item('Pomodoro timer', 'Click the timer icon on Home, or type <b>/focus</b>, to start a session. Space starts and pauses it, R resets it, and finished sessions are counted for the day.')}
          ${item('Notes and todos', 'The <b>Notes</b> tab is a scratchpad that saves as you type, and you can export it as a .txt file. The checklist icon on Home opens your todo list, where you can double-click a task to edit it or pin it to keep it at the top.')}
        </div>

        <div class="st-group-title">Make it yours</div>
        <div class="st-card help-card">
          ${item('Themes and wallpaper', 'In <b>Theme</b>, start from a Pastel or Gamer preset, or pick your own base colour and the rest of the palette is built from it. Set <b>Light</b>, <b>Dark</b> or <b>System</b>, then add a wallpaper by upload or URL.')}
          ${item('Accent colours', 'The accent colours buttons, highlights and the tint behind your boards. Reset it any time to follow your base colour again.')}
          ${item('Widgets and weather', 'In <b>Widgets</b>, turn the clock, search bar, todo list, app launcher and weather on or off, and set the city used for the forecast.')}
        </div>

        <div class="st-group-title">Your data</div>
        <div class="st-card help-card">
          ${item('Backup and restore', 'In <b>Data</b> you can export a full JSON backup, restore one, or import from Chrome or Raindrop. <b>Find and remove duplicate bookmarks</b> clears out links you have saved more than once.')}
          ${item('What leaves your browser', 'Your boards, notes and todos stay on your device. There is no account and no server. The new tab page makes no network requests at all unless you switch something on. <b>Load icons from the web</b> is off by default and fetches site icons from Google and DuckDuckGo when enabled. The <b>weather widget</b> is off by default and calls open-meteo.com once you set a city. Nothing else leaves your browser.')}
        </div>
      </div>`;
  }

  function bindThemeEvents() {
    const settings = StorageManager.getSettings();
    const data = StorageManager.getData();
    const fileInput = $('fileInput');

    $$('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        applyPreset(btn.dataset.preset);
        renderSideSheetContent();
        const p = presetById(btn.dataset.preset);
        ToastSystem.success(p ? `${p.name} applied` : 'Preset cleared');
      });
    });

    $$('.mynt-seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        setMode(btn.dataset.mode);
        renderSideSheetContent();
        ToastSystem.success(`${btn.textContent.trim()} mode`);
      });
    });

    $('myntColorPicker')?.addEventListener('input', (e) => {
      settings.solidSeed = e.target.value;
      if (!settings.accentOverride) settings.accentColor = e.target.value;
      StorageManager.saveSettings();
      applyTheme();
      if ($('boardsView')?.classList.contains('active')) BoardRenderer.renderBoards();
    });
    $('myntColorPicker')?.addEventListener('change', () => {
      renderSideSheetContent();
      ToastSystem.success('Base colour applied');
    });

    $('stAccent1Picker')?.addEventListener('input', (e) => {
      settings.accentOverride = e.target.value;
      settings.accentColor = e.target.value;
      StorageManager.saveSettings();
      applyTheme();
      if ($('boardsView')?.classList.contains('active')) BoardRenderer.renderBoards();
    });

    $('stAccentResetBtn')?.addEventListener('click', () => {
      delete settings.accentOverride;
      settings.accent2 = '';
      settings.accentColor = settings.solidSeed || (settings.mode === 'light' ? '#6366f1' : '#818cf8');
      StorageManager.saveSettings();
      applyTheme();
      if ($('boardsView')?.classList.contains('active')) BoardRenderer.renderBoards();
      renderSideSheetContent();
      ToastSystem.info('Accent follows the base colour again');
    });

    $('stCornerRadius')?.addEventListener('change', (e) => {
      settings.cornerRadius = e.target.value;
      StorageManager.saveSettings();
      applyPresetShell();
    });

    $('stFontFamily')?.addEventListener('change', (e) => {
      settings.fontFamily = e.target.value;
      StorageManager.saveSettings();
      applyPresetShell();
    });

    $('seOpacitySlider')?.addEventListener('input', (e) => {
      settings.boardOpacity = parseFloat(e.target.value) / 100;
      $('seOpacityVal').textContent = `${e.target.value}%`;
      StorageManager.saveSettings();
      applyTheme();
    });

    $('btnExportPresetCode')?.addEventListener('click', exportPresetCode);
    $('btnExportPresetFile')?.addEventListener('click', exportPresetFile);

    $('stWpZoom')?.addEventListener('input', (e) => {
      settings.wallpaperZoom = parseInt(e.target.value);
      const valEl = $('stWpZoomVal'); if (valEl) valEl.textContent = `${e.target.value}%`;
      StorageManager.saveSettings();
      applyWallpaperStyle();
    });

    $('stWpPosX')?.addEventListener('input', (e) => {
      settings.wallpaperPosX = parseInt(e.target.value);
      const valEl = $('stWpPosXVal'); if (valEl) valEl.textContent = `${e.target.value}%`;
      StorageManager.saveSettings();
      applyWallpaperStyle();
    });

    $('stWpPosY')?.addEventListener('input', (e) => {
      settings.wallpaperPosY = parseInt(e.target.value);
      const valEl = $('stWpPosYVal'); if (valEl) valEl.textContent = `${e.target.value}%`;
      StorageManager.saveSettings();
      applyWallpaperStyle();
    });

    $('stWpMuteToggle')?.addEventListener('change', (e) => {
      settings.wallpaperMuted = e.target.checked;
      StorageManager.saveSettings();
      applyWallpaperStyle();
    });

    $('stWpVolume')?.addEventListener('input', (e) => {
      settings.wallpaperVolume = parseFloat(e.target.value) / 100;
      const valEl = $('stWpVolumeVal'); if (valEl) valEl.textContent = `${e.target.value}%`;
      StorageManager.saveSettings();
      applyWallpaperStyle();
    });

    $$('.wp-gallery-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.wp-gallery-del')) return;
        const val = item.dataset.wpVal;
        const type = item.dataset.wpType;
        applyWallpaper(type, val);
        renderSideSheetContent();
        ToastSystem.success('Wallpaper switched');
      });
    });

    $$('.wp-gallery-del').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const val = btn.getAttribute('data-wp-del') || btn.dataset.wpDel;
        if (!val) return;
        data.wallpapers = (data.wallpapers || []).filter(w => w.value !== val);
        StorageManager.save();
        if (StorageManager.isMediaRef(val)) {
          await StorageManager.delMedia(StorageManager.refId(val));
        }
        if (settings.backgroundValue === val) {
          const remaining = data.wallpapers && data.wallpapers.length ? data.wallpapers[data.wallpapers.length - 1] : null;
          if (remaining) {
            applyWallpaper(remaining.type, remaining.value);
          } else {
            applyWallpaper('solid', settings.solidSeed || (settings.mode === 'light' ? '#f8fafc' : '#0d1117'));
          }
        }
        renderSideSheetContent();
        ToastSystem.info('Wallpaper removed');
      });
    });

    $('themeWpToggle')?.addEventListener('change', (e) => {
      const controls = $('themeWpControls');
      if (e.target.checked) {
        if (controls) controls.style.display = 'flex';
        if (settings.backgroundType === 'solid' || !settings.backgroundType) {
          const lastImg = data.wallpapers && data.wallpapers.length ? data.wallpapers[data.wallpapers.length - 1] : null;
          if (lastImg) {
            applyWallpaper(lastImg.type, lastImg.value);
          } else {
            settings.backgroundType = 'image';
            StorageManager.save();
          }
        }
      } else {
        if (controls) controls.style.display = 'none';
        const solidBg = settings.solidSeed || (settings.mode === 'light' ? '#f8fafc' : '#0d1117');
        applyWallpaper('solid', solidBg);
        renderSideSheetContent();
        ToastSystem.info('Switched to solid color mode');
      }
    });

    const uploadBtn = $('wpUploadBtn');
    if (uploadBtn && fileInput) {
      uploadBtn.onclick = () => fileInput.click();
      fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;
        const isVideo = file.type.startsWith('video/');
        const type = isVideo ? 'video' : 'image';

        if (isVideo && file.size > MAX_VIDEO_BYTES) {
          ToastSystem.error(`That video is ${(file.size / 1048576).toFixed(0)} MB. The limit is ${MAX_VIDEO_BYTES / 1048576} MB.`);
          return;
        }

        uploadBtn.disabled = true;
        try {
          const dataUrl = isVideo ? await readAsDataUrl(file) : await downscaleImage(file);
          const id = uuid();
          const ref = await StorageManager.putMedia(id, dataUrl);
          rememberWallpaper({ id, type, value: ref, name: file.name });
          settings.backgroundType = type;
          await applyWallpaper(type, ref);
          StorageManager.pruneMedia();
          ToastSystem.success('Wallpaper applied');
          renderSideSheetContent();
        } catch (err) {
          ToastSystem.error(err?.message || 'Could not use that file.');
        } finally {
          uploadBtn.disabled = false;
        }
      };
    }

    const urlBtn = $('wpUrlApplyBtn');
    const urlInp = $('wpUrlInp');
    if (urlBtn && urlInp) {
      urlBtn.onclick = async () => {
        const val = urlInp.value.trim();
        if (!val) { ToastSystem.info('Paste an image or .mp4 URL first.'); return; }
        if (!/^https?:\/\//i.test(val)) { ToastSystem.error('Only http(s) URLs are supported.'); return; }

        const isVideo = /\.(mp4|webm|ogg)(\?|$)/i.test(val);
        const type = isVideo ? 'video' : 'image';

        urlBtn.disabled = true;
        try {
          /* Images pasted by URL are downloaded once and kept on the device.
             Storing the raw URL meant the browser refetched it on EVERY new tab,
             which handed the image host your IP each time and broke the wallpaper
             outright once the link expired (signed CDN links routinely do).
             Videos stay remote: inlining a 50MB file as a data URL is worse than
             the request it would save. */
          let stored = val;
          let name = 'Custom URL';

          if (!isVideo && await ensureHostAccess(val)) {
            const local = await localiseImage(val);
            if (local) {
              stored = await StorageManager.putMedia(uuid(), local);
              name = 'Saved image';
            }
          }

          rememberWallpaper({ id: uuid(), type, value: stored, name });
          settings.backgroundType = type;
          await applyWallpaper(type, stored, false);
          StorageManager.pruneMedia();
          ToastSystem.success(name === 'Saved image'
            ? 'Wallpaper saved to this device'
            : 'Wallpaper applied');
          renderSideSheetContent();

          // Extract from what we already hold, rather than re-requesting the URL.
          autoExtractColor(stored.startsWith('ref:') ? await StorageManager.resolveMedia(stored) : val, isVideo);
        } catch (err) {
          ToastSystem.error(err?.message || 'Could not use that link.');
        } finally {
          urlBtn.disabled = false;
        }
      };
    }

    $('btnImportPresetCode')?.addEventListener('click', () => {
      const val = ($('inpImportPresetCode')?.value || '').trim();
      if (!val) { ToastSystem.info('Paste preset code or JSON string first.'); return; }
      importPresetString(val);
    });

    const fileInp = $('inpImportPresetFile');
    $('btnImportPresetFileTrigger')?.addEventListener('click', () => fileInp?.click());
    if (fileInp) {
      fileInp.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => importPresetString(evt.target.result);
          reader.readAsText(file);
        }
        e.target.value = '';
      };
    }
  }

  function bindWidgetEvents() {
    /* Read the settings object at event time, never at bind time. A reload
       triggered by another surface (popup, service worker, a second new tab)
       swaps the object out from under us, and a captured reference would then
       be a detached orphan: the toggle would appear to work and silently
       revert on the next open. */
    const live = () => StorageManager.getSettings();

    const nameInp = $('stDisplayName');
    if (nameInp) {
      const saveName = () => {
        live().displayName = nameInp.value.trim();
        StorageManager.saveSettings();
        WidgetsRenderer.updateClock(true);
      };
      nameInp.addEventListener('input', saveName);
      nameInp.addEventListener('change', saveName);
    }

    const bindWidgetToggle = (id, key) => {
      $(id)?.addEventListener('change', (e) => {
        live().widgets[key] = e.target.checked;
        StorageManager.save();
        WidgetsRenderer.applyWidgetVisibility();
      });
    };
    bindWidgetToggle('wClockToggle', 'clock');
    bindWidgetToggle('wSearchToggle', 'navSearch');
    bindWidgetToggle('wTodoToggle', 'todo');
    bindWidgetToggle('wWorkspaceToggle', 'workspace');
    bindWidgetToggle('wWeatherToggle', 'weather');

    $('wPinnedLinksToggle')?.addEventListener('change', (e) => {
      const s = live();
      s.hidePinnedOnHome = !e.target.checked;
      StorageManager.save();
      WidgetsRenderer.applyWidgetVisibility();
      HomeRenderer.render();
      ToastSystem.success(s.hidePinnedOnHome ? 'Pinned links hidden on Home' : 'Pinned links visible on Home');
    });
    $('stClockPos')?.addEventListener('change', (e) => {
      live().clockPosition = e.target.value;
      StorageManager.save();
      WidgetsRenderer.applyWidgetVisibility();
      ToastSystem.success(`Clock position updated`);
    });

    $('stSearchEngine')?.addEventListener('change', (e) => {
      live().searchEngine = e.target.value;
      StorageManager.save();
      WidgetsRenderer.initNavSearch();
      ToastSystem.success('Default search engine saved');
    });

    $$('.st-eng-chk').forEach(chk => {
      chk.addEventListener('change', () => {
        const engs = [];
        $$('.st-eng-chk').forEach(c => {
          if (c.checked) engs.push(c.dataset.engKey);
        });
        live().enabledEngines = engs.length ? engs : ['default'];
        StorageManager.saveSettings();
        WidgetsRenderer.initNavSearch();
      });
    });

    $('stWeatherApplyBtn')?.addEventListener('click', () => {
      const s = live();
      s.weatherCity = $('stWeatherCity').value.trim();
      s.weatherUnit = $('stWeatherUnit').value;
      StorageManager.save();
      WidgetsRenderer.initWeather();
      ToastSystem.success('Weather saved');
    });
  }

  function bindDataEvents() {
    const settings = StorageManager.getSettings();

    $('stTimeFormat')?.addEventListener('change', (e) => {
      settings.use12h = e.target.value === '12';
      StorageManager.save();
      WidgetsRenderer.updateClock();
    });

    $('stBoardWidth')?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      settings.boardWidth = val;
      const card = e.target.closest('div');
      const valLabel = card ? card.querySelector('.st-val') : null;
      if (valLabel) valLabel.textContent = `${val}px`;
      document.documentElement.style.setProperty('--board-width', `${val}px`);
      StorageManager.saveSettings();
      BoardRenderer.renderBoards();
    });

    $('btnImportBrowser')?.addEventListener('click', () => {
      if (!(HAS_EXT && EXT.bookmarks)) {
        ToastSystem.error('Bookmark import only works in the installed extension.');
        return;
      }
      showConfirm('Import browser bookmarks',
        'This adds a board for each bookmark folder. Links you already have are skipped. Continue?', () => {
        Promise.resolve(EXT.bookmarks.getTree()).then((tree) => {
          if (!tree || !tree.length) return;
          const rootNodes = tree[0].children || [];
          const existing = new Set();
          BoardManager.getAll().forEach(b => (b.bookmarks || []).forEach(bm =>
            existing.add(String(bm.url || '').trim().toLowerCase().replace(/\/+$/, ''))));

          let count = 0, skipped = 0;
          const walk = (nodes, boardName) => {
            let board = null;
            nodes.forEach(node => {
              if (node.url) {
                const key = String(node.url).trim().toLowerCase().replace(/\/+$/, '');
                if (existing.has(key)) { skipped++; return; }
                existing.add(key);
                if (!board) board = BoardManager.addBoard(boardName || 'Imported');
                if (BookmarkManager.add(board.id, node.title || node.url, node.url, ['imported'])) count++;
              } else if (node.children && node.children.length) {
                walk(node.children, node.title || boardName || 'Imported');
              }
            });
          };
          rootNodes.forEach(folder => walk(folder.children || [], folder.title || 'Imported'));
          StorageManager.saveImmediate();
          BoardRenderer.renderBoards();
          HomeRenderer.renderPinned();
          ToastSystem.success(`Imported ${count} bookmark${count === 1 ? '' : 's'}${skipped ? `, skipped ${skipped} duplicate${skipped === 1 ? '' : 's'}` : ''}.`);
        }).catch(() => ToastSystem.error('Could not read browser bookmarks. Check the extension has bookmark access.'));
      });
    });

    const rdBtn = $('btnRaindropTrigger');
    const rdFile = $('btnImportRaindropFile');
    if (rdBtn && rdFile) {
      rdBtn.onclick = () => rdFile.click();
      rdFile.onchange = (e) => {
        const file = e.target.files[0];
        if (file) parseRaindropFile(file);
        e.target.value = '';
      };
    }

    $('stDedupeBtn')?.addEventListener('click', () => {
      const before = JSON.parse(JSON.stringify(BoardManager.getAll()));
      const removed = removeDuplicateBookmarks();
      if (!removed) { ToastSystem.info('No duplicate bookmarks found.'); return; }
      BoardRenderer.renderBoards();
      HomeRenderer.renderPinned();
      ToastSystem.action(`Removed ${removed} duplicate${removed === 1 ? '' : 's'}`, 'Undo', () => {
        StorageManager.getData().boards = before;
        StorageManager.save();
        BoardRenderer.renderBoards();
        HomeRenderer.renderPinned();
        ToastSystem.info('Duplicates restored');
      });
    });

    $('stRemoteFavicons')?.addEventListener('change', (e) => {
      settings.remoteFavicons = e.target.checked;
      StorageManager.saveSettings();
      BoardRenderer.renderBoards();
      HomeRenderer.renderPinned();
      ToastSystem.info(e.target.checked ? 'Web icons enabled' : 'Web icons off, using your browser cache only');
    });

    $('stExportBtn')?.addEventListener('click', () => {
      StorageManager.exportJSON();
    });

    $('btnImportJsonFile')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      showConfirm('Restore backup',
        `This replaces all current boards, notes, todos and settings with the contents of "${file.name}". Your current data will be exported first as a safety copy. Continue?`, () => {
        StorageManager.exportJSON();
        StorageManager.importJSON(file, (ok) => {
          if (ok) window.location.reload();
          else ToastSystem.error('That file is not an EshaalTab backup. Export a new one from Backup.');
        });
      });
    });

    $('stClearBoardsBtn')?.addEventListener('click', () => {
      showConfirm('Clear All Boards & Bookmarks?',
        'Are you sure you want to remove all bookmark boards and links? Your settings, notes, and wallpapers will stay intact.', () => {
        StorageManager.getData().boards = [];
        StorageManager.saveImmediate();
        BoardRenderer.renderBoards();
        HomeRenderer.renderPinned();
        renderSideSheetContent();
        ToastSystem.success('All boards removed');
      });
    });

    $('stResetAllBtn')?.addEventListener('click', () => {
      showConfirm('Reset Entire Extension?',
        'Are you sure? This will completely wipe all boards, bookmarks, notes, focus timers, wallpapers, and reset all settings to defaults. This action cannot be undone.', () => {
        StorageManager.resetAll();
        window.location.reload();
      });
    });
  }

  function parseCsv(text) {
    const rows = [];
    let row = [], field = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c !== '"') { field += c; continue; }
        if (text[i + 1] === '"') { field += '"'; i++; continue; }
        inQuotes = false;
        continue;
      }
      if (c === '"') { inQuotes = true; continue; }
      if (c === ',') { row.push(field); field = ''; continue; }
      if (c === '\r') continue;
      if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
      field += c;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  const splitTags = (raw) => String(raw || '')
    .split(/[,|]/).map(t => t.trim()).filter(Boolean);

  function normalizeCollectionPath(raw) {
    const parts = String(raw || '')
      .split(/[\/>]|\s+›\s+/)
      .map(p => p.trim())
      .filter(Boolean);
    return parts.length ? parts.join(' / ') : '';
  }

  function folderResolver() {
    const byName = new Map(BoardManager.getAll().map(b => [b.name, b]));
    return (name) => {
      const key = normalizeCollectionPath(name) || 'Raindrop Imports';
      let board = byName.get(key);
      if (!board) { board = BoardManager.addBoard(key); byName.set(key, board); }
      return board;
    };
  }

  function importRaindropCsv(text) {
    const rows = parseCsv(text.replace(/^﻿/, ''));
    if (!rows.length) return 0;

    const header = rows[0].map(h => h.trim().toLowerCase());
    const col = (...names) => {
      for (const n of names) { const i = header.indexOf(n); if (i >= 0) return i; }
      return -1;
    };
    const iUrl = col('url', 'link');
    if (iUrl < 0) return -1;
    const iTitle = col('title', 'name');
    const iFolder = col('folder', 'collection');
    const iTags = col('tags', 'tag');

    const boardFor = folderResolver();
    let count = 0;
    for (let r = 1; r < rows.length; r++) {
      const cells = rows[r];
      const url = (cells[iUrl] || '').trim();
      if (!url || !/^https?:\/\//i.test(url)) continue;
      if (!Array.isArray(cells)) continue;
      const board = boardFor(iFolder >= 0 ? cells[iFolder] : '');
      const title = (iTitle >= 0 && (cells[iTitle] || '').trim()) || url;
      BookmarkManager.add(board.id, title, url, iTags >= 0 ? splitTags(cells[iTags]) : []);
      count++;
    }
    return count;
  }

  function importRaindropJson(text) {
    const json = JSON.parse(text);
    const items = Array.isArray(json) ? json : json.items || [];
    const boardFor = folderResolver();
    let count = 0;
    items.forEach(item => {
      if (!item || !item.url) return;
      const c = item.collection || {};
      const path = (Array.isArray(c.path) ? c.path.join('/') : c.path) ||
                   (c.parent && c.parent.title ? `${c.parent.title}/${c.title || ''}` : '') ||
                   c.title || item.folder;
      const board = boardFor(path);
      const tags = Array.isArray(item.tags) ? item.tags : splitTags(item.tags);
      BookmarkManager.add(board.id, item.title || item.url, item.url, tags);
      count++;
    });
    return count;
  }

  function parseRaindropFile(file) {
    const reader = new FileReader();
    reader.onerror = () => ToastSystem.error('Could not read that file.');
    reader.onload = (e) => {
      const text = String(e.target.result || '');
      const isJson = /\.json$/i.test(file.name) || /^\s*[[{]/.test(text);
      let count;
      try {
        count = isJson ? importRaindropJson(text) : importRaindropCsv(text);
      } catch (err) {
        ToastSystem.error(`Couldn't parse that ${isJson ? 'JSON' : 'CSV'} file.`);
        return;
      }
      if (count === -1) {
        ToastSystem.error('No "url" column found. Export from Raindrop as CSV.');
        return;
      }
      if (!count) {
        ToastSystem.error('No bookmarks found in that file.');
        return;
      }
      StorageManager.saveImmediate();
      BoardRenderer.renderBoards();
      HomeRenderer.renderPinned();
      ToastSystem.success(`Imported ${count} bookmark${count === 1 ? '' : 's'} from Raindrop!`);
    };
    reader.readAsText(file);
  }

  function removeDuplicateBookmarks() {
    const seen = new Set();
    let removed = 0;
    BoardManager.getAll().forEach(b => {
      b.bookmarks = b.bookmarks.filter(bm => {
        const key = String(bm.url || '').trim().toLowerCase().replace(/\/+$/, '');
        if (!key) return true;
        if (seen.has(key)) { removed++; return false; }
        seen.add(key);
        return true;
      });
    });
    if (removed) StorageManager.save();
    return removed;
  }

  function resolveMode() {
    const m = StorageManager.getSettings().mode;
    if (m === 'system') return systemDark() ? 'dark' : 'light';
    return m === 'light' ? 'light' : 'dark';
  }

  function hexToHsl(hex) {
    const { r, g, b } = hexToRgb(hex);
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const mx = Math.max(rn, gn, bn), mn = Math.min(rn, gn, bn);
    let h = 0, s = 0; const l = (mx + mn) / 2;
    const d = mx - mn;
    if (d) {
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0));
      else if (mx === gn) h = (bn - rn) / d + 2;
      else h = (rn - gn) / d + 4;
      h *= 60;
    }
    return { h, s, l };
  }
  function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x]; else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
    const to = v => Math.round((v + m) * 255).toString(16).padStart(2, '0');
    return `#${to(r)}${to(g)}${to(b)}`;
  }

  const MONO_PALETTES = {
    '#f9c8d6': {
      light: { bg: '#f9c8d6', surface: '#ffebf2', accent: '#ec5e78', border: 'transparent' },
      dark:  { bg: '#411b28', surface: '#b24b64', accent: '#f9c8d6', border: 'transparent' }
    },
    '#fecdd3': {
      light: { bg: '#f9c8d6', surface: '#ffebf2', accent: '#ec5e78', border: 'transparent' },
      dark:  { bg: '#411b28', surface: '#b24b64', accent: '#f9c8d6', border: 'transparent' }
    },

    '#bbd6fd': {
      light: { bg: '#bbd6fd', surface: '#e2eeff', accent: '#4382ec', border: 'transparent' },
      dark:  { bg: '#1b3041', surface: '#3569b2', accent: '#bbd6fd', border: 'transparent' }
    },
    '#c7d2fe': {
      light: { bg: '#bbd6fd', surface: '#e2eeff', accent: '#4382ec', border: 'transparent' },
      dark:  { bg: '#1b3041', surface: '#3569b2', accent: '#bbd6fd', border: 'transparent' }
    },

    '#fdbdbd': {
      light: { bg: '#fdbdbd', surface: '#ffe7e7', accent: '#ec4343', border: 'transparent' },
      dark:  { bg: '#411b1b', surface: '#b23535', accent: '#fdbdbd', border: 'transparent' }
    },
    '#fca5a5': {
      light: { bg: '#fdbdbd', surface: '#ffe7e7', accent: '#ec4343', border: 'transparent' },
      dark:  { bg: '#411b1b', surface: '#b23535', accent: '#fdbdbd', border: 'transparent' }
    },

    '#ffed80': {
      light: { bg: '#ffed80', surface: '#fff6c3', accent: '#d1a93d', border: 'transparent' },
      dark:  { bg: '#2f2707', surface: '#ae9502', accent: '#ffed80', border: 'transparent' }
    },
    '#fef08a': {
      light: { bg: '#ffed80', surface: '#fff6c3', accent: '#d1a93d', border: 'transparent' },
      dark:  { bg: '#2f2707', surface: '#ae9502', accent: '#ffed80', border: 'transparent' }
    },

    '#c7e4c7': {
      light: { bg: '#c7e4c7', surface: '#e1f1e1', accent: '#5cba5c', border: 'transparent' },
      dark:  { bg: '#1b411b', surface: '#458245', accent: '#c7e4c7', border: 'transparent' }
    },
    '#a7f3d0': {
      light: { bg: '#c7e4c7', surface: '#e1f1e1', accent: '#5cba5c', border: 'transparent' },
      dark:  { bg: '#1b411b', surface: '#458245', accent: '#c7e4c7', border: 'transparent' }
    },
    '#dcfce7': {
      light: { bg: '#c7e4c7', surface: '#e1f1e1', accent: '#5cba5c', border: 'transparent' },
      dark:  { bg: '#1b411b', surface: '#458245', accent: '#c7e4c7', border: 'transparent' }
    },

    '#9cefef': {
      light: { bg: '#9cefef', surface: '#d5ffff', accent: '#09b2b4', border: 'transparent' },
      dark:  { bg: '#08354b', surface: '#07787f', accent: '#9cefef', border: 'transparent' }
    },
    '#bae6fd': {
      light: { bg: '#9cefef', surface: '#d5ffff', accent: '#09b2b4', border: 'transparent' },
      dark:  { bg: '#08354b', surface: '#07787f', accent: '#9cefef', border: 'transparent' }
    },

    '#ffd8b2': {
      light: { bg: '#ffd8b2', surface: '#ffedd5', accent: '#ec844d', border: 'transparent' },
      dark:  { bg: '#412b1e', surface: '#b26d3e', accent: '#ffd8b2', border: 'transparent' }
    },
    '#fed7aa': {
      light: { bg: '#ffd8b2', surface: '#ffedd5', accent: '#ec844d', border: 'transparent' },
      dark:  { bg: '#412b1e', surface: '#b26d3e', accent: '#ffd8b2', border: 'transparent' }
    },

    '#dac2e8': {
      light: { bg: '#dac2e8', surface: '#e9e2f3', accent: '#9563b5', border: 'transparent' },
      dark:  { bg: '#2d1b3e', surface: '#724b8f', accent: '#dac2e8', border: 'transparent' }
    },
    '#e9d5ff': {
      light: { bg: '#dac2e8', surface: '#e9e2f3', accent: '#9563b5', border: 'transparent' },
      dark:  { bg: '#2d1b3e', surface: '#724b8f', accent: '#dac2e8', border: 'transparent' }
    },

    '#c6c6c6': {
      light: { bg: '#c6c6c6', surface: '#e8e8e8', accent: '#555555', border: 'transparent' },
      dark:  { bg: '#1f1f1f', surface: '#333333', accent: '#c6c6c6', border: 'transparent' }
    }
  };

  function derivePalette(seed, targetMode) {
    const normSeed = (seed || '').toLowerCase();
    const isDark = targetMode === 'dark';

    if (MONO_PALETTES[normSeed]) {
      const p = MONO_PALETTES[normSeed][isDark ? 'dark' : 'light'];
      return {
        light: !isDark,
        bg: p.bg,
        surface: p.surface,
        accent: p.accent,
        onSurface: isDark ? '#f1f5f9' : '#1e293b',
        onDim: isDark ? '#94a3b8' : '#64748b',
        border: p.border
      };
    }

    const { r, g, b } = hexToRgb(seed);
    const chroma = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    const { h } = hexToHsl(seed);
    const tinted = chroma >= 0.05;

    if (!isDark) {
      const accS = tinted ? 0.72 : 0.15;
      const accL = 0.42;
      const bgS = tinted ? 0.35 : 0.04;
      const surfS = tinted ? 0.25 : 0.03;
      const txtS = tinted ? 0.25 : 0.05;

      return {
        light: true,
        bg:        hslToHex(h, bgS, 0.94),
        surface:   hslToHex(h, surfS, 0.985),
        accent:    hslToHex(h, accS, accL),
        onSurface: hslToHex(h, txtS, 0.18),
        onDim:     hslToHex(h, txtS * 0.8, 0.40),
        border:    hslToHex(h, surfS, 0.85)
      };
    } else {
      const accS = tinted ? 0.78 : 0.15;
      const accL = 0.66;
      const bgS = tinted ? 0.35 : 0.05;
      const surfS = tinted ? 0.28 : 0.04;

      return {
        light: false,
        bg:        hslToHex(h, bgS, 0.08),
        surface:   hslToHex(h, surfS, 0.15),
        accent:    hslToHex(h, accS, accL),
        onSurface: '#f1f5f9',
        onDim:     '#94a3b8',
        border:    hslToHex(h, surfS, 0.25)
      };
    }
  }

  function applySeed(seed) {
    const s = StorageManager.getSettings();
    s.solidSeed = seed;

    const isCustomWallpaper = s.backgroundType === 'image' || s.backgroundType === 'video';
    if (!isCustomWallpaper) {
      s.backgroundType = 'solid';
      s.backgroundValue = seed;

      const currentMode = resolveMode();
      const p = derivePalette(seed, currentMode);

      const photoBg = $('photo-bg'), videoBg = $('video-bg');
      if (photoBg) { photoBg.style.backgroundImage = 'none'; photoBg.style.backgroundColor = p.bg; photoBg.classList.add('active'); }
      if (videoBg) { videoBg.pause(); videoBg.classList.remove('active'); }
    }

    StorageManager.saveSettings();
    applyTheme();
  }

  function applyPreset(id) {
    const s = StorageManager.getSettings();
    const p = presetById(id);
    s.preset = p ? id : '';

    delete s.accentOverride;
    if (p) {
      s.mode = p.mode;
      s.modeLocked = true;
      s.solidSeed = p.accent;
      s.accentColor = p.accent;
      s.cornerRadius = 'default';   // let the preset's own radius apply
    }

    StorageManager.save();
    applyPresetShell();
    applyTheme();
  }

  function applyPresetData(p) {
    if (!p || typeof p !== 'object') return false;
    const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
    const s = StorageManager.getSettings();

    if (['light', 'dark', 'system'].includes(p.mode)) { s.mode = p.mode; s.modeLocked = true; }
    if (HEX.test(p.accent || '')) s.accentColor = p.accent;
    if (HEX.test(p.solidSeed || '')) s.solidSeed = p.solidSeed;
    if (['solid', 'image', 'video'].includes(p.backgroundType)) s.backgroundType = p.backgroundType;
    if (typeof p.backgroundValue === 'string' && p.backgroundValue.length < 1000 &&
        (HEX.test(p.backgroundValue) || /^https?:\/\//i.test(p.backgroundValue))) {
      s.backgroundValue = p.backgroundValue;
    }
    if (typeof p.boardOpacity === 'number' && isFinite(p.boardOpacity)) {
      s.boardOpacity = Math.min(1, Math.max(0, p.boardOpacity));
    }
    if (['default', '0px', '8px', '16px', '9999px'].includes(p.cornerRadius)) s.cornerRadius = p.cornerRadius;
    s.preset = presetById(p.id) ? p.id : '';
    delete s.accentOverride;

    StorageManager.saveSettings();
    applyPresetShell();
    applyTheme();
    return true;
  }

  function generatePresetObject() {
    const s = StorageManager.getSettings();
    return {
      v: 1,
      name: 'Custom Preset',
      mode: s.mode,
      accent: s.accentColor,
      solidSeed: s.solidSeed || s.accentColor,
      backgroundType: s.backgroundType || 'solid',
      backgroundValue: (typeof s.backgroundValue === 'string' && /^(#|https?:\/\/)/i.test(s.backgroundValue) && s.backgroundValue.length < 1000) ? s.backgroundValue : '',
      boardOpacity: s.boardOpacity ?? 0.08,
      cornerRadius: s.cornerRadius || 'default'
    };
  }

  function exportPresetCode() {
    const p = generatePresetObject();
    const str = 'ESH-' + btoa(JSON.stringify(p));
    navigator.clipboard.writeText(str).then(() => {
      ToastSystem.success('Preset code copied to clipboard!');
    }).catch(() => {
      ToastSystem.info('Preset code created');
    });
  }

  function exportPresetFile() {
    const p = generatePresetObject();
    const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `eshaaltab-preset-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);   // was leaked on every export
    ToastSystem.success('Preset downloaded!');
  }

  function importPresetString(str) {
    str = (str || '').trim();
    if (!str) return false;
    let jsonStr = str;
    if (str.startsWith('ESH-')) {
      try { jsonStr = atob(str.slice(4)); } catch {}
    }
    try {
      const data = JSON.parse(jsonStr);
      if (applyPresetData(data)) {
        ToastSystem.success('Custom preset applied!');
        renderSideSheetContent();
        return true;
      }
    } catch {
      ToastSystem.error('Invalid preset code or JSON format.');
    }
    return false;
  }

  function applyPresetShell() {
    const settings = StorageManager.getSettings();
    const p = presetById(settings.preset);
    const el = document.documentElement.style;
    PRESETS.forEach(x => x.cls && document.body.classList.remove(x.cls));

    const RADIUS_VARS = ['--r-sm', '--r-md', '--r-lg', '--r-pill'];
    const override = settings.cornerRadius && settings.cornerRadius !== 'default'
      ? settings.cornerRadius
      : (p && p.radius ? p.radius : null);

    if (override === '0px') {
      RADIUS_VARS.forEach(v => el.setProperty(v, '0px'));
      el.setProperty('--radius', '0px');
      el.setProperty('--r-xs', '0px');
      el.setProperty('--r-sm', '0px');
      el.setProperty('--r-md', '0px');
      el.setProperty('--r-lg', '0px');
      el.setProperty('--r-xl', '0px');
      el.setProperty('--r-pill', '0px');
      document.body.classList.add('radius-sharp');
    } else if (override === '9999px') {
      document.body.classList.remove('radius-sharp');
      el.setProperty('--r-xs', '6px');
      el.setProperty('--r-sm', '10px');
      el.setProperty('--r-md', '14px');
      el.setProperty('--r-lg', '16px');
      el.setProperty('--r-xl', '20px');
      el.setProperty('--r-pill', '9999px');
      el.setProperty('--radius', '9999px');
    } else if (override) {
      document.body.classList.remove('radius-sharp');
      RADIUS_VARS.forEach(v => el.setProperty(v, override));
      el.setProperty('--radius', override);
    } else {
      document.body.classList.remove('radius-sharp');
      RADIUS_VARS.forEach(v => el.removeProperty(v));
      el.removeProperty('--radius');
      el.removeProperty('--r-xs');
      el.removeProperty('--r-sm');
      el.removeProperty('--r-md');
      el.removeProperty('--r-lg');
      el.removeProperty('--r-xl');
      el.removeProperty('--r-pill');
    }
    if (p && p.cls) document.body.classList.add(p.cls);

    if (settings.fontFamily === 'sans-serif') {
      document.body.classList.remove('font-handwriting');
      el.setProperty('--font-app', "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif");
    } else if (settings.fontFamily === 'geometric') {
      document.body.classList.remove('font-handwriting');
      el.setProperty('--font-app', "'Outfit', 'Poppins', 'Century Gothic', 'Futura', sans-serif");
    } else if (settings.fontFamily === 'serif') {
      document.body.classList.remove('font-handwriting');
      el.setProperty('--font-app', "Georgia, 'Playfair Display', 'Times New Roman', serif");
    } else if (settings.fontFamily === 'monospace' || (settings.fontFamily === 'default' && p && p.mono)) {
      document.body.classList.remove('font-handwriting');
      el.setProperty('--font-app', "'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Consolas, monospace");
    } else if (settings.fontFamily === 'rounded') {
      document.body.classList.remove('font-handwriting');
      el.setProperty('--font-app', "'Quicksand', 'Nunito', 'Segoe UI Soft', 'Comic Sans MS', sans-serif");
    } else if (settings.fontFamily === 'slab') {
      document.body.classList.remove('font-handwriting');
      el.setProperty('--font-app', "'Rockwell', 'Courier Prime', 'Courier New', serif");
    } else if (settings.fontFamily === 'handwriting') {
      el.setProperty('--font-app', "'Caveat', 'Patrick Hand', 'Comic Sans MS', cursive");
      document.body.classList.add('font-handwriting');
    } else {
      document.body.classList.remove('font-handwriting');
      el.removeProperty('--font-app');
    }
  }

  /* There is one accent now. This still writes --accent-2 so any stored preset
     or stylesheet that references it resolves to the primary instead of a stale
     second colour, which is what made text disappear when both were set alike. */
  function applyAccent2(el, accent1) {
    el.setProperty('--accent-2', accent1);
    el.setProperty('--accent-2-contrast', contrastText(accent1));
    const rgb = hexToRgb(accent1);
    el.setProperty('--accent-2-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
  }

  function applyWallpaperStyle() {
    const settings = StorageManager.getSettings();
    const photoBg = $('photo-bg');
    const videoBg = $('video-bg');
    const zoom = (settings.wallpaperZoom || 100) / 100;
    const posX = settings.wallpaperPosX ?? 50;
    const posY = settings.wallpaperPosY ?? 50;

    if (photoBg) {
      /* cover + transform, never background-size:<n>%. A percentage sizes the
         image against the container WIDTH and lets the height fall where the
         aspect ratio puts it, so any photo that was not exactly the viewport
         ratio got letterboxed with bands of page background above and below.
         cover always fills; the scale on top is what zoom means. */
      photoBg.style.backgroundSize = 'cover';
      photoBg.style.backgroundPosition = `${posX}% ${posY}%`;
      photoBg.style.transform = `scale(${zoom})`;
      photoBg.style.transformOrigin = `${posX}% ${posY}%`;
    }
    if (videoBg) {
      videoBg.style.transform = `scale(${zoom})`;
      videoBg.style.transformOrigin = `${posX}% ${posY}%`;
      videoBg.style.objectPosition = `${posX}% ${posY}%`;
      const shouldMute = settings.wallpaperMuted !== false;
      videoBg.muted = shouldMute;
      if (shouldMute) {
        videoBg.setAttribute('muted', '');
      } else {
        videoBg.removeAttribute('muted');
      }
      videoBg.volume = settings.wallpaperVolume ?? 0.5;
    }
  }

  function applyTheme() {
    const settings = StorageManager.getSettings();
    const el = document.documentElement.style;
    const solid = settings.backgroundType === 'solid' || !settings.backgroundType;

    document.body.classList.toggle('solid-mode', solid);
    document.body.classList.toggle('wallpaper-mode', !solid);

    const activeMode = resolveMode();
    const isLight = activeMode === 'light';
    let solidBgColor = null;

    const opacityVal = typeof settings.boardOpacity === 'number' ? settings.boardOpacity : 0.08;
    el.setProperty('--board-opacity', opacityVal);

    document.documentElement.style.colorScheme = isLight ? 'light' : 'dark';

    if (solid) {
      const seed = settings.solidSeed || (isLight ? '#c7d2fe' : '#0d1117');
      const p = derivePalette(seed, activeMode);

      document.body.classList.toggle('theme-light', isLight);
      document.body.classList.toggle('theme-dark', !isLight);

      const accent = settings.accentOverride || settings.accentColor || p.accent || '#6366f1';

      const photoBg = $('photo-bg');
      if (photoBg) { photoBg.style.backgroundImage = 'none'; photoBg.style.backgroundColor = p.bg; photoBg.classList.add('active'); }
      solidBgColor = p.bg;

      /* A legible accent is left completely alone -- it is the user's choice.
         Presets set solidSeed and accentColor to the same value, so only those
         get adjusted, and then everything painted in the accent (fills, borders,
         the active tab chip, icons) becomes visible at once. */
      const { ui, ink } = accentTokens(accent, p.bg);
      const accRgb = hexToRgb(ui);
      el.setProperty('--accent-color', ui);
      el.setProperty('--accent-ink', ink);
      el.setProperty('--accent-contrast', contrastText(ui));
      applyAccent2(el, ui);
      el.setProperty('--accent-rgb', `${accRgb.r}, ${accRgb.g}, ${accRgb.b}`);

      const sRgb = hexToRgb(p.surface);
      el.setProperty('--board-rgb', `${sRgb.r}, ${sRgb.g}, ${sRgb.b}`);

      const bodyEl = document.body.style;
      bodyEl.setProperty('--board-text', p.onSurface);
      bodyEl.setProperty('--board-text-secondary', p.onDim);
      bodyEl.setProperty('--board-text-dim', p.onDim);
      bodyEl.setProperty('--board-text-hover', p.onSurface);
      bodyEl.setProperty('--board-border', p.border);

    } else {
      document.body.classList.toggle('theme-light', isLight);
      document.body.classList.toggle('theme-dark', !isLight);

      const accent = settings.accentOverride || settings.accentColor || '#6366f1';

      /* Over a wallpaper there is no single page colour to measure, so judge the
         accent against the scrim the UI actually sits on. */
      const { ui, ink } = accentTokens(accent, isLight ? "#ffffff" : "#0d1117");
      const accRgb = hexToRgb(ui);
      el.setProperty('--accent-color', ui);
      el.setProperty('--accent-ink', ink);
      el.setProperty('--accent-contrast', contrastText(ui));
      applyAccent2(el, ui);
      el.setProperty('--accent-rgb', `${accRgb.r}, ${accRgb.g}, ${accRgb.b}`);

      const a = hexToRgb(accent);
      const rgb = isLight
        ? { r: 255, g: 255, b: 255 }
        : { r: Math.round(a.r * 0.45), g: Math.round(a.g * 0.45), b: Math.round(a.b * 0.45) };
      el.setProperty('--board-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);

      const bodyEl = document.body.style;
      ['--board-text', '--board-text-secondary', '--board-text-dim', '--board-text-hover', '--board-border']
        .forEach(v => bodyEl.removeProperty(v));

    }

    applyWallpaperStyle();

    const metaTheme = document.querySelector('meta[name="theme-color"]') || document.createElement('meta');
    metaTheme.name = 'theme-color';
    const topColor = solid ? (solidBgColor || (isLight ? '#ffffff' : '#0d1117')) : (isLight ? '#f8fafc' : '#090a0f');
    metaTheme.content = topColor;
    if (!metaTheme.parentNode) document.head.appendChild(metaTheme);

    const metaMs = document.querySelector('meta[name="msapplication-navbutton-color"]') || document.createElement('meta');
    metaMs.name = 'msapplication-navbutton-color';
    metaMs.content = topColor;
    if (!metaMs.parentNode) document.head.appendChild(metaMs);

    StorageManager.setBootBg(topColor);

  }

  function setMode(mode) {
    const settings = StorageManager.getSettings();
    const m = (mode === 'light' || mode === 'dark' || mode === 'system') ? mode : 'dark';
    settings.mode = m;
    settings.modeLocked = true;
    StorageManager.save();
    applyTheme();
  }

  async function applyWallpaper(type, value, extract = true) {
    const settings = StorageManager.getSettings();
    settings.backgroundType = type;
    settings.backgroundValue = value;

    if (extract && (type === 'image' || type === 'video')) {
      autoExtractColor(await StorageManager.resolveMedia(value), type === 'video');
    }

    if (type === 'image' && typeof value === 'string' && /^https?:\/\//i.test(value)) {
      (async () => {
        try {
          if (await ensureHostAccess(value)) {
            const local = await localiseImage(value);
            if (local) {
              const stored = await StorageManager.putMedia(uuid(), local);
              settings.backgroundValue = stored;
              const data = StorageManager.getData();
              if (Array.isArray(data.wallpapers)) {
                const item = data.wallpapers.find(w => w.value === value);
                if (item) item.value = stored;
              }
              StorageManager.save();
              StorageManager.pruneMedia();
            }
          }
        } catch {}
      })();
    }

    StorageManager.save();

    const videoBg = $('video-bg');
    const photoBg = $('photo-bg');
    const src = await StorageManager.resolveMedia(value);

    if (type === 'video') {
      if (videoBg) {
        videoBg.src = src;
        videoBg.classList.add('active');
        if (!document.hidden) videoBg.play().catch(() => {});
      }
      if (photoBg) photoBg.classList.remove('active');
    } else if (type === 'image') {
      if (photoBg) {
        photoBg.style.backgroundImage = `url("${String(src).replace(/"/g, '%22')}")`;
        photoBg.classList.add('active');
      }
      if (videoBg) { videoBg.pause(); videoBg.removeAttribute('src'); videoBg.classList.remove('active'); }
    } else {
      if (photoBg) {
        photoBg.style.backgroundImage = 'none';
        photoBg.style.backgroundColor = value;
        photoBg.classList.add('active');
      }
      if (videoBg) videoBg.classList.remove('active');
    }

    applyWallpaperStyle();
    applyTheme();
  }

  function dominantColor(data) {
    const buckets = new Map();
    let lr = 0, lg = 0, lb = 0, ln = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (a < 125) continue;
      lr += r; lg += g; lb += b; ln++;
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      let e = buckets.get(key);
      if (!e) { e = { r: 0, g: 0, b: 0, n: 0 }; buckets.set(key, e); }
      e.r += r; e.g += g; e.b += b; e.n++;
    }
    let best = null, bestScore = -1;
    for (const e of buckets.values()) {
      const r = e.r / e.n, g = e.g / e.n, b = e.b / e.n;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const sat = mx === 0 ? 0 : (mx - mn) / mx;
      const lumPen = (lum < 0.06 || lum > 0.96) ? 0.08 : 1;
      const score = e.n * (sat * sat * 3 + 0.05) * lumPen;
      if (score > bestScore) { bestScore = score; best = { r: Math.round(r), g: Math.round(g), b: Math.round(b) }; }
    }
    return { color: best || { r: 100, g: 100, b: 110 }, avgLum: ln ? (0.2126 * lr + 0.7152 * lg + 0.0722 * lb) / (ln * 255) : 0.5 };
  }

  function applyExtracted(data) {
    const { color, avgLum } = dominantColor(data);
    const toHex = c => '#' + ((1 << 24) + (c.r << 16) + (c.g << 8) + c.b).toString(16).slice(1);
    const settings = StorageManager.getSettings();
    if (!settings.accentOverride) settings.accentColor = toHex(color);
    if (settings.mode !== 'system' && !settings.modeLocked) {
      settings.mode = avgLum > 0.5 ? 'light' : 'dark';
    }
    StorageManager.save();
    applyTheme();
  }

  async function autoExtractColor(mediaUrl, isVideo = false) {
    if (!mediaUrl) return;
    try {
      const isVideoFile = isVideo || /\.(mp4|webm|ogg)$/i.test(mediaUrl) || mediaUrl.startsWith('data:video/') || mediaUrl.startsWith('blob:');

      if (isVideoFile) {
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.crossOrigin = 'Anonymous';
        video.src = mediaUrl;

        const processVideoFrame = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = 60; canvas.height = 60;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, 60, 60);

            applyExtracted(ctx.getImageData(0, 0, 60, 60).data);
          } catch (err) {
            console.warn('Video frame extract exception:', err);
          }
        };

        video.onloadeddata = () => {
          try {
            video.currentTime = Math.min(1, (video.duration && !isNaN(video.duration)) ? video.duration / 2 : 0);
          } catch (e) {
            processVideoFrame();
          }
        };
        video.onseeked = processVideoFrame;
        video.onerror = () => console.warn('Video load error for color extraction');
        return;
      }

      let blobUrl = mediaUrl;
      if (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) {
        try {
          const res = await fetch(mediaUrl);
          const blob = await res.blob();
          blobUrl = URL.createObjectURL(blob);
        } catch (err) {
          console.warn('Fetch image blob failed, using direct image src', err);
        }
      }

      const img = new Image();
      if (!blobUrl.startsWith('blob:')) {
        img.crossOrigin = 'Anonymous';
      }

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = 60; canvas.height = 60;
          ctx.drawImage(img, 0, 0, 60, 60);

          applyExtracted(ctx.getImageData(0, 0, 60, 60).data);
          if (blobUrl.startsWith('blob:')) URL.revokeObjectURL(blobUrl);
        } catch (e) {
          console.warn('Canvas extract failed:', e);
        }
      };

      img.onerror = () => console.warn('Image load error for color extraction');
      img.src = blobUrl;
    } catch (e) {
      console.warn('Auto color extraction exception:', e);
    }
  }

  const CURSOR_MAX_PX = 128;
  const CURSOR_MAX_BYTES = 512 * 1024;

  function toCursorDataUrl(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        if (!img.width || !img.height) return reject(new Error('empty image'));
        const scale = Math.min(1, CURSOR_MAX_PX / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);

        try { resolve(canvas.toDataURL('image/png')); }
        catch (e) { reject(e); }
      };
      img.onerror = () => reject(new Error('could not load image'));
      img.src = src;
    });
  }

  async function cursorFromUrl(url) {
    if (!/^https?:\/\//i.test(url)) throw new Error('Only http(s) image URLs are supported.');
    await ensureHostAccess(url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const blob = await res.blob();
    if (!/^image\//.test(blob.type)) throw new Error('That URL is not an image.');
    if (blob.size > CURSOR_MAX_BYTES) throw new Error('Image is larger than 512 KB.');
    const objectUrl = URL.createObjectURL(blob);
    try { return await toCursorDataUrl(objectUrl); }
    finally { URL.revokeObjectURL(objectUrl); }
  }

  function cursorFromFile(file) {
    if (!/^image\//.test(file.type)) return Promise.reject(new Error('That file is not an image.'));
    if (file.size > CURSOR_MAX_BYTES) return Promise.reject(new Error('Image is larger than 512 KB.'));
    const objectUrl = URL.createObjectURL(file);
    return toCursorDataUrl(objectUrl).finally(() => URL.revokeObjectURL(objectUrl));
  }

  function applyCursor() {
    const url = StorageManager.getSettings().cursorUrl;
    const root = document.documentElement.style;
    const ok = typeof url === 'string' && url.startsWith('data:image/');
    if (ok) root.setProperty('--app-cursor', `url("${url}") 0 0, auto`);
    else root.removeProperty('--app-cursor');
    document.body.classList.toggle('has-custom-cursor', ok);
  }

  function setCursor(dataUrl) {
    const s = StorageManager.getSettings();
    s.cursorUrl = dataUrl || '';
    StorageManager.save();
    applyCursor();
  }

  function hexToRgb(hex) {
    let c = (hex || '#ffffff').replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    /* Guard on NaN, never on falsiness. `parseInt('000000',16) || 0xffffff` read
       pure black as 0, took the || branch and returned WHITE, so contrastText saw
       a white accent and paired it with dark ink: black text on a black button. */
    const parsed = parseInt(c, 16);
    const num = Number.isNaN(parsed) ? 0xffffff : parsed;
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }

  function relLuminance(hex) {
    const { r, g, b } = hexToRgb(hex);
    const lin = [r, g, b].map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  }

  function contrastRatio(a, b) {
    const L1 = relLuminance(a), L2 = relLuminance(b);
    return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
  }

  /* Applying a preset sets solidSeed AND accentColor to the same value, so the
     page background and the accent end up identical -- on Pastel Pink both were
     literally #f9c8d6, a contrast ratio of 1.00, which made every icon painted
     in the accent disappear against the page.

     --accent-color still drives fills and borders, where it is paired with
     --accent-contrast and works fine. This derives a separate FOREGROUND colour:
     same hue, lightness walked away from the background until it clears WCAG AA.
     CSS uses var(--accent-ink, var(--accent-color)) so nothing breaks if it is
     ever unset. */
  const INK_MIN_CONTRAST = 4.5;   // WCAG AA for text and icons
  const FILL_MIN_CONTRAST = 2.0;  // enough for a filled chip to read as a shape

  /* Resolves the two accent tokens for a given background:
       ui  -> --accent-color: fills, borders, chips. Only needs to be a visible
              shape against the page, so a mid-tone accent is left untouched.
       ink -> --accent-ink: text, icons, carets. Must clear AA.
     Both are measured against the real page background, so this works the same
     way in light and dark mode -- readableInk walks lightness in whichever
     direction moves away from that background. */
  function accentTokens(accent, bg) {
    /* Always derived from the user's own accent, so the hue is preserved in
       every theme. Substituting the palette's accent was tried and dropped: on
       a near-black seed it comes back a generic grey-blue and turned the default
       indigo theme grey, and the hand-picked preset accents do not clear AA
       against their own backgrounds anyway. */
    const ink = contrastRatio(accent, bg) >= INK_MIN_CONTRAST ? accent : readableInk(accent, bg);
    const ui = contrastRatio(accent, bg) >= FILL_MIN_CONTRAST ? accent : ink;
    return { ui, ink };
  }

  function readableInk(accent, bg) {
    if (contrastRatio(accent, bg) >= INK_MIN_CONTRAST) return accent;
    const { h, s } = hexToHsl(accent);
    /* Lift washed-out pastels so they still read as a colour -- but never invent
       one. A grey accent has hue 0 and no chroma, so a blanket floor would turn
       the Pastel Silver preset reddish-brown. Leave achromatic seeds grey. */
    const sat = s < 0.08 ? s : Math.max(s, 0.35);
    const goDarker = relLuminance(bg) > 0.4;
    for (let i = 0; i < 24; i++) {
      const l = goDarker ? 0.46 - i * 0.02 : 0.54 + i * 0.02;
      const cand = hslToHex(h, sat, Math.max(0.04, Math.min(0.96, l)));
      if (contrastRatio(cand, bg) >= INK_MIN_CONTRAST) return cand;
    }
    return goDarker ? '#14151a' : '#ffffff';
  }

  function contrastText(color) {
    const { r, g, b } = hexToRgb(color);
    const lin = [r, g, b].map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    const L = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
    const againstWhite = 1.05 / (L + 0.05);
    const againstInk = (L + 0.05) / 0.05265;
    return againstInk >= againstWhite ? '#14151a' : '#ffffff';
  }

  return { init, openSideSheet, closeSideSheet, applyTheme, applyPresetShell, setMode, applyWallpaper, autoExtractColor, applyCursor };
})(); 