# Internationalización (i18n) - Bookseerr

## Descripción

Bookseerr utiliza un sistema de internacionalización personalizado para soportar múltiples idiomas. Actualmente soporta:

- **English (en)** - Inglés
- **Español (es-ES)** - Español de España

## Estructura

```
locales/
├── en/
│   └── common.json
└── es-ES/
    └── common.json
```

## Organización de Traducciones

Los archivos JSON están organizados en las siguientes secciones:

### `common` 
Términos generales y reutilizables:
- `error` - Mensaje de error genérico
- `success` - Mensaje de éxito
- `loading` - Cargando...
- `search` - Buscar
- `download` - Descargar

### `ui`
Texto de la interfaz de usuario:
- `pageTitle` - Título de la página
- `manager` - Subtítulo
- `heroHeading` - Encabezado principal
- `heroPowered` - Subtítulo del héroe
- `bookTitle` - Etiqueta del campo de entrada
- `searchPlaceholder` - Placeholder del campo de búsqueda
- `searchButton` - Texto del botón de búsqueda
- `requestButton` - Texto del botón de solicitud
- `noResults` - Mensaje cuando no hay resultados
- `format` - Etiqueta del formato
- `seeders` - Etiqueta de semillas
- `indexer` - Etiqueta del indexador desconocido
- `status` - Mensajes de estado dinámicos
- `alerts` - Mensajes de alerta

### `errors`
Mensajes de error:
- `requestFailed` - La solicitud falló
- `queryRequired` - Query es requerido
- `titleAndUrlRequired` - Título y URL son requeridos
- `invalidDestinationShelf` - Estantería de destino no válida
- `noResults` - No se encontraron resultados
- `authenticationFailed` - Falló la autenticación
- `unexpectedError` - Error inesperado

### `messages`
Mensajes del servidor (logs):
- `sessionStartedQBittorrent` - Sesión iniciada en qBittorrent
- `sessionStartedCalibreWeb` - Sesión iniciada en Calibre-Web
- `downloadSentToQBittorrent` - Descarga enviada a qBittorrent
- `failedRequest` - Solicitud fallida
- `failedToStartApplication` - Error al iniciar

## Cómo Funciona

### Backend (Node.js)

El backend usa `i18next` con el backend de sistema de archivos:

```javascript
const { initI18n } = require("./lib/i18n");

async function bootstrap() {
  const i18n = await initI18n();
  // i18n.t("key") para obtener traducciones
}
```

Los comentarios del código y logs están en **inglés** para consistencia profesional.

### Frontend (Vanilla JavaScript)

El frontend usa una implementación personalizada de i18n que:
1. Carga los archivos JSON de traducción desde `/locales/`
2. Proporciona un método `t()` para obtener traducciones
3. Soporta interpolación de variables: `{{variable}}`
4. Guarda la preferencia de idioma en `localStorage`

```javascript
// Inicializar i18n
const i18n = await window.initI18n();

// Obtener traducción
const mensaje = i18n.t("ui.status.searching");

// Con interpolación
const resultado = i18n.t("ui.status.foundResults", { count: 5 });

// Cambiar idioma
i18n.setLanguage("es-ES");
```

### Selector de Idioma

Se encuentra en la esquina superior derecha de la sidebar. Cambia el idioma de la UI y guarda la preferencia:

```
[English  v]
[Español  v]
```

## Cómo Agregar un Nuevo Idioma

1. **Crear carpeta de idioma:**
   ```bash
   mkdir -p locales/fr  # Para francés
   ```

2. **Crear archivo de traducciones:**
   ```bash
   cp locales/en/common.json locales/fr/common.json
   ```

3. **Traducir contenido:**
   Editar `locales/fr/common.json` con las traducciones al francés

4. **Actualizar selector (frontend):**
   En `web/app.js`, función `createLanguageSwitcher()`:
   ```javascript
   switcher.innerHTML = `
     <select id="language-select" aria-label="Language">
       <option value="en">English</option>
       <option value="es-ES">Español</option>
       <option value="fr">Français</option>
     </select>
   `;
   ```

## Convenciones

### Código Backend
- **Comentarios:** Inglés ✓
- **Logs:** Inglés ✓
- **Mensajes de error:** Mensajes traducibles

### Interfaz de Usuario
- **Texto visible:** Traducible en `ui.*`
- **Variabilización:** Usar `{{variable}}` para placeholders

### Claves de Traducción
- Usar notación de punto: `section.subsection.key`
- Nombrar descriptivamente: `ui.status.searching` en lugar de `msg_1`
- Agrupar por contexto

## Archivos Relevantes

- `/src/lib/i18n.js` - Configuración de i18n del backend
- `/web/i18n.js` - Implementación de i18n del frontend
- `/locales/` - Archivos de traducciones JSON
- `/web/app.js` - Integración de i18n en la UI
- `/src/server.js` - Inicialización de i18n en el backend

## Notas

- Las preferencias de idioma del usuario se guardan en `localStorage`
- El idioma por defecto es inglés
- Las traducciones faltantes devuelven la clave de traducción como fallback
- El sistema soporta interpolación dinámica de variables
