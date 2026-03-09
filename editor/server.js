const express = require('express')
const path = require('path')
const fs = require('fs')
const { marked } = require('marked')
const hljs = require('highlight.js')

const app = express()
const EDITOR_DIR = __dirname
const NOTES_DIR = path.join(EDITOR_DIR, '..', 'notes')
const GIFS_DIR = path.join(EDITOR_DIR, '..', 'gifs')
const GIFS_DATA_PATH = path.join(GIFS_DIR, 'data.json')
const FEED_DIR = path.join(EDITOR_DIR, '..', 'feed')
const FEED_DATA_PATH = path.join(FEED_DIR, 'data.json')
const PORT = process.env.PORT || 3002

app.use(express.json({ limit: '1mb' }))

// Allow gifs page (e.g. from bun dev on another port) to fetch editor APIs
app.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

marked.setOptions({ gfm: true })

marked.use({
  renderer: {
    code({ text, lang }) {
      const language = (lang || 'plaintext').trim().toLowerCase()
      try {
        const highlighted = hljs.highlight(text, {
          language: language === 'plaintext' ? undefined : language,
        }).value
        return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>\n`
      } catch {
        const escaped = text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
        return `<pre><code>${escaped}</code></pre>\n`
      }
    },
  },
})

function slugFromTitle(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

function escapeHtml(s) {
  if (typeof s !== 'string') return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function addExternalLinkAttrs(html) {
  return html.replace(
    /<a href="(https?:\/\/[^"]*)"/g,
    '<a href="$1" target="_blank" rel="noopener"'
  )
}

function noteShell(title, date, bodyHtml) {
  const escapedTitle = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapedTitle}</title>
    <link rel="stylesheet" href="../style.css" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/styles/github.min.css" media="(prefers-color-scheme: light)" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/styles/github-dark.min.css" media="(prefers-color-scheme: dark)" />
    <link rel="icon" href="/favicon.png" />
    <meta name="color-scheme" content="light dark" />
  </head>

  <body>
    <p class="nav-links"><a href="../index.html">Home</a> · <a href="index.html">Notes</a> · <a href="../gifs/index.html">Reaction Library</a></p>

    <h1>${escapedTitle} <span id="edit-note-wrap" class="hidden"><a href="#" id="edit-note-link" class="local-edit" aria-label="Edit note" title="Edit">&#9998;</a></span></h1>
    <p><em>${date.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</em></p>

${bodyHtml}
    <script>
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        var slug = window.location.pathname.split('/').pop().replace(/\\.html$/, '');
        var a = document.getElementById('edit-note-link');
        if (a && slug) { a.href = '/editor/index.html?slug=' + encodeURIComponent(slug); document.getElementById('edit-note-wrap').classList.remove('hidden'); }
      }
    </script>
  </body>
</html>
`
}

function extractTitleAndDate(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf-8')
  const titleMatch = html.match(/<title>([^<]*)<\/title>/i)
  const dateMatch = html.match(/<p><em>([^<]*)<\/em><\/p>/)
  const title = titleMatch ? titleMatch[1].trim() : ''
  const date = dateMatch ? dateMatch[1].trim() : ''
  return { title, date }
}

function dateToSortKey(dateStr) {
  const months = {
    january: '01',
    february: '02',
    march: '03',
    april: '04',
    may: '05',
    june: '06',
    july: '07',
    august: '08',
    september: '09',
    october: '10',
    november: '11',
    december: '12',
  }
  // "February 2026" or "Monday February 20th 2026"
  const m = dateStr.match(/^(?:\w+\s+)?(\w+)\s+(?:\d+\w*\s+)?(\d{4})$/i)
  if (!m) return dateStr
  const month = months[m[1].toLowerCase()] || '00'
  return `${m[2]}-${month}`
}

function regenerateIndex() {
  const files = fs
    .readdirSync(NOTES_DIR)
    .filter((f) => f.endsWith('.html') && f !== 'index.html')
  const entries = files.map((f) => {
    const htmlPath = path.join(NOTES_DIR, f)
    const { title, date } = extractTitleAndDate(htmlPath)
    const slug = f.replace(/\.html$/, '')
    return { slug, title, date }
  })
  entries.sort((a, b) => {
    const keyA = dateToSortKey(a.date)
    const keyB = dateToSortKey(b.date)
    return keyB.localeCompare(keyA)
  })

  const listItems = entries
    .map(
      (e) =>
        `      <li>
        <a href="${e.slug}.html"> ${escapeHtml(e.title)} </a>
        <a href="/editor/index.html?slug=${e.slug}" class="local-edit hidden" aria-label="Edit note" title="Edit">&#9998;</a>
        <br />
        <small>${escapeHtml(e.date)}</small>
      </li>`
    )
    .join('\n')

  const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Notes — Michael Mace</title>
    <link rel="stylesheet" href="../style.css" />
    <link rel="icon" href="/favicon.png" />
    <meta name="color-scheme" content="light dark" />
  </head>

  <body>
    <p class="nav-links"><a href="../index.html">Home</a> · <a href="index.html">Notes</a> · <a href="../gifs/index.html">Reaction Library</a></p>

    <div class="notes-header">
    <h1>Notes</h1>
    <span id="new-note-wrap" class="hidden"><a href="/editor/index.html" class="local-edit new-note-link" aria-label="New note" title="New note"> ( + add note )</a></span>
    </div>

    <ul class="notes-list">
${listItems}
    </ul>
    <script>
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        var w = document.getElementById('new-note-wrap'); if (w) w.classList.remove('hidden');
        document.querySelectorAll('.local-edit').forEach(function (a) { a.classList.remove('hidden'); });
      }
    </script>
  </body>
</html>
`
  fs.writeFileSync(path.join(NOTES_DIR, 'index.html'), indexHtml, 'utf-8')
}

const REPO_ROOT = path.join(EDITOR_DIR, '..')

function parseNoteMd(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) return { title: '', date: 'February 2026', body: content.trim() }
  const front = match[1]
  const body = match[2].trim()
  let title = ''
  let date = 'February 2026'
  for (const line of front.split(/\r?\n/)) {
    const t = line.match(/^title:\s*(.+)$/i)
    const d = line.match(/^date:\s*(.+)$/i)
    if (t) title = t[1].trim()
    if (d) date = d[1].trim()
  }
  return { title, date, body }
}

app.get('/editor', (req, res) => {
  res.redirect('/editor/')
})

app.get('/editor/', (req, res) => {
  res.sendFile(path.join(EDITOR_DIR, 'index.html'))
})

app.get('/api/note/:slug', (req, res) => {
  const slug = req.params.slug
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return res.status(400).json({ error: 'invalid slug' })
  }
  const mdPath = path.join(NOTES_DIR, `${slug}.md`)
  let title, date, body
  if (fs.existsSync(mdPath)) {
    const content = fs.readFileSync(mdPath, 'utf-8')
    ;({ title, date, body } = parseNoteMd(content))
  } else {
    return res.status(404).json({ error: 'note not found' })
  }
  res.json({ title, slug, date, body })
})

app.delete('/api/note/:slug', (req, res) => {
  const slug = req.params.slug
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return res.status(400).json({ error: 'invalid slug' })
  }
  const mdPath = path.join(NOTES_DIR, `${slug}.md`)
  const htmlPath = path.join(NOTES_DIR, `${slug}.html`)
  const hasMd = fs.existsSync(mdPath)
  const hasHtml = fs.existsSync(htmlPath)
  if (!hasMd && !hasHtml) {
    return res.status(404).json({ error: 'note not found' })
  }
  if (hasMd) fs.unlinkSync(mdPath)
  if (hasHtml) fs.unlinkSync(htmlPath)
  regenerateIndex()
  res.json({ ok: true })
})

app.post('/api/save', (req, res) => {
  const { title, slug: slugParam, date, body } = req.body
  if (!title || body === undefined) {
    return res.status(400).json({ error: 'title and body required' })
  }
  const slug =
    slugParam && slugParam.trim()
      ? slugFromTitle(slugParam.trim())
      : slugFromTitle(title)
  if (!slug) {
    return res
      .status(400)
      .json({ error: 'slug could not be derived from title' })
  }
  const dateStr = date && date.trim() ? date.trim() : 'February 2026'
  const safeTitle = String(title).replace(/\r?\n/g, ' ').trim()
  const safeDate = String(dateStr).replace(/\r?\n/g, ' ').trim()

  const mdContent = `---
title: ${safeTitle}
date: ${safeDate}
---

${body}
`
  const mdPath = path.join(NOTES_DIR, `${slug}.md`)
  fs.writeFileSync(mdPath, mdContent, 'utf-8')

  const rawBodyHtml = addExternalLinkAttrs(marked.parse(body))
  const bodyHtml = rawBodyHtml
    .split('\n')
    .map((line) => '    ' + line)
    .join('\n')
  const htmlPath = path.join(NOTES_DIR, `${slug}.html`)
  fs.writeFileSync(htmlPath, noteShell(safeTitle, safeDate, bodyHtml), 'utf-8')

  regenerateIndex()

  res.json({ ok: true, slug })
})

const DEFAULT_LISTS = [
  { id: 'favs', label: 'favorites' },
  { id: 'others', label: 'these are good too' },
]

function normalizeItemToListId(item) {
  if (item && typeof item.listId === 'string' && item.listId.trim()) {
    return item.listId.trim()
  }
  return 'others'
}

function normalizeItems(items) {
  return (Array.isArray(items) ? items : []).map((o) => ({
    url: o && typeof o.url === 'string' ? o.url.trim() : '',
    alt: typeof (o && o.alt) === 'string' ? o.alt : '',
    title: typeof (o && o.title) === 'string' ? o.title : '',
    listId: normalizeItemToListId(o),
  }))
}

function normalizeFeedItem(item, index) {
  const date =
    item && typeof item.date === 'string' ? item.date.replace(/\r?\n/g, ' ').trim() : ''
  const idInput =
    item && typeof item.id === 'string' ? item.id.replace(/\r?\n/g, ' ').trim() : ''
  const fallbackIdBase = date || 'feed-item'
  const fallbackId = `${fallbackIdBase}-${index + 1}`
  const id = idInput || fallbackId
  const title =
    item && typeof item.title === 'string'
      ? item.title.replace(/\r?\n/g, ' ').trim()
      : ''
  const bodyMd =
    item && typeof item.body_md === 'string' ? item.body_md.replace(/\r/g, '') : ''
  const sourceUrl =
    item && typeof item.source_url === 'string' ? item.source_url.trim() : ''
  const embedType =
    item &&
    item.embed &&
    typeof item.embed === 'object' &&
    typeof item.embed.type === 'string'
      ? item.embed.type.trim()
      : ''
  const embedUrl =
    item &&
    item.embed &&
    typeof item.embed === 'object' &&
    typeof item.embed.url === 'string'
      ? item.embed.url.trim()
      : ''
  const tags = Array.isArray(item && item.tags)
    ? item.tags.map((tag) => String(tag || '').trim()).filter(Boolean)
    : []
  const relatedLinks = Array.isArray(item && item.related_links)
    ? item.related_links
        .map((link) => {
          const url =
            link && typeof link.url === 'string' ? link.url.replace(/\r?\n/g, '').trim() : ''
          if (!url) return null
          const label =
            link && typeof link.label === 'string'
              ? link.label.replace(/\r?\n/g, ' ').trim()
              : ''
          return label ? { label, url } : { url }
        })
        .filter(Boolean)
    : []

  const normalized = {
    id,
    date,
  }
  if (title) normalized.title = title
  if (bodyMd) normalized.body_md = bodyMd
  if (sourceUrl) normalized.source_url = sourceUrl
  if (embedType && embedUrl) normalized.embed = { type: embedType, url: embedUrl }
  if (tags.length > 0) normalized.tags = tags
  if (relatedLinks.length > 0) normalized.related_links = relatedLinks
  return normalized
}

app.get('/api/gifs/data', (req, res) => {
  let lists = DEFAULT_LISTS.slice()
  let items = []
  try {
    if (fs.existsSync(GIFS_DATA_PATH)) {
      const raw = fs.readFileSync(GIFS_DATA_PATH, 'utf-8')
      const data = JSON.parse(raw)
      if (Array.isArray(data.lists) && data.lists.length > 0) {
        lists = data.lists.filter((l) => l && l.id && l.label)
      }
      items = normalizeItems(Array.isArray(data.items) ? data.items : [])
    }
  } catch (_) {}
  res.json({ lists, items })
})

app.post('/api/gifs/data', (req, res) => {
  const body = req.body
  const rawItems = body && body.items
  if (!Array.isArray(rawItems)) {
    return res.status(400).json({ error: 'items array required' })
  }
  let lists = DEFAULT_LISTS.slice()
  if (Array.isArray(body.lists) && body.lists.length > 0) {
    const parsed = body.lists
      .filter((l) => l != null)
      .map((l) => ({ id: String(l.id ?? '').trim(), label: String(l.label ?? '').trim() }))
      .filter((l) => l.id && l.label)
    if (parsed.length > 0) lists = parsed
  }
  const items = rawItems
    .filter((o) => o && typeof o.url === 'string' && o.url.trim())
    .map((o) => ({
      url: o.url.trim(),
      alt: typeof o.alt === 'string' ? o.alt : '',
      title: typeof o.title === 'string' ? o.title : '',
      listId: normalizeItemToListId(o),
    }))
  try {
    if (!fs.existsSync(GIFS_DIR)) {
      fs.mkdirSync(GIFS_DIR, { recursive: true })
    }
    fs.writeFileSync(GIFS_DATA_PATH, JSON.stringify({ lists, items }, null, 2), 'utf-8')
  } catch (err) {
    return res.status(500).json({ error: 'failed to write data', detail: err.message })
  }
  res.json({ ok: true })
})

app.get('/api/feed/data', (req, res) => {
  let items = []
  try {
    if (fs.existsSync(FEED_DATA_PATH)) {
      const raw = fs.readFileSync(FEED_DATA_PATH, 'utf-8')
      const data = JSON.parse(raw)
      if (Array.isArray(data.items)) {
        items = data.items.map(normalizeFeedItem)
      }
    }
  } catch (_) {}
  res.json({ items })
})

app.post('/api/feed/data', (req, res) => {
  const body = req.body
  const rawItems = body && body.items
  if (!Array.isArray(rawItems)) {
    return res.status(400).json({ error: 'items array required' })
  }
  const items = rawItems
    .map(normalizeFeedItem)
    .filter(
      (item) =>
        item.title ||
        item.body_md ||
        item.source_url ||
        (item.embed && item.embed.url) ||
        (Array.isArray(item.tags) && item.tags.length > 0) ||
        (Array.isArray(item.related_links) && item.related_links.length > 0)
    )
  try {
    if (!fs.existsSync(FEED_DIR)) {
      fs.mkdirSync(FEED_DIR, { recursive: true })
    }
    fs.writeFileSync(FEED_DATA_PATH, JSON.stringify({ items }, null, 2), 'utf-8')
  } catch (err) {
    return res.status(500).json({ error: 'failed to write data', detail: err.message })
  }
  res.json({ ok: true, count: items.length })
})

app.use(express.static(REPO_ROOT))

app.listen(PORT, () => {
  console.log(`Site at http://localhost:${PORT}`)
  console.log(`Editor at http://localhost:${PORT}/editor/index.html`)
})
