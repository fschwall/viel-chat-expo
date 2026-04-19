import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { appEnv, hasSupabaseConfig } from '@/lib/expoConfig';
import { supabase } from '@/lib/supabase';

export default function DebugLoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('Sign in with a WorkExperience test user.');
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = useCallback(async () => {
    setIsLoading(true);
    setStatus('Signing in...');

    try {
      if (!supabase) {
        throw new Error('Supabase is not configured for this Expo environment.');
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw error;
      }

      setStatus('Signed in. Open /debug-entitlement to test the protected tRPC call.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unknown sign-in error.');
    } finally {
      setIsLoading(false);
    }
  }, [email, password]);

  const handleSignOut = useCallback(async () => {
    setIsLoading(true);
    setStatus('Signing out...');

    try {
      if (!supabase) {
        throw new Error('Supabase is not configured for this Expo environment.');
      }

      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }

      setStatus('Signed out.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unknown sign-out error.');
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardView}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Debug Login</Text>
        <Text style={styles.body}>
          This creates a native Supabase session so the Expo app can send a bearer
          token to WorkExperience tRPC.
        </Text>

        <Text style={styles.label}>Supabase config</Text>
        <Text style={styles.body}>{hasSupabaseConfig ? 'Configured' : 'Missing'}</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          editable={!isLoading}
          inputMode="email"
          onChangeText={setEmail}
          placeholder="test@example.com"
          style={styles.input}
          value={email}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="password"
          editable={!isLoading}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
          style={styles.input}
          value={password}
        />

        <Pressable
          disabled={isLoading}
          onPress={handleSignIn}
          style={({ pressed }) => [
            styles.button,
            (pressed || isLoading) && styles.buttonPressed,
          ]}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign in</Text>
          )}
        </Pressable>

        <Pressable disabled={isLoading} onPress={handleSignOut} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Sign out</Text>
        </Pressable>

        <Text style={styles.label}>Status</Text>
        <Text style={styles.body}>{status}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
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
    marginTop: 20,
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
  input: {
    borderColor: '#ccc',
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  keyboardView: {
    flex: 1,
  },
  label: {
    color: '#666',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 16,
    textTransform: 'uppercase',
  },
  secondaryButton: {
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#111',
    fontSize: 15,
    fontWeight: '600',
  },
  title: {
    color: '#111',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
});
