# bookseerr

`bookseerr` is a self-hosted fullstack service for searching, downloading, and auto-importing ebooks with a lightweight web UI.

GitHub repository: `https://github.com/Cruzadera/bookseerr.git`

## What it does

`bookseerr` connects the following services into a single automated pipeline:

- `Prowlarr` for book search
- `qBittorrent` for download handling
- `Calibre-Web` for library import
- a local watcher that detects completed book files and uploads them automatically

User flow:

`Open UI -> search book -> start download -> watcher detects file -> Calibre-Web import`

## Features

- Minimal web UI served directly by Express
- Search endpoint: `GET /api/search`
- Manual download endpoint: `POST /api/download`
- Automatic request endpoint: `POST /api/request`
- Job tracking endpoint: `GET /api/jobs`
- EPUB-first ranking logic in `ProwlarrService`
- Automatic import of downloaded ebooks into Calibre-Web

## Project structure

```text
bookseerr/
├── src/
│   ├── app.js
│   ├── server.js
│   ├── routes/
│   ├── services/
│   ├── middleware/
│   ├── repositories/
│   └── utils/
├── web/
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── package.json
└── README.md
```

## Requirements

- `Node.js >= 18`
- access to `Prowlarr`
- access to `qBittorrent`
- access to `Calibre-Web`
- a shared downloads path visible to both `bookseerr` and the downloader

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Create your environment file from the example:

```bash
cp .env.example .env
```

3. Update the values in `.env` for your environment.

4. Start the service:

```bash
npm run dev
```

Or in production:

```bash
npm start
```

5. Open:

```text
http://localhost:3000
```

## Environment variables

Main variables used by the app:

```env
PORT=3000
LOG_LEVEL=info

PROWLARR_BASE_URL=http://prowlarr:9696
PROWLARR_API_KEY=your_prowlarr_api_key

QBITTORRENT_BASE_URL=http://qbittorrent:8080
QBITTORRENT_USERNAME=admin
QBITTORRENT_PASSWORD=your_password
QBITTORRENT_CATEGORY=books
QBITTORRENT_SAVE_PATH=/downloads

CALIBRE_WEB_BASE_URL=http://calibre-web:8083
CALIBRE_WEB_USERNAME=admin
CALIBRE_WEB_PASSWORD=your_password
CALIBRE_WEB_LOGIN_PATH=/login
CALIBRE_WEB_UPLOAD_PAGE=/

DOWNLOADS_DIR=/downloads
LIBRARY_DIR=/library
STATE_FILE=/data/state.json
WATCHER_ENABLED=true
WATCH_EXTENSIONS=.epub,.mobi,.azw3
WATCH_DEBOUNCE_MS=8000

POST_IMPORT_ACTION=move
PROCESSED_DIR=/downloads/.imported

REQUEST_TIMEOUT_MS=30000
```

Note: `.env.example` currently reflects your local setup style. Before publishing or sharing the repository, make sure it does not contain real credentials or internal-only addresses.

## API

### `GET /health`

Returns service status.

### `GET /api/search?query=<text>`

Searches books through `Prowlarr`.

Example:

```bash
curl "http://localhost:3000/api/search?query=dune"
```

### `POST /api/download`

Starts a download from a selected result.

Example:

```bash
curl -X POST "http://localhost:3000/api/download" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Dune",
    "downloadUrl": "magnet:?xt=urn:btih:...",
    "protocol": "torrent"
  }'
```

### `POST /api/request`

Searches automatically, picks the best result, and sends it to `qBittorrent`.

Example:

```bash
curl -X POST "http://localhost:3000/api/request" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Dune",
    "user": "maria"
  }'
```

### `GET /api/jobs`

Returns tracked download/import jobs.

## Frontend

The frontend is a simple vanilla JS app served from `web/`.

It includes:

- search input
- search results list
- per-result download button
- `Download best` action using `/api/request`

No frontend framework is required.

## Automation flow

1. The user searches a book from the UI or API.
2. `ProwlarrService` returns ranked results, prioritizing `EPUB`.
3. `qBittorrentService` sends the selected magnet to qBittorrent.
4. The watcher monitors the download directory.
5. `ImportService` uploads supported book files to Calibre-Web.
6. The imported file is moved or deleted depending on `POST_IMPORT_ACTION`.

## Docker note

There is a `docker-compose.example.yml` file in the repository. Review it before using it directly, especially paths, service names, and mounted volumes, so they match your actual environment.

## Development notes

- Existing import logic was kept intact.
- Existing watcher logic was kept intact.
- Existing logging and job tracking were preserved.
- The web UI is intentionally small and framework-free.

## License

No license file is included yet. Add one before making the repository public if you want to define reuse terms explicitly.
