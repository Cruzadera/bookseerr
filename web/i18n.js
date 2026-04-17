// Initialize i18next for browser
let i18nInstance = null;

const fallbackTranslations = {
  en: {
    common: {
      error: 'Error',
      success: 'Success',
      loading: 'Loading...',
      search: 'Search',
      download: 'Download',
    },
    ui: {
      pageTitle: 'Bookseerr',
      manager: 'Ebook request manager',
      heroHeading: 'Search, download, and auto-import books in one place.',
      heroPowered: 'Powered by Prowlarr, qBittorrent, and Calibre-Web.',
      bookTitle: 'Book title',
      searchPlaceholder: 'Search by title or author',
      searchButton: 'Search',
      requestButton: 'Request best',
      noResults: 'No matching books found.',
      emptyStateKicker: 'No results',
      noResultsHint: 'Try another title, author, or loosen the filters and search again.',
      searchErrorTitle: 'Could not load results.',
      searchErrorDescription: 'Check your connection and try the search again.',
      retrySearch: 'Retry search',
      downloadErrorTitle: 'Download failed.',
      downloadErrorDescription: 'The item could not be sent to qBittorrent. You can try again.',
      retryDownload: 'Retry download',
      format: 'Format',
      seeders: 'Seeders',
      size: 'Size',
      recentSearches: 'Recent searches',
      bestMatch: 'Best match',
      unknownAuthor: 'Unknown author',
      indexer: 'Unknown indexer',
      nav: {
        home: 'Home',
        settings: 'Settings',
        recent: 'Recent',
        morePages: 'More pages',
      },
      shelf: {
        destination: 'Destination shelf',
        generalLibrary: 'General library',
      },
      quickFilters: {
        title: 'Quick filters',
        onlyEpub: 'Only EPUB',
        spanishOnly: 'Spanish only',
        under20MB: '< 20 MB',
      },
      placeholders: {
        settings: 'Settings',
        comingSoon: 'Coming soon',
      },
      recent: {
        title: 'Recent searches',
        clear: 'Clear history',
        empty: 'No recent searches',
      },
      settings: {
        title: 'Search and download preferences',
        description: 'Adjust ranking, limits, and Calibre shelf behavior.',
        filtersTitle: 'Search filters',
        downloadTitle: 'Download behavior',
        calibreTitle: 'Calibre-Web',
        preferredFormat: 'Preferred format',
        excludedFormats: 'Excluded formats',
        minSeeds: 'Minimum seeders',
        maxSizeMB: 'Maximum size (MB)',
        language: 'Language',
        indexers: 'Prowlarr indexers',
        indexersHelp: 'If none are selected, all available indexers will be used.',
        noIndexers: 'No indexers available right now.',
        autoDownload: 'Auto-download best result after search',
        onlyIfPreferredFormat: 'Only download when it matches the preferred format',
        defaultShelf: 'Default destination shelf',
        rememberLastShelf: 'Remember last selected shelf',
        save: 'Save settings',
        reset: 'Reset defaults',
        saved: 'Settings saved.',
        defaultsRestored: 'Defaults restored in the form.',
        anyFormat: 'Any format',
        anyLanguage: 'Any language',
        spanish: 'Spanish',
        english: 'English',
      },
      searchButtonLoading: 'Searching...',
      requestButtonLoading: 'Requesting...',
      downloadButtonLoading: 'Downloading...',
      status: {
        searching: 'Searching...',
        enterTitle: 'Enter a book title to search.',
        foundResults: '{{count}} result(s) found.',
        requesting: 'Looking for the best match...',
        requestSuccess: 'Download started for "{{title}}".',
        downloadSuccess: 'Download started.',
        downloadStarting: 'Starting download for "{{title}}"...',
      },
      alerts: {
        downloadStarted: 'Download started!',
        enterBeforeRequest: 'Enter a book title before requesting a download.',
      },
    },
    errors: {
      requestFailed: 'Request failed',
      queryRequired: 'Query is required',
      titleAndUrlRequired: 'Title and download URL are required',
      invalidDestinationShelf: 'The selected destination shelf does not exist',
      noResults: 'No results found',
      authenticationFailed: 'Failed to authenticate with Calibre-Web',
      unexpectedError: 'Unexpected error',
      invalidDestination: 'Invalid destination shelf',
    },
  },
  'es-ES': {
    common: {
      error: 'Error',
      success: 'Éxito',
      loading: 'Cargando...',
      search: 'Buscar',
      download: 'Descargar',
    },
    ui: {
      pageTitle: 'Bookseerr',
      manager: 'Gestor de solicitudes de ebooks',
      heroHeading: 'Busca, descarga e importa libros automáticamente en un mismo lugar.',
      heroPowered: 'Impulsado por Prowlarr, qBittorrent y Calibre-Web.',
      bookTitle: 'Título del libro',
      searchPlaceholder: 'Busca por título o autor',
      searchButton: 'Buscar',
      requestButton: 'Solicitar mejor',
      noResults: 'No se encontraron libros coincidentes.',
      emptyStateKicker: 'Sin resultados',
      noResultsHint: 'Prueba con otro título, autor o relaja los filtros y vuelve a buscar.',
      searchErrorTitle: 'No se pudieron cargar los resultados.',
      searchErrorDescription: 'Revisa tu conexión e intenta la búsqueda de nuevo.',
      retrySearch: 'Reintentar búsqueda',
      downloadErrorTitle: 'La descarga falló.',
      downloadErrorDescription: 'No se pudo enviar el elemento a qBittorrent. Puedes intentarlo de nuevo.',
      retryDownload: 'Reintentar descarga',
      format: 'Formato',
      seeders: 'Semillas',
      recentSearches: 'Búsquedas recientes',
      size: 'Tamaño',
      bestMatch: 'Mejor resultado',
      unknownAuthor: 'Autor desconocido',
      indexer: 'Indexador desconocido',
      nav: {
        home: 'Inicio',
        settings: 'Configuración',
        recent: 'Recientes',
        morePages: 'Más páginas',
      },
      shelf: {
        destination: 'Estantería de destino',
        generalLibrary: 'Biblioteca general',
      },
      quickFilters: {
        title: 'Filtros rápidos',
        onlyEpub: 'Solo EPUB',
        spanishOnly: 'Solo español',
        under20MB: '< 20 MB',
      },
      placeholders: {
        settings: 'Configuración',
        comingSoon: 'Próximamente',
      },
      recent: {
        title: 'Búsquedas recientes',
        clear: 'Borrar historial',
        empty: 'No hay búsquedas recientes',
      },
      settings: {
        title: 'Preferencias de búsqueda y descarga',
        description: 'Ajusta el ranking, los límites y el comportamiento de Calibre-Web.',
        filtersTitle: 'Filtros de búsqueda',
        downloadTitle: 'Comportamiento de descarga',
        calibreTitle: 'Calibre-Web',
        preferredFormat: 'Formato preferido',
        excludedFormats: 'Formatos excluidos',
        minSeeds: 'Semillas mínimas',
        maxSizeMB: 'Tamaño máximo (MB)',
        language: 'Idioma',
        indexers: 'Indexadores de Prowlarr',
        indexersHelp: 'Si no seleccionas ninguno, se usarán todos los indexadores disponibles.',
        noIndexers: 'No hay indexadores disponibles en este momento.',
        autoDownload: 'Descargar automáticamente el mejor resultado tras buscar',
        onlyIfPreferredFormat: 'Solo descargar si coincide con el formato preferido',
        defaultShelf: 'Estantería de destino por defecto',
        rememberLastShelf: 'Recordar la última estantería seleccionada',
        save: 'Guardar configuración',
        reset: 'Restablecer valores',
        saved: 'Configuración guardada.',
        defaultsRestored: 'Los valores predeterminados se restauraron en el formulario.',
        anyFormat: 'Cualquier formato',
        anyLanguage: 'Cualquier idioma',
        spanish: 'Español',
        english: 'Inglés',
      },
      searchButtonLoading: 'Buscando...',
      requestButtonLoading: 'Solicitando...',
      downloadButtonLoading: 'Descargando...',
      status: {
        searching: 'Buscando...',
        enterTitle: 'Introduce un título de libro para buscar.',
        foundResults: 'Se encontraron {{count}} resultado(s).',
        requesting: 'Buscando la mejor coincidencia...',
        requestSuccess: 'Descarga iniciada para "{{title}}".',
        downloadSuccess: 'Descarga iniciada.',
        downloadStarting: 'Iniciando descarga de "{{title}}"...',
      },
      alerts: {
        downloadStarted: '¡Descarga iniciada!',
        enterBeforeRequest: 'Introduce un título de libro antes de solicitar una descarga.',
      },
    },
    errors: {
      requestFailed: 'La solicitud falló',
      queryRequired: 'La consulta es obligatoria',
      titleAndUrlRequired: 'El título y la URL de descarga son obligatorios',
      invalidDestinationShelf: 'La estantería de destino seleccionada no existe',
      noResults: 'No se encontraron resultados',
      authenticationFailed: 'Falló la autenticación en Calibre-Web',
      unexpectedError: 'Error inesperado',
      invalidDestination: 'Estantería de destino no válida',
    },
  },
};

