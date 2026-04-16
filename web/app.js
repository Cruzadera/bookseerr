let i18n = null;

let searchInput;
let searchButton;
let requestButton;
let resultsContainer;
let statusElement;
let settingsStatusElement;
let destinationShelfField;
let destinationShelfSelect;
let navLinks;
let pageViews;
let sidebar;
let sidebarToggle;
let settingsForm;
let resetSettingsButton;
let preferredFormatSelect;
let minSeedsInput;
let maxSizeInput;
let settingsLanguageSelect;
let indexerOptionsContainer;
let autoDownloadInput;
let onlyPreferredFormatInput;
let defaultShelfSelect;
let rememberLastShelfInput;
let quickOnlyEpubInput;
let quickSpanishOnlyInput;
let quickUnder20Input;

const LAST_SHELF_STORAGE_KEY = "bookseerr:last-destination-shelf";
const DEFAULT_SETTINGS = {
  filters: {
    preferredFormat: "epub",
    excludedFormats: ["pdf"],
    indexers: [],
    minSeeds: 5,
    maxSizeMB: 50,
    language: "any",
  },
  download: {
    autoDownload: false,
    onlyIfPreferredFormat: true,
  },
  calibre: {
    defaultShelf: null,
    rememberLastShelf: true,
  },
};

const uiState = {
  destinationShelfEnabled: false,
  destinationShelves: [],
  availableIndexers: [],
  settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeSettings(base, override) {
  if (!isObject(override)) {
    return base;
  }

  const result = { ...base };

  Object.entries(override).forEach(([key, value]) => {
    if (isObject(value) && isObject(result[key])) {
      result[key] = mergeSettings(result[key], value);
      return;
    }

    result[key] = value;
  });

  return result;
}

function normalizeLanguage(value) {
  const normalized = `${value || "any"}`.trim().toLowerCase();

  if (normalized.startsWith("es")) {
    return "es";
  }

  if (normalized.startsWith("en")) {
    return "en";
  }

  return "any";
}

function normalizeSettings(value = {}) {
  const merged = mergeSettings(clone(DEFAULT_SETTINGS), value);
  const preferredFormat = `${merged.filters?.preferredFormat || "epub"}`
    .trim()
    .toLowerCase();
  const allowedFormats = new Set(["any", "epub", "mobi", "azw3", "pdf"]);

  return {
    filters: {
      preferredFormat: allowedFormats.has(preferredFormat) ? preferredFormat : "epub",
      excludedFormats: [
        ...new Set(
          (Array.isArray(merged.filters?.excludedFormats)
            ? merged.filters.excludedFormats
            : DEFAULT_SETTINGS.filters.excludedFormats
          )
            .map((item) => `${item || ""}`.trim().toLowerCase())
            .filter((item) => item && item !== preferredFormat),
        ),
      ],
      indexers: [
        ...new Set(
          (Array.isArray(merged.filters?.indexers) ? merged.filters.indexers : [])
            .map((item) => `${item || ""}`.trim())
            .filter(Boolean),
        ),
      ],
      minSeeds: Math.max(0, Number(merged.filters?.minSeeds ?? 0) || 0),
      maxSizeMB: Math.max(0, Number(merged.filters?.maxSizeMB ?? 0) || 0),
      language: normalizeLanguage(merged.filters?.language),
    },
    download: {
      autoDownload: Boolean(merged.download?.autoDownload),
      onlyIfPreferredFormat:
        merged.download?.onlyIfPreferredFormat === undefined
          ? true
          : Boolean(merged.download.onlyIfPreferredFormat),
    },
    calibre: {
      defaultShelf: `${merged.calibre?.defaultShelf || ""}`.trim() || null,
      rememberLastShelf:
        merged.calibre?.rememberLastShelf === undefined
          ? true
          : Boolean(merged.calibre.rememberLastShelf),
    },
  };
}

function translateUI() {
  if (!i18n) {
    return;
  }

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n");
    element.textContent = i18n.t(key);
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    const key = element.getAttribute("data-i18n-placeholder");
    element.placeholder = i18n.t(key);
  });
}

