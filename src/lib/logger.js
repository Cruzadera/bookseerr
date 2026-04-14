const LEVELS = ["error", "warn", "info", "debug"];

class Logger {
  constructor(level = "info") {
    this.level = LEVELS.includes(level) ? level : "info";
  }

  shouldLog(level) {
    return LEVELS.indexOf(level) <= LEVELS.indexOf(this.level);
  }

  format(level, message, meta) {
    return JSON.stringify({
      ts: new Date().toISOString(),
      level,
      message,
      ...meta,
    });
  }

  log(level, message, meta = {}) {
    if (!this.shouldLog(level)) {
      return;
    }

    const line = this.format(level, message, meta);

    if (level === "error") {
      console.error(line);
      return;
    }

    console.log(line);
  }

  error(message, meta) {
    this.log("error", message, meta);
  }

  warn(message, meta) {
    this.log("warn", message, meta);
  }

  info(message, meta) {
    this.log("info", message, meta);
  }

  debug(message, meta) {
    this.log("debug", message, meta);
  }
}

module.exports = Logger;
