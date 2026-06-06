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
  const escapedTitle = escapeHtml(title)
  const escapedDate = escapeHtml(date)
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapedTitle}</title>
    <script src="/theme.js"></script>
    <link rel="stylesheet" href="/style.css" />
    <link
      id="hljs-light"
      rel="stylesheet"
      href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/styles/github.min.css"
    />
    <link
      id="hljs-dark"
      rel="stylesheet"
      href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/styles/github-dark.min.css"
      disabled
    />
    <link rel="icon" href="/favicon.png" />
    <meta name="color-scheme" content="light dark" />
  </head>

  <body>
    <header class="page-header">
      <p class="nav-links">
        <a href="../index.html">Home</a> ·
        <a href="../feed/index.html">Feed</a>
        <span id="notes-nav-wrap" class="hidden"> · <a href="index.html" class="active">Notes</a></span>
        <span id="gifs-nav-wrap" class="hidden"> · <a href="../gifs/index.html">GIFs</a></span>
      </p>
      <a
        class="nav-contact"
        href="../contact/index.html"
        aria-label="Send me a message"
        title="Send me a message"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect width="20" height="16" x="2" y="4" rx="2" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
      </a>
      <a
        class="nav-linkedin"
        href="https://www.linkedin.com/in/michael-mace-kc"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="LinkedIn"
        title="LinkedIn"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
      </a>
      <a
        class="nav-github"
        href="https://github.com/mmbmf1"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="GitHub"
        title="GitHub"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
        </svg>
      </a>
      <a
        class="nav-resume"
        href="../resume/index.html"
        aria-label="Resume"
        title="Resume"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
          <path d="M14 2v4a2 2 0 0 0 2 2h4" />
          <path d="M10 9H8" />
          <path d="M16 13H8" />
          <path d="M16 17H8" />
        </svg>
      </a>

      <h1>
        ${escapedTitle}
        <span id="edit-note-wrap" class="hidden"
          ><a
            href="#"
            id="edit-note-link"
            class="local-edit"
            aria-label="Edit note"
            title="Edit"
            >&#9998;</a
          ></span
        >
      </h1>
    </header>

    <p><em>${escapedDate}</em></p>

${bodyHtml}
    <script>
      if (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1'
      ) {
        var notesNavWrap = document.getElementById('notes-nav-wrap')
        if (notesNavWrap) notesNavWrap.classList.remove('hidden')
        var gifsNavWrap = document.getElementById('gifs-nav-wrap')
        if (gifsNavWrap) gifsNavWrap.classList.remove('hidden')
        var slug = window.location.pathname
          .split('/')
          .pop()
          .replace(/\\.html$/, '')
        var a = document.getElementById('edit-note-link')
        if (a && slug) {
          a.href = '/notes/index.html?edit=' + encodeURIComponent(slug)
          document.getElementById('edit-note-wrap').classList.remove('hidden')
        }
      }
    </script>
  </body>
</html>
`
}

function markdownBodyToHtml(body) {
  const rawBodyHtml = addExternalLinkAttrs(marked.parse(body))
  return rawBodyHtml
    .split('\n')
    .map((line) => '    ' + line)
    .join('\n')
}

function writeNoteHtml(title, date, body, slug) {
  const htmlPath = path.join(NOTES_DIR, `${slug}.html`)
  fs.writeFileSync(
    htmlPath,
    noteShell(title, date, markdownBodyToHtml(body)),
    'utf-8'
  )
}

function regenerateNotesFromMarkdown(slugs) {
  const mdFiles = fs
    .readdirSync(NOTES_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''))
  const targets = slugs ? mdFiles.filter((s) => slugs.includes(s)) : mdFiles
  for (const slug of targets) {
    const mdPath = path.join(NOTES_DIR, `${slug}.md`)
    const { title, date, body } = parseNoteMd(fs.readFileSync(mdPath, 'utf-8'))
    writeNoteHtml(title, date, body, slug)
  }
  regenerateIndex()
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
  // "February 2026", "Tuesday May 19th 2026", "Friday February 20th, 2026"
  const normalized = dateStr
    .replace(/^(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\s+/i, '')
    .replace(/,/g, '')
    .trim()
  const m = normalized.match(/^(\w+)\s+(?:(\d+)\w*\s+)?(\d{4})$/i)
  if (!m) return '0000-00-00'
  const month = months[m[1].toLowerCase()] || '00'
  const day = m[2] ? String(m[2]).padStart(2, '0') : '01'
  return `${m[3]}-${month}-${day}`
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
        <button type="button" class="local-edit note-edit-btn hidden" data-slug="${escapeHtml(e.slug)}" aria-label="Edit note" title="Edit">&#9998;</button>
        <br />
        <small>${escapeHtml(e.date)}</small>
      </li>`
    )
    .join('\n')

  const indexPath = path.join(NOTES_DIR, 'index.html')
  let indexHtml = fs.readFileSync(indexPath, 'utf-8')
  indexHtml = indexHtml.replace(
    /<ul class="notes-list">[\s\S]*?<\/ul>/,
    `<ul class="notes-list">\n${listItems}\n    </ul>`
  )
  fs.writeFileSync(indexPath, indexHtml, 'utf-8')
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

  writeNoteHtml(safeTitle, safeDate, body, slug)

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

