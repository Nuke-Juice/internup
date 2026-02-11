#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

const PROJECT_ROOT = process.cwd()
const OUTPUT_PATH = path.join(PROJECT_ROOT, 'data', 'university-course-catalog.manual.json')

const DEFAULTS = {
  utah: [
    '/Users/alex.eggertsen/Downloads/courses-report.2026-02-11.csv',
    '/Users/alex.eggertsen/Downloads/courses-report.2026-02-11 (4).csv',
    '/Users/alex.eggertsen/Downloads/courses-report.2026-02-11 (5).csv',
    '/Users/alex.eggertsen/Downloads/courses-report.2026-02-11 (6).csv',
    '/Users/alex.eggertsen/Downloads/courses-report.2026-02-11 (7).csv',
    '/Users/alex.eggertsen/Downloads/courses-report.2026-02-11 (9).csv',
    '/Users/alex.eggertsen/Downloads/courses-report.2026-02-11 (15).csv',
    '/Users/alex.eggertsen/Downloads/courses-report.2026-02-11 (21).csv',
    '/Users/alex.eggertsen/Downloads/courses-report.2026-02-11 (22).csv',
  ],
  byu: [
    '/Users/alex.eggertsen/Downloads/courses-report.2026-02-11 (1).csv',
    '/Users/alex.eggertsen/Downloads/courses-report.2026-02-11 (10).csv',
    '/Users/alex.eggertsen/Downloads/courses-report.2026-02-11 (11).csv',
    '/Users/alex.eggertsen/Downloads/courses-report.2026-02-11 (12).csv',
    '/Users/alex.eggertsen/Downloads/courses-report.2026-02-11 (13).csv',
    '/Users/alex.eggertsen/Downloads/courses-report.2026-02-11 (14).csv',
    '/Users/alex.eggertsen/Downloads/courses-report.2026-02-11 (23).csv',
  ],
  usu: [
    '/Users/alex.eggertsen/Downloads/courses-report.2026-02-11 (2).csv',
    '/Users/alex.eggertsen/Downloads/courses-report.2026-02-11 (16).csv',
    '/Users/alex.eggertsen/Downloads/courses-report.2026-02-11 (17).csv',
    '/Users/alex.eggertsen/Downloads/courses-report.2026-02-11 (18).csv',
    '/Users/alex.eggertsen/Downloads/courses-report.2026-02-11 (19).csv',
    '/Users/alex.eggertsen/Downloads/courses-report.2026-02-11 (20).csv',
  ],
}

function argValue(flag, fallback) {
  const pair = process.argv.find((arg) => arg.startsWith(`${flag}=`))
  if (!pair) return fallback
  return pair.slice(flag.length + 1)
}

const UTTAH_CSV_PATH = argValue('--utah', DEFAULTS.utah)
const BYU_CSV_PATH = argValue('--byu', DEFAULTS.byu)
const USU_CSV_PATH = argValue('--usu', DEFAULTS.usu)
const UTTAH_ALLOWED_SUBJECTS = new Set(['ACCTG', 'FINAN', 'IS', 'CS', 'BCOR'])

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function truncateToWords(value, maxWords) {
  const words = normalizeWhitespace(value).split(' ').filter(Boolean)
  if (words.length <= maxWords) return words.join(' ')
  return `${words.slice(0, maxWords).join(' ')}...`
}

function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false

  for (let idx = 0; idx < text.length; idx += 1) {
    const char = text[idx]
    if (quoted) {
      if (char === '"') {
        if (text[idx + 1] === '"') {
          cell += '"'
          idx += 1
        } else {
          quoted = false
        }
      } else {
        cell += char
      }
      continue
    }

    if (char === '"') {
      quoted = true
      continue
    }
    if (char === ',') {
      row.push(cell)
      cell = ''
      continue
    }
    if (char === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      continue
    }
    if (char === '\r') continue
    cell += char
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  return rows
}

function toRowObjects(rows) {
  if (rows.length === 0) return []
  const headers = rows[0]
  return rows.slice(1).map((cells) => {
    const output = {}
    for (let i = 0; i < headers.length; i += 1) {
      output[headers[i]] = cells[i] ?? ''
    }
    return output
  })
}

async function readCsvRows(filePath) {
  const raw = await fs.readFile(filePath, 'utf8')
  return toRowObjects(parseCsv(raw))
}

function normalizeSubjectCode(value) {
  return normalizeWhitespace(value).replace(/\s+/g, '').toUpperCase()
}

function deriveUtahCourses(rows) {
  const out = new Set()
  for (const row of rows) {
    const subject = normalizeWhitespace(row['Subject code'])
    const subjectCode = normalizeSubjectCode(subject)
    const number = normalizeWhitespace(row['Catalog Number'])
    const description = normalizeWhitespace(row['Description'])
    if (!UTTAH_ALLOWED_SUBJECTS.has(subjectCode)) continue
    if (!subject || !number) continue
    const firstSentence = description.split(/[.!?]/)[0] ?? ''
    const syntheticTitle = truncateToWords(firstSentence, 10)
    const value = normalizeWhitespace(`${subject} ${number} ${syntheticTitle}`)
    out.add(value || `${subject} ${number}`)
  }
  return Array.from(out).filter(Boolean)
}

