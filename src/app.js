const path = require("path");
const express = require("express");
const fs = require("fs");

const errorHandler = require("./middleware/error-handler");
const createApiRouter = require("./routes/api.routes");

async function buildSettingsPayload(services) {
  const rawSettings = services.settingsService?.getSettings?.() || {};
  const safeSettings = {
    ...rawSettings,
    hardcover: {
      ...(rawSettings.hardcover || {}),
      token: "",
      hasToken: Boolean(rawSettings.hardcover?.token),
    },
  };

  return {
    settings: safeSettings,
    features: {
      destinationShelf: services.uiConfig.destinationShelves.enabled,
    },
    hardcover: {
      status: services.hardcoverService?.getPublicStatus?.() || {
        code: "disabled",
        message: "Hardcover integration is disabled",
      },
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

function mergeSensitiveSettings(currentSettings = {}, incoming = {}) {
  const next = { ...incoming };
  const currentHardcover = currentSettings.hardcover || {};
  const incomingHardcover = next.hardcover;

  if (!incomingHardcover) {
    return next;
  }

  const hasExistingToken = Boolean(`${currentHardcover.token || ""}`.trim());
  const providedToken = `${incomingHardcover.token || ""}`.trim();
  const shouldClearToken = incomingHardcover.clearToken === true;

  next.hardcover = {
    ...incomingHardcover,
  };

  if (shouldClearToken) {
    next.hardcover.token = null;
    return next;
  }

  if (!providedToken && hasExistingToken) {
    next.hardcover.token = currentHardcover.token;
  }

  return next;
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
      const currentSettings = services.settingsService.getSettings();
      const requestPayload = mergeSensitiveSettings(currentSettings, req.body || {});
      await services.settingsService.updateSettings(requestPayload);
      return res.json(await buildSettingsPayload(services));
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
      hardcoverService: services.hardcoverService,
      jobService: services.jobService,
      favoriteService: services.favoriteService,
      destinationShelves: services.destinationShelves,
      settingsService: services.settingsService,
    }),
  );

  app.use(errorHandler);

  return app;
}

module.exports = createApp;
