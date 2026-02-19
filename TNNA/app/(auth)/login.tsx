import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Pressable,
  Modal,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { useClubStore } from '../../stores/clubStore';
import {
  isRegisteredEmail,
  findClubByEmail,
  checkIsSuperAdmin,
  restoreClubsRegistry,
  loadAllMemberEmails,
  getLocalClub,
  getMemberEmails,
  saveMemberEmails,
  getMemberNames,
  saveMemberName,
  getLocalPlayers,
  updateLocalPlayer,
  addLocalPlayer,
} from '../../services/localData';
import { Player } from '../../types';
import { colors, spacing, radius, typography, MAX_WIDTH } from '../../theme/tokens';

export default function LoginScreen() {
  const { user, setUser, isLoading } = useAuthStore();
  const { clubCode, loadClub } = useClubStore();
  const [email, setEmail] = useState('');
  const [clubCodeInput, setClubCodeInput] = useState('');
  const [message, setMessage] = useState('');
  const [showClubCodeInput, setShowClubCodeInput] = useState(false);
  const [linkPlayers, setLinkPlayers] = useState<Player[]>([]);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingClubCode, setPendingClubCode] = useState('');
  // 가입 폼
  const [newName, setNewName] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [newPhone, setNewPhone] = useState('');

  // 레지스트리 + 회원 이메일 복원
  useEffect(() => {
    restoreClubsRegistry().then(() => loadAllMemberEmails());
  }, []);

  // Navigate after login
  useEffect(() => {
    if (user) {
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

  const handleLogin = async () => {
    if (!email.trim()) {
      setMessage('이메일을 입력해 주세요.');
      return;
    }
    const trimmed = email.trim();

    if (isRegisteredEmail(trimmed)) {
      setMessage('');
      // 등록된 이름이 있으면 displayName으로 사용
      let displayName = trimmed.split('@')[0];
      const club = findClubByEmail(trimmed);
      if (club) {
        const names = await getMemberNames(club);
        let registered = names[trimmed.toLowerCase()];
        // memberNames에 없으면 players에서 email로 찾아서 매핑 복구
        if (!registered) {
          const clubPlayers = await getLocalPlayers(club);
          const linked = clubPlayers.find(p => p.email?.toLowerCase() === trimmed.toLowerCase());
          if (linked) {
            registered = linked.name;
            await saveMemberName(club, trimmed, linked.name);
          }
        }
        if (registered) displayName = registered;
      }
      setUser({
        uid: 'user-' + Date.now(),
        email: trimmed,
        displayName,
        photoURL: null,
      });
    } else {
      setMessage('');
      setShowClubCodeInput(true);
    }
  };

  const completeRegistration = (registrationEmail: string) => {
    setMessage('');
    setUser({
      uid: 'user-' + Date.now(),
      email: registrationEmail,
      displayName: registrationEmail.split('@')[0],
      photoURL: null,
    });
  };

  const handleRegisterWithClub = async () => {
    const code = clubCodeInput.trim().toUpperCase();
    if (!code) {
      setMessage('클럽 코드를 입력해주세요.');
      return;
    }
    const trimmedName = newName.trim();
    if (!trimmedName) {
      setMessage('이름을 입력해주세요.');
      return;
    }

    const club = getLocalClub(code);
    if (!club) {
      setMessage('존재하지 않는 클럽 코드입니다.');
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    const existing = await getMemberEmails(code);
    if (!existing.some((e) => e.toLowerCase() === trimmedEmail)) {
      await saveMemberEmails(code, [...existing, trimmedEmail]);
    }

    // Load players and check for unlinkable ones
    const clubPlayers = await getLocalPlayers(code);
    const unlinked = clubPlayers.filter(p => !p.email);
    setPendingEmail(trimmedEmail);
    setPendingClubCode(code);
    if (unlinked.length > 0) {
      setLinkPlayers(unlinked);
      setShowLinkModal(true);
      return; // Don't set user yet - wait for modal
    }

    // 연동할 선수가 없으면 바로 새 선수 생성
    await createAndLogin(code, trimmedEmail, trimmedName);
  };

  const handleLinkPlayer = async (player: Player) => {
    if (player.id && pendingClubCode) {
      await updateLocalPlayer(pendingClubCode, player.id, { email: pendingEmail });
      // email→name 매핑 저장 (개인 통계 표시에 필요)
      await saveMemberName(pendingClubCode, pendingEmail, player.name);
    }
    setShowLinkModal(false);
    setUser({
      uid: 'user-' + Date.now(),
      email: pendingEmail,
      displayName: player.name,
      photoURL: null,
    });
  };

  // 새 선수 생성 + 로그인 공통 함수
  const createAndLogin = async (code: string, emailAddr: string, name: string) => {
    await addLocalPlayer(code, {
      name,
      nickname: newNickname.trim() || undefined,
      gender: '남',
      hand: '오른손',
      ageGroup: '40대',
      racket: '모름',
      group: '미배정',
      ntrp: null,
      adminNtrp: null,
      phone: newPhone.trim() || undefined,
      email: emailAddr,
      mbti: '모름',
    });
    await saveMemberName(code, emailAddr, name);
    setUser({
      uid: 'user-' + Date.now(),
      email: emailAddr,
      displayName: name,
      photoURL: null,
    });
  };

  const handleSkipLink = async () => {
    setShowLinkModal(false);
    const trimmedName = newName.trim();
    if (!trimmedName || !pendingClubCode) {
      // 이름 없으면 폼으로 돌아감 (이미 입력한 상태여야 함)
      completeRegistration(pendingEmail);
      return;
    }
    await createAndLogin(pendingClubCode, pendingEmail, trimmedName);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>🏃 로딩 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.subtitle}>🎾 테니스클럽 경기기록 도우미</Text>
          <Text style={styles.title}>TENNIS NOTE</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>이메일</Text>
          <TextInput
            style={[styles.input, showClubCodeInput && styles.inputDisabled]}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!showClubCodeInput}
          />

          {showClubCodeInput ? (
            <>
              <Text style={styles.clubCodeMessage}>
                처음 방문하셨군요! 아래 정보를 입력해주세요.
              </Text>
              <Text style={styles.label}>클럽 코드 *</Text>
              <TextInput
                style={styles.input}
                value={clubCodeInput}
                onChangeText={setClubCodeInput}
                placeholder="예: HMMC"
                autoCapitalize="characters"
              />
              <Text style={styles.label}>이름 *</Text>
              <TextInput
                style={styles.input}
                value={newName}
                onChangeText={setNewName}
                placeholder="홍길동"
              />
              <Text style={styles.label}>별명</Text>
              <TextInput
                style={styles.input}
                value={newNickname}
                onChangeText={setNewNickname}
                placeholder="별명 (선택)"
              />
              <Text style={styles.label}>전화번호</Text>
              <TextInput
                style={styles.input}
                value={newPhone}
                onChangeText={setNewPhone}
                placeholder="010-0000-0000"
                keyboardType="phone-pad"
              />
              <Pressable style={styles.button} onPress={handleRegisterWithClub}>
                <Text style={styles.buttonText}>클럽 등록 및 로그인</Text>
              </Pressable>
              <Pressable
                style={styles.backButton}
                onPress={() => {
                  setShowClubCodeInput(false);
                  setClubCodeInput('');
                  setNewName('');
                  setNewNickname('');
                  setNewPhone('');
                  setMessage('');
                }}
              >
                <Text style={styles.backButtonText}>이메일 다시 입력</Text>
              </Pressable>
            </>
          ) : (
            <Pressable style={styles.button} onPress={handleLogin}>
              <Text style={styles.buttonText}>로그인</Text>
            </Pressable>
          )}

          {message ? <Text style={styles.errorMessage}>{message}</Text> : null}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Copyright 2026. Studioroom. All rights reserved.
          </Text>
        </View>
      </ScrollView>

      <Modal
        visible={showLinkModal}
        transparent
        animationType="fade"
        onRequestClose={handleSkipLink}
      >
        <View style={styles.linkOverlay}>
          <View style={styles.linkContainer}>
            <Text style={styles.linkTitle}>회원 연동</Text>
            <Text style={styles.linkDesc}>
              연동시킬 기존 회원이 있습니까?
            </Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {linkPlayers.map(p => (
                <Pressable
                  key={p.id || p.name}
                  style={styles.linkRow}
                  onPress={() => handleLinkPlayer(p)}
                >
                  <Text style={styles.linkName}>{p.name}</Text>
                  <Text style={styles.linkSub}>{p.gender} · {p.ageGroup}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.linkSkipBtn} onPress={handleSkipLink}>
              <Text style={styles.linkSkipText}>아니오 (새로 등록)</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  content: {
    flexGrow: 1,
    padding: spacing['2xl'],
    justifyContent: 'center',
    maxWidth: MAX_WIDTH,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: 1,
  },
  form: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing['2xl'],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    fontSize: 16,
    marginBottom: spacing.lg,
    color: colors.text,
  },
  inputDisabled: {
    backgroundColor: colors.bg,
    color: colors.textSecondary,
  },
  button: {
    backgroundColor: colors.primary,
    padding: spacing.lg,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.black,
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.sm,
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
    padding: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  errorMessage: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.errorBg,
    borderRadius: radius.sm,
    color: colors.error,
    fontSize: 14,
  },
  footer: {
    marginTop: spacing['2xl'],
    alignItems: 'center',
    paddingBottom: spacing.lg,
  },
  footerText: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  linkOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkContainer: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    width: 300,
    maxHeight: 450,
  },
  linkTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    color: colors.text,
  },
  linkDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  linkRow: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  linkName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  linkSub: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
  },
  linkSkipBtn: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  linkSkipText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});
