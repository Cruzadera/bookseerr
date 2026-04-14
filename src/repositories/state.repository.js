const fs = require("fs/promises");
const path = require("path");

const DEFAULT_STATE = {
  jobs: [],
  processedFiles: {},
};

class StateRepository {
  constructor({ stateFile, logger }) {
    this.stateFile = stateFile;
    this.logger = logger;
    this.state = structuredClone(DEFAULT_STATE);
  }

  async init() {
    await fs.mkdir(path.dirname(this.stateFile), { recursive: true });

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
}

module.exports = StateRepository;
