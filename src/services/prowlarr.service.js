const axios = require("axios");

const DEFAULT_FILTERS = {
  preferredFormat: "epub",
  excludedFormats: ["pdf"],
  indexers: [],
  indexerPriority: [],
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

function normalizeIndexerName(value) {
  return `${value || ""}`.trim().toLowerCase();
}

function pickFirstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function extractAuthor(item = {}) {
  return pickFirstString(
    item.author,
    item.authorName,
    item.bookAuthor,
    item.artist,
    item.creator,
    item?.movieInfo?.author,
    item?.movieInfo?.authorName,
  );
}

function extractCoverUrl(item = {}) {
  const imageCandidate =
    Array.isArray(item.images) && item.images.length
      ? item.images.find((image) => typeof image?.url === "string" && image.url.trim())
      : null;

  return pickFirstString(
    item.coverUrl,
    item.posterUrl,
    item.poster,
    item.image,
    item.grabImage,
    imageCandidate?.url,
  );
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
    this.indexerCache = {
      fetchedAt: 0,
      items: [],
    };
  }

  async listIndexers() {
    const now = Date.now();

    if (now - this.indexerCache.fetchedAt < 5 * 60 * 1000 && this.indexerCache.items.length) {
      return [...this.indexerCache.items];
    }

    try {
      const response = await this.client.get("/api/v1/indexer");
      const items = [...new Set(
        (response.data || [])
          .filter((item) => item?.enable !== false)
          .map((item) => `${item.name || ""}`.trim())
          .filter(Boolean),
      )].sort((a, b) => a.localeCompare(b));

      this.indexerCache = {
        fetchedAt: now,
        items,
      };

      return [...items];
    } catch (error) {
      this.logger?.warn?.("Could not load Prowlarr indexers", {
        error: error.message,
      });
      return [];
    }
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
      indexers: new Set(
        (Array.isArray(filters.indexers) ? filters.indexers : DEFAULT_FILTERS.indexers)
          .map((item) => normalizeIndexerName(item))
          .filter(Boolean),
      ),
      indexerPriority: Array.isArray(filters.indexerPriority)
        ? (() => {
            const seen = new Set();
            return filters.indexerPriority
              .map((i) => normalizeIndexerName(i))
              .filter((n) => n && !seen.has(n) && seen.add(n));
          })()
        : [],
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

    if (/(español|espanol|spanish|castellano)/.test(normalized)) {
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

    if (
      filters.indexers.size > 0 &&
      !filters.indexers.has(normalizeIndexerName(item.indexer))
    ) {
      return false;
    }

    if ((item.seeders || 0) < filters.minSeeds) {
      return false;
    }

    if (filters.maxSizeMB > 0 && (item.sizeMB || 0) > filters.maxSizeMB) {
      return false;
    }

    if (
      filters.language !== "any" &&
      item.language !== "any" &&
      item.language !== filters.language
    ) {
      return false;
    }

    return true;
  }

  scoreResult(item, filters) {
    let score = 0;

    if (filters.preferredFormat !== "any" && item.format === filters.preferredFormat) {
      score += 120;
    }

    if (item.format === "epub") score += filters.preferredFormat === "epub" ? 100 : 30;
    if (item.format === "azw3") score += filters.preferredFormat === "azw3" ? 80 : 40;
    if (item.format === "mobi") score += filters.preferredFormat === "mobi" ? 60 : 20;
    if (item.format === "pdf") score -= 60;

    if (filters.language !== "any" && item.language === filters.language) {
      score += 20;
    }

    // Seeders: up to 100 points (caps to avoid domination)
    score += Math.min(item.seeders || 0, 100);

    // File size: prefer smaller files (scaled 0..30)
    const sizeMB = Number(item.sizeMB || 0);
    const sizeScore = sizeMB > 0
      ? Math.max(0, Math.round(30 * (1 - Math.min(sizeMB, 300) / 300)))
      : 0;
    score += sizeScore;

    // Indexer priority: optional ordered list in filters.indexerPriority
    if (Array.isArray(filters.indexerPriority) && filters.indexerPriority.length) {
      const idxName = normalizeIndexerName(item.indexer || "");
      const pos = filters.indexerPriority.indexOf(idxName);
      if (pos >= 0) {
        // Higher bonus for earlier (higher-priority) indexers
        score += (filters.indexerPriority.length - pos) * 10;
      }
    }

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
        author: extractAuthor(item),
        coverUrl: extractCoverUrl(item),
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

    const fallbackStages = [
      { name: "strict", filters: activeFilters },
      {
        name: "relaxed-language",
        filters:
          activeFilters.language !== "any"
            ? { ...activeFilters, language: "any" }
            : activeFilters,
      },
      {
        name: "relaxed-seeds",
        filters:
          activeFilters.minSeeds > 0
            ? { ...activeFilters, language: "any", minSeeds: 0 }
            : activeFilters,
      },
      {
        name: "relaxed-size",
        filters:
          activeFilters.maxSizeMB > 0
            ? { ...activeFilters, language: "any", minSeeds: 0, maxSizeMB: 0 }
            : activeFilters,
      },
    ];

    let selectedStage = "strict";
    let candidates = [];

    for (const stage of fallbackStages) {
      candidates = mapped.filter((item) => this.matchesFilters(item, stage.filters));

      if (candidates.length > 0) {
        selectedStage = stage.name;
        break;
      }
    }

    if (!candidates.length) {
      candidates = mapped.filter((item) => item.downloadUrl);
      selectedStage = "downloadable-only";
    }

    const finalResults = candidates
      .sort(
        (a, b) =>
          b.score - a.score ||
          (b.seeders || 0) - (a.seeders || 0) ||
          (a.sizeMB || 0) - (b.sizeMB || 0),
      )
      // Keep the computed `score` on the returned items so callers can inspect it
      .map(({ raw, ...item }) => item);

    this.logger.info("Search results ranked", {
      query,
      total: mapped.length,
      final: finalResults.length,
      stage: selectedStage,
      filters: {
        ...activeFilters,
        excludedFormats: [...activeFilters.excludedFormats],
        indexers: [...activeFilters.indexers],
      },
    });

    return finalResults;
  }
}

module.exports = ProwlarrService;