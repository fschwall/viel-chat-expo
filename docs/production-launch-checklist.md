# Viel Chat Production Launch Checklist

Last reviewed: April 16, 2026

This checklist is for the Expo iOS/Android wrapper around `https://www.viel.chat/chat`.
It assumes the native app mostly hosts the Viel Chat web app in `react-native-webview`.

## Current App Facts

- App name: `Viel Chat`
- Apple bundle ID: `chat.viel.app`
- Android package: `chat.viel.app`
- Production URL: `https://www.viel.chat/chat`
- Marketing URL: `https://www.viel.chat/`
- Privacy policy URL: `https://www.viel.chat/privacy`
- Terms URL: `https://www.viel.chat/terms`
- Security policy URL: `https://www.viel.chat/security`
- Support URL: `https://www.viel.chat/contact`
- Support email: `contactus@viel.chat`
- Legal entity: `Viel UK Limited`
- Company number: `17036811`
- Registered office: `11a Front Street, Monkseaton, Whitley Bay, United Kingdom, NE25 8AN`
- Minimum age from website terms/privacy: `18+`

## Blocking Before Public Release

- [ ] D-U-N-S number received and Apple Developer Program organization enrollment completed.
- [ ] Apple Developer account team name matches the intended public seller/developer name.
- [ ] Google Play developer account created and verified.
- [ ] Apple bundle ID created or confirmed as `chat.viel.app`.
- [ ] Google Play app record created with package `chat.viel.app`.
- [ ] Privacy policy, terms, support, and contact pages remain reachable without login.
- [ ] Production web app at `https://www.viel.chat/chat` is stable, HTTPS-only, and mobile-friendly.
- [ ] Dedicated review account created, tested, and documented for Apple/Google reviewers.
- [ ] Account deletion is available from inside the app or clearly reachable from account settings.
- [ ] Payment/subscription flow reviewed for Apple and Google policy compliance.
- [ ] Data safety and App Privacy answers completed from `docs/store-privacy-data-safety.md`.
- [ ] First iOS build tested through TestFlight.
- [ ] First Android build tested through Play internal testing.
- [ ] Google closed testing completed if the Play account is a new personal developer account that is subject to the 12 tester / 14 day rule.

## Repository Checks

- [x] EAS build profiles exist in `eas.json`.
- [x] Production build scripts exist in `package.json`.
- [x] Expo config sets production web URL for production builds.
- [x] App icon and splash paths are configured.
- [x] `.env` is ignored by git.
- [x] `npm run typecheck` passes as of April 16, 2026.
- [x] `npm run lint` passes as of April 16, 2026.
- [x] `npm run doctor` passes as of April 16, 2026.
- [ ] Preview iOS build succeeds.
- [ ] Preview Android build succeeds.
- [ ] Production iOS build succeeds.
- [ ] Production Android build succeeds.

## Apple App Store Connect

- [ ] Create app record after Apple organization enrollment is ready.
- [ ] Name: `Viel Chat`.
- [ ] Subtitle, maximum 30 characters.
- [ ] Promotional text, maximum 170 characters.
- [ ] Description.
- [ ] Keywords.
- [ ] Category.
- [ ] Age rating set consistently with `18+` terms.
- [ ] Privacy policy URL: `https://www.viel.chat/privacy`.
- [ ] Support URL: `https://www.viel.chat/contact`.
- [ ] Marketing URL: `https://www.viel.chat/`.
- [ ] Copyright/legal owner.
- [ ] App Review contact details.
- [ ] Reviewer credentials and notes.
- [ ] Export compliance answer checked against actual encryption use.
- [ ] App Privacy labels completed.
- [ ] If the app supports account creation, account deletion instructions completed.
- [ ] If third-party/social login is available, Sign in with Apple requirement reviewed.
- [ ] If digital subscriptions, credits, AI access, or premium features are sold, Apple IAP requirement reviewed.
- [ ] iPhone screenshots prepared for required current App Store display sizes.
- [ ] iPad screenshots omitted unless tablet support is enabled.
- [ ] TestFlight build tested on physical iPhone.

## Google Play Console

- [ ] App created with package `chat.viel.app`.
- [ ] App access instructions and reviewer credentials completed.
- [ ] Data Safety completed.
- [ ] Content rating questionnaire completed.
- [ ] Target audience set to adult users if keeping `18+`.
- [ ] Privacy policy URL: `https://www.viel.chat/privacy`.
- [ ] Developer contact details completed.
- [ ] Store listing short description, maximum 80 characters.
- [ ] Full description.
- [ ] Phone screenshots, at least 2.
- [ ] App icon, 512 x 512.
- [ ] Feature graphic, 1024 x 500.
- [ ] Android App Bundle uploaded.
- [ ] Internal testing release completed.
- [ ] Closed testing plan prepared if required.
- [ ] Pre-launch report reviewed before production rollout.
- [ ] Payments/subscriptions checked against Play Billing requirements.
- [ ] Sensitive permissions declaration checked after uploading the AAB.
- [ ] Target API level checked against the current Play requirement.

## Real Device QA

- [ ] Fresh install opens `https://www.viel.chat/chat`.
- [ ] Login works.
- [ ] Register works.
- [ ] Logout works.
- [ ] Forgot password or email verification works.
- [ ] Chat creation works.
- [ ] Multi-model responses work.
- [ ] File/document upload works if exposed in the mobile web app.
- [ ] Stripe/payment flow works or is hidden/handled according to store policy.
- [ ] Cookie banner/settings work in WebView.
- [ ] External links open outside the app where expected.
- [ ] Android hardware back behavior feels correct.
- [ ] Keyboard does not cover the message composer.
- [ ] Session persists after app restart.
- [ ] App resumes after backgrounding.
- [ ] Poor network shows a useful recovery path.
- [ ] Dark/light mode is acceptable.
- [ ] App does not expose desktop-only layout issues on small phones.

## Store Copy Starters

Subtitle:

```text
Compare AI models
```

Google Play short description:

```text
Compare AI models and find better answers in one chat app.
```

Full description starter:

```text
Viel Chat lets you compare responses from multiple AI models in one place. Ask a question, explore different model perspectives, fork conversations, and continue with the answer that works best for you.

Use Viel Chat for research, writing, brainstorming, learning, and everyday AI conversations.
```

Reviewer notes starter:

```text
Viel Chat is an AI chat service that lets users compare responses from multiple AI models and continue conversations with different models. Please use the provided reviewer account to access the main chat experience at launch. The app loads the production Viel Chat service in a native mobile shell and opens unsupported external links outside the app.
```

## Official References

- Apple App Store Connect app information: https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/
- Apple screenshot specifications: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/
- Google Play testing requirements for new personal accounts: https://support.google.com/googleplay/android-developer/answer/14151465
- Google Play target API requirements: https://support.google.com/googleplay/android-developer/answer/11926878
- Expo EAS Submit: https://docs.expo.dev/submit/introduction/
