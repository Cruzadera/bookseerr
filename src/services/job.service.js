const crypto = require("crypto");

class JobService {
  constructor({ stateRepository }) {
    this.stateRepository = stateRepository;
  }

  async createDownloadJob(payload) {
    const now = new Date().toISOString();
    const job = {
      id: crypto.randomUUID(),
      title: payload.title,
      downloadUrl: payload.downloadUrl,
      protocol: payload.protocol,
      destinationId: payload.destinationId || null,
      destinationLabel: payload.destinationLabel || null,
      calibreShelf: payload.calibreShelf || null,
      calibreShelfId: payload.calibreShelfId || null,
      state: "pending",
      source: "api",
      filePath: null,
      torrentHash: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    };

    await this.stateRepository.upsertJob(job);
    return job;
  }

  async createImportJob(payload) {
    const now = new Date().toISOString();
    const job = {
      id: crypto.randomUUID(),
      title: payload.title || payload.fileName,
      downloadUrl: null,
      protocol: "local-file",
      destinationId: payload.destinationId || null,
      destinationLabel: payload.destinationLabel || null,
      calibreShelf: payload.calibreShelf || null,
      calibreShelfId: payload.calibreShelfId || null,
      state: "pending",
      source: "watcher",
      filePath: payload.filePath,
      torrentHash: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    };

    await this.stateRepository.upsertJob(job);
    return job;
  }

  async updateJob(jobId, patch) {
    const current = this.stateRepository.getJob(jobId);

    if (!current) {
      return null;
    }

    const next = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    await this.stateRepository.upsertJob(next);
    return next;
  }

  listJobs() {
    return this.stateRepository.listJobs();
  }
}

module.exports = JobService;
