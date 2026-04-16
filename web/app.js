// Global i18n instance
let i18n = null;

// DOM Elements - will be initialized after DOM is ready
let searchInput;
let searchButton;
let requestButton;
let resultsContainer;
let statusElement;
let destinationShelfField;
let destinationShelfSelect;
let navLinks;
let pageViews;
let sidebar;
let sidebarToggle;

const uiState = {
  destinationShelfEnabled: false,
};

// Helper function to translate UI elements with data-i18n attributes
function translateUI() {
  console.log('[app] translateUI called, i18n:', i18n ? 'ready' : 'not ready');
  
  if (!i18n) {
    console.warn('[app] i18n not initialized');
    return;
  }

  const elements = document.querySelectorAll("[data-i18n]");
  console.log('[app] Found', elements.length, 'elements with data-i18n');

  elements.forEach((element) => {
    const key = element.getAttribute("data-i18n");
    const translated = i18n.t(key);
    console.log('[app] Translating:', key, '→', translated);
    element.textContent = translated;
  });

  const placeholders = document.querySelectorAll("[data-i18n-placeholder]");
  console.log('[app] Found', placeholders.length, 'elements with data-i18n-placeholder');

  placeholders.forEach((element) => {
    const key = element.getAttribute("data-i18n-placeholder");
    const translated = i18n.t(key);
    console.log('[app] Translating placeholder:', key, '→', translated);
    element.placeholder = translated;
  });
}

// Initialize DOM references - call after DOM is ready
function initializeDOMElements() {
  searchInput = document.getElementById("search");
  searchButton = document.getElementById("search-button");
  requestButton = document.getElementById("request-button");
  resultsContainer = document.getElementById("results");
  statusElement = document.getElementById("status");
  destinationShelfField = document.getElementById("destination-shelf-field");
  destinationShelfSelect = document.getElementById("destination-shelf");
  navLinks = Array.from(document.querySelectorAll(".nav-link"));
  pageViews = Array.from(document.querySelectorAll("[data-page-view]"));
  sidebar = document.querySelector(".sidebar");
  sidebarToggle = document.getElementById("sidebar-toggle");
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
  statusElement.textContent = message;
  statusElement.classList.toggle("error", isError);
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

async function handleJsonResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || (i18n ? i18n.t("errors.requestFailed") : "Request failed"));
  }

  return data;
}

async function loadSettings() {
  try {
    const response = await fetch("/api/settings");
    const data = await handleJsonResponse(response);
    const destinationShelves = Array.isArray(data.destinationShelves)
      ? data.destinationShelves
      : [];

    uiState.destinationShelfEnabled =
      Boolean(data.features?.destinationShelf) && destinationShelves.length > 0;

    if (!uiState.destinationShelfEnabled) {
      destinationShelfField.classList.add("hidden");
      return;
    }

    const defaultLabel = i18n ? i18n.t("ui.shelf.generalLibrary") : "General library";
    destinationShelfSelect.innerHTML = [
      `<option value="">${defaultLabel}</option>`,
      ...destinationShelves.map(
        (item) =>
          `<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)}</option>`,
      ),
    ].join("");

    destinationShelfField.classList.remove("hidden");
  } catch (error) {
    setStatus(error.message, true);
  }
}

function getSelectedDestinationShelf() {
  if (!uiState.destinationShelfEnabled) {
    return "";
  }

  return destinationShelfSelect.value || "";
}

async function search() {
  const query = searchInput.value.trim();

  if (!query) {
    setStatus(i18n ? i18n.t("ui.status.enterTitle") : "Enter a book title to search.", true);
    resultsContainer.innerHTML = "";
    return;
  }

  setStatus(i18n ? i18n.t("ui.status.searching") : "Searching...");
  resultsContainer.innerHTML = "";

  try {
    const res = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
    const data = await handleJsonResponse(res);
    renderResults(data);
    const count = data.count || 0;
    const message = i18n ? i18n.t("ui.status.foundResults", { count }) : `${count} result(s) found.`;
    setStatus(message);
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
  const downloadBtn = i18n ? i18n.t("ui.searchButton") : "Download";
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
  const msg = i18n ? i18n.t("ui.status.downloadStarting", { title }) : `Starting download for "${title}"...`;
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
    const successMsg = data.message || (i18n ? i18n.t("ui.status.downloadSuccess") : "Download started.");
    setStatus(successMsg);
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function requestBook() {
  const query = searchInput.value.trim();

  if (!query) {
    const msg = i18n ? i18n.t("ui.alerts.enterBeforeRequest") : "Enter a book title before requesting a download.";
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
    const successMsg = i18n ? i18n.t("ui.status.requestSuccess", { title: data.selected }) : `Download started for "${data.selected}".`;
    setStatus(successMsg);
    const alertMsg = i18n ? i18n.t("ui.alerts.downloadStarted") : "Download started!";
    alert(alertMsg);
  } catch (error) {
    setStatus(error.message, true);
  }
}

// Initialize app
(async () => {
  console.log('[app] Initialization started');
  
  try {
    // Initialize i18n first
    console.log('[app] Calling window.initI18n()');
    i18n = await window.initI18n();
    console.log('[app] i18n initialized with language:', i18n.getLanguage());
    
    // Apply translations to UI elements
    console.log('[app] Calling translateUI()');
    translateUI();
    
    // Initialize DOM element references
    console.log('[app] Initializing DOM elements');
    initializeDOMElements();
    console.log('[app] DOM elements initialized');
  } catch (error) {
    console.error("[app] Failed to initialize i18n:", error);
  }

  console.log('[app] Loading settings');
  loadSettings();
  setActivePage("home");

  console.log('[app] Adding event listeners');
  searchButton.addEventListener("click", search);
  if (requestButton) {
    requestButton.addEventListener("click", requestBook);
  }

  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      search();
    }
  });

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
  
  console.log('[app] Initialization complete');
})();
