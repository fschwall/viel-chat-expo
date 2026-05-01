import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';

import { onEntitlementRefresh } from '@/lib/entitlementRefresh';
import { syncRevenueCatUser } from '@/lib/revenueCat';
import { supabase } from '@/lib/supabase';

type ExtraConfig = {
  appEnv?: string;
  vielChatAllowedHosts?: string[];
  vielChatUrl?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as ExtraConfig;
const PRODUCTION_HOST = 'www.viel.chat';
const PRODUCTION_URL = `https://${PRODUCTION_HOST}/chat`;

const DEFAULT_URL =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3000'
    : Platform.OS === 'ios'
      ? 'http://localhost:3000'
      : PRODUCTION_URL;
const VIEL_CHAT_URL = extra.vielChatUrl ?? process.env.EXPO_PUBLIC_VIEL_CHAT_URL ?? DEFAULT_URL;
const APP_ENV = extra.appEnv ?? 'development';
const IS_PRODUCTION = APP_ENV === 'production';
const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['mailto:', 'tel:']);

const getUrl = (url: string) => {
  try {
    return new URL(url);
  } catch {
    return null;
  }
};

const PRIMARY_URL = getUrl(VIEL_CHAT_URL);
const PRIMARY_HOST = PRIMARY_URL?.host ?? PRODUCTION_HOST;
const ALLOWED_HOSTS = new Set([PRIMARY_HOST, ...(extra.vielChatAllowedHosts ?? [])]);

const isLocalDevelopmentUrl = (url: URL) =>
  !IS_PRODUCTION &&
  url.protocol === 'http:' &&
  ['localhost', '127.0.0.1', '10.0.2.2'].includes(url.hostname);

const openExternalUrl = async (url: string) => {
  try {
    await Linking.openURL(url);
  } catch {
    // If the device cannot open the URL, the WebView error state still gives the user a way forward.
  }
};

export default function HomeScreen() {
  const router = useRouter();
  const [retryToken, setRetryToken] = useState(0);
  const webViewRef = useRef<WebView>(null);

  const refreshWebEntitlement = useCallback(() => {
    const script = `
      (function () {
        try {
          window.dispatchEvent(new CustomEvent('nativeEntitlementUpdated', {
            detail: { source: 'expo' }
          }));
          if (window.__VIEL_CHAT__ && typeof window.__VIEL_CHAT__.refreshEntitlement === 'function') {
            window.__VIEL_CHAT__.refreshEntitlement();
          }
        } catch (error) {}
        true;
      })();
    `;

    webViewRef.current?.injectJavaScript(script);
    setRetryToken((currentValue) => currentValue + 1);
  }, []);

  useEffect(() => {
    const supabaseClient = supabase;

    if (!supabaseClient) {
      return;
    }

    let isMounted = true;

    const syncCurrentSession = async () => {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();

      if (!isMounted) {
        return;
      }

      try {
        await syncRevenueCatUser(session?.user.id ?? null);
      } catch {
        // Keep WebView functional even when RevenueCat is unavailable in this runtime.
      }
    };

    void syncCurrentSession();

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      void syncRevenueCatUser(session?.user.id ?? null).catch(() => {
        // Keep WebView functional even when RevenueCat is unavailable in this runtime.
      });
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => onEntitlementRefresh(refreshWebEntitlement), [refreshWebEntitlement]);

  const handleShouldStartLoad = (request: ShouldStartLoadRequest) => {
    if (!request.url) {
      return false;
    }

    const nextUrl = getUrl(request.url);

    if (!nextUrl) {
      return false;
    }

    const isAllowedHost = ALLOWED_HOSTS.has(nextUrl.host);
    const isHttpUrl = nextUrl.protocol === 'http:' || nextUrl.protocol === 'https:';
    const canLoadInApp = nextUrl.protocol === 'https:' || isLocalDevelopmentUrl(nextUrl);
    const isInitialDocument = request.url === VIEL_CHAT_URL || request.isTopFrame;

    if (isHttpUrl && isAllowedHost && canLoadInApp) {
      return true;
    }

    if (isHttpUrl && isInitialDocument && nextUrl.protocol === 'https:') {
      void openExternalUrl(request.url);
      return false;
    }

    if (ALLOWED_EXTERNAL_PROTOCOLS.has(nextUrl.protocol)) {
      void openExternalUrl(request.url);
      return false;
    }

    return false;
  };

  const handleWebViewMessage = useCallback(
    (rawData: string) => {
      if (!rawData) {
        return;
      }

      console.log('[WebViewBridge] Raw message:', rawData);

      try {
        const payload = JSON.parse(rawData) as { tier?: string; type?: string };
        console.log('[WebViewBridge] Parsed message:', payload);

        if (payload.type === 'open_revenuecat_paywall') {
          const tier = payload.tier ?? 'pro';
          console.log('[WebViewBridge] Opening native paywall for tier:', tier);
          router.push(`/paywall/index?tier=${encodeURIComponent(tier)}` as never);
        }
      } catch {
        console.log('[WebViewBridge] Ignored non-JSON message');
      }
    },
    [router],
  );

  const webSource = useMemo(() => ({ uri: VIEL_CHAT_URL }), []);

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
        ref={webViewRef}
        source={webSource}
        style={styles.webview}
        startInLoadingState
        originWhitelist={['http://*', 'https://*']}
        setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        onMessage={(event) => handleWebViewMessage(event.nativeEvent.data)}
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
