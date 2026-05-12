function formatSize(sizeMB) {
  const numeric = Number(sizeMB || 0);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "-";
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

function EmptyFavorites({ t }) {
  return (
    <div className="state-panel state-panel--empty">
      <div className="state-panel-copy">
        <p className="state-panel-kicker">{t("ui.favorites.emptyKicker")}</p>
        <h2>{t("ui.favorites.emptyTitle")}</h2>
        <p>{t("ui.favorites.emptyDescription")}</p>
      </div>
    </div>
  );
}

export default function FavoritesView({
  t,
  favorites,
  isBusy,
  onDownload,
  onRemove,
}) {
  return (
    <section className="page-view">
      <section className="hero">
        <h1 className="hero-title">Bookseerr</h1>
        <p className="hero-subtitle">{t("ui.favorites.pageSubtitle")}</p>
      </section>

      <section className="panel">
        {!favorites.length ? (
          <EmptyFavorites t={t} />
        ) : (
          <div className="results favorites-results">
            {favorites.map((item) => {
              const year = formatPublishYear(item.publishDate);

              return (
                <article key={item.id} className="result-card">
                  <div className="result-cover">
                    {item.coverUrl ? (
                      <img src={item.coverUrl} alt={item.title || "Book"} loading="lazy" />
                    ) : (
                      <span className="result-cover-fallback" aria-hidden="true">
                        {(item.title?.charAt(0) || "?").toUpperCase()}
                      </span>
                    )}
                    <span className="result-cover-format">
                      {`${item.format || "unknown"}`.toUpperCase()}
                    </span>
                  </div>

                  <div className="result-main">
                    <div className="result-head">
                      <div className="result-copy">
                        <h2>{item.title || "Untitled"}</h2>
                        <p className="result-author">{item.author || t("ui.unknownAuthor")}</p>
                      </div>

                      <div className="result-actions">
                        <button type="button" disabled={isBusy} onClick={() => onDownload(item)}>
                          {t("ui.favorites.downloadNow")}
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          disabled={isBusy}
                          onClick={() => onRemove(item)}
                        >
                          {t("ui.favorites.remove")}
                        </button>
                      </div>
                    </div>

                    <div className="result-submeta">
                      <span>{item.indexer || t("ui.indexer")}</span>
                      {year ? <span>{year}</span> : null}
                    </div>

                    <dl className="meta meta-pills">
                      <div>
                        <dt>{t("ui.format")}</dt>
                        <dd>{`${item.format || "unknown"}`.toUpperCase()}</dd>
                      </div>
                      <div>
                        <dt>{t("ui.seeders")}</dt>
                        <dd>{Number(item.seeders || 0)}</dd>
                      </div>
                      <div>
                        <dt>{t("ui.size")}</dt>
                        <dd>{formatSize(item.sizeMB)}</dd>
                      </div>
                    </dl>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}
