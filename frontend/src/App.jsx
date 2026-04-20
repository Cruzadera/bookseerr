import { useEffect, useMemo, useState } from "react";

import SearchView from "./components/SearchView";
import SettingsView from "./components/SettingsView";
import Sidebar from "./components/Sidebar";
import JobsView from "./components/JobsView";
import { useI18n } from "./hooks/useI18n";
import {
  cloneSettings,
  DEFAULT_SETTINGS,
  LAST_SHELF_STORAGE_KEY,
  normalizeSettings,
} from "./lib/settings";

const RECENT_SEARCHES_STORAGE_KEY = "bookseerr:recent-searches";
const RECENT_SEARCHES_LIMIT = 8;

function normalizeRecentSearchEntry(value) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  const candidateKeys = ["query", "term", "title", "text", "value", "label"];

  for (const key of candidateKeys) {
    if (typeof value[key] === "string" && value[key].trim()) {
      return value[key].trim();
    }
  }

  return "";
}

function normalizeRecentSearches(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  const seen = new Set();

  return values
    .map(normalizeRecentSearchEntry)
    .filter((item) => {
      if (!item) {
        return false;
      }

      const normalized = item.toLowerCase();

      if (seen.has(normalized)) {
        return false;
      }

      seen.add(normalized);
      return true;
    })
    .slice(0, RECENT_SEARCHES_LIMIT);
}

function normalizeSearchQueryInput(value, fallback = "") {
  if (typeof value === "string") {
    return value;
  }

  if (
    value &&
    typeof value === "object" &&
    ("nativeEvent" in value || "target" in value || "currentTarget" in value)
  ) {
    return fallback;
  }

  return `${value || fallback}`;
}

function waitForMinimum(startedAt, durationMs) {
  const elapsed = Date.now() - startedAt;
  const remaining = durationMs - elapsed;

  if (remaining <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    window.setTimeout(resolve, remaining);
  });
}

async function handleJsonResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || "Request failed");
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}

function buildSearchUrl(query, quickFilters) {
  const params = new URLSearchParams({ query });

  if (quickFilters.onlyEpub) {
    params.set("onlyEpub", "true");
  }

  if (quickFilters.spanishOnly) {
    params.set("spanishOnly", "true");
  }

  if (quickFilters.under20MB) {
    params.set("maxSizeMB", "20");
  }

  return `/api/search?${params.toString()}`;
}

