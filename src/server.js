const createApp = require("./app");
const config = require("./config");
const Logger = require("./lib/logger");
const StateRepository = require("./repositories/state.repository");
const CalibreWebService = require("./services/calibre-web.service");
const DownloadQueueService = require("./services/download-queue.service");
const ImportService = require("./services/import.service");
const JobService = require("./services/job.service");
const ProwlarrService = require("./services/prowlarr.service");
const QBittorrentService = require("./services/qbittorrent.service");
const WatcherService = require("./services/watcher.service");

async function bootstrap() {
  const logger = new Logger(config.app.logLevel);

  const stateRepository = new StateRepository({
    stateFile: config.paths.stateFile,
    logger,
  });
  await stateRepository.init();

  const jobService = new JobService({ stateRepository });
  const prowlarrService = new ProwlarrService({
    config: {
      ...config.prowlarr,
      requestTimeoutMs: config.app.requestTimeoutMs,
    },
    logger,
  });
  const qbittorrentService = new QBittorrentService({
    config: {
      ...config.qbittorrent,
      requestTimeoutMs: config.app.requestTimeoutMs,
    },
    logger,
  });
  const calibreWebService = new CalibreWebService({
    config: {
      ...config.calibreWeb,
      requestTimeoutMs: config.app.requestTimeoutMs,
    },
    logger,
  });
  const queueService = new DownloadQueueService({ logger });
  const importService = new ImportService({
    config,
    logger,
    stateRepository,
    jobService,
    calibreWebService,
  });
  const watcherService = new WatcherService({
    config,
    logger,
    queueService,
    importService,
  });

  const app = createApp({
    logger,
    prowlarrService,
    qbittorrentService,
    jobService,
    destinationShelves: config.destinationShelves,
    uiConfig: {
      destinationShelves: config.destinationShelves,
    },
  });

  app.listen(config.app.port, () => {
    logger.info("bookseerr iniciado", {
      port: config.app.port,
      downloadsDir: config.paths.downloadsDir,
      stateFile: config.paths.stateFile,
    });
  });

  watcherService.start();
}

bootstrap().catch((error) => {
  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "error",
      message: "Fallo al iniciar la aplicacion",
      error: error.message,
    }),
  );
  process.exit(1);
});
