#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

const PROJECT_ROOT = process.cwd()
const SOURCES_PATH = path.join(PROJECT_ROOT, 'data', 'university-catalog-sources.json')
const OUTPUT_PATH = path.join(PROJECT_ROOT, 'data', 'university-course-catalog.generated.json')

const args = new Set(process.argv.slice(2))
const DRY_RUN = args.has('--dry-run')
const LIMIT_ARG = process.argv.find((arg) => arg.startsWith('--limit='))
const LIMIT = LIMIT_ARG ? Number.parseInt(LIMIT_ARG.split('=')[1], 10) : null

const USER_AGENT =
  'Mozilla/5.0 (compatible; InternactiveCourseBot/1.0; +https://internactive.com/beta)'
const REQUEST_TIMEOUT_MS = 25000
const MAX_CRAWL_PAGES = 18
const MAX_COURSES_PER_UNIVERSITY = 1200

function decodeHtmlEntities(text) {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

function htmlToText(html) {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n+/g, '\n')
  )
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeCourseTitle(value) {
  return normalizeWhitespace(
    value
      .replace(/[|]+/g, ' ')
      .replace(/\s*\([^)]*credits?[^)]*\)/gi, '')
      .replace(/\s*[-|]\s*prerequisite[s]?:.*$/i, '')
  )
}

function isLikelyCourseTitle(title) {
  if (!title) return false
  if (title.length < 4 || title.length > 120) return false
  if (!/[A-Za-z]{3,}/.test(title)) return false
  if (/^(home|search|menu|catalog|page|course description)$/i.test(title)) return false
  return true
}

function extractCoursesFromText(text) {
  const matches = new Set()
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)

  const patterns = [
    /^([A-Z&]{2,8}\s*[-]?\s*\d{2,4}[A-Z]?)\s*[:\-–]\s*(.+)$/,
    /^([A-Z&]{2,8}\s*[-]?\s*\d{2,4}[A-Z]?)\s+(.+)$/,
    /^([A-Z&]{2,8}\s+\d{2,4}[A-Z]?)\.\s+(.+)$/,
    /^([A-Z&]{2,8}\d{2,4}[A-Z]?)\s*[:\-–]\s*(.+)$/,
  ]

  for (const line of lines) {
    for (const pattern of patterns) {
      const found = line.match(pattern)
      if (!found) continue

      const code = found[1].replace(/\s+/g, ' ').trim()
      const rawTitle = found[2].split('Prerequisite')[0].split('Corequisite')[0]
      const title = normalizeCourseTitle(rawTitle)

      if (!isLikelyCourseTitle(title)) continue
      if (title.toLowerCase().includes('credits')) continue

      const value = normalizeCourseString(code, title)
      if (value) matches.add(value)
      break
    }
  }

  return Array.from(matches).slice(0, 300)
}

function extractCoursesFromCourseleafHtml(html) {
  const matches = new Set()
  const pattern =
    /<span[^>]*detail-code[^>]*>\s*(?:<strong>)?([^<]+?)(?:<\/strong>)?\s*<\/span>[\s\S]{0,500}?<span[^>]*detail-title[^>]*>\s*(?:<strong>)?([^<]+?)(?:<\/strong>)?\s*<\/span>/gi

  let found = pattern.exec(html)
  while (found) {
    const rawCode = decodeHtmlEntities(found[1] ?? '').replace(/\.$/, '').trim()
    const rawTitle = decodeHtmlEntities(found[2] ?? '').replace(/\.$/, '').trim()
    const value = normalizeCourseString(rawCode, rawTitle)
    if (value) matches.add(value)
    found = pattern.exec(html)
  }

  return Array.from(matches)
}

function extractLinks(html, pageUrl) {
  const links = []
  const base = new URL(pageUrl)
  const hrefRegex = /href=["']([^"'#]+)["']/gi
  let match = hrefRegex.exec(html)

  while (match) {
    const href = match[1].trim()
    try {
      const absolute = new URL(href, base).toString()
      const target = new URL(absolute)
      if (target.origin !== base.origin) {
        match = hrefRegex.exec(html)
        continue
      }

      if (!/^https?:/i.test(target.protocol)) {
        match = hrefRegex.exec(html)
        continue
      }

      links.push(absolute)
    } catch {
      // ignore malformed hrefs
    }

    match = hrefRegex.exec(html)
  }

  return links
}

