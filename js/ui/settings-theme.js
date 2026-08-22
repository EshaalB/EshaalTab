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
      s.cornerRadius = "default";
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
    if (["default", "0px", "8px", "16px", "9999px"].includes(p.cornerRadius))
      s.cornerRadius = p.cornerRadius;
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
      cornerRadius: s.cornerRadius || "default",
    };
  }

  function exportPresetCode() {
    const p = generatePresetObject();
    const str = "ESH-" + btoa(JSON.stringify(p));
    navigator.clipboard
      .writeText(str)
      .then(() => {
        ToastSystem.success("Theme code copied");
      })
      .catch(() => {
        ToastSystem.info("Preset code created");
      });
  }

  function exportPresetFile() {
    const p = generatePresetObject();
    const blob = new Blob([JSON.stringify(p, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `eshaaltab-preset-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    ToastSystem.success("Theme downloaded");
  }

  function importPresetString(str) {
    str = (str || "").trim();
    if (!str) return false;
    let jsonStr = str;
    if (str.startsWith("ESH-")) {
      try {
        jsonStr = atob(str.slice(4));
      } catch {}
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

  function dominantColor(data) {
    const buckets = new Map();
    let lr = 0,
      lg = 0,
      lb = 0,
      ln = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2],
        a = data[i + 3];
      if (a < 125) continue;
      lr += r;
      lg += g;
      lb += b;
      ln++;
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      let e = buckets.get(key);
      if (!e) {
        e = { r: 0, g: 0, b: 0, n: 0 };
        buckets.set(key, e);
      }
      e.r += r;
      e.g += g;
      e.b += b;
      e.n++;
    }
    let best = null,
      bestScore = -1;
    for (const e of buckets.values()) {
      const r = e.r / e.n,
        g = e.g / e.n,
        b = e.b / e.n;
      const mx = Math.max(r, g, b),
        mn = Math.min(r, g, b);
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const sat = mx === 0 ? 0 : (mx - mn) / mx;
      const lumPen = lum < 0.06 || lum > 0.96 ? 0.08 : 1;
      const score = e.n * (sat * sat * 3 + 0.05) * lumPen;
      if (score > bestScore) {
        bestScore = score;
        best = { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
      }
    }
    return {
      color: best || { r: 100, g: 100, b: 110 },
      avgLum: ln ? (0.2126 * lr + 0.7152 * lg + 0.0722 * lb) / (ln * 255) : 0.5,
    };
  }

  function applyExtracted(data) {
    const { color, avgLum } = dominantColor(data);
    const toHex = (c) =>
      "#" + ((1 << 24) + (c.r << 16) + (c.g << 8) + c.b).toString(16).slice(1);
    const settings = StorageManager.getSettings();
    delete settings.accentOverride;
    const hex = toHex(color);
    settings.accentColor = hex;
    settings.wpExtractedAccent = hex;
    if (settings.mode !== "system" && !settings.modeLocked) {
      settings.mode = avgLum > 0.5 ? "light" : "dark";
    }
    settings.preset = "wallpaper";
    StorageManager.save();
    applyTheme();
    renderSideSheetContent();
  }

  async function autoExtractColor(rawMediaUrl, isVideo = false) {
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
            canvas.width = 60;
            canvas.height = 60;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(video, 0, 0, 60, 60);

            applyExtracted(ctx.getImageData(0, 0, 60, 60).data);
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
          const ctx = canvas.getContext("2d");
          canvas.width = 60;
          canvas.height = 60;
          ctx.drawImage(img, 0, 0, 60, 60);

          applyExtracted(ctx.getImageData(0, 0, 60, 60).data);
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
    bindHomeToggle("wSearchToggle", "navSearch");
    bindHomeToggle("wTodoToggle", "todo");
    bindHomeToggle("wWorkspaceToggle", "workspace");
    bindHomeToggle("wWeatherToggle", "weather");
    $("wPinnedLinksToggle")?.addEventListener("change", (e) => {
      settings.hidePinnedOnHome = !e.target.checked;
      StorageManager.saveSettings();
      WidgetsRenderer.applyWidgetVisibility();
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
    $("btnExportPresetFile")?.addEventListener("click", exportPresetFile);

    $("stWpFit")?.addEventListener("change", (e) => {
      settings.wallpaperFit = e.target.value;
      StorageManager.saveSettings();
      paintNextFrame("wallpaper", applyWallpaperStyle);
    });

    $("stWpZoom")?.addEventListener("input", (e) => {
      settings.wallpaperZoom = parseInt(e.target.value);
      const valEl = $("stWpZoomVal");
      if (valEl) valEl.textContent = `${e.target.value}%`;
      StorageManager.saveSettings();
      paintNextFrame("wallpaper", applyWallpaperStyle);
    });

    $("stWpPosX")?.addEventListener("input", (e) => {
      settings.wallpaperPosX = parseInt(e.target.value);
      const valEl = $("stWpPosXVal");
      if (valEl) valEl.textContent = `${e.target.value}%`;
      StorageManager.saveSettings();
      paintNextFrame("wallpaper", applyWallpaperStyle);
    });

    $("stWpPosY")?.addEventListener("input", (e) => {
      settings.wallpaperPosY = parseInt(e.target.value);
      const valEl = $("stWpPosYVal");
      if (valEl) valEl.textContent = `${e.target.value}%`;
      StorageManager.saveSettings();
      paintNextFrame("wallpaper", applyWallpaperStyle);
    });

    $("stWpOverlayToggle")?.addEventListener("change", (e) => {
      settings.wallpaperOverlay = e.target.checked;
      const row = $("stWpOverlayOpacityRow");
      if (row) row.style.display = e.target.checked ? "flex" : "none";
      StorageManager.saveSettings();
      paintNextFrame("overlay", applyWallpaperOverlay);
    });

    $("stWpOverlayOpacity")?.addEventListener("input", (e) => {
      settings.wallpaperOverlayOpacity = parseInt(e.target.value);
      const valEl = $("stWpOverlayOpacityVal");
      if (valEl) valEl.textContent = `${e.target.value}%`;
      StorageManager.saveSettings();
      paintNextFrame("overlay", applyWallpaperOverlay);
    });

    $("stWpMuteToggle")?.addEventListener("change", (e) => {
      settings.wallpaperMuted = e.target.checked;
      StorageManager.saveSettings();
      paintNextFrame("wallpaper", applyWallpaperStyle);
    });

    $("stWpVolume")?.addEventListener("input", (e) => {
      settings.wallpaperVolume = parseFloat(e.target.value) / 100;
      const valEl = $("stWpVolumeVal");
      if (valEl) valEl.textContent = `${e.target.value}%`;
      StorageManager.saveSettings();
      paintNextFrame("wallpaper", applyWallpaperStyle);
    });

    $$(".wp-gallery-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        if (e.target.closest(".wp-gallery-del")) return;
        const val = item.dataset.wpVal;
        const type = item.dataset.wpType;
        applyWallpaper(type, val);
        renderSideSheetContent();
        ToastSystem.success("Wallpaper switched");
      });
    });

    $$(".wp-gallery-del").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const val = btn.getAttribute("data-wp-del") || btn.dataset.wpDel;
        if (!val) return;
        data.wallpapers = (data.wallpapers || []).filter(
          (w) => w.value !== val,
        );
        StorageManager.save();
        if (StorageManager.isMediaRef(val)) {
          await StorageManager.delMedia(StorageManager.refId(val));
        }
        if (settings.backgroundValue === val) {
          const remaining =
            data.wallpapers && data.wallpapers.length
              ? data.wallpapers[data.wallpapers.length - 1]
              : null;
          if (remaining) {
            applyWallpaper(remaining.type, remaining.value);
          } else {
            applyWallpaper(
              "solid",
              settings.solidSeed ||
                (settings.mode === "light" ? "#f8fafc" : "#0d1117"),
            );
          }
        }
        renderSideSheetContent();
        ToastSystem.info("Wallpaper removed");
      });
    });

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

  function render(settings, data) {
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
      <div class="st-accordion is-expanded" data-accordion-key="home visibility">
        <button class="st-accordion-header" type="button">
          <span class="st-group-title">Home visibility</span>
          <svg class="st-accordion-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="st-accordion-body">
          <div class="st-card" style="display:flex; flex-direction:column; gap:12px;">
            <div class="st-row"><label class="st-label" for="stDisplayName">Your name</label><input type="text" id="stDisplayName" class="st-input" maxlength="24" placeholder="Optional" value="${escapeHtml(settings.displayName || "")}" /></div>
            <div class="st-row"><label class="st-label">Clock</label><input type="checkbox" id="wClockToggle" ${settings.widgets?.clock !== false ? "checked" : ""} /></div>
            <div class="st-row"><label class="st-label">Search bar</label><input type="checkbox" id="wSearchToggle" ${settings.widgets?.navSearch !== false ? "checked" : ""} /></div>
            <div class="st-row"><label class="st-label">Task list</label><input type="checkbox" id="wTodoToggle" ${settings.widgets?.todo !== false ? "checked" : ""} /></div>
            <div class="st-row"><label class="st-label">App launcher</label><input type="checkbox" id="wWorkspaceToggle" ${settings.widgets?.workspace !== false ? "checked" : ""} /></div>
            <div class="st-row"><label class="st-label">Weather</label><input type="checkbox" id="wWeatherToggle" ${settings.widgets?.weather ? "checked" : ""} /></div>
            <div class="st-row"><label class="st-label">Pinned links</label><input type="checkbox" id="wPinnedLinksToggle" ${!settings.hidePinnedOnHome ? "checked" : ""} /></div>
          </div>
        </div>
      </div>`;

    let html = `
        <div class="st-container">
          ${homeVisibilityHtml}
          <div class="st-accordion is-expanded" data-accordion-key="themes">
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

          <div class="st-accordion is-expanded" data-accordion-key="theme and colours">
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
            <div class="st-hint">Note: Base background colour applies when wallpaper is off.</div>

            <div style="border-top:1px solid var(--border-soft); padding-top:12px; margin-top:4px;">
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

                <div class="st-accordion st-quick-wallpaper-advanced is-expanded">
                  <button class="st-accordion-header" type="button">
                    <span class="st-group-title">Position and crop</span>
                    <svg class="st-accordion-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
                  </button>
                  <div class="st-accordion-body">
                    <div class="st-card" style="display:flex; flex-direction:column; gap:8px;">
                  <div class="st-row" style="padding:0; margin-bottom:8px;">
                    <span class="st-label">Fit</span>
                    ${CustomSelect.render({
                      id: "stWpFit",
                      value: settings.wallpaperFit || "cover",
                      options: [
                        { value: "cover", label: "Cover (Fill Screen)" },
                        { value: "contain", label: "Contain (Fit Screen)" },
                      ],
                    })}
                  </div>
                  <div class="se-label" style="display:flex; justify-content:space-between;">
                    <span>Zoom</span> <span id="stWpZoomVal">${settings.wallpaperZoom || 100}%</span>
                  </div>
                  <input type="range" class="se-slider" id="stWpZoom" min="10" max="500" step="5" value="${settings.wallpaperZoom || 100}" style="width:100%;" />

                  <div class="se-label" style="display:flex; justify-content:space-between; margin-top:4px;">
                    <span>Horizontal position</span> <span id="stWpPosXVal">${settings.wallpaperPosX ?? 50}%</span>
                  </div>
                  <input type="range" class="se-slider" id="stWpPosX" min="-300" max="300" step="1" value="${settings.wallpaperPosX ?? 50}" style="width:100%;" />

                  <div class="se-label" style="display:flex; justify-content:space-between; margin-top:4px;">
                    <span>Vertical position</span> <span id="stWpPosYVal">${settings.wallpaperPosY ?? 50}%</span>
                  </div>
                  <input type="range" class="se-slider" id="stWpPosY" min="-300" max="300" step="1" value="${settings.wallpaperPosY ?? 50}" style="width:100%;" />
                    </div>
                  </div>
                </div>

                <div class="st-quick-wallpaper-advanced" style="display:flex; flex-direction:column; gap:8px; border-top:1px solid var(--border-soft); padding-top:10px;">
                  <label class="st-row" style="cursor:pointer; justify-content:flex-start; gap:8px; padding:0;">
                    <input type="checkbox" id="stWpOverlayToggle" ${settings.wallpaperOverlay ? "checked" : ""} />
                    <span>Dim bright wallpapers</span>
                  </label>
                  <div class="st-hint">Bright wallpapers can wash out top icons. Turn this on to lay a dark overlay underneath.</div>
                  <div id="stWpOverlayOpacityRow" style="display:${settings.wallpaperOverlay ? "flex" : "none"}; flex-direction:column; gap:4px;">
                    <div class="se-label" style="display:flex; justify-content:space-between;">
                      <span>Dim amount</span> <span id="stWpOverlayOpacityVal">${settings.wallpaperOverlayOpacity ?? 35}%</span>
                    </div>
                    <input type="range" class="se-slider" id="stWpOverlayOpacity" min="0" max="90" step="5" value="${settings.wallpaperOverlayOpacity ?? 35}" style="width:100%;" />
                  </div>
                </div>

                ${
                  settings.backgroundType === "video"
                    ? `
                <div class="st-quick-wallpaper-advanced" style="display:flex; flex-direction:column; gap:8px; border-top:1px solid var(--border-soft); padding-top:10px;">
                  <label class="st-row" style="cursor:pointer; justify-content:flex-start; gap:8px; padding:0;">
                    <input type="checkbox" id="stWpMuteToggle" ${settings.wallpaperMuted !== false ? "checked" : ""} />
                    <span>Mute video</span>
                  </label>
                  <div class="se-label" style="display:flex; justify-content:space-between;">
                    <span>Volume</span> <span id="stWpVolumeVal">${Math.round((settings.wallpaperVolume ?? 0.5) * 100)}%</span>
                  </div>
                  <input type="range" class="se-slider" id="stWpVolume" min="0" max="100" step="5" value="${Math.round((settings.wallpaperVolume ?? 0.5) * 100)}" style="width:100%;" />
                </div>`
                    : ""
                }

                ${
                  data.wallpapers && data.wallpapers.length
                    ? `
                <div class="st-quick-wallpaper-advanced" style="border-top:1px solid var(--border-soft); padding-top:10px;">
                  <div class="st-label" style="margin-bottom:6px;">Saved wallpapers</div>
                  <div class="wp-gallery-grid">
                    ${data.wallpapers
                      .map(
                        (w) => `
                      <div class="wp-gallery-item ${w.value === settings.backgroundValue ? "active" : ""}" data-wp-val="${escapeHtml(w.value)}" data-wp-type="${w.type}">
                        <div class="wp-gallery-thumb" data-wp-thumb="${escapeHtml(w.value)}" data-wp-thumb-type="${w.type}"></div>
                        <button class="wp-gallery-del" data-wp-del="${escapeHtml(w.value)}" title="Delete wallpaper">&times;</button>
                      </div>
                    `,
                      )
                      .join("")}
                  </div>
                </div>
              `
                    : ""
                }
                </div>
              </div>

            ${
              isSolidMode
                ? `
            <div class="st-subgroup">
              <div class="st-subhead">Background depth</div>
              <label class="st-row" style="cursor:pointer; justify-content:flex-start; gap:8px;">
                <input type="checkbox" id="stSolidAmbient" ${settings.solidAmbient !== false ? "checked" : ""} />
                <span class="st-label">Ambient colour wash</span>
              </label>
              <div class="st-hint">Adds soft pools of your accent colour so a plain fill has some depth instead of looking flat.</div>
            </div>`
                : ""
            }

            <div class="st-subgroup">
              <div class="st-subhead">Interface background</div>
              <div class="st-slider-row">
                <div class="se-label"><span>Background strength</span> <span id="stInterfaceOpacityVal">${settings.interfaceOpacity ?? Math.round((settings.boardOpacity ?? 0.08) * 100)}%</span></div>
                <input type="range" class="se-slider" id="stInterfaceOpacity" min="0" max="100" step="1" value="${settings.interfaceOpacity ?? Math.round((settings.boardOpacity ?? 0.08) * 100)}" />
              </div>
              <div class="st-hint">Adjusts all filled interface surfaces while automatically preserving extra contrast for notes and small controls.</div>
            </div>

            <div class="st-subgroup">
              <div class="st-subhead">Performance</div>
              <label class="st-row" style="cursor:pointer; justify-content:flex-start; gap:8px;">
                <input type="checkbox" id="stPerformanceMode" ${settings.performanceMode ? "checked" : ""} />
                <span class="st-label">Performance mode</span>
              </label>
              <div class="st-hint">Reduces motion, shadows and decorative layers. Video wallpapers pause on their current frame.</div>
            </div>


            </div>
          </div>

          <div class="st-accordion is-expanded">
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
