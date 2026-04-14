const express = require("express");

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function createApiRouter({ prowlarrService, qbittorrentService, jobService }) {
  const router = express.Router();

  async function startDownload({ title, downloadUrl, protocol, category, savePath }) {
    const job = await jobService.createDownloadJob({
      title,
      downloadUrl,
      protocol,
    });

    await jobService.updateJob(job.id, { state: "downloading" });

    try {
      const result = await qbittorrentService.addDownload({
        downloadUrl,
        category,
        savePath,
      });

      const updated = await jobService.updateJob(job.id, {
        state: "downloading",
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
        return res.status(400).json({ error: "query es obligatorio" });
      }

      const results = await prowlarrService.search(query);
      return res.json({ query, count: results.length, results });
    }),
  );

  router.post(
    "/download",
    asyncHandler(async (req, res) => {
      const { title, downloadUrl, protocol = "torrent", category, savePath } =
        req.body || {};

      if (!title || !downloadUrl) {
        return res
          .status(400)
          .json({ error: "title y downloadUrl son obligatorios" });
      }

      const started = await startDownload({
        title,
        downloadUrl,
        protocol,
        category,
        savePath,
      });

      return res.status(202).json({
        message: "Descarga enviada a qBittorrent",
        job: started.job,
        qbittorrent: started.qbittorrent,
      });
    }),
  );

  router.post(
    "/request",
    asyncHandler(async (req, res) => {
      const { query, user, category, savePath } = req.body || {};
      const normalizedQuery = `${query || ""}`.trim();

      if (!normalizedQuery) {
        return res.status(400).json({ error: "query es obligatorio" });
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
