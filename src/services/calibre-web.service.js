const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const axios = require("axios");
const cheerio = require("cheerio");
const FormData = require("form-data");
const { wrapper } = require("axios-cookiejar-support");
const { CookieJar } = require("tough-cookie");

class CalibreWebService {
  constructor({ config, logger }) {
    this.logger = logger;
    this.username = config.username;
    this.password = config.password;
    this.loginPath = config.loginPath;
    this.uploadPage = config.uploadPage;
    this.jar = new CookieJar();
    this.client = wrapper(
      axios.create({
        baseURL: config.baseUrl,
        timeout: config.requestTimeoutMs,
        jar: this.jar,
        withCredentials: true,
        maxRedirects: 5,
      }),
    );
    this.loggedIn = false;
  }

  async login() {
    if (this.loggedIn) {
      return;
    }

    const loginPage = await this.client.get(this.loginPath);
    const $ = cheerio.load(loginPage.data);
    const form = $("form").first();
    const action = form.attr("action") || this.loginPath;
    const csrfToken = form.find('input[name="csrf_token"]').attr("value");

    const payload = new URLSearchParams();
    payload.set("username", this.username);
    payload.set("password", this.password);

    if (csrfToken) {
      payload.set("csrf_token", csrfToken);
    }

    const response = await this.client.post(action, payload.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: this.loginPath,
      },
    });

    if (typeof response.data === "string" && response.data.includes("Login")) {
      throw new Error("No fue posible autenticarse en Calibre-Web");
    }

    this.loggedIn = true;
    this.logger.info("Sesion iniciada en Calibre-Web");
  }

  async discoverUploadForm() {
    await this.login();

    const response = await this.client.get(this.uploadPage);
    const $ = cheerio.load(response.data);
    const form = $('form input[type="file"]').first().closest("form");

    if (!form.length) {
      throw new Error(
        "No se encontro el formulario de upload en Calibre-Web. Revisa CALIBRE_WEB_UPLOAD_PAGE y permisos de upload.",
      );
    }

    const action = form.attr("action") || this.uploadPage;
    const fileInput = form.find('input[type="file"]').first();
    const fileFieldName = fileInput.attr("name") || "btn-upload";
    const hiddenFields = {};

    form.find('input[type="hidden"]').each((_, input) => {
      const element = $(input);
      const name = element.attr("name");
      const value = element.attr("value") || "";

      if (name) {
        hiddenFields[name] = value;
      }
    });

    return {
      action,
      fileFieldName,
      hiddenFields,
    };
  }

  buildAbsoluteUrl(ref) {
    if (!ref) {
      return null;
    }

    try {
      return new URL(ref, this.client.defaults.baseURL).toString();
    } catch (error) {
      return null;
    }
  }

  normalizeUrlPath(ref) {
    const absoluteUrl = this.buildAbsoluteUrl(ref);

    if (!absoluteUrl) {
      return null;
    }

    return new URL(absoluteUrl).pathname;
  }

  normalizeText(value) {
    return `${value || ""}`
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  getResponseUrl(response) {
    return response?.request?.res?.responseUrl || null;
  }

  parseJsonPayload(payload) {
    if (!payload) {
      return null;
    }

    if (typeof payload === "object") {
      return payload;
    }

    if (typeof payload !== "string") {
      return null;
    }

    try {
      return JSON.parse(payload);
    } catch (error) {
      return null;
    }
  }

  extractCsrfToken(html) {
    if (typeof html !== "string" || !html.trim()) {
      return null;
    }

    const $ = cheerio.load(html);

    return (
      $('input[name="csrf_token"]').first().attr("value") ||
      $('meta[name="csrf-token"]').attr("content") ||
      null
    );
  }

  collectCandidateEditUrls(response) {
    const refs = new Set();
    const responseUrl = this.getResponseUrl(response);
    const payload = this.parseJsonPayload(response?.data);

    if (payload?.location) {
      const locationUrl = this.buildAbsoluteUrl(payload.location);

      if (locationUrl) {
        refs.add(locationUrl);
      }
    }

    if (responseUrl) {
      refs.add(responseUrl);
    }

    return [...refs];
  }

  extractBookId(ref) {
    const pathname = this.normalizeUrlPath(ref);

    if (!pathname) {
      return null;
    }

    const match = pathname.match(/\/admin\/book\/(\d+)/i);
    return match ? Number(match[1]) : null;
  }

  extractShelfRefsFromHtml(html) {
    if (typeof html !== "string" || !html.trim()) {
      return [];
    }

    const $ = cheerio.load(html);
    const refs = [];

    $("a[href]").each((_, element) => {
      const node = $(element);
      const href = `${node.attr("href") || ""}`.trim();
      const text = node.text().replace(/\s+/g, " ").trim();
      const title = `${node.attr("title") || ""}`.trim();
      const ariaLabel = `${node.attr("aria-label") || ""}`.trim();

      if (/\/shelf\/\d+/i.test(href)) {
        refs.push({ href, text, title, ariaLabel });
      }
    });

    return refs;
  }

  containsPathReference(html, ref) {
    if (typeof html !== "string" || !html.trim() || !ref) {
      return false;
    }

    const normalizedRef = this.normalizeUrlPath(ref);

    if (!normalizedRef) {
      return false;
    }

    return html.includes(`href="${normalizedRef}"`) || html.includes(`href='${normalizedRef}'`);
  }

  extractFlashMessages(html) {
    if (typeof html !== "string" || !html.trim()) {
      return [];
    }

    const $ = cheerio.load(html);
    return $(
      '.alert, .alert-error, .alert-danger, .danger, .error, .flash_error, .flash_danger, .flash'
    )
      .map((_, element) => $(element).text().replace(/\s+/g, " ").trim())
      .get()
      .filter(Boolean);
  }

  matchesShelfName(candidate, shelfName) {
    const normalizedTarget = this.normalizeText(shelfName);
    const values = [
      candidate?.text,
      candidate?.title,
      candidate?.ariaLabel,
    ]
      .map((value) => this.normalizeText(value))
      .filter(Boolean);

    return values.some((value) => {
      return (
        value === normalizedTarget ||
        value.includes(normalizedTarget) ||
        normalizedTarget.includes(value)
      );
    });
  }

  extractShelfTitleFromPage(html) {
    if (typeof html !== "string" || !html.trim()) {
      return "";
    }

    const $ = cheerio.load(html);
    const title = $("title").first().text().replace(/\s+/g, " ").trim();

    if (title) {
      return title;
    }

    return $("h1, h2").first().text().replace(/\s+/g, " ").trim();
  }

  async bruteForceShelfIdByName(shelfName, maxShelfId = 50) {
    const normalizedTarget = this.normalizeText(shelfName);

    for (let shelfId = 1; shelfId <= maxShelfId; shelfId += 1) {
      const shelfUrl = this.buildAbsoluteUrl(`/shelf/${shelfId}`);

      try {
        const response = await this.client.get(shelfUrl, {
          validateStatus: (status) => status >= 200 && status < 500,
        });

        if (response.status !== 200) {
          continue;
        }

        const pageTitle = this.normalizeText(
          this.extractShelfTitleFromPage(response.data),
        );

        if (
          pageTitle === normalizedTarget ||
          pageTitle.includes(normalizedTarget)
        ) {
          this.logger.info("Shelf resuelta por sondeo directo", {
            shelfName,
            shelfId,
            shelfUrl,
            pageTitle,
          });
          return shelfId;
        }
      } catch (error) {
        this.logger.debug("Fallo sondeando shelf candidata", {
          shelfId,
          shelfName,
          error: error.message,
        });
      }
    }

    return null;
  }

  async resolveShelfIdByName(shelfName, candidatePageUrls = []) {
    const pagesToInspect = [
      this.buildAbsoluteUrl("/"),
      ...candidatePageUrls.map((url) => this.buildAbsoluteUrl(url)),
    ].filter(Boolean);
    const visitedPages = new Set();

    for (const pageUrl of pagesToInspect) {
      if (visitedPages.has(pageUrl)) {
        continue;
      }

      visitedPages.add(pageUrl);

      try {
        const response = await this.client.get(pageUrl);
        const shelfRefs = this.extractShelfRefsFromHtml(response.data);
        const shelfRef = shelfRefs.find((item) =>
          this.matchesShelfName(item, shelfName),
        );

        this.logger.info("Shelves detectadas en pagina candidata", {
          pageUrl,
          shelfName,
          detectedShelves: shelfRefs.map((item) => ({
            href: item.href,
            text: item.text,
            title: item.title,
            ariaLabel: item.ariaLabel,
          })),
        });

        if (!shelfRef) {
          continue;
        }

        const hrefPath = this.normalizeUrlPath(shelfRef.href);
        const match = hrefPath?.match(/\/shelf\/(\d+)/i);

        if (match) {
          return Number(match[1]);
        }
      } catch (error) {
        this.logger.warn("No fue posible inspeccionar pagina para resolver shelf", {
          pageUrl,
          shelfName,
          error: error.message,
        });
      }
    }

    return this.bruteForceShelfIdByName(shelfName);
  }

  async addBookToShelf({ bookId, shelfId, shelfName, referer }) {
    const targetUrl = this.buildAbsoluteUrl(`/shelf/add/${shelfId}/${bookId}`);
    const cookieHeader = await this.jar.getCookieString(targetUrl);
    let csrfToken = null;

    try {
      const refererUrl = referer || this.buildAbsoluteUrl(`/admin/book/${bookId}`);
      const refererResponse = await this.client.get(refererUrl);
      csrfToken = this.extractCsrfToken(refererResponse.data);
    } catch (error) {
      this.logger.warn("No fue posible obtener csrf_token para anadir shelf", {
        shelfName,
        shelfId,
        bookId,
        referer: referer || null,
        error: error.message,
      });
    }

    const payload = new URLSearchParams();

    if (csrfToken) {
      payload.set("csrf_token", csrfToken);
    }

    const response = await axios.post(targetUrl, payload.toString(), {
      headers: {
        Cookie: cookieHeader,
        "X-Requested-With": "XMLHttpRequest",
        Accept: "*/*",
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: referer || this.buildAbsoluteUrl("/"),
        Origin: this.client.defaults.baseURL,
      },
      validateStatus: (status) => status >= 200 && status < 500,
      maxRedirects: 0,
    });
    const responseUrl = this.getResponseUrl(response);
    const locationHeader = response.headers?.location || null;
    const flashMessages = this.extractFlashMessages(response.data);
    const responseText =
      typeof response.data === "string" ? response.data.toLowerCase() : "";
    let added = response.status === 204;

    if (!added && (response.status === 200 || response.status === 302)) {
      const shelfUrl = this.buildAbsoluteUrl(`/shelf/${shelfId}`);

      try {
        const verificationResponse = await this.client.get(shelfUrl);
        added = this.containsPathReference(
          verificationResponse.data,
          `/admin/book/${bookId}`,
        );
      } catch (error) {
        this.logger.warn("No fue posible verificar la asignacion de shelf", {
          shelfName,
          shelfId,
          bookId,
          verificationUrl: shelfUrl,
          error: error.message,
        });
      }
    }

    this.logger.info("Intento de anadir libro a shelf", {
      shelfName,
      shelfId,
      bookId,
      status: response.status,
      targetUrl,
      responseUrl,
      locationHeader,
      csrfTokenIncluded: Boolean(csrfToken),
      flashMessages,
      added,
      responseSnippet: responseText.slice(0, 180),
    });

    return added;
  }

  async assignShelfAfterUpload(uploadResponse, metadata) {
    const candidateUrls = this.collectCandidateEditUrls(uploadResponse);
    const bookId = candidateUrls.map((url) => this.extractBookId(url)).find(Boolean) || null;

    this.logger.info("Buscando pagina de metadata para asignar shelf", {
      shelfName: metadata.shelfName || null,
      bookId,
      candidateUrls,
      uploadResponseUrl: this.getResponseUrl(uploadResponse),
      uploadPayload: this.parseJsonPayload(uploadResponse?.data),
    });

    if (bookId) {
      const shelfId =
        metadata.shelfId ||
        (await this.resolveShelfIdByName(metadata.shelfName, candidateUrls));

      if (shelfId) {
        const added = await this.addBookToShelf({
          bookId,
          shelfId,
          shelfName: metadata.shelfName,
          referer: candidateUrls[0] || this.buildAbsoluteUrl("/"),
        });

        if (added) {
          return true;
        }
      } else {
        this.logger.warn("No se pudo resolver el id de la shelf solicitada", {
          shelfName: metadata.shelfName,
          configuredShelfId: metadata.shelfId || null,
          candidateUrls,
        });
      }
    }

    return false;
  }

  async uploadBook(filePath, metadata = {}) {
    const formDescriptor = await this.discoverUploadForm();
    const form = new FormData();

    Object.entries(formDescriptor.hiddenFields).forEach(([name, value]) => {
      form.append(name, value);
    });

    form.append(
      formDescriptor.fileFieldName,
      fs.createReadStream(filePath),
      path.basename(filePath),
    );

    const response = await this.client.post(formDescriptor.action, form, {
      headers: {
        ...form.getHeaders(),
        Referer: this.uploadPage,
      },
      maxBodyLength: Infinity,
    });

    const shelfAssigned = metadata.shelfName
      ? await this.assignShelfAfterUpload(response, metadata)
      : false;

    this.logger.info("Libro subido a Calibre-Web", {
      filePath,
      destinationId: metadata.destinationId || null,
      destinationLabel: metadata.destinationLabel || null,
      shelfName: metadata.shelfName || null,
      shelfAssigned,
      action: formDescriptor.action,
      field: formDescriptor.fileFieldName,
      status: response.status,
      responseUrl: this.getResponseUrl(response),
    });

    return {
      imported: true,
      status: response.status,
    };
  }
}

module.exports = CalibreWebService;
