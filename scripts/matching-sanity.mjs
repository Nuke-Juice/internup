import { DEFAULT_MATCHING_WEIGHTS, evaluateInternshipMatch, rankInternships } from '../lib/matching.ts'
import { mockInternships, mockStudents } from '../lib/matching.fixtures.ts'

function printSection(title) {
  console.log(`\n=== ${title} ===`)
}

printSection('Matching v1 Sanity Check')
console.log('Weights:', DEFAULT_MATCHING_WEIGHTS)

for (const student of mockStudents) {
  printSection(student.name)

  const ranked = rankInternships(mockInternships, student.profile)

  for (const [index, item] of ranked.entries()) {
    const topReasons = item.match.reasons.slice(0, 2)
    console.log(`${index + 1}. ${item.internship.title ?? item.internship.id}`)
    console.log(`   score=${item.match.score.toFixed(2)}`)
    if (topReasons.length > 0) {
      console.log(`   reasons: ${topReasons.join(' | ')}`)
    }
    if (item.match.gaps.length > 0) {
      console.log(`   gaps: ${item.match.gaps.join(' | ')}`)
    }
  }

  const excluded = mockInternships
    .map((internship) => ({ internship, match: evaluateInternshipMatch(internship, student.profile) }))
    .filter((item) => !item.match.eligible)

  if (excluded.length > 0) {
    console.log('   excluded by hard filters:')
    for (const item of excluded) {
      console.log(`   - ${item.internship.title ?? item.internship.id}: ${item.match.gaps.join('; ')}`)
    }
  }
}
