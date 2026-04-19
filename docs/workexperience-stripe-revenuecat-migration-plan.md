# WorkExperience Stripe + RevenueCat Migration Plan

Last reviewed: April 17, 2026

This document captures the plan for keeping the existing WorkExperience Stripe web billing while adding iOS In-App Purchases and Google Play Billing through RevenueCat for native mobile apps.

## Goal

Use the right billing system for each platform:

- Web: Stripe checkout and Stripe customer portal.
- iOS: Apple In-App Purchases through RevenueCat.
- Android: Google Play Billing through RevenueCat.
- Backend: one shared entitlement/access layer that decides whether a user has paid access.

The app should not treat "Stripe user", "Apple user", and "Google user" as separate access models. It should ask one question:

```text
Does this account have the required entitlement/tier?
```

## Current Projects

Two local projects are involved:

- Expo wrapper/mobile app: `/Users/florin/Documents/Sources/viel-chat-expo`
- WorkExperience Next.js app: `/Users/florin/Documents/Sources/WorkExperience`

The Expo wrapper currently loads the web app in a WebView and already includes RevenueCat packages:

- `react-native-purchases`
- `react-native-purchases-ui`

The WorkExperience Next.js app currently has a full Stripe integration.

## Current WorkExperience Stripe Setup

WorkExperience is currently Stripe-first.

Important existing files:

- `lib/stripe.ts`
  - Stripe client setup.
  - Stripe webhook processing.
  - Checkout session creation.
  - Customer portal session creation.
  - Subscription sync.
  - Plan update and scheduled downgrade logic.
  - `getUserSubscription` / `getUserSubscriptionWithSync`.

- `app/api/stripe/checkout/route.ts`
  - Creates Stripe checkout sessions.
  - Maps `tierId` to `STRIPE_INTERMEDIATE_PRICE_ID` or `STRIPE_PRO_PRICE_ID`.

- `app/api/stripe/webhook/route.ts`
  - Receives Stripe webhooks.
  - Verifies the Stripe signature.
  - Calls `processStripeEvent`.

- `app/api/stripe/portal/route.ts`
  - Opens Stripe customer portal.

- `app/api/stripe/update/route.ts`
  - Changes Stripe subscription tier.
  - Schedules downgrades at period end.

- `app/api/stripe/sync-subscription/route.ts`
  - Syncs Stripe state after checkout success.

- `lib/trpc/routers/profile.ts`
  - `getSubscription` maps Stripe price IDs to app tiers.
  - `getUsage` gets limits based on the Stripe-derived tier.

- `supabase/migrations/001_initial_schema.sql`
  - Defines the current `subscriptions` table.

- `supabase/migrations/016_add_unique_constraint_subscriptions_user_id.sql`
  - Enforces one subscription row per user.

- `supabase/migrations/022_add_scheduled_downgrade_to_subscriptions.sql`
  - Adds Stripe scheduled downgrade fields.

## Current Limitation

The current subscription model is shaped around Stripe:

```text
subscriptions
- stripe_customer_id
- stripe_subscription_id
- status
- price_id
- current_period_start
- current_period_end
- cancel_at_period_end
- scheduled_price_id
- stripe_subscription_schedule_id
```

That works for web billing, but it is not a good long-term place to put Apple and Google purchases. RevenueCat purchases have different identifiers, statuses, lifecycle events, and management URLs.

The main migration should be:

```text
Stripe as payment provider
RevenueCat as mobile payment provider
Your backend as entitlement source of truth
```

## Recommended Architecture

```text
Next.js Web App
  -> Stripe Checkout / Stripe Customer Portal
  -> Stripe Webhooks
  -> Backend entitlement sync

Expo Mobile App
  -> RevenueCat SDK
  -> Apple IAP / Google Play Billing
  -> RevenueCat Webhooks
  -> Backend entitlement sync

Supabase / Backend
  -> subscription_sources
  -> user_entitlements
  -> profile.getSubscription
  -> profile.getUsage
```

The frontend should read user access from the backend, not directly from Stripe or RevenueCat.

Use the existing WorkExperience Next.js backend and tRPC API as the shared backend. Do not create a second backend for the Expo app unless a future scaling or platform requirement makes that necessary.

Recommended ownership:

```text
WorkExperience Next.js backend
  -> tRPC API
  -> Stripe webhook handling
  -> RevenueCat webhook handling
  -> Supabase database writes
  -> entitlement calculation
  -> usage/tier/model access decisions

Expo app
  -> native UI
  -> RevenueCat SDK
  -> Supabase auth session
  -> calls WorkExperience tRPC/API routes

WorkExperience web app
  -> existing web UI
  -> Stripe checkout/customer portal
  -> calls the same WorkExperience tRPC/API routes
```

This keeps one source of truth for paid access while allowing each platform to use the correct payment method.

## Shared Backend With tRPC

The existing WorkExperience backend should become the shared entitlement/access layer.

Suggested backend files/functions:

```text
lib/entitlements.ts
```

Suggested functions:

```ts
getEffectiveUserEntitlement(userId)
recalculateUserEntitlements(userId)
upsertStripeSubscriptionSource(...)
upsertRevenueCatSubscriptionSource(...)
```

Suggested tRPC procedures:

```text
profile.getEntitlement
profile.getSubscription
profile.getUsage
```

`profile.getSubscription` and `profile.getUsage` already exist conceptually, but they currently derive access from Stripe. They should eventually call the provider-neutral entitlement resolver instead.

Example mobile-safe entitlement response:

```ts
{
  tier: 'pro',
  entitlement: 'pro',
  active: true,
  provider: 'revenuecat',
  platform: 'ios',
  expiresAt: '2026-05-17T10:00:00.000Z',
  canPurchase: false,
  manageSubscriptionType: 'apple'
}
```

Suggested `manageSubscriptionType` values:

```text
stripe
apple
google
none
```

Suggested request flow for Expo:

