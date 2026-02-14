'use client'

import { useEffect } from 'react'
import { listingDraftStorageKey, listingLastDraftPointerKey, parseListingLastDraftPointer } from '@/lib/internships/draftStorage'

type Props = {
  userId: string
  clearedDraftId: string
}

export default function ListingDraftCleanup(props: Props) {
  useEffect(() => {
    const draftId = props.clearedDraftId.trim()
    if (!draftId) return
    const storageKey = listingDraftStorageKey(props.userId, draftId)
    const lastPointerKey = listingLastDraftPointerKey(props.userId)
    window.localStorage.removeItem(storageKey)
    const pointer = parseListingLastDraftPointer(window.localStorage.getItem(lastPointerKey))
    if (pointer && pointer.draftId === draftId) {
      window.localStorage.removeItem(lastPointerKey)
    }
  }, [props.clearedDraftId, props.userId])

  return null
}
