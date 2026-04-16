# Viel Chat Expo

This Expo app wraps the Viel Chat web app in a native shell for iOS and Android.

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

3. Start the local Viel Chat web app on port `3000`

   The mobile app loads your web app inside a WebView.

   - iOS simulator uses `http://localhost:3000`
   - Android emulator uses `http://10.0.2.2:3000`
   - You can override both with `EXPO_PUBLIC_VIEL_CHAT_URL`

   Example:

   ```bash
   EXPO_PUBLIC_VIEL_CHAT_URL=http://192.168.1.50:3000 npx expo start
   ```

## Environment

Copy `.env.example` to `.env` and adjust values for your app:

```bash
cp .env.example .env
```

- `APP_ENV=development|preview|production`
- `EXPO_PUBLIC_VIEL_CHAT_URL` for local development
- `EXPO_PUBLIC_VIEL_CHAT_ALLOWED_HOSTS` for extra WebView hostnames, without `https://` or paths
- `EXPO_IOS_BUNDLE_IDENTIFIER` for App Store builds
- `EXPO_ANDROID_PACKAGE` for Play Store builds
- `IOS_BUILD_NUMBER` and `ANDROID_VERSION_CODE` for release versioning

The dynamic Expo config in `app.config.ts` uses production defaults for `production` builds and staging defaults for `preview` builds.

Recommended starting values for this project:

```env
APP_ENV=development
APP_VERSION=1.0.0
IOS_BUILD_NUMBER=1
ANDROID_VERSION_CODE=1
EXPO_IOS_BUNDLE_IDENTIFIER=com.fschwall.vielchat
EXPO_ANDROID_PACKAGE=com.fschwall.vielchat
EXPO_PUBLIC_VIEL_CHAT_URL=http://localhost:3000
EXPO_PUBLIC_VIEL_CHAT_ALLOWED_HOSTS=www.viel.chat
```

For local development, `app.config.ts` now loads `.env` automatically. For EAS builds, set the same values in your EAS environment or build profile secrets.

## Build profiles

This project now includes `eas.json` profiles:

```bash
npx eas build --platform ios --profile preview
npx eas build --platform android --profile preview
npx eas build --platform ios --profile production
npx eas build --platform android --profile production
```

Or use the package scripts:

```bash
npm run build:ios:preview
npm run build:android:preview
npm run build:ios:production
npm run build:android:production
```

Submission commands after your first successful production builds:

```bash
npm run submit:ios:production
npm run submit:android:production
```

Recommended first-release sequence:

1. Create `.env` from `.env.example` and fill in your final app IDs and local dev URL.
2. Run `npm run lint` and `npm run typecheck`.
3. Log in to Expo with `npx eas login`.
4. Configure credentials with `npx eas credentials`.
5. Build preview binaries with `npm run build:ios:preview` and `npm run build:android:preview`.
6. Install those builds on physical devices and test login, links, keyboard, backgrounding, and bad-network states.
7. Increase `IOS_BUILD_NUMBER` and `ANDROID_VERSION_CODE` if needed for another release candidate.
8. Run `npm run build:ios:production` and `npm run build:android:production`.
9. Submit with `npm run submit:ios:production` and `npm run submit:android:production`.
10. Release first to TestFlight and Play internal testing before public rollout.

Before the first production build, make sure:

- Apple App Store Connect is set up
- Google Play Console is set up
- Your production web app is deployed on HTTPS
- Bundle/package identifiers are final
- Icons, splash, support URL, and privacy policy are ready

## Checks

```bash
npm run lint
npm run typecheck
npm run doctor
```

## Still required outside the repo

- Physical-device QA on iPhone and Android
- TestFlight and Play internal testing
- Crash reporting / analytics
- Privacy policy and store listing assets
- Deep-link and authentication validation if your web app uses sign-in redirects
- Final app review against Apple and Google store guidelines

## Suggested final values

Replace the defaults in `app.config.ts` and `.env` if your real production setup differs:

- iOS bundle identifier: `com.fschwall.vielchat`
- Android package: `com.fschwall.vielchat`
- Production web URL: `https://www.viel.chat/chat`
- Preview web URL: `https://www.viel.chat/chat`

If those domains are not your real deployed URLs, update them before shipping. Right now they are project assumptions, not verified deployment values.

## Useful docs

- [Expo EAS Build](https://docs.expo.dev/build/introduction/)
- [Expo app config](https://docs.expo.dev/workflow/configuration/)
- [react-native-webview](https://github.com/react-native-webview/react-native-webview)