function initializeDOMElements() {
  searchInput = document.getElementById("search");
  searchButton = document.getElementById("search-button");
  requestButton = document.getElementById("request-button");
  resultsContainer = document.getElementById("results");
  statusElement = document.getElementById("status");
  settingsStatusElement = document.getElementById("settings-status");
  destinationShelfField = document.getElementById("destination-shelf-field");
  destinationShelfSelect = document.getElementById("destination-shelf");
  navLinks = Array.from(document.querySelectorAll(".nav-link"));
  pageViews = Array.from(document.querySelectorAll("[data-page-view]"));
  sidebar = document.querySelector(".sidebar");
  sidebarToggle = document.getElementById("sidebar-toggle");
  settingsForm = document.getElementById("settings-form");
  resetSettingsButton = document.getElementById("reset-settings-button");
  preferredFormatSelect = document.getElementById("preferred-format");
  minSeedsInput = document.getElementById("min-seeds");
  maxSizeInput = document.getElementById("max-size-mb");
  settingsLanguageSelect = document.getElementById("settings-language");
  indexerOptionsContainer = document.getElementById("indexer-options");
  autoDownloadInput = document.getElementById("auto-download");
  onlyPreferredFormatInput = document.getElementById("only-preferred-format");
  defaultShelfSelect = document.getElementById("default-shelf");
  rememberLastShelfInput = document.getElementById("remember-last-shelf");
  quickOnlyEpubInput = document.getElementById("quick-only-epub");
  quickSpanishOnlyInput = document.getElementById("quick-spanish-only");
  quickUnder20Input = document.getElementById("quick-under-20");
}

function setActivePage(page) {
  navLinks.forEach((link) => {
    const isActive = link.dataset.page === page;
    link.classList.toggle("active", isActive);
    link.setAttribute("aria-current", isActive ? "page" : "false");
  });

  pageViews.forEach((view) => {
    view.classList.toggle("hidden", view.dataset.pageView !== page);
  });
}

function setStatus(message, isError = false) {
  [statusElement, settingsStatusElement].forEach((element) => {
    if (!element) {
      return;
    }

    element.textContent = message || "";
    element.classList.toggle("error", isError);
  });
}

function setSidebarCollapsed(isCollapsed) {
  if (!sidebar || !sidebarToggle) {
    return;
  }

  sidebar.classList.toggle("is-collapsed", isCollapsed);
  sidebarToggle.setAttribute("aria-pressed", isCollapsed ? "true" : "false");
  sidebarToggle.setAttribute(
    "aria-label",
    isCollapsed ? "Expand sidebar" : "Collapse sidebar",
  );
}

function escapeHtml(value) {
  return `${value || ""}`
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatSize(sizeMB) {
  const numeric = Number(sizeMB || 0);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "—";
  }

  return `${numeric >= 10 ? numeric.toFixed(0) : numeric.toFixed(1)} MB`;
}

async function handleJsonResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || (i18n ? i18n.t("errors.requestFailed") : "Request failed"),
    );
  }

  return data;
}

function populateDestinationShelfOptions() {
  const defaultLabel = i18n ? i18n.t("ui.shelf.generalLibrary") : "General library";
  const optionMarkup = [
    `<option value="">${escapeHtml(defaultLabel)}</option>`,
    ...uiState.destinationShelves.map(
      (item) =>
        `<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)}</option>`,
    ),
  ].join("");

  if (destinationShelfSelect) {
    destinationShelfSelect.innerHTML = optionMarkup;
  }

  if (defaultShelfSelect) {
    defaultShelfSelect.innerHTML = optionMarkup;
    defaultShelfSelect.disabled = uiState.destinationShelves.length === 0;
  }

  if (destinationShelfField) {
    destinationShelfField.classList.toggle("hidden", !uiState.destinationShelfEnabled);
  }

  applyDestinationShelfPreference();
}

