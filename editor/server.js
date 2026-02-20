const express = require("express");
const path = require("path");
const fs = require("fs");
const { marked } = require("marked");

const app = express();
const EDITOR_DIR = __dirname;
const NOTES_DIR = path.join(EDITOR_DIR, "..", "notes");
const PORT = process.env.PORT || 3001;

app.use(express.json({ limit: "1mb" }));

marked.setOptions({ gfm: true });

function slugFromTitle(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function addExternalLinkAttrs(html) {
  return html.replace(
    /<a href="(https?:\/\/[^"]*)"/g,
    '<a href="$1" target="_blank" rel="noopener"'
  );
}

function noteShell(title, date, bodyHtml) {
  const escapedTitle = title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapedTitle}</title>
    <link rel="stylesheet" href="../style.css" />
    <link rel="icon" href="/favicon.png" />
    <meta name="color-scheme" content="light dark" />
  </head>

  <body>
    <p><a href="../index.html">← Home</a></p>

    <h1>${escapedTitle}</h1>
    <p><em>${date.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</em></p>

${bodyHtml}
  </body>
</html>
`;
}

function extractTitleAndDate(htmlPath) {
  const html = fs.readFileSync(htmlPath, "utf-8");
  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  const dateMatch = html.match(/<p><em>([^<]*)<\/em><\/p>/);
  const title = titleMatch ? titleMatch[1].trim() : "";
  const date = dateMatch ? dateMatch[1].trim() : "";
  return { title, date };
}

function dateToSortKey(dateStr) {
  const months = {
    january: "01", february: "02", march: "03", april: "04", may: "05",
    june: "06", july: "07", august: "08", september: "09", october: "10",
    november: "11", december: "12"
  };
  const m = dateStr.match(/^(\w+)\s+(\d{4})$/i);
  if (!m) return dateStr;
  const month = months[m[1].toLowerCase()] || "00";
  return `${m[2]}-${month}`;
}

function regenerateIndex() {
  const files = fs.readdirSync(NOTES_DIR).filter((f) => f.endsWith(".html") && f !== "index.html");
  const entries = files.map((f) => {
    const htmlPath = path.join(NOTES_DIR, f);
    const { title, date } = extractTitleAndDate(htmlPath);
    const slug = f.replace(/\.html$/, "");
    return { slug, title, date };
  });
  entries.sort((a, b) => {
    const keyA = dateToSortKey(a.date);
    const keyB = dateToSortKey(b.date);
    return keyB.localeCompare(keyA);
  });

  const listItems = entries
    .map(
      (e) =>
        `      <li>
        <a href="${e.slug}.html"> ${e.title} </a>
        <br />
        <small>${e.date}</small>
      </li>`
    )
    .join("\n");

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
    <p><a href="../index.html">← Home</a></p>

    <h1>Notes</h1>

    <ul>
${listItems}
    </ul>
  </body>
</html>
`;
  fs.writeFileSync(path.join(NOTES_DIR, "index.html"), indexHtml, "utf-8");
}

const REPO_ROOT = path.join(EDITOR_DIR, "..");

app.get("/editor", (req, res) => {
  res.redirect("/editor/");
});

app.get("/editor/", (req, res) => {
  res.sendFile(path.join(EDITOR_DIR, "index.html"));
});

app.post("/api/save", (req, res) => {
  const { title, slug: slugParam, date, body } = req.body;
  if (!title || body === undefined) {
    return res.status(400).json({ error: "title and body required" });
  }
  const slug = (slugParam && slugParam.trim()) ? slugFromTitle(slugParam.trim()) : slugFromTitle(title);
  if (!slug) {
    return res.status(400).json({ error: "slug could not be derived from title" });
  }
  const dateStr = (date && date.trim()) ? date.trim() : "February 2026";

  const mdContent = `---
title: ${title}
date: ${dateStr}
---

${body}
`;
  const mdPath = path.join(NOTES_DIR, `${slug}.md`);
  fs.writeFileSync(mdPath, mdContent, "utf-8");

  const rawBodyHtml = addExternalLinkAttrs(marked.parse(body));
  const bodyHtml = rawBodyHtml.split("\n").map((line) => "    " + line).join("\n");
  const htmlPath = path.join(NOTES_DIR, `${slug}.html`);
  fs.writeFileSync(htmlPath, noteShell(title, dateStr, bodyHtml), "utf-8");

  regenerateIndex();

  res.json({ ok: true, slug });
});

app.use(express.static(REPO_ROOT));

app.listen(PORT, () => {
  console.log(`Site at http://localhost:${PORT}`);
  console.log(`Editor at http://localhost:${PORT}/editor/`);
});
