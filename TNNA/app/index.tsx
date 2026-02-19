import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { useClubStore } from '../stores/clubStore';
import { Player } from '../types';
import { Select } from '../components/ui';
import { AGE_GROUPS, RACKET_BRANDS, NTRP_LEVELS, MBTI_TYPES } from '../utils/constants';
import { signUp, signIn, getCurrentUser } from '../services/auth';
import { isSupabaseConfigured } from '../services/supabase';
import { supabase } from '../services/supabase';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { colors } from '../theme/tokens';

WebBrowser.maybeCompleteAuthSession();
import {
  isRegisteredEmail,
  findClubByEmail,
  checkIsSuperAdmin,
  restoreClubsRegistry,
  loadAllMemberEmails,
  getLocalClub,
  getLocalPlayers,
  getMemberEmails,
  saveMemberEmails,
  addLocalPlayer,
  saveMemberName,
} from '../services/localData';

type Step = 'email' | 'clubCode' | 'selectPlayer' | 'profile' | 'resetPassword';
type AuthMode = 'login' | 'signup';

const GENDER_OPTIONS = ['남', '여'] as const;
const HAND_OPTIONS = ['오른손', '왼손'] as const;

export default function Index() {
  const { user, setUser } = useAuthStore();
  const { clubCode, loadClub } = useClubStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [clubCodeInput, setClubCodeInput] = useState('');
  const [message, setMessage] = useState('');
  const [ready, setReady] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [step, setStep] = useState<Step>('email');
  const [showAddClub, setShowAddClub] = useState(false);
  const [validatedClubCode, setValidatedClubCode] = useState('');

  // 기존 선수 목록
  const [existingPlayers, setExistingPlayers] = useState<Player[]>([]);
  const [playerSearch, setPlayerSearch] = useState('');
  const [showPlayerList, setShowPlayerList] = useState(false);

  // 프로필 정보
  const [profileName, setProfileName] = useState('');
  const [profileNickname, setProfileNickname] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileGender, setProfileGender] = useState<'남' | '여'>('남');
  const [profileAge, setProfileAge] = useState('40대');
  const [profileHand, setProfileHand] = useState<'오른손' | '왼손'>('오른손');
  const [profileRacket, setProfileRacket] = useState('모름');
  const [profileNtrp, setProfileNtrp] = useState<number | null>(null);
  const [profileMbti, setProfileMbti] = useState('모름');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const useSupabase = isSupabaseConfigured();

  const isWeb = Platform.OS === 'web';

  // Native OAuth 공통: 브라우저 열고 딥링크로 콜백 처리
  const performNativeOAuth = async (provider: 'google' | 'kakao') => {
    const redirectTo = makeRedirectUri();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) throw error;
    if (data?.url) {
      // 브라우저 열기 (토큰 처리는 Linking.useURL() 딥링크에서)
      await WebBrowser.openBrowserAsync(data.url, {
        showInRecents: true,
      });
    }
  };

  // Google 로그인
  const handleGoogleLogin = async () => {
    setIsAuthLoading(true);
    setMessage('');
    try {
      if (isWeb) {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin },
        });
        if (error) throw error;
      } else {
        await performNativeOAuth('google');
      }
    } catch (e: any) {
      setMessage(e.message || 'Google 로그인 중 오류가 발생했습니다.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  // 카카오 로그인
  const handleKakaoLogin = async () => {
    setIsAuthLoading(true);
    setMessage('');
    try {
      if (isWeb) {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'kakao',
          options: { redirectTo: window.location.origin },
        });
        if (error) throw error;
      } else {
        await performNativeOAuth('kakao');
      }
    } catch (e: any) {
      setMessage(e.message || '카카오 로그인 중 오류가 발생했습니다.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  // OAuth 로그인 성공 후 공통 처리 (클럽 매칭)
  const handleGoogleAuthUser = async (authUser: ReturnType<typeof signInWithGoogle> extends Promise<infer T> ? T : never) => {
    const userEmail = authUser.email || '';

    // 클럽 자동 탐색
    const matchedClub = findClubByEmail(userEmail);
    if (matchedClub) {
      setUser(authUser);
      await loadClub(matchedClub);
      return;
    }

    // Supabase에서 club_members 조회
    const { data: membership } = await supabase
      .from('club_members')
      .select('club_code, player_name')
      .eq('email', userEmail)
      .limit(1)
      .maybeSingle();

    if (membership) {
      setUser({ ...authUser, displayName: membership.player_name });
      await loadClub(membership.club_code);
    } else if (checkIsSuperAdmin(userEmail)) {
      setUser(authUser);
      router.replace('/(auth)/club-select');
    } else {
      setEmail(userEmail);
      setUser(authUser);
      setStep('clubCode');
    }
  };



  // 앱 시작 시 레지스트리 + 회원 이메일 복원
  useEffect(() => {
    restoreClubsRegistry()
      .then(() => loadAllMemberEmails())
      .then(() => setReady(true));
  }, []);

  // Supabase 인증 이벤트 감지 (비밀번호 복구 + Google OAuth 리디렉트)
  useEffect(() => {
    if (!useSupabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setStep('resetPassword');
        setMessage('');
      }
      // OAuth 리디렉트 후 SIGNED_IN 이벤트 (Web + Native 모두)
      if (event === 'SIGNED_IN' && session?.user && !user) {
        const u = session.user;
        const authUser = {
          uid: u.id,
          email: u.email ?? null,
          displayName: u.user_metadata?.full_name ?? u.user_metadata?.display_name ?? null,
          photoURL: u.user_metadata?.avatar_url ?? u.user_metadata?.picture ?? null,
        };
        await handleGoogleAuthUser(authUser);
      }
    });
    return () => subscription.unsubscribe();
  }, [useSupabase, user]);

  // Native: 딥링크로 OAuth 콜백 처리 (PKCE flow: code 파라미터)
  const url = Linking.useURL();
  useEffect(() => {
    if (!url || isWeb) return;
    const { params, errorCode } = QueryParams.getQueryParams(url);
    if (errorCode) return;
    setIsAuthLoading(false);
    if (params.code) {
      // PKCE flow: code를 세션으로 교환
      supabase.auth.exchangeCodeForSession(params.code);
    } else if (params.access_token && params.refresh_token) {
      // Implicit flow fallback
      supabase.auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token,
      });
    }
  }, [url]);

  // Navigate based on auth state
  // 회원가입 진행 중(clubCode/selectPlayer/profile)일 때는 리다이렉트 하지 않음
  useEffect(() => {
    if (user && step === 'email') {
      if (clubCode) {
        router.replace('/(tabs)/home');
      } else if (checkIsSuperAdmin(user.email)) {
        router.replace('/(auth)/club-select');
      } else {
        const matchedClub = findClubByEmail(user.email || '');
        if (matchedClub) {
          loadClub(matchedClub).then(() => {
            router.replace('/(tabs)/home');
          });
        } else {
          router.replace('/(auth)/club-select');
        }
      }
    }
  }, [user, clubCode]);

  // Supabase 모드: 로그인/회원가입
  const handleAuthSubmit = async () => {
    if (!email.trim()) {
      setMessage('이메일을 입력해주세요');
      return;
    }
    if (useSupabase && !password.trim()) {
      setMessage('비밀번호를 입력해주세요');
      return;
    }

    setIsAuthLoading(true);
    setMessage('');

    try {
      if (useSupabase) {
        if (authMode === 'signup') {
          // 회원가입
          const authUser = await signUp(email.trim(), password, email.split('@')[0]);
          setUser(authUser);
          // 슈퍼어드민이면 클럽 선택으로 바로 이동
          if (checkIsSuperAdmin(authUser.email)) {
            router.replace('/(auth)/club-select');
            return;
          }
          // 일반 사용자 → 클럽코드 입력 단계
          setStep('clubCode');
        } else {
          // 로그인
          const authUser = await signIn(email.trim(), password);
          // 로그인 성공 → 클럽 자동 탐색
          const matchedClub = findClubByEmail(authUser.email || '');
          if (matchedClub) {
            setUser(authUser);
            // useEffect에서 navigate 처리
          } else {
            // Supabase에서 club_members 조회
            const { data: membership } = await supabase
              .from('club_members')
              .select('club_code, player_name')
              .eq('email', authUser.email)
              .limit(1)
              .maybeSingle();

            if (membership) {
              setUser({ ...authUser, displayName: membership.player_name });
              await loadClub(membership.club_code);
            } else if (checkIsSuperAdmin(authUser.email)) {
              // 슈퍼어드민 → 클럽 선택
              setUser(authUser);
              router.replace('/(auth)/club-select');
              return;
            } else {
              // 클럽 미등록 → 클럽코드 입력
              setUser(authUser);
              setStep('clubCode');
            }
          }
        }
      } else {
        // 로컬 모드 (Supabase 미설정)
        const trimmed = email.trim();
        if (showAddClub) {
          setStep('clubCode');
        } else if (isRegisteredEmail(trimmed)) {
          setUser({
            uid: 'user-' + Date.now(),
            email: trimmed,
            displayName: trimmed.split('@')[0],
            photoURL: null,
          });
        } else {
          setStep('clubCode');
        }
      }
    } catch (e: any) {
      setMessage(e.message || '오류가 발생했습니다.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleClubCodeSubmit = async () => {
    const code = clubCodeInput.trim().toUpperCase();
    if (!code) {
      setMessage('클럽 코드를 입력해주세요.');
      return;
    }

    // 로컬 클럽 확인
    let club = getLocalClub(code);

    // Supabase에서도 확인
    if (!club && useSupabase) {
      const { data } = await supabase
        .from('clubs')
        .select('code, name')
        .eq('code', code)
        .maybeSingle();
      if (data) {
        club = { name: data.name, adminEmails: [] };
      }
    }

    if (!club) {
      setMessage('존재하지 않는 클럽 코드입니다.');
      return;
    }
    setMessage('');
    setValidatedClubCode(code);

    // 기존 선수 목록 로드
    const players = await getLocalPlayers(code);
    if (players.length > 0) {
      setExistingPlayers(players);
      setStep('selectPlayer');
    } else {
      setStep('profile');
    }
  };

  // 기존 선수 선택 → 이메일 연동 후 로그인
  const handleSelectExistingPlayer = async (player: Player) => {
    const trimmedEmail = email.trim().toLowerCase();
    const code = validatedClubCode;

    // 회원 목록에 이메일 추가 (로컬)
    const existing = await getMemberEmails(code);
    if (!existing.some((e) => e.toLowerCase() === trimmedEmail)) {
      await saveMemberEmails(code, [...existing, trimmedEmail]);
    }

    // 이름 매핑 저장 (로컬)
    await saveMemberName(code, trimmedEmail, player.name);

    // Supabase에 club_members 등록
    if (useSupabase && user) {
      await supabase.from('club_members').upsert({
        club_code: code,
        user_id: user.uid,
        email: trimmedEmail,
        player_name: player.name,
        role: 'member',
      }, { onConflict: 'club_code,email' }).then(() => {});
    }

    // 로그인 처리
    setMessage('');
    if (!user) {
      setUser({
        uid: 'user-' + Date.now(),
        email: trimmedEmail,
        displayName: player.name,
        photoURL: null,
      });
    } else {
      setUser({ ...user, displayName: player.name });
    }
    await loadClub(code);
    router.replace('/(tabs)/home');
  };

  const handleProfileSubmit = async () => {
    if (!profileName.trim()) {
      setMessage('이름을 입력해주세요.');
      return;
    }

    // 같은 이름의 선수가 이미 있는지 확인
    if (existingPlayers.some((p) => p.name === profileName.trim())) {
      setMessage('이미 같은 이름의 선수가 등록되어 있습니다. 다른 이름을 사용해주세요.');
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    const code = validatedClubCode;

    // 회원 목록에 이메일 추가
    const existing = await getMemberEmails(code);
    if (!existing.some((e) => e.toLowerCase() === trimmedEmail)) {
      await saveMemberEmails(code, [...existing, trimmedEmail]);
    }

    // 이름 매핑 저장
    await saveMemberName(code, trimmedEmail, profileName.trim());

    // 선수 등록 (로컬)
    await addLocalPlayer(code, {
      name: profileName.trim(),
      nickname: profileNickname.trim() || undefined,
      phone: profilePhone.trim() || undefined,
      gender: profileGender,
      hand: profileHand,
      ageGroup: profileAge,
      racket: profileRacket,
      group: '미배정',
      ntrp: profileNtrp,
      adminNtrp: profileNtrp,
      email: trimmedEmail,
      mbti: profileMbti === '모름' ? null : profileMbti,
    });

    // Supabase에 선수 + 회원 등록
    if (useSupabase) {
      await supabase.from('players').upsert({
        club_code: code,
        name: profileName.trim(),
        nickname: profileNickname.trim() || null,
        gender: profileGender,
        hand: profileHand,
        age_group: profileAge,
        racket: profileRacket,
        player_group: '미배정',
        ntrp: profileNtrp,
        admin_ntrp: profileNtrp,
        phone: profilePhone.trim() || null,
        email: trimmedEmail,
        mbti: profileMbti === '모름' ? null : profileMbti,
      }, { onConflict: 'club_code,name' }).then(() => {});

      if (user) {
        await supabase.from('club_members').upsert({
          club_code: code,
          user_id: user.uid,
          email: trimmedEmail,
          player_name: profileName.trim(),
          role: 'member',
        }, { onConflict: 'club_code,email' }).then(() => {});
      }
    }

    // 로그인 처리
    setMessage('');
    if (!user) {
      setUser({
        uid: 'user-' + Date.now(),
        email: trimmedEmail,
        displayName: profileName.trim(),
        photoURL: null,
      });
    } else {
      setUser({ ...user, displayName: profileName.trim() });
    }
    await loadClub(code);
    router.replace('/(tabs)/home');
  };

  const resetAll = () => {
    setStep('email');
    setShowAddClub(false);
    setClubCodeInput('');
    setValidatedClubCode('');
    setMessage('');
    setPassword('');
    setAuthMode('login');
    setExistingPlayers([]);
    setPlayerSearch('');
    setProfileName('');
    setProfileNickname('');
    setProfilePhone('');
    setProfileGender('남');
    setProfileAge('40대');
    setProfileHand('오른손');
    setProfileRacket('모름');
    setProfileNtrp(null);
    setProfileMbti('모름');
  };

  // 검색 필터된 선수 목록
  const filteredPlayers = playerSearch.trim()
    ? existingPlayers.filter((p) => p.name.includes(playerSearch.trim()))
    : existingPlayers;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>TENNIS NOTE</Text>
      <Text style={styles.subtitle}>테니스클럽 경기기록 도우미</Text>

      <View style={styles.form}>
        {/* Step 1: 이메일 + 비밀번호 */}
        <Text style={styles.label}>이메일</Text>
        <TextInput
          style={[styles.input, step !== 'email' && styles.inputDisabled]}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={colors.textTertiary}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={step === 'email'}
        />

        {step === 'email' && useSupabase && (
          <>
            <Text style={styles.label}>비밀번호</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="6자 이상"
              placeholderTextColor={colors.textTertiary}
              secureTextEntry
              onSubmitEditing={handleAuthSubmit}
            />
          </>
        )}

        {step === 'email' && (
          <>
            <TouchableOpacity
              style={[styles.button, isAuthLoading && styles.buttonDisabled]}
              onPress={handleAuthSubmit}
              activeOpacity={0.7}
              disabled={isAuthLoading}
            >
              {isAuthLoading ? (
                <ActivityIndicator color={colors.navy} size="small" />
              ) : (
                <Text style={styles.buttonText}>
                  {useSupabase ? (authMode === 'login' ? '로그인' : '회원가입') : '로그인'}
                </Text>
              )}
            </TouchableOpacity>

            {useSupabase && (
              <>
                <TouchableOpacity
                  style={styles.toggleAuth}
                  onPress={() => {
                    setAuthMode(authMode === 'login' ? 'signup' : 'login');
                    setMessage('');
                  }}
                >
                  <Text style={styles.toggleAuthText}>
                    {authMode === 'login' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
                  </Text>
                </TouchableOpacity>
                {authMode === 'login' && (
                  <TouchableOpacity
                    style={styles.toggleAuth}
                    onPress={async () => {
                      const trimmed = email.trim();
                      if (!trimmed) {
                        setMessage('이메일을 먼저 입력해주세요.');
                        return;
                      }
                      try {
                        setMessage('');
                        const { error } = await supabase.auth.resetPasswordForEmail(trimmed);
                        if (error) throw error;
                        setMessage('비밀번호 재설정 이메일을 보냈습니다. 메일함을 확인해주세요.');
                      } catch (e: any) {
                        setMessage(e.message || '오류가 발생했습니다.');
                      }
                    }}
                  >
                    <Text style={[styles.toggleAuthText, { color: colors.textTertiary }]}>비밀번호를 잊으셨나요?</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* 소셜 로그인 */}
            {useSupabase && (
              <>
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>또는</Text>
                  <View style={styles.dividerLine} />
                </View>
                <TouchableOpacity
                  style={[styles.socialButton, isAuthLoading && styles.buttonDisabled]}
                  onPress={() => handleGoogleLogin()}
                  activeOpacity={0.7}
                  disabled={isAuthLoading}
                >
                  <FontAwesome name="google" size={18} color="#4285F4" style={{ marginRight: 8 }} />
                  <Text style={styles.socialButtonText}>Google로 로그인</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.socialButton, { marginTop: 8, borderColor: '#FEE500', backgroundColor: '#FEE500' }, isAuthLoading && styles.buttonDisabled]}
                  onPress={() => handleKakaoLogin()}
                  activeOpacity={0.7}
                  disabled={isAuthLoading}
                >
                  <Text style={{ fontSize: 18, marginRight: 8 }}>💬</Text>
                  <Text style={[styles.socialButtonText, { color: '#3C1E1E' }]}>카카오로 로그인</Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}

        {/* 비밀번호 재설정 */}
        {step === 'resetPassword' && (
          <>
            <Text style={styles.clubCodeMessage}>새 비밀번호를 입력해주세요.</Text>
            <Text style={styles.label}>새 비밀번호</Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="새 비밀번호 (6자 이상)"
              placeholderTextColor={colors.textTertiary}
              secureTextEntry
            />
            <Text style={styles.label}>비밀번호 확인</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="비밀번호 다시 입력"
              placeholderTextColor={colors.textTertiary}
              secureTextEntry
            />
            <TouchableOpacity
              style={[styles.button, isAuthLoading && { opacity: 0.6 }]}
              disabled={isAuthLoading}
              onPress={async () => {
                if (!newPassword.trim() || newPassword.length < 6) {
                  setMessage('비밀번호는 6자 이상이어야 합니다.');
                  return;
                }
                if (newPassword !== confirmPassword) {
                  setMessage('비밀번호가 일치하지 않습니다.');
                  return;
                }
                setIsAuthLoading(true);
                setMessage('');
                try {
                  const { error } = await supabase.auth.updateUser({ password: newPassword });
                  if (error) throw error;
                  setMessage('비밀번호가 변경되었습니다. 로그인해주세요.');
                  setStep('email');
                  setNewPassword('');
                  setConfirmPassword('');
                  setPassword('');
                  await supabase.auth.signOut();
                } catch (e: any) {
                  setMessage(e.message || '비밀번호 변경에 실패했습니다.');
                } finally {
                  setIsAuthLoading(false);
                }
              }}
            >
              <Text style={styles.buttonText}>
                {isAuthLoading ? '변경 중...' : '비밀번호 변경'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* Step 2: 클럽코드 */}
        {step === 'clubCode' && (
          <>
            <Text style={styles.clubCodeMessage}>
              {showAddClub ? '추가할 클럽 코드를 입력해주세요.' : '소속 클럽 코드를 입력해주세요.'}
            </Text>
            <Text style={styles.label}>클럽 코드</Text>
            <TextInput
              style={styles.input}
              value={clubCodeInput}
              onChangeText={setClubCodeInput}
              placeholder="예: HMMC"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="characters"
              onSubmitEditing={handleClubCodeSubmit}
            />
            <TouchableOpacity style={styles.button} onPress={handleClubCodeSubmit} activeOpacity={0.7}>
              <Text style={styles.buttonText}>다음</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.backButton} onPress={resetAll}>
              <Text style={styles.backButtonText}>처음으로</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Step 2.5: 기존 선수 선택 */}
        {step === 'selectPlayer' && (
          <>
            <Text style={styles.emailDisplay}>{email}</Text>

            <TouchableOpacity
              style={styles.newProfileButton}
              onPress={() => { setStep('profile'); setMessage(''); }}
            >
              <FontAwesome name="plus" size={14} color={colors.primary} />
              <Text style={styles.newProfileButtonText}>새로 등록</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.expandHeader}
              onPress={() => setShowPlayerList(!showPlayerList)}
            >
              <Text style={styles.expandHeaderText}>이미 등록된 선수</Text>
              <FontAwesome name={showPlayerList ? 'chevron-up' : 'chevron-down'} size={12} color={colors.textSecondary} />
            </TouchableOpacity>

            {showPlayerList && (
              <>
                {existingPlayers.length > 8 && (
                  <TextInput
                    style={styles.input}
                    value={playerSearch}
                    onChangeText={setPlayerSearch}
                    placeholder="이름 검색..."
                    placeholderTextColor={colors.textTertiary}
                  />
                )}

                <View style={styles.playerList}>
                  {filteredPlayers.map((player) => (
                    <TouchableOpacity
                      key={player.id || player.name}
                      style={styles.playerItem}
                      onPress={() => handleSelectExistingPlayer(player)}
                    >
                      <View style={styles.playerItemLeft}>
                        <Text style={styles.playerName}>{player.name}</Text>
                        <Text style={styles.playerInfo}>
                          {player.gender} · {player.ageGroup}
                        </Text>
                      </View>
                      <FontAwesome name="chevron-right" size={12} color={colors.textTertiary} />
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <TouchableOpacity style={styles.backButton} onPress={() => { setStep('clubCode'); setMessage(''); setPlayerSearch(''); setShowPlayerList(false); }}>
              <Text style={styles.backButtonText}>이전으로</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Step 3: 프로필 입력 */}
        {step === 'profile' && (
          <>
            <Text style={styles.clubCodeMessage}>
              본인 정보를 입력해주세요.
            </Text>

            {/* 이름 */}
            <Text style={styles.label}>이름 *</Text>
            <TextInput
              style={styles.input}
              value={profileName}
              onChangeText={setProfileName}
              placeholder="홍길동"
              placeholderTextColor={colors.textTertiary}
              autoFocus
            />

            {/* 별명 */}
            <Text style={styles.label}>별명</Text>
            <TextInput
              style={styles.input}
              value={profileNickname}
              onChangeText={setProfileNickname}
              placeholder="별명 (선택)"
              placeholderTextColor={colors.textTertiary}
            />

            {/* 전화번호 */}
            <Text style={styles.label}>전화번호</Text>
            <TextInput
              style={styles.input}
              value={profilePhone}
              onChangeText={setProfilePhone}
              placeholder="010-0000-0000"
              placeholderTextColor={colors.textTertiary}
              keyboardType="phone-pad"
            />

            {/* 성별 */}
            <View style={styles.formRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Select
                  label="성별"
                  value={profileGender}
                  options={GENDER_OPTIONS.map((g) => ({ label: g === '남' ? '남자' : '여자', value: g }))}
                  onChange={(v) => setProfileGender(v as '남' | '여')}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Select
                  label="주손"
                  value={profileHand}
                  options={HAND_OPTIONS.map((h) => ({ label: h, value: h }))}
                  onChange={(v) => setProfileHand(v as '오른손' | '왼손')}
                />
              </View>
            </View>

            {/* 연령대 / 라켓 */}
            <View style={styles.formRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Select
                  label="연령대"
                  value={profileAge}
                  options={AGE_GROUPS.map((a) => ({ label: a, value: a }))}
                  onChange={(v) => setProfileAge(v as string)}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Select
                  label="라켓"
                  value={profileRacket}
                  options={RACKET_BRANDS.map((r) => ({ label: r, value: r }))}
                  onChange={(v) => setProfileRacket(v as string)}
                />
              </View>
            </View>

            {/* NTRP / MBTI */}
            <View style={styles.formRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Select
                  label="NTRP"
                  value={profileNtrp}
                  options={NTRP_LEVELS.map((n) => ({ label: n.label, value: n.value }))}
                  onChange={(v) => setProfileNtrp(v as number | null)}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Select
                  label="MBTI"
                  value={profileMbti}
                  options={MBTI_TYPES.map((m) => ({ label: m, value: m }))}
                  onChange={(v) => setProfileMbti(v as string)}
                />
              </View>
            </View>

            <TouchableOpacity style={styles.button} onPress={handleProfileSubmit} activeOpacity={0.7}>
              <Text style={styles.buttonText}>등록 및 로그인</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.backButton} onPress={() => {
              // 선수 목록이 있었으면 선택 화면으로, 없으면 클럽코드로
              setStep(existingPlayers.length > 0 ? 'selectPlayer' : 'clubCode');
              setMessage('');
            }}>
              <Text style={styles.backButtonText}>이전으로</Text>
            </TouchableOpacity>
          </>
        )}

        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>

      {step === 'email' && !useSupabase && (
        <TouchableOpacity
          style={styles.addClubLink}
          onPress={() => {
            setShowAddClub(true);
            setStep('clubCode');
            setMessage('');
          }}
        >
          <Text style={styles.addClubLinkText}>다른 클럽 추가</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: colors.bg,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
    color: colors.text,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 40,
  },
  form: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.card,
    padding: 24,
    borderRadius: 12,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    color: colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    color: colors.text,
    backgroundColor: colors.card,
  },
  inputDisabled: {
    backgroundColor: colors.navyLight,
    color: colors.textSecondary,
  },
  button: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.black,
    fontSize: 16,
    fontWeight: '600',
  },
  toggleAuth: {
    marginTop: 12,
    padding: 8,
    alignItems: 'center',
  },
  toggleAuthText: {
    fontSize: 13,
    color: colors.primary,
  },
  backButton: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  backButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  clubCodeMessage: {
    fontSize: 14,
    color: colors.primary,
    backgroundColor: colors.primaryBg,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    lineHeight: 20,
  },
  message: {
    marginTop: 16,
    padding: 12,
    backgroundColor: colors.errorBg,
    borderRadius: 8,
    color: colors.error,
  },
  addClubLink: {
    marginTop: 16,
    padding: 8,
  },
  addClubLinkText: {
    fontSize: 13,
    color: colors.textTertiary,
    textDecorationLine: 'underline',
  },
  emailDisplay: {
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.navyLight,
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    textAlign: 'center',
  },
  expandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginTop: 16,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  expandHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  // 선수 목록 스타일
  playerList: {
    marginBottom: 12,
  },
  playerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  playerItemLeft: {
    flex: 1,
  },
  playerName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  playerInfo: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
  },
  newProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    borderStyle: 'dashed',
    gap: 8,
  },
  newProfileButtonText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '500',
  },
  formRow: {
    flexDirection: 'row',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 13,
    color: colors.textTertiary,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  socialButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
});
