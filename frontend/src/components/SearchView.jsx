import ResultsList from "./ResultsList";

export default function SearchView({
  t,
  query,
  recentSearches,
  hasSearched,
  onQueryChange,
  onSearch,
  onRecentSearchSelect,
  onClearRecentSearches,
  onQueryKeyDown,
  onRequestBest,
  status,
  statusError,
  destinationShelfEnabled,
  destinationShelves,
  selectedDestinationId,
  onDestinationChange,
  quickFilters,
  onQuickFilterChange,
  searchLoading,
  requestLoading,
  results,
  searchError,
  resultErrors,
  downloadingKey,
  isBusy,
  onDownload,
  onRetryDownload,
}) {
  return (
    <section className="page-view">
      <section className="hero">
        <h1 className="hero-title">Bookseerr</h1>
        <p className="hero-subtitle">{t("ui.heroHeading")}</p>
      </section>

      <section className="panel">
        <div className="search-row">
          <label className="field">
            <span>{t("ui.bookTitle")}</span>
            <input
              type="text"
              value={query}
              placeholder={t("ui.searchPlaceholder")}
              autoComplete="off"
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={onQueryKeyDown}
            />
          </label>

          <label
            className={`field field-compact${destinationShelfEnabled ? "" : " hidden"}`}
          >
            <span>{t("ui.shelf.destination")}</span>
            <select value={selectedDestinationId} onChange={(event) => onDestinationChange(event.target.value)}>
              <option value="">{t("ui.shelf.generalLibrary")}</option>
              {destinationShelves.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <div className="actions">
            <button type="button" className={searchLoading ? "is-loading" : ""} disabled={isBusy} onClick={onSearch}>
              {searchLoading ? t("ui.searchButtonLoading") : t("ui.searchButton")}
            </button>
            <button
              type="button"
              className={`secondary${requestLoading ? " is-loading" : ""}`}
              disabled={isBusy}
              onClick={onRequestBest}
            >
              {requestLoading ? t("ui.requestButtonLoading") : t("ui.requestButton")}
            </button>
          </div>
        </div>

        <div className="recent-searches" aria-live="polite">
          <div className="recent-searches-header">
            <span className="recent-searches-title">{t("ui.recent.title")}</span>
            {recentSearches.length ? (
              <button
                type="button"
                className="text-button"
                disabled={isBusy}
                onClick={onClearRecentSearches}
              >
                {t("ui.recent.clear")}
              </button>
            ) : null}
          </div>

          {recentSearches.length ? (
            <div className="recent-searches-list">
              {recentSearches.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="recent-search-chip"
                  disabled={isBusy}
                  onClick={() => onRecentSearchSelect(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          ) : (
            <p className="recent-searches-empty">{t("ui.recent.empty")}</p>
          )}
        </div>

        <div className="quick-filters">
          <span className="quick-filter-label">{t("ui.quickFilters.title")}</span>

          <label className="chip-toggle">
            <input
              type="checkbox"
              checked={quickFilters.onlyEpub}
              onChange={(event) => onQuickFilterChange("onlyEpub", event.target.checked)}
            />
            <span>{t("ui.quickFilters.onlyEpub")}</span>
          </label>

          <label className="chip-toggle">
            <input
              type="checkbox"
              checked={quickFilters.spanishOnly}
              onChange={(event) => onQuickFilterChange("spanishOnly", event.target.checked)}
            />
            <span>{t("ui.quickFilters.spanishOnly")}</span>
          </label>

          <label className="chip-toggle">
            <input
              type="checkbox"
              checked={quickFilters.under20MB}
              onChange={(event) => onQuickFilterChange("under20MB", event.target.checked)}
            />
            <span>{t("ui.quickFilters.under20MB")}</span>
          </label>
        </div>

        <p className={`status${statusError ? " error" : ""}`} role="status" aria-live="polite">
          {status}
        </p>

        <ResultsList
          t={t}
          query={query}
          hasSearched={hasSearched}
          loading={searchLoading}
          results={results}
          searchError={searchError}
          resultErrors={resultErrors}
          downloadingKey={downloadingKey}
          isBusy={isBusy}
          onRetrySearch={onSearch}
          onDownload={onDownload}
          onRetryDownload={onRetryDownload}
          onRequestBest={onRequestBest}
        />
      </section>
    </section>
  );
}
