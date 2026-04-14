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

  async addDownload({ downloadUrl, category }) {
    await this.login();

    try {
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

      this.logger.info("Enviando magnet a qBittorrent...");

      const params = new URLSearchParams({
        urls: finalUrl,
        category: category || this.defaultCategory,
      });

      await this.client.post("/api/v2/torrents/add", params.toString(), {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Referer: this.client.defaults.baseURL,
          Origin: this.client.defaults.baseURL,
        },
      });

      return {
        accepted: true,
        type: "magnet",
        category: category || this.defaultCategory,
      };

    } catch (e) {
      this.logger.error(
        "Error añadiendo descarga:",
        e.response?.data || e.message
      );
      throw new Error(e.response?.data || e.message);
    }
  }
}

module.exports = QBittorrentService;
