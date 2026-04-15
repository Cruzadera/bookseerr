# Bookseerr – Ebook Request Manager for Calibre-Web

> A lightweight alternative to Overseerr for managing ebooks with Calibre-Web.

Bookseerr is a self-hosted ebook request manager designed to automate ebook search, download, and import into your Calibre-Web library.

It integrates tools like Prowlarr and qBittorrent into a seamless pipeline, allowing users to search and request books from a simple web interface.

---

## 🔍 Keywords

self-hosted ebook manager, calibre-web automation, ebook request system, overseerr for books, ebook downloader, prowlarr books, qbittorrent ebooks

---

## 🚀 What it does

Bookseerr integrates popular self-hosted services into a fully automated ebook pipeline:

* `Prowlarr` → search engine for books
* `qBittorrent` → download manager
* `Calibre-Web` → library management
* Local watcher → detects completed downloads and imports them automatically

### User flow

`Open UI → search book → start download → watcher detects file → Calibre-Web import`

---

## ✨ Features

* Minimal and fast web UI served by Express
* Ebook search via `GET /api/search`
* Manual download via `POST /api/download`
* One-click request via `POST /api/request`
* Download tracking via `GET /api/jobs`
* EPUB-first ranking logic
* Automatic import into Calibre-Web
* Fully self-hosted and lightweight

---

## ⚠️ qBittorrent Configuration (IMPORTANT)

To allow Bookseerr to communicate correctly with qBittorrent WebUI API, you must disable some security options.

Go to:

`qBittorrent → Settings → Web UI → Security`

And make sure:

* ❌ Disable CSRF protection
* ❌ Disable Host header validation

If these options are enabled:

* API requests may fail with `403 Forbidden`
* Downloads may appear accepted but never start
* Authentication may silently fail

These settings are required when running qBittorrent behind Docker or reverse proxies.

---

## 📁 Project structure

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

---

## ⚙️ Requirements

* Node.js >= 18
* Access to Prowlarr
* Access to qBittorrent
* Access to Calibre-Web
* Shared downloads directory

---

## ⚡ Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Create environment file

```bash
cp .env.example .env
```

### 3. Configure variables

Edit `.env` with your setup values.

### 4. Run the app

```bash
npm run dev
```

Or production:

```bash
npm start
```

### 5. Open in browser

```
http://localhost:3000
```

---

## 🔐 Environment variables

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

---

## 🔌 API

### `GET /health`

Returns service status.

---

### `GET /api/search?query=<text>`

Search ebooks using Prowlarr.

```bash
curl "http://localhost:3000/api/search?query=dune"
```

---

### `POST /api/download`

Start a manual download.

```bash
curl -X POST "http://localhost:3000/api/download" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Dune",
    "downloadUrl": "magnet:?xt=urn:btih:...",
    "protocol": "torrent"
  }'
```

---

### `POST /api/request`

Automatically search and download the best result.

```bash
curl -X POST "http://localhost:3000/api/request" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Dune"
  }'
```

---

### `GET /api/jobs`

Returns tracked jobs.

---

## 🖥️ Frontend

A minimal vanilla JavaScript UI served from `/web`.

Includes:

* Search input
* Results list
* Download buttons
* “Download best” action

No frontend framework required.

---

## 🔄 Automation flow

1. User searches a book
2. Prowlarr returns ranked results (EPUB prioritized)
3. qBittorrent starts the download
4. Watcher detects completed files
5. ImportService uploads to Calibre-Web
6. File is moved or deleted

---

## 🐳 Docker

### Pull image

```bash
docker pull ghcr.io/cruzadera/bookseerr:latest
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
  ghcr.io/cruzadera/bookseerr:latest
```

---

### docker-compose

A `docker-compose.example.yml` is included.

Steps:

1. Copy it to `docker-compose.yml`
2. Update volumes
3. Adjust build path
4. Run:

```bash
docker compose up -d --build
```

---

## 🧠 Notes

* `/downloads` must match qBittorrent path
* `/library` must match Calibre-Web library
* `/data` ensures persistence
* Check permissions if using NAS

---

## 🛣️ Roadmap

* [ ] Multi-user support
* [ ] Automatic shelves
* [ ] Notifications
* [ ] Better ranking logic

---

## 📄 License

No license defined yet. Add one (MIT recommended) before public distribution.
