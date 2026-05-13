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

  getFavoriteById(id) {
    return this.stateRepository.getFavoriteById(id);
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
      hardcoverId: Number(payload.hardcoverId || 0) || null,
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
      coverRemoteUrl: payload.coverRemoteUrl || null,
      coverLocalPath: payload.coverLocalPath || null,
      metadataUpdatedAt: payload.metadataUpdatedAt || null,
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

  async updateFavoriteMetadata(id, payload = {}) {
    const current = this.getFavoriteById(id);

    if (!current) {
      return null;
    }

    const updated = {
      ...current,
      title: `${payload.title || current.title || "Untitled"}`.trim() || "Untitled",
      author: `${payload.author || current.author || ""}`.trim() || null,
      hardcoverId: Number(payload.hardcoverId || current.hardcoverId || 0) || null,
      series: `${payload.series || current.series || ""}`.trim() || null,
      publishYear: Number(payload.publishYear || current.publishYear || 0) || null,
      language: payload.language || current.language || null,
      coverUrl: payload.coverUrl || current.coverUrl || null,
      coverRemoteUrl: payload.coverRemoteUrl || current.coverRemoteUrl || null,
      coverLocalPath: payload.coverLocalPath || current.coverLocalPath || null,
      metadataUpdatedAt: payload.metadataUpdatedAt || current.metadataUpdatedAt || null,
      updatedAt: new Date().toISOString(),
    };

    await this.stateRepository.upsertFavorite(updated);
    return updated;
  }
}

module.exports = FavoriteService;