function deriveByuCourses(rows) {
  const out = new Set()
  for (const row of rows) {
    const subject = normalizeWhitespace(row['Teaching Area'])
    const number = normalizeWhitespace(row['Course Number'])
    const title = normalizeWhitespace(row['Course Title'])
    if (!subject || !number) continue
    out.add(normalizeWhitespace(`${subject} ${number} ${title}`))
  }
  return Array.from(out).filter(Boolean)
}

function deriveUsuCourses(rows) {
  const out = new Set()
  for (const row of rows) {
    const subject = normalizeWhitespace(row['Course Prefix'])
    const number = normalizeWhitespace(row['Course Number'])
    const title = normalizeWhitespace(row['Course Title'])
    if (!subject || !number) continue
    out.add(normalizeWhitespace(`${subject} ${number} ${title}`))
  }
  return Array.from(out).filter(Boolean)
}

async function run() {
  const utahPaths = Array.isArray(UTTAH_CSV_PATH)
    ? UTTAH_CSV_PATH
    : String(UTTAH_CSV_PATH)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
  const byuPaths = Array.isArray(BYU_CSV_PATH)
    ? BYU_CSV_PATH
    : String(BYU_CSV_PATH)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
  const usuPaths = Array.isArray(USU_CSV_PATH)
    ? USU_CSV_PATH
    : String(USU_CSV_PATH)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)

  const previous =
    JSON.parse(await fs.readFile(OUTPUT_PATH, 'utf8').catch(() => '{"coursework_by_university":{},"sources":{}}')) ??
    {}
  const previousCourseworkByUniversity =
    previous && typeof previous === 'object' && previous.coursework_by_university && typeof previous.coursework_by_university === 'object'
      ? previous.coursework_by_university
      : {}

  const utahRowsPerFile = await Promise.all(
    utahPaths.map(async (filePath) => {
      try {
        const rows = await readCsvRows(filePath)
        return { filePath, rows, ok: true }
      } catch {
        return { filePath, rows: [], ok: false }
      }
    })
  )
  const utahRows = utahRowsPerFile.flatMap((entry) => entry.rows)

  let byuRows = []
  let usuRows = []

  const byuRowsPerFile = await Promise.all(
    byuPaths.map(async (filePath) => {
      try {
        const rows = await readCsvRows(filePath)
        return { filePath, rows, ok: true }
      } catch {
        return { filePath, rows: [], ok: false }
      }
    })
  )
  byuRows = byuRowsPerFile.flatMap((entry) => entry.rows)

  const usuRowsPerFile = await Promise.all(
    usuPaths.map(async (filePath) => {
      try {
        const rows = await readCsvRows(filePath)
        return { filePath, rows, ok: true }
      } catch {
        return { filePath, rows: [], ok: false }
      }
    })
  )
  usuRows = usuRowsPerFile.flatMap((entry) => entry.rows)

  const utahDerived = deriveUtahCourses(utahRows)
  const byuDerived = deriveByuCourses(byuRows)
  const usuDerived = deriveUsuCourses(usuRows)

  const courseworkByUniversity = {
    'University of Utah':
      utahDerived.length > 0 ? utahDerived : (previousCourseworkByUniversity['University of Utah'] ?? []),
    'Brigham Young University':
      byuDerived.length > 0 ? byuDerived : (previousCourseworkByUniversity['Brigham Young University'] ?? []),
    'Utah State University':
      usuDerived.length > 0 ? usuDerived : (previousCourseworkByUniversity['Utah State University'] ?? []),
  }

  const payload = {
    generated_at: new Date().toISOString(),
    sources: {
      'University of Utah': {
        type: 'manual_csv',
        files: utahRowsPerFile.filter((entry) => entry.ok).map((entry) => path.basename(entry.filePath)),
        subject_filter: Array.from(UTTAH_ALLOWED_SUBJECTS),
        count: courseworkByUniversity['University of Utah'].length,
      },
      'Brigham Young University': {
        type: 'manual_csv',
        files: byuRowsPerFile.filter((entry) => entry.ok).map((entry) => path.basename(entry.filePath)),
        count: courseworkByUniversity['Brigham Young University'].length,
      },
      'Utah State University': {
        type: 'manual_csv',
        files: usuRowsPerFile.filter((entry) => entry.ok).map((entry) => path.basename(entry.filePath)),
        count: courseworkByUniversity['Utah State University'].length,
      },
    },
    coursework_by_university: courseworkByUniversity,
  }

  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(`Wrote ${OUTPUT_PATH}`)
  for (const [name, items] of Object.entries(courseworkByUniversity)) {
    console.log(`[ok] ${name}: ${items.length} courses`)
  }
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
