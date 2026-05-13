const fs = require("fs/promises");
const path = require("path");

const DEFAULT_STATE = {
  jobs: [],
  processedFiles: {},
  favorites: [],
  hardcoverCache: {},
};

class StateRepository {
  constructor({ stateFile, logger }) {
    this.stateFile = stateFile;
    this.logger = logger;
    this.state = structuredClone(DEFAULT_STATE);
  }

  async ensureStoragePath() {
    try {
      await fs.mkdir(path.dirname(this.stateFile), { recursive: true });
    } catch (error) {
      if (error.code !== "EACCES" && error.code !== "EPERM") {
        throw error;
      }

      const fallbackDir = path.join(process.cwd(), "data");
      this.stateFile = path.join(fallbackDir, path.basename(this.stateFile));
      await fs.mkdir(path.dirname(this.stateFile), { recursive: true });
      this.logger?.warn?.("state file path is not writable, using local fallback", {
        stateFile: this.stateFile,
      });
    }
  }

  async init() {
    await this.ensureStoragePath();

    try {
      const raw = await fs.readFile(this.stateFile, "utf8");
      this.state = {
        ...structuredClone(DEFAULT_STATE),
        ...JSON.parse(raw),
      };
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }

      await this.persist();
    }
  }

  async persist() {
    await fs.writeFile(this.stateFile, JSON.stringify(this.state, null, 2));
  }

  listJobs() {
    return [...this.state.jobs].sort((a, b) => {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }

  getJob(id) {
    return this.state.jobs.find((job) => job.id === id) || null;
  }

  async upsertJob(job) {
    const index = this.state.jobs.findIndex((entry) => entry.id === job.id);

    if (index >= 0) {
      this.state.jobs[index] = job;
    } else {
      this.state.jobs.push(job);
    }

    await this.persist();
    return job;
  }

  async markProcessed(fileFingerprint, payload) {
    this.state.processedFiles[fileFingerprint] = {
      ...payload,
      at: new Date().toISOString(),
    };
    await this.persist();
  }

  isProcessed(fileFingerprint) {
    return Boolean(this.state.processedFiles[fileFingerprint]);
  }

  listFavorites() {
    return [...this.state.favorites].sort((a, b) => {
      return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    });
  }

  getFavoriteById(id) {
    return this.state.favorites.find((item) => item.id === id) || null;
  }

  getFavoriteByDownloadUrl(downloadUrl) {
    return (
      this.state.favorites.find((item) => item.downloadUrl === downloadUrl) || null
    );
  }

  async upsertFavorite(favorite) {
    const index = this.state.favorites.findIndex((item) => item.id === favorite.id);

    if (index >= 0) {
      this.state.favorites[index] = favorite;
    } else {
      this.state.favorites.push(favorite);
    }

    await this.persist();
    return favorite;
  }

  async removeFavorite(id) {
    const previousLength = this.state.favorites.length;
    this.state.favorites = this.state.favorites.filter((item) => item.id !== id);

    if (this.state.favorites.length !== previousLength) {
      await this.persist();
      return true;
    }

    return false;
  }

  getHardcoverCacheEntry(key) {
    return this.state.hardcoverCache?.[key] || null;
  }

  async setHardcoverCacheEntry(key, payload) {
    this.state.hardcoverCache = this.state.hardcoverCache || {};
    this.state.hardcoverCache[key] = payload;
    await this.persist();
    return payload;
  }
}

module.exports = StateRepository;
