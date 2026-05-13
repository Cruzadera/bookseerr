export default function HardcoverOnboarding({
  t,
  token,
  loading,
  status,
  statusError,
  onTokenChange,
  onEnable,
  onSkip,
}) {
  return (
    <section className="page-view">
      <section className="hero">
        <h1 className="hero-title">Bookseerr</h1>
        <p className="hero-subtitle">{t("ui.hardcoverOnboarding.subtitle")}</p>
      </section>

      <section className="panel hardcover-onboarding-panel">
        <div className="settings-header">
          <p className="placeholder-label">{t("ui.hardcoverOnboarding.kicker")}</p>
          <h2>{t("ui.hardcoverOnboarding.title")}</h2>
          <p className="settings-copy">{t("ui.hardcoverOnboarding.description")}</p>
          <p className="settings-copy">{t("ui.hardcoverOnboarding.configuration")} <a href="https://hardcover.app/account/api" target="_blank" rel="noopener noreferrer">{t("ui.hardcoverOnboarding.configurationLinkText")}</a></p>
        </div>

        <label className="field">
          <span>{t("ui.settings.hardcoverToken")}</span>
          <input
            type="password"
            autoComplete="off"
            value={token}
            placeholder="Bearer fdafder..."
            onChange={(event) => onTokenChange(event.target.value)}
          />
        </label>

        <div className="actions settings-actions">
          <button type="button" disabled={loading} onClick={onEnable}>
            {loading
              ? t("ui.settings.hardcoverConnecting")
              : t("ui.hardcoverOnboarding.enable")}
          </button>
          <button type="button" className="secondary" disabled={loading} onClick={onSkip}>
            {t("ui.hardcoverOnboarding.skip")}
          </button>
        </div>

        <p className={`status${statusError ? " error" : ""}`} role="status" aria-live="polite">
          {status}
        </p>
      </section>
    </section>
  );
}
