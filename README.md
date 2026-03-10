# michaelmace.dev

Static personal site deployed to Vercel.

- **Home** - `index.html`
- **Notes** - Markdown-authored notes rendered to `notes/*.html`
- **Feed** - Static logbook rendered from `feed/data.json`
- **GIFs** - reaction library rendered from `gifs/data.json`
- **10k progress snapshot** - homepage widget reads `data/git-hours.json`

## Architecture at a glance

- Production is static HTML/CSS plus JSON (`gifs/data.json`).
- Feed entries are stored in `feed/data.json` and rendered client-side by `feed/index.html`.
- Git-hours progress is stored as a static snapshot in `data/git-hours.json` and rendered client-side on `index.html`.
- `editor/` is a local-only authoring app (`node editor/server.js`) and is excluded from deploys via `.vercelignore`.
- The editor serves:
  - HTML UIs at `/editor/index.html` (notes), `/editor/feed.html` (feed), and `/editor/gifs.html` (GIFs)
  - JSON APIs under `/api/*`
  - Static repo files from the repository root

## Local setup

```bash
cd editor
npm install
npm start
```

Then open:

- Site: `http://localhost:3002/`
- Notes editor: `http://localhost:3002/editor/index.html`
- Feed editor: `http://localhost:3002/editor/feed.html`
- GIF editor: `http://localhost:3002/editor/gifs.html`

## Notes workflow

Source files live in `notes/`:

- Canonical authored file: `notes/<slug>.md` (frontmatter: `title`, `date`)
- Generated file: `notes/<slug>.html`
- Generated listing: `notes/index.html` (regenerated on save/delete)

Behavior:

- Saving a note (`POST /api/save`) writes both `.md` and `.html`.
- Deleting a note (`DELETE /api/note/:slug`) removes `.md` and `.html`, then regenerates `notes/index.html`.
- If a note only has HTML, loading it (`GET /api/note/:slug`) backfills a matching `.md` file.

## GIF workflow (current system)

`gifs/data.json` is the single source of truth for GIF lists and items.

- `gifs/favorites.json` is no longer used.
- Data shape:
  - `lists[]`: `{ id, label }`
  - `items[]`: `{ url, alt, title, listId }`

Load order in `gifs/index.html`:

1. When running locally, try editor API (`http://localhost:3002/api/gifs/data`).
2. Fallback to static `gifs/data.json`.

Editor behavior (`editor/gifs.html`):

- Reordering controls (`up`/`down`) set display order.
- New lists can be added by name (ID is slugified in-browser).
- `favorites` (`listId: "favs"`) is capped at 10 items in the UI.
- Save writes `gifs/data.json` via `POST /api/gifs/data`.

## Feed workflow

`feed/data.json` is the single source of truth for feed entries.

- Public feed page (`feed/index.html`) is static and read-only.
- Local edits can be made in `editor/feed.html`.
- Save writes `feed/data.json` via `POST /api/feed/data`.
- Data shape centers on `items[]` and supports keys like:
  - `id`, `date`, `title`, `body_md`
  - `source_url`
  - `embed` (for example `{ "type": "youtube", "url": "..." }`)
  - `tags`
  - `related_links`

## Git-hours snapshot workflow

`data/git-hours.json` is a manually updated static artifact used by the homepage widget.

- Shape:
  - `hours` (number)
  - `progress_pct` (number)
  - `updated_at` (`YYYY-MM-DD`)
- `index.html` fetches this file and renders a small "10k progress" block.

## Local API reference

These endpoints are provided by `editor/server.js`:

- `GET /api/note/:slug`
  - Returns `{ title, slug, date, body }`
  - Slug must match `^[a-z0-9-]+$`
- `POST /api/save`
  - Body: `{ title, slug?, date?, body }`
  - Writes `notes/<slug>.md`, `notes/<slug>.html`, and regenerates `notes/index.html`
- `DELETE /api/note/:slug`
  - Deletes note files and regenerates `notes/index.html`
- `GET /api/gifs/data`
  - Returns `{ lists, items }` (defaults if file missing/invalid)
- `POST /api/gifs/data`
  - Body: `{ lists?, items }`
  - Persists `gifs/data.json`
- `GET /api/feed/data`
  - Returns `{ items }` from `feed/data.json` (or empty array if missing/invalid)
- `POST /api/feed/data`
  - Body: `{ items }`
  - Normalizes supported feed item fields and persists `feed/data.json`

## Troubleshooting and pitfalls

- **"Request failed ... port 3002" in editor UI**: start `editor/server.js` (`npm start` in `editor/`).
- **No local edit pencil on notes/GIF pages**: edit links only show on `localhost` / `127.0.0.1`.
- **Cross-port local setup (e.g. static page on 5173 + editor on 3002)**: API CORS allows only `http(s)://localhost` or `127.0.0.1`.
- **`Max 10 in favorites` when assigning list**: enforced client-side in GIF editor; move an existing favorite out first.
- **Empty GIF page in production**: ensure `gifs/data.json` is committed and valid JSON (this file is intentionally tracked in git).
