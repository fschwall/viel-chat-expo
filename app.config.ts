import 'dotenv/config';
import type { ExpoConfig } from 'expo/config';

const appEnv = process.env.APP_ENV ?? 'development';
const appVersion = process.env.APP_VERSION ?? '1.0.0';
const iosBuildNumber = process.env.IOS_BUILD_NUMBER ?? '1';
const androidVersionCode = Number.parseInt(process.env.ANDROID_VERSION_CODE ?? '1', 10);
const bundleIdentifier = process.env.EXPO_IOS_BUNDLE_IDENTIFIER ?? 'com.fschwall.vielchat';
const androidPackage = process.env.EXPO_ANDROID_PACKAGE ?? 'com.fschwall.vielchat';
const productionUrl = 'https://www.viel.chat/chat';

const getDefaultUrl = () => {
  if (appEnv === 'production') {
    return productionUrl;
  }

  if (appEnv === 'preview') {
    return productionUrl;
  }

  return process.env.EXPO_PUBLIC_VIEL_CHAT_URL;
};

const vielChatUrl = getDefaultUrl() ?? 'http://localhost:3000';
const extraAllowedHosts = (process.env.EXPO_PUBLIC_VIEL_CHAT_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const config: ExpoConfig = {
  name: 'Viel Chat',
  slug: 'viel-chat-expo',
  version: appVersion,
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'vielchat',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    supportsTablet: false,
    bundleIdentifier,
    buildNumber: iosBuildNumber,
    associatedDomains: [],
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: androidPackage,
    versionCode: Number.isNaN(androidVersionCode) ? 1 : androidVersionCode,
    adaptiveIcon: {
      backgroundColor: '#F8DDC4',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 220,
        resizeMode: 'contain',
        backgroundColor: '#F8DDC4',
        dark: {
          backgroundColor: '#151515',
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    appEnv,
    vielChatUrl,
    vielChatAllowedHosts: extraAllowedHosts,
    router: {},
    eas: {
      projectId: '1f018771-aca9-4b95-9c8f-a354586e4e6f',
    },
  },
  owner: 'fschwall',
};

export default config;
