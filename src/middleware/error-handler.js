function errorHandler(error, req, res, next) {
  req.logger.error("Request failed", {
    path: req.path,
    method: req.method,
    error: error.message,
  });

  res.status(error.statusCode || 500).json({
    error: error.message || "Unexpected error",
  });
}

module.exports = errorHandler;