export default function App() {
  const { loading: i18nLoading, language, t } = useI18n();
  const [activePage, setActivePage] = useState("home");
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState(() => {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      const storedValue = window.localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
      const parsedValue = JSON.parse(storedValue || "[]");

      return normalizeRecentSearches(parsedValue);
    } catch {
      return [];
    }
  });
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState([]);
  const [searchError, setSearchError] = useState("");
  const [resultErrors, setResultErrors] = useState({});
  const [downloadingKey, setDownloadingKey] = useState("");
  const [jobs, setJobs] = useState([]);
  const [jobActionId, setJobActionId] = useState("");
  const [destinationShelfEnabled, setDestinationShelfEnabled] = useState(false);
  const [destinationShelves, setDestinationShelves] = useState([]);
  const [selectedDestinationId, setSelectedDestinationId] = useState("");
  const [availableIndexers, setAvailableIndexers] = useState([]);
  const [settings, setSettings] = useState(cloneSettings(DEFAULT_SETTINGS));
  const [loading, setLoading] = useState({
    settings: true,
    search: false,
    request: false,
    download: false,
  });
  const [homeStatus, setHomeStatus] = useState({ message: "", error: false });
  const [settingsStatus, setSettingsStatus] = useState({ message: "", error: false });
  const [quickFilters, setQuickFilters] = useState({
    onlyEpub: true,
    spanishOnly: false,
    under20MB: false,
  });

  const isBusy = useMemo(
    () => loading.search || loading.request || loading.download,
    [loading.download, loading.request, loading.search],
  );

  useEffect(() => {
    document.title = t("ui.pageTitle", {}, "Bookseerr");
  }, [t]);

  useEffect(() => {
    document.documentElement.lang = `${language || "en"}`.split("-")[0];
  }, [language]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      RECENT_SEARCHES_STORAGE_KEY,
      JSON.stringify(recentSearches),
    );
  }, [recentSearches]);

  useEffect(() => {
    let cancelled = false;

    async function loadJobs() {
      try {
        const response = await fetch("/api/jobs");
        const data = await handleJsonResponse(response);

        if (!cancelled) {
          setJobs(Array.isArray(data.jobs) ? data.jobs : []);
        }
      } catch {}
    }

    loadJobs();
    const intervalId = window.setInterval(loadJobs, 8000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const response = await fetch("/api/settings");
        const data = await handleJsonResponse(response);

        if (cancelled) {
          return;
        }

        const normalizedLoadedSettings = normalizeSettings(data.settings || {});
        const shelves = Array.isArray(data.destinationShelves) ? data.destinationShelves : [];

        setSettings(normalizedLoadedSettings);
        setDestinationShelves(shelves);
        setDestinationShelfEnabled(Boolean(data.features?.destinationShelf) && shelves.length > 0);
        setAvailableIndexers(
          Array.isArray(data.availableIndexers) ? data.availableIndexers : [],
        );
      } catch (error) {
        if (!cancelled) {
          setHomeStatus({ message: error.message, error: true });
          setSettingsStatus({ message: error.message, error: true });
        }
      } finally {
        if (!cancelled) {
          setLoading((current) => ({ ...current, settings: false }));
        }
      }
    }

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setQuickFilters({
      onlyEpub: settings.filters.preferredFormat === "epub",
      spanishOnly: settings.filters.language === "es",
      under20MB:
        Number(settings.filters.maxSizeMB || 0) > 0 &&
        Number(settings.filters.maxSizeMB || 0) <= 20,
    });
  }, [
    settings.filters.language,
    settings.filters.maxSizeMB,
    settings.filters.preferredFormat,
  ]);

  useEffect(() => {
    if (!destinationShelfEnabled || !destinationShelves.length) {
      setSelectedDestinationId("");
      return;
    }

    const rememberLastShelf = Boolean(settings.calibre?.rememberLastShelf);
    const savedShelf = rememberLastShelf
      ? window.localStorage.getItem(LAST_SHELF_STORAGE_KEY) || ""
      : "";
    const defaultShelf = settings.calibre?.defaultShelf || "";
    const preferredShelf = savedShelf || defaultShelf || "";
    const shelfExists = destinationShelves.some((item) => item.id === preferredShelf);

    setSelectedDestinationId(shelfExists ? preferredShelf : "");

    if (!rememberLastShelf) {
      window.localStorage.removeItem(LAST_SHELF_STORAGE_KEY);
    }
  }, [
    destinationShelfEnabled,
    destinationShelves,
    settings.calibre?.defaultShelf,
    settings.calibre?.rememberLastShelf,
  ]);

  useEffect(() => {
    if (!destinationShelfEnabled) {
      return;
    }

    if (settings.calibre?.rememberLastShelf) {
      window.localStorage.setItem(LAST_SHELF_STORAGE_KEY, selectedDestinationId || "");
      return;
    }

    window.localStorage.removeItem(LAST_SHELF_STORAGE_KEY);
  }, [
    destinationShelfEnabled,
    selectedDestinationId,
    settings.calibre?.rememberLastShelf,
  ]);

  function mergeJob(job) {
    if (!job?.id) {
      return;
    }

    setJobs((current) => {
      const next = current.filter((item) => item.id !== job.id);
      return [job, ...next].sort((a, b) => {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
    });
  }

  async function refreshJobs() {
    const response = await fetch("/api/jobs");
    const data = await handleJsonResponse(response);
    setJobs(Array.isArray(data.jobs) ? data.jobs : []);
  }

  async function downloadBook(item) {
    const startedAt = Date.now();
    const resultKey = `${item.title}::${item.downloadUrl}`;

    setResultErrors((current) => {
      const next = { ...current };
      delete next[resultKey];
      return next;
    });
    setLoading((current) => ({ ...current, download: true }));
    setDownloadingKey(resultKey);
    setHomeStatus({
      message: t("ui.status.downloadStarting", { title: item.title }),
      error: false,
    });

    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: item.title,
          downloadUrl: item.downloadUrl,
          protocol: item.protocol || "torrent",
          destinationId: selectedDestinationId || "",
        }),
      });

      const data = await handleJsonResponse(response);
      await waitForMinimum(startedAt, 650);
      mergeJob(data.job);
      setHomeStatus({
        message: data.message || t("ui.status.downloadSuccess"),
        error: false,
      });
    } catch (error) {
      setResultErrors((current) => ({
        ...current,
        [resultKey]: error.message || t("ui.downloadErrorDescription"),
      }));
      setHomeStatus({ message: error.message, error: true });
    } finally {
      setLoading((current) => ({ ...current, download: false }));
      setDownloadingKey("");
    }
  }

  async function maybeAutoDownload(nextResults) {
    if (!settings.download.autoDownload || !nextResults.length) {
      return;
    }

    const best = nextResults[0];
    const preferredFormat = settings.filters.preferredFormat || "any";
    const matchesPreferred =
      preferredFormat === "any" || best.format === preferredFormat;

    if (settings.download.onlyIfPreferredFormat && !matchesPreferred) {
      return;
    }

    await downloadBook(best);
  }

  function saveRecentSearch(searchQuery) {
    const normalizedSearchQuery = normalizeRecentSearchEntry(searchQuery);

    if (!normalizedSearchQuery) {
      return;
    }

    setRecentSearches((current) =>
      normalizeRecentSearches([normalizedSearchQuery, ...current]),
    );
  }

  function clearRecentSearches() {
    setRecentSearches([]);
  }

  async function performSearch(nextQuery = query) {
    const trimmedQuery = normalizeSearchQueryInput(nextQuery, query).trim();

    if (!trimmedQuery) {
      setHasSearched(false);
      setResults([]);
      setSearchError("");
      setHomeStatus({ message: t("ui.status.enterTitle"), error: true });
      return;
    }

    if (loading.search) {
      return;
    }

    setLoading((current) => ({ ...current, search: true }));
    setHasSearched(true);
    setSearchError("");
    setResultErrors({});
    setQuery(trimmedQuery);
    saveRecentSearch(trimmedQuery);
    setHomeStatus({ message: t("ui.searchButtonLoading"), error: false });

    try {
      const response = await fetch(buildSearchUrl(trimmedQuery, quickFilters));
      const data = await handleJsonResponse(response);
      const nextResults = Array.isArray(data.results) ? data.results : [];

      setResults(nextResults);
      setHomeStatus({
        message: t("ui.status.foundResults", { count: nextResults.length }),
        error: false,
      });

      await maybeAutoDownload(nextResults);
    } catch (error) {
      setResults([]);
      setSearchError(error.message);
      setHomeStatus({ message: error.message, error: true });
    } finally {
      setLoading((current) => ({ ...current, search: false }));
    }
  }

  async function requestBook() {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setHomeStatus({ message: t("ui.alerts.enterBeforeRequest"), error: true });
      return;
    }

    if (loading.request) {
      return;
    }

    const startedAt = Date.now();
    setLoading((current) => ({ ...current, request: true }));
    setHomeStatus({ message: t("ui.requestButtonLoading"), error: false });

    try {
      const response = await fetch("/api/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: trimmedQuery,
          destinationId: selectedDestinationId || "",
        }),
      });

      const data = await handleJsonResponse(response);
      await waitForMinimum(startedAt, 650);
      mergeJob(data.job);
      setHomeStatus({
        message: t("ui.status.requestSuccess", { title: data.selected }),
        error: false,
      });
    } catch (error) {
      setHomeStatus({ message: error.message, error: true });
    } finally {
      setLoading((current) => ({ ...current, request: false }));
    }
  }

  async function saveSettings() {
    try {
      const normalizedCurrentSettings = normalizeSettings(settings);
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(normalizedCurrentSettings),
      });

      const data = await handleJsonResponse(response);
      const nextSettings = normalizeSettings(data.settings || normalizedCurrentSettings);
      const shelves = Array.isArray(data.destinationShelves) ? data.destinationShelves : [];

      setSettings(nextSettings);
      setDestinationShelves(shelves);
      setDestinationShelfEnabled(Boolean(data.features?.destinationShelf) && shelves.length > 0);
      setAvailableIndexers(
        Array.isArray(data.availableIndexers) ? data.availableIndexers : [],
      );
      setSettingsStatus({ message: t("ui.settings.saved"), error: false });
      setHomeStatus({ message: t("ui.settings.saved"), error: false });
    } catch (error) {
      setSettingsStatus({ message: error.message, error: true });
    }
  }

  function resetSettings() {
    setSettings(cloneSettings(DEFAULT_SETTINGS));
    setSettingsStatus({ message: t("ui.settings.defaultsRestored"), error: false });
  }

  async function restartJob(job) {
    if (!job?.id || jobActionId) {
      return;
    }

    const startedAt = Date.now();
    const isRetry = job.state === "error";

    setJobActionId(job.id);
    setHomeStatus({
      message: isRetry
        ? t("ui.jobs.status.retrying", { title: job.title })
        : t("ui.jobs.status.redownloading", { title: job.title }),
      error: false,
    });

    try {
      const response = await fetch(`/api/jobs/${job.id}/retry`, {
        method: "POST",
      });
      const data = await handleJsonResponse(response);

      await waitForMinimum(startedAt, 650);
      mergeJob(data.job);
      await refreshJobs();
      setHomeStatus({
        message: isRetry
          ? t("ui.jobs.messages.retryStarted", { title: job.title })
          : t("ui.jobs.messages.redownloadStarted", { title: job.title }),
        error: false,
      });
    } catch (error) {
      setHomeStatus({ message: error.message, error: true });
    } finally {
      setJobActionId("");
    }
  }

  if (i18nLoading || loading.settings) {
    return (
      <main className="app-shell">
        <div className="layout-shell">
          <aside className="sidebar">
            <div className="brand-block">
              <div className="brand-mark">B</div>
              <div className="brand-copy">
                <p className="eyebrow">Bookseerr</p>
              </div>
            </div>
          </aside>
          <section className="page-shell">
            <section className="panel placeholder-panel">
              <div>
                <p className="placeholder-label">{t("common.loading", {}, "Loading...")}</p>
                <h2>{t("common.loading", {}, "Loading...")}</h2>
              </div>
            </section>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="layout-shell">
        <Sidebar
          t={t}
          activePage={activePage}
          collapsed={collapsed}
          onToggle={() => setCollapsed((current) => !current)}
          onNavigate={setActivePage}
        />

        <section className="page-shell">
          {activePage === "home" ? (
            <SearchView
              t={t}
              query={query}
              recentSearches={recentSearches}
              hasSearched={hasSearched}
              onQueryChange={setQuery}
              onSearch={performSearch}
              onRecentSearchSelect={performSearch}
              onClearRecentSearches={clearRecentSearches}
              onQueryKeyDown={(event) => {
                if (event.key === "Enter") {
                  performSearch();
                }
              }}
              onRequestBest={requestBook}
              status={homeStatus.message}
              statusError={homeStatus.error}
              destinationShelfEnabled={destinationShelfEnabled}
              destinationShelves={destinationShelves}
              selectedDestinationId={selectedDestinationId}
              onDestinationChange={setSelectedDestinationId}
              quickFilters={quickFilters}
              onQuickFilterChange={(key, value) =>
                setQuickFilters((current) => ({ ...current, [key]: value }))
              }
              searchLoading={loading.search}
              requestLoading={loading.request}
              results={results}
              searchError={searchError}
              resultErrors={resultErrors}
              downloadingKey={downloadingKey}
              isBusy={isBusy}
              onDownload={downloadBook}
              onRetryDownload={downloadBook}
            />
          ) : activePage === "jobs" ? (
            <JobsView
              t={t}
              language={language}
              jobs={jobs}
              jobActionId={jobActionId}
              onRestartJob={restartJob}
            />
          ) : (
            <SettingsView
              t={t}
              settings={settings}
              availableIndexers={availableIndexers}
              destinationShelves={destinationShelves}
              onSettingsChange={(nextSettings) =>
                setSettings(normalizeSettings(nextSettings))
              }
              onSave={saveSettings}
              onReset={resetSettings}
              status={settingsStatus.message}
              statusError={settingsStatus.error}
            />
          )}
        </section>
      </div>
    </main>
  );
}
