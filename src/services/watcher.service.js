const chokidar = require("chokidar");

const { isSupportedBookFile } = require("../utils/files");

class WatcherService {
  constructor({ config, logger, queueService, importService }) {
    this.config = config;
    this.logger = logger;
    this.queueService = queueService;
    this.importService = importService;
    this.scheduled = new Map();
    this.watcher = null;
  }

  start() {
    if (!this.config.watcher.enabled) {
      this.logger.info("Watcher disabled by configuration");
      return;
    }

    this.watcher = chokidar.watch(this.config.paths.downloadsDir, {
      ignoreInitial: false,
      persistent: true,
      depth: 10,
      awaitWriteFinish: {
        stabilityThreshold: this.config.watcher.debounceMs,
        pollInterval: 1000,
      },
    });

    this.watcher.on("add", (filePath) => this.schedule(filePath));
    this.watcher.on("change", (filePath) => this.schedule(filePath));
    this.watcher.on("error", (error) => {
      this.logger.error("Error in watcher", { error: error.message });
    });

    this.logger.info("Watcher started", {
      directory: this.config.paths.downloadsDir,
      extensions: this.config.watcher.extensions,
    });
  }

  schedule(filePath) {
    if (!isSupportedBookFile(filePath, this.config.watcher.extensions)) {
      return;
    }

    clearTimeout(this.scheduled.get(filePath));

    const timeout = setTimeout(() => {
      this.scheduled.delete(filePath);
      this.queueService.enqueue(async () => {
        this.logger.info("Processing detected book", { filePath });
        try {
          await this.importService.importFile(filePath);
        } catch (error) {
          this.logger.error("Error importing book", {
            filePath,
            error: error.message,
          });
        }
      });
    }, this.config.watcher.debounceMs);

    this.scheduled.set(filePath, timeout);
  }
}

module.exports = WatcherService;