```text
Expo app gets Supabase session
-> Expo sends Supabase access token to WorkExperience tRPC/API
-> WorkExperience validates token
-> protected tRPC procedures resolve ctx.user
-> tRPC returns entitlement/usage/subscription state
```

Important implementation check:

- Confirm the WorkExperience tRPC context accepts `Authorization: Bearer <supabase_access_token>` from mobile clients.
- If it only assumes browser cookies, update the tRPC context to support bearer tokens for Expo.

Shared access flow:

```text
Stripe web purchase
-> Stripe webhook hits WorkExperience
-> WorkExperience writes subscription source
-> WorkExperience recalculates entitlement
-> Web and mobile both see paid access through tRPC

iOS purchase
-> Expo RevenueCat SDK completes Apple IAP
-> RevenueCat webhook hits WorkExperience
-> WorkExperience writes subscription source
-> WorkExperience recalculates entitlement
-> iOS, Android, and web all see paid access through tRPC

Android purchase
-> Expo RevenueCat SDK completes Google Play purchase
-> RevenueCat webhook hits WorkExperience
-> WorkExperience writes subscription source
-> WorkExperience recalculates entitlement
-> Android, iOS, and web all see paid access through tRPC
```

## Identity Rule

Use the same stable user ID across all systems.

```text
Supabase auth user id = RevenueCat appUserID = Stripe customer metadata.user_id
```

This is what allows a user to subscribe on one platform and access paid features everywhere.

## Proposed Entitlement Model

Add a provider-neutral subscription source table.

Suggested table:

```text
subscription_sources
- id
- user_id
- provider
- platform
- status
- tier
- entitlement
- provider_customer_id
- provider_subscription_id
- provider_product_id
- current_period_start
- current_period_end
- expires_at
- cancel_at_period_end
- raw_event
- created_at
- updated_at
```

Suggested provider values:

```text
stripe
revenuecat
```

Suggested platform values:

```text
web
ios
android
```

Suggested tiers:

```text
free
intermediate
pro
enterprise
```

Suggested entitlements:

```text
intermediate
pro
```

Tier ownership:

```text
free
  -> No purchase.
  -> Default tier when the user has no active paid entitlement.

intermediate
  -> Self-serve paid tier.
  -> Purchasable on web through Stripe.
  -> Purchasable on iOS/Android through RevenueCat.

pro
  -> Self-serve paid tier.
  -> Purchasable on web through Stripe.
  -> Purchasable on iOS/Android through RevenueCat.

enterprise
  -> Custom/manual tier.
  -> Not a RevenueCat product initially.
  -> Should be granted through admin/manual backend override or a custom sales process.
```

RevenueCat does not need products for every app tier. It should only represent the mobile self-serve paid tiers unless enterprise is intentionally sold publicly through the stores later.

Optionally add a computed/cache table:

```text
user_entitlements
- user_id
- tier
- entitlement
- active
- active_sources
- expires_at
- updated_at
```

This table can be recalculated whenever Stripe or RevenueCat sends a webhook.

## Product Mapping

Keep one internal product-to-tier mapping.

Example:

```text
STRIPE_INTERMEDIATE_PRICE_ID -> intermediate
STRIPE_PRO_PRICE_ID -> pro

workexperience_intermediate_monthly_ios -> intermediate
workexperience_pro_monthly_ios -> pro

workexperience_intermediate_monthly_android -> intermediate
workexperience_pro_monthly_android -> pro
```

The exact RevenueCat product IDs should match the products configured in App Store Connect and Google Play Console.

No product mapping is needed for `free`; it is the fallback when no active source exists.

Do not map unknown product IDs to `enterprise`. Enterprise should be explicit so a misconfigured Stripe or RevenueCat product cannot accidentally grant the highest tier.

Recommended initial product decision:

```text
Supported app tiers:
  free
  intermediate
  pro
  enterprise

Self-serve paid tiers:
  intermediate
  pro

RevenueCat purchasable tiers:
  intermediate
  pro

Stripe purchasable tiers:
  intermediate
  pro

Manual/custom tier:
  enterprise
```

## Effective Entitlement Resolver

Create one backend function responsible for deciding the user's current tier.

Suggested function:

```text
getEffectiveUserEntitlement(userId)
```

It should:

1. Read all active subscription sources for the user.
2. Ignore expired, refunded, or canceled-with-ended-period sources.
3. Choose the best active tier.
4. Return provider/source details for management UI.

Example result:

```ts
{
  tier: 'pro',
  entitlement: 'pro',
  active: true,
  source: 'revenuecat',
  platform: 'ios',
  expiresAt: '2026-05-17T10:00:00.000Z',
}
```

If multiple sources are active, compute access generously:

```text
Stripe active + iOS expired = paid access from Stripe
iOS active + Stripe canceled = paid access from iOS
Android active + Stripe active = paid access from highest tier
All expired/canceled = free
```

Enterprise should be included in the tier ordering, but it should come from an explicit admin/manual/custom source rather than an unknown provider product ID.

## Stripe Migration Tasks

Keep the current Stripe flow for web, but make it feed the new entitlement model.

Tasks:

- Keep `/api/stripe/checkout`.
- Keep `/api/stripe/webhook`.
- Keep `/api/stripe/portal`.
- Keep `/api/stripe/update`.
- Keep `/api/stripe/sync-subscription`.
- After Stripe subscription sync, upsert a `subscription_sources` row.
- After every Stripe sync, call `recalculateUserEntitlements(userId)`.
- Keep the old `subscriptions` table during transition to avoid breaking existing code.
- Later, decide whether to keep `subscriptions` as a Stripe cache or fully migrate to `subscription_sources`.

The best integration point is after Stripe data is persisted in `lib/stripe.ts`.

## RevenueCat Backend Tasks

Add a new webhook endpoint:

```text
/api/revenuecat/webhook
```

It should:

1. Verify the RevenueCat webhook authorization secret.
2. Read the RevenueCat event.
3. Resolve `app_user_id` to the Supabase user ID.
4. Map RevenueCat entitlement/product to `intermediate` or `pro`.
5. Upsert the RevenueCat source row into `subscription_sources`.
6. Store relevant raw event data for auditing/debugging.
7. Call `recalculateUserEntitlements(userId)`.