function applyDestinationShelfPreference() {
  const defaultShelf = uiState.settings.calibre?.defaultShelf || "";
  const rememberLastShelf = Boolean(uiState.settings.calibre?.rememberLastShelf);
  const savedShelf = rememberLastShelf
    ? localStorage.getItem(LAST_SHELF_STORAGE_KEY) || ""
    : "";
  const preferredShelf = savedShelf || defaultShelf || "";
  const hasPreferredShelf = uiState.destinationShelves.some(
    (item) => item.id === preferredShelf,
  );
  const hasDefaultShelf = uiState.destinationShelves.some(
    (item) => item.id === defaultShelf,
  );

  if (destinationShelfSelect) {
    destinationShelfSelect.value = hasPreferredShelf ? preferredShelf : "";
  }

  if (defaultShelfSelect) {
    defaultShelfSelect.value = hasDefaultShelf ? defaultShelf : "";
  }

  if (!rememberLastShelf) {
    localStorage.removeItem(LAST_SHELF_STORAGE_KEY);
  }
}

function populateIndexerOptions() {
  if (!indexerOptionsContainer) {
    return;
  }

  if (!uiState.availableIndexers.length) {
    const emptyMsg = i18n
      ? i18n.t("ui.settings.noIndexers")
      : "No indexers available right now.";
    indexerOptionsContainer.innerHTML = `<p class="empty-note">${escapeHtml(emptyMsg)}</p>`;
    return;
  }

  indexerOptionsContainer.innerHTML = uiState.availableIndexers
    .map(
      (item) => `
        <label class="chip-toggle">
          <input type="checkbox" name="indexers" value="${escapeHtml(item)}" />
          <span>${escapeHtml(item)}</span>
        </label>
      `,
    )
    .join("");
}

function populateSettingsForm() {
  if (!settingsForm) {
    return;
  }

  const settings = uiState.settings;
  preferredFormatSelect.value = settings.filters.preferredFormat;
  minSeedsInput.value = settings.filters.minSeeds;
  maxSizeInput.value = settings.filters.maxSizeMB;
  settingsLanguageSelect.value = settings.filters.language;
  autoDownloadInput.checked = Boolean(settings.download.autoDownload);
  onlyPreferredFormatInput.checked = Boolean(settings.download.onlyIfPreferredFormat);
  rememberLastShelfInput.checked = Boolean(settings.calibre.rememberLastShelf);

  const excludedFormats = new Set(settings.filters.excludedFormats || []);
  document.querySelectorAll('input[name="excludedFormats"]').forEach((input) => {
    input.checked = excludedFormats.has(input.value);
  });

  const selectedIndexers = new Set(settings.filters.indexers || []);
  document.querySelectorAll('input[name="indexers"]').forEach((input) => {
    input.checked = selectedIndexers.has(input.value);
  });

  if (defaultShelfSelect) {
    defaultShelfSelect.value = settings.calibre.defaultShelf || "";
  }
}

function applyLoadedSettings(data) {
  uiState.settings = normalizeSettings(data.settings || {});
  uiState.destinationShelves = Array.isArray(data.destinationShelves)
    ? data.destinationShelves
    : [];
  uiState.availableIndexers = Array.isArray(data.availableIndexers)
    ? data.availableIndexers
    : [];
  uiState.destinationShelfEnabled =
    Boolean(data.features?.destinationShelf) && uiState.destinationShelves.length > 0;

  populateDestinationShelfOptions();
  populateIndexerOptions();
  populateSettingsForm();
}

async function loadSettings() {
  try {
    const response = await fetch("/api/settings");
    const data = await handleJsonResponse(response);
    applyLoadedSettings(data);
  } catch (error) {
    setStatus(error.message, true);
  }
}

