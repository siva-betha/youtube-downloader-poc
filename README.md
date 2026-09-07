# YouTube Downloader POC

A modern, fast, and minimal Proof of Concept web application to inspect YouTube video metadata and download authorized media for offline use.

---

## Features

- **YouTube URL Analysis**: Automatically validates URLs and extracts title, channel, duration, and thumbnail using `yt-dlp`.
- **Format & Quality Selection**:
  - **Video (MP4)**: Detects available video resolutions (1080p, 720p, 480p, 360p, etc.) and uses FFmpeg to merge video and audio streams into clean MP4 files.
  - **Audio (MP3)**: Extracts high-quality audio streams and converts them to 192kbps MP3 format.
- **Real-Time Progress Tracking**: In-memory job state tracker with polling progress updates (downloaded bytes, total bytes, transfer speed, and ETA).
- **Direct Browser Download**: Once completed, serves sanitized files with proper MIME types directly to the browser.
- **Path Traversal & Security Protection**: File serving strictly enforces boundary checks against the base download directory and sanitizes generated filenames.
- **Automatic Retention Cleanup**: Periodic background task automatically deletes completed and orphaned media files older than a configurable threshold.
- **Dockerized Architecture**: Pre-configured Docker Compose with FFmpeg installed in the backend container.

---

## Architecture Overview

```text
[ React + Vite UI ]  <--- HTTP (JSON / REST) --->  [ FastAPI Backend ]
  (Port 5173)                                            (Port 8000)
       |                                                      |
       |-- 1. POST /api/video/info (yt-dlp extract) ---------|
       |-- 2. POST /api/download (create background job) -----|
       |-- 3. GET /api/download/{job_id}/progress (poll) ----|
       |-- 4. GET /api/download/{job_id}/file (stream) ------|
                                                              |
                                                    [ yt-dlp + FFmpeg ]
                                                              |
                                                      [ ./downloads/ ]
```

---

## Requirements

- **Docker & Docker Compose** (Recommended)

Or for direct local development without Docker:
- **Python 3.11+**
- **Node.js 20+**
- **FFmpeg** (must be installed on your system PATH for video merging & MP3 audio conversion)

---

## Quick Start with Docker

1. Start all services using Docker Compose:
   ```bash
   docker compose up --build
   ```

2. Open the application in your browser:
   - **Frontend UI**: [http://localhost:5173](http://localhost:5173)
   - **Backend API**: [http://localhost:8000](http://localhost:8000)
   - **Interactive API Docs (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## Local Development (Non-Docker)

### 1. Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   # Linux/macOS:
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Copy the environment configuration:
   ```bash
   cp .env.example .env
   ```
5. Start the backend development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

### 2. Frontend

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy environment configuration:
   ```bash
   cp .env.example .env
   ```
4. Start the Vite development server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check endpoint (`{"status": "ok"}`) |
| `POST` | `/api/video/info` | Inspect YouTube URL and retrieve metadata & formats |
| `POST` | `/api/download` | Queue background download job |
| `GET` | `/api/download/{job_id}/progress` | Check download progress & transfer metrics |
| `GET` | `/api/download/{job_id}/file` | Download the completed media file |
| `GET` | `/docs` | Interactive Swagger API documentation |

---

## Running Backend Tests

The backend includes a comprehensive unit test suite with mocked `yt-dlp` calls to test endpoints, validation, and security safeguards without making external network requests:

```bash
python -m pytest backend/tests -v
```

---

## Configuration Options

Environment variables can be set in `backend/.env` or passed via Docker Compose:

| Variable | Default | Description |
|---|---|---|
| `DOWNLOAD_DIR` | `./downloads` | Directory where downloaded media files are saved |
| `FILE_RETENTION_MINUTES` | `30` | Minutes after which completed files are deleted |
| `MAX_CONCURRENT_DOWNLOADS` | `2` | Maximum simultaneous worker download threads |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Allowed origins for cross-origin requests |
| `LOG_LEVEL` | `INFO` | Python logging level |

---

## Security & Proof of Concept Notes

- **Intended Use**: This application is a Proof of Concept intended strictly for local development and authorized personal media backups.
- **No DRM or Paywall Bypassing**: The application relies on standard `yt-dlp` extraction and will not bypass authentication, DRM, age-gates, or geo-restrictions.
- **In-Memory Job State**: Job state is tracked in memory for simplicity and does not persist across server restarts.
