import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { supabaseServer } from '@/lib/supabase/server'
import {
  getPriceIdMapForMode,
  getStripeMode,
  getStripePublishableKeyForMode,
  getStripeSecretKeyForMode,
  getStripeWebhookSecretForMode,
} from '@/lib/billing/prices'

function mask(value: string) {
  if (!value) return ''
  if (value.length <= 8) return '****'
  return `${value.slice(0, 8)}...${value.slice(-4)}`
}

export async function GET() {
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { data: userRow } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  const role = typeof userRow?.role === 'string' ? userRow.role : null
  if (role !== 'ops_admin' && role !== 'super_admin') {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const mode = getStripeMode()
  let prices: { starter: string | null; pro: string | null } = { starter: null, pro: null }
  try {
    const resolved = getPriceIdMapForMode(mode)
    prices = { starter: resolved.starter, pro: resolved.pro }
  } catch {
    prices = { starter: null, pro: null }
  }

  const admin = supabaseAdmin()
  const { data: subscriptions } = await admin
    .from('subscriptions')
    .select('user_id, status, price_id, current_period_end, updated_at')
    .order('updated_at', { ascending: false })
    .limit(10)

  return NextResponse.json({
    mode,
    price_ids: prices,
    keys: {
      secret_key: mask(getStripeSecretKeyForMode(mode)),
      publishable_key: mask(getStripePublishableKeyForMode(mode)),
      webhook_secret: mask(getStripeWebhookSecretForMode(mode)),
    },
    subscriptions: subscriptions ?? [],
  })
}