RevenueCat event types to handle:

- Initial purchase.
- Renewal.
- Cancellation.
- Expiration.
- Billing issue.
- Product change.
- Refund.
- Transfer, if enabled.

## RevenueCat Dashboard Tasks

In RevenueCat:

1. Create a WorkExperience project.
2. Add the iOS app.
3. Add the Android app.
4. Create entitlements, for example `intermediate` and `pro`.
5. Add iOS products from App Store Connect.
6. Add Android products from Google Play Console.
7. Attach products to the correct entitlement.
8. Create an offering, for example `default`.
9. Configure RevenueCat webhooks to the backend.
10. Configure Apple App Store Server Notifications.
11. Configure Google Real-Time Developer Notifications.

## Apple App Store Connect Tasks

In App Store Connect:

1. Create or confirm the iOS app record.
2. Confirm bundle identifier.
3. Create subscriptions or in-app purchase products.
4. Add subscription group if using subscriptions.
5. Add pricing.
6. Add localization.
7. Add review screenshots/metadata for subscriptions.
8. Generate required App Store Connect keys for RevenueCat.
9. Connect Apple credentials in RevenueCat.
10. Configure App Store Server Notifications.

## Google Play Console Tasks

In Google Play Console:

1. Create or confirm the Android app.
2. Confirm package name.
3. Create subscription or in-app product IDs.
4. Configure base plans/offers if using subscriptions.
5. Create service account credentials.
6. Connect Google Play credentials to RevenueCat.
7. Configure Google Real-Time Developer Notifications through Pub/Sub.
8. Test Real-Time Developer Notifications.

Note: Google service credentials can take time to become usable after creation. Plan for this during testing.

## Frontend Migration Tasks

Update web and mobile UI to use the provider-neutral entitlement state.

Tasks:

- Replace Stripe-only access checks with `getEffectiveUserEntitlement`.
- Update `profile.getSubscription`.
- Update `profile.getUsage`.
- Update usage limit logic.
- Update model access logic.
- Update pricing/payment UI.
- Update upgrade buttons.
- Update payment/account tab.

The current important areas are:

- `lib/trpc/routers/profile.ts`
- `lib/modelAccess.ts`
- `components/PricingTierCard.tsx`
- `app/pricing/page.tsx`
- Chat payment dialogs and upgrade components.

## WorkExperience Route Copy Plan

Do not copy every WorkExperience route into Expo at the start. The best plan is to rebuild the routes that are core to the mobile app or affected by native billing, and keep content/legal/support pages in WebView.

### Phase 1: Must Rebuild Natively In Expo

These routes/screens should be native Expo screens because they affect the mobile app core experience, store compliance, or RevenueCat purchase flow.

```text
/chat
```

Source files:

- `/Users/florin/Documents/Sources/WorkExperience/app/chat/page.tsx`
- `/Users/florin/Documents/Sources/WorkExperience/app/chat/layout.tsx`
- `/Users/florin/Documents/Sources/WorkExperience/app/chat/components/*`
- `/Users/florin/Documents/Sources/WorkExperience/app/chat/utils/chatUtils.ts`

Native Expo target:

```text
app/chat/index.tsx
app/chat/[id].tsx, optional
app/settings/index.tsx
app/subscription/index.tsx
```

Core `/chat` features to rebuild first:

- Chat history.
- Active conversation.
- Send message.
- Stream/display assistant response.
- Model picker.
- Usage-limit checks.
- Premium model blocking.
- Upgrade/paywall trigger.
- Basic profile/settings access.

Add later:

- File attachments.
- Image attachments.
- Chat hiding/password flow.
- Forking messages.
- Chat background/customization.
- Provider API keys.
- Full settings dialog parity.

```text
/pricing, purchase path only
```

Do not necessarily rebuild the whole marketing pricing page. Rebuild the mobile purchase/paywall path natively.

Source files:

- `/Users/florin/Documents/Sources/WorkExperience/app/pricing/page.tsx`
- `/Users/florin/Documents/Sources/WorkExperience/components/PricingTierCard.tsx`
- `/Users/florin/Documents/Sources/WorkExperience/app/chat/components/UpgradeButton.tsx`
- `/Users/florin/Documents/Sources/WorkExperience/app/chat/components/UsageLimitReachedDialog.tsx`

Native Expo target:

```text
app/paywall/index.tsx
app/subscription/index.tsx
```

Native behavior:

- Show RevenueCat offerings.
- Show native iOS/Android price strings from RevenueCat.
- Buy through Apple/Google.
- Restore purchases.
- Refresh backend entitlement after purchase.

```text
Profile/settings payment, usage, and account surfaces
```

These currently live inside the `/chat` profile/settings dialog rather than as separate top-level routes.

Source file:

- `/Users/florin/Documents/Sources/WorkExperience/app/chat/components/ProfileSettingsDialog.tsx`

Native Expo targets:

```text
app/settings/index.tsx
app/settings/account.tsx
app/settings/usage.tsx
app/settings/subscription.tsx
app/settings/attachments.tsx, optional
app/settings/api-keys.tsx, optional
```

Rebuild these tabs first:

- Payment/subscription.
- Usage and limits.
- Account.
- Account deletion.
- Delete chat history.
- Contact/support shortcut.

Rebuild these later:

- Attachments.
- API keys.
- Customization.
- Language settings.

### Additional Native Screen-Like Flows To Account For

These are not all top-level WorkExperience routes, but they should be represented in the native Expo plan because they affect store compliance, subscriptions, or the core chat experience.

```text
Account deletion confirmation
```

Source area:

- `/Users/florin/Documents/Sources/WorkExperience/app/chat/components/ProfileSettingsDialog.tsx`

Native target:

```text
app/settings/account.tsx
```

Why native:

- Required if the app supports account creation.
- Apple requires users to be able to initiate account deletion inside the app.
- Google Play requires an in-app deletion path and a web deletion URL.

