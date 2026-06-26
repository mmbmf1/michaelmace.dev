# michaelmace.dev

Static personal site deployed to Vercel.

- **Home** - `index.html` (deployed)
- **Notes** - Markdown-authored notes rendered to `notes/*.html` (local-only; not deployed)
- **Feed** - Static logbook rendered from `feed/data.json` (deployed)
- **GIFs** - reaction library rendered from `gifs/data.json` (local-only; not deployed)
- **Contact** - form at `contact/index.html`, sends mail via Resend (`api/contact.js`) (deployed)
- **Resume** - print-friendly page at `resume/index.html` (deployed)
- **10k progress snapshot** - homepage widget reads `data/git-hours.json`

## Architecture at a glance

- Production deploys `/`, `/feed/`, `/contact/`, `/resume/`, plus static assets and `feed/data.json`. Notes and GIFs are authored locally and excluded from Vercel via `.vercelignore`.
- Feed entries are stored in `feed/data.json` and rendered client-side by `feed/index.html`.
- `index.html` reads `feed/data.json` for the recent-entry preview (first 3 items) and links each row to a feed anchor.
- Git-hours progress is stored as a static snapshot in `data/git-hours.json` and rendered client-side on `index.html`.
- Home page preview cards read the first three entries from `feed/data.json` and link to `/feed/#<item-id>`.
- `editor/`, `notes/`, and `gifs/` are local-only and excluded from deploys via `.vercelignore`. Use `node editor/server.js` to author and preview them at `http://localhost:3002/`.
- The editor serves:
  - HTML UIs at `/editor/index.html` (notes), `/editor/feed.html` (feed), and `/editor/gifs.html` (GIFs)
  - JSON APIs under `/api/*`
  - Static repo files from the repository root

## Contact form

