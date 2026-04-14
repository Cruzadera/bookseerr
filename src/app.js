const path = require("path");
const express = require("express");

const errorHandler = require("./middleware/error-handler");
const createApiRouter = require("./routes/api.routes");

function createApp(services) {
  const app = express();

  app.use(express.json());
  app.use((req, res, next) => {
    req.logger = services.logger;
    next();
  });

  app.get("/health", (req, res) => {
    res.json({
      ok: true,
      service: "bookseerr",
      time: new Date().toISOString(),
    });
  });

  app.get("/api/settings", (req, res) => {
    res.json({
      features: {
        destinationShelf: services.uiConfig.destinationShelves.enabled,
      },
      destinationShelves: services.uiConfig.destinationShelves.options.map(
        (item) => ({
          id: item.id,
          label: item.label,
        }),
      ),
    });
  });

  app.use("/", express.static(path.join(__dirname, "../web")));

  app.use(
    "/api",
    createApiRouter({
      prowlarrService: services.prowlarrService,
      qbittorrentService: services.qbittorrentService,
      jobService: services.jobService,
      destinationShelves: services.destinationShelves,
    }),
  );

  app.use(errorHandler);

  return app;
}

module.exports = createApp;
