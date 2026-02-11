import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeNextPath } from '../lib/auth/nextPath.ts'

test('normalizeNextPath allows internal paths with query/hash', () => {
  assert.equal(normalizeNextPath('/admin/internships?page=2#top'), '/admin/internships?page=2#top')
})

test('normalizeNextPath rejects external-style or scheme payloads', () => {
  assert.equal(normalizeNextPath('https://evil.example'), null)
  assert.equal(normalizeNextPath('//evil.example'), null)
  assert.equal(normalizeNextPath('/\\evil.example'), null)
  assert.equal(normalizeNextPath('/javascript:alert(1)'), null)
})

test('normalizeNextPath rejects encoded redirect tricks', () => {
  assert.equal(normalizeNextPath('/%2f%2fevil.example'), null)
  assert.equal(normalizeNextPath('/%5cevil.example'), null)
})
