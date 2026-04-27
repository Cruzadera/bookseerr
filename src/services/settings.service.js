const fs = require("fs/promises");
const path = require("path");

const DEFAULT_SETTINGS = Object.freeze({
  filters: {
    preferredFormat: "epub",
    excludedFormats: ["pdf"],
    indexers: [],
    indexerPriority: [],
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
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeDeep(base, override) {
  if (!isObject(override)) {
    return base;
  }

  const result = { ...base };

  Object.entries(override).forEach(([key, value]) => {
    if (isObject(value) && isObject(result[key])) {
      result[key] = mergeDeep(result[key], value);
      return;
    }

    result[key] = value;
  });

  return result;
}

function normalizeFormat(value, fallback = "epub") {
  const normalized = `${value || fallback}`.trim().toLowerCase();
  const allowed = new Set(["any", "epub", "mobi", "azw3", "pdf"]);

  return allowed.has(normalized) ? normalized : fallback;
}

function normalizeLanguage(value, fallback = "any") {
  const normalized = `${value || fallback}`.trim().toLowerCase();

  if (normalized.startsWith("es") || normalized === "spanish") {
    return "es";
  }

  if (normalized.startsWith("en") || normalized === "english") {
    return "en";
  }

  return "any";
}

function normalizeNumber(value, fallback) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric < 0) {
    return fallback;
  }

  return numeric;
}

function normalizeOptionalString(value) {
  const normalized = `${value || ""}`.trim();
  return normalized || null;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((item) => `${item || ""}`.trim()).filter(Boolean))];
}

class SettingsService {
  constructor({ settingsFile = path.join("/data", "settings.json"), logger }) {
    this.settingsFile = settingsFile;
    this.logger = logger;
    this.settings = clone(DEFAULT_SETTINGS);
  }

  async ensureStoragePath() {
    try {
      await fs.mkdir(path.dirname(this.settingsFile), { recursive: true });
    } catch (error) {
      if (error.code !== "EACCES" && error.code !== "EPERM") {
        throw error;
      }

      const fallbackDir = path.join(process.cwd(), "data");
      this.settingsFile = path.join(fallbackDir, path.basename(this.settingsFile));
      await fs.mkdir(path.dirname(this.settingsFile), { recursive: true });
      this.logger?.warn?.("settings path is not writable, using local fallback", {
        settingsFile: this.settingsFile,
      });
    }
  }

  async init() {
    await this.ensureStoragePath();

    try {
      const content = await fs.readFile(this.settingsFile, "utf8");
      const parsed = JSON.parse(content);
      this.settings = this.normalizeSettings(parsed);
      await this.persist();
    } catch (error) {
      if (error.code !== "ENOENT") {
        this.logger?.warn?.("settings file could not be read, recreating defaults", {
          settingsFile: this.settingsFile,
          error: error.message,
        });
      }

      this.settings = clone(DEFAULT_SETTINGS);
      await this.persist();
    }

    return this.getSettings();
  }

  getSettings() {
    return clone(this.settings);
  }

  async updateSettings(nextSettings = {}) {
    const merged = mergeDeep(this.settings, nextSettings);
    this.settings = this.normalizeSettings(merged);
    await this.persist();
    return this.getSettings();
  }

  normalizeSettings(candidate = {}) {
    const merged = mergeDeep(clone(DEFAULT_SETTINGS), candidate);
    const preferredFormat = normalizeFormat(
      merged.filters?.preferredFormat,
      DEFAULT_SETTINGS.filters.preferredFormat,
    );

    const excludedFormats = [
      ...new Set(
        (Array.isArray(merged.filters?.excludedFormats)
          ? merged.filters.excludedFormats
          : DEFAULT_SETTINGS.filters.excludedFormats
        )
          .map((item) => normalizeFormat(item, ""))
          .filter(
            (item) => item && item !== "any" && item !== preferredFormat,
          ),
      ),
    ];

    return {
      filters: {
        preferredFormat,
        excludedFormats,
        indexers: normalizeStringArray(merged.filters?.indexers),
        indexerPriority: normalizeStringArray(merged.filters?.indexerPriority),
        minSeeds: normalizeNumber(
          merged.filters?.minSeeds,
          DEFAULT_SETTINGS.filters.minSeeds,
        ),
        maxSizeMB: normalizeNumber(
          merged.filters?.maxSizeMB,
          DEFAULT_SETTINGS.filters.maxSizeMB,
        ),
        language: normalizeLanguage(
          merged.filters?.language,
          DEFAULT_SETTINGS.filters.language,
        ),
      },
      download: {
        autoDownload: Boolean(merged.download?.autoDownload),
        onlyIfPreferredFormat:
          merged.download?.onlyIfPreferredFormat === undefined
            ? DEFAULT_SETTINGS.download.onlyIfPreferredFormat
            : Boolean(merged.download.onlyIfPreferredFormat),
      },
      calibre: {
        defaultShelf: normalizeOptionalString(merged.calibre?.defaultShelf),
        rememberLastShelf:
          merged.calibre?.rememberLastShelf === undefined
            ? DEFAULT_SETTINGS.calibre.rememberLastShelf
            : Boolean(merged.calibre.rememberLastShelf),
      },
    };
  }

  async persist() {
    await fs.writeFile(
      this.settingsFile,
      `${JSON.stringify(this.settings, null, 2)}\n`,
      "utf8",
    );
  }
}

module.exports = {
  SettingsService,
  DEFAULT_SETTINGS,
};
