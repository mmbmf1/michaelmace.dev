#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

function usage() {
  return [
    'Usage:',
    '  node scripts/update-git-hours.js [--input <file>] [--output <file>] [--date <YYYY-MM-DD>] [--stdout]',
    '',
    'Examples:',
    '  git-hours-tracker | node scripts/update-git-hours.js',
    '  node scripts/update-git-hours.js --input /tmp/git-hours.txt',
    '  node scripts/update-git-hours.js --input /tmp/git-hours.txt --stdout',
  ].join('\n')
}

function parseArgs(argv) {
  const args = {
    input: '',
    output: '',
    date: '',
    stdout: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--input') {
      args.input = argv[i + 1] || ''
      i += 1
      continue
    }
    if (token === '--output') {
      args.output = argv[i + 1] || ''
      i += 1
      continue
    }
    if (token === '--date') {
      args.date = argv[i + 1] || ''
      i += 1
      continue
    }
    if (token === '--stdout') {
      args.stdout = true
      continue
    }
    if (token === '--help' || token === '-h') {
      console.log(usage())
      process.exit(0)
    }
    throw new Error(`Unknown argument: ${token}`)
  }

  return args
}

function extractNumber(text, regex) {
  const match = text.match(regex)
  if (!match) return null
  const value = Number.parseFloat(match[1].replace(/,/g, ''))
  if (!Number.isFinite(value)) return null
  return value
}

function extractInt(text, regex) {
  const match = text.match(regex)
  if (!match) return null
  const value = Number.parseInt(match[1].replace(/,/g, ''), 10)
  if (!Number.isFinite(value)) return null
  return value
}

function parseTrackerOutput(raw) {
  const hours = extractNumber(
    raw,
    /Total credited hours:\s*([0-9][0-9,]*(?:\.[0-9]+)?)/i
  )
  const progressPct = extractNumber(
    raw,
    /Progress toward 10,000 hours:\s*([0-9][0-9,]*(?:\.[0-9]+)?)%/i
  )

  if (hours == null || progressPct == null) {
    throw new Error(
      'Could not find required values. Expected "Total credited hours" and "Progress toward 10,000 hours".'
    )
  }

  const repositoriesScanned = extractInt(
    raw,
    /Repositories scanned:\s*([0-9][0-9,]*)/i
  )
  const totalSessions = extractInt(raw, /Total sessions:\s*([0-9][0-9,]*)/i)
  const sessionsAssignedFloorDuration = extractInt(
    raw,
    /Sessions assigned floor duration:\s*([0-9][0-9,]*)/i
  )
  const gapThresholdMinutes = extractInt(
    raw,
    /Gap threshold used:\s*([0-9][0-9,]*)\s+minutes/i
  )
  const floorThresholdMinutes = extractInt(
    raw,
    /Floor threshold used:\s*([0-9][0-9,]*)\s+minutes/i
  )

  const stats = {}
  if (repositoriesScanned != null) stats.repositories_scanned = repositoriesScanned
  if (totalSessions != null) stats.total_sessions = totalSessions
  if (sessionsAssignedFloorDuration != null) {
    stats.sessions_assigned_floor_duration = sessionsAssignedFloorDuration
  }
  if (gapThresholdMinutes != null) stats.gap_threshold_minutes = gapThresholdMinutes
  if (floorThresholdMinutes != null) {
    stats.floor_threshold_minutes = floorThresholdMinutes
  }

  return {
    hours,
    progress_pct: progressPct,
    stats,
  }
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => {
      data += chunk
    })
    process.stdin.on('end', () => resolve(data))
    process.stdin.on('error', reject)
  })
}

function resolveOutputPath(argOutput) {
  if (argOutput) return path.resolve(process.cwd(), argOutput)
  return path.resolve(process.cwd(), 'data', 'git-hours.json')
}

function resolveDate(argDate) {
  if (argDate) return argDate
  return new Date().toISOString().slice(0, 10)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  let raw = ''

  if (args.input) {
    raw = fs.readFileSync(path.resolve(process.cwd(), args.input), 'utf8')
  } else if (!process.stdin.isTTY) {
    raw = await readStdin()
  } else {
    throw new Error(
      'No input provided. Pass --input <file> or pipe tracker output via stdin.\n\n' +
        usage()
    )
  }

  const parsed = parseTrackerOutput(raw)
  const payload = {
    hours: parsed.hours,
    progress_pct: parsed.progress_pct,
    updated_at: resolveDate(args.date),
  }

  if (Object.keys(parsed.stats).length > 0) {
    payload.stats = parsed.stats
  }

  const json = JSON.stringify(payload, null, 2) + '\n'

  if (args.stdout) {
    process.stdout.write(json)
    return
  }

  const outPath = resolveOutputPath(args.output)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, json, 'utf8')
  console.log(`Wrote ${path.relative(process.cwd(), outPath)}`)
}

main().catch((err) => {
  console.error(err.message || String(err))
  process.exit(1)
})
