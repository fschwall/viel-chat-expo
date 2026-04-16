# Store Privacy And Data Safety Draft

Last reviewed: April 16, 2026

This is a working draft for App Store Connect App Privacy and Google Play Data Safety.
Confirm every answer against the production web app before submission. This is not legal advice.

Sources used:

- Public privacy policy: `https://www.viel.chat/privacy`
- Public terms: `https://www.viel.chat/terms`
- Public security policy: `https://www.viel.chat/security`
- Native wrapper config in this repository

## Public Policy Summary

The published privacy policy says Viel Chat may collect:

- Name and email address.
- Date of birth for age verification.
- Account preferences and settings.
- Chat messages and conversation history.
- Device information and browser type.
- IP address and approximate location such as country.
- Usage patterns and preferences.
- Optional cookies and similar technologies for analytics, personalisation, advertising cookies, and marketing communications where consent is given.

The published policy lists these service providers:

- Microsoft Azure.
- Amazon Web Services.
- Vercel.
- OpenAI.
- Google Gemini.
- Anthropic Claude.
- OpenRouter.
- Supabase.
- Stripe.

The website also loads Google Tag Manager (`GTM-KFKGJVMB`), so analytics/cookie answers must include the production GTM setup.

## App Store Connect App Privacy Draft

Likely data types to disclose:

- Contact Info: name and email address.
- User Content: chat messages, conversation history, and uploaded content if file/document chat is available.
- Identifiers: user ID/account ID, and possibly device or installation identifiers if used by analytics/auth/payment tooling.
- Usage Data: product interaction, usage patterns, preferences, analytics events.
- Diagnostics: only if crash logs/performance diagnostics are collected by the web app, hosting, or any added native crash SDK.
- Location: approximate location if IP/country is collected.
- Purchases: if Stripe subscriptions or purchase history are associated with user accounts.

Likely purposes:

- App functionality.
- Account management.
- Analytics/product improvement.
- Fraud prevention/security.
- Customer support.
- Payment/subscription management.
- Personalisation, if model preferences/settings affect the experience.
- Marketing, only if promotional email or advertising cookies are enabled.

Likely linked to user:

- Contact Info.
- User Content.
- Purchases.
- User ID/account ID.
- Usage data tied to account.
- Approximate location tied to IP/session/account logs.

Likely not collected by the native wrapper itself:

- Precise location.
- Contacts.
- Photos/videos from the device library, unless file upload allows users to select them.
- Camera/microphone, unless the web app requests these through WebView.
- Health/fitness data.
- Financial info entered directly into the app, unless Stripe/customer billing data is exposed beyond Stripe-hosted checkout.

Tracking answer:

- Use `No` only if Viel Chat does not use data to track users across other companies' apps or websites for advertising, advertising measurement, or data broker purposes.
- Use `Yes` if advertising cookies, third-party ad pixels, or cross-site advertising measurement are enabled in the mobile WebView experience.
- If `Yes`, review whether App Tracking Transparency is required on iOS.

Sale of data:

- The privacy policy says personal information is not sold, traded, or transferred without consent except listed circumstances, so the expected answer is `No data sold`.

## Google Play Data Safety Draft

Likely collected data categories:

- Personal info: name, email address, date of birth.
- App activity: app interactions, in-app search or chat activity, chat/conversation history.
- App info and performance: diagnostics only if crash/performance collection is active.
- Device or other IDs: if analytics/auth/payment/fraud tooling uses device or installation identifiers.
- Location: approximate location from IP/country.
- Financial info: purchase history/subscription status if Stripe subscription data is associated with the user account.
- Files and docs: only if users can upload files/documents/images in the mobile app.

Likely purposes:

- App functionality.
- Analytics.
- Fraud prevention, security, and compliance.
- Account management.
- Developer communications.
- Advertising or marketing only if those cookies/emails are active for the app experience.

Shared with third parties:

- Yes, with service providers/processors listed in the privacy policy.
- AI prompts/user content are shared with selected AI model providers as needed to generate responses.
- Payment/customer data is shared with Stripe for payment processing and subscriptions.
- Hosting/database/auth data is processed by infrastructure providers.

Encrypted in transit:

- Expected answer: `Yes`, based on HTTPS/TLS use and the security policy.

Users can request deletion:

- Expected answer: `Yes`, based on the privacy policy. Confirm there is an in-app account deletion flow or a clear support deletion request path before submission.

Optional vs required:

- Account data, chat content, and operational logs are required for core app functionality.
- Analytics, advertising cookies, personalisation cookies, and marketing communications should be optional if controlled by consent.

## Questions To Confirm Before Submission

- [ ] Does the mobile WebView expose Stripe checkout, subscriptions, credits, or paid AI access?
- [ ] Does the app sell digital services/content that must use Apple IAP or Google Play Billing?
- [ ] Is Google Tag Manager configured only for analytics, or also advertising/remarketing?
- [ ] Are analytics events linked to logged-in users?
- [ ] Is there a native crash reporting SDK, or only web/server logs?
- [ ] Can users upload files, images, PDFs, or documents from the mobile app?
- [ ] Does the web app request camera, microphone, photo library, contacts, or location?
- [ ] Is account deletion available directly in account settings?
- [ ] Are AI prompts retained by third-party model providers, or covered by provider zero-retention/commercial terms?
- [ ] Are users outside the UK/EU supported, especially the US?

## Suggested Reviewer Privacy Note

```text
Viel Chat collects account information and chat content to provide the AI chat service. Chat prompts may be sent to selected AI model providers to generate responses. The app uses service providers for hosting, authentication, payments, analytics, and AI processing, as described in the public privacy policy at https://www.viel.chat/privacy. Users may request deletion of their account and data through the service or by contacting contactus@viel.chat.
```
