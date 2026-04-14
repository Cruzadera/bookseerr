const fs = require("fs");
const path = require("path");

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
    const shelfField = this.findShelfField(form, $);

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
      shelfField,
    };
  }

  findShelfField(form, $) {
    const candidates = [];

    form.find("select").each((_, select) => {
      const element = $(select);
      const name = `${element.attr("name") || ""}`.trim();

      if (!name || !/shelf/i.test(name)) {
        return;
      }

      const options = element
        .find("option")
        .map((__, option) => ({
          value: `${$(option).attr("value") || ""}`.trim(),
          label: `${$(option).text() || ""}`.trim(),
        }))
        .get()
        .filter((option) => option.value || option.label);

      candidates.push({
        name,
        options,
      });
    });

    return candidates[0] || null;
  }

  resolveShelfOption(shelfField, shelfName) {
    if (!shelfField || !shelfName) {
      return null;
    }

    const normalizedTarget = shelfName.trim().toLowerCase();

    return (
      shelfField.options.find((option) => {
        return (
          option.value.trim().toLowerCase() === normalizedTarget ||
          option.label.trim().toLowerCase() === normalizedTarget
        );
      }) || null
    );
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

    const shelfOption = this.resolveShelfOption(
      formDescriptor.shelfField,
      metadata.shelfName,
    );

    if (formDescriptor.shelfField && shelfOption) {
      form.append(formDescriptor.shelfField.name, shelfOption.value);
    }

    const response = await this.client.post(formDescriptor.action, form, {
      headers: {
        ...form.getHeaders(),
        Referer: this.uploadPage,
      },
      maxBodyLength: Infinity,
    });

    this.logger.info("Libro subido a Calibre-Web", {
      filePath,
      destinationId: metadata.destinationId || null,
      destinationLabel: metadata.destinationLabel || null,
      shelfName: metadata.shelfName || null,
      shelfAssigned: Boolean(shelfOption),
      action: formDescriptor.action,
      field: formDescriptor.fileFieldName,
      status: response.status,
    });

    return {
      imported: true,
      status: response.status,
    };
  }
}

module.exports = CalibreWebService;
