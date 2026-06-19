#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const IMAGES_DIR = path.join(__dirname, '..', 'feed', 'images')
const MAX_WIDTH = 1600
const JPEG_QUALITY = 80
const PNG_QUALITY = 80
const SKIP_UNDER_BYTES = 500 * 1024

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp'])

async function optimizeFile(filePath) {
  const before = fs.statSync(filePath).size
  if (before < SKIP_UNDER_BYTES) {
    return { filePath, before, after: before, skipped: true }
  }

  const ext = path.extname(filePath).toLowerCase()
  if (!IMAGE_EXTENSIONS.has(ext)) {
    return { filePath, before, after: before, skipped: true }
  }

  const image = sharp(filePath, { failOn: 'none' })
  const metadata = await image.metadata()
  const needsResize =
    metadata.width != null && metadata.width > MAX_WIDTH

  let pipeline = sharp(filePath, { failOn: 'none' })
  if (needsResize) {
    pipeline = pipeline.resize({
      width: MAX_WIDTH,
      withoutEnlargement: true,
    })
  }

  if (ext === '.jpg' || ext === '.jpeg') {
    pipeline = pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
  } else if (ext === '.png') {
    pipeline = pipeline.png({ quality: PNG_QUALITY, compressionLevel: 9 })
  } else if (ext === '.webp') {
    pipeline = pipeline.webp({ quality: JPEG_QUALITY })
  }

  const optimized = await pipeline.toBuffer()
  if (optimized.length >= before) {
    return { filePath, before, after: before, skipped: true }
  }

  fs.writeFileSync(filePath, optimized)
  return { filePath, before, after: optimized.length, skipped: false }
}

async function main() {
  const entries = fs.readdirSync(IMAGES_DIR, { withFileTypes: true })
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(IMAGES_DIR, entry.name))
    .sort()

  let totalBefore = 0
  let totalAfter = 0
  let optimizedCount = 0

  for (const filePath of files) {
    const result = await optimizeFile(filePath)
    totalBefore += result.before
    totalAfter += result.after
    if (!result.skipped && result.after < result.before) {
      optimizedCount += 1
      const name = path.basename(filePath)
      const beforeMb = (result.before / (1024 * 1024)).toFixed(2)
      const afterKb = (result.after / 1024).toFixed(0)
      console.log(`${name}: ${beforeMb} MB -> ${afterKb} KB`)
    }
  }

  const savedMb = ((totalBefore - totalAfter) / (1024 * 1024)).toFixed(1)
  console.log(
    `\nOptimized ${optimizedCount} file(s). Total: ${(totalBefore / (1024 * 1024)).toFixed(1)} MB -> ${(totalAfter / (1024 * 1024)).toFixed(1)} MB (saved ${savedMb} MB)`
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