function scoreCatalogLink(url) {
  const lower = url.toLowerCase()
  let score = 0
  if (lower.includes('/course')) score += 6
  if (lower.includes('/courses')) score += 6
  if (lower.includes('course-descriptions')) score += 5
  if (lower.includes('/subject')) score += 4
  if (lower.includes('/catalog')) score += 3
  if (lower.includes('/bulletin')) score += 2
  if (lower.includes('/department')) score += 1
  if (/\.(pdf|jpg|jpeg|png|gif|zip)$/i.test(lower)) score -= 10
  return score
}

async function fetchHtml(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    return await response.text()
  } finally {
    clearTimeout(timer)
  }
}

async function fetchJson(url, init = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        'user-agent': USER_AGENT,
        accept: 'application/json,text/plain,*/*',
        ...(init.headers || {}),
      },
      redirect: 'follow',
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    return await response.json()
  } finally {
    clearTimeout(timer)
  }
}

function extractJsonFromNuxtLikePayload(html, key) {
  const direct = html.match(new RegExp(`"${key}":"([^"]+)"`, 'i'))
  if (direct?.[1]) return direct[1]

  const escaped = html.match(new RegExp(`${key}\\\\u0022:\\\\u0022([^\\\\]+)`, 'i'))
  if (escaped?.[1]) return escaped[1]

  return null
}

function guessCoursedogSchool(html, sourceUrl) {
  const fromCmPath = html.match(/cm\/([a-z0-9-]+)\/courses\/search/i)?.[1]
  if (fromCmPath) return fromCmPath

  const fromState = extractJsonFromNuxtLikePayload(html, 'school')
  if (fromState) return fromState

  const hostname = new URL(sourceUrl).hostname.toLowerCase()
  if (hostname.includes('catalog.utah.edu')) return 'utah'
  if (hostname.includes('catalog.usu.edu')) return 'usu'
  if (hostname.includes('catalog.byu.edu')) return 'byu'
  if (hostname.includes('catalog.weber.edu')) return 'weber'
  if (hostname.includes('catalog.slcc.edu')) return 'slcc'
  return null
}

function guessCoursedogCatalogId(html) {
  return (
    extractJsonFromNuxtLikePayload(html, 'activeCatalog') ??
    extractJsonFromNuxtLikePayload(html, 'catalogId')
  )
}

function normalizeCourseString(code, title) {
  const cleanCode = normalizeWhitespace(String(code ?? '').replace(/[.]+$/, ''))
  const cleanTitle = normalizeCourseTitle(String(title ?? ''))
  if (!cleanCode || !cleanTitle) return null
  const compactCode = cleanCode.replace(/\s+/g, '')
  if (!/^[A-Za-z&]{2,10}\d{2,4}[A-Za-z]{0,2}$/.test(compactCode)) return null
  if (!isLikelyCourseTitle(cleanTitle)) return null
  return `${cleanCode} ${cleanTitle}`
}

function extractCoursesFromCoursedogItem(item) {
  if (!item || typeof item !== 'object') return []
  const course = item.course && typeof item.course === 'object' ? item.course : item
  const candidates = []

  const subject =
    course.subjectCode ??
    course.subject ??
    course.departmentCode ??
    course.prefix ??
    course.subject_code
  const number = course.courseNumber ?? course.number ?? course.codeNumber ?? course.course_number
  const title = course.title ?? course.name ?? course.longName ?? course.courseTitle
  const code = course.code ?? course.displayCode ?? (subject && number ? `${subject} ${number}` : null)

  if (code && title) {
    const single = normalizeCourseString(code, title)
    if (single) candidates.push(single)
  }

  if (subject && number && title) {
    const assembled = normalizeCourseString(`${subject} ${number}`, title)
    if (assembled) candidates.push(assembled)
  }

  return candidates
}

async function collectCoursesViaCoursedogApi(sourceUrl, sourceHtml) {
  const school = guessCoursedogSchool(sourceHtml, sourceUrl)
  if (!school) return []

  const catalogId = guessCoursedogCatalogId(sourceHtml)
  const out = new Set()
  const limit = 500

  for (let skip = 0; skip <= 2000; skip += limit) {
    const endpoint = new URL(`https://api.coursedog.com/cm/${school}/courses/search/$filters`)
    endpoint.searchParams.set('skip', String(skip))
    endpoint.searchParams.set('limit', String(limit))
    endpoint.searchParams.set('orderBy', 'name')
    endpoint.searchParams.set('ascending', 'true')
    if (catalogId) endpoint.searchParams.set('catalogId', catalogId)

    const payload = await fetchJson(endpoint.toString(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    })

    const rows = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.courses)
          ? payload.courses
          : []

    for (const row of rows) {
      const entries = extractCoursesFromCoursedogItem(row)
      for (const entry of entries) out.add(entry)
    }

    if (rows.length < limit || out.size >= MAX_COURSES_PER_UNIVERSITY) break
  }

  return Array.from(out).slice(0, MAX_COURSES_PER_UNIVERSITY)
}