```text
Delete chat history confirmation
```

Source area:

- `/Users/florin/Documents/Sources/WorkExperience/app/chat/components/ProfileSettingsDialog.tsx`

Native target:

```text
app/settings/account.tsx
```

Why native:

- Important account/data control.
- Helps support privacy expectations, even though it is separate from full account deletion.

```text
Subscription status/result dialogs
```

Source files:

- `/Users/florin/Documents/Sources/WorkExperience/app/chat/components/SubscriptionSuccessDialog.tsx`
- `/Users/florin/Documents/Sources/WorkExperience/app/chat/components/SubscriptionCanceledDialog.tsx`
- `/Users/florin/Documents/Sources/WorkExperience/app/chat/components/SubscriptionUpdatedDialog.tsx`
- `/Users/florin/Documents/Sources/WorkExperience/app/chat/components/PaymentFailedDialog.tsx`

Native target:

```text
app/subscription/index.tsx
app/paywall/index.tsx
```

Why native:

- RevenueCat purchase, restore, cancellation, and billing issue states should be native.
- Avoid relying on Stripe-style web query parameters for native purchase results.

```text
Usage limit reached / upgrade prompt
```

Source file:

- `/Users/florin/Documents/Sources/WorkExperience/app/chat/components/UsageLimitReachedDialog.tsx`

Native target:

```text
app/chat/index.tsx
app/paywall/index.tsx
app/settings/usage.tsx
```

Why native:

- This is a core paid-access moment.
- It must route to RevenueCat in native apps, not Stripe checkout.

```text
Hidden chat password prompts
```

Source files:

- `/Users/florin/Documents/Sources/WorkExperience/app/chat/components/PasswordPromptDialog.tsx`
- `/Users/florin/Documents/Sources/WorkExperience/app/chat/components/PasswordPromptModal.tsx`
- `/Users/florin/Documents/Sources/WorkExperience/app/chat/components/HideConfirmDialog.tsx`
- `/Users/florin/Documents/Sources/WorkExperience/app/chat/components/HideConfirmModal.tsx`

Native target:

```text
app/chat/index.tsx
```

Why native:

- Part of the core chat/privacy experience.
- Should be included when native `/chat` reaches feature parity for hidden chats.

```text
Attachment upload, preview, and attachment management
```

Source files:

- `/Users/florin/Documents/Sources/WorkExperience/app/chat/components/ChatMain.tsx`
- `/Users/florin/Documents/Sources/WorkExperience/app/chat/components/DeleteAttachmentDialog.tsx`
- `/Users/florin/Documents/Sources/WorkExperience/app/api/ai/chat/upload/route.ts`
- `/Users/florin/Documents/Sources/WorkExperience/app/api/attachments/[id]/route.ts`

Native target:

```text
app/chat/index.tsx
app/settings/attachments.tsx
```

Why native:

- File picker, upload progress, previews, and permissions feel better as native UI.
- This can wait until after the chat MVP if needed.

```text
Personal provider API keys
```

Source area:

- `/Users/florin/Documents/Sources/WorkExperience/app/chat/components/ProfileSettingsDialog.tsx`

Native target:

```text
app/settings/api-keys.tsx
```

Why native:

- Important for power users.
- Not required for first release unless BYO provider keys are a core mobile feature.

```text
Email confirmation / auth callback
```

Source route:

- `/Users/florin/Documents/Sources/WorkExperience/app/auth/confirm/route.ts`

Native target:

```text
Deep link handling in Expo, or keep as web callback.
```

Why account for it:

- Registration, password reset, and email-change flows must land somewhere reliable on mobile.
- This can remain web-based initially, but native deep links improve the experience later.

### Phase 2: Should Consider Native, But Can Wait

These routes are useful on mobile, but they can stay as WebView pages initially.

```text
/login
/register
/forgot-password
/reset-password
/register/success
/register/error
```

Source files:

- `/Users/florin/Documents/Sources/WorkExperience/app/login/page.tsx`
- `/Users/florin/Documents/Sources/WorkExperience/app/register/page.tsx`
- `/Users/florin/Documents/Sources/WorkExperience/app/forgot-password/page.tsx`
- `/Users/florin/Documents/Sources/WorkExperience/app/reset-password/page.tsx`
- `/Users/florin/Documents/Sources/WorkExperience/app/register/success/page.tsx`
- `/Users/florin/Documents/Sources/WorkExperience/app/register/error/page.tsx`

Recommendation:

- Keep in WebView for the first release if auth already works reliably.
- Rebuild natively later if WebView auth/session sharing becomes awkward.
- Native auth becomes more attractive if the Expo app moves away from WebView for `/chat`.

#### Store Policy Check For WebView Auth Routes

Keeping these auth routes in an in-app WebView should be acceptable for an initial release if the routes are polished, reliable, and do not expose prohibited payment flows.

Important distinction:

```text
Allowed target:
  In-app WebView auth pages for login/register/reset flows.

Avoid:
  Sending users out to the default browser for login or registration.
```

Apple specifically warns that linking out to the default browser to sign in or register is a poor user experience and is not appropriate under App Store Review Guideline 4. Apple also requires apps that support account creation to let users initiate account deletion within the app.

Google Play similarly treats account creation inside the app, or an app-directed account creation flow outside the app, as triggering the account deletion requirement. Google requires both an in-app path to request account deletion and a web link resource for deletion.

Policy implications for the plan:

- WebView login/register/reset pages are okay as a first release compromise.
- The auth WebView must feel app-quality on mobile, not like a desktop page squeezed into a phone.
- The app must provide an in-app account deletion path if account creation is available.
- The app must also provide a web account deletion URL for Google Play's Data safety form.
- The app must provide reviewer credentials or a full demo mode for Apple review.
- The auth WebView must not show Stripe checkout or web purchase CTAs inside iOS/Android.
- Any digital subscription purchase initiated from the native app must use RevenueCat with Apple IAP / Google Play Billing.
- If the WebView auth/session flow becomes brittle, rebuild auth natively in Expo.

