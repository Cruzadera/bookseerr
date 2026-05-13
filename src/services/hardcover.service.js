const axios = require("axios");
const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const { ensureDir } = require("../utils/files");

const DEFAULT_ENDPOINT = "https://api.hardcover.app/v1/graphql";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CACHE_TTL_HOURS = 24 * 7;
const UNKNOWN_AUTHOR_PATTERNS = [
  /^unknown\s+author$/i,
  /^autor\s+desconocido$/i,
  /^desconocido$/i,
  /^unknown$/i,
];

function normalizeString(value) {
  return `${value || ""}`.trim();
}

function normalizeTitle(value) {
  return normalizeString(value)
    .toLowerCase()
    .replace(/\[[^\]]+\]|\([^\)]+\)/g, " ")
    .replace(/[^a-z0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAuthor(value) {
  return normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shouldRecoverAuthor(author) {
  const candidate = normalizeString(author);

  if (!candidate) {
    return true;
  }

  return UNKNOWN_AUTHOR_PATTERNS.some((pattern) => pattern.test(candidate));
}

function buildCacheKey(title, author) {
  return `${normalizeTitle(title)}::${normalizeAuthor(author)}`;
}

function pickFirstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function parseResult(raw) {
  const item = raw && typeof raw === "object" ? raw : {};
  const image = item.image && typeof item.image === "object" ? item.image : null;
  const hardcoverId = Number(item.id || item.book_id || item.object_id || 0) || null;

  const authorNames = Array.isArray(item.author_names)
    ? item.author_names
    : Array.isArray(item.authors)
      ? item.authors.map((author) => pickFirstString(author?.name, author?.full_name))
      : [];

  const seriesNames = Array.isArray(item.series_names)
    ? item.series_names
    : Array.isArray(item.featured_series)
      ? item.featured_series.map((entry) => pickFirstString(entry?.name))
      : pickFirstString(item.featured_series?.name)
        ? [item.featured_series.name]
        : [];

  const language = pickFirstString(item.language, item.primary_language, item.lang);
  const year = Number(item.release_year || item.publication_year || 0) || null;

  return {
    hardcoverId,
    title: pickFirstString(item.title, item.name),
    author: pickFirstString(authorNames[0], item.author_name),
    authorNames: authorNames.filter(Boolean),
    series: pickFirstString(seriesNames[0]),
    seriesNames: seriesNames.filter(Boolean),
    publishYear: year,
    language: language || null,
    coverUrl: pickFirstString(item.image?.url, image?.url, item.cover_url, item.cover),
    raw: item,
  };
}

/**
 * Parse the Typesense JSON blob returned by Hardcover's search() query.
 * Hardcover returns results as a JSON scalar that may be:
 *   - A Typesense response object: { hits: [{ document: {...} }], found: N, ... }
 *   - An array of documents directly
 *   - A JSON-encoded string of either of the above
 */
function parseTypesenseResults(raw) {
  if (!raw) return [];

  let data = raw;

  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return [];
    }
  }

  let hits = [];

  if (Array.isArray(data)) {
    hits = data;
  } else if (data && Array.isArray(data.hits)) {
    hits = data.hits.map((hit) => hit.document || hit);
  } else {
    return [];
  }

  return hits.map(parseResult).filter((item) => Boolean(item.title));
}

/**
 * Parse a book object returned from the Hardcover `books` GraphQL query.
 * This gives us cover images and other details not available in the search blob.
 */
function parseBookDetail(book) {
  if (!book || typeof book !== "object") return null;

  const authorNames = Array.isArray(book.contributions)
    ? book.contributions
        .map((c) => pickFirstString(c?.author?.name, c?.author?.full_name))
        .filter(Boolean)
    : [];

  const seriesName = pickFirstString(book.featured_series?.name);
  const releaseDate = book.release_date || null;
  const year = releaseDate ? (new Date(releaseDate).getFullYear() || null) : null;

  return {
    hardcoverId: Number(book.id || 0) || null,
    title: pickFirstString(book.title, book.name),
    author: authorNames[0] || "",
    authorNames,
    series: seriesName || null,
    seriesNames: seriesName ? [seriesName] : [],
    publishYear: year || null,
    language: null,
    coverUrl: pickFirstString(book.image?.url),
    raw: book,
  };
}

class HardcoverService {
  constructor({ config = {}, logger, settingsService, stateRepository }) {
    this.logger = logger;
    this.settingsService = settingsService;
    this.stateRepository = stateRepository;
    this.requestTimeoutMs = Number(config.requestTimeoutMs || 15000);
    this.endpoint = config.endpoint || DEFAULT_ENDPOINT;
    this.coversDir = config.coversDir || path.join("/data", "covers");
    this.inFlightByLookupKey = new Map();
    this.inFlightById = new Map();
    this.status = {
      code: "disabled",
      message: "Hardcover integration is disabled",
      checkedAt: null,
      retryAfter: null,
    };
  }

  getCacheTtlMs() {
    const hardcover = this.getSettings();
    const hours = Number(hardcover.cacheTtlHours || DEFAULT_CACHE_TTL_HOURS);

    if (!Number.isFinite(hours) || hours <= 0) {
      return CACHE_TTL_MS;
    }

    return Math.max(1, Math.floor(hours)) * 60 * 60 * 1000;
  }

  shouldCacheCoverAssets() {
    const hardcover = this.getSettings();
    return hardcover.cacheCoverAssets !== false;
  }

  buildLookupCacheKey(title, author) {
    return `lookup:${buildCacheKey(title, author)}`;
  }

  buildIdCacheKey(hardcoverId) {
    const value = Number(hardcoverId || 0) || 0;
    return value > 0 ? `id:${value}` : "";
  }

  isExpired(cachedEntry) {
    if (!cachedEntry?.expiresAt) {
      return true;
    }

    return Date.now() > new Date(cachedEntry.expiresAt).getTime();
  }

  getCachedEntryByKey(cacheKey) {
    if (!cacheKey || !this.stateRepository?.getHardcoverCacheEntry) {
      return null;
    }

    return this.stateRepository.getHardcoverCacheEntry(cacheKey);
  }

  getCachedEntry(title, author, hardcoverId = null) {
    const exactKey = this.buildLookupCacheKey(title, author);
    const titleOnlyKey = this.buildLookupCacheKey(title, "");
    const idKey = this.buildIdCacheKey(hardcoverId);

    return (
      this.getCachedEntryByKey(exactKey) ||
      this.getCachedEntryByKey(titleOnlyKey) ||
      this.getCachedEntryByKey(idKey)
    );
  }

  getCachedMetadata(title, author, options = {}) {
    const entry = this.getCachedEntry(title, author, options.hardcoverId);

    if (!entry?.value) {
      return null;
    }

    if (this.isExpired(entry) && !options.allowExpired) {
      return null;
    }

    return {
      ...entry.value,
      createdAt: entry.createdAt || entry.cachedAt || null,
      updatedAt: entry.updatedAt || entry.cachedAt || null,
      cacheExpired: this.isExpired(entry),
    };
  }

  async setCachedMetadata(title, author, value, options = {}) {
    if (!this.stateRepository?.setHardcoverCacheEntry) {
      return;
    }

    const nowIso = new Date().toISOString();
    const ttlMs = this.getCacheTtlMs();
    const exactKey = this.buildLookupCacheKey(title, author);
    const titleOnlyKey = this.buildLookupCacheKey(title, "");
    const idKey = this.buildIdCacheKey(options.hardcoverId || value?.hardcoverId);
    const keys = [exactKey, titleOnlyKey, idKey].filter(Boolean);

    for (const cacheKey of keys) {
      const current = this.getCachedEntryByKey(cacheKey);
      await this.stateRepository.setHardcoverCacheEntry(cacheKey, {
        value,
        createdAt: current?.createdAt || nowIso,
        updatedAt: nowIso,
        expiresAt: new Date(Date.now() + ttlMs).toISOString(),
      });
    }
  }

  async dedupeByMap(map, key, task) {
    if (!key) {
      return task();
    }

    if (map.has(key)) {
      return map.get(key);
    }

    const promise = Promise.resolve()
      .then(task)
      .finally(() => {
        map.delete(key);
      });

    map.set(key, promise);
    return promise;
  }

  toCachePayload(metadata, fallback = {}) {
    if (!metadata) {
      return null;
    }

    return {
      hardcoverId: Number(metadata.hardcoverId || fallback.hardcoverId || 0) || null,
      title: pickFirstString(metadata.title, fallback.title),
      author: pickFirstString(metadata.author, fallback.author),
      coverUrl: pickFirstString(metadata.coverUrl, fallback.coverUrl),
      coverLocalPath: pickFirstString(metadata.coverLocalPath, fallback.coverLocalPath),
      coverResolvedUrl: pickFirstString(
        metadata.coverLocalPath,
        metadata.coverUrl,
        fallback.coverLocalPath,
        fallback.coverUrl,
      ),
      publishYear: Number(metadata.publishYear || fallback.publishYear || 0) || null,
      language: pickFirstString(metadata.language, fallback.language) || null,
      series: pickFirstString(metadata.series, fallback.series) || null,
      lastUpdated: new Date().toISOString(),
    };
  }

  applyCachedMetadata(item = {}, metadata = {}) {
    const hardcover = this.getSettings();
    const autoFetchCovers = hardcover.autoFetchCovers !== false;
    const shouldReplaceAuthor = shouldRecoverAuthor(item.author);
    const preferredProvider = Array.isArray(hardcover.providerPriority)
      ? hardcover.providerPriority
      : ["hardcover", "indexer"];
    const hardcoverPreferred = preferredProvider[0] === "hardcover";

    const resolvedCover = pickFirstString(
      metadata.coverLocalPath,
      metadata.coverResolvedUrl,
      metadata.coverUrl,
    );

    const nextCover = autoFetchCovers
      ? hardcoverPreferred
        ? pickFirstString(resolvedCover, item.coverUrl)
        : pickFirstString(item.coverUrl, resolvedCover)
      : item.coverUrl;

    const nextPublishDate =
      item.publishDate || (metadata.publishYear ? `${metadata.publishYear}-01-01` : null);

    return {
      ...item,
      hardcoverId: Number(metadata.hardcoverId || item.hardcoverId || 0) || null,
      author: shouldReplaceAuthor
        ? pickFirstString(metadata.author, item.author)
        : pickFirstString(item.author, metadata.author),
      coverUrl: nextCover || null,
      coverLocalPath: pickFirstString(metadata.coverLocalPath, item.coverLocalPath) || null,
      coverRemoteUrl: pickFirstString(metadata.coverUrl, item.coverRemoteUrl) || null,
      series: pickFirstString(item.series, metadata.series) || null,
      publishDate: nextPublishDate,
      language: pickFirstString(item.language, metadata.language) || null,
      publishYear: Number(metadata.publishYear || item.publishYear || 0) || null,
      metadataUpdatedAt: metadata.lastUpdated || item.metadataUpdatedAt || null,
      metadataSource: "hardcover-cache",
    };
  }

  buildCoverFilename(coverUrl, hardcoverId) {
    const digest = crypto
      .createHash("sha1")
      .update(`${hardcoverId || "x"}:${coverUrl}`)
      .digest("hex");
    const parsed = new URL(coverUrl);
    const extension = path.extname(parsed.pathname || "").toLowerCase();
    const safeExtension = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"].includes(extension)
      ? extension
      : ".jpg";

    return `${digest}${safeExtension}`;
  }

  async cacheCoverAsset(coverUrl, hardcoverId) {
    const normalizedCoverUrl = normalizeString(coverUrl);

    if (!normalizedCoverUrl || !this.shouldCacheCoverAssets()) {
      return "";
    }

    if (normalizedCoverUrl.startsWith("/covers/")) {
      return normalizedCoverUrl;
    }

    if (!/^https?:\/\//i.test(normalizedCoverUrl)) {
      return "";
    }

    const dedupeKey = `${hardcoverId || "x"}:${normalizedCoverUrl}`;

    return this.dedupeByMap(this.inFlightById, dedupeKey, async () => {
      try {
        const filename = this.buildCoverFilename(normalizedCoverUrl, hardcoverId);
        const filePath = path.join(this.coversDir, filename);
        const publicPath = `/covers/${filename}`;

        await ensureDir(this.coversDir);

        try {
          await fs.access(filePath);
          return publicPath;
        } catch {}

        const response = await axios.get(normalizedCoverUrl, {
          timeout: this.requestTimeoutMs,
          responseType: "arraybuffer",
          headers: {
            "user-agent": "bookseerr/1 metadata-enrichment",
          },
        });

        const contentType = `${response.headers?.["content-type"] || ""}`.toLowerCase();

        if (contentType && !contentType.startsWith("image/")) {
          return "";
        }

        await fs.writeFile(filePath, Buffer.from(response.data));
        return publicPath;
      } catch (error) {
        this.logger?.warn?.("Failed to cache hardcover cover", {
          coverUrl: normalizedCoverUrl,
          error: error.message,
        });
        return "";
      }
    });
  }

  getSettings() {
    const settings = this.settingsService?.getSettings?.() || {};
    return settings.hardcover || {};
  }

  getPublicStatus() {
    const hardcover = this.getSettings();
    const hasToken = Boolean(normalizeString(hardcover.token));
    const enabled = Boolean(hardcover.enabled);

    if (!enabled) {
      return {
        code: "disabled",
        message: "Hardcover integration is disabled",
        checkedAt: this.status.checkedAt,
        retryAfter: this.status.retryAfter,
        enabled,
        hasToken,
      };
    }

    if (!hasToken) {
      return {
        code: "not-configured",
        message: "Hardcover token is not configured",
        checkedAt: this.status.checkedAt,
        retryAfter: this.status.retryAfter,
        enabled,
        hasToken,
      };
    }

    return {
      code: this.status.code,
      message: this.status.message,
      checkedAt: this.status.checkedAt,
      retryAfter: this.status.retryAfter,
      enabled,
      hasToken,
    };
  }

  setStatus(code, message, extra = {}) {
    this.status = {
      code,
      message,
      checkedAt: new Date().toISOString(),
      retryAfter: extra.retryAfter || null,
    };
  }

  isAvailable() {
    const hardcover = this.getSettings();
    return Boolean(hardcover.enabled) && Boolean(normalizeString(hardcover.token));
  }

  async requestGraphQL({ token, query, variables = {} }) {
    try {
      const response = await axios.post(
        this.endpoint,
        {
          query,
          variables,
        },
        {
          timeout: this.requestTimeoutMs,
          headers: {
            authorization: token,
            "user-agent": "bookseerr/1 metadata-enrichment",
            "content-type": "application/json",
          },
        },
      );

      if (Array.isArray(response.data?.errors) && response.data.errors.length > 0) {
        const details = response.data.errors.map((entry) => entry.message).filter(Boolean).join("; ");
        const error = new Error(details || "Hardcover query failed");
        error.statusCode = 502;
        throw error;
      }

      this.setStatus("connected", "Connected");
      return response.data?.data || {};
    } catch (error) {
      const status = Number(error?.response?.status || 0);

      if (status === 401 || status === 403) {
        this.setStatus("invalid-token", "Invalid token");
        const invalidTokenError = new Error("Invalid Hardcover token");
        invalidTokenError.statusCode = 401;
        throw invalidTokenError;
      }

      if (status === 429) {
        const retryAfterHeader = Number(error?.response?.headers?.["retry-after"] || 60);
        const retryAfter = new Date(Date.now() + retryAfterHeader * 1000).toISOString();
        this.setStatus("rate-limited", "Rate limited", { retryAfter });
        const rateLimitError = new Error("Hardcover rate limit reached");
        rateLimitError.statusCode = 429;
        throw rateLimitError;
      }

      this.setStatus("error", error.message || "Hardcover unavailable");
      throw error;
    }
  }

  async validateToken(tokenOverride = "") {
    const token = normalizeString(tokenOverride) || normalizeString(this.getSettings().token);

    if (!token) {
      this.setStatus("not-configured", "Hardcover token is not configured");
      return {
        ok: false,
        code: "not-configured",
        message: "Hardcover token is not configured",
      };
    }

    try {
      const data = await this.requestGraphQL({
        token,
        query: `query ValidateHardcoverToken { me { id username } }`,
      });

      return {
        ok: true,
        code: "connected",
        message: "Connected",
        user: data.me || null,
      };
    } catch (error) {
      return {
        ok: false,
        code: this.status.code,
        message: this.status.message || error.message,
      };
    }
  }

  scoreCandidate(candidate, title, author) {
    const normalizedCandidateTitle = normalizeTitle(candidate.title);
    const normalizedTitle = normalizeTitle(title);
    const normalizedCandidateAuthor = normalizeAuthor(candidate.author);
    const normalizedAuthor = normalizeAuthor(author);

    let score = 0;

    if (normalizedCandidateTitle === normalizedTitle) {
      score += 100;
    } else if (normalizedCandidateTitle.includes(normalizedTitle) || normalizedTitle.includes(normalizedCandidateTitle)) {
      score += 50;
    }

    if (normalizedAuthor && normalizedCandidateAuthor === normalizedAuthor) {
      score += 60;
    } else if (normalizedAuthor && normalizedCandidateAuthor.includes(normalizedAuthor)) {
      score += 30;
    }

    if (candidate.coverUrl) {
      score += 8;
    }

    if (candidate.publishYear) {
      score += 4;
    }

    return score;
  }

  async searchMetadata({ title, author, hardcoverId = null, allowExpired = false, forceRefresh = false }) {
    const normalizedTitle = normalizeString(title);

    if (!normalizedTitle) {
      return null;
    }

    if (!forceRefresh) {
      const cached = this.getCachedMetadata(title, author, {
        hardcoverId,
        allowExpired,
      });

      if (cached) {
        return cached;
      }
    }

    const hardcover = this.getSettings();
    const token = normalizeString(hardcover.token);

    if (!token) {
      return null;
    }

    const lookupKey = this.buildLookupCacheKey(title, author);

    return this.dedupeByMap(this.inFlightByLookupKey, lookupKey, async () => {
      if (!forceRefresh) {
        const cached = this.getCachedMetadata(title, author, {
          hardcoverId,
          allowExpired,
        });

        if (cached) {
          return cached;
        }
      }

      const queryText = normalizeString(author)
        ? `${normalizeString(title)} ${normalizeString(author)}`
        : normalizeString(title);

      const searchData = await this.requestGraphQL({
        token,
        query: `
          query SearchBookMetadata($query: String!, $perPage: Int!, $page: Int!) {
            search(query: $query, query_type: "Book", per_page: $perPage, page: $page) {
              ids
              results
            }
          }
        `,
        variables: {
          query: queryText,
          perPage: 5,
          page: 1,
        },
      });

      const ids = Array.isArray(searchData?.search?.ids)
        ? searchData.search.ids.filter(Boolean).map(Number).filter(Boolean).slice(0, 5)
        : [];
      const searchHits = parseTypesenseResults(searchData?.search?.results);

      if (!ids.length && !searchHits.length) {
        await this.setCachedMetadata(title, author, null, { hardcoverId });
        return null;
      }

      const detailMap = {};

      if (ids.length) {
        try {
          const booksData = await this.requestGraphQL({
            token,
            query: `
              query GetHardcoverBooksByIds($ids: [Int!]!) {
                books(where: { id: { _in: $ids } }, limit: 5) {
                  id
                  title
                  release_date
                  image { url }
                }
              }
            `,
            variables: { ids },
          });

          for (const book of booksData?.books || []) {
            if (book?.id != null) {
              detailMap[String(book.id)] = book;
            }
          }
        } catch (error) {
          this.logger?.warn?.("Hardcover book detail lookup failed", {
            error: error.message,
          });
        }
      }

      const candidates = searchHits.length
        ? searchHits.map((hit, index) => {
            const id = Number(ids[index] || hit.hardcoverId || 0) || null;
            const detail = detailMap[String(id || "")];

            return {
              ...hit,
              hardcoverId: id,
              coverUrl: pickFirstString(detail?.image?.url, hit.coverUrl),
              series: pickFirstString(hit.series, detail?.featured_series?.name) || null,
            };
          })
        : ids
            .map((id) => {
              const book = detailMap[String(id)];
              const parsed = book ? parseBookDetail(book) : null;
              return parsed ? { ...parsed, hardcoverId: id } : null;
            })
            .filter(Boolean);

      if (!candidates.length) {
        await this.setCachedMetadata(title, author, null, { hardcoverId });
        return null;
      }

      const best =
        [...candidates]
          .map((entry) => ({
            item: entry,
            score: this.scoreCandidate(entry, title, author),
          }))
          .sort((a, b) => b.score - a.score)
          .map((entry) => entry.item)[0] || null;

      if (!best) {
        await this.setCachedMetadata(title, author, null, { hardcoverId });
        return null;
      }

      const localCoverPath = await this.cacheCoverAsset(best.coverUrl, best.hardcoverId);
      const payload = this.toCachePayload(
        {
          ...best,
          coverLocalPath: localCoverPath || null,
        },
        {
          title,
          author,
        },
      );

      await this.setCachedMetadata(title, author, payload, {
        hardcoverId: best.hardcoverId || hardcoverId,
      });

      return payload;
    });
  }

  async enrichBook(item = {}, options = {}) {
    const allowExpired = Boolean(options.allowExpired);
    const forceRefresh = Boolean(options.forceRefresh);
    const useCacheOnly = Boolean(options.useCacheOnly);

    try {
      if (!forceRefresh) {
        const cached = this.getCachedMetadata(item.title, item.author, {
          hardcoverId: item.hardcoverId,
          allowExpired: allowExpired || useCacheOnly || !this.isAvailable(),
        });

        if (cached) {
          return this.applyCachedMetadata(item, cached);
        }
      }

      if (useCacheOnly || !this.isAvailable()) {
        return { ...item, metadataSource: "indexer" };
      }

      const metadata = await this.searchMetadata({
        title: item.title,
        author: item.author,
        hardcoverId: item.hardcoverId,
        allowExpired,
        forceRefresh,
      });

      if (!metadata) {
        return { ...item, metadataSource: "indexer" };
      }

      return {
        ...this.applyCachedMetadata(item, metadata),
        metadataSource: forceRefresh ? "hardcover-refresh" : "hardcover",
      };
    } catch (error) {
      this.logger?.warn?.("Hardcover enrichment failed", {
        title: item.title,
        error: error.message,
      });

      const fallbackCached = this.getCachedMetadata(item.title, item.author, {
        hardcoverId: item.hardcoverId,
        allowExpired: true,
      });

      if (fallbackCached) {
        return this.applyCachedMetadata(item, fallbackCached);
      }

      return { ...item, metadataSource: "indexer" };
    }
  }

  async enrichList(items = [], options = {}) {
    if (!Array.isArray(items) || !items.length) {
      return [];
    }

    const enriched = [];

    for (const item of items) {
      enriched.push(await this.enrichBook(item, options));
    }

    return enriched;
  }
}

module.exports = HardcoverService;