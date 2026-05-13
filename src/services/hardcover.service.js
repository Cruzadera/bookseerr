const axios = require("axios");

const DEFAULT_ENDPOINT = "https://api.hardcover.app/v1/graphql";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
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
    this.status = {
      code: "disabled",
      message: "Hardcover integration is disabled",
      checkedAt: null,
      retryAfter: null,
    };
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

  getCachedMetadata(title, author) {
    if (!this.stateRepository?.getHardcoverCacheEntry) {
      return null;
    }

    const cached = this.stateRepository.getHardcoverCacheEntry(buildCacheKey(title, author));

    if (!cached || !cached.expiresAt) {
      return null;
    }

    if (Date.now() > new Date(cached.expiresAt).getTime()) {
      return null;
    }

    return cached.value || null;
  }

  async setCachedMetadata(title, author, value) {
    if (!this.stateRepository?.setHardcoverCacheEntry) {
      return;
    }

    await this.stateRepository.setHardcoverCacheEntry(buildCacheKey(title, author), {
      value,
      expiresAt: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
      cachedAt: new Date().toISOString(),
    });
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

  async searchMetadata({ title, author }) {
    const hardcover = this.getSettings();
    const token = normalizeString(hardcover.token);

    if (!token || !normalizeString(title)) {
      return null;
    }

    const cached = this.getCachedMetadata(title, author);

    if (cached) {
      return cached;
    }

    const queryText = normalizeString(author)
      ? `${normalizeString(title)} ${normalizeString(author)}`
      : normalizeString(title);

    // Step 1: Search Hardcover for the book.
    // `results` is a Typesense JSON blob (not a GraphQL array).
    // `ids` is a plain integer array — much easier to work with.
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

    // Parse the Typesense blob for basic metadata (title, author_names, release_year, etc.)
    const searchHits = parseTypesenseResults(searchData?.search?.results);

    if (!ids.length && !searchHits.length) {
      await this.setCachedMetadata(title, author, null);
      return null;
    }

    // Step 2: Fetch full book details (cover image) by ID.
    // Cover images are NOT included in the Typesense search blob — we need a
    // separate `books` query.  We stay within the API depth limit (≤3) by
    // not nesting contributions here; author data comes from the search blob.
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
                featured_series { name }
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
      } catch (err) {
        this.logger?.warn?.("Hardcover book detail lookup failed", { error: err.message });
      }
    }

    // Merge: prefer detail data for covers/series; prefer search blob for authors
    const candidates = searchHits.length > 0
      ? searchHits.map((hit, index) => {
          const id = String(ids[index] ?? "");
          const detail = detailMap[id];
          return {
            ...hit,
            coverUrl: pickFirstString(detail?.image?.url, hit.coverUrl),
            series: pickFirstString(hit.series, detail?.featured_series?.name) || null,
          };
        })
      : ids
          .map((id) => {
            const book = detailMap[String(id)];
            return book ? parseBookDetail(book) : null;
          })
          .filter(Boolean);

    if (!candidates.length) {
      await this.setCachedMetadata(title, author, null);
      return null;
    }

    const best =
      [...candidates]
        .map((item) => ({ item, score: this.scoreCandidate(item, title, author) }))
        .sort((a, b) => b.score - a.score)
        .map((entry) => entry.item)[0] || null;

    await this.setCachedMetadata(title, author, best);
    return best;
  }

  async enrichBook(item = {}) {
    if (!this.isAvailable()) {
      return { ...item, metadataSource: "indexer" };
    }

    try {
      const metadata = await this.searchMetadata({
        title: item.title,
        author: item.author,
      });

      if (!metadata) {
        return { ...item, metadataSource: "indexer" };
      }

      const hardcover = this.getSettings();
      const autoFetchCovers = hardcover.autoFetchCovers !== false;
      const shouldReplaceAuthor = shouldRecoverAuthor(item.author);
      const preferredProvider = Array.isArray(hardcover.providerPriority)
        ? hardcover.providerPriority
        : ["hardcover", "indexer"];
      const hardcoverPreferred = preferredProvider[0] === "hardcover";

      const nextCover = autoFetchCovers
        ? hardcoverPreferred
          ? pickFirstString(metadata.coverUrl, item.coverUrl)
          : pickFirstString(item.coverUrl, metadata.coverUrl)
        : item.coverUrl;

      const nextPublishDate =
        item.publishDate || (metadata.publishYear ? `${metadata.publishYear}-01-01` : null);

      return {
        ...item,
        author: shouldReplaceAuthor
          ? pickFirstString(metadata.author, item.author)
          : pickFirstString(item.author, metadata.author),
        coverUrl: nextCover || null,
        series: pickFirstString(item.series, metadata.series) || null,
        publishDate: nextPublishDate,
        language: pickFirstString(item.language, metadata.language) || null,
        publishYear: Number(metadata.publishYear || 0) || null,
        metadataSource: "hardcover",
      };
    } catch (error) {
      this.logger?.warn?.("Hardcover enrichment failed", {
        title: item.title,
        error: error.message,
      });
      return { ...item, metadataSource: "indexer" };
    }
  }

  async enrichList(items = []) {
    if (!Array.isArray(items) || !items.length) {
      return [];
    }

    const enriched = [];

    for (const item of items) {
      // Keep requests sequential to stay below Hardcover API rate limits.
      enriched.push(await this.enrichBook(item));
    }

    return enriched;
  }
}

module.exports = HardcoverService;