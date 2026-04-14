const searchInput = document.getElementById("search");
const searchButton = document.getElementById("search-button");
const requestButton = document.getElementById("request-button");
const resultsContainer = document.getElementById("results");
const statusElement = document.getElementById("status");
const destinationShelfField = document.getElementById("destination-shelf-field");
const destinationShelfSelect = document.getElementById("destination-shelf");

const uiState = {
  destinationShelfEnabled: false,
};

function setStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.classList.toggle("error", isError);
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
    throw new Error(data.error || "Request failed");
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

    destinationShelfSelect.innerHTML = [
      '<option value="">Biblioteca general</option>',
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
    setStatus("Enter a book title to search.", true);
    resultsContainer.innerHTML = "";
    return;
  }

  setStatus("Searching...");
  resultsContainer.innerHTML = "";

  try {
    const res = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
    const data = await handleJsonResponse(res);
    renderResults(data);
    setStatus(`${data.count} result(s) found.`);
  } catch (error) {
    setStatus(error.message, true);
  }
}

function renderResults(data) {
  const results = Array.isArray(data.results) ? data.results : [];

  if (!results.length) {
    resultsContainer.innerHTML =
      '<div class="empty-state">No matching books found.</div>';
    return;
  }

  resultsContainer.innerHTML = results
    .map(
      (item) => `
        <article class="result-card">
          <div class="result-copy">
            <h2>${escapeHtml(item.title)}</h2>
            <p>${escapeHtml(item.indexer || "Unknown indexer")}</p>
          </div>
          <dl class="meta">
            <div>
              <dt>Format</dt>
              <dd>${escapeHtml(item.format || "unknown")}</dd>
            </div>
            <div>
              <dt>Seeders</dt>
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
            Download
          </button>
        </article>
      `,
    )
    .join("");
}

async function downloadBook(title, downloadUrl, protocol) {
  setStatus(`Starting download for "${title}"...`);

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
    setStatus(data.message || "Download started.");
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function requestBook() {
  const query = searchInput.value.trim();

  if (!query) {
    setStatus("Enter a book title before requesting a download.", true);
    return;
  }

  setStatus("Looking for the best match...");

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
    setStatus(`Download started for "${data.selected}".`);
    alert("Download started!");
  } catch (error) {
    setStatus(error.message, true);
  }
}

loadSettings();
searchButton.addEventListener("click", search);
requestButton.addEventListener("click", requestBook);
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
