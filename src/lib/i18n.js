const i18next = require('i18next');
const FsBackend = require('i18next-fs-backend');
const path = require('path');

// Initialize i18n for backend
async function initI18n() {
  await i18next
    .use(FsBackend)
    .init({
      lng: 'en',
      fallbackLng: 'en',
      ns: ['common'],
      defaultNS: 'common',
      backend: {
        loadPath: path.join(__dirname, '../..', 'locales', '{{lng}}', '{{ns}}.json'),
      },
      interpolation: {
        escapeValue: false,
      },
    });

  return i18next;
}

module.exports = {
  initI18n,
  t: (key, options = {}) => i18next.t(key, options),
};
