# Stripe Test-Mode Scenarios

Use this plan before switching to live mode.

## Preconditions
- `STRIPE_MODE=test`
- Test keys and test price IDs configured
- Stripe CLI installed and authenticated
- Webhook forwarding enabled:
  - `stripe listen --forward-to http://localhost:3000/api/stripe/webhook`

## Scenario 1: Successful purchase unlocks paid access
1. Sign in as an employer on free plan.
2. Go to `/upgrade`.
3. Start Starter/Pro checkout and complete payment with a Stripe success test card.
4. Verify:
   - `subscriptions` row updated (`status=active|trialing`, `price_id` set).
   - Paid features unlock in employer applicants view.
   - If Pro, verified employer badge is visible.

## Scenario 2: Cancel at period end
1. Open billing portal from `/upgrade` and cancel at period end.
2. Verify:
   - Stripe emits subscription updated events.
   - `subscriptions.status` and `current_period_end` are updated.
   - Access behavior follows policy (only `active|trialing` are paid).

## Scenario 3: Immediate cancel
1. In Stripe dashboard (test mode), cancel immediately.
2. Verify:
   - Webhook updates `subscriptions.status` away from `active|trialing`.
   - Paid features are removed.

## Scenario 4: Payment failure / expired card
1. Use Stripe test cards for failed renewals and expired card scenarios.
2. Trigger invoice/subscription state transitions in Stripe.
3. Verify:
   - `subscriptions.status` updates via webhook.
   - Access reflects current status policy.

## Scenario 5: Webhook replay
1. Replay a prior Stripe event from dashboard or CLI.
2. Verify:
   - Endpoint returns success.
   - No duplicate state drift.
   - `stripe_webhook_events` contains single `event_id` row.

## Scenario 6: Plan upgrade/downgrade
1. Change plan via checkout/portal.
2. Verify:
   - `subscriptions.price_id` updates.
   - Plan mapping and feature flags update.
   - Posting limits reflect current plan.

## Scenario 7: Employer account deletion
1. Delete employer account from app flow.
2. Verify:
   - No paid access remains in app.
   - Subscription/customer mapping rows are removed from app DB.
   - No orphaned access in app authorization paths.
