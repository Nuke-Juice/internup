import 'server-only'

import { supabaseServer } from '@/lib/supabase/server'

type AnalyticsProperties = Record<string, unknown>

export async function trackAnalyticsEvent(input: {
  eventName: string
  userId?: string | null
  properties?: AnalyticsProperties
}) {
  try {
    const supabase = await supabaseServer()
    await supabase.from('analytics_events').insert({
      user_id: input.userId ?? null,
      event_name: input.eventName,
      properties: input.properties ?? {},
    })
  } catch {
    // Analytics must never interrupt user flows.
  }
}
