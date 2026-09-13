"use strict";

(() => {
  const S = window.SettingsShared;

  const GROUPS = [
    ["web", "Web search"],
    ["ai", "AI assistants"],
    ["sites", "Search a site"],
  ];

  const chevron = `<svg class="st-accordion-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>`;

  function render(settings) {
    const engines = WidgetsRenderer.getEngines();
    const enabled =
      settings.enabledEngines || StorageManager.DEFAULT_SETTINGS.enabledEngines;
    const barHidden = settings.widgets?.navSearch === false;

    const groups = GROUPS.map(([group, label]) => {
      const rows = Object.entries(engines).filter(
        ([, eng]) => (eng.group || "web") === group,
      );
      if (!rows.length) return "";
      return `
        <div class="st-eng-group" role="group" aria-label="${label}">
          <div class="st-eng-group-title">${label}</div>
          <div class="st-eng-grid">
            ${rows
              .map(([key, eng]) => {
                const locked = key === "default";
                const on = locked || enabled.includes(key);
                return `
              <label class="st-eng-row${on ? " is-on" : ""}">
                ${WidgetsRenderer.engineIcon(key, 20)}
                <span class="st-eng-name">${escapeHtml(eng.name)}</span>
                <input type="checkbox" class="st-eng-chk" data-eng-key="${key}" ${on ? "checked" : ""} ${locked ? "disabled" : ""} aria-label="Show ${escapeHtml(eng.name)} in the search menu" />
              </label>`;
              })
              .join("")}
          </div>
        </div>`;
    }).join("");

    return `
      <div class="st-container">
        <div class="st-accordion is-expanded" data-page="search">
          <button class="st-accordion-header" type="button">
            <span class="st-group-title">Engines in the menu</span>
            ${chevron}
          </button>
          <div class="st-accordion-body">
            <div class="st-card" id="stEngineList" style="display:flex; flex-direction:column; gap:14px;">
              ${barHidden ? `<div class="st-hint">The search bar is hidden. Turn it on in Home page settings.</div>` : ""}
              <div class="st-hint">Pick the engines you want in the search bar menu. Choose which one to use from the search bar itself.</div>
              ${groups}
            </div>
          </div>
        </div>
      </div>`;
  }

  function bind() {
    const live = () => StorageManager.getSettings();
    wireFavicons($("stEngineList"));
    const checkboxes = () => [...document.querySelectorAll(".st-eng-chk")];

    const applyEnabled = (keys) => {
      const s = live();
      s.enabledEngines = ["default", ...keys.filter((k) => k !== "default")];
      StorageManager.saveSettings();
    };

    checkboxes().forEach((chk) => {
      chk.addEventListener("change", () => {
        chk.closest(".st-eng-row")?.classList.toggle("is-on", chk.checked);
        const keys = checkboxes().filter((c) => c.checked).map((c) => c.dataset.engKey);
        applyEnabled(keys);

        const s = live();
        if (!s.enabledEngines.includes(s.searchEngine)) {
          s.searchEngine = "default";
          StorageManager.saveSettings();
        }
        WidgetsRenderer.initNavSearch();
      });
    });
  }

  S.registerTab("search", { render, bind });
})();
