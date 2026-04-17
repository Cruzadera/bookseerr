export const LAST_SHELF_STORAGE_KEY = "bookseerr:last-destination-shelf";

export const DEFAULT_SETTINGS = Object.freeze({
  filters: {
    preferredFormat: "epub",
    excludedFormats: ["pdf"],
    indexers: [],
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

  if (normalized.startsWith("es")) {
    return "es";
  }

  if (normalized.startsWith("en")) {
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

export function cloneSettings(value = DEFAULT_SETTINGS) {
  return clone(value);
}

export function normalizeSettings(candidate = {}) {
  const merged = mergeDeep(clone(DEFAULT_SETTINGS), candidate);
  const preferredFormat = normalizeFormat(
    merged.filters?.preferredFormat,
    DEFAULT_SETTINGS.filters.preferredFormat,
  );

  return {
    filters: {
      preferredFormat,
      excludedFormats: [
        ...new Set(
          (Array.isArray(merged.filters?.excludedFormats)
            ? merged.filters.excludedFormats
            : DEFAULT_SETTINGS.filters.excludedFormats
          )
            .map((item) => normalizeFormat(item, ""))
            .filter((item) => item && item !== "any" && item !== preferredFormat),
        ),
      ],
      indexers: normalizeStringArray(merged.filters?.indexers),
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
