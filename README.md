# bookseerr

`bookseerr` is a self-hosted fullstack service for searching, downloading, and auto-importing ebooks with a lightweight web UI.

GitHub repository: `https://github.com/Cruzadera/bookseerr.git`

## What it does

`bookseerr` connects the following services into a single automated pipeline:

* `Prowlarr` for book search
* `qBittorrent` for download handling
* `Calibre-Web` for library import
* a local watcher that detects completed book files and uploads them automatically

User flow:

`Open UI -> search book -> start download -> watcher detects file -> Calibre-Web import`

## Features

* Minimal web UI served directly by Express
* Search endpoint: `GET /api/search`
* Manual download endpoint: `POST /api/download`
* Automatic request endpoint: `POST /api/request`
* Job tracking endpoint: `GET /api/jobs`
* Frontend option for `Estanteria de destino`
* EPUB-first ranking logic in `ProwlarrService`
* Automatic import of downloaded ebooks into Calibre-Web

## ⚠️ qBittorrent Configuration (IMPORTANT)

To allow `bookseerr` to communicate correctly with qBittorrent WebUI API, you must disable some security options.

Go to:

`qBittorrent → Settings → Web UI → Security`

And make sure:

* ❌ **Disable CSRF protection**
* ❌ **Disable Host header validation**

If these options are enabled:

* API requests may fail with `403 Forbidden`
* Downloads may appear as accepted but never actually start
* Authentication may silently fail

These settings are required when running qBittorrent behind Docker or reverse proxies.

---

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

* `Node.js >= 18`
* access to `Prowlarr`
* access to `qBittorrent`
* access to `Calibre-Web`
* a shared downloads path visible to both `bookseerr` and the downloader

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
FEATURE_DESTINATION_SHELF=false
DESTINATION_SHELVES=[]

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

Example `DESTINATION_SHELVES` value:

```env
FEATURE_DESTINATION_SHELF=true
DESTINATION_SHELVES=[{"id":"maria","label":"Maria","qbSavePath":"/downloads/maria","calibreShelf":"Maria","calibreShelfId":1},{"id":"infantil","label":"Infantil","qbSavePath":"/downloads/infantil","calibreShelf":"Infantil","calibreShelfId":2}]
```

When this feature is enabled, the frontend shows an `Estanteria de destino` selector and the chosen option is used to:

* keep the qBittorrent category unchanged
* optionally save the book into a destination-specific download folder
* preserve that destination in job tracking
* preferably use a fixed `calibreShelfId` so shelf assignment in Calibre-Web is deterministic
* upload the book to Calibre-Web first and then assign it to the configured shelf through the Calibre-Web session

Note: `.env.example` currently reflects your local setup style. Before publishing or sharing the repository, make sure it does not contain real credentials or internal-only addresses.

Recommended notes for `Estanteria de destino`:

* `calibreShelfId` is the most reliable option and is recommended when you already know the shelf ids in Calibre-Web.
* `qbSavePath` may differ from `DOWNLOADS_DIR` as long as both paths refer to the same mounted folder from the perspective of qBittorrent and `bookseerr`.
* Shelf assignment happens after the book is imported into Calibre-Web, because the upload form itself does not expose shelf selection in many installations.
* If you use custom `qbSavePath` values such as `/downloads/shelf-1` or `/downloads/shelf-2`, create those folders in the qBittorrent-visible volume in advance and make sure they are writable.

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
    "query": "Dune"
  }'
```

### `GET /api/settings`

Returns frontend feature flags and configured destination shelves.

### `GET /api/jobs`

Returns tracked download/import jobs.

## Frontend

The frontend is a simple vanilla JS app served from `web/`.

It includes:

* search input
* optional `Estanteria de destino` selector
* search results list
* per-result download button
* `Download best` action using `/api/request`

No frontend framework is required.

## Automation flow

1. The user searches a book from the UI or API.
2. `ProwlarrService` returns ranked results, prioritizing `EPUB`.
3. `qBittorrentService` sends the selected magnet to qBittorrent.
4. The watcher monitors the download directory.
5. `ImportService` uploads supported book files to Calibre-Web.
6. The imported file is moved or deleted depending on `POST_IMPORT_ACTION`.

## 🐳 Docker

### Pull image

```bash
docker pull ghcr.io/<your-username>/bookseerr:latest
```

### Run container

```bash
docker run -d \
  -p 3000:3000 \
  --env-file .env \
  -v /your/downloads:/downloads \
  -v /your/library:/library \
  -v /your/data:/data \
  --name bookseerr \
  ghcr.io/<your-username>/bookseerr:latest
```

### docker-compose

The repository includes `docker-compose.example.yml` for a single-service `bookseerr` deployment.

1. Copy it to your deployment directory as `docker-compose.yml`.
2. Update the placeholder bind mounts so they match your host paths.
3. Make sure the `build` path points at your local `bookseerr` checkout.
4. Start the container with `docker compose up -d --build`.

### Notes

* Make sure `/downloads` points to the same shared download directory used by qBittorrent so the watcher can detect completed files.
* Make sure `/library` points to the library location expected by your Calibre-Web workflow.
* Mount `/data` to persistent storage so `STATE_FILE=/data/state.json` survives container restarts.
* If your host uses custom ownership or a NAS share, ensure the container has the correct file permissions and UID/GID mapping when needed.

## Development notes

* Existing import logic was kept intact.
* Existing watcher logic was kept intact.
* Existing logging and job tracking were preserved.
* The web UI is intentionally small and framework-free.

## Roadmap

- [ ] Multi-user support
- [ ] Automatic shelf assignment
- [ ] Notifications
- [ ] Improved ranking logic

## License

No license file is included yet. Add one before making the repository public if you want to define reuse terms explicitly.
