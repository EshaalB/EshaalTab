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

    delete s.wpExtractedAccent;
    if (p) {
      s.mode = p.mode;
      s.modeLocked = true;

      s.solidSeed = p.seed || p.accent;
      delete s.solidExact;
      s.accentColor = p.accent;

      s.accent2 = p.accent2 || "";
      s.cornerRadius = CORNER_STYLES[0].value;
      s.clockColor = "";
      s.greetingColor = "";
      s.metaColor = "";

      if (s.backgroundType && s.backgroundType !== "solid") {
        s.backgroundType = "solid";
        s.backgroundValue = p.seed || p.accent;

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
    if (typeof p.solidExact === "boolean") s.solidExact = p.solidExact;
    else delete s.solidExact;
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
      solidExact: !!s.solidExact,
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

  const toBase64 = (text) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(text)));

  const fromBase64 = (b64) =>
    new TextDecoder().decode(
      Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)),
    );

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

  const SAMPLE = 64;

  const BAND = 0.2;

  function analyzeWallpaper(data, size) {
    const buckets = new Map();
    const bandRows = Math.max(1, Math.round(size * BAND));

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

      const usable = Math.max(0.04, 1 - Math.pow((lum - 0.5) / 0.5, 4));
      const score = e.n * (chroma * chroma * 3 + 0.05) * usable;
      if (score > bestScore) {
        bestScore = score;
        best = Contrast.toHex({ r, g, b });
      }
    }
    return best || "#6366f1";
  }

  function applyExtracted(data, size, toneOnly = false) {
    const tone = analyzeWallpaper(data, size);
    const settings = StorageManager.getSettings();
    if (!toneOnly) {
      delete settings.accentOverride;

      const accent = Contrast.tint(
        tone.accent,
        Contrast.isLight(tone.overall) ? "light" : "dark",
      );

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
    bindHomeToggle("wLibraryToggle", "library");
    bindHomeToggle("wFocusTimerToggle", "focusTimer");
    bindHomeToggle("wPaletteToggle", "palette");
    bindHomeToggle("wDateToggle", "date");
    bindHomeToggle("wWeatherToggle", "weather");
    $("wPinnedLinksToggle")?.addEventListener("change", (e) => {
      settings.hidePinnedOnHome = !e.target.checked;
      StorageManager.saveSettings();
      WidgetsRenderer.applyWidgetVisibility();
      HomeRenderer.render();
    });

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
      WidgetsRenderer.applyWidgetVisibility();
      HomeRenderer.render();
    });

    $("btnExtractWallpaper")?.addEventListener("click", async () => {
      delete settings.accentOverride;
      settings.preset = "wallpaper";
      if (settings.wpExtractedAccent) {
        delete settings.accentOverride;
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
      settings.solidExact = true;

      settings.backgroundValue = e.target.value;

      const hadWallpaper =
        settings.backgroundType === "image" || settings.backgroundType === "video";
      if (hadWallpaper) {
        settings.backgroundType = "solid";
        settings.backgroundValue = e.target.value;
        delete settings.wpExtractedAccent;
        const videoBg = $("video-bg");
        if (videoBg) {
          videoBg.pause();
          videoBg.classList.remove("active");
        }
      }

      settings.preset = "custom";
      StorageManager.saveSettings();
      applyTheme();
      if (hadWallpaper) {
        renderSideSheetContent();
        ToastSystem.info("Switched to solid colour mode");
      }
    });
    $("myntColorPicker")?.addEventListener("change", () => {
      renderSideSheetContent();
      ToastSystem.success("Base colour applied");
    });

    $("stAccent1Picker")?.addEventListener("input", (e) => {
      settings.accentOverride = e.target.value;
      settings.preset = "custom";
      StorageManager.saveSettings();
      applyTheme();
    });

    $("stAccentGradientToggle")?.addEventListener("change", (e) => {
      settings.accentGradient = e.target.checked;

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
      settings.surfaceOpacity = {};
      settings.boardOpacity = settings.interfaceOpacity / 100;
      $("stInterfaceOpacityVal").textContent = `${e.target.value}%`;
      StorageManager.saveSettings();
      paintNextFrame("theme", applyTheme);

      paintSurfaceLabels();
    });

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

  const SURFACES = [
    { key: "topbar", label: "Top bar" },
    { key: "widgets", label: "To-do list" },
    { key: "pins", label: "Pinned links" },
    { key: "search", label: "Search bar" },
    { key: "boards", label: "Boards and cards" },
    { key: "notes", label: "Notepad" },
  ];

  function render(settings, data) {
    const overallStrength = Math.round(S.overallStrength(settings));
    const resolvedStrengths = S.surfaceStrengths(settings);
    const overrides = settings.surfaceOpacity || {};
    const hasOverride = (key) => typeof overrides[key] === "number";
    const surfaceValue = (key) => Math.round(resolvedStrengths[key]);

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
            <div class="st-row"><label class="st-label">Date</label><input type="checkbox" id="wDateToggle" ${settings.widgets?.date ? "checked" : ""} /></div>
            <div class="st-row"><label class="st-label">Weather</label><input type="checkbox" id="wWeatherToggle" ${settings.widgets?.weather ? "checked" : ""} /></div>
            <div class="st-row"><label class="st-label">Tasks from notes</label><input type="checkbox" id="wNotesTodosToggle" ${settings.widgets?.notesTodos !== false ? "checked" : ""} /></div>
            <div class="st-hint">Shows unchecked to-dos from your notes. Tick one to delete it - you can undo.</div>
          </div>
        </div>
      </div>
      <div class="st-accordion is-expanded" data-page="home" data-accordion-key="pinned links">
        <button class="st-accordion-header" type="button">
          <span class="st-group-title">Pinned links</span>
          <svg class="st-accordion-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="st-accordion-body">
          <div class="st-card" style="display:flex; flex-direction:column; gap:12px;">
            <div class="st-row"><label class="st-label">Show pinned links</label><input type="checkbox" id="wPinnedLinksToggle" ${!settings.hidePinnedOnHome ? "checked" : ""} /></div>
            <div class="st-row"><label class="st-label" for="wPinsPosition">Position</label>${CustomSelect.render({ id: "wPinsPosition", value: ["left", "right", "bottom"].includes(settings.pinsPosition) ? settings.pinsPosition : "center", options: [{ value: "center", label: "Under search" }, { value: "left", label: "Left side" }, { value: "right", label: "Right side" }, { value: "bottom", label: "Bottom" }], style: "width:160px;" })}</div>
            <div class="st-row"><label class="st-label" for="wPinnedBoardsToggle">Pinned boards</label><input type="checkbox" id="wPinnedBoardsToggle" ${settings.widgets?.pinnedBoards !== false ? "checked" : ""} /></div>
            <div class="st-hint">Open boards from the board button in your pinned links. To choose which boards show, pin them from a board's menu.</div>
          </div>
        </div>
      </div>
      <div class="st-accordion is-expanded" data-page="home" data-accordion-key="top bar">
        <button class="st-accordion-header" type="button">
          <span class="st-group-title">Top bar</span>
          <svg class="st-accordion-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="st-accordion-body">
          <div class="st-card" style="display:flex; flex-direction:column; gap:12px;">
            <div class="st-row"><label class="st-label" for="wLibraryToggle">Library</label><input type="checkbox" id="wLibraryToggle" ${settings.widgets?.library !== false ? "checked" : ""} /></div>
            <div class="st-row"><label class="st-label" for="wFocusTimerToggle">Focus timer</label><input type="checkbox" id="wFocusTimerToggle" ${settings.widgets?.focusTimer !== false ? "checked" : ""} /></div>
            <div class="st-row"><label class="st-label" for="wPaletteToggle">Command palette</label><input type="checkbox" id="wPaletteToggle" ${settings.widgets?.palette !== false ? "checked" : ""} /></div>
            <div class="st-row"><label class="st-label" for="wWorkspaceToggle">App launcher</label><input type="checkbox" id="wWorkspaceToggle" ${settings.widgets?.workspace !== false ? "checked" : ""} /></div>
            <div class="st-hint">Settings always stays in the top bar. Ctrl+K opens the command palette even when its button is hidden.</div>
          </div>
        </div>
      </div>`;

    let html = `
        <div class="st-container">
          ${homeVisibilityHtml}
          <div class="st-accordion is-expanded" data-page="appearance" data-accordion-key="themes">
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

          <div class="st-accordion is-expanded" data-page="appearance" data-accordion-key="theme and colours">
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

          <div class="st-accordion is-expanded" data-page="appearance">
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