References:

- Apple App Store Review Guidelines, 4.2 Minimum Functionality and 5.1.1 Privacy: https://developer.apple.com/app-store/review/guidelines/
- Apple account deletion guidance: https://developer.apple.com/support/offering-account-deletion-in-your-app/
- Google Play User Data policy, Account Deletion Requirement: https://support.google.com/googleplay/android-developer/answer/10144311
- Google Play account deletion requirements: https://support.google.com/googleplay/android-developer/answer/13327111
- Google Play payments policy: https://support.google.com/googleplay/android-developer/answer/10281818

### Phase 3: Exclude From Native App Route Set

These routes do not need native copies and do not need to be part of the normal in-app navigation.

```text
/
/features
/apps
/faq
/contact
/privacy
/terms
/security
/cookie-policy
```

Source files:

- `/Users/florin/Documents/Sources/WorkExperience/app/page.tsx`
- `/Users/florin/Documents/Sources/WorkExperience/app/features/page.tsx`
- `/Users/florin/Documents/Sources/WorkExperience/app/apps/page.tsx`
- `/Users/florin/Documents/Sources/WorkExperience/app/faq/page.tsx`
- `/Users/florin/Documents/Sources/WorkExperience/app/contact/page.tsx`
- `/Users/florin/Documents/Sources/WorkExperience/app/privacy/page.tsx`
- `/Users/florin/Documents/Sources/WorkExperience/app/terms/page.tsx`
- `/Users/florin/Documents/Sources/WorkExperience/app/security/page.tsx`
- `/Users/florin/Documents/Sources/WorkExperience/app/cookie-policy/page.tsx`

Recommendation:

- Do not copy these routes into Expo.
- Do not include them in the main native app navigation.
- Keep them available on the public web.
- For store review and compliance, expose only the required legal/support destinations as external links or lightweight settings links.
- Privacy policy and terms should remain reachable from the native app if required by Apple/Google, but they do not need to be native screens.
- Support/contact can be handled with a mail link, support URL, or a minimal native support action instead of copying `/contact`.

Feedback routes should also be excluded unless feedback becomes a core in-app workflow.

```text
/feedback
/feedback/new
/feedback/[id]
/feedback/[id]/edit
```

Source files:

- `/Users/florin/Documents/Sources/WorkExperience/app/feedback/page.tsx`
- `/Users/florin/Documents/Sources/WorkExperience/app/feedback/new/page.tsx`
- `/Users/florin/Documents/Sources/WorkExperience/app/feedback/[id]/page.tsx`
- `/Users/florin/Documents/Sources/WorkExperience/app/feedback/[id]/edit/page.tsx`
- `/Users/florin/Documents/Sources/WorkExperience/app/feedback/components/*`

Recommendation:

- Do not copy to Expo.
- Do not include in native app navigation.
- Link to the web feedback page only if product feedback becomes important inside the app.

### Routes Not Worth Copying

These appear to be demo/test/internal routes or placeholders.

```text
/private
/test-rate-limit
/(shop)/account
/(shop)/isr
/(shop)/ssr
/(shop)/static
```

Source files:

- `/Users/florin/Documents/Sources/WorkExperience/app/private/page.tsx`
- `/Users/florin/Documents/Sources/WorkExperience/app/test-rate-limit/page.tsx`
- `/Users/florin/Documents/Sources/WorkExperience/app/_(shop)/account/page.tsx`
- `/Users/florin/Documents/Sources/WorkExperience/app/_(shop)/isr/page.tsx`
- `/Users/florin/Documents/Sources/WorkExperience/app/_(shop)/ssr/page.tsx`
- `/Users/florin/Documents/Sources/WorkExperience/app/_(shop)/static/page.tsx`

Recommendation:

- Do not copy to Expo.
- Hide from native app navigation.
- Remove or protect from production if not needed.

### Backend/API Routes To Reuse, Not Copy As Screens

These routes should stay in WorkExperience/Next.js as backend APIs. Expo should call them or use the existing tRPC client patterns, but they should not become Expo screens.

```text
/api/trpc/[trpc]
/api/ai/chat
/api/ai/chat-stream
/api/ai/generate-title
/api/ai/select-model
/api/chats
/api/chats/[id]
/api/chats/[id]/messages
/api/messages
/api/attachments/[id]
/api/profile/password
/api/profile/global-password
/api/profile/check-global-password
/api/profile/verify-global-password
/api/currency
```

Stripe routes should stay web/backend only:

```text
/api/stripe/checkout
/api/stripe/portal
/api/stripe/update
/api/stripe/sync-subscription
/api/stripe/sync-customer-email
/api/stripe/webhook
```

Add a new backend route for RevenueCat:

```text
/api/revenuecat/webhook
```

Auth callback should stay in Next.js unless native auth is rebuilt:

```text
/auth/confirm
```

### Recommended Native Copy Order

1. Native subscription/paywall route.
2. Native `/chat` MVP.
3. Native usage/subscription settings.
4. Native account basics.
5. Native login/register, only if WebView auth is painful.
6. Native attachments/API keys/customization.

### Minimal First Native Route Set

For the first serious mobile release, the smallest useful native set is:

```text
/chat
/paywall
/subscription
/settings/usage
/settings/account
```

Everything else can remain in WebView while the mobile app proves out.

## Mobile WebView Purchase Bridge

Because the current Expo app is primarily a WebView wrapper, native purchases need a bridge between the web UI and the native layer.

Recommended short-term flow:

```text
User taps upgrade inside WebView
-> Web app detects native app context
-> Web app sends postMessage to React Native
-> Expo app opens RevenueCat paywall
-> User purchases via Apple/Google
-> RevenueCat webhook updates backend
-> Expo app tells WebView to refresh entitlement
-> Web UI refetches profile.getSubscription/profile.getUsage
```

Example message shape:

```json
{
  "type": "open_revenuecat_paywall",
  "tier": "pro"
}
```

