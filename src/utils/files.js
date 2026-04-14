const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const DEFAULT_SUPPORTED_EXTENSIONS = [".epub", ".mobi", ".azw3"];

function normalizeExtension(filePath) {
  return path.extname(filePath).toLowerCase();
}

function isSupportedBookFile(
  filePath,
  supportedExtensions = DEFAULT_SUPPORTED_EXTENSIONS,
) {
  return new Set(supportedExtensions.map((item) => item.toLowerCase())).has(
    normalizeExtension(filePath),
  );
}

function buildFileFingerprint(filePath, stats) {
  return crypto
    .createHash("sha1")
    .update(`${filePath}:${stats.size}:${stats.mtimeMs}`)
    .digest("hex");
}

async function ensureDir(targetPath) {
  await fs.mkdir(targetPath, { recursive: true });
}

function sanitizeFilename(filename) {
  return filename.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").trim();
}

module.exports = {
  buildFileFingerprint,
  DEFAULT_SUPPORTED_EXTENSIONS,
  ensureDir,
  isSupportedBookFile,
  normalizeExtension,
  sanitizeFilename,
};
