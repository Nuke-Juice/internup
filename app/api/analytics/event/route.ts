import { NextResponse } from 'next/server'
import { trackAnalyticsEvent } from '@/lib/analytics'
import { supabaseServer } from '@/lib/supabase/server'

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const eventName =
    body && typeof body === 'object' && 'event_name' in body && typeof body.event_name === 'string'
      ? body.event_name.trim()
      : ''
  const properties =
    body && typeof body === 'object' && 'properties' in body && body.properties && typeof body.properties === 'object'
      ? (body.properties as Record<string, unknown>)
      : {}

  if (!eventName) {
    return NextResponse.json({ error: 'event_name is required' }, { status: 400 })
  }

  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if ((eventName === 'click_apply' || eventName === 'apply_click') && typeof properties.listing_id === 'string' && user?.id) {
    const day = new Date().toISOString().slice(0, 10)
    properties.dedupe_key = `click:${properties.listing_id}:${user.id}:${day}`
  }

  await trackAnalyticsEvent({
    eventName,
    userId: user?.id ?? null,
    properties,
  })

  return NextResponse.json({ ok: true })
}