The native app should only show RevenueCat purchase UI if the backend says the user is not already paid through another source.

## Store Compliance Rules

For native store builds:

- iOS app should not send users to Stripe checkout for digital subscriptions/features.
- Android app should not send users to Stripe checkout for digital subscriptions/features.
- Native apps should use RevenueCat/Apple/Google for digital goods.
- Web browser can continue using Stripe.
- Restore purchases must be available on mobile.
- Subscription terms must be clear before purchase.
- Manage subscription destination must match the purchase source.

Suggested management behavior:

```text
source = stripe
  -> open Stripe customer portal

source = revenuecat + platform = ios
  -> open Apple subscription management

source = revenuecat + platform = android
  -> open Google Play subscription management
```

## Double Billing Prevention

Prevent accidental duplicate subscriptions.

Rules:

- If user has active Stripe access, hide or disable mobile RevenueCat purchase CTA.
- If user has active iOS/Android access, hide or disable Stripe checkout CTA.
- If multiple active sources exist, grant the highest tier.
- Show the correct "Manage subscription" action for the provider that owns the active subscription.

Suggested UI state:

```text
Premium active
Managed through: Apple / Google Play / Stripe
```

## Implementation Order

Recommended order:

1. Add `subscription_sources` schema.
2. Add optional `user_entitlements` schema.
3. Add product-to-tier mapping config.
4. Add `getEffectiveUserEntitlement(userId)`.
5. Add `recalculateUserEntitlements(userId)`.
6. Make Stripe sync write to the new provider-neutral model.
7. Refactor `profile.getSubscription` to use effective entitlement.
8. Refactor `profile.getUsage` to use effective entitlement.
9. Add RevenueCat webhook endpoint.
10. Configure RevenueCat project, products, offerings, and webhooks.
11. Add Expo RevenueCat initialization.
12. Add WebView-to-native purchase bridge.
13. Hide Stripe checkout inside iOS/Android WebView.
14. Add restore purchases.
15. Add provider-specific manage subscription actions.
16. Run cross-platform subscription tests.

## Repo-Specific Staged Checklist

Use this as the practical execution checklist. The safest order is backend contract first, mobile consumption second, then native `/chat`.

### Stage 0: Coordination Setup

WorkExperience:

- [ ] Create branch `feature/revenuecat-entitlements`.
- [ ] Confirm current Stripe checkout, portal, webhook, and subscription tests are passing.
- [ ] Confirm current Supabase migrations are applied in the target environment.
- [ ] Add/update documentation for the entitlement response contract.

viel-chat-expo:

- [x] Create branch `feature/revenuecat-mobile`.
- [x] Confirm Expo builds/lint/typecheck pass before changes.
  - `npx expo export --platform all --output-dir /tmp/viel-chat-expo-stage0-export` passed for Android, iOS, and web bundles.
  - `npm run lint` passed.
  - `npm run typecheck` passed.
  - `npm run doctor` passed after allowing network access for `npx expo-doctor`.
- [x] Confirm app package/bundle identifiers are final or close to final.
  - iOS bundle identifier: `chat.viel.app`.
  - Android package: `chat.viel.app`.
- [x] Confirm the app can point at the correct WorkExperience backend URL per environment.
  - Current WebView URL configuration is present: development uses `EXPO_PUBLIC_VIEL_CHAT_URL`, and preview/production use `https://www.viel.chat/chat`.
  - Dedicated WorkExperience tRPC/API URL configuration is present through `EXPO_PUBLIC_WORKEXPERIENCE_API_URL`.
  - `app.config.ts` also exposes `workExperienceApiUrl` through Expo `extra`.

Shared decision:

- [x] Decide tier names for RevenueCat: `intermediate`, `pro`, or one `premium` entitlement.
  - Decision: keep full app tiers as `free`, `intermediate`, `pro`, `enterprise`.
  - RevenueCat should only sell the self-serve paid tiers: `intermediate` and `pro`.
  - `free` is the fallback when no active entitlement exists.
  - `enterprise` is a manual/custom tier, not a RevenueCat product initially.
- [ ] Decide exact iOS product IDs.
- [ ] Decide exact Android product IDs.
- [ ] Decide whether Expo first release keeps `/login` and `/register` in WebView.

### Stage 1: WorkExperience Backend Foundation

WorkExperience:

- [ ] Inspect tRPC auth context and confirm mobile clients can call protected procedures with `Authorization: Bearer <supabase_access_token>`.
- [ ] If needed, update tRPC context to accept Supabase bearer tokens in addition to browser cookie/session auth.
- [ ] Add Supabase migration for `subscription_sources`.
- [ ] Add optional Supabase migration for `user_entitlements`.
- [ ] Add product-to-tier mapping config for Stripe and RevenueCat product IDs.
- [ ] Add `lib/entitlements.ts`.
- [ ] Implement `getEffectiveUserEntitlement(userId)`.
- [ ] Implement `recalculateUserEntitlements(userId)`.
- [ ] Add tests for effective entitlement priority:
  - Stripe active.
  - iOS active.
  - Android active.
  - Multiple active sources.
  - Expired/canceled sources.

viel-chat-expo:

- [ ] No required code changes in this stage.
- [ ] Keep using existing WebView while backend contract is stabilized.

Exit criteria:

- [ ] WorkExperience can calculate a user's access without relying only on Stripe `price_id`.
- [ ] The entitlement resolver has tests.

### Stage 2: Stripe Feeds The New Entitlement Layer

WorkExperience:

- [ ] Keep existing Stripe routes unchanged for users:
  - `/api/stripe/checkout`
  - `/api/stripe/portal`
  - `/api/stripe/update`
  - `/api/stripe/sync-subscription`
  - `/api/stripe/webhook`
- [ ] Update Stripe sync logic so Stripe subscriptions also upsert `subscription_sources`.
- [ ] Call `recalculateUserEntitlements(userId)` after Stripe sync/webhook processing.
- [ ] Keep the existing `subscriptions` table working during migration.
- [ ] Update or add Stripe webhook tests for `subscription_sources` and `user_entitlements`.
- [ ] Confirm current web pricing/payment UI still works.
- [ ] Confirm current web `profile.getSubscription` and `profile.getUsage` still return expected results.

