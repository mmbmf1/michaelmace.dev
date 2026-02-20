const express = require('express')
const path = require('path')
const fs = require('fs')
const { marked } = require('marked')
const hljs = require('highlight.js')

const app = express()
const EDITOR_DIR = __dirname
const NOTES_DIR = path.join(EDITOR_DIR, '..', 'notes')
const PORT = process.env.PORT || 3002

app.use(express.json({ limit: '1mb' }))

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

    <h1>${escapedTitle} <span id="edit-note-wrap" style="display:none"><a href="#" id="edit-note-link" class="local-edit" aria-label="Edit note" title="Edit">&#9998;</a></span></h1>
    <p><em>${date.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</em></p>

${bodyHtml}
    <script>
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        var slug = window.location.pathname.split('/').pop().replace(/\\.html$/, '');
        var a = document.getElementById('edit-note-link');
        if (a && slug) { a.href = '/editor/index.html?slug=' + encodeURIComponent(slug); document.getElementById('edit-note-wrap').style.display = ''; }
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

function extractBodyFromNoteHtml(html) {
  const dateClose = html.indexOf('</em></p>')
  if (dateClose === -1) return ''
  const start = dateClose + '</em></p>'.length
  const bodyEnd = html.indexOf('</body>', start)
  if (bodyEnd === -1) return ''
  const raw = html.slice(start, bodyEnd).trim()
  const withNewlines = raw
    .replace(/<\/p>\s*/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<hr\s*\/?>/gi, '\n---\n')
  const plain = withNewlines
    .replace(/<[^>]+>/g, ' ')
    .replace(/ +/g, ' ')
    .replace(/\n +/g, '\n')
    .replace(/ +\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return plain
}

function loadNoteFromHtml(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf-8')
  const { title, date } = extractTitleAndDate(htmlPath)
  const body = extractBodyFromNoteHtml(html)
  return { title, date, body }
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
        <a href="${e.slug}.html"> ${e.title} </a>
        <a href="/editor/index.html?slug=${e.slug}" class="local-edit" style="display:none" aria-label="Edit note" title="Edit">&#9998;</a>
        <br />
        <small>${e.date}</small>
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
    <span id="new-note-wrap" style="display:none"><a href="/editor/index.html" class="local-edit new-note-link" aria-label="New note" title="New note"> ( + add note )</a></span>
    </div>

    <ul class="notes-list">
${listItems}
    </ul>
    <script>
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        var w = document.getElementById('new-note-wrap'); if (w) w.style.display = 'inline';
        document.querySelectorAll('.local-edit').forEach(function (a) { a.style.display = 'inline'; });
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
  const htmlPath = path.join(NOTES_DIR, `${slug}.html`)
  let title, date, body
  if (fs.existsSync(mdPath)) {
    const content = fs.readFileSync(mdPath, 'utf-8')
    ;({ title, date, body } = parseNoteMd(content))
  } else if (fs.existsSync(htmlPath)) {
    ;({ title, date, body } = loadNoteFromHtml(htmlPath))
    const mdContent = `---
title: ${title}
date: ${date}
---

${body}
`
    fs.writeFileSync(mdPath, mdContent, 'utf-8')
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

  const mdContent = `---
title: ${title}
date: ${dateStr}
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
  fs.writeFileSync(htmlPath, noteShell(title, dateStr, bodyHtml), 'utf-8')

  regenerateIndex()

  res.json({ ok: true, slug })
})

app.use(express.static(REPO_ROOT))

app.listen(PORT, () => {
  console.log(`Site at http://localhost:${PORT}`)
  console.log(`Editor at http://localhost:${PORT}/editor/index.html`)
})
