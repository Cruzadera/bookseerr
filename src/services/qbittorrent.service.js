const axios = require("axios");
const { wrapper } = require("axios-cookiejar-support");
const { CookieJar } = require("tough-cookie");

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
    this.logger.info("Sesion iniciada en qBittorrent");
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

      if (!finalUrl.startsWith("magnet:")) {
        throw new Error("No se pudo obtener magnet link válido");
      }

      this.logger.info("Enviando magnet a qBittorrent", {
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
          this.logger.warn("qBittorrent rechazo la ruta, reintentando una vez", {
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

      this.logger.error("Error añadiendo descarga", {
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
          `qBittorrent rechazo la ruta ${target.savePath} para ${target.destinationLabel || target.destinationId || "la estanteria seleccionada"}. Asegurate de que exista y sea escribible dentro del contenedor de qBittorrent.`,
        );
      }

      throw new Error(responseBody || e.message);
    }
  }
}

module.exports = QBittorrentService;
