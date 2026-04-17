const express = require("express");

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createApiRouter({
  prowlarrService,
  qbittorrentService,
  jobService,
  destinationShelves,
  settingsService,
}) {
  const router = express.Router();

  function getCurrentSettings() {
    return (
      settingsService?.getSettings?.() || {
        filters: {},
        download: {},
        calibre: {},
      }
    );
  }

  function applySearchOverrides(settings, query = {}) {
    const next = clone(settings || {});
    next.filters = next.filters || {};

    if (`${query.onlyEpub || ""}` === "true") {
      next.filters.preferredFormat = "epub";
    }

    if (`${query.spanishOnly || ""}` === "true") {
      next.filters.language = "es";
    }

    const maxSizeMB = Number(query.maxSizeMB || 0);

    if (Number.isFinite(maxSizeMB) && maxSizeMB > 0) {
      const currentMax = Number(next.filters.maxSizeMB || 0);
      next.filters.maxSizeMB =
        Number.isFinite(currentMax) && currentMax > 0
          ? Math.min(currentMax, maxSizeMB)
          : maxSizeMB;
    }

    return next;
  }

  function resolveDestinationShelf(destinationId) {
    if (!destinationId) {
      return null;
    }

    return (
      destinationShelves.options.find((item) => item.id === destinationId) ||
      null
    );
  }

  function validateDestinationShelf(destinationId) {
    if (!destinationId) {
      return null;
    }

    const destinationShelf = resolveDestinationShelf(destinationId);

    if (!destinationShelf) {
      const error = new Error("The selected destination shelf does not exist");
      error.statusCode = 400;
      throw error;
    }

    return destinationShelf;
  }

  async function startDownload({
    title,
    downloadUrl,
    protocol,
    category,
    savePath,
    destinationId,
    retryOf,
  }) {
    const destinationShelf = validateDestinationShelf(destinationId);

    const job = await jobService.createDownloadJob({
      title,
      downloadUrl,
      protocol,
      category,
      savePath,
      destinationId: destinationShelf?.id || null,
      destinationLabel: destinationShelf?.label || null,
      calibreShelf: destinationShelf?.calibreShelf || null,
      calibreShelfId: destinationShelf?.calibreShelfId || null,
      retryOf: retryOf || null,
    });

    await jobService.updateJob(job.id, { state: "downloading" });

    try {
      const result = await qbittorrentService.addDownload({
        downloadUrl,
        category,
        savePath: destinationShelf?.qbSavePath || savePath,
        destinationId: destinationShelf?.id || null,
        destinationLabel: destinationShelf?.label || null,
      });

      const updated = await jobService.updateJob(job.id, {
        state: "downloading",
        category: category || null,
        savePath: destinationShelf?.qbSavePath || savePath || null,
        destinationId: destinationShelf?.id || null,
        destinationLabel: destinationShelf?.label || null,
        calibreShelf: destinationShelf?.calibreShelf || null,
        calibreShelfId: destinationShelf?.calibreShelfId || null,
      });

      return {
        job: updated,
        qbittorrent: result,
      };
    } catch (error) {
      await jobService.updateJob(job.id, {
        state: "error",
        error: error.message,
      });
      throw error;
    }
  }

  router.get(
    "/search",
    asyncHandler(async (req, res) => {
      const query = `${req.query.query || ""}`.trim();

      if (!query) {
        return res.status(400).json({ error: "Query is required" });
      }

      const activeSettings = applySearchOverrides(getCurrentSettings(), req.query || {});
      const results = await prowlarrService.search(query, activeSettings.filters);
      return res.json({ query, count: results.length, results });
    }),
  );

  router.post(
    "/download",
    asyncHandler(async (req, res) => {
      const {
        title,
        downloadUrl,
        protocol = "torrent",
        category,
        savePath,
        destinationId,
      } = req.body || {};

      if (!title || !downloadUrl) {
        return res
          .status(400)
          .json({ error: "Title and download URL are required" });
      }

      const started = await startDownload({
        title,
        downloadUrl,
        protocol,
        category,
        savePath,
        destinationId,
      });

      return res.status(202).json({
        message: "Download sent to qBittorrent",
        job: started.job,
        qbittorrent: started.qbittorrent,
      });
    }),
  );

  router.post(
    "/request",
    asyncHandler(async (req, res) => {
      const { query, user, category, savePath, destinationId } = req.body || {};
      const normalizedQuery = `${query || ""}`.trim();

      if (!normalizedQuery) {
        return res.status(400).json({ error: "Query is required" });
      }

      const settings = getCurrentSettings();
      const results = await prowlarrService.search(normalizedQuery, settings.filters);

      if (!results.length) {
        return res.status(404).json({ error: "No results found" });
      }

      const best = results[0];
      const preferredFormat = `${settings.filters?.preferredFormat || "any"}`.toLowerCase();
      const mustMatchPreferred =
        Boolean(settings.download?.onlyIfPreferredFormat) &&
        preferredFormat !== "any";

      if (mustMatchPreferred && best.format !== preferredFormat) {
        return res.status(409).json({
          error: `Best result does not match preferred format: ${preferredFormat}`,
        });
      }

      const started = await startDownload({
        title: best.title,
        downloadUrl: best.downloadUrl,
        protocol: best.protocol || "torrent",
        category,
        savePath,
        destinationId,
      });

      return res.status(202).json({
        message: "Download started",
        query: normalizedQuery,
        requestedBy: user || null,
        selected: best.title,
        result: started.qbittorrent,
        job: started.job,
      });
    }),
  );

  router.get("/jobs", (req, res) => {
    res.json({ jobs: jobService.listJobs() });
  });

  router.post(
    "/jobs/:jobId/retry",
    asyncHandler(async (req, res) => {
      const sourceJob = jobService.getJob(req.params.jobId);

      if (!sourceJob) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (!sourceJob.downloadUrl) {
        return res.status(409).json({
          error: "This job cannot be restarted because it has no stored download data",
        });
      }

      if (!["error", "imported"].includes(sourceJob.state)) {
        return res.status(409).json({
          error: "Only failed or completed jobs can be restarted",
        });
      }

      const started = await startDownload({
        title: sourceJob.title,
        downloadUrl: sourceJob.downloadUrl,
        protocol: sourceJob.protocol || "torrent",
        category: sourceJob.category || undefined,
        savePath: sourceJob.savePath || undefined,
        destinationId: sourceJob.destinationId || undefined,
        retryOf: sourceJob.id,
      });

      return res.status(202).json({
        message:
          sourceJob.state === "error"
            ? "Download retried"
            : "Download started again",
        sourceJob,
        job: started.job,
        qbittorrent: started.qbittorrent,
      });
    }),
  );

  return router;
}

module.exports = createApiRouter;
