const express = require("express");

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function createApiRouter({
  prowlarrService,
  qbittorrentService,
  jobService,
  destinationShelves,
}) {
  const router = express.Router();

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
  }) {
    const destinationShelf = validateDestinationShelf(destinationId);

    const job = await jobService.createDownloadJob({
      title,
      downloadUrl,
      protocol,
      destinationId: destinationShelf?.id || null,
      destinationLabel: destinationShelf?.label || null,
      calibreShelf: destinationShelf?.calibreShelf || null,
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
        destinationId: destinationShelf?.id || null,
        destinationLabel: destinationShelf?.label || null,
        calibreShelf: destinationShelf?.calibreShelf || null,
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

      const results = await prowlarrService.search(query);
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

      const results = await prowlarrService.search(normalizedQuery);

      if (!results.length) {
        return res.status(404).json({ error: "No results found" });
      }

      const best = results[0];
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

  return router;
}

module.exports = createApiRouter;
