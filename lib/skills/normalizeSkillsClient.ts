export type NormalizeSkillsResult = {
  skillIds: string[]
  unknown: string[]
}

export async function normalizeSkillsClient(skills: string[]): Promise<NormalizeSkillsResult> {
  const response = await fetch('/api/skills/normalize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skills }),
  })

  if (!response.ok) {
    throw new Error('Failed to normalize skills.')
  }

  const data = (await response.json()) as NormalizeSkillsResult
  return {
    skillIds: Array.isArray(data.skillIds) ? data.skillIds.filter((item): item is string => typeof item === 'string') : [],
    unknown: Array.isArray(data.unknown) ? data.unknown.filter((item): item is string => typeof item === 'string') : [],
  }
}
