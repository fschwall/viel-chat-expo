import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import {
  hasSupabaseConfig,
  supabaseAnonKey,
  supabaseUrl,
} from '@/lib/expoConfig';

const isStaticWebRender = Platform.OS === 'web' && typeof window === 'undefined';
const sessionStorage = Platform.OS === 'web' ? undefined : AsyncStorage;

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        autoRefreshToken: !isStaticWebRender,
        detectSessionInUrl: false,
        persistSession: !isStaticWebRender,
        storage: sessionStorage,
      },
    })
  : null;

export async function getSupabaseAccessToken() {
  if (!supabase) {
    return null;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? null;
}
