# michaelmace.dev

Static personal site (deployed on Vercel) with local-only tooling for content editing.

## What lives where

- `index.html` + `style.css`: homepage and shared styling
- `notes/`: published notes (`.html`) and source markdown (`.md`)
- `gifs/`: published GIF page + committed data files (`data.json`, `favorites.json`)
- `editor/`: local Express app for editing notes and GIF metadata (excluded from deploy via `.vercelignore`)

## Local workflow

### 1) Start the local editor/API

```bash
cd editor
npm install
npm start
```

Runs at `http://localhost:3002`.

### 2) (Optional) Run a static preview of the site

From repo root, use any static file server (example):

```bash
python3 -m http.server 8080
```

Then open:

- Static site: `http://localhost:8080`
- Editor UI: `http://localhost:3002/editor/index.html` (notes) and `http://localhost:3002/editor/gifs.html` (GIFs)

Local-only edit controls (pencil links) appear only on `localhost` / `127.0.0.1`.

## Notes subsystem

### Intent

Author in Markdown, publish as standalone HTML files, and keep `notes/index.html` regenerated automatically.

### Source of truth and generated files

- Source: `notes/<slug>.md`
- Generated output: `notes/<slug>.html`
- Listing page: `notes/index.html` (rebuilt on save/delete)

Markdown notes use frontmatter:

```md
---
title: Note title
date: Friday March 6th 2026
---

Body in markdown...
```

### Behavior and constraints

- Slugs are normalized to lowercase `a-z0-9-`.
- `POST /api/save` writes both `.md` and `.html`, then regenerates `notes/index.html`.
- If only an old `.html` note exists, `GET /api/note/:slug` backfills a matching `.md`.
- Sort order in `notes/index.html` is based on parsed `date`:
  - Best supported: `February 2026` or `Monday February 20th 2026`
  - Other formats may sort lexicographically.
- External links in note bodies are rendered with `target="_blank" rel="noopener"`.

## GIF subsystem

### Intent

Maintain an ordered, labeled GIF library in a committed JSON format that powers the public `gifs/index.html`.

### Data model (`gifs/data.json`)

```json
{
  "lists": [{ "id": "favs", "label": "favorites" }],
  "items": [
    {
      "url": "https://...",
      "alt": "optional alt",
      "title": "optional title pill",
      "listId": "favs"
    }
  ]
}
```

Key constraints:

- `lists` define row order and labels on the GIF page.
- `items` preserve order (used as rendered order).
- Favorites list (`listId: "favs"`) is capped at **10** items in editor/server logic.

### Runtime loading path (`gifs/index.html`)

1. On local preview, page tries `http://localhost:3002/api/gifs/data` (cross-origin allowed for localhost/127.0.0.1).
2. If that returns no items, falls back to static `gifs/data.json`.
3. If still empty, shows a hint: “No GIFs loaded. Check that data.json exists and is deployed.”

### Backward compatibility paths

- `GET /api/gifs/list` parses legacy `<img class="gif" ...>` from `gifs/index.html`.
- `GET /api/gifs/favorites` reads favorites from `data.json` first, else `favorites.json`.
- GIF editor load flow uses these legacy endpoints only if `/api/gifs/data` has no items.

## Local editor API (reference)

All endpoints are served by `editor/server.js`.

- `GET /api/note/:slug` — load note source (and backfill `.md` from `.html` if needed)
- `POST /api/save` — save note markdown/html and regenerate notes index
- `DELETE /api/note/:slug` — delete note files and regenerate notes index
- `GET /api/gifs/data` — read lists/items JSON (or derive from legacy files when absent)
- `POST /api/gifs/data` — persist lists/items JSON
- `GET /api/gifs/favorites` / `POST /api/gifs/favorites` — legacy favorites compatibility
- `GET /api/gifs/list` — legacy GIF extraction from `gifs/index.html`

## Troubleshooting

- **Pencil/edit links are missing**
  - They only render on `localhost` / `127.0.0.1`.
- **Save/load fails in editors**
  - Confirm editor server is running on port `3002`.
- **GIF page looks stale locally**
  - Restart editor server and hard-refresh; local page may be reading static `gifs/data.json` fallback.
- **Favorites over 10**
  - Move items out of `favs`; both UI and API enforce max 10.
- **Unexpected note ordering**
  - Normalize note dates to supported formats above.
