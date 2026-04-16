const axios = require("axios");

const DEFAULT_FILTERS = {
  preferredFormat: "epub",
  excludedFormats: ["pdf"],
  minSeeds: 5,
  maxSizeMB: 50,
  language: "any",
};

function toSizeMB(size) {
  const numeric = Number(size || 0);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }

  return Number((numeric / 1024 / 1024).toFixed(2));
}

class ProwlarrService {
  constructor({ config, logger }) {
    this.logger = logger;
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.requestTimeoutMs,
      headers: {
        "X-Api-Key": config.apiKey,
      },
    });
  }

  normalizeFilters(filters = {}) {
    const preferredFormat = `${
      filters.preferredFormat || DEFAULT_FILTERS.preferredFormat
    }`
      .trim()
      .toLowerCase();
    const allowedFormats = new Set(["any", "epub", "azw3", "mobi", "pdf"]);
    const rawLanguage = `${filters.language || DEFAULT_FILTERS.language}`
      .trim()
      .toLowerCase();

    return {
      preferredFormat: allowedFormats.has(preferredFormat)
        ? preferredFormat
        : DEFAULT_FILTERS.preferredFormat,
      excludedFormats: new Set(
        (Array.isArray(filters.excludedFormats)
          ? filters.excludedFormats
          : DEFAULT_FILTERS.excludedFormats
        )
          .map((item) => `${item || ""}`.trim().toLowerCase())
          .filter(Boolean),
      ),
      minSeeds: Math.max(0, Number(filters.minSeeds ?? DEFAULT_FILTERS.minSeeds) || 0),
      maxSizeMB: Math.max(
        0,
        Number(filters.maxSizeMB ?? DEFAULT_FILTERS.maxSizeMB) || 0,
      ),
      language:
        rawLanguage === "es" || rawLanguage === "spanish"
          ? "es"
          : rawLanguage === "en" || rawLanguage === "english"
            ? "en"
            : "any",
    };
  }

  guessFormat(title = "") {
    const normalized = title.toLowerCase();

    if (normalized.includes("epub")) return "epub";
    if (normalized.includes("azw3")) return "azw3";
    if (normalized.includes("mobi")) return "mobi";
    if (normalized.includes("pdf")) return "pdf";
    return "unknown";
  }

  guessLanguage(item = {}) {
    const normalized = `${item.title || ""} ${item.indexer || ""}`.toLowerCase();

    if (/(español|espanol|spanish|castellano|epublibre)/.test(normalized)) {
      return "es";
    }

    if (/(english|inglés|ingles)/.test(normalized)) {
      return "en";
    }

    return "any";
  }

  matchesFilters(item, filters) {
    if (!item.downloadUrl) {
      return false;
    }

    if (filters.excludedFormats.has(item.format)) {
      return false;
    }

    if ((item.seeders || 0) < filters.minSeeds) {
      return false;
    }

    if (filters.maxSizeMB > 0 && (item.sizeMB || 0) > filters.maxSizeMB) {
      return false;
    }

    if (filters.language !== "any" && item.language !== filters.language) {
      return false;
    }

    return true;
  }

  scoreResult(item, filters) {
    let score = 0;
    const isEpublibre =
      item.indexer && item.indexer.toLowerCase().includes("epublibre");

    if (filters.preferredFormat !== "any" && item.format === filters.preferredFormat) {
      score += 120;
    }

    if (item.format === "epub") score += filters.preferredFormat === "epub" ? 100 : 30;
    if (item.format === "azw3") score += filters.preferredFormat === "azw3" ? 80 : 40;
    if (item.format === "mobi") score += filters.preferredFormat === "mobi" ? 60 : 20;
    if (item.format === "pdf") score -= 60;

    if (isEpublibre) {
      score += 25;
    }

    if (filters.language !== "any" && item.language === filters.language) {
      score += 20;
    }

    score += Math.min(item.seeders || 0, 100);

    return score;
  }

  async search(query, filters = {}) {
    const activeFilters = this.normalizeFilters(filters);
    const response = await this.client.get("/api/v1/search", {
      params: { query, type: "search" },
    });

    const mapped = (response.data || []).map((item) => {
      const mappedItem = {
        title: item.title,
        size: item.size,
        sizeMB: toSizeMB(item.size),
        indexer: item.indexer,
        protocol: item.protocol || "torrent",
        downloadUrl: item.downloadUrl || item.guid || item.magnetUrl,
        format: this.guessFormat(item.title),
        seeders: Number(item.seeders || 0),
        publishDate: item.publishDate,
        raw: item,
      };

      return {
        ...mappedItem,
        language: this.guessLanguage(mappedItem),
        score: this.scoreResult(mappedItem, activeFilters),
      };
    });

    const finalResults = mapped
      .filter((item) => this.matchesFilters(item, activeFilters))
      .sort(
        (a, b) =>
          b.score - a.score ||
          (b.seeders || 0) - (a.seeders || 0) ||
          (a.sizeMB || 0) - (b.sizeMB || 0),
      )
      .map(({ raw, score, ...item }) => item);

    this.logger.info("Search results ranked", {
      query,
      total: mapped.length,
      final: finalResults.length,
      filters: {
        ...activeFilters,
        excludedFormats: [...activeFilters.excludedFormats],
      },
    });

    return finalResults;
  }
}

module.exports = ProwlarrService;