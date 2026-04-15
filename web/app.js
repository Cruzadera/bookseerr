// Global i18n instance
let i18n = null;

// DOM Elements
const searchInput = document.getElementById("search");
const searchButton = document.getElementById("search-button");
const requestButton = document.getElementById("request-button");
const resultsContainer = document.getElementById("results");
const statusElement = document.getElementById("status");
const destinationShelfField = document.getElementById("destination-shelf-field");
const destinationShelfSelect = document.getElementById("destination-shelf");
const navLinks = Array.from(document.querySelectorAll(".nav-link"));
const pageViews = Array.from(document.querySelectorAll("[data-page-view]"));
const sidebar = document.querySelector(".sidebar");
const sidebarToggle = document.getElementById("sidebar-toggle");

const uiState = {
  destinationShelfEnabled: false,
};

// Helper function to translate UI elements with data-i18n attributes
function translateUI() {
  if (!i18n) return;

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n");
    element.textContent = i18n.t(key);
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    const key = element.getAttribute("data-i18n-placeholder");
    element.placeholder = i18n.t(key);
  });
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

    const defaultLabel = i18n ? i18n.t("common.error") : "General library";
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

// Language switcher
function createLanguageSwitcher() {
  // Check if switcher already exists
  if (document.getElementById("language-switcher")) {
    return;
  }

  const eyebrow = document.querySelector(".eyebrow");
  if (!eyebrow || !eyebrow.parentElement) {
    return;
  }

  const brandCopy = eyebrow.parentElement;
  const switcher = document.createElement("div");
  switcher.id = "language-switcher";
  switcher.className = "language-switcher";
  switcher.innerHTML = `
    <select id="language-select" aria-label="Language">
      <option value="en">English</option>
      <option value="es-ES">Español</option>
    </select>
  `;

  brandCopy.appendChild(switcher);

  const select = document.getElementById("language-select");
  select.value = i18n.getLanguage();
  select.addEventListener("change", (e) => {
    const lang = e.target.value;
    i18n.setLanguage(lang);
    translateUI();
  });
}

// Initialize app
(async () => {
  try {
    i18n = await window.initI18n();
    translateUI();
    createLanguageSwitcher();
  } catch (error) {
    console.error("Failed to initialize i18n:", error);
  }

  loadSettings();
  setActivePage("home");

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
})();