Public page: `contact/index.html`. Submissions `POST` to `api/contact.js`, which sends email through [Resend](https://resend.com).

**Environment variables** (never commit `.env`):

| Variable | Required | Default |
|----------|----------|---------|
| `RESEND_API_KEY` | yes | — |
| `CONTACT_FROM_EMAIL` | no | `michaelmace.dev <contact@michaelmace.dev>` |
| `CONTACT_TO_EMAIL` | no | `contact@michaelmace.dev` |

Create a repo-root `.env` (gitignored), for example:

```bash
RESEND_API_KEY=re_...
# optional — defaults match contact@michaelmace.dev
# CONTACT_FROM_EMAIL=michaelmace.dev <contact@michaelmace.dev>
# CONTACT_TO_EMAIL=contact@michaelmace.dev
```

Until `michaelmace.dev` is verified in Resend, set `CONTACT_FROM_EMAIL=michaelmace.dev <onboarding@resend.dev>` in `.env` and in Vercel.

**Local testing:** with the editor running (`npm start` in `editor/`), open `http://localhost:3002/contact/` — the editor server serves `/api/contact` and loads `.env` from the repo root. Alternatively, `vercel dev` from the repo root also works.

Add the same env vars in **Vercel → Settings → Environment Variables** before testing production.

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
- Loading a note (`GET /api/note/:slug`) reads `notes/<slug>.md`; if the markdown file is missing, the API returns `404`. The editor does not load notes that have only `.html` (no `.md`).

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

- Reordering controls (`up`/`down`) set display order and save immediately.
- New lists can be added by name (ID is slugified in-browser).
- `favorites` (`listId: "favs"`) is capped at 10 items in the UI.
- Add/edit/remove/reorder in the GIF editor save immediately to `gifs/data.json` via `POST /api/gifs/data`.
- Save removes any item without a non-empty `url` and persists only `{ url, alt, title, listId }` (extra item fields are dropped).
- List order in `lists[]` controls section order on `gifs/index.html`.

## Feed workflow

`feed/data.json` is the single source of truth for feed entries.

- `feed/schema.json` documents the expected feed item shape.
- Public feed page (`feed/index.html`) is static and read-only.
- Local edits can be made in `editor/feed.html`.
- Feed editor shows a scrollable list of entries with **Add entry** and **Edit** modals
  (same form fields for both). Each row shows date, title, tags, and an edited date
  when an entry has been changed.
- Add/edit/delete in the feed editor save immediately to `feed/data.json` via `POST /api/feed/data`.
- Save validates item IDs/dates, safe URLs, duplicate IDs, and common attribution mistakes.
- `body_md` supports lightweight markdown for paragraphs, headings, blockquotes,
  unordered/ordered lists, links, inline code, and fenced code blocks.
- If an item has no `source_url`, save falls back to an external `embed.url` or
  external `image_url` so attribution stays visible on the feed page.
- Feed page only auto-renders embeds for YouTube-style URLs; other URLs are shown as source links.
- **Prefer YouTube for video** — upload clips as unlisted YouTube videos and set `embed: { "type": "youtube", "url": "..." }` (or a YouTube `source_url`). Avoid committing large `.mp4` files under `feed/images/`; they count against Vercel Fast Data Transfer.
- Optional `image_url` renders an image block in feed cards (commonly committed under `feed/images/`).
- Optional `video_url` renders an inline HTML5 video when present (legacy; prefer YouTube `embed` for new entries).
- Feed rendering order is reverse-chronological by `date` (newest first); entries
  with the same date keep their JSON order.
- Data shape centers on `items[]` and supports keys like:
  - `id`, `date`, `title`, `body_md`
  - `source_url`
  - `embed` (for example `{ "type": "youtube", "url": "..." }`)
  - `image_url`
- `video_url`
  - `tags`
  - `related_links`
  - `image_url`
- Save normalizes entries and drops unsupported fields:
  - missing `id` becomes `<date-or-feed-item>-<index>`
  - empty optional fields are omitted from the written JSON
  - `related_links[]` keeps only entries with a non-empty `url`

Renderer behavior (`feed/index.html`):

- `body_md` supports a small Markdown subset (paragraphs, `-` lists, inline code, `*italic*`, `**bold**`, links).
- Only YouTube URLs are rendered as embeds (from `embed.url` when `embed.type === "youtube"`, otherwise from `source_url`).
- `image_url` is rendered as an image block when present.
- `video_url` is rendered as an inline HTML5 video when present (lazy-loaded, no autoplay; prefer YouTube `embed` for new video entries).
- Items are rendered reverse-chronologically by `date`; undated/unparseable dates fall to the end.
- The feed UI groups consecutive entries by day and shows a small per-day entry count.
- Feed tags are clickable and can filter the page via `?tag=<tag-slug>`.
- Links are restricted to `http(s)`, root-relative (`/foo`), or relative (`./foo`, `../foo`) URLs.

Example item:

```json
{
  "id": "2026-03-13-entry-7",
  "date": "2026-03-13",
  "title": "trail thot",
  "body_md": "- first point\n- second point\n\n[reaction vocabulary](/gifs/index.html)",
  "image_url": "/feed/images/landahl_whistle_pig_20260312.jpg",
  "embed": { "type": "youtube", "url": "https://youtu.be/x36UmiSiEzc" },
  "source_url": "https://youtu.be/x36UmiSiEzc",
  "tags": ["trails", "wildlife"],
  "related_links": [{ "label": "note: on layering intelligence", "url": "/notes/on-layering-intel.html" }]
}
```

Feed rendering constraints (`feed/index.html`):

- `body_md` supports a compact markdown subset:
  - paragraphs split by blank lines
  - unordered lists only when each line starts with `- `
  - inline `code`, `*italic*`, `**bold**`, and `[label](url)` links
- Link URLs are rendered only if they are `http(s)://`, `/...`, `./...`, or `../...`.
- `embed.type: "youtube"` supports `youtu.be`, `youtube.com/watch`, `/shorts/`, and `/embed/` URLs.
- `image_url` must also pass the same safe URL check (`http(s)://`, `/`, `./`, `../`).
- Entry anchors/permalinks are generated from `id` after lowercasing and replacing unsupported characters.

## Feed images and bandwidth

Large photos and videos in `feed/images/` are served from Vercel's CDN and count toward Fast Data Transfer on the Hobby plan.

- **Video:** upload to YouTube as unlisted, then reference via `embed` (preferred when the entry also has images) or `source_url`.
- **Photos:** run `npm run optimize-feed-images` before committing new or oversized JPEGs/PNGs (resizes to max 1600px wide, skips files already under ~500 KB).
- **Caching:** [`vercel.json`](vercel.json) sets long-lived `Cache-Control` on `/feed/images/*` after images are optimized.
- **Usage alerts:** in the Vercel dashboard, go to **Settings → Notifications** and enable warnings at 75% and 100% of Fast Data Transfer.

## SEO and domains

Production pages (`/`, `/feed/`, `/contact/`, `/resume/`) ship canonical URLs, Open Graph tags, and `robots: index, follow` via [`scripts/apply-seo-meta.js`](scripts/apply-seo-meta.js). `feed/data.json` is served with `X-Robots-Tag: noindex` (see [`vercel.json`](vercel.json)).

**Canonical host:** `https://www.michaelmace.dev`. In **Vercel → Project → Settings → Domains**, set `www.michaelmace.dev` as the primary domain and ensure `michaelmace.dev` redirects to it with a **permanent (308)** redirect. After changing domain settings, verify:

```bash
curl -sI http://michaelmace.dev/ | grep -iE '^(HTTP|location:)'
curl -sI https://michaelmace.dev/ | grep -iE '^(HTTP|location:)'
curl -sI https://www.michaelmace.dev/feed/data.json | grep -i x-robots
curl -sI https://www.michaelmace.dev/notes/ | head -1   # expect 404 after deploy
```

[`vercel.json`](vercel.json) also 308-redirects `index.html` paths to trailing-slash clean URLs (e.g. `/feed/index.html` → `/feed/`).

## Git-hours snapshot workflow

`data/git-hours.json` is a manually updated static artifact used by the homepage widget.

- Shape:
  - `hours` (number)
  - `progress_pct` (number)
  - `updated_at` (`YYYY-MM-DD`)
  - optional `stats` object (e.g. `repositories_scanned`, `total_sessions`, `sessions_assigned_floor_duration`, `gap_threshold_minutes`, `floor_threshold_minutes`)
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
  - Reads `notes/<slug>.md`; returns `404` when the markdown source file does not exist
- `POST /api/save`
  - Body: `{ title, slug?, date?, body }`
  - `slug` is normalized to lowercase `a-z0-9-`
  - Writes `notes/<slug>.md`, `notes/<slug>.html`, and regenerates `notes/index.html`
- `DELETE /api/note/:slug`
  - Deletes note files and regenerates `notes/index.html`
- `GET /api/gifs/data`
  - Returns `{ lists, items }` (defaults if file missing/invalid)
- `POST /api/gifs/data`
  - Body: `{ lists?, items }`
  - Persists `gifs/data.json` (items without URL are dropped)
- `GET /api/feed/data`
  - Returns `{ items }` from `feed/data.json` (or empty array if missing/invalid)
  - Items are normalized on read (fallback IDs, trimmed strings, cleaned links/tags)
- `POST /api/feed/data`
  - Body: `{ items }`
  - Normalizes supported feed item fields and persists `feed/data.json`
  - If `id` is omitted, a fallback ID is generated from date/index
  - If `source_url` is omitted and `embed.url` (or external `image_url`) is present, `source_url` is backfilled

## Troubleshooting and pitfalls

- **"Request failed ... port 3002" in editor UI**: start `editor/server.js` (`npm start` in `editor/`).
- **No local edit pencil on notes/GIF pages**: edit links only show on `localhost` / `127.0.0.1`.
- **Cross-port local setup (e.g. static page on 5173 + editor on 3002)**: API CORS allows only `http(s)://localhost` or `127.0.0.1`, and only `GET`/`POST`/`OPTIONS`.
- **`Max 10 in favorites` when assigning list**: enforced client-side in GIF editor; move an existing favorite out first.
- **`Note not found` in editor for an existing `.html` note**: note APIs read `notes/<slug>.md`; re-create or re-save the markdown source.
- **Empty GIF page in production**: ensure `gifs/data.json` is committed and valid JSON (this file is intentionally tracked in git).
- **Feed formatting looks limited**: `feed/index.html` intentionally supports a narrow Markdown subset instead of full Markdown.
- **Feed embed does not render**: only YouTube URLs with a parseable video ID are embedded; other URLs are shown as source links only.
- **`Could not find required values` from `update-git-hours.js`**: input must include both `Total credited hours:` and `Progress toward 10,000 hours:`.
- **Feed links render as plain text or are not clickable**: only `http(s)` and root/relative paths are treated as safe links in `feed/index.html`.
- **Feed image does not render**: verify `image_url` uses a safe path (for example `/feed/images/<file>`) and that the file exists in `feed/images/`.
- **YouTube embed not rendering**: use a parseable YouTube URL (`youtu.be`, `youtube.com/watch`, `/shorts/`, or `/embed/`).
