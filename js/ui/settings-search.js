"use strict";

/**
 * Settings: Search engines.
 *
 * Its own page because it is a list rather than a switch: which engines the
 * search bar's menu offers, grouped and iconed the way that menu shows them.
 * The browser default cannot be switched off - it is what a search falls back
 * to, and it is the one route that leaves the choice of provider with the
 * browser, where the Web Store requires it to stay.
 */
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
    const current = engines[settings.searchEngine] ? settings.searchEngine : "default";
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
            <span class="st-group-title">Search engine</span>
            ${chevron}
          </button>
          <div class="st-accordion-body">
            <div class="st-card" style="display:flex; flex-direction:column; gap:12px;">
              ${barHidden ? `<div class="st-hint">The search bar is hidden. Turn it on in Home page settings.</div>` : ""}
              <div class="st-row">
                <label class="st-label" for="stSearchEngine">Search with</label>
                ${CustomSelect.render({
                  id: "stSearchEngine",
                  value: current,
                  options: Object.entries(engines).map(([key, eng]) => ({
                    value: key,
                    label: eng.name,
                  })),
                  style: "width:200px;",
                })}
              </div>
              <div class="st-hint">Default (Browser) uses your browser's own search engine. Other choices only change searches made from this page.</div>
            </div>
          </div>
        </div>

        <div class="st-accordion is-expanded" data-page="search">
          <button class="st-accordion-header" type="button">
            <span class="st-group-title">Engines in the menu</span>
            ${chevron}
          </button>
          <div class="st-accordion-body">
            <div class="st-card" id="stEngineList" style="display:flex; flex-direction:column; gap:14px;">
              <div class="st-hint">Pick the engines you want in the search bar menu.</div>
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

    $("stSearchEngine")?.addEventListener("change", (e) => {
      const key = e.target.dataset?.value ?? e.target.value;
      const s = live();
      s.searchEngine = key;
      // Choosing an engine puts it in the menu, so the bar can show what it is
      // set to.
      const box = checkboxes().find((c) => c.dataset.engKey === key);
      if (box && !box.checked) {
        box.checked = true;
        box.closest(".st-eng-row")?.classList.add("is-on");
        applyEnabled(checkboxes().filter((c) => c.checked).map((c) => c.dataset.engKey));
      }
      StorageManager.saveSettings();
      WidgetsRenderer.initNavSearch();
      ToastSystem.success(`Searching with ${WidgetsRenderer.getEngines()[key]?.name || "your browser"}`);
    });

    checkboxes().forEach((chk) => {
      chk.addEventListener("change", () => {
        chk.closest(".st-eng-row")?.classList.toggle("is-on", chk.checked);
        const keys = checkboxes().filter((c) => c.checked).map((c) => c.dataset.engKey);
        applyEnabled(keys);
        // An engine taken out of the menu cannot stay the one in use.
        const s = live();
        if (!s.enabledEngines.includes(s.searchEngine)) {
          s.searchEngine = "default";
          StorageManager.saveSettings();
          const select = $("stSearchEngine");
          if (select) CustomSelect.setValue(select, "default", false);
        }
        WidgetsRenderer.initNavSearch();
      });
    });
  }

  S.registerTab("search", { render, bind });
})();
