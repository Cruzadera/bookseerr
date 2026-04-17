import { useState } from "react";

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

function getResultAuthor(item, t) {
  const author = `${item?.author || ""}`.trim() || inferAuthorFromTitle(item?.title || "");
  return author || t("ui.unknownAuthor");
}

function LoadingSkeleton() {
  return Array.from({ length: 3 }).map((_, index) => (
    <article key={index} className="result-card skeleton-card" aria-hidden="true">
      <div className="result-cover skeleton-block skeleton-cover" />
      <div className="result-main">
        <div className="result-head">
          <div className="result-copy">
            <div className="skeleton-line skeleton-line-title" />
            <div className="skeleton-line skeleton-line-author" />
          </div>
          <div className="result-actions skeleton-actions">
            <span className="skeleton-button" />
          </div>
        </div>
        <div className="result-submeta skeleton-submeta">
          <span className="skeleton-chip" />
          <span className="skeleton-chip" />
        </div>
        <div className="meta meta-pills skeleton-pills">
          <div className="skeleton-pill" />
          <div className="skeleton-pill" />
          <div className="skeleton-pill" />
        </div>
      </div>
    </article>
  ));
}

function StatePanel({ title, description, tone = "neutral", kicker, actionLabel, onAction }) {
  return (
    <div className={`state-panel state-panel--${tone}`}>
      <div className="state-panel-copy">
        <p className="state-panel-kicker">{kicker}</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {actionLabel ? (
        <div className="state-panel-actions">
          <button type="button" className="secondary" onClick={onAction}>
            {actionLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ResultCard({
  item,
  index,
  t,
  errorMessage,
  isBusy,
  isDownloading,
  onDownload,
  onRequestBest,
  onRetryDownload,
}) {
  const coverUrl = `${item?.coverUrl || ""}`.trim();
  const title = `${item?.title || "Book"}`.trim();
  const year = formatPublishYear(item.publishDate);
  const source = item.indexer || t("ui.indexer");
  const featured = index === 0;
  const formatValue = `${item.format || "unknown"}`.toUpperCase();
  const [imageBroken, setImageBroken] = useState(false);

  return (
    <article
      className={[
        "result-card",
        featured ? "is-featured" : "",
        isDownloading ? "is-downloading" : "",
        errorMessage ? "has-download-error" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="result-cover">
        {coverUrl && !imageBroken ? (
          <img
            src={coverUrl}
            alt={title}
            loading="lazy"
            onError={() => setImageBroken(true)}
          />
        ) : null}
        {!coverUrl || imageBroken ? (
          <span className="result-cover-fallback" aria-hidden="true">
            {(title.charAt(0) || "?").toUpperCase()}
          </span>
        ) : null}
        <span className="result-cover-format">{formatValue}</span>
      </div>

      <div className="result-main">
        {isDownloading ? (
          <span className="download-queued-badge">{t("ui.downloadQueued")}</span>
        ) : null}

        {errorMessage ? (
          <div className="result-error-banner">
            <div className="result-error-copy">
              <p className="state-panel-kicker">{t("common.error")}</p>
              <strong>{t("ui.downloadErrorTitle")}</strong>
              <p>{errorMessage || t("ui.downloadErrorDescription")}</p>
            </div>
            <button type="button" className="secondary" disabled={isBusy} onClick={onRetryDownload}>
              {t("ui.retryDownload")}
            </button>
          </div>
        ) : null}

        <div className="result-head">
          <div className="result-copy">
            <div className="result-title-row">
              <h2>{title}</h2>
              {featured ? <span className="result-badge">{t("ui.bestMatch")}</span> : null}
            </div>
            <p className="result-author">{getResultAuthor(item, t)}</p>
          </div>

          <div className="result-actions">
            {featured ? (
              <button type="button" className="secondary" disabled={isBusy} onClick={onRequestBest}>
                {t("ui.requestButton")}
              </button>
            ) : null}
            <button type="button" disabled={isBusy} onClick={onDownload}>
              {t("common.download")}
            </button>
          </div>
        </div>

        <div className="result-submeta">
          <span>{source}</span>
          {year ? <span>{year}</span> : null}
        </div>

        <dl className="meta meta-pills">
          <div>
            <dt>{t("ui.format")}</dt>
            <dd>{formatValue}</dd>
          </div>
          <div>
            <dt>{t("ui.seeders")}</dt>
            <dd>{Number(item.seeders ?? 0)}</dd>
          </div>
          <div>
            <dt>{t("ui.size")}</dt>
            <dd>{formatSize(item.sizeMB)}</dd>
          </div>
        </dl>
      </div>
    </article>
  );
}

export default function ResultsList({
  t,
  query,
  hasSearched,
  loading,
  results,
  searchError,
  resultErrors,
  downloadingKey,
  isBusy,
  onRetrySearch,
  onDownload,
  onRetryDownload,
  onRequestBest,
}) {
  if (loading) {
    return (
      <div className="results is-loading">
        <LoadingSkeleton />
      </div>
    );
  }

  if (searchError) {
    return (
      <div className="results">
        <StatePanel
          tone="error"
          kicker={t("common.error")}
          title={t("ui.searchErrorTitle")}
          description={searchError || t("ui.searchErrorDescription")}
          actionLabel={t("ui.retrySearch")}
          onAction={onRetrySearch}
        />
      </div>
    );
  }

  if (hasSearched && query && !results.length) {
    return (
      <div className="results">
        <StatePanel
          tone="empty"
          kicker={t("ui.emptyStateKicker")}
          title={t("ui.noResults")}
          description={t("ui.noResultsHint")}
        />
      </div>
    );
  }

  if (!results.length) {
    return <div className="results" />;
  }

  return (
    <div className="results">
      {results.map((item, index) => {
        const resultKey = `${item.title}::${item.downloadUrl}`;

        return (
          <ResultCard
            key={resultKey}
            item={item}
            index={index}
            t={t}
            errorMessage={resultErrors[resultKey]}
            isBusy={isBusy}
            isDownloading={downloadingKey === resultKey}
            onDownload={() => onDownload(item)}
            onRetryDownload={() => onRetryDownload(item)}
            onRequestBest={onRequestBest}
          />
        );
      })}
    </div>
  );
}