viel-chat-expo:

- [ ] No required code changes in this stage.

Exit criteria:

- [ ] Stripe web purchases still work.
- [ ] Stripe now populates the provider-neutral entitlement layer.
- [ ] Existing web users do not lose access.

### Stage 3: WorkExperience tRPC Contract For Mobile

WorkExperience:

- [ ] Add or update `profile.getEntitlement`.
- [ ] Refactor `profile.getSubscription` to use the effective entitlement resolver.
- [ ] Refactor `profile.getUsage` to use the effective entitlement resolver.
- [ ] Include mobile-safe billing metadata:
  - tier.
  - active entitlement.
  - provider.
  - platform.
  - expiration date.
  - whether the user can purchase.
  - manage subscription type.
- [ ] Make sure mobile clients never receive Stripe secrets or provider secrets.
- [ ] Add tests for the tRPC entitlement response.

viel-chat-expo:

- [x] Add backend URL environment config if missing.
  - Added `EXPO_PUBLIC_WORKEXPERIENCE_API_URL`.
  - Added `workExperienceApiUrl` to Expo `extra`.
  - Development defaults to `http://localhost:3000`; preview/production default to `https://www.viel.chat`.
- [x] Add/confirm Supabase client configuration for mobile.
  - Added `EXPO_PUBLIC_SUPABASE_URL`.
  - Added `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
  - Added a React Native Supabase client using AsyncStorage-backed session persistence.
- [x] Add a small API/tRPC client layer for WorkExperience.
  - Added a lightweight fetch-based `profile.getEntitlement` caller for `/api/trpc`.
  - The client sends `Authorization: Bearer <supabase_access_token>`.
- [x] Confirm Expo can call a protected WorkExperience tRPC procedure with the Supabase access token.
  - Client wiring is in place.
  - Added `/debug-login` to create a native Supabase session with a WorkExperience test user.
  - Use `/debug-entitlement` after `/debug-login` to verify the protected `profile.getEntitlement` tRPC call.
  - Confirmed response: `tier: free`, `entitlement: none`, `active: false`, `canPurchase: true`.
- [x] Add a temporary/debug entitlement fetch during development if useful.
  - Added `/debug-entitlement`, disabled in production.

Exit criteria:

- [x] Expo can authenticate with Supabase and call WorkExperience protected tRPC.
- [x] Expo can fetch the same entitlement state as web.

### Stage 4: RevenueCat Backend Integration

WorkExperience:

- [ ] Add environment variables for RevenueCat webhook verification.
- [ ] Add `/api/revenuecat/webhook`.
- [ ] Verify webhook authorization/header secret.
- [ ] Parse RevenueCat event payload.
- [ ] Resolve RevenueCat `app_user_id` to Supabase user ID.
- [ ] Map RevenueCat product/entitlement to internal tier.
- [ ] Upsert RevenueCat rows into `subscription_sources`.
- [ ] Call `recalculateUserEntitlements(userId)` after every relevant RevenueCat event.
- [ ] Store useful raw event data for audit/debugging.
- [ ] Add tests for purchase, renewal, expiration, cancellation, refund, and billing issue events.

viel-chat-expo:

- [ ] No purchase UI required yet.
- [ ] Confirm planned RevenueCat `appUserID` will be the Supabase user ID.

RevenueCat dashboard:

- [ ] Create project.
- [ ] Add iOS app.
- [ ] Add Android app.
- [ ] Create entitlements/products/offerings.
- [ ] Configure webhook URL to WorkExperience.
- [ ] Configure Apple App Store Server Notifications.
- [ ] Configure Google Real-Time Developer Notifications.

Exit criteria:

- [ ] RevenueCat webhook can update WorkExperience entitlement state in test/sandbox.

### Stage 5: Expo Native RevenueCat Purchase Surface

WorkExperience:

- [ ] Ensure `profile.getEntitlement` returns `canPurchase` and `manageSubscriptionType`.
- [ ] Ensure native app users cannot be sent to Stripe checkout for digital goods.

viel-chat-expo:

- [ ] Configure RevenueCat API keys per platform/environment.
- [ ] Initialize RevenueCat after Supabase auth is available.
- [ ] Log in to RevenueCat using the Supabase user ID as `appUserID`.
- [ ] Add native `app/paywall/index.tsx`.
- [ ] Add native `app/subscription/index.tsx`.
- [ ] Fetch RevenueCat offerings.
- [ ] Show native iOS/Android prices from RevenueCat.
- [ ] Implement purchase.
- [ ] Implement restore purchases.
- [ ] Refresh WorkExperience entitlement after purchase/restore.
- [ ] Add provider-specific manage subscription behavior:
  - Apple subscription settings.
  - Google Play subscription settings.
  - Stripe portal only on web or for Stripe-managed users where allowed.
- [ ] Hide/disable purchase CTA when backend says the user already has active paid access.

Exit criteria:

- [ ] iOS sandbox purchase unlocks access through WorkExperience.
- [ ] Android test purchase unlocks access through WorkExperience.
- [ ] Restore purchases works.
- [ ] Duplicate billing is blocked in UI.

### Stage 6: Native Account, Usage, And Compliance Screens

WorkExperience:

- [ ] Ensure tRPC procedures exist for account details, usage, account deletion, and delete chat history.
- [ ] Ensure account deletion also cleans or ignores subscription/entitlement records safely.
- [ ] Provide a web account deletion URL for Google Play requirements.

viel-chat-expo:

- [ ] Add native `app/settings/account.tsx`.
- [ ] Add native `app/settings/usage.tsx`.
- [ ] Add native account deletion confirmation.
- [ ] Add native delete chat history confirmation.
- [ ] Add lightweight support/contact action, for example `mailto:`.
- [ ] Add legal links if required:
  - Privacy policy.
  - Terms.
  - Account deletion web URL.
- [ ] Keep marketing/support/content pages out of native navigation.

Exit criteria:

- [ ] App has an in-app account deletion path.
- [ ] App has usage visibility.
- [ ] App has required legal/support links without copying web content pages.

### Stage 7: Native `/chat` MVP

WorkExperience:

- [ ] Confirm mobile can use existing chat/tRPC/API endpoints.
- [ ] Confirm chat streaming endpoint works from Expo or provide a mobile-compatible alternative.
- [ ] Confirm model access and usage limits use effective entitlement.
- [ ] Confirm attachment upload API can support native clients later.

viel-chat-expo:

- [ ] Add native `/chat` route.
- [ ] Load chat history.
- [ ] Load active chat messages.
- [ ] Send a message.
- [ ] Display assistant response.
- [ ] Add model picker.
- [ ] Enforce model access from WorkExperience entitlement/usage.
- [ ] Show usage-limit prompt when blocked.
- [ ] Route upgrade prompt to native RevenueCat paywall.
- [ ] Add basic loading/error/empty states.

Exit criteria:

- [ ] User can complete the core chat loop natively.
- [ ] Paid model/usage gates behave the same on web and mobile.
- [ ] Upgrade moments route to RevenueCat, not Stripe.

### Stage 8: Native `/chat` Feature Parity Additions

WorkExperience:

- [ ] Confirm APIs for hidden chats, passwords, attachments, provider keys, and settings are stable for mobile.
- [ ] Add or adjust endpoints only where native clients need different request shapes.

viel-chat-expo:

- [ ] Add file/image picker support.
- [ ] Add attachment upload, preview, delete.
- [ ] Add hidden chat password prompts.
- [ ] Add hide/unhide chat flows.
- [ ] Add fork message flow.
- [ ] Add chat background/customization if still needed.
- [ ] Add `app/settings/attachments.tsx` if attachment management matters on mobile.
- [ ] Add `app/settings/api-keys.tsx` if provider keys matter on mobile.
- [ ] Add native auth/deep-link callback handling if WebView auth is not good enough.

Exit criteria:

- [ ] Native `/chat` covers the mobile-critical features from the web app.

### Stage 9: Store Readiness And Release QA

WorkExperience:

- [ ] Confirm Stripe remains available on web.
- [ ] Confirm Stripe is not exposed as a native-app digital goods purchase path.
- [ ] Confirm RevenueCat webhook production URL is configured.
- [ ] Confirm production Supabase migrations are applied.
- [ ] Confirm privacy policy/terms/account deletion web URLs are live.
- [ ] Prepare reviewer credentials or demo account.

viel-chat-expo:

- [ ] Run `npm run lint`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run doctor`.
- [ ] Build iOS preview.
- [ ] Build Android preview.
- [ ] Test on physical iPhone.
- [ ] Test on physical Android device.
- [ ] Test account creation/login/reset flows.
- [ ] Test account deletion.
- [ ] Test iOS purchase/restore/manage subscription.
- [ ] Test Android purchase/restore/manage subscription.
- [ ] Test web Stripe subscriber access on mobile.
- [ ] Test mobile RevenueCat subscriber access on web.
- [ ] Confirm legal/support links open correctly.

