# Store Review Risk Review

Last reviewed: April 16, 2026

This review is focused on the current Expo wrapper and the published Viel Chat website policies.

## Highest Risks

1. Payment/subscription policy risk

   The public privacy policy mentions Stripe for payment processing and subscription management. If the iOS app allows users to buy digital AI access, subscriptions, credits, or premium chat features through Stripe, Apple may require Apple in-app purchase. Google may similarly require Play Billing for digital goods sold in the Android app. This is the largest likely store-review blocker.

   Suggested mitigation: before review, either implement required store billing, hide external digital purchase flows in the native app where policy requires it, or document a clearly allowed exception.

2. WebView/minimum functionality risk

   The native app is primarily a WebView wrapper around `https://www.viel.chat/chat`. Apple can reject apps that feel like a thin website wrapper. The current wrapper has useful loading/error handling and link controls, but the mobile web experience must feel polished, app-like, and reliable.

   Suggested mitigation: make sure the mobile web app has strong mobile UX, no desktop-only layout, clear app value, working sessions, good empty states, and reviewer notes explaining multi-model chat/forking.

3. Account deletion risk

   The privacy policy says users may request deletion. Stores increasingly expect a clear account deletion path for apps that allow account creation.

   Suggested mitigation: add or confirm an in-app account deletion flow. A support-only request path may be weaker than a self-service settings flow.

4. App Privacy/Data Safety mismatch risk

   The policy lists account data, date of birth, chat history, device/browser info, IP/approximate country, usage patterns, cookies, analytics, advertising cookies, AI providers, Supabase, Stripe, and Google Tag Manager. Store answers must match the real app behavior.

   Suggested mitigation: complete `docs/store-privacy-data-safety.md` and review it whenever web analytics, AI providers, payments, or auth changes.

5. Third-party/social login risk

   The security policy mentions OAuth providers. If the iOS app offers third-party login such as Google and does not also offer Sign in with Apple, Apple may require Sign in with Apple unless an exception applies.

   Suggested mitigation: confirm the login methods visible inside the app and add Sign in with Apple if required.

## Medium Risks

1. AI content safety and age rating

   Terms and privacy say the service is for users 18+. Store age rating, target audience, and content moderation answers should be consistent with adult AI chat usage.

2. External links and navigation

   The wrapper blocks unapproved hosts and opens some external HTTPS links outside the app. This is good, but OAuth, Stripe, email verification, password reset, legal links, and support links must be tested on devices.

3. Cookie consent in WebView

   The policy references optional cookies and in-app cookie settings. Confirm the cookie banner/settings work correctly inside the native WebView, including on small screens.

4. File uploads and device permissions

   The native app does not declare obvious camera/location/contact permissions in `app.config.ts`, but WebView file uploads can still invoke system pickers. If chat with files is available, test it and disclose the related data category.

5. Crash reporting gap

   The native app currently has no obvious crash reporting dependency. That is not a store blocker, but it reduces visibility during TestFlight/internal testing.

## Lower Risks

1. iPad support

   `supportsTablet` is `false`, which is fine. Do not upload iPad screenshots unless tablet support is enabled.

2. Export compliance

   `ITSAppUsesNonExemptEncryption` is set to `false`. This is usually consistent with ordinary HTTPS/TLS use, but review it if Viel Chat adds custom encryption or end-to-end encryption.

3. Bundle/package naming

   `com.fschwall.vielchat` is set consistently for iOS and Android. Treat it as final once store records are created.

## Recommended Next Changes

- [ ] Decide the iOS/Android payment strategy before first review build.
- [ ] Confirm account deletion exists from inside the app.
- [ ] Prepare reviewer credentials and seed data.
- [ ] Run a full physical-device QA pass using `docs/production-launch-checklist.md`.
- [ ] Consider adding crash reporting before wider beta testing.
- [ ] Capture screenshots from real store-candidate builds.
