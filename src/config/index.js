const path = require("path");

require("dotenv").config();

function parseJson(value, fallback) {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`JSON de configuracion invalido: ${error.message}`);
  }
}

const splitExtensions = (value) =>
  value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

function normalizeDestinationShelf(item, index, downloadsDir) {
  const id = `${item?.id || ""}`.trim();

  if (!id) {
    throw new Error(
      `DESTINATION_SHELVES[${index}] debe incluir un id no vacio`,
    );
  }

  const label = `${item.label || id}`.trim();
  const calibreShelf = `${item.calibreShelf || label}`.trim();
  const qbCategory = `${item.qbCategory || id}`.trim();
  const qbSavePath = `${item.qbSavePath || path.join(downloadsDir, id)}`.trim();

  return {
    id,
    label,
    calibreShelf,
    qbCategory,
    qbSavePath,
  };
}

const downloadsDir = process.env.DOWNLOADS_DIR || "/mnt/unionlib/Descargas";
const destinationShelfItems = parseJson(process.env.DESTINATION_SHELVES, []);
const destinationShelves = Array.isArray(destinationShelfItems)
  ? destinationShelfItems.map((item, index) =>
      normalizeDestinationShelf(item, index, downloadsDir),
    )
  : [];
const destinationShelvesEnabled =
  `${process.env.FEATURE_DESTINATION_SHELF || ""}` === "true" ||
  destinationShelves.length > 0;

module.exports = {
  app: {
    port: Number(process.env.PORT || 3000),
    logLevel: process.env.LOG_LEVEL || "info",
    requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS || 30000),
  },
  paths: {
    downloadsDir,
    libraryDir: process.env.LIBRARY_DIR || "/mnt/unionlib/LIBROS/biblioteca",
    processedDir:
      process.env.PROCESSED_DIR || "/mnt/unionlib/Descargas/.imported",
    stateFile: process.env.STATE_FILE || path.join("/data", "state.json"),
  },
  watcher: {
    enabled: `${process.env.WATCHER_ENABLED || "true"}` === "true",
    debounceMs: Number(process.env.WATCH_DEBOUNCE_MS || 8000),
    extensions: splitExtensions(
      process.env.WATCH_EXTENSIONS || ".epub,.mobi,.azw3",
    ),
  },
  postImportAction: process.env.POST_IMPORT_ACTION || "move",
  prowlarr: {
    baseUrl: process.env.PROWLARR_BASE_URL,
    apiKey: process.env.PROWLARR_API_KEY,
  },
  qbittorrent: {
    baseUrl: process.env.QBITTORRENT_BASE_URL,
    username: process.env.QBITTORRENT_USERNAME,
    password: process.env.QBITTORRENT_PASSWORD,
    category: process.env.QBITTORRENT_CATEGORY || "books",
    savePath: process.env.QBITTORRENT_SAVE_PATH || "",
  },
  calibreWeb: {
    baseUrl: process.env.CALIBRE_WEB_BASE_URL,
    username: process.env.CALIBRE_WEB_USERNAME,
    password: process.env.CALIBRE_WEB_PASSWORD,
    loginPath: process.env.CALIBRE_WEB_LOGIN_PATH || "/login",
    uploadPage: process.env.CALIBRE_WEB_UPLOAD_PAGE || "/",
  },
  destinationShelves: {
    enabled: destinationShelvesEnabled,
    options: destinationShelves,
  },
};
