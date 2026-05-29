#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const SITE_ORIGIN = 'https://www.michaelmace.dev'
const SITE_NAME = 'Michael Mace'
const DEFAULT_IMAGE = `${SITE_ORIGIN}/favicon.png`

const SEO_PAGES = [
  {
    file: 'index.html',
    title: 'Michael Mace',
    description:
      'Personal site of Michael Mace — full-stack developer in Blue Springs, MO. Feed, resume, and contact.',
    path: '/',
  },
  {
    file: 'feed/index.html',
    title: 'Feed',
    description:
      'Photo and video log from Michael Mace — trails, camping, and everyday moments.',
    path: '/feed/',
  },
  {
    file: 'contact/index.html',
    title: 'Contact',
    description:
      'Get in touch with Michael Mace — questions, ideas, favorite GIFs, or just saying hi.',
    path: '/contact/',
  },
  {
    file: 'resume/index.html',
    title: 'Resume',
    description:
      'Full-stack developer resume for Michael Mace — Next.js, PostgreSQL, Node.js, and enterprise web applications.',
    path: '/resume/',
  },
]

const SEO_REGEX =
  /\n    <meta name="viewport"[\s\S]*?<meta name="twitter:image"[^>]*>/

function escapeAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
}

function pageTitle(title) {
  if (/Michael Mace/i.test(title)) return title
  return `${title} — ${SITE_NAME}`
}

function buildSeoMeta({ title, description, path: pagePath, image = DEFAULT_IMAGE }) {
  const fullTitle = pageTitle(title)
  const url = `${SITE_ORIGIN}${pagePath.startsWith('/') ? pagePath : `/${pagePath}`}`

  return `    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${escapeAttr(description)}" />
    <meta name="author" content="${SITE_NAME}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${escapeAttr(url)}" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:title" content="${escapeAttr(fullTitle)}" />
    <meta property="og:description" content="${escapeAttr(description)}" />
    <meta property="og:url" content="${escapeAttr(url)}" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:image" content="${escapeAttr(image)}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeAttr(fullTitle)}" />
    <meta name="twitter:description" content="${escapeAttr(description)}" />
    <meta name="twitter:image" content="${escapeAttr(image)}" />`
}

function upsertSeoMeta(html, seoBlock) {
  if (SEO_REGEX.test(html)) {
    return html.replace(SEO_REGEX, `\n${seoBlock}`)
  }
  return html.replace(/(<title>[\s\S]*?<\/title>)/, `$1\n${seoBlock}`)
}

for (const page of SEO_PAGES) {
  const filePath = path.join(ROOT, page.file)
  const html = fs.readFileSync(filePath, 'utf-8')
  const next = upsertSeoMeta(html, buildSeoMeta(page))
  if (next === html) {
    console.log(`ok ${page.file}`)
    continue
  }
  fs.writeFileSync(filePath, next, 'utf-8')
  console.log(`updated ${page.file}`)
}
