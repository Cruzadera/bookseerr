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
  loading: {
    search: false,
    request: false,
    download: false,
  },
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

function setButtonLoading(button, isLoading, loadingLabel) {
  if (!button) {
    return;
  }

  if (!button.dataset.originalLabel) {
    button.dataset.originalLabel = button.textContent || "";
  }

  button.classList.toggle("is-loading", isLoading);
  button.disabled = isLoading;
  button.setAttribute("aria-busy", isLoading ? "true" : "false");

  if (isLoading) {
    button.textContent = loadingLabel;
    return;
  }

  button.textContent = button.dataset.originalLabel || "";
}

function waitForPaint() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(resolve);
    });
  });
}

async function ensureVisibleLoading(startTime, minimumMs = 350) {
  const elapsed = Date.now() - startTime;
  if (elapsed >= minimumMs) {
    return;
  }

  await new Promise((resolve) => {
    window.setTimeout(resolve, minimumMs - elapsed);
  });
}

function getTranslation(path, fallback) {
  return i18n ? i18n.t(path) : fallback;
}

function renderStatePanel({
  title,
  description,
  tone = "neutral",
  kicker = getTranslation("common.error", "Error"),
  actionLabel = "",
  actionKey = "",
}) {
  const actionMarkup = actionLabel
    ? `
      <div class="state-panel-actions">
        <button type="button" class="secondary state-action" data-state-action="${escapeHtml(actionKey)}">
          ${escapeHtml(actionLabel)}
        </button>
      </div>
    `
    : "";

  return `
    <div class="state-panel state-panel--${escapeHtml(tone)}">
      <div class="state-panel-copy">
        <p class="state-panel-kicker">${escapeHtml(kicker)}</p>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(description)}</p>
      </div>
      ${actionMarkup}
    </div>
  `;
}

function renderNoResultsState(query = "") {
  const title = getTranslation("ui.noResults", "No matching books found.");
  const description = query
    ? getTranslation(
        "ui.noResultsHint",
        "Try another title, author, or loosen the filters and search again.",
      )
    : getTranslation(
        "ui.noResultsHint",
        "Try another title, author, or loosen the filters and search again.",
      );

  resultsContainer.innerHTML = renderStatePanel({
    title,
    description,
    tone: "empty",
    kicker: getTranslation("ui.emptyStateKicker", "No results"),
  });
}

function renderSearchErrorState(message) {
  const title = getTranslation("ui.searchErrorTitle", "Could not load results.");
  const description =
    message ||
    getTranslation(
      "ui.searchErrorDescription",
      "Check your connection and try the search again.",
    );

  resultsContainer.innerHTML = renderStatePanel({
    title,
    description,
    tone: "error",
    actionLabel: getTranslation("ui.retrySearch", "Retry search"),
    actionKey: "retry-search",
  });
}

function clearDownloadErrorState(resultCard) {
  if (!resultCard) {
    return;
  }

  resultCard.classList.remove("has-download-error");
  resultCard.querySelectorAll(".result-error-banner").forEach((banner) => banner.remove());
}

function renderDownloadErrorState(resultCard, message, title, downloadUrl, protocol) {
  if (!resultCard) {
    return;
  }

  clearDownloadErrorState(resultCard);
  resultCard.classList.add("has-download-error");

  const banner = document.createElement("div");
  banner.className = "result-error-banner";
  banner.innerHTML = `
    <div class="result-error-copy">
      <p class="state-panel-kicker">${escapeHtml(getTranslation("common.error", "Error"))}</p>
      <strong>${escapeHtml(getTranslation("ui.downloadErrorTitle", "Download failed."))}</strong>
      <p>${escapeHtml(
        message ||
          getTranslation(
            "ui.downloadErrorDescription",
            "The item could not be sent to qBittorrent. You can try again.",
          ),
      )}</p>
    </div>
    <button
      type="button"
      class="secondary download-retry"
      data-title="${escapeHtml(title)}"
      data-download-url="${encodeURIComponent(downloadUrl || "") }"
      data-protocol="${escapeHtml(protocol || "torrent")}">
      ${escapeHtml(getTranslation("ui.retryDownload", "Retry download"))}
    </button>
  `;

  resultCard.prepend(banner);
}

function updateActionButtonsState() {
  const isBusy =
    uiState.loading.search || uiState.loading.request || uiState.loading.download;

  if (searchButton) {
    searchButton.disabled = isBusy;
  }

  if (requestButton) {
    requestButton.disabled = isBusy;
  }

  document.querySelectorAll(
    ".download-button, .request-best-inline, .state-action, .download-retry",
  ).forEach((button) => {
    const isActiveLoading = button.classList.contains("is-loading");
    button.disabled = isBusy || isActiveLoading;
  });
}

function setLoadingState(action, isLoading) {
  uiState.loading[action] = isLoading;
  updateActionButtonsState();
}

