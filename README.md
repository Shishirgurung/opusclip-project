# OpusClip Project

A comprehensive video processing system that generates viral-style clips with AI-powered captions and dynamic animations.

## Table of Contents
- [Key Features](#key-features)  
  - [Opus Clip Templates](#opus-clip-templates)  
  - [Animation System](#animation-system)  
  - [Keyword Highlighting](#keyword-highlighting)  
- [Technical Stack](#technical-stack)  
- [Getting Started](#getting-started)  
  - [Prerequisites](#prerequisites)  
  - [Verify Installation](#verify-installation)  
  - [Quick Start](#quick-start)  
  - [Installation](#installation)  
  - [Configuration](#configuration)  
  - [Running Development Servers](#running-development-servers)  
- [Asynchronous Job Processing Architecture](#asynchronous-job-processing-architecture)  
  - [Job-based Workflow](#job-based-workflow)  
  - [Job Lifecycle](#job-lifecycle)  
  - [Redis Setup Requirements](#redis-setup-requirements)  
  - [Environment Variables for Job System](#environment-variables-for-job-system)  
  - [API Endpoint Changes](#api-endpoint-changes)  
  - [Polling Mechanism for Frontend](#polling-mechanism-for-frontend)  
- [API Reference](#api-reference)  
- [Usage Examples](#usage-examples)  
- [Screenshots](#screenshots)  
- [Troubleshooting](#troubleshooting)  
- [Contributing](#contributing)  
- [License](#license)

---

## Key Features

### Opus Clip Templates
Five curated templates with unique sync modes, default lines, fonts, highlight, and positioning:

| Template       | Sync Mode  | Default Lines | Font       | Position | Animation Default | Auto-Highlight |
| -------------- | ---------- | ------------- | ---------- | -------- | ----------------- | -------------- |
| **Karaoke**    | word       | 2             | Montserrat | bottom   | bounce            | yes            |
| **Beasty**     | line       | 1             | Anton      | middle   | pop               | yes            |
| **Mozi**       | line       | 2             | Georgia    | bottom   | scale             | yes            |
| **Deep Driver**| word       | 3             | Impact     | top      | underline         | yes            |
| **Popline**    | line       | 2             | Bangers    | middle   | slide-up          | yes            |

Each template JSON includes:
- `aspectRatio`, `autoLayout`
- `captionSettings` (font family, size, color, case, `syncMode`, `highlightWords`, `autoHighlight`)
- `keywordHighlight` colors (`primaryColor`, `secondaryColor`)
- `fontSettings` (shadowColor, shadowX/Y/blur)
- `positioning` (default, allowOverride)

### Animation System
Eleven standalone styles—independent of templates.  
- bounce  
- pop  
- scale  
- underline  
- slide-left  
- slide-up  
- box  
- fade  
- flash  
- shake  
- none  

Live preview powered by GSAP; CSS keyframes for exports; ASS tag generation via `generateASSAnimationTags`.

### Keyword Highlighting
Auto-detect or manual override:
- Auto-detect rules:
  - Words >6 chars
  - ALL CAPS (≥3 letters)
  - Words ending in `!` or `?`
  - NLP scoring (`emotional` or `frequency` lists)
- Manual: `highlightWords` list in template
- Colors: primary `#04f827FF`, secondary `#FFFDO3FF`
- React rendering via `applyHighlightingForReact`, ASS via `applyHighlightingForASS`

### Prerequisites

- Node.js 18+ and npm
- Python 3.8+
- FFmpeg installed and in PATH
- Redis server (for job queue)

### 1. Backend Setup

   ```bash
   cd ..
   npm install
   npm run dev
   ```
   Next.js Dev server available at `http://localhost:3000`.

Visit `http://localhost:3000` in your browser to access the dashboard.

### Installation

```bash
# Clone the repository
git clone https://github.com/traycerai/opus-clip-editor.git
cd opus-clip-editor

# Frontend dependencies
npm install

# Backend dependencies
cd python_caption_service
pip install -r requirements.txt
cd ..
```

### Configuration

Environment variables are managed via `.env.local`. Copy from `.env.example`:

```bash
cp .env.example .env.local
```

Key variables in `.env.local`:

```env
DATABASE_URL="sqlite:///./database.sqlite"
NEXTAUTH_SECRET="your-nextauth-secret"
FLASK_BASE_URL="http://localhost:5000"
# Redis configuration
REDIS_URL="redis://localhost:6379"
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_PASSWORD=""
# Job management
JOB_POLLING_INTERVAL_MS=2000
JOB_CLEANUP_DAYS=7
# Optional YouTube/yt-dlp settings:
YOUTUBE_DOWNLOAD_TIMEOUT=300
YOUTUBE_DOWNLOAD_RETRIES=3
YOUTUBE_VIDEO_QUALITY=best
YOUTUBE_AUDIO_QUALITY=bestaudio
```

### Running Development Servers

```bash
# Backend (Flask)
cd python_caption_service
source venv/bin/activate  # or activate venv on Windows
python app.py

# Frontend (Next.js)
cd ../
npm run dev
```

Dashboard available at http://localhost:3000

---

## Asynchronous Job Processing Architecture

### Job-based Workflow
1. **Job Creation**  
   Frontend submits clip processing request to `POST /api/jobs`.  
2. **Queue & Persistence**  
   A new job ID is generated and stored in Redis with status `QUEUED`.  
3. **Trigger Processing**  
   The Next.js internal endpoint `/api/jobs/trigger` calls the Flask backend asynchronously to begin processing.  
4. **Background Processing**  
   Flask backend updates job progress and status (`PROCESSING`, `COMPLETED`, `FAILED`) in Redis via Python `JobManager`.  
5. **Polling & Updates**  
   Frontend polls `GET /api/jobs/{id}` every interval (`JOB_POLLING_INTERVAL_MS`) to fetch real-time progress and final results.  
6. **Completion**  
   On `COMPLETED`, clip metadata and download URLs are returned. On `FAILED`, error details are provided.

### Job Lifecycle
- **QUEUED**: Job has been created but not started.  
- **PROCESSING**: Backend is actively working on the video/audio.  
- **COMPLETED**: Processing finished successfully; results available.  
- **FAILED**: An error occurred; check error message.

### Redis Setup Requirements
#### Local (Docker)
1. Ensure Docker is installed.  
2. Run Redis container:
   ```bash
   docker run -d --name opus-redis -p 6379:6379 redis:6-alpine
   ```
3. Verify:
   ```bash
   redis-cli -h localhost -p 6379 PING
   ```
#### Using Docker Compose
Included in `docker-compose.yml`:
```yaml
version: '3.8'
services:
  redis:
    image: redis:6-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis-data:/data
    restart: unless-stopped
volumes:
  redis-data:
```
Start with:
```bash
docker-compose up -d redis
```
#### Cloud Redis
- Provision a Redis instance (e.g., AWS Elasticache, Redis Cloud).  
- Set `REDIS_URL` or host/port/password in environment variables.

### Environment Variables for Job System
- `REDIS_URL`: Full Redis connection URI (optional if using host/port).  
- `REDIS_HOST`: Redis host (default `localhost`).  
- `REDIS_PORT`: Redis port (default `6379`).  
- `REDIS_PASSWORD`: Redis password (if set).  
- `JOB_POLLING_INTERVAL_MS`: Milliseconds between frontend polls (default `2000`).  
- `JOB_CLEANUP_DAYS`: Days before job records expire in Redis (default `7`).

### API Endpoint Changes
- **POST /api/jobs**  
  Create a new processing job. Returns `{ jobId: string }`.  
- **GET /api/jobs/{id}**  
  Poll job status and progress. Returns `JobStatusResponse`.  
- **POST /api/jobs/trigger**  
  Internal endpoint to initiate Flask backend processing.  
- **POST /api/process-video**  
  Deprecated for long jobs; small (<30s) clips still processed synchronously.

### Polling Mechanism for Frontend
- Use the `useJobPolling(jobId)` React hook.  
- Hook handles interval-based polling, error retries, and cleanup on unmount.  
- Returns current job status, progress percentage, result metadata, and error if any.

---

## API Reference

### GET /opus_templates
Returns available Opus Clip templates and default animations/colors.

### POST /transcribe_opus
Process file or YouTube URL with Opus template:
- Form data:
  - `file`: media file (optional if `youtube_url` provided)
  - `youtube_url`: YouTube video URL (optional, mutually exclusive with `file`)
  - `opus_template`: JSON string of template settings  
- Response:
  ```json
  {
    "message": "Opus Clip processing successful",
    "template_name": "Karaoke",
    "sync_mode": "word",
    "input_type": "youtube_url",
    "whisper_segments": [ /* segments */ ],
    "ass_subtitle_content": "...",
    "template_settings": { /* merged template */ },
    "processed_filename": "output_opus_karaoke_123456.mp4"
  }
  ```

### POST /preview_opus_style
Preview ASS dialogue for sample text:
- JSON body:
  - `opus_template`: template JSON
  - `sample_text`: string  
- Response:
  ```json
  {
    "ass_content": "Dialogue: 0,0:00:00.00,0:00:05.00,KaraokeStyle,,0,0,0,,{\\k...}Sample Text",
    "template_applied": { /* template */ },
    "sync_mode": "word"
  }
  ```

### POST /transcribe
Legacy transcription endpoint:
- Form data: `media_file`
- Returns JSON with ASS subtitles and segments.

### POST /transcribe_and_style
General styled transcription:
- Form data:
  - `file`
  - `template_settings`: JSON string
- Controls aspect ratio, caption settings, output ASS/video.

### POST /preview_style
Static style preview:
- JSON body:
  - `template_settings`: JSON
  - `sample_text`: string  
- Returns ASS dialogue lines only.

### GET /exports/:filename
Download processed video or ASS file.

---

### Next.js API Reference

### POST /api/process-video
Proxy endpoint for video processing; supports local files, direct video URLs, and YouTube URLs.
- Form data:
  - `file`: local media file (optional if `video_url` or `youtube_url` provided)
  - `video_url`: direct video URL (optional)
  - `youtube_url`: YouTube video URL (optional, mutually exclusive with `file`)
  - `opus_template`: JSON string of template settings  
- Response: same JSON structure as `/transcribe_opus`.

---

## Usage Examples

**1. Generate Opus Clip video**  
```bash
curl -X POST http://localhost:5000/transcribe_opus \
  -F file=@/path/to/video.mp4 \
  -F opus_template='{"name":"Karaoke","syncMode":"word","defaultLines":2}' \
  -o response.json
```

**2. Preview Opus Style**  
```bash
curl http://localhost:5000/preview_opus_style \
  -H "Content-Type: application/json" \
  -d '{"opus_template": {"name":"Beasty","syncMode":"line"},"sample_text":"WOW AMAZING!"}'
```

**3. Styled Transcription & Video**  
```bash
curl -X POST http://localhost:5000/transcribe_and_style \
  -F file=@/path/to/video.mp4 \
  -F template_settings='{"caption_settings":{"font_size":48,"color":"FFFFFF","animation":"pop"},"aspect_ratio":"9:16"}' \
  -o styled_output.json
```

**4. Download Export**  
```bash
curl -X POST http://localhost:3000/api/jobs \
  -F file=@/path/to/video.mp4 \
  -F opus_template='{"name":"Karaoke"}'
# -> { "jobId": "abc123" }
curl http://localhost:3000/api/jobs/abc123
# Poll until status COMPLETED and retrieve clip data
```

---

## Screenshots

![Template Selector](./screenshots/template-selector.png)  
*Grid view of five templates.*

![Animation Preview](./screenshots/animation-preview.gif)  
*Live GSAP animations in the dashboard.*

---

## Troubleshooting

- **Fetch Failed Error**  
  The frontend may show a “fetch failed” message if it cannot reach the Flask backend. Ensure:
  1. The Flask server is running (`python app.py` in `python_caption_service`).  
  2. `FLASK_BASE_URL` in `.env.local` matches the backend URL (default: `http://localhost:5000`).  
  3. Both backend (port 5000) and frontend (port 3000) are up simultaneously.

- **Redis Connection Issues**  
  - Ensure Redis is running locally or your cloud Redis URI is correct.  
  - Verify `REDIS_URL`, `REDIS_HOST`, `REDIS_PORT`, and `REDIS_PASSWORD` in `.env.local`.  
  - Use `redis-cli PING` to test connectivity.  
  - Common errors:
    - `ECONNREFUSED`: Redis not running or wrong port.  
    - `NOAUTH`: Redis requires a password.  

- **Job Not Found or Expired**  
  - Jobs expire after `JOB_CLEANUP_DAYS` in Redis.  
  - If polling returns 404, the job ID is invalid or expired.  
  - Adjust `JOB_CLEANUP_DAYS` or re-submit a new job.

- **FFmpeg Not Found**  
  Ensure FFmpeg is installed and on your PATH.  
  - macOS: `brew install ffmpeg`  
  - Windows: Download build from https://ffmpeg.org and add to PATH.

- **Flask CORS Errors**  
  Verify `FLASK_BASE_URL` matches the client origin and that Flask-CORS is enabled in `app.py`.

- **Missing Python Dependencies**  
  - Ensure you have activated your Python virtual environment.  
  - Install backend dependencies via:
    ```bash
    cd python_caption_service
    pip install -r requirements.txt
    ```

- **YouTube Download Issues**  
  See previous Troubleshooting entries for yt-dlp errors.

- **Template Validation Errors**  
  Check your JSON for required fields: `name`, `syncMode` (`word` or `line`), `defaultLines` (1–3), optional `animationStyle`.

- **Memory/Performance Issues**  
  Large files may exhaust RAM or temp storage. Use smaller Whisper models, shorter segments, or increase system resources.

---

## Contributing

1. Fork the repository  
2. `git checkout -b feature/your-feature`  
3. Install deps:  
   ```bash
   npm install
   pip install -r python_caption_service/requirements.txt
   ```  
4. Make changes & add tests  
5. `git commit -m "feat: ..." && git push origin feature/your-feature`  
6. Open a Pull Request and follow the contribution guidelines.

---

## License

MIT License © 2024 Traycer.AI  
See [LICENSE](LICENSE) for details.