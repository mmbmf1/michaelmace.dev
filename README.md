# michaelmace.dev

Static personal site deployed to Vercel.

- **Home** - `index.html`
- **Notes** - Markdown-authored notes rendered to `notes/*.html`
- **Feed** - Static logbook rendered from `feed/data.json`
- **GIFs** - reaction library rendered from `gifs/data.json`
- **10k progress snapshot** - homepage widget reads `data/git-hours.json`

## Architecture at a glance

- Production is static HTML/CSS plus JSON artifacts (`feed/data.json`, `gifs/data.json`, `data/git-hours.json`).
- Feed entries are stored in `feed/data.json` and rendered client-side by `feed/index.html`.
- `index.html` reads `feed/data.json` for the recent-entry preview (first 3 items) and links each row to a feed anchor.
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
- Loading a note (`GET /api/note/:slug`) requires `notes/<slug>.md`; if the markdown source is missing, the API returns 404.

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
- If an item includes an external `embed.url` and no `source_url`, save uses the
  embed URL as `source_url` so attribution stays visible on the feed page.
- Feed render constraints:
  - `embed` rendering currently supports YouTube URLs only (`embed.type: "youtube"` with a parseable YouTube URL).
  - `body_md` uses a lightweight renderer (paragraphs, `-` lists, inline links/code/emphasis), not full CommonMark.
  - Item `id` values are normalized to lowercase `[a-z0-9._-]` for anchors/permalinks; homepage preview links use the same normalization.
- Data shape centers on `items[]` and supports keys like:
  - `id`, `date`, `title`, `body_md`
  - `source_url`
  - `embed` (for example `{ "type": "youtube", "url": "..." }`)
  - `image_url`
  - `tags`
  - `related_links`

## Git-hours snapshot workflow

`data/git-hours.json` is a manually updated static artifact used by the homepage widget.

- Shape:
  - `hours` (number)
  - `progress_pct` (number)
  - `updated_at` (`YYYY-MM-DD`)
  - `stats` (optional object) with any of:
    - `repositories_scanned`
    - `total_sessions`
    - `sessions_assigned_floor_duration`
    - `gap_threshold_minutes`
    - `floor_threshold_minutes`
- `index.html` fetches this file and renders a small "10k progress" block.
- Local helper script: `scripts/update-git-hours.js`
  - Accepts comma-formatted numbers from tracker output (for example `1,644.9`).
  - Parse tracker output from stdin and write the snapshot:
    - `git-hours-tracker | node scripts/update-git-hours.js`
  - Parse from a saved file:
    - `node scripts/update-git-hours.js --input /tmp/git-hours.txt`
  - Write to a custom file/date (useful for dry runs/backfills):
    - `node scripts/update-git-hours.js --input /tmp/git-hours.txt --output /tmp/git-hours.json --date 2026-03-12`
  - Preview parsed JSON without writing:
    - `node scripts/update-git-hours.js --input /tmp/git-hours.txt --stdout`

## Local API reference

These endpoints are provided by `editor/server.js`:

- `GET /api/note/:slug`
  - Returns `{ title, slug, date, body }`
  - Slug must match `^[a-z0-9-]+$`
  - Requires `notes/<slug>.md` to exist (no HTML-only fallback)
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
  - Auto-fills `source_url` from `embed.url` when `source_url` is omitted and embed URL is `http(s)`

## Troubleshooting and pitfalls

- **"Request failed ... port 3002" in editor UI**: start `editor/server.js` (`npm start` in `editor/`).
- **No local edit pencil on notes/GIF pages**: edit links only show on `localhost` / `127.0.0.1`.
- **Cross-port local setup (e.g. static page on 5173 + editor on 3002)**: API CORS allows only `http(s)://localhost` or `127.0.0.1`.
- **`Max 10 in favorites` when assigning list**: enforced client-side in GIF editor; move an existing favorite out first.
- **`Note not found` in editor for an existing `.html` note**: note APIs read `notes/<slug>.md`; re-create or re-save the markdown source.
- **Empty GIF page in production**: ensure `gifs/data.json` is committed and valid JSON (this file is intentionally tracked in git).
- **Feed embed does not render**: only YouTube URLs with a parseable video ID are embedded; other URLs are shown as source links only.
- **`Could not find required values` from `update-git-hours.js`**: input must include both `Total credited hours:` and `Progress toward 10,000 hours:`.
