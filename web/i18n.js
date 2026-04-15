// Initialize i18next for browser
async function initI18n() {
  const defaultLanguage = localStorage.getItem('language') || 'en';

  // Create a simple namespace object for translations
  let translations = {};

  try {
    // Fetch translations from JSON files
    const [enResponse, esResponse] = await Promise.all([
      fetch('/locales/en/common.json'),
      fetch('/locales/es-ES/common.json'),
    ]);

    const enData = await enResponse.json();
    const esData = await esResponse.json();

    translations = {
      en: enData,
      'es-ES': esData,
    };
  } catch (error) {
    console.error('Failed to load translations:', error);
  }

  // Simple i18n implementation for browser
  const i18n = {
    currentLanguage: defaultLanguage,
    translations,

    setLanguage(lang) {
      if (this.translations[lang]) {
        this.currentLanguage = lang;
        localStorage.setItem('language', lang);
        return true;
      }
      return false;
    },

    t(key, options = {}) {
      const keys = key.split('.');
      let value = this.translations[this.currentLanguage];

      // Navigate through nested keys
      for (const k of keys) {
        if (typeof value === 'object' && value !== null) {
          value = value[k];
        } else {
          return key; // Return key if not found
        }
      }

      // Handle interpolation
      if (typeof value === 'string' && options) {
        return value.replace(/{{(\w+)}}/g, (match, varName) => {
          return options[varName] !== undefined ? options[varName] : match;
        });
      }

      return value || key;
    },

    getLanguage() {
      return this.currentLanguage;
    },

    getAvailableLanguages() {
      return Object.keys(this.translations);
    },
  };

  return i18n;
}

// Export for use
window.initI18n = initI18n;