function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim())
}

function normalizeMediaFit(value) {
  const clean = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return clean === 'cover' || clean === 'contain' ? clean : ''
}

function normalizeMediaRatio(value) {
  if (typeof value !== 'string') return ''
  const match = value.trim().match(/^(\d{1,2})\s*[:/]\s*(\d{1,2})$/)
  if (!match) return ''
  const width = Number(match[1])
  const height = Number(match[2])
  if (!Number.isFinite(width) || !Number.isFinite(height)) return ''
  if (width <= 0 || height <= 0) return ''
  return `${width}:${height}`
}

function normalizeMediaMaxWidth(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value)
  }
  if (typeof value === 'string') {
    const parsed = Number(value.trim())
    if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed)
  }
  return null
}

function preferredSourceUrl(
  sourceUrlInput,
  embedType,
  embedUrl,
  imageUrl,
  imageUrls,
  videoUrl
) {
  if (sourceUrlInput) return sourceUrlInput
  if (embedType && isHttpUrl(embedUrl)) return embedUrl
  if (isHttpUrl(imageUrl)) return imageUrl
  if (Array.isArray(imageUrls)) {
    const firstExternal = imageUrls.find((url) => isHttpUrl(url))
    if (firstExternal) return firstExternal
  }
  if (isHttpUrl(videoUrl)) return videoUrl
  return ''
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
  const sourceUrlInput =
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
  const imageUrl =
    item && typeof item.image_url === 'string' ? item.image_url.replace(/\r?\n/g, '').trim() : ''
  const imageUrls = Array.isArray(item && item.image_urls)
    ? item.image_urls
        .map((url) =>
          typeof url === 'string' ? url.replace(/\r?\n/g, '').trim() : ''
        )
        .filter(Boolean)
    : []
  const videoUrl =
    item && typeof item.video_url === 'string' ? item.video_url.replace(/\r?\n/g, '').trim() : ''
  const mediaFit = normalizeMediaFit(item && item.media_fit)
  const mediaRatio = normalizeMediaRatio(item && item.media_ratio)
  const mediaMaxWidth = normalizeMediaMaxWidth(item && item.media_max_width)
  const sourceUrl = preferredSourceUrl(
    sourceUrlInput,
    embedType,
    embedUrl,
    imageUrl,
    imageUrls,
    videoUrl
  )

  const normalized = {
    id,
    date,
  }
  if (title) normalized.title = title
  if (bodyMd) normalized.body_md = bodyMd
  if (sourceUrl) normalized.source_url = sourceUrl
  if (embedType && embedUrl) normalized.embed = { type: embedType, url: embedUrl }
  if (imageUrl) normalized.image_url = imageUrl
  if (imageUrls.length > 0) normalized.image_urls = imageUrls
  if (videoUrl) normalized.video_url = videoUrl
  if (mediaFit) normalized.media_fit = mediaFit
  if (mediaRatio) normalized.media_ratio = mediaRatio
  if (mediaMaxWidth != null) normalized.media_max_width = mediaMaxWidth
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
    .filter((item) => item.id)
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

const contactHandler = require('../lib/contact')
app.post('/api/contact', contactHandler)

app.use(express.static(REPO_ROOT))

if (process.argv.includes('--regenerate-notes')) {
  const slugArgs = process.argv
    .slice(2)
    .filter((a) => a !== '--regenerate-notes')
  regenerateNotesFromMarkdown(slugArgs.length ? slugArgs : null)
  console.log(
    slugArgs.length
      ? `Regenerated: ${slugArgs.join(', ')}`
      : `Regenerated ${fs.readdirSync(NOTES_DIR).filter((f) => f.endsWith('.md')).length} notes`
  )
} else {
  app.listen(PORT, () => {
    console.log(`Site at http://localhost:${PORT}`)
    console.log(`Editor at http://localhost:${PORT}/editor/index.html`)
  })
}
