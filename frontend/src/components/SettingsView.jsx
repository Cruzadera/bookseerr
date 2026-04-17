const FORMAT_OPTIONS = ["epub", "mobi", "azw3", "pdf"];

export default function SettingsView({
  t,
  settings,
  availableIndexers,
  destinationShelves,
  onSettingsChange,
  onSave,
  onReset,
  status,
  statusError,
}) {
  function updateSection(section, key, value) {
    onSettingsChange({
      ...settings,
      [section]: {
        ...settings[section],
        [key]: value,
      },
    });
  }

  function toggleExcludedFormat(format, checked) {
    const nextValues = new Set(settings.filters.excludedFormats);

    if (checked) {
      nextValues.add(format);
    } else {
      nextValues.delete(format);
    }

    if (format === settings.filters.preferredFormat) {
      nextValues.delete(format);
    }

    updateSection("filters", "excludedFormats", [...nextValues]);
  }

  function toggleIndexer(indexer, checked) {
    const nextValues = new Set(settings.filters.indexers);

    if (checked) {
      nextValues.add(indexer);
    } else {
      nextValues.delete(indexer);
    }

    updateSection("filters", "indexers", [...nextValues]);
  }

  return (
    <section className="page-view">
      <section className="panel settings-panel">
        <div className="settings-header">
          <p className="placeholder-label">{t("ui.placeholders.settings")}</p>
          <h2>{t("ui.settings.title")}</h2>
          <p className="settings-copy">{t("ui.settings.description")}</p>
        </div>

        <form
          className="settings-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSave();
          }}
        >
          <div className="settings-grid">
            <section className="settings-group">
              <h3>{t("ui.settings.filtersTitle")}</h3>

              <label className="field">
                <span>{t("ui.settings.preferredFormat")}</span>
                <select
                  value={settings.filters.preferredFormat}
                  onChange={(event) =>
                    updateSection("filters", "preferredFormat", event.target.value)
                  }
                >
                  <option value="any">{t("ui.settings.anyFormat")}</option>
                  {FORMAT_OPTIONS.map((format) => (
                    <option key={format} value={format}>
                      {format.toUpperCase()}
                    </option>
                  ))}
                </select>
              </label>

              <fieldset className="field checkbox-fieldset">
                <legend>{t("ui.settings.excludedFormats")}</legend>
                <div className="checkbox-grid">
                  {FORMAT_OPTIONS.map((format) => (
                    <label key={format} className="chip-toggle">
                      <input
                        type="checkbox"
                        checked={settings.filters.excludedFormats.includes(format)}
                        onChange={(event) =>
                          toggleExcludedFormat(format, event.target.checked)
                        }
                      />
                      <span>{format.toUpperCase()}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="field">
                <span>{t("ui.settings.minSeeds")}</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={settings.filters.minSeeds}
                  onChange={(event) =>
                    updateSection("filters", "minSeeds", Number(event.target.value || 0))
                  }
                />
              </label>

              <label className="field">
                <span>{t("ui.settings.maxSizeMB")}</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={settings.filters.maxSizeMB}
                  onChange={(event) =>
                    updateSection("filters", "maxSizeMB", Number(event.target.value || 0))
                  }
                />
              </label>

              <label className="field">
                <span>{t("ui.settings.language")}</span>
                <select
                  value={settings.filters.language}
                  onChange={(event) => updateSection("filters", "language", event.target.value)}
                >
                  <option value="any">{t("ui.settings.anyLanguage")}</option>
                  <option value="es">{t("ui.settings.spanish")}</option>
                  <option value="en">{t("ui.settings.english")}</option>
                </select>
              </label>
            </section>

            <div className="settings-side-stack">
              <section className="settings-group">
                <h3>{t("ui.settings.downloadTitle")}</h3>

                <label className="toggle-field">
                  <input
                    type="checkbox"
                    checked={settings.download.autoDownload}
                    onChange={(event) =>
                      updateSection("download", "autoDownload", event.target.checked)
                    }
                  />
                  <span>{t("ui.settings.autoDownload")}</span>
                </label>

                <label className="toggle-field">
                  <input
                    type="checkbox"
                    checked={settings.download.onlyIfPreferredFormat}
                    onChange={(event) =>
                      updateSection(
                        "download",
                        "onlyIfPreferredFormat",
                        event.target.checked,
                      )
                    }
                  />
                  <span>{t("ui.settings.onlyIfPreferredFormat")}</span>
                </label>
              </section>

              <section className="settings-group">
                <h3>{t("ui.settings.calibreTitle")}</h3>

                <label className="field">
                  <span>{t("ui.settings.defaultShelf")}</span>
                  <select
                    value={settings.calibre.defaultShelf || ""}
                    disabled={!destinationShelves.length}
                    onChange={(event) =>
                      updateSection(
                        "calibre",
                        "defaultShelf",
                        event.target.value || null,
                      )
                    }
                  >
                    <option value="">{t("ui.shelf.generalLibrary")}</option>
                    {destinationShelves.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="toggle-field">
                  <input
                    type="checkbox"
                    checked={settings.calibre.rememberLastShelf}
                    onChange={(event) =>
                      updateSection("calibre", "rememberLastShelf", event.target.checked)
                    }
                  />
                  <span>{t("ui.settings.rememberLastShelf")}</span>
                </label>
              </section>
            </div>

            <section className="settings-group settings-group-full">
              <h3>{t("ui.settings.indexers")}</h3>
              <p className="field-help">{t("ui.settings.indexersHelp")}</p>

              <div className="checkbox-grid checkbox-grid-compact">
                {availableIndexers.length ? (
                  availableIndexers.map((indexer) => (
                    <label key={indexer} className="chip-toggle">
                      <input
                        type="checkbox"
                        checked={settings.filters.indexers.includes(indexer)}
                        onChange={(event) => toggleIndexer(indexer, event.target.checked)}
                      />
                      <span>{indexer}</span>
                    </label>
                  ))
                ) : (
                  <p className="empty-note">{t("ui.settings.noIndexers")}</p>
                )}
              </div>
            </section>
          </div>

          <div className="actions settings-actions">
            <button type="submit">{t("ui.settings.save")}</button>
            <button type="button" className="secondary" onClick={onReset}>
              {t("ui.settings.reset")}
            </button>
          </div>

          <p className={`status${statusError ? " error" : ""}`} role="status" aria-live="polite">
            {status}
          </p>
        </form>
      </section>
    </section>
  );
}
