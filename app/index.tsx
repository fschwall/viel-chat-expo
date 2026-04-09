import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';

type ExtraConfig = {
  appEnv?: string;
  vielChatAllowedHosts?: string[];
  vielChatUrl?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as ExtraConfig;

const DEFAULT_URL =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3000'
    : Platform.OS === 'ios'
      ? 'http://localhost:3000'
      : 'https://www.viel.chat';
const VIEL_CHAT_URL = extra.vielChatUrl ?? process.env.EXPO_PUBLIC_VIEL_CHAT_URL ?? DEFAULT_URL;
const PRIMARY_HOST = new URL(VIEL_CHAT_URL).host;
const ALLOWED_HOSTS = new Set([PRIMARY_HOST, ...(extra.vielChatAllowedHosts ?? [])]);

const openExternalUrl = async (url: string) => {
  try {
    await Linking.openURL(url);
  } catch {
    // If the device cannot open the URL, the WebView error state still gives the user a way forward.
  }
};

export default function HomeScreen() {
  const [retryToken, setRetryToken] = useState(0);

  const handleShouldStartLoad = (request: ShouldStartLoadRequest) => {
    if (!request.url) {
      return false;
    }

    const nextUrl = new URL(request.url);
    const isAllowedHost = ALLOWED_HOSTS.has(nextUrl.host);
    const isHttpUrl = nextUrl.protocol === 'http:' || nextUrl.protocol === 'https:';
    const isInitialDocument = request.url === VIEL_CHAT_URL || request.isTopFrame;

    if (isHttpUrl && isAllowedHost) {
      return true;
    }

    if (isHttpUrl && isInitialDocument) {
      void openExternalUrl(request.url);
      return false;
    }

    if (!isHttpUrl) {
      void openExternalUrl(request.url);
      return false;
    }

    return false;
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <iframe src={VIEL_CHAT_URL} style={styles.iframe} title="Viel Chat" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        key={retryToken}
        source={{ uri: VIEL_CHAT_URL }}
        style={styles.webview}
        startInLoadingState
        originWhitelist={['http://*', 'https://*']}
        setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        renderLoading={() => (
          <View style={styles.messageContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.messageText}>Loading Viel Chat...</Text>
          </View>
        )}
        renderError={(errorName) => (
          <View style={styles.messageContainer}>
            <Text style={styles.messageTitle}>Unable to load Viel Chat</Text>
            <Text style={styles.messageText}>
              Check that the configured Viel Chat URL is reachable and uses HTTPS in production.
            </Text>
            <Text style={styles.messageHint}>WebView error: {errorName}</Text>
            <Pressable onPress={() => setRetryToken((currentValue) => currentValue + 1)}>
              <Text style={styles.retryButton}>Try again</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  messageContainer: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  messageTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  messageText: {
    fontSize: 16,
    textAlign: 'center',
  },
  messageHint: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    color: '#0a66c2',
    fontSize: 16,
    fontWeight: '600',
  },
  iframe: {
    borderWidth: 0,
    flex: 1,
    width: '100%',
  },
});
