const axios = require("axios");

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

  guessFormat(title = "") {
    const normalized = title.toLowerCase();

    if (normalized.includes("epub")) return "epub";
    if (normalized.includes("azw3")) return "azw3";
    if (normalized.includes("mobi")) return "mobi";
    if (normalized.includes("pdf")) return "pdf";
    return "unknown";
  }

  scoreResult(item) {
    const format = this.guessFormat(item.title);
    let score = 0;

    if (format === "epub") score += 100;
    if (format === "azw3") score += 40;
    if (format === "mobi") score += 20;
    if (format === "pdf") score -= 50;

    score += (item.seeders || 0);

    return score;
  }

  async search(query) {
    const response = await this.client.get("/api/v1/search", {
      params: { query, type: "search" },
    });

    const mapped = (response.data || []).map((item) => ({
      title: item.title,
      size: item.size,
      indexer: item.indexer,
      protocol: item.protocol || "torrent",
      downloadUrl: item.downloadUrl || item.guid || item.magnetUrl,
      format: this.guessFormat(item.title),
      seeders: item.seeders,
      publishDate: item.publishDate,
      raw: item,
      score: this.scoreResult(item),
    }));

    const filtered = mapped.filter((item) => {
      const isEpublibre =
        item.indexer && item.indexer.toLowerCase().includes("epublibre");

      const isEpub = item.format === "epub";

      return isEpublibre && isEpub && item.downloadUrl;
    });

    const finalResults =
      filtered.length > 0
        ? filtered
        : mapped.filter(
            (item) =>
              item.format === "epub" &&
              item.downloadUrl
          );

    this.logger.info(
      `Resultados: ${mapped.length} | EPUBLIBRE: ${filtered.length} | Final: ${finalResults.length}`
    );

    return finalResults
      .sort(
        (a, b) =>
          b.score - a.score || (b.seeders || 0) - (a.seeders || 0)
      )
      .map(({ raw, score, ...item }) => item);
  }
}

module.exports = ProwlarrService;