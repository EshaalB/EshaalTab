"use strict";

(() => {
  const S = window.SettingsShared;
  const {
    effectiveAccent,
    applyTheme,
    applyPresetShell,
    applyWallpaper,
    applyWallpaperStyle,
    applyWallpaperOverlay,
    applyWallpaperVignette,
    applyWallpaperBlur,
  } = S;
  const renderSideSheetContent = (...a) => S.renderSideSheetContent(...a);
  const paintNextFrame = S.createFrameScheduler();

  function bindWidgetEvents() {
    const live = () => StorageManager.getSettings();
    const data = StorageManager.getData();

    $("stWpFit")?.addEventListener("change", (e) => {
      live().wallpaperFit = e.target.value;
      StorageManager.saveSettings();
      applyWallpaperStyle();
    });

    for (const [id, key, labelId] of [
      ["stWpZoom", "wallpaperZoom", "stWpZoomVal"],
      ["stWpPosX", "wallpaperPosX", "stWpPosXVal"],
      ["stWpPosY", "wallpaperPosY", "stWpPosYVal"],
    ]) {
      $(id)?.addEventListener("input", (e) => {
        live()[key] = parseInt(e.target.value, 10);
        const label = $(labelId);
        if (label) label.textContent = `${e.target.value}%`;
        StorageManager.saveSettings();
        paintNextFrame("wallpaper", applyWallpaperStyle);
      });
    }

    $("stWpOverlayToggle")?.addEventListener("change", (e) => {
      live().wallpaperOverlay = e.target.checked;
      const row = $("stWpOverlayOpacityRow");
      if (row) row.style.display = e.target.checked ? "flex" : "none";
      StorageManager.saveSettings();
      // The wallpaper analysis folds the scrim into the ground it picks ink
      // against, so dimming has to re-run the whole theme, not just the layer.
      applyTheme();
    });

    $("stWpOverlayOpacity")?.addEventListener("input", (e) => {
      live().wallpaperOverlayOpacity = parseInt(e.target.value, 10);
      const label = $("stWpOverlayOpacityVal");
      if (label) label.textContent = `${e.target.value}%`;
      StorageManager.saveSettings();
      paintNextFrame("overlay", applyWallpaperOverlay);
    });

    $("stWpVignetteToggle")?.addEventListener("change", (e) => {
      live().wallpaperVignette = e.target.checked;
      const row = $("stWpVignetteRow");
      if (row) row.style.display = e.target.checked ? "flex" : "none";
      StorageManager.saveSettings();
      applyWallpaperVignette();
    });

    $("stWpVignetteAmount")?.addEventListener("input", (e) => {
      live().wallpaperVignetteAmount = parseInt(e.target.value, 10);
      const label = $("stWpVignetteVal");
      if (label) label.textContent = `${e.target.value}%`;
      StorageManager.saveSettings();
      paintNextFrame("vignette", applyWallpaperVignette);
    });

    $("stWpBlurToggle")?.addEventListener("change", (e) => {
      live().wallpaperBlur = e.target.checked;
      const row = $("stWpBlurAmountRow");
      if (row) row.style.display = e.target.checked ? "flex" : "none";
      StorageManager.saveSettings();
      paintNextFrame("wpblur", applyWallpaperBlur);
    });

    $("stWpBlurAmount")?.addEventListener("input", (e) => {
      live().wallpaperBlurAmount = parseInt(e.target.value, 10);
      const label = $("stWpBlurAmountVal");
      if (label) label.textContent = `${e.target.value}%`;
      StorageManager.saveSettings();
      paintNextFrame("wpblur", applyWallpaperBlur);
    });

    $("stWpMuteToggle")?.addEventListener("change", (e) => {
      live().wallpaperMuted = e.target.checked;
      StorageManager.saveSettings();
      applyWallpaperStyle();
    });

    $("stWpVolume")?.addEventListener("input", (e) => {
      live().wallpaperVolume = parseInt(e.target.value, 10) / 100;
      const label = $("stWpVolumeVal");
      if (label) label.textContent = `${e.target.value}%`;
      StorageManager.saveSettings();
      paintNextFrame("wallpaper", applyWallpaperStyle);
    });

    $$(".wp-gallery-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        if (e.target.closest(".wp-gallery-del")) return;
        applyWallpaper(item.dataset.wpType, item.dataset.wpVal);
        renderSideSheetContent();
        ToastSystem.success("Wallpaper switched");
      });
    });

    $$(".wp-gallery-del").forEach((button) => {
      button.addEventListener("click", async (e) => {
        e.stopPropagation();
        const value = button.dataset.wpDel;
        if (!value) return;
        data.wallpapers = (data.wallpapers || []).filter(
          (wallpaper) => wallpaper.value !== value,
        );
        if (StorageManager.isMediaRef(value)) {
          await StorageManager.delMedia(StorageManager.refId(value));
        }
        if (live().backgroundValue === value) {
          const next = data.wallpapers[data.wallpapers.length - 1];
          if (next) await applyWallpaper(next.type, next.value);
          else {
            const fallback =
              live().solidSeed ||
              (live().mode === "light" ? "#f8fafc" : "#0d1117");
            await applyWallpaper("solid", fallback);
          }
        }
        StorageManager.save();
        renderSideSheetContent();
        ToastSystem.info("Wallpaper removed");
      });
    });

    $("stCornerRadius")?.addEventListener("change", (e) => {
      live().cornerRadius = e.target.value;
      StorageManager.saveSettings();
      applyPresetShell();
    });
    $("stFontFamily")?.addEventListener("change", (e) => {
      live().fontFamily = e.target.value;
      StorageManager.saveSettings();
      applyPresetShell();
    });
    $("stBoardWidth")?.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10);
      live().boardWidth = val;
      const label = $("stBoardWidthVal");
      if (label) label.textContent = `${val}px`;
      StorageManager.saveSettings();
      paintNextFrame("boards", () => BoardRenderer.renderBoards());
    });

    $("stTimeFormat")?.addEventListener("change", (e) => {
      live().use12h = e.target.value === "12";
      StorageManager.save();
      WidgetsRenderer.updateClock(true);
    });

    $("stClockPos")?.addEventListener("change", (e) => {
      live().clockPosition = e.target.value;
      StorageManager.save();
      WidgetsRenderer.applyWidgetVisibility();
      ToastSystem.success(`Clock position updated`);
    });

    $("stClockFont")?.addEventListener("change", (e) => {
      live().clockFont = e.target.value;
      StorageManager.save();
      WidgetsRenderer.applyWidgetVisibility();
      ToastSystem.success("Clock font updated");
    });

    $("stClockColor")?.addEventListener("input", (e) => {
      live().clockColor = e.target.value;
      StorageManager.save();
      paintNextFrame("clock-style", () =>
        WidgetsRenderer.applyClockAppearance(live()),
      );
    });

    $("stClockColorReset")?.addEventListener("click", () => {
      live().clockColor = "";
      StorageManager.save();
      WidgetsRenderer.applyClockAppearance(live());
      renderSideSheetContent();
      ToastSystem.info("Clock follows the accent colour again");
    });

    $("stWpShadowOpacity")?.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10);
      live().wpShadowOpacity = val;
      live().wpShadowAuto = false;
      const lbl = $("stWpShadowOpacityVal");
      if (lbl) lbl.textContent = val + "%";
      StorageManager.saveSettings();
      paintNextFrame("theme", applyTheme);
    });

    $("stWpShadowColor")?.addEventListener("input", (e) => {
      live().wpShadowColor = e.target.value;
      live().wpShadowAuto = false;
      StorageManager.saveSettings();
      paintNextFrame("theme", applyTheme);
    });

    $("stWpShadowAuto")?.addEventListener("click", () => {
      live().wpShadowAuto = true;
      StorageManager.saveSettings();
      applyTheme();
      renderSideSheetContent();
      ToastSystem.info("Text shadow follows the wallpaper again");
    });

    WidgetsRenderer.attachCityPicker($("stWeatherCity"), {
      onPick: () => $("stWeatherApplyBtn")?.click(),
    });
    // Enter with no list open saves what is typed. The picker takes Enter
    // first when a list is showing, and marks it handled.
    $("stWeatherCity")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.defaultPrevented) $("stWeatherApplyBtn")?.click();
    });

    $("stWeatherApplyBtn")?.addEventListener("click", () => {
      const s = live();
      s.weatherCity = $("stWeatherCity").value.trim();
      s.weatherUnit = $("stWeatherUnit").value;
      StorageManager.save();
      WidgetsRenderer.initWeather();
      ToastSystem.success("Weather saved");
    });
  }

  function render(settings, data) {
    const w = settings.widgets || {};
    // Text halos and every wallpaper control below are wallpaper-only - solid
    // mode strips every text-shadow in CSS and has no picture to crop - so on a
    // solid background they would move stored numbers that nothing reads.
    const hasWallpaper = ["image", "video"].includes(settings.backgroundType);
    return `
        <div class="st-container">
          <div class="st-accordion is-expanded" data-page="appearance">
            <button class="st-accordion-header" type="button">
              <span class="st-group-title">General appearance</span>
              <svg class="st-accordion-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div class="st-accordion-body">
              <div class="st-card" style="display:flex; flex-direction:column; gap:12px;">
                <div class="st-row">
                  <label class="st-label" for="stCornerRadius">Corner style</label>
                  ${CustomSelect.render({
                    id: "stCornerRadius",
                    value: cornerStyle(settings.cornerRadius).value,
                    options: CORNER_STYLES.map(({ value, label }) => ({
                      value,
                      label,
                    })),
                    style: "width:160px;",
                  })}
                </div>
                <div class="st-row">
                  <label class="st-label" for="stFontFamily">App font</label>
                  ${CustomSelect.render({
                    id: "stFontFamily",
                    value: appFont(settings.fontFamily).value,
                    options: APP_FONTS.map(({ value, label }) => ({
                      value,
                      label,
                    })),
                    style: "width:160px;",
                  })}
                </div>
                <div>
                  <div class="st-row" style="margin-bottom:6px;">
                    <span class="st-label">Board column width</span>
                    <span class="st-val" id="stBoardWidthVal" data-slider-val="stBoardWidth" data-slider-suffix="px">${settings.boardWidth || 260}px</span>
                  </div>
                  <input type="range" id="stBoardWidth" min="200" max="560" step="10" value="${settings.boardWidth || 260}" style="width:100%; cursor:pointer;" />
                </div>
              </div>
            </div>
          </div>

          <div class="st-accordion is-expanded" data-page="wallpaper">
            <button class="st-accordion-header" type="button">
              <span class="st-group-title">Wallpaper customization</span>
              <svg class="st-accordion-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div class="st-accordion-body">
              ${
                !hasWallpaper
                  ? `<div class="st-card"><div class="st-hint">Turn on a wallpaper to adjust it here.</div></div>`
                  : `
              <div class="st-card" style="display:flex; flex-direction:column; gap:12px;">
                <div class="st-row">
                  <span class="st-label">Fit</span>
                  ${CustomSelect.render({ id: "stWpFit", value: settings.wallpaperFit || "cover", options: [{ value: "cover", label: "Cover (fill screen)" }, { value: "contain", label: "Contain (fit screen)" }], style: "width:190px;" })}
                </div>
                <div class="se-label" style="display:flex; justify-content:space-between;"><span>Zoom</span><span id="stWpZoomVal" data-slider-val="stWpZoom" data-slider-suffix="%">${settings.wallpaperZoom || 100}%</span></div>
                <input type="range" class="se-slider" id="stWpZoom" min="10" max="500" step="5" value="${settings.wallpaperZoom || 100}" />
                <div class="se-label" style="display:flex; justify-content:space-between;"><span>Horizontal position</span><span id="stWpPosXVal" data-slider-val="stWpPosX" data-slider-suffix="%">${settings.wallpaperPosX ?? 50}%</span></div>
                <input type="range" class="se-slider" id="stWpPosX" min="-300" max="300" value="${settings.wallpaperPosX ?? 50}" />
                <div class="se-label" style="display:flex; justify-content:space-between;"><span>Vertical position</span><span id="stWpPosYVal" data-slider-val="stWpPosY" data-slider-suffix="%">${settings.wallpaperPosY ?? 50}%</span></div>
                <input type="range" class="se-slider" id="stWpPosY" min="-300" max="300" value="${settings.wallpaperPosY ?? 50}" />

                <label class="st-row" style="cursor:pointer;"><span class="st-label">Dim bright wallpapers</span><input type="checkbox" id="stWpOverlayToggle" ${settings.wallpaperOverlay ? "checked" : ""} /></label>
                <div id="stWpOverlayOpacityRow" style="display:${settings.wallpaperOverlay ? "flex" : "none"}; flex-direction:column; gap:6px;">
                  <div class="se-label" style="display:flex; justify-content:space-between;"><span>Dim amount</span><span id="stWpOverlayOpacityVal" data-slider-val="stWpOverlayOpacity" data-slider-suffix="%">${settings.wallpaperOverlayOpacity ?? 35}%</span></div>
                  <input type="range" class="se-slider" id="stWpOverlayOpacity" min="0" max="90" step="5" value="${settings.wallpaperOverlayOpacity ?? 35}" />
                </div>

                <label class="st-row" style="cursor:pointer;"><span class="st-label">Darken edges</span><input type="checkbox" id="stWpVignetteToggle" ${settings.wallpaperVignette ? "checked" : ""} /></label>
                <div class="st-hint">Darkens the corners so text is easier to read.</div>
                <div id="stWpVignetteRow" style="display:${settings.wallpaperVignette ? "flex" : "none"}; flex-direction:column; gap:6px;">
                  <div class="se-label" style="display:flex; justify-content:space-between;"><span>Edge shading</span><span id="stWpVignetteVal" data-slider-val="stWpVignetteAmount" data-slider-suffix="%">${settings.wallpaperVignetteAmount ?? 45}%</span></div>
                  <input type="range" class="se-slider" id="stWpVignetteAmount" min="0" max="100" step="5" value="${settings.wallpaperVignetteAmount ?? 45}" />
                </div>

                <label class="st-row" style="cursor:pointer;"><span class="st-label">Soften wallpaper</span><input type="checkbox" id="stWpBlurToggle" ${settings.wallpaperBlur ? "checked" : ""} /></label>
                <div class="st-hint">Blurs the wallpaper so text stands out.</div>
                <div id="stWpBlurAmountRow" style="display:${settings.wallpaperBlur ? "flex" : "none"}; flex-direction:column; gap:6px;">
                  <div class="se-label" style="display:flex; justify-content:space-between;"><span>Softness</span><span id="stWpBlurAmountVal" data-slider-val="stWpBlurAmount" data-slider-suffix="%">${settings.wallpaperBlurAmount ?? 40}%</span></div>
                  <input type="range" class="se-slider" id="stWpBlurAmount" min="0" max="100" step="1" value="${settings.wallpaperBlurAmount ?? 40}" />
                </div>
                ${settings.backgroundType === "video" ? `<label class="st-row" style="cursor:pointer;"><span class="st-label">Mute video</span><input type="checkbox" id="stWpMuteToggle" ${settings.wallpaperMuted !== false ? "checked" : ""} /></label><div class="se-label" style="display:flex; justify-content:space-between;"><span>Volume</span><span id="stWpVolumeVal" data-slider-val="stWpVolume" data-slider-suffix="%">${Math.round((settings.wallpaperVolume ?? 0.5) * 100)}%</span></div><input type="range" class="se-slider" id="stWpVolume" min="0" max="100" step="5" value="${Math.round((settings.wallpaperVolume ?? 0.5) * 100)}" />` : ""}
              </div>
              `
              }
              ${
                data?.wallpapers?.length
                  ? `<div class="st-card" style="margin-top:10px;"><div class="st-label">Saved wallpapers</div><div class="wp-gallery-grid">${data.wallpapers
                      .map(
                        (wallpaper) => `<div class="wp-gallery-item ${wallpaper.value === settings.backgroundValue ? "active" : ""}" data-wp-val="${escapeHtml(wallpaper.value)}" data-wp-type="${wallpaper.type}"><div class="wp-gallery-thumb" data-wp-thumb="${escapeHtml(wallpaper.value)}" data-wp-thumb-type="${wallpaper.type}"></div><button class="wp-gallery-del" data-wp-del="${escapeHtml(wallpaper.value)}" title="Delete wallpaper">&times;</button></div>`,
                      )
                      .join("")}</div></div>`
                  : ""
              }
            </div>
          </div>

          <div class="st-accordion is-expanded" data-page="home">
            <button class="st-accordion-header" type="button">
              <span class="st-group-title">Clock and text</span>
              <svg class="st-accordion-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div class="st-accordion-body">
              <div class="st-card" style="display:flex; flex-direction:column; gap:12px;">
            ${
              w.clock !== false
                ? `
            <div class="st-row">
              <label class="st-label">Time format</label>
              ${CustomSelect.render({
                id: "stTimeFormat",
                value: settings.use12h ? "12" : "24",
                options: [
                  { value: "24", label: "24-hour" },
                  { value: "12", label: "12-hour (AM/PM)" },
                ],
                style: "width:180px;",
              })}
            </div>
            <div class="st-row">
              <label class="st-label" for="stClockPos">Clock position</label>
              ${CustomSelect.render({
                id: "stClockPos",
                value:
                  settings.clockPosition === "corner"
                    ? "bottom-left"
                    : settings.clockPosition || "center",
                options: [
                  { value: "center", label: "Centered" },
                  { value: "top-left", label: "Top left" },
                  { value: "top-right", label: "Top right" },
                  { value: "bottom-left", label: "Bottom left" },
                  { value: "bottom-right", label: "Bottom right" },
                ],
                style: "width:220px;",
              })}
            </div>
            <div class="st-row">
              <label class="st-label" for="stClockFont">Clock font</label>
              ${CustomSelect.render({
                id: "stClockFont",
                value: settings.clockFont || "system",
                options: [
                  { value: "system", label: "System" },
                  { value: "outfit", label: "Outfit" },
                  { value: "thin", label: "Thin (iOS style)" },
                  { value: "light", label: "Light (Android style)" },
                  { value: "default", label: "Digital (Orbitron)" },
                  { value: "app", label: "Match app font" },
                  { value: "serif", label: "Serif" },
                  { value: "mono", label: "Monospace" },
                  { value: "handwriting", label: "Handwriting" },
                ],
                style: "width:220px;",
              })}
            </div>
            <div class="st-row">
              <label class="st-label" for="stClockColor">Clock colour</label>
              <div style="display:flex; align-items:center; gap:6px;">
                <input type="color" id="stClockColor" class="st-color"
                       value="${/^#[0-9a-f]{6}$/i.test(settings.clockColor || "") ? settings.clockColor : effectiveAccent()}" />
                <button id="stClockColorReset" class="st-action-btn st-icon-reset" style="padding:6px 10px;">Use accent</button>
              </div>
            </div>`
                : ""
            }
            ${
              hasWallpaper
                ? `
            <div class="st-row" style="align-items:flex-start; flex-direction:column; gap:4px;">
              <div class="st-row" style="width:100%;">
                <label class="st-label" for="stWpShadowOpacity">Shadow opacity</label>
                <span class="st-val" id="stWpShadowOpacityVal" data-slider-val="stWpShadowOpacity" data-slider-suffix="%">${settings.wpShadowOpacity ?? 60}%</span>
              </div>
              <input type="range" id="stWpShadowOpacity" min="0" max="100" step="1"
                     value="${settings.wpShadowOpacity ?? 60}" style="width:100%;" />
            </div>
            <div class="st-row">
              <label class="st-label" for="stWpShadowColor">Shadow colour</label>
              <div style="display:flex; align-items:center; gap:8px;">
                <input type="color" id="stWpShadowColor" class="st-color"
                       value="${/^#[0-9a-f]{6}$/i.test(settings.wpShadowColor || "") ? settings.wpShadowColor : "#000000"}" />
                <button id="stWpShadowAuto" class="st-action-btn st-icon-reset" style="padding:6px 10px;">Auto</button>
              </div>
            </div>
            <div class="st-hint">${settings.wpShadowAuto === false ? "Using your own shadow." : "Set automatically from your wallpaper."}</div>`
                : ""
            }
              </div>
            </div>
          </div>

          ${
            w.weather
              ? `
          <div class="st-accordion is-expanded" data-page="home">
            <button class="st-accordion-header" type="button">
              <span class="st-group-title">Weather</span>
              <svg class="st-accordion-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div class="st-accordion-body">
              <div class="st-card" style="display:flex; flex-direction:column; gap:10px;">
            <div class="st-row">
              <label class="st-label" for="stWeatherCity">City</label>
              <input type="text" id="stWeatherCity" class="st-input" value="${escapeHtml(settings.weatherCity || "")}" placeholder="Start typing a city" style="width:200px;" />
            </div>
            <div class="st-row">
              <label class="st-label">Temperature unit</label>
              ${CustomSelect.render({
                id: "stWeatherUnit",
                value: settings.weatherUnit || "c",
                options: [
                  { value: "c", label: "Celsius (°C)" },
                  { value: "f", label: "Fahrenheit (°F)" },
                ],
                style: "width:140px;",
              })}
            </div>
            <button id="stWeatherApplyBtn" class="st-action-btn primary st-icon-save">Save weather</button>
              </div>
            </div>
          </div>`
              : ""
          }
        </div>
    `;
  }

  S.registerTab("widgets", { render, bind: bindWidgetEvents });
})();
