# Book Identifier

Drag-select any book cover or title on screen to instantly identify the book — title, author, Goodreads rating, plot summary, and reader sentiment.

## Architecture

```
Chrome Extension  ──────────►  FastAPI backend  ──────►  Claude Haiku (vision + summarize)
  (content.js)                  (Python)              ──►  Searlo (Goodreads ID lookup)
                                                       ──►  RapidAPI Goodreads (book details)
                                                       ──►  PostgreSQL (cache)
                                                       ──►  Redis (rate limiting)
```

- **Chrome Extension** — user selects a region on any webpage; the extension captures a screenshot of the selection, sends it to the API, and renders a result panel.
- **FastAPI backend** — orchestrates vision extraction → Goodreads lookup → summarization. Results are cached in PostgreSQL for 30 days.
- **Claude Haiku** — extracts title/author from the book cover image, and synthesizes plot + reader review summaries.
- **Searlo** — web search layer that resolves a title/author query to a Goodreads book ID.
- **RapidAPI Goodreads** — fetches full book metadata by ID (rating, genres, description, reviews).

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12, FastAPI, Uvicorn |
| AI | Anthropic Claude Haiku (`claude-haiku-4-5-20251001`) |
| Database | PostgreSQL 16 + SQLAlchemy async |
| Cache / Rate limit | Redis 7 |
| HTTP | httpx (async, persistent client) |
| Auth | JWT (paid) / Device UUID header (free tier) |
| Containerisation | Docker Compose |
| Extension | Chrome MV3 (Manifest V3) |

## Getting Started

### Prerequisites

- Docker & Docker Compose
- API keys — see [Required API Keys](#required-api-keys) below

### Setup

```bash
git clone https://github.com/your-username/book-identifier.git
cd book-identifier/backend

cp ../.env.example .env
# Edit .env and fill in all API keys
```

Edit `backend/.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
RAPIDAPI_KEY=...
SEARLO_API_KEY=...
JWT_SECRET=<long-random-string>
```

### Run

```bash
cd backend
docker compose up --build
```

API is available at `http://localhost:8000`.

### Chrome Extension

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `chrome-extension/` folder
4. Open the extension options (click the extension icon → options) and set your API URL to `http://localhost:8000`

## Required API Keys

| Key | Where to get |
|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `RAPIDAPI_KEY` | Subscribe to [goodreads-api-latest-updated](https://rapidapi.com/search/goodreads-api-latest-updated) on RapidAPI |
| `SEARLO_API_KEY` | [searlo.tech](https://searlo.tech) |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/api/auth/token` | Issue JWT (admin credentials from `.env`) |
| `POST` | `/api/extract-title` | Extract title/author from a base64 image |
| `POST` | `/api/lookup` | Full book lookup — accepts image or title/author |

### `/api/lookup` request

```json
{
  "image_base64": "data:image/jpeg;base64,...",
  "title": "optional — skip if sending image",
  "author": "optional"
}
```

### `/api/lookup` response

```json
{
  "title": "Hujan",
  "author": "Tere Liye",
  "year": "2016",
  "cover_image_url": "https://...",
  "goodreads_rating": 4.5,
  "goodreads_ratings_count": 12345,
  "genres": ["Fiction", "Romance"],
  "plot_summary": "...",
  "reviews_summary": "Readers praise..."
}
```

## Authentication

Requests require one of:

- `Authorization: Bearer <jwt>` — issued by `/api/auth/token`, bypasses rate limit
- `X-Device-ID: <uuid>` — anonymous device, subject to free-tier daily limit (10 lookups/day)

## Project Structure

```
book-identifier/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app and routes
│   │   ├── auth.py              # JWT + device-ID auth
│   │   ├── database.py          # SQLAlchemy models + session
│   │   ├── rate_limit.py        # Redis-based rate limiting
│   │   └── services/
│   │       ├── book_pipeline.py # Orchestrates lookup + cache
│   │       ├── claude_vision.py # Title extraction via Claude
│   │       ├── goodreads.py     # Searlo + RapidAPI integration
│   │       └── summarize.py     # Plot + review summarization
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── requirements.txt
│   └── .env.example
└── chrome-extension/
    ├── manifest.json
    ├── background/service-worker.js
    ├── content/
    │   ├── content.js
    │   └── content.css
    └── options/
        ├── options.html
        └── options.js
```
