export const LISTING_DRAFT_RECENT_WINDOW_MS = 1000 * 60 * 60 * 24 * 7

export type ListingLastDraftPointer = {
  draftId: string
  savedAt: string
}

export function listingDraftStorageKey(userId: string, draftId: string) {
  return `internactive:listingDraft:${userId}:${draftId}`
}

export function listingLastDraftPointerKey(userId: string) {
  return `internactive:listingDraft:last:${userId}`
}

export function parseListingLastDraftPointer(raw: string | null): ListingLastDraftPointer | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<ListingLastDraftPointer>
    if (!parsed || typeof parsed.draftId !== 'string' || typeof parsed.savedAt !== 'string') return null
    return { draftId: parsed.draftId.trim(), savedAt: parsed.savedAt.trim() }
  } catch {
    return null
  }
}

export function isRecentDraft(savedAtIso: string, now = Date.now()) {
  const ts = Date.parse(savedAtIso)
  if (!Number.isFinite(ts)) return false
  return now - ts <= LISTING_DRAFT_RECENT_WINDOW_MS
}
