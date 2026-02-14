import 'server-only'

import { supabaseServer } from '@/lib/supabase/server'

type AnalyticsProperties = Record<string, unknown>

export async function trackAnalyticsEvent(input: {
  eventName: string
  userId?: string | null
  properties?: AnalyticsProperties
}) {
  const internshipIdRaw = input.properties?.listing_id ?? input.properties?.internship_id
  const internshipId = typeof internshipIdRaw === 'string' ? internshipIdRaw.trim() : ''
  const dedupeKey = typeof input.properties?.dedupe_key === 'string' ? input.properties.dedupe_key.trim() : ''
  const eventTypeByName: Record<string, 'view' | 'click' | 'apply'> = {
    view_job_detail: 'view',
    click_apply: 'click',
    apply_click: 'click',
    submit_apply_success: 'apply',
    quick_apply_submitted: 'apply',
    external_apply_clicked: 'click',
    external_apply_completed: 'apply',
  }
  const mappedEventType = eventTypeByName[input.eventName]

  try {
    const supabase = await supabaseServer()
    await supabase.from('analytics_events').insert({
      user_id: input.userId ?? null,
      event_name: input.eventName,
      properties: input.properties ?? {},
    })

    if (internshipId && mappedEventType) {
      const payload = {
        internship_id: internshipId,
        event_type: mappedEventType,
        user_id: input.userId ?? null,
        dedupe_key: dedupeKey || null,
        metadata: input.properties ?? {},
      }
      if (dedupeKey) {
        await supabase.from('internship_events').upsert(payload, { onConflict: 'dedupe_key', ignoreDuplicates: true })
      } else {
        await supabase.from('internship_events').insert(payload)
      }
    }
  } catch {
    // Analytics must never interrupt user flows.
  }
}