function collectSettingsFormValue() {
  const preferredFormat = preferredFormatSelect.value || "epub";
  const excludedFormats = Array.from(
    document.querySelectorAll('input[name="excludedFormats"]:checked'),
  )
    .map((input) => input.value)
    .filter((item) => item !== preferredFormat);

  return {
    filters: {
      preferredFormat,
      excludedFormats,
      indexers: Array.from(document.querySelectorAll('input[name="indexers"]:checked')).map(
        (input) => input.value,
      ),
      minSeeds: Number(minSeedsInput.value || 0),
      maxSizeMB: Number(maxSizeInput.value || 0),
      language: settingsLanguageSelect.value || "any",
    },
    download: {
      autoDownload: autoDownloadInput.checked,
      onlyIfPreferredFormat: onlyPreferredFormatInput.checked,
    },
    calibre: {
      defaultShelf: defaultShelfSelect?.value || null,
      rememberLastShelf: rememberLastShelfInput.checked,
    },
  };
}

async function saveSettings(event) {
  event.preventDefault();

  try {
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(collectSettingsFormValue()),
    });

    const data = await handleJsonResponse(response);
    applyLoadedSettings(data);
    setStatus(i18n ? i18n.t("ui.settings.saved") : "Settings saved.");
  } catch (error) {
    setStatus(error.message, true);
  }
}

function resetSettingsForm() {
  uiState.settings = clone(DEFAULT_SETTINGS);
  populateSettingsForm();
  setStatus(
    i18n ? i18n.t("ui.settings.defaultsRestored") : "Defaults restored in the form.",
  );
}

function getSelectedDestinationShelf() {
  if (!uiState.destinationShelfEnabled || !destinationShelfSelect) {
    return "";
  }

  return destinationShelfSelect.value || "";
}

function rememberDestinationShelf() {
  if (!destinationShelfSelect) {
    return;
  }

  if (uiState.settings.calibre?.rememberLastShelf) {
    localStorage.setItem(LAST_SHELF_STORAGE_KEY, destinationShelfSelect.value || "");
    return;
  }

  localStorage.removeItem(LAST_SHELF_STORAGE_KEY);
}

function buildSearchUrl(query) {
  const params = new URLSearchParams({ query });

  if (quickOnlyEpubInput?.checked) {
    params.set("onlyEpub", "true");
  }

  if (quickSpanishOnlyInput?.checked) {
    params.set("spanishOnly", "true");
  }

  if (quickUnder20Input?.checked) {
    params.set("maxSizeMB", "20");
  }

  return `/api/search?${params.toString()}`;
}

async function maybeAutoDownload(results) {
  if (!uiState.settings.download.autoDownload || !Array.isArray(results) || !results.length) {
    return;
  }

  const best = results[0];
  const preferredFormat = uiState.settings.filters.preferredFormat || "any";
  const formatMatches = preferredFormat === "any" || best.format === preferredFormat;

  if (uiState.settings.download.onlyIfPreferredFormat && !formatMatches) {
    return;
  }

  await downloadBook(best.title, best.downloadUrl, best.protocol || "torrent");
}

async function search() {
  const query = searchInput.value.trim();

  if (!query) {
    setStatus(
      i18n ? i18n.t("ui.status.enterTitle") : "Enter a book title to search.",
      true,
    );
    resultsContainer.innerHTML = "";
    return;
  }

  setStatus(i18n ? i18n.t("ui.status.searching") : "Searching...");
  resultsContainer.innerHTML = "";

  try {
    const res = await fetch(buildSearchUrl(query));
    const data = await handleJsonResponse(res);
    renderResults(data);
    const count = data.count || 0;
    const message = i18n
      ? i18n.t("ui.status.foundResults", { count })
      : `${count} result(s) found.`;
    setStatus(message);
    await maybeAutoDownload(data.results || []);
  } catch (error) {
    setStatus(error.message, true);
  }
}