function renderSearchSkeleton() {
  return Array.from({ length: 3 })
    .map(
      () => `
        <article class="result-card skeleton-card" aria-hidden="true">
          <div class="result-cover skeleton-block skeleton-cover"></div>
          <div class="result-main">
            <div class="result-head">
              <div class="result-copy">
                <div class="skeleton-line skeleton-line-title"></div>
                <div class="skeleton-line skeleton-line-author"></div>
              </div>
              <div class="result-actions skeleton-actions">
                <span class="skeleton-button"></span>
              </div>
            </div>
            <div class="result-submeta skeleton-submeta">
              <span class="skeleton-chip"></span>
              <span class="skeleton-chip"></span>
            </div>
            <div class="meta meta-pills skeleton-pills">
              <div class="skeleton-pill"></div>
              <div class="skeleton-pill"></div>
              <div class="skeleton-pill"></div>
            </div>
          </div>
        </article>
      `,
    )
    .join("");
}

function showSearchLoading() {
  const loadingLabel = i18n ? i18n.t("ui.searchButtonLoading") : "Searching...";

  setLoadingState("search", true);
  setButtonLoading(searchButton, true, loadingLabel);
  if (requestButton) {
    requestButton.disabled = true;
  }

  resultsContainer.classList.add("is-loading");
  resultsContainer.innerHTML = renderSearchSkeleton();
  setStatus(loadingLabel);
}

function hideSearchLoading() {
  setLoadingState("search", false);
  setButtonLoading(
    searchButton,
    false,
    i18n ? i18n.t("ui.searchButtonLoading") : "Searching...",
  );
  resultsContainer.classList.remove("is-loading");
  updateActionButtonsState();
}

function showRequestLoading(button) {
  const loadingLabel = i18n ? i18n.t("ui.requestButtonLoading") : "Requesting...";

  setLoadingState("request", true);
  setButtonLoading(button || requestButton, true, loadingLabel);
  setStatus(loadingLabel);
}

function hideRequestLoading(button) {
  setLoadingState("request", false);
  setButtonLoading(
    button || requestButton,
    false,
    i18n ? i18n.t("ui.requestButtonLoading") : "Requesting...",
  );
  updateActionButtonsState();
}

function showDownloadLoading(button, title) {
  const loadingLabel = i18n ? i18n.t("ui.downloadButtonLoading") : "Downloading...";

  setLoadingState("download", true);
  setButtonLoading(button, true, loadingLabel);
  setStatus(
    i18n
      ? i18n.t("ui.status.downloadStarting", { title })
      : `Starting download for "${title}"...`,
  );
}

function hideDownloadLoading(button) {
  setLoadingState("download", false);
  setButtonLoading(
    button,
    false,
    i18n ? i18n.t("ui.downloadButtonLoading") : "Downloading...",
  );
  updateActionButtonsState();
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

function formatPublishYear(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : `${date.getFullYear()}`;
}

function inferAuthorFromTitle(title = "") {
  const match = `${title}`.match(/\bby\s+([^-()[\]|]{2,60})/i);
  return match ? match[1].trim() : "";
}

function getResultAuthor(item) {
  const fallback = i18n ? i18n.t("ui.unknownAuthor") : "Unknown author";
  const author = `${item?.author || ""}`.trim() || inferAuthorFromTitle(item?.title || "");
  return author || fallback;
}

function buildCoverMarkup(item) {
  const coverUrl = `${item?.coverUrl || ""}`.trim();
  const title = `${item?.title || "Book"}`.trim();
  const initial = escapeHtml((title.charAt(0) || "?").toUpperCase());
  const formatTag = escapeHtml(`${item?.format || "book"}`.trim().toUpperCase());

  return `
    <div class="result-cover">
      ${
        coverUrl
          ? `<img src="${escapeHtml(coverUrl)}" alt="${escapeHtml(title)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='grid';" />`
          : ""
      }
      <span class="result-cover-fallback"${coverUrl ? ' style="display:none;"' : ""} aria-hidden="true">${initial}</span>
      <span class="result-cover-format">${formatTag}</span>
    </div>
  `;
}

async function handleJsonResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      data.error || getTranslation("errors.requestFailed", "Request failed"),
    );
    error.status = response.status;
    error.payload = data;
    throw error;
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

function syncQuickFiltersWithSettings() {
  if (quickOnlyEpubInput) {
    quickOnlyEpubInput.checked = uiState.settings.filters.preferredFormat === "epub";
  }

  if (quickSpanishOnlyInput) {
    quickSpanishOnlyInput.checked = uiState.settings.filters.language === "es";
  }

  if (quickUnder20Input) {
    const maxSizeMB = Number(uiState.settings.filters.maxSizeMB || 0);
    quickUnder20Input.checked = maxSizeMB > 0 && maxSizeMB <= 20;
  }
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
  syncQuickFiltersWithSettings();
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

  if (uiState.loading.search) {
    return;
  }

  showSearchLoading();

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
    if (error.status === 404) {
      renderNoResultsState(query);
      setStatus(getTranslation("ui.noResults", "No matching books found."));
    } else {
      renderSearchErrorState(error.message);
      setStatus(error.message, true);
    }
  } finally {
    hideSearchLoading();
  }
}

