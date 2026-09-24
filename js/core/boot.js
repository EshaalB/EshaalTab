"use strict";
(function () {
  var root = document.documentElement;
  try {
    var mem = navigator.deviceMemory;
    var cores = navigator.hardwareConcurrency;
    if ((mem && mem <= 4) || (cores && cores <= 4)) root.classList.add("is-lite");
  } catch (e) {}
  try {
    var raw = localStorage.getItem("et_boot");
    if (!raw) return;
    var b = JSON.parse(raw);
    if (b.lite) root.classList.add("is-lite");
    if (typeof b.pageBg === "string" && /^#[0-9a-f]{3,6}$/i.test(b.pageBg)) {
      root.style.setProperty("--page-bg", b.pageBg);
      root.style.backgroundColor = b.pageBg;
    }
    if (b.mode === "light" || b.mode === "dark") {
      root.style.colorScheme = b.mode;
      root.classList.add("boot-" + b.mode);
    }
  } catch (e) {}
})();
