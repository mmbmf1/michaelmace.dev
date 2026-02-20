# michaelmace.dev

Static personal site. Deploys to Vercel.

- **Home** — index
- **Notes** — short essays and updates (markdown → HTML)
- **Reaction Library** — gifs

## Notes and the local editor

Notes live in `notes/` as Markdown (`.md`) and generated HTML (`.html`). They are edited with a **local-only** web editor that is not deployed.

To run the editor:

```bash
cd editor && npm install && npm start
```

Open `http://localhost:3002/`, go to Notes, and use “New note” or the edit pencil on a note. Saving writes the `.md` and regenerates the `.html`. The editor is listed in `.vercelignore` so it never ships.
