import Constants from 'expo-constants';
import { Platform } from 'react-native';

export type AppExtraConfig = {
  appEnv?: string;
  supabaseAnonKey?: string;
  supabaseUrl?: string;
  vielChatAllowedHosts?: string[];
  vielChatUrl?: string;
  workExperienceApiUrl?: string;
};

export const appExtra = (Constants.expoConfig?.extra ?? {}) as AppExtraConfig;

export const appEnv = appExtra.appEnv ?? 'development';
export const isProduction = appEnv === 'production';

const normalizeDevelopmentHostForPlatform = (value: string) => {
  if (Platform.OS !== 'android') {
    return value;
  }

  try {
    const url = new URL(value);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      url.hostname = '10.0.2.2';
      return url.toString().replace(/\/$/, '');
    }
  } catch {
    return value;
  }

  return value;
};

export const workExperienceApiUrl = normalizeDevelopmentHostForPlatform(
  appExtra.workExperienceApiUrl ??
    process.env.EXPO_PUBLIC_WORKEXPERIENCE_API_URL ??
    'http://localhost:3000',
);

export const supabaseUrl =
  appExtra.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL;

export const supabaseAnonKey =
  appExtra.supabaseAnonKey ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);