function renderResults(data) {
  const results = Array.isArray(data.results) ? data.results : [];

  if (!results.length) {
    const emptyMsg = i18n ? i18n.t("ui.noResults") : "No matching books found.";
    resultsContainer.innerHTML = `<div class="empty-state">${emptyMsg}</div>`;
    return;
  }

  const formatLabel = i18n ? i18n.t("ui.format") : "Format";
  const seedersLabel = i18n ? i18n.t("ui.seeders") : "Seeders";
  const sizeLabel = i18n ? i18n.t("ui.size") : "Size";
  const downloadBtn = i18n ? i18n.t("common.download") : "Download";
  const unknownIndexer = i18n ? i18n.t("ui.indexer") : "Unknown indexer";

  resultsContainer.innerHTML = results
    .map(
      (item) => `
        <article class="result-card">
          <div class="result-copy">
            <h2>${escapeHtml(item.title)}</h2>
            <p>${escapeHtml(item.indexer || unknownIndexer)}</p>
          </div>
          <dl class="meta">
            <div>
              <dt>${formatLabel}</dt>
              <dd>${escapeHtml(item.format || "unknown")}</dd>
            </div>
            <div>
              <dt>${seedersLabel}</dt>
              <dd>${item.seeders ?? 0}</dd>
            </div>
            <div>
              <dt>${sizeLabel}</dt>
              <dd>${formatSize(item.sizeMB)}</dd>
            </div>
          </dl>
          <button
            type="button"
            class="download-button"
            data-title="${escapeHtml(item.title)}"
            data-download-url="${encodeURIComponent(item.downloadUrl || "")}"
            data-protocol="${escapeHtml(item.protocol || "torrent")}" 
          >
            ${downloadBtn}
          </button>
        </article>
      `,
    )
    .join("");
}

async function downloadBook(title, downloadUrl, protocol) {
  const msg = i18n
    ? i18n.t("ui.status.downloadStarting", { title })
    : `Starting download for "${title}"...`;
  setStatus(msg);

  try {
    const destinationId = getSelectedDestinationShelf();
    const res = await fetch("/api/download", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        downloadUrl,
        protocol,
        destinationId,
      }),
    });

    const data = await handleJsonResponse(res);
    const successMsg =
      data.message ||
      (i18n ? i18n.t("ui.status.downloadSuccess") : "Download started.");
    setStatus(successMsg);
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function requestBook() {
  const query = searchInput.value.trim();

  if (!query) {
    const msg = i18n
      ? i18n.t("ui.alerts.enterBeforeRequest")
      : "Enter a book title before requesting a download.";
    setStatus(msg, true);
    return;
  }

  const msg = i18n ? i18n.t("ui.status.requesting") : "Looking for the best match...";
  setStatus(msg);

  try {
    const destinationId = getSelectedDestinationShelf();
    const res = await fetch("/api/request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, destinationId }),
    });

    const data = await handleJsonResponse(res);
    const successMsg = i18n
      ? i18n.t("ui.status.requestSuccess", { title: data.selected })
      : `Download started for "${data.selected}".`;
    setStatus(successMsg);
  } catch (error) {
    setStatus(error.message, true);
  }
}

(async () => {
  initializeDOMElements();

  try {
    i18n = await window.initI18n();
    translateUI();
  } catch (error) {
    console.error("[app] Failed to initialize i18n:", error);
  }

  await loadSettings();
  setActivePage("home");

  if (searchButton) {
    searchButton.addEventListener("click", search);
  }

  if (requestButton) {
    requestButton.addEventListener("click", requestBook);
  }

  if (searchInput) {
    searchInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        search();
      }
    });
  }

  if (resultsContainer) {
    resultsContainer.addEventListener("click", (event) => {
      const button = event.target.closest(".download-button");

      if (!button) {
        return;
      }

      downloadBook(
        button.dataset.title,
        decodeURIComponent(button.dataset.downloadUrl || ""),
        button.dataset.protocol || "torrent",
      );
    });
  }

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      setActivePage(link.dataset.page || "home");
    });
  });

  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", () => {
      const isCollapsed = sidebar.classList.contains("is-collapsed");
      setSidebarCollapsed(!isCollapsed);
    });
  }

  if (destinationShelfSelect) {
    destinationShelfSelect.addEventListener("change", rememberDestinationShelf);
  }

  if (settingsForm) {
    settingsForm.addEventListener("submit", saveSettings);
  }

  if (resetSettingsButton) {
    resetSettingsButton.addEventListener("click", resetSettingsForm);
  }
})();
