const crypto = require("crypto");

class FavoriteService {
  constructor({ stateRepository }) {
    this.stateRepository = stateRepository;
  }

  listFavorites() {
    return this.stateRepository.listFavorites();
  }

  getFavoriteByDownloadUrl(downloadUrl) {
    return this.stateRepository.getFavoriteByDownloadUrl(downloadUrl);
  }

  async addFavorite(payload) {
    const existing = this.getFavoriteByDownloadUrl(payload.downloadUrl);

    if (existing) {
      return { favorite: existing, created: false };
    }

    const now = new Date().toISOString();
    const favorite = {
      id: crypto.randomUUID(),
      title: `${payload.title || ""}`.trim() || "Untitled",
      author: `${payload.author || ""}`.trim() || null,
      series: `${payload.series || ""}`.trim() || null,
      publishYear: Number(payload.publishYear || 0) || null,
      downloadUrl: payload.downloadUrl,
      protocol: payload.protocol || "torrent",
      format: payload.format || null,
      sizeMB: Number(payload.sizeMB || 0) || null,
      seeders: Number(payload.seeders || 0) || 0,
      publishDate: payload.publishDate || null,
      indexer: payload.indexer || null,
      language: payload.language || null,
      coverUrl: payload.coverUrl || null,
      addedAt: now,
      updatedAt: now,
    };

    await this.stateRepository.upsertFavorite(favorite);
    return { favorite, created: true };
  }

  async removeFavoriteById(id) {
    const removed = await this.stateRepository.removeFavorite(id);
    return removed;
  }
}

module.exports = FavoriteService;
