"use strict";

(() => {
  const S = window.SettingsShared;
  const {
    PRESETS,
    PRESET_GROUPS,
    presetById,
    HEX6,
    MAX_WALLPAPERS,
    MAX_VIDEO_BYTES,
    liveVar,
    effectiveAccent,
    systemDark,
    rememberWallpaper,
    readAsDataUrl,
    downscaleImage,
    localiseImage,
    resolveMode,
    hexToRgb,
    contrastText,
    derivePalette,
    applySeed,
    applyPresetShell,
    applyTheme,
    applyWallpaper,
    applyWallpaperStyle,
    applyWallpaperOverlay,
    applyWallpaperBlur,
    applyCursor,
    setMode,
  } = S;
  const renderSideSheetContent = (...a) => S.renderSideSheetContent(...a);
  const paintNextFrame = S.createFrameScheduler();

  function applyPreset(id) {
    const s = StorageManager.getSettings();
    const p = presetById(id);
    s.preset = p ? id : "";
    let wallpaperDropped = false;

    delete s.accentOverride;
    if (p) {
      s.mode = p.mode;
      s.modeLocked = true;
      // `seed` lets a preset set its background base independently of the
      // accent. Without it the base is derived from the accent, which cannot
      // express a bright colour on a near-black ground.
      s.solidSeed = p.seed || p.accent;
      s.accentColor = p.accent;
      // The swatch has always shown two dots; this is what finally makes the
      // second one mean something once the preset is applied.
      // Feeds the swatch dots and, if the user has switched the two-tone fill
      // on, the gradient. A preset never turns the gradient on by itself: flat
      // is the default everywhere and the sweep stays an explicit opt-in.
      s.accent2 = p.accent2 || "";
      s.cornerRadius = CORNER_STYLES[0].value;
      // applyTheme() only derives a palette from `solidSeed` when the
      // background is solid, so with a wallpaper up a preset used to change
      // nothing but the accent and read as "the colours didn't switch". A
      // preset is a whole look, so it takes the background back.
      if (s.backgroundType && s.backgroundType !== "solid") {
        s.backgroundType = "solid";
        s.backgroundValue = p.seed || p.accent;
        // applyTheme() paints over the photo layer but leaves a playing video
        // running behind the new solid ground.
        const videoBg = $("video-bg");
        if (videoBg) {
          videoBg.pause();
          videoBg.classList.remove("active");
        }
        wallpaperDropped = true;
      }
    }

    StorageManager.save();
    applyPresetShell();
    applyTheme();
    return wallpaperDropped;
  }

  function applyPresetData(p) {
    if (!p || typeof p !== "object") return false;
    const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
    const s = StorageManager.getSettings();

    if (["light", "dark", "system"].includes(p.mode)) {
      s.mode = p.mode;
      s.modeLocked = true;
    }
    if (HEX.test(p.accent || "")) s.accentColor = p.accent;
    if (HEX.test(p.solidSeed || "")) s.solidSeed = p.solidSeed;
    if (["solid", "image", "video"].includes(p.backgroundType))
      s.backgroundType = p.backgroundType;
    if (
      typeof p.backgroundValue === "string" &&
      p.backgroundValue.length < 1000 &&
      (HEX.test(p.backgroundValue) || /^https?:\/\//i.test(p.backgroundValue))
    ) {
      s.backgroundValue = p.backgroundValue;
    }
    if (typeof p.boardOpacity === "number" && isFinite(p.boardOpacity)) {
      s.boardOpacity = Math.min(1, Math.max(0, p.boardOpacity));
      s.interfaceOpacity = Math.round(s.boardOpacity * 100);
    }
    if (CORNER_RADII.includes(p.cornerRadius)) s.cornerRadius = p.cornerRadius;
    s.preset = presetById(p.id) ? p.id : "";
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
      name: "Custom Preset",
      mode: s.mode,
      accent: s.accentColor,
      solidSeed: s.solidSeed || s.accentColor,
      backgroundType: s.backgroundType || "solid",
      backgroundValue:
        typeof s.backgroundValue === "string" &&
        /^(#|https?:\/\/)/i.test(s.backgroundValue) &&
        s.backgroundValue.length < 1000
          ? s.backgroundValue
          : "",
      boardOpacity: (s.interfaceOpacity ?? 8) / 100,
      cornerRadius: cornerStyle(s.cornerRadius).value,
    };
  }

  /* `btoa` only accepts Latin-1, so a theme carrying any character outside it -
     a display name, an imported preset title - threw and took the whole export
     with it. Encoding the UTF-8 bytes first makes the code safe for any text,
     and the decoder below reverses exactly the same steps. */
  const toBase64 = (text) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(text)));

  const fromBase64 = (b64) =>
    new TextDecoder().decode(
      Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)),
    );

  /**
   * Copies text, and says truthfully whether it worked.
   *
   * The async clipboard API rejects for reasons that have nothing to do with
   * the user - the document not being focused is enough - and the old handler
   * answered that with "Preset code created", which is not a failure message
   * and not a success message either: the code was nowhere the user could get
   * at it. The execCommand path still works when the promise does not, and if
   * both fail the code is put on screen to be copied by hand.
   */
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {}
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }

  async function exportPresetCode() {
    let str;
    try {
      str = "ESH-" + toBase64(JSON.stringify(generatePresetObject()));
    } catch {
      ToastSystem.error("Could not build a theme code from these settings.");
      return;
    }
    if (await copyText(str)) {
      ToastSystem.success("Theme code copied", 3000, "Paste it anywhere to share this look.");
      return;
    }
    showCustomModal(
      "Your theme code",
      `<p class="dialog-message">Copying was blocked, so here it is to copy by hand.</p>
       <div class="dialog-field">
         <input type="text" id="dlgThemeCode" class="dialog-input" readonly value="${escapeHtml(str)}" />
       </div>`,
      () => true,
      "Done",
    );
    $("dlgThemeCode")?.select();
  }

  function importPresetString(str) {
    str = (str || "").trim();
    if (!str) return false;
    let jsonStr = str;
    if (str.startsWith("ESH-")) {
      try {
        jsonStr = fromBase64(str.slice(4));
      } catch {
        // Codes made before the UTF-8 change decode as plain Latin-1.
        try {
          jsonStr = atob(str.slice(4));
        } catch {}
      }
    }
    try {
      const data = JSON.parse(jsonStr);
      if (applyPresetData(data)) {
        ToastSystem.success("Theme applied");
        renderSideSheetContent();
        return true;
      }
    } catch {
      ToastSystem.error("Invalid preset code or JSON format.");
    }
    return false;
  }

  /* Square the wallpaper is scaled into before it is read. 64 is enough for a
     stable average and a usable colour histogram, and small enough that the
     decode plus read costs well under a frame. */
  const SAMPLE = 64;

  /** Edge of the frame, as a fraction of its height, that counts as a band. */
  const BAND = 0.2;

  /**
   * Reads a downsampled wallpaper frame for the two things the interface needs
   * from it: an accent worth borrowing, and how bright the picture actually is
   * behind the chrome laid over it.
   *
   * Brightness comes back per band - the strip under the toolbar, the middle
   * where the clock sits, the strip under the date and weather - rather than as
   * one number for the whole picture. A photo that averages mid-grey is very
   * often bright sky over dark ground, and a single average picks the wrong ink
   * for both ends of it; that is what made light wallpapers keep white icons.
   *
   * `spread` is the standard deviation of pixel luminance and stands in for
   * busyness. A flat colour needs almost no text shadow to stay readable; a
   * detailed photo needs a real one. Deriving the shadow from it is what stops
   * the halo being uniformly heavy on wallpapers that never needed it.
   */
  function analyzeWallpaper(data, size) {
    const buckets = new Map();
    const bandRows = Math.max(1, Math.round(size * BAND));
    // r/g/b sums and pixel count, per band: 0 top, 1 middle, 2 bottom, 3 all.
    const bands = [0, 1, 2, 3].map(() => ({ r: 0, g: 0, b: 0, n: 0 }));
    let sumY = 0,
      sumY2 = 0;

    for (let y = 0; y < size; y++) {
      const band = y < bandRows ? 0 : y >= size - bandRows ? 2 : 1;
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        if (data[i + 3] < 125) continue;
        const r = data[i],
          g = data[i + 1],
          b = data[i + 2];

        for (const t of [band, 3]) {
          bands[t].r += r;
          bands[t].g += g;
          bands[t].b += b;
          bands[t].n++;
        }

        const Y = Contrast.lum(`rgb(${r},${g},${b})`);
        sumY += Y;
        sumY2 += Y * Y;

        const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
        let e = buckets.get(key);
        if (!e) buckets.set(key, (e = { r: 0, g: 0, b: 0, n: 0 }));
        e.r += r;
        e.g += g;
        e.b += b;
        e.n++;
      }
    }

    const n = bands[3].n;
    const mean = n ? sumY / n : 0.2;
    const spread = n ? Math.sqrt(Math.max(0, sumY2 / n - mean * mean)) : 0.1;

    const avg = (t) =>
      t.n
        ? Contrast.toHex({ r: t.r / t.n, g: t.g / t.n, b: t.b / t.n })
        : "#4a4a52";

    return {
      accent: pickAccent(buckets),
      top: avg(bands[0]),
      middle: avg(bands[1]),
      bottom: avg(bands[2]),
      overall: avg(bands[3]),
      spread,
    };
  }

  /**
   * The colour in the picture most worth using as an accent.
   *
   * Scored on how much of the frame it covers and how chromatic it is, with
   * near-black and near-white pushed down hard: they dominate most photographs
   * by area, and neither survives being used as a UI accent. Chroma is measured
   * against the channel maximum rather than as HSL saturation, so a dark but
   * genuinely coloured region still competes with a large washed-out one.
   */
  function pickAccent(buckets) {
    let best = null,
      bestScore = -1;
    for (const e of buckets.values()) {
      const r = e.r / e.n,
        g = e.g / e.n,
        b = e.b / e.n;
      const mx = Math.max(r, g, b),
        mn = Math.min(r, g, b);
      const chroma = mx === 0 ? 0 : (mx - mn) / mx;
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      // Peaks around mid-lightness and falls away at both ends.
      const usable = Math.max(0.04, 1 - Math.pow((lum - 0.5) / 0.5, 4));
      const score = e.n * (chroma * chroma * 3 + 0.05) * usable;
      if (score > bestScore) {
        bestScore = score;
        best = Contrast.toHex({ r, g, b });
      }
    }
    return best || "#6366f1";
  }

  /**
   * @param {boolean} toneOnly Record only the brightness measurements and leave
   *   the accent alone - used to backfill a wallpaper that predates the tone
   *   analysis, where re-deriving the accent would silently overwrite one the
   *   user picked themselves.
   */
  function applyExtracted(data, size, toneOnly = false) {
    const tone = analyzeWallpaper(data, size);
    const settings = StorageManager.getSettings();
    if (!toneOnly) {
      delete settings.accentOverride;
      // The most characteristic colour in a photograph is very often unusable
      // as an accent on its own - a night scene's is near-black, a snow
      // scene's is near-white - so the hue is kept and its lightness is
      // brought into the band a UI colour has to live in. Doing it here rather
      // than at paint time means the swatch in Settings shows the colour that
      // will actually be used.
      const accent = Contrast.tint(
        tone.accent,
        Contrast.isLight(tone.overall) ? "light" : "dark",
      );
      settings.accentColor = accent;
      settings.wpExtractedAccent = accent;
    }
    settings.wpTone = {
      top: tone.top,
      middle: tone.middle,
      bottom: tone.bottom,
      overall: tone.overall,
      spread: tone.spread,
    };
    if (!toneOnly && settings.mode !== "system" && !settings.modeLocked) {
      // Which ink the picture as a whole calls for is the same question as
      // which mode it wants, so it is answered by the same function the rest
      // of the app uses rather than by a second brightness rule of its own.
      settings.mode = Contrast.isLight(tone.overall) ? "light" : "dark";
    }
    if (!toneOnly) settings.preset = "wallpaper";
    StorageManager.save();
    applyTheme();
    renderSideSheetContent();
  }

  async function autoExtractColor(rawMediaUrl, isVideo = false, toneOnly = false) {
    if (!rawMediaUrl) return;
    let mediaUrl = rawMediaUrl;
    if (typeof mediaUrl === "string" && mediaUrl.startsWith("ref:")) {
      try {
        mediaUrl = await StorageManager.resolveMedia(mediaUrl);
      } catch (e) {
        return;
      }
    }

    if (
      !mediaUrl ||
      (typeof mediaUrl === "string" && mediaUrl.startsWith("ref:"))
    )
      return;

    try {
      const isVideoFile =
        isVideo ||
        /\.(mp4|webm|ogg)$/i.test(mediaUrl) ||
        mediaUrl.startsWith("data:video/") ||
        mediaUrl.startsWith("blob:");

      if (isVideoFile) {
        const video = document.createElement("video");
        video.muted = true;
        video.playsInline = true;
        if (mediaUrl.startsWith("http://") || mediaUrl.startsWith("https://")) {
          video.crossOrigin = "Anonymous";
        }
        video.src = mediaUrl;

        const processVideoFrame = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = SAMPLE;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            ctx.drawImage(video, 0, 0, SAMPLE, SAMPLE);
            applyExtracted(ctx.getImageData(0, 0, SAMPLE, SAMPLE).data, SAMPLE, toneOnly);
          } catch (err) {}
        };

        video.onloadeddata = () => {
          try {
            video.currentTime = Math.min(
              1,
              video.duration && !isNaN(video.duration) ? video.duration / 2 : 0,
            );
          } catch (e) {
            processVideoFrame();
          }
        };
        video.onseeked = processVideoFrame;
        return;
      }

      let blobUrl = mediaUrl;
      let isObjectUrl = false;
      if (mediaUrl.startsWith("http://") || mediaUrl.startsWith("https://")) {
        try {
          const res = await fetch(mediaUrl);
          const blob = await res.blob();
          blobUrl = URL.createObjectURL(blob);
          isObjectUrl = true;
        } catch (err) {}
      }

      const img = new Image();
      if (mediaUrl.startsWith("http://") || mediaUrl.startsWith("https://")) {
        img.crossOrigin = "Anonymous";
      }

      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = SAMPLE;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
          applyExtracted(ctx.getImageData(0, 0, SAMPLE, SAMPLE).data, SAMPLE, toneOnly);
          if (isObjectUrl) URL.revokeObjectURL(blobUrl);
        } catch (e) {}
      };
      img.src = blobUrl;
    } catch (e) {}
  }

  const liveRef = (get) =>
    new Proxy(
      {},
      {
        get: (_, k) => get()[k],
        set: (_, k, v) => {
          get()[k] = v;
          return true;
        },
        deleteProperty: (_, k) => {
          delete get()[k];
          return true;
        },
        has: (_, k) => k in get(),
        ownKeys: () => Reflect.ownKeys(get()),
        getOwnPropertyDescriptor: (_, k) => {
          const d = Object.getOwnPropertyDescriptor(get(), k);
          return d ? { ...d, configurable: true } : undefined;
        },
      },
    );

  function bindThemeEvents() {
    const settings = liveRef(() => StorageManager.getSettings());
    const data = liveRef(() => StorageManager.getData());
    const fileInput = $("fileInput");

    const nameInp = $("stDisplayName");
    if (nameInp) {
      const saveName = () => {
        settings.displayName = nameInp.value.trim();
        StorageManager.saveSettings();
        WidgetsRenderer.updateClock(true);
      };
      nameInp.addEventListener("input", saveName);
      nameInp.addEventListener("change", saveName);
    }

    const bindHomeToggle = (id, key) => {
      $(id)?.addEventListener("change", (e) => {
        settings.widgets[key] = e.target.checked;
        StorageManager.saveSettings();
        WidgetsRenderer.applyWidgetVisibility();
      });
    };
    bindHomeToggle("wClockToggle", "clock");
    bindHomeToggle("wGreetingToggle", "greeting");
    bindHomeToggle("wSearchToggle", "navSearch");
    bindHomeToggle("wWorkspaceToggle", "workspace");
    bindHomeToggle("wDateToggle", "date");
    bindHomeToggle("wWeatherToggle", "weather");
    $("wPinnedLinksToggle")?.addEventListener("change", (e) => {
      settings.hidePinnedOnHome = !e.target.checked;
      StorageManager.saveSettings();
      WidgetsRenderer.applyWidgetVisibility();
      HomeRenderer.render();
    });

    // Not `bindHomeToggle`: the task list is not painted by
    // `applyWidgetVisibility` the way the other widgets are - it is rebuilt
    // from the notes each time - so it needs the Home repaint as well.
    $("wNotesTodosToggle")?.addEventListener("change", (e) => {
      settings.widgets.notesTodos = e.target.checked;
      StorageManager.saveSettings();
      HomeRenderer.render();
    });

    $("wPinsPosition")?.addEventListener("change", (e) => {
      const v = e.target.dataset?.value ?? e.target.value;
      settings.pinsPosition = ["left", "right", "bottom"].includes(v) ? v : "center";
      StorageManager.saveSettings();
      WidgetsRenderer.applyWidgetVisibility();
    });

    $("wPinnedBoardsToggle")?.addEventListener("change", (e) => {
      settings.widgets.pinnedBoards = e.target.checked;
      StorageManager.saveSettings();
      HomeRenderer.render();
    });

    $("wTaskCount")?.addEventListener("change", (e) => {
      const v = Number(e.target.dataset?.value ?? e.target.value);
      settings.homeTaskCount = v === 5 ? 5 : 3;
      StorageManager.saveSettings();
      HomeRenderer.render();
    });

    $("btnExtractWallpaper")?.addEventListener("click", async () => {
      delete settings.accentOverride;
      settings.preset = "wallpaper";
      if (settings.wpExtractedAccent) {
        settings.accentColor = settings.wpExtractedAccent;
        StorageManager.save();
        applyTheme();
        renderSideSheetContent();
        ToastSystem.success("Restored wallpaper accent");
      } else {
        const val = settings.backgroundValue;
        const isVideo = settings.backgroundType === "video";
        const mediaUrl = StorageManager.isMediaRef(val)
          ? await StorageManager.resolveMedia(val)
          : val;
        autoExtractColor(mediaUrl, isVideo);
      }
    });

    $$(".preset-swatch[data-preset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const wallpaperDropped = applyPreset(btn.dataset.preset);
        renderSideSheetContent();
        const p = presetById(btn.dataset.preset);
        if (wallpaperDropped)
          ToastSystem.success(`${p.name} applied — wallpaper turned off`);
        else ToastSystem.success(p ? `${p.name} applied` : "Preset cleared");
      });
    });

    $$(".mynt-seg-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        setMode(btn.dataset.mode);
        renderSideSheetContent();
        ToastSystem.success(`${btn.textContent.trim()} mode`);
      });
    });

    $("myntColorPicker")?.addEventListener("input", (e) => {
      settings.solidSeed = e.target.value;
      if (!settings.accentOverride) settings.accentColor = e.target.value;

      settings.preset = "custom";
      StorageManager.saveSettings();
      applyTheme();
    });
    $("myntColorPicker")?.addEventListener("change", () => {
      renderSideSheetContent();
      ToastSystem.success("Base colour applied");
    });

    $("stAccent1Picker")?.addEventListener("input", (e) => {
      // Only the override. `accentColor` stays the seed-derived value so that
      // clearing the override falls back to it — writing both left two
      // sources of truth that drifted apart across preset/custom cycles.
      settings.accentOverride = e.target.value;
      settings.preset = "custom";
      StorageManager.saveSettings();
      applyTheme();
    });

    $("stAccentGradientToggle")?.addEventListener("change", (e) => {
      settings.accentGradient = e.target.checked;
      // Turning it on with no secondary picked yet would sweep a colour into
      // itself and show nothing, so seed it from the preset's pair.
      if (settings.accentGradient && !HEX6.test(settings.accent2 || "")) {
        const p = presetById(settings.preset);
        settings.accent2 = p?.accent2 || effectiveAccent();
      }
      StorageManager.saveSettings();
      applyTheme();
      $("stAccent2Row")?.toggleAttribute("hidden", !settings.accentGradient);
      const picker = $("stAccent2Picker");
      if (picker && HEX6.test(settings.accent2 || ""))
        picker.value = settings.accent2;
    });

    $("stAccent2Picker")?.addEventListener("input", (e) => {
      settings.accent2 = e.target.value;
      settings.preset = "custom";
      StorageManager.saveSettings();
      applyTheme();
    });

    $("stAccentResetBtn")?.addEventListener("click", () => {
      delete settings.accentOverride;
      settings.accent2 = "";
      settings.accentGradient = false;
      settings.accentColor =
        settings.solidSeed ||
        (settings.mode === "light" ? "#6366f1" : "#818cf8");
      StorageManager.saveSettings();
      applyTheme();
      renderSideSheetContent();
      ToastSystem.info("Accent follows the base colour again");
    });

    $("stInterfaceOpacity")?.addEventListener("input", (e) => {
      settings.interfaceOpacity = parseInt(e.target.value, 10);

      settings.boardOpacity = settings.interfaceOpacity / 100;
      $("stInterfaceOpacityVal").textContent = `${e.target.value}%`;
      StorageManager.saveSettings();
      paintNextFrame("theme", applyTheme);
      // The surfaces still on Auto move with this slider, so their readouts
      // have to follow rather than sit on stale numbers.
      paintSurfaceLabels();
    });

    // Per-surface strength. Moving a slider pins that one surface; Auto drops
    // the override so it follows the overall slider again.
    const paintSurfaceLabels = () => {
      const resolved = S.surfaceStrengths(settings);
      const live = settings.surfaceOpacity || {};
      document.querySelectorAll("[data-surface-val]").forEach((el) => {
        const key = el.getAttribute("data-surface-val");
        const val = Math.round(resolved[key] ?? 0);
        el.textContent =
          typeof live[key] === "number" ? `${val}%` : `Auto · ${val}%`;
        const slider = document.querySelector(`[data-surface-slider="${key}"]`);
        if (slider && document.activeElement !== slider)
          slider.value = String(val);
        const auto = document.querySelector(`[data-surface-auto="${key}"]`);
        if (auto) auto.disabled = typeof live[key] !== "number";
      });
    };

    document.querySelectorAll("[data-surface-slider]").forEach((slider) => {
      slider.addEventListener("input", (e) => {
        const key = e.target.getAttribute("data-surface-slider");
        if (!settings.surfaceOpacity || typeof settings.surfaceOpacity !== "object")
          settings.surfaceOpacity = {};
        settings.surfaceOpacity[key] = parseInt(e.target.value, 10);
        StorageManager.saveSettings();
        paintNextFrame("theme", applyTheme);
        paintSurfaceLabels();
      });
    });

    document.querySelectorAll("[data-surface-auto]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const key = e.currentTarget.getAttribute("data-surface-auto");
        if (settings.surfaceOpacity) delete settings.surfaceOpacity[key];
        StorageManager.saveSettings();
        applyTheme();
        paintSurfaceLabels();
      });
    });

    $("stSolidAmbient")?.addEventListener("change", (e) => {
      settings.solidAmbient = e.target.checked;
      StorageManager.saveSettings();
      applyTheme();
    });

    $("stPerformanceMode")?.addEventListener("change", (e) => {
      settings.performanceMode = e.target.checked;
      StorageManager.saveSettings();
      applyTheme();
      ToastSystem.info(
        e.target.checked ? "Performance mode on" : "Performance mode off",
      );
    });

    $("btnExportPresetCode")?.addEventListener("click", exportPresetCode);

    // The wallpaper crop, dim, blur and gallery controls render in the
    // Customize tab now, and are bound there - one copy of each.

    $("themeWpToggle")?.addEventListener("change", (e) => {
      const controls = $("themeWpControls");
      if (e.target.checked) {
        if (controls) controls.style.display = "flex";
        if (settings.backgroundType === "solid" || !settings.backgroundType) {
          const lastImg =
            data.wallpapers && data.wallpapers.length
              ? data.wallpapers[data.wallpapers.length - 1]
              : null;
          if (lastImg) {
            applyWallpaper(lastImg.type, lastImg.value);
          } else {
            settings.backgroundType = "image";
            StorageManager.save();
          }
        }
      } else {
        if (controls) controls.style.display = "none";
        const solidBg =
          settings.solidSeed ||
          (settings.mode === "light" ? "#f8fafc" : "#0d1117");
        applyWallpaper("solid", solidBg);
        renderSideSheetContent();
        ToastSystem.info("Switched to solid color mode");
      }
    });

    const uploadBtn = $("wpUploadBtn");
    if (uploadBtn && fileInput) {
      uploadBtn.onclick = () => fileInput.click();
      fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        e.target.value = "";
        if (!file) return;
        const isVideo = file.type.startsWith("video/");
        const type = isVideo ? "video" : "image";

        if (isVideo && file.size > MAX_VIDEO_BYTES) {
          ToastSystem.error(
            `That video is ${(file.size / 1048576).toFixed(0)} MB. The limit is ${MAX_VIDEO_BYTES / 1048576} MB.`,
          );
          return;
        }

        uploadBtn.disabled = true;
        try {
          const dataUrl = isVideo
            ? await readAsDataUrl(file)
            : await downscaleImage(file);
          const id = uuid();
          const ref = await StorageManager.putMedia(id, dataUrl);
          rememberWallpaper({ id, type, value: ref, name: file.name });
          settings.backgroundType = type;
          await applyWallpaper(type, ref);
          StorageManager.pruneMedia();
          ToastSystem.success("Wallpaper applied");
          renderSideSheetContent();
        } catch (err) {
          ToastSystem.error(err?.message || "Could not use that file.");
        } finally {
          uploadBtn.disabled = false;
        }
      };
    }

    const urlBtn = $("wpUrlApplyBtn");
    const urlInp = $("wpUrlInp");
    if (urlBtn && urlInp) {
      urlBtn.onclick = async () => {
        const val = urlInp.value.trim();
        if (!val) {
          ToastSystem.info("Paste an image or .mp4 URL first.");
          return;
        }
        if (!/^https?:\/\//i.test(val)) {
          ToastSystem.error("Only http(s) URLs are supported.");
          return;
        }

        const isVideo = /\.(mp4|webm|ogg)(\?|$)/i.test(val);
        const type = isVideo ? "video" : "image";

        urlBtn.disabled = true;
        try {
          let stored = val;
          let name = "Custom URL";

          if (!isVideo) {
            const local = await localiseImage(val);
            if (local) {
              stored = await StorageManager.putMedia(uuid(), local);
              name = "Saved image";
            }
          }

          rememberWallpaper({ id: uuid(), type, value: stored, name });
          settings.backgroundType = type;
          await applyWallpaper(type, stored, false);
          StorageManager.pruneMedia();
          ToastSystem.success(
            name === "Saved image"
              ? "Wallpaper saved to this device"
              : "Wallpaper applied",
          );
          renderSideSheetContent();

          autoExtractColor(
            stored.startsWith("ref:")
              ? await StorageManager.resolveMedia(stored)
              : val,
            isVideo,
          );
        } catch (err) {
          ToastSystem.error(err?.message || "Could not use that link.");
        } finally {
          urlBtn.disabled = false;
        }
      };
      urlInp.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" || e.isComposing) return;
        e.preventDefault();
        urlBtn.click();
      });
    }

    $("btnImportPresetCode")?.addEventListener("click", () => {
      const val = ($("inpImportPresetCode")?.value || "").trim();
      if (!val) {
        ToastSystem.info("Paste preset code or JSON string first.");
        return;
      }
      importPresetString(val);
    });

    const fileInp = $("inpImportPresetFile");
    $("btnImportPresetFileTrigger")?.addEventListener("click", () =>
      fileInp?.click(),
    );
    if (fileInp) {
      fileInp.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => importPresetString(evt.target.result);
          reader.readAsText(file);
        }
        e.target.value = "";
      };
    }
  }

  /* Only surfaces that actually have a fill to strengthen.

     "Tab bar" and "Top bar buttons" used to be listed here. Both bars lost
     their backgrounds - the nav and the toolbar icons sit straight on the page
     now - and nothing in the stylesheets reads `--topbar-opacity` or
     `--widget-bg-alpha` any more. Two sliders that visibly did nothing were
     worse than no sliders: they read as broken. Any value already stored for
     those keys is left in place and simply ignored. */
  const SURFACES = [
    { key: "search", label: "Search bar" },
    { key: "boards", label: "Boards and cards" },
    { key: "notes", label: "Notepad" },
    { key: "panels", label: "Panels and dialogs" },
  ];

  function render(settings, data) {
    const overallStrength = Math.round(S.overallStrength(settings));
    const resolvedStrengths = S.surfaceStrengths(settings);
    const overrides = settings.surfaceOpacity || {};
    const hasOverride = (key) => typeof overrides[key] === "number";
    const surfaceValue = (key) => Math.round(resolvedStrengths[key]);
    // "Auto" rather than a bare number when a surface is still following the
    // overall slider, so the two states are told apart at a glance.
    const surfaceLabel = (key) =>
      hasOverride(key) ? `${surfaceValue(key)}%` : `Auto · ${surfaceValue(key)}%`;
    const surfaceOverrideCount = SURFACES.filter((sf) => hasOverride(sf.key)).length;

    const isSolidMode =
      settings.backgroundType === "solid" || !settings.backgroundType;

    const activePreset = settings.preset || "";
    const activeName =
      activePreset === "custom"
        ? "Custom"
        : activePreset === "wallpaper"
          ? "Wallpaper"
          : presetById(activePreset)?.name || "Default";

    const safePreviewColor = (value, fallback) =>
      HEX6.test(value || "") ? value : fallback;
    const previewPair = (base, accent) => `
      <span class="preset-swatch-pair" aria-hidden="true">
        <i class="preset-swatch-dot preset-swatch-base" style="background:${base}"></i>
        <i class="preset-swatch-dot preset-swatch-accent" style="background:${accent}"></i>
      </span>`;
    const currentBase = safePreviewColor(
      settings.solidSeed,
      safePreviewColor(settings.backgroundValue, "var(--page-bg)"),
    );
    const currentAccent = safePreviewColor(
      settings.accentOverride || settings.accentColor,
      "var(--accent-color)",
    );

    const presetBtn = (p) => {
      const full = p ? p.name : "Default";
      const short = p
        ? full.replace(new RegExp("^" + p.group + " "), "")
        : full;
      return `
        <button class="preset-swatch ${activePreset === (p ? p.id : "") ? "selected" : ""}"
                data-preset="${p ? p.id : ""}" aria-pressed="${activePreset === (p ? p.id : "")}"
                title="${escapeHtml(full)}">
          ${previewPair(
            p ? safePreviewColor(p.accent, "var(--page-bg)") : "var(--page-bg)",
            p ? safePreviewColor(p.accent2, p.accent) : "var(--accent-color)",
          )}
          <span class="preset-swatch-name">${escapeHtml(short)}</span>
        </button>`;
    };

    const customChip =
      activePreset === "custom"
        ? `
        <button class="preset-swatch selected" data-preset="" aria-pressed="true" title="Custom">
          ${previewPair(currentBase, currentAccent)}
          <span class="preset-swatch-name">Custom</span>
        </button>`
        : "";

    const homeVisibilityHtml = `
      <div class="st-accordion is-expanded" data-page="home" data-accordion-key="home visibility">
        <button class="st-accordion-header" type="button">
          <span class="st-group-title">Home visibility</span>
          <svg class="st-accordion-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="st-accordion-body">
          <div class="st-card" style="display:flex; flex-direction:column; gap:12px;">
            <div class="st-row"><label class="st-label" for="stDisplayName">Your name</label><input type="text" id="stDisplayName" class="st-input" maxlength="24" placeholder="Optional" value="${escapeHtml(settings.displayName || "")}" /></div>
            <div class="st-row"><label class="st-label">Clock</label><input type="checkbox" id="wClockToggle" ${settings.widgets?.clock !== false ? "checked" : ""} /></div>
            <div class="st-row"><label class="st-label" for="wGreetingToggle">Greeting</label><input type="checkbox" id="wGreetingToggle" ${settings.widgets?.greeting !== false ? "checked" : ""} /></div>
            <div class="st-row"><label class="st-label">Search bar</label><input type="checkbox" id="wSearchToggle" ${settings.widgets?.navSearch !== false ? "checked" : ""} /></div>
            <div class="st-row"><label class="st-label">App launcher</label><input type="checkbox" id="wWorkspaceToggle" ${settings.widgets?.workspace !== false ? "checked" : ""} /></div>
            <div class="st-row"><label class="st-label">Date</label><input type="checkbox" id="wDateToggle" ${settings.widgets?.date ? "checked" : ""} /></div>
            <div class="st-row"><label class="st-label">Weather</label><input type="checkbox" id="wWeatherToggle" ${settings.widgets?.weather ? "checked" : ""} /></div>
            <div class="st-row"><label class="st-label">Pinned links</label><input type="checkbox" id="wPinnedLinksToggle" ${!settings.hidePinnedOnHome ? "checked" : ""} /></div>
            <div class="st-row"><label class="st-label" for="wPinsPosition">Pinned links position</label>${CustomSelect.render({ id: "wPinsPosition", value: ["left", "right", "bottom"].includes(settings.pinsPosition) ? settings.pinsPosition : "center", options: [{ value: "center", label: "Under search" }, { value: "left", label: "Left side" }, { value: "right", label: "Right side" }, { value: "bottom", label: "Bottom" }], style: "width:160px;" })}</div>
            <div class="st-row"><label class="st-label" for="wPinnedBoardsToggle">Pinned boards</label><input type="checkbox" id="wPinnedBoardsToggle" ${settings.widgets?.pinnedBoards !== false ? "checked" : ""} /></div>
            <div class="st-hint">Open boards from the board button in your pinned links. To choose which boards show, pin them from a board's menu.</div>
            <div class="st-row"><label class="st-label">Tasks from notes</label><input type="checkbox" id="wNotesTodosToggle" ${settings.widgets?.notesTodos !== false ? "checked" : ""} /></div>
            <div class="st-row"><label class="st-label" for="wTaskCount">Tasks shown</label>${CustomSelect.render({ id: "wTaskCount", value: settings.homeTaskCount === 5 ? "5" : "3", options: [{ value: "3", label: "3 tasks" }, { value: "5", label: "5 tasks" }], style: "width:130px;" })}</div>
            <div class="st-hint">Shows unchecked to-dos from your notes. Tick one to delete it - you can undo.</div>
          </div>
        </div>
      </div>`;

    let html = `
        <div class="st-container">
          ${homeVisibilityHtml}
          <div class="st-accordion is-expanded" data-page="presets" data-accordion-key="themes">
            <button class="st-accordion-header" type="button">
              <span class="st-group-title">Presets <span class="st-group-note">${escapeHtml(activeName)}</span></span>
              <svg class="st-accordion-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div class="st-accordion-body">
              <div class="st-card">
                <div class="preset-sub">Default</div>
                <div class="preset-grid">
                  ${customChip || presetBtn(null)}
                  ${
                    settings.backgroundType === "image" ||
                    settings.backgroundType === "video"
                      ? `
                  <button class="preset-swatch ${activePreset === "wallpaper" ? "selected" : ""}" id="btnExtractWallpaper" title="Extract from Wallpaper">
                    ${previewPair(
                      "var(--page-bg)",
                      safePreviewColor(
                        settings.wpExtractedAccent,
                        "var(--accent-color)",
                      ),
                    )}
                    <span class="preset-swatch-name">Wallpaper</span>
                  </button>`
                      : ""
                  }
                </div>
                ${PRESET_GROUPS.map(
                  (g) => `
                  <div class="preset-sub">${g}</div>
                  <div class="preset-grid">
                    ${PRESETS.filter((p) => p.group === g)
                      .map(presetBtn)
                      .join("")}
                  </div>`,
                ).join("")}
              </div>
            </div>
          </div>

          <div class="st-accordion is-expanded" data-page="themes" data-accordion-key="theme and colours">
            <button class="st-accordion-header" type="button">
              <span class="st-group-title">Colours and background</span>
              <svg class="st-accordion-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div class="st-accordion-body">
              <div class="st-card" style="display:flex; flex-direction:column; gap:14px;">
            <div class="mynt-mode-seg" role="group" aria-label="Colour mode">
              <button class="mynt-seg-btn ${settings.mode === "light" ? "active" : ""}" data-mode="light" aria-pressed="${settings.mode === "light"}">Light</button>
              <button class="mynt-seg-btn ${settings.mode === "dark" ? "active" : ""}" data-mode="dark" aria-pressed="${settings.mode === "dark"}">Dark</button>
              <button class="mynt-seg-btn ${settings.mode === "system" ? "active" : ""}" data-mode="system" aria-pressed="${settings.mode === "system"}">System</button>
            </div>
            <div class="st-row">
              <label class="st-label" for="stAccent1Picker">Primary accent</label>
              <input type="color" id="stAccent1Picker" class="st-color" value="${effectiveAccent()}" />
            </div>
            <div class="st-row">
              <label class="st-label" for="stAccentGradientToggle">Two-tone accent</label>
              <input type="checkbox" id="stAccentGradientToggle" ${settings.accentGradient ? "checked" : ""} />
            </div>
            <div class="st-row"${settings.accentGradient ? "" : ' hidden'} id="stAccent2Row">
              <label class="st-label" for="stAccent2Picker">Secondary accent</label>
              <input type="color" id="stAccent2Picker" class="st-color" value="${HEX6.test(settings.accent2 || "") ? settings.accent2 : effectiveAccent()}" />
            </div>
            <button id="stAccentResetBtn" class="st-action-btn st-icon-reset" style="margin-top:2px;">Reset accent colors</button>
            <div class="st-row">
              <label class="st-label" for="myntColorPicker">Base background</label>
              <input type="color" id="myntColorPicker" class="st-color"
                     value="${/^#[0-9a-f]{6}$/i.test(settings.solidSeed || "") ? settings.solidSeed : settings.mode === "light" ? "#c7d2fe" : "#090a0f"}" />
            </div>
            <div class="st-hint">Used when no wallpaper is set.</div>
              </div>
            </div>
          </div>

          <!-- The picker is authored here, beside the colours it replaces, but
               it belongs to the Wallpaper page with the crop and blur controls
               that act on whatever it loads. -->
          <div class="st-accordion is-expanded" data-page="wallpaper" data-accordion-key="wallpaper source">
            <button class="st-accordion-header" type="button">
              <span class="st-group-title">Wallpaper source</span>
              <svg class="st-accordion-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div class="st-accordion-body">
              <div class="st-card" style="display:flex; flex-direction:column; gap:12px;">
            <div>
              <label class="st-row" style="cursor:pointer; justify-content:flex-start; gap:8px; padding:0;">
                <input type="checkbox" id="themeWpToggle" ${!isSolidMode ? "checked" : ""} />
                <span class="st-label" style="font-weight:600;">Use a wallpaper</span>
              </label>
              <div id="themeWpControls" style="display:${!isSolidMode ? "flex" : "none"}; flex-direction:column; gap:12px; margin-top:10px;">
                <div class="st-wallpaper-source-row">
                  <button class="mynt-wp-upload-btn st-icon-upload" id="wpUploadBtn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="20" height="20" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    <span>Upload media</span>
                  </button>
                  <span class="st-wallpaper-or">or</span>
                  <div class="st-wallpaper-url-row">
                    <input type="text" id="wpUrlInp" class="st-input" placeholder="Paste photo or .mp4 URL…" />
                    <button id="wpUrlApplyBtn" class="st-action-btn st-icon-link">Use URL</button>
                  </div>
                </div>

                </div>
              </div>
              </div>
            </div>
          </div>

          <!-- Surface strength, the ambient wash and performance mode all
               describe how the interface itself is painted, so they sit with
               shape and type on the Appearance page rather than with the
               colours that happen to feed them. -->
          <div class="st-accordion is-expanded" data-page="appearance" data-accordion-key="interface background">
            <button class="st-accordion-header" type="button">
              <span class="st-group-title">Interface background</span>
              <svg class="st-accordion-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div class="st-accordion-body">
              <div class="st-card" style="display:flex; flex-direction:column; gap:14px;">
            ${
              isSolidMode
                ? `
            <div class="st-subgroup">
              <div class="st-subhead">Background depth</div>
              <label class="st-row" style="cursor:pointer; justify-content:flex-start; gap:8px;">
                <input type="checkbox" id="stSolidAmbient" ${settings.solidAmbient !== false ? "checked" : ""} />
                <span class="st-label">Ambient colour wash</span>
              </label>
              <div class="st-hint">Adds a soft glow of your accent colour to a plain background.</div>
            </div>`
                : ""
            }

            <div class="st-subgroup">
              <div class="st-subhead">Interface background</div>
              <div class="st-slider-row">
                <div class="se-label"><span>Overall strength</span> <span id="stInterfaceOpacityVal" data-slider-val="stInterfaceOpacity" data-slider-suffix="%">${overallStrength}%</span></div>
                <input type="range" class="se-slider" id="stInterfaceOpacity" min="0" max="100" step="1" value="${overallStrength}" />
              </div>
              <div class="st-hint">How solid boards, the search bar and panels are. 100% is fully solid.</div>

              <div class="st-accordion" data-accordion-key="per-surface strength">
                <button class="st-accordion-header" type="button">
                  <span class="st-group-title">Per-surface strength${
                    surfaceOverrideCount
                      ? ` <span class="st-group-note">${surfaceOverrideCount} custom</span>`
                      : ""
                  }</span>
                  <svg class="st-accordion-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
                </button>
                <div class="st-accordion-body">
                  <div class="st-card" style="display:flex; flex-direction:column; gap:12px;">
                    <div class="st-hint">Each one follows the slider above until you change it. Press <b>Auto</b> to reset it.</div>
                    ${SURFACES.map(
                      (sf) => `
                      <div class="st-slider-row" data-surface-row="${sf.key}">
                        <div class="se-label">
                          <span>${sf.label}</span>
                          <span class="st-surface-val" data-surface-val="${sf.key}" data-slider-val-key="${sf.key}" data-slider-suffix="%">${surfaceLabel(sf.key)}</span>
                        </div>
                        <div class="st-surface-controls">
                          <input type="range" class="se-slider" data-surface-slider="${sf.key}" min="0" max="100" step="1" value="${surfaceValue(sf.key)}" />
                          <button type="button" class="st-surface-auto" data-surface-auto="${sf.key}"${
                            hasOverride(sf.key) ? "" : " disabled"
                          }>Auto</button>
                        </div>
                      </div>`,
                    ).join("")}
                  </div>
                </div>
              </div>
            </div>

            <div class="st-subgroup">
              <div class="st-subhead">Performance</div>
              <label class="st-row" style="cursor:pointer; justify-content:flex-start; gap:8px;">
                <input type="checkbox" id="stPerformanceMode" ${settings.performanceMode ? "checked" : ""} />
                <span class="st-label">Performance mode</span>
              </label>
              <div class="st-hint">Less animation and fewer effects. Video wallpapers pause.</div>
            </div>

              </div>
            </div>
          </div>

          <div class="st-accordion is-expanded" data-page="presets">
            <button class="st-accordion-header" type="button">
              <span class="st-group-title">Share your theme</span>
              <svg class="st-accordion-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div class="st-accordion-body">
              <div class="st-card">
                <div class="st-subgroup">
                  <div class="st-subhead">Share this theme</div>
                  <button id="btnExportPresetCode" class="st-action-btn primary st-icon-copy" style="width:100%;">Copy my theme code</button>
                </div>
                <div class="st-subgroup">
                  <div class="st-subhead">Use someone else's theme</div>
                  <div style="display:flex; gap:6px;">
                    <input type="text" id="inpImportPresetCode" class="st-input" placeholder="Paste a theme code here" style="flex:1;" />
                    <button id="btnImportPresetCode" class="st-action-btn primary st-icon-check" style="padding:8px 14px; flex-shrink:0;">Apply</button>
                  </div>
                  <button id="btnImportPresetFileTrigger" class="st-action-btn st-icon-upload" style="width:100%;">Load theme from file</button>
                  <input type="file" id="inpImportPresetFile" accept=".json" aria-label="Preset file" style="display:none;" />
                </div>
              </div>
            </div>
          </div>

        </div>
      `;

    return html;
  }

  S.registerTab("theme", { render, bind: bindThemeEvents, autoExtractColor });
})();
