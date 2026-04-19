import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { appEnv, hasSupabaseConfig, workExperienceApiUrl } from '@/lib/expoConfig';
import { supabase } from '@/lib/supabase';
import {
  type EntitlementResponse,
  getEntitlement,
} from '@/lib/workExperienceApi';

export default function DebugEntitlementScreen() {
  const [entitlement, setEntitlement] = useState<EntitlementResponse | null>(null);
  const [status, setStatus] = useState<string>('Not checked yet.');
  const [isLoading, setIsLoading] = useState(false);

  const handleFetchEntitlement = useCallback(async () => {
    setIsLoading(true);
    setStatus('Checking native Supabase session...');

    try {
      if (!supabase) {
        throw new Error('Supabase is not configured for this Expo environment.');
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(
          'No native Supabase session found. Sign in natively before testing this call.',
        );
      }

      setStatus('Calling WorkExperience profile.getEntitlement...');
      const nextEntitlement = await getEntitlement(session.access_token);
      setEntitlement(nextEntitlement);
      setStatus('Entitlement fetched successfully.');
    } catch (error) {
      setEntitlement(null);
      setStatus(error instanceof Error ? error.message : 'Unknown entitlement error.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  if (appEnv === 'production') {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Debug unavailable</Text>
        <Text style={styles.body}>This screen is disabled in production.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Entitlement Debug</Text>
      <Text style={styles.label}>Backend</Text>
      <Text style={styles.mono}>{workExperienceApiUrl}</Text>
      <Text style={styles.label}>Supabase config</Text>
      <Text style={styles.body}>{hasSupabaseConfig ? 'Configured' : 'Missing'}</Text>

      <Pressable
        disabled={isLoading}
        onPress={handleFetchEntitlement}
        style={({ pressed }) => [
          styles.button,
          (pressed || isLoading) && styles.buttonPressed,
        ]}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Fetch entitlement</Text>
        )}
      </Pressable>

      <Text style={styles.label}>Status</Text>
      <Text style={styles.body}>{status}</Text>

      {entitlement && (
        <>
          <Text style={styles.label}>Response</Text>
          <Text style={styles.mono}>{JSON.stringify(entitlement, null, 2)}</Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: {
    color: '#333',
    fontSize: 15,
    lineHeight: 22,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 8,
    justifyContent: 'center',
    marginVertical: 20,
    minHeight: 48,
    paddingHorizontal: 16,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  container: {
    padding: 24,
  },
  label: {
    color: '#666',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 16,
    textTransform: 'uppercase',
  },
  mono: {
    backgroundColor: '#f4f4f4',
    borderRadius: 8,
    color: '#111',
    fontFamily: 'Courier',
    fontSize: 13,
    lineHeight: 20,
    padding: 12,
  },
  title: {
    color: '#111',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
});