async function collectCoursesViaCrawl(startUrl) {
  const maxPages = startUrl.includes('catalog.uvu.edu/courses/') ? 140 : MAX_CRAWL_PAGES
  const queue = [startUrl]
  const seen = new Set()
  const collected = new Set()

  while (queue.length > 0 && seen.size < maxPages && collected.size < MAX_COURSES_PER_UNIVERSITY) {
    const current = queue.shift()
    if (!current || seen.has(current)) continue
    seen.add(current)

    let html = ''
    try {
      html = await fetchHtml(current)
    } catch {
      continue
    }

    const text = htmlToText(html)
    const extracted = extractCoursesFromText(text)
    const courseleafExtracted = extractCoursesFromCourseleafHtml(html)
    for (const course of extracted) {
      collected.add(course)
      if (collected.size >= MAX_COURSES_PER_UNIVERSITY) break
    }
    for (const course of courseleafExtracted) {
      collected.add(course)
      if (collected.size >= MAX_COURSES_PER_UNIVERSITY) break
    }

    const nextCandidates = extractLinks(html, current)
      .filter((url) => !seen.has(url))
      .map((url) => ({ url, score: scoreCatalogLink(url) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((item) => item.url)

    for (const link of nextCandidates) {
      if (!queue.includes(link)) queue.push(link)
    }
  }

  return Array.from(collected).slice(0, MAX_COURSES_PER_UNIVERSITY)
}

async function collectCoursesForUniversity(url) {
  const rootHtml = await fetchHtml(url)
  const rootTextCourses = extractCoursesFromText(htmlToText(rootHtml))

  const maybeCoursedog =
    rootHtml.includes('api.coursedog.com') ||
    rootHtml.includes('static.catalog.prod.coursedog.com') ||
    rootHtml.includes('__NUXT__')

  if (maybeCoursedog) {
    try {
      const apiCourses = await collectCoursesViaCoursedogApi(url, rootHtml)
      if (apiCourses.length > 0) {
        return {
          strategy: 'coursedog_api',
          courses: apiCourses,
        }
      }
    } catch {
      // fall through to crawl strategy
    }
  }

  const crawled = await collectCoursesViaCrawl(url)
  if (crawled.length > rootTextCourses.length) {
    return {
      strategy: 'site_crawl',
      courses: crawled,
    }
  }

  return {
    strategy: 'root_page_text',
    courses: rootTextCourses,
  }
}

async function run() {
  const sourcesRaw = await fs.readFile(SOURCES_PATH, 'utf8')
  const sources = JSON.parse(sourcesRaw)
  const entries = Object.entries(sources)
  const scopedEntries = LIMIT && Number.isFinite(LIMIT) ? entries.slice(0, LIMIT) : entries

  const courseworkByUniversity = {}
  const sourceMeta = {}

  for (const [universityName, url] of scopedEntries) {
    const startedAt = Date.now()
    try {
      const { courses, strategy } = await collectCoursesForUniversity(url)

      courseworkByUniversity[universityName] = courses
      sourceMeta[universityName] = {
        url,
        strategy,
        ok: true,
        count: courses.length,
        duration_ms: Date.now() - startedAt,
      }

      console.log(`[ok] ${universityName}: ${courses.length} courses`) 
    } catch (error) {
      courseworkByUniversity[universityName] = []
      sourceMeta[universityName] = {
        url,
        strategy: 'none',
        ok: false,
        count: 0,
        duration_ms: Date.now() - startedAt,
        error: error instanceof Error ? error.message : 'unknown error',
      }

      console.log(`[err] ${universityName}: ${sourceMeta[universityName].error}`)
    }
  }

  const output = {
    generated_at: new Date().toISOString(),
    sources: sourceMeta,
    coursework_by_university: courseworkByUniversity,
  }

  if (DRY_RUN) {
    console.log('\nDry run complete. No files written.')
    return
  }

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf8')
  console.log(`\nWrote ${OUTPUT_PATH}`)
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
