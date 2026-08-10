"use strict";
(function () {
  try {
    var raw = localStorage.getItem("et_boot");
    if (!raw) return;
    var b = JSON.parse(raw);
    var root = document.documentElement;

    if (typeof b.pageBg === "string" && /^#[0-9a-f]{3,6}$/i.test(b.pageBg)) {
      root.style.setProperty("--page-bg", b.pageBg);
      root.style.backgroundColor = b.pageBg;
    }
    if (b.mode === "light" || b.mode === "dark") {
      root.style.colorScheme = b.mode;
      root.classList.add("boot-" + b.mode);
    }
    if (
      typeof b.preview === "string" &&
      /^data:image\/(?:jpeg|png|webp);base64,/i.test(b.preview)
    ) {
      root.style.backgroundImage = 'url("' + b.preview + '")';
      root.style.backgroundSize = "cover";
      root.style.backgroundPosition = "center";
      root.style.backgroundRepeat = "no-repeat";
      root.classList.add("boot-has-preview");
    }
  } catch (e) {}
})();
