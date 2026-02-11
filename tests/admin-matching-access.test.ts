import assert from 'node:assert/strict'
import test from 'node:test'
import { canAccessAdminMatching } from '../lib/auth/adminMatchingAccess.ts'

test('admin matching preview/report access is denied for non-admin roles', () => {
  assert.equal(canAccessAdminMatching('student'), false)
  assert.equal(canAccessAdminMatching('employer'), false)
  assert.equal(canAccessAdminMatching('support'), false)
  assert.equal(canAccessAdminMatching(undefined), false)
})

test('admin matching preview/report access is allowed for admin roles', () => {
  assert.equal(canAccessAdminMatching('ops_admin'), true)
  assert.equal(canAccessAdminMatching('super_admin'), true)
})