function renderResults(data) {
  const results = Array.isArray(data.results) ? data.results : [];

  if (!results.length) {
    renderNoResultsState();
    return;
  }

  const formatLabel = i18n ? i18n.t("ui.format") : "Format";
  const seedersLabel = i18n ? i18n.t("ui.seeders") : "Seeders";
  const sizeLabel = i18n ? i18n.t("ui.size") : "Size";
  const downloadBtn = i18n ? i18n.t("common.download") : "Download";
  const requestBtn = i18n ? i18n.t("ui.requestButton") : "Request best";
  const unknownIndexer = i18n ? i18n.t("ui.indexer") : "Unknown indexer";
  const bestMatchLabel = i18n ? i18n.t("ui.bestMatch") : "Best match";

  resultsContainer.innerHTML = results
    .map((item, index) => {
      const author = escapeHtml(getResultAuthor(item));
      const source = escapeHtml(item.indexer || unknownIndexer);
      const year = formatPublishYear(item.publishDate);
      const formatValue = escapeHtml(`${item.format || "unknown"}`.toUpperCase());
      const featuredAction =
        index === 0
          ? `<button type="button" class="request-best-inline secondary">${requestBtn}</button>`
          : "";
      const featuredBadge =
        index === 0 ? `<span class="result-badge">${escapeHtml(bestMatchLabel)}</span>` : "";

      return `
        <article class="result-card ${index === 0 ? "is-featured" : ""}" data-result-title="${escapeHtml(item.title)}">
          ${buildCoverMarkup(item)}
          <div class="result-main">
            <div class="result-head">
              <div class="result-copy">
                <div class="result-title-row">
                  <h2>${escapeHtml(item.title)}</h2>
                  ${featuredBadge}
                </div>
                <p class="result-author">${author}</p>
              </div>
              <div class="result-actions">
                ${featuredAction}
                <button
                  type="button"
                  class="download-button"
                  data-title="${escapeHtml(item.title)}"
                  data-download-url="${encodeURIComponent(item.downloadUrl || "")}"
                  data-protocol="${escapeHtml(item.protocol || "torrent")}" 
                >
                  ${downloadBtn}
                </button>
              </div>
            </div>
            <div class="result-submeta">
              <span>${source}</span>
              ${year ? `<span>${year}</span>` : ""}
            </div>
            <dl class="meta meta-pills">
              <div>
                <dt>${formatLabel}</dt>
                <dd>${formatValue}</dd>
              </div>
              <div>
                <dt>${seedersLabel}</dt>
                <dd>${Number(item.seeders ?? 0)}</dd>
              </div>
              <div>
                <dt>${sizeLabel}</dt>
                <dd>${formatSize(item.sizeMB)}</dd>
              </div>
            </dl>
          </div>
        </article>
      `;
    })
    .join("");
}

async function downloadBook(title, downloadUrl, protocol, triggerButton = null) {
  const startedAt = Date.now();
  const resultCard = triggerButton?.closest(".result-card") || null;

  clearDownloadErrorState(resultCard);
  showDownloadLoading(triggerButton, title);

  if (resultCard) {
    resultCard.classList.add("is-downloading");
  }

  await waitForPaint();

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
      getTranslation("ui.status.downloadSuccess", "Download started.");
    setStatus(successMsg);
    await ensureVisibleLoading(startedAt, 650);
  } catch (error) {
    setStatus(error.message, true);
    renderDownloadErrorState(resultCard, error.message, title, downloadUrl, protocol);
  } finally {
    if (resultCard) {
      resultCard.classList.remove("is-downloading");
    }
    hideDownloadLoading(triggerButton);
  }
}

async function requestBook(triggerButton = requestButton) {
  const startedAt = Date.now();
  const query = searchInput.value.trim();

  if (!query) {
    const msg = i18n
      ? i18n.t("ui.alerts.enterBeforeRequest")
      : "Enter a book title before requesting a download.";
    setStatus(msg, true);
    return;
  }

  if (uiState.loading.request) {
    return;
  }

  showRequestLoading(triggerButton);

  await waitForPaint();

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
    await ensureVisibleLoading(startedAt, 650);
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    hideRequestLoading(triggerButton);
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
    requestButton.addEventListener("click", () => requestBook(requestButton));
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
      const stateAction = event.target.closest("[data-state-action]");

      if (stateAction?.dataset.stateAction === "retry-search") {
        search();
        return;
      }

      const retryDownloadButton = event.target.closest(".download-retry");

      if (retryDownloadButton) {
        downloadBook(
          retryDownloadButton.dataset.title,
          decodeURIComponent(retryDownloadButton.dataset.downloadUrl || ""),
          retryDownloadButton.dataset.protocol || "torrent",
          retryDownloadButton,
        );
        return;
      }

      const requestAction = event.target.closest(".request-best-inline");

      if (requestAction) {
        requestBook(requestAction);
        return;
      }

      const button = event.target.closest(".download-button");

      if (!button) {
        return;
      }

      downloadBook(
        button.dataset.title,
        decodeURIComponent(button.dataset.downloadUrl || ""),
        button.dataset.protocol || "torrent",
        button,
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