Exit criteria:

- [ ] Cross-platform access works.
- [ ] Store purchase rules are respected.
- [ ] App is ready for TestFlight/internal testing.

## Testing Checklist

Web / Stripe:

- Stripe checkout creates a paid subscription.
- Stripe webhook updates `subscription_sources`.
- Stripe webhook recalculates `user_entitlements`.
- Stripe customer portal cancellation is reflected in the app.
- Stripe upgrade/downgrade still works.
- Stripe scheduled downgrade still works.

iOS / RevenueCat:

- RevenueCat SDK identifies the Supabase user ID.
- iOS purchase grants correct entitlement.
- RevenueCat webhook reaches backend.
- Backend updates entitlement.
- Web unlocks after iOS purchase.
- Restore purchases works.
- Cancellation/expiration downgrades after entitlement ends.

Android / RevenueCat:

- RevenueCat SDK identifies the Supabase user ID.
- Android purchase grants correct entitlement.
- RevenueCat webhook reaches backend.
- Google Real-Time Developer Notifications are connected.
- Backend updates entitlement.
- Web unlocks after Android purchase.
- Restore purchases works.
- Cancellation/expiration downgrades after entitlement ends.

Cross-platform:

- Stripe purchase unlocks mobile.
- iOS purchase unlocks web.
- Android purchase unlocks web.
- Active Stripe user cannot accidentally buy iOS/Android subscription.
- Active iOS/Android user cannot accidentally buy Stripe subscription.
- Usage limits match the active tier regardless of provider.
- Model access matches the active tier regardless of provider.
- Account deletion does not leave broken entitlement records.

## Main Risk Areas

1. Data model risk

   The existing one-row-per-user `subscriptions` table is Stripe-shaped. Adding RevenueCat directly into it will make future logic brittle.

2. Double billing risk

   Without provider-neutral access checks, users may subscribe twice on web and mobile.

3. Store review risk

   If the native app exposes Stripe checkout for digital goods, Apple or Google may reject the app.

4. Identity risk

   If RevenueCat `appUserID`, Stripe metadata, and Supabase user IDs do not match, cross-platform unlock will fail.

5. Usage-limit risk

   Usage and model access currently derive from Stripe price IDs. These must move to effective entitlement/tier.

## Recommended Final Shape

```text
WorkExperience Web
  Next.js + Stripe

WorkExperience Mobile
  Expo + RevenueCat

Shared Backend
  Stripe webhooks
  RevenueCat webhooks
  Supabase entitlement tables

Shared Access Layer
  getEffectiveUserEntitlement(userId)
  recalculateUserEntitlements(userId)
```

The heart of the migration is this:

```text
Stripe can stay, but Stripe should stop being the app's definition of a paid user.
```

The app should define paid access through its own entitlement layer, with Stripe and RevenueCat both feeding into it.
