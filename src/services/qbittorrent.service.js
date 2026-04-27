const axios = require("axios");
const { wrapper } = require("axios-cookiejar-support");
const { CookieJar } = require("tough-cookie");
const FormData = require("form-data");

class QBittorrentService {
  constructor({ config, logger }) {
    this.logger = logger;
    this.username = config.username;
    this.password = config.password;
    this.defaultCategory = config.category;
    this.defaultSavePath = config.savePath;
    this.jar = new CookieJar();
    this.client = wrapper(
      axios.create({
        baseURL: config.baseUrl,
        timeout: config.requestTimeoutMs,
        jar: this.jar,
        withCredentials: true,
      }),
    );
    this.loggedIn = false;
  }

  async delay(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  buildTargetContext({ category, savePath, destinationId, destinationLabel }) {
    return {
      category: category || this.defaultCategory,
      savePath: savePath || this.defaultSavePath || null,
      destinationId: destinationId || null,
      destinationLabel: destinationLabel || null,
    };
  }

  async submitAddTorrent({ finalUrl, category, savePath }) {
    const params = new URLSearchParams({
      urls: finalUrl,
      category,
    });

    if (savePath) {
      params.set("savepath", savePath);
    }

    await this.client.post("/api/v2/torrents/add", params.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: this.client.defaults.baseURL,
        Origin: this.client.defaults.baseURL,
      },
    });
  }

  async submitAddTorrentFile({ fileBuffer, filename, category, savePath }) {
    const form = new FormData();

    form.append("torrents", fileBuffer, {
      filename: filename || "file.torrent",
      contentType: "application/x-bittorrent",
    });

    if (category) {
      form.append("category", category);
    }

    if (savePath) {
      form.append("savepath", savePath);
    }

    const headers = {
      ...form.getHeaders(),
      Referer: this.client.defaults.baseURL,
      Origin: this.client.defaults.baseURL,
    };

    await this.client.post("/api/v2/torrents/add", form, { headers });
  }

  async login() {
    if (this.loggedIn) {
      return;
    }

    await this.client.post(
      "/api/v2/auth/login",
      new URLSearchParams({
        username: this.username,
        password: this.password,
      }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Referer": this.client.defaults.baseURL,
          "Origin": this.client.defaults.baseURL,
        },
      },
    );

    this.loggedIn = true;
    this.logger.info("Session started on qBittorrent");
  }

  async addDownload({
    downloadUrl,
    category,
    savePath,
    destinationId,
    destinationLabel,
  }) {
    await this.login();

    try {
      const target = this.buildTargetContext({
        category,
        savePath,
        destinationId,
        destinationLabel,
      });
      let finalUrl = downloadUrl;

      if (!downloadUrl.startsWith("magnet:")) {
        try {
          const res = await axios.get(downloadUrl, {
            maxRedirects: 0,
            validateStatus: (status) => status >= 200 && status < 400,
          });

          const redirectUrl = res.headers?.location;

          if (redirectUrl && redirectUrl.startsWith("magnet:")) {
            finalUrl = redirectUrl;
          }
        } catch (err) {
          const redirectUrl = err.response?.headers?.location;

          if (redirectUrl && redirectUrl.startsWith("magnet:")) {
            finalUrl = redirectUrl;
          }
        }
      }

      // If we have a magnet link, use the magnet flow
      if (finalUrl.startsWith("magnet:")) {
        this.logger.info("Sending magnet to qBittorrent", {
          destinationId: target.destinationId,
          destinationLabel: target.destinationLabel,
          category: target.category,
          savePath: target.savePath,
        });

        try {
          await this.submitAddTorrent({
            finalUrl,
            category: target.category,
            savePath: target.savePath,
          });
        } catch (error) {
          if (error.response?.status === 403 && target.savePath) {
            this.logger.warn("qBittorrent rejected the path, retrying once", {
              destinationId: target.destinationId,
              destinationLabel: target.destinationLabel,
              category: target.category,
              savePath: target.savePath,
              status: error.response.status,
            });

            await this.delay(1200);
            await this.login();
            await this.submitAddTorrent({
              finalUrl,
              category: target.category,
              savePath: target.savePath,
            });
          } else {
            throw error;
          }
        }

        return {
          accepted: true,
          type: "magnet",
          category: target.category,
          savePath: target.savePath,
          destinationId: target.destinationId,
          destinationLabel: target.destinationLabel,
        };
      }

      // Otherwise treat as a .torrent URL: download the file and upload it to qBittorrent
      try {
        const res = await axios.get(finalUrl, {
          responseType: "arraybuffer",
          maxRedirects: 5,
          validateStatus: (s) => s >= 200 && s < 400,
        });

        const contentType = (res.headers["content-type"] || "").toLowerCase();
        const isTorrentByType = contentType.includes("application/x-bittorrent");
        const isTorrentByName = finalUrl.toLowerCase().endsWith(".torrent");

        if (!res.data || (!isTorrentByType && !isTorrentByName)) {
          throw new Error("Downloaded resource is not a .torrent file");
        }

        const fileBuffer = Buffer.from(res.data);
        const filename = (finalUrl.split("/").pop() || "file.torrent").split("?")[0];

        this.logger.info("Uploading .torrent file to qBittorrent", {
          destinationId: target.destinationId,
          destinationLabel: target.destinationLabel,
          category: target.category,
          savePath: target.savePath,
          filename,
        });

        try {
          await this.submitAddTorrentFile({
            fileBuffer,
            filename,
            category: target.category,
            savePath: target.savePath,
          });
        } catch (error) {
          if (error.response?.status === 403 && target.savePath) {
            this.logger.warn("qBittorrent rejected the path for torrent file, retrying once", {
              destinationId: target.destinationId,
              destinationLabel: target.destinationLabel,
              category: target.category,
              savePath: target.savePath,
              status: error.response.status,
            });

            await this.delay(1200);
            await this.login();
            await this.submitAddTorrentFile({
              fileBuffer,
              filename,
              category: target.category,
              savePath: target.savePath,
            });
          } else {
            throw error;
          }
        }

        return {
          accepted: true,
          type: "torrent",
          category: target.category,
          savePath: target.savePath,
          destinationId: target.destinationId,
          destinationLabel: target.destinationLabel,
        };
      } catch (err) {
        throw err;
      }

    } catch (e) {
      const target = this.buildTargetContext({
        category,
        savePath,
        destinationId,
        destinationLabel,
      });
      const responseBody =
        typeof e.response?.data === "string"
          ? e.response.data
          : JSON.stringify(e.response?.data || {});

      this.logger.error("Error adding download", {
        destinationId: target.destinationId,
        destinationLabel: target.destinationLabel,
        category: target.category,
        savePath: target.savePath,
        status: e.response?.status || null,
        response: responseBody || null,
        error: e.message,
      });

      if (e.response?.status === 403 && target.savePath) {
        throw new Error(
          `qBittorrent rejected the path ${target.savePath} for ${target.destinationLabel || target.destinationId || "the selected shelf"}. Make sure it exists and is writable within the qBittorrent container.`,
        );
      }

      throw new Error(responseBody || e.message);
    }
  }
}

module.exports = QBittorrentService;
