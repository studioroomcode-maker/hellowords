/**
 * Supabase 클라이언트
 * 온라인 데이터 저장 + 인증 담당
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// SSR 환경(Node.js)에서는 AsyncStorage가 window를 참조하여 에러 발생
// 메모리 기반 fallback storage 사용
const isSSR = typeof window === 'undefined';

const memoryStorage: Record<string, string> = {};
const ssrStorage = {
  getItem: (key: string) => memoryStorage[key] ?? null,
  setItem: (key: string, value: string) => { memoryStorage[key] = value; },
  removeItem: (key: string) => { delete memoryStorage[key]; },
};

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: isSSR ? ssrStorage : AsyncStorage,
    autoRefreshToken: true,
    persistSession: !isSSR,
    flowType: 'pkce',
  },
});

/** Supabase가 설정되었는지 확인 (URL/Key가 실제 값인지) */
export function isSupabaseConfigured(): boolean {
  return !!(
    supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('YOUR_') &&
    !supabaseAnonKey.includes('YOUR_')
  );
}
