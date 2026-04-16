const fs = require("fs/promises");
const path = require("path");

const {
  buildFileFingerprint,
  ensureDir,
  isSupportedBookFile,
  sanitizeFilename,
} = require("../utils/files");

class ImportService {
  constructor({
    config,
    logger,
    stateRepository,
    jobService,
    calibreWebService,
  }) {
    this.config = config;
    this.logger = logger;
    this.stateRepository = stateRepository;
    this.jobService = jobService;
    this.calibreWebService = calibreWebService;
    this.processing = new Set();
  }

  resolveDestinationShelf(filePath) {
    if (!this.config.destinationShelves?.enabled) {
      return null;
    }

    return (
      this.config.destinationShelves.options.find((item) => {
        const candidatePaths = Array.isArray(item.watchPaths)
          ? item.watchPaths
          : [item.qbSavePath];

        return candidatePaths.some((candidatePath) => {
          const relativePath = path.relative(candidatePath, filePath);
          return (
            relativePath &&
            !relativePath.startsWith("..") &&
            !path.isAbsolute(relativePath)
          );
        });
      }) || null
    );
  }

  async importFile(filePath) {
    if (filePath.includes(".imported")) {
      return { skipped: true, reason: "already-imported-folder" };
    }

    if (!isSupportedBookFile(filePath, this.config.watcher.extensions)) {
      return { skipped: true, reason: "unsupported-extension" };
    }

    if (this.processing.has(filePath)) {
      return { skipped: true, reason: "already-processing" };
    }

    this.processing.add(filePath);
    let job;

    try {
      if (!(await this.waitForFileStable(filePath))) {
        return { skipped: true, reason: "file-not-stable" };
      }

      const stats = await fs.stat(filePath);
      const fingerprint = buildFileFingerprint(filePath, stats);

      if (this.stateRepository.isProcessed(fingerprint)) {
        return { skipped: true, reason: "already-processed" };
      }

      const destinationShelf = this.resolveDestinationShelf(filePath);

      this.logger.info("Resolving destination shelf", {
        filePath,
        destinationId: destinationShelf?.id || null,
        watchPaths: destinationShelf?.watchPaths || [],
      });

      job = await this.jobService.createImportJob({
        filePath,
        fileName: path.basename(filePath),
        destinationId: destinationShelf?.id || null,
        destinationLabel: destinationShelf?.label || null,
        calibreShelf: destinationShelf?.calibreShelf || null,
        calibreShelfId: destinationShelf?.calibreShelfId || null,
      });

      await this.jobService.updateJob(job.id, { state: "downloading" });

      await this.calibreWebService.uploadBook(filePath, {
        destinationId: destinationShelf?.id || null,
        destinationLabel: destinationShelf?.label || null,
        shelfName: destinationShelf?.calibreShelf || null,
        shelfId: destinationShelf?.calibreShelfId || null,
      });
      await this.cleanupFile(filePath);
      await this.jobService.updateJob(job.id, {
        state: "imported",
        filePath,
        destinationId: destinationShelf?.id || null,
        destinationLabel: destinationShelf?.label || null,
        calibreShelf: destinationShelf?.calibreShelf || null,
        calibreShelfId: destinationShelf?.calibreShelfId || null,
      });
      await this.stateRepository.markProcessed(fingerprint, {
        filePath,
        jobId: job.id,
      });

      return { imported: true, jobId: job.id };
    } catch (error) {
      if (job) {
        await this.jobService.updateJob(job.id, {
          state: "error",
          error: error.message,
        });
      }
      throw error;
    } finally {
      this.processing.delete(filePath);
    }
  }

  async waitForFileStable(filePath, delay = 2000) {
    const stat1 = await fs.stat(filePath);
    await new Promise((resolve) => setTimeout(resolve, delay));
    const stat2 = await fs.stat(filePath);

    return stat1.size === stat2.size;
  }

  async cleanupFile(filePath) {
    const action = this.config.postImportAction;

    if (action === "none") {
      return;
    }

    if (action === "delete") {
      await fs.unlink(filePath);
      return;
    }

    await ensureDir(this.config.paths.processedDir);

    const targetPath = path.join(
      this.config.paths.processedDir,
      sanitizeFilename(path.basename(filePath)),
    );

    await fs.rename(filePath, targetPath);
  }
}

module.exports = ImportService;