function normalizeLanguage(lang) {
  const value = `${lang || ''}`.toLowerCase();

  if (value.startsWith('es')) {
    return 'es-ES';
  }

  if (value.startsWith('en')) {
    return 'en';
  }

  return 'en';
}

// Detect browser language - returns language code supported by app
function detectBrowserLanguage() {
  const browserLang = navigator.language || navigator.userLanguage || 'en';
  const normalized = normalizeLanguage(browserLang);
  console.log('[i18n] Browser language:', browserLang, '→', normalized);
  return normalized;
}

function resolveNestedTranslation(source, keys) {
  let value = source;

  for (const keyPart of keys) {
    if (typeof value === 'object' && value !== null && keyPart in value) {
      value = value[keyPart];
    } else {
      return undefined;
    }
  }

  return value;
}

async function initI18n() {
  console.log('[i18n] initI18n called');
  
  // If already initialized, return existing instance
  if (i18nInstance) {
    console.log('[i18n] Already initialized, returning cached instance');
    return i18nInstance;
  }

  // Detect language from browser first, then check localStorage, then default
  const savedLanguage = localStorage.getItem('language');
  const defaultLanguage = normalizeLanguage(savedLanguage || detectBrowserLanguage());
  console.log('[i18n] Default language:', defaultLanguage, '(saved:', savedLanguage, ')');

  // Create a simple namespace object for translations
  let translations = { ...fallbackTranslations };

  try {
    console.log('[i18n] Fetching translation files...');
    
    // Fetch translations from JSON files
    const [enResponse, esResponse] = await Promise.all([
      fetch('/locales/en/common.json'),
      fetch('/locales/es-ES/common.json'),
    ]);

    console.log('[i18n] EN response:', enResponse.status, enResponse.statusText);
    console.log('[i18n] ES response:', esResponse.status, esResponse.statusText);

    if (!enResponse.ok || !esResponse.ok) {
      throw new Error(`Failed to fetch translation files. EN: ${enResponse.status}, ES: ${esResponse.status}`);
    }

    const enData = await enResponse.json();
    const esData = await esResponse.json();

    console.log('[i18n] EN translations loaded, keys:', Object.keys(enData).length);
    console.log('[i18n] ES translations loaded, keys:', Object.keys(esData).length);

    translations = {
      en: enData,
      'es-ES': esData,
    };
  } catch (error) {
    console.error('[i18n] Failed to load translations, using bundled fallback:', error);
    translations = { ...fallbackTranslations };
  }

  // Simple i18n implementation for browser
  i18nInstance = {
    currentLanguage: defaultLanguage,
    translations,

    setLanguage(lang) {
      const normalized = normalizeLanguage(lang);

      if (this.translations[normalized]) {
        this.currentLanguage = normalized;
        localStorage.setItem('language', normalized);
        // Update HTML lang attribute
        document.documentElement.lang = normalized.split('-')[0]; // Use base language code (e.g., 'es' from 'es-ES')
        console.log('[i18n] Language changed to:', normalized);
        return true;
      }

      console.warn('[i18n] Unsupported language requested:', lang, '→ using en');
      this.currentLanguage = 'en';
      localStorage.setItem('language', 'en');
      document.documentElement.lang = 'en';
      return false;
    },

    t(key, options = {}) {
      const keys = key.split('.');
      const normalizedLanguage = normalizeLanguage(this.currentLanguage);
      const localizedSource = this.translations[normalizedLanguage] || {};
      const fallbackSource = fallbackTranslations.en || {};
      const value =
        resolveNestedTranslation(localizedSource, keys) ||
        resolveNestedTranslation(fallbackSource, keys);

      if (value === undefined) {
        console.warn('[i18n] Translation key not found:', key, 'for language:', normalizedLanguage);
        return key;
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

  console.log('[i18n] Instance created, language:', i18nInstance.getLanguage());

  // Update HTML lang attribute
  document.documentElement.lang = defaultLanguage.split('-')[0]; // Use base language code

  return i18nInstance;
}

// Export for use
window.initI18n = initI18n;