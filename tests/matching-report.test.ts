import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMatchingReportModel } from '../lib/admin/matchingReport.ts'

test('matching report model includes required key sections', () => {
  const model = buildMatchingReportModel()
  assert.ok(model.summary.matchingVersion)
  assert.ok(model.summary.signalKeys.length > 0)
  assert.ok(model.dataSources.length > 0)
  assert.ok(model.qualityOverQuantity.bullets.length > 0)
  assert.ok(model.qualityOverQuantity.messaging.length > 0)
  assert.ok(model.qualityOverQuantity.risksAndMitigations.length > 0)
  assert.ok(model.majorInternshipMatrix.length > 0)
  assert.ok(model.majorInternshipMatrix.every((row) => row.suggestedCourseworkCategories.length > 0))
  assert.ok(model.majorInternshipMatrix.every((row) => row.internshipTypes.length > 0))
  assert.ok(model.sample.match.breakdown)
})
