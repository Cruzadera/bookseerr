const path = require("path");
const express = require("express");
const fs = require("fs");

const errorHandler = require("./middleware/error-handler");
const createApiRouter = require("./routes/api.routes");

async function buildSettingsPayload(services) {
  return {
    settings: services.settingsService?.getSettings?.() || {},
    features: {
      destinationShelf: services.uiConfig.destinationShelves.enabled,
    },
    destinationShelves: services.uiConfig.destinationShelves.options.map(
      (item) => ({
        id: item.id,
        label: item.label,
      }),
    ),
    availableIndexers: await services.prowlarrService?.listIndexers?.(),
  };
}

function createApp(services) {
  const app = express();
  const frontendDistPath = path.join(__dirname, "../frontend/dist");
  const legacyWebPath = path.join(__dirname, "../web");
  const frontendPath = fs.existsSync(frontendDistPath) ? frontendDistPath : legacyWebPath;

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

  app.get("/api/settings", async (req, res, next) => {
    try {
      res.json(await buildSettingsPayload(services));
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/settings", async (req, res, next) => {
    try {
      const settings = await services.settingsService.updateSettings(req.body || {});
      return res.json({
        ...(await buildSettingsPayload(services)),
        settings,
      });
    } catch (error) {
      return next(error);
    }
  });

  app.get("/locales/:lang/common.json", (req, res) => {
    const supportedLanguages = new Set(["en", "es-ES"]);
    const { lang } = req.params;

    if (!supportedLanguages.has(lang)) {
      return res.status(404).json({ error: "Language not supported" });
    }

    return res.sendFile(path.join(__dirname, "../locales", lang, "common.json"));
  });

  app.use("/locales", express.static(path.join(__dirname, "../locales")));
  app.use("/", express.static(frontendPath));
  app.use("/", express.static(legacyWebPath));

  app.use(
    "/api",
    createApiRouter({
      prowlarrService: services.prowlarrService,
      qbittorrentService: services.qbittorrentService,
      jobService: services.jobService,
      destinationShelves: services.destinationShelves,
      settingsService: services.settingsService,
    }),
  );

  app.use(errorHandler);

  return app;
}

module.exports = createApp;
