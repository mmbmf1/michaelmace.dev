const fs = require('fs')
const path = require('path')

const RESEND_API_URL = 'https://api.resend.com/emails'
const DEFAULT_FROM = 'michaelmace.dev <contact@michaelmace.dev>'
const DEFAULT_TO = 'contact@michaelmace.dev'

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

loadEnvFile(path.join(__dirname, '..', '.env'))

module.exports = async function contactHandler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('RESEND_API_KEY is not configured')
    return res
      .status(500)
      .json({ error: 'Could not send message. Please try again later.' })
  }

  let body
  try {
    body =
      typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}
  } catch {
    return res.status(400).json({ error: 'Invalid request.' })
  }

  const website = typeof body.website === 'string' ? body.website.trim() : ''
  if (website) {
    return res.status(400).json({ error: 'Invalid request.' })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''

  if (!name || name.length > 100) {
    return res
      .status(400)
      .json({ error: 'Please enter your name (100 characters max).' })
  }
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' })
  }
  if (!message || message.length > 5000) {
    return res
      .status(400)
      .json({ error: 'Please enter a message (5000 characters max).' })
  }

  const from = process.env.CONTACT_FROM_EMAIL || DEFAULT_FROM
  const to = process.env.CONTACT_TO_EMAIL || DEFAULT_TO
  const subject = `[michaelmace.dev] Contact from ${name}`
  const text = [
    'New message from the contact form at https://michaelmace.dev/contact/',
    '',
    `Name: ${name}`,
    `Email: ${email}`,
    '',
    message,
  ].join('\n')

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: email,
        subject,
        text,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Resend API error:', response.status, errText)
      return res
        .status(500)
        .json({ error: 'Could not send message. Please try again later.' })
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('Contact send failed:', err)
    return res
      .status(500)
      .json({ error: 'Could not send message. Please try again later.' })
  }
}
