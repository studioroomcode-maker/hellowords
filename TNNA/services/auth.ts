/**
 * Auth Service - Supabase Auth
 * 이메일+비밀번호 인증, Google OAuth, 세션 관리
 */

import { supabase, isSupabaseConfigured } from './supabase';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

/** Supabase user_metadata에서 photoURL 추출 */
function getPhotoURL(metadata?: Record<string, any>): string | null {
  return metadata?.avatar_url ?? metadata?.picture ?? null;
}

/** Supabase user_metadata에서 displayName 추출 */
function getDisplayName(metadata?: Record<string, any>): string | null {
  return metadata?.display_name ?? metadata?.full_name ?? metadata?.name ?? null;
}

/** 회원가입 */
export async function signUp(
  email: string,
  password: string,
  displayName: string,
): Promise<AuthUser> {
  if (!isSupabaseConfigured()) {
    // 로컬 모드 폴백
    return { uid: 'local-' + Date.now(), email, displayName, photoURL: null };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });

  if (error) {
    // 한국어 에러 메시지 변환
    if (error.message.includes('already registered')) {
      throw new Error('이미 가입된 이메일입니다.');
    }
    if (error.message.includes('Password should be')) {
      throw new Error('비밀번호는 6자 이상이어야 합니다.');
    }
    if (error.message.includes('Invalid email')) {
      throw new Error('올바른 이메일 주소를 입력해주세요.');
    }
    throw new Error(error.message);
  }

  if (!data.user) throw new Error('회원가입에 실패했습니다.');

  return {
    uid: data.user.id,
    email: data.user.email ?? null,
    displayName: getDisplayName(data.user.user_metadata) ?? displayName,
    photoURL: getPhotoURL(data.user.user_metadata),
  };
}

/** 로그인 */
export async function signIn(
  email: string,
  password: string,
): Promise<AuthUser> {
  if (!isSupabaseConfigured()) {
    return { uid: 'local-' + Date.now(), email, displayName: email.split('@')[0], photoURL: null };
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message.includes('Invalid login credentials')) {
      throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
    }
    if (error.message.includes('Email not confirmed')) {
      throw new Error('이메일 인증이 필요합니다. 메일함을 확인해주세요.');
    }
    throw new Error(error.message);
  }

  if (!data.user) throw new Error('로그인에 실패했습니다.');

  return {
    uid: data.user.id,
    email: data.user.email ?? null,
    displayName: getDisplayName(data.user.user_metadata),
    photoURL: getPhotoURL(data.user.user_metadata),
  };
}

/** Google ID 토큰으로 로그인 */
export async function signInWithGoogle(idToken: string): Promise<AuthUser> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase가 설정되지 않았습니다.');
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });

  if (error) {
    throw new Error('Google 로그인에 실패했습니다: ' + error.message);
  }

  if (!data.user) throw new Error('Google 로그인에 실패했습니다.');

  return {
    uid: data.user.id,
    email: data.user.email ?? null,
    displayName: getDisplayName(data.user.user_metadata),
    photoURL: getPhotoURL(data.user.user_metadata),
  };
}

/** 로그아웃 */
export async function signOut(): Promise<void> {
  if (isSupabaseConfigured()) {
    await supabase.auth.signOut();
  }
}

/** 현재 세션 확인 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  if (!isSupabaseConfigured()) return null;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

  return {
    uid: session.user.id,
    email: session.user.email ?? null,
    displayName: getDisplayName(session.user.user_metadata),
    photoURL: getPhotoURL(session.user.user_metadata),
  };
}

/** Auth 상태 변경 구독 */
export function subscribeToAuthState(
  callback: (user: AuthUser | null) => void,
): () => void {
  if (!isSupabaseConfigured()) {
    // Supabase 미설정 시 로컬 모드
    setTimeout(() => callback(null), 0);
    return () => {};
  }

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      if (session?.user) {
        callback({
          uid: session.user.id,
          email: session.user.email ?? null,
          displayName: getDisplayName(session.user.user_metadata),
          photoURL: getPhotoURL(session.user.user_metadata),
        });
      } else {
        callback(null);
      }
    },
  );

  return () => subscription.unsubscribe();
}
