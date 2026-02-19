import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { useClubStore } from '../../stores/clubStore';
import { Button, Input, Card } from '../../components/ui';
import { findAllClubsByEmail } from '../../services/localData';
import { colors, spacing, radius, typography, MAX_WIDTH } from '../../theme/tokens';

export default function ClubSelectScreen() {
  const { user, isSuperAdmin } = useAuthStore();
  const { loadClub, loadAllClubs, allClubs, isLoading, setClubCode } = useClubStore();
  const [inputCode, setInputCode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadAllClubs();
  }, []);

  // 슈퍼 어드민은 전체, 일반 유저는 가입된 클럽만
  const myClubCodes = user?.email ? findAllClubsByEmail(user.email) : [];
  const visibleClubs = isSuperAdmin
    ? allClubs
    : allClubs.filter((c) => myClubCodes.includes(c.code));

  useEffect(() => {
    if (!user) {
      router.replace('/(auth)/login');
    }
  }, [user]);

  const handleSubmit = async () => {
    const code = inputCode.trim().toUpperCase();
    if (!code) {
      setError('클럽코드를 입력해 주세요.');
      return;
    }

    setError('');
    const success = await loadClub(code);

    if (success) {
      router.replace('/(tabs)/home');
    } else {
      setError('등록되지 않은 클럽코드입니다.');
    }
  };

  const handleSelectClub = async (code: string) => {
    const success = await loadClub(code);
    if (success) {
      router.replace('/(tabs)/home');
    } else {
      Alert.alert('오류', '클럽 정보를 불러올 수 없습니다.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.subtitle}>🎾 테니스클럽 경기기록 도우미</Text>
          <Text style={styles.title}>TENNIS NOTE</Text>
        </View>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>🔑 클럽코드 입력</Text>
          <Text style={styles.cardDescription}>
            클럽코드를 입력하면 해당 클럽의 선수와 경기 기록을 불러옵니다.
          </Text>

          <Input
            value={inputCode}
            onChangeText={(text) => {
              setInputCode(text.toUpperCase());
              setError('');
            }}
            placeholder="예: HMMC, MSPC"
            autoCapitalize="characters"
            error={error}
          />

          <Button
            title="시작하기"
            onPress={handleSubmit}
            loading={isLoading}
            fullWidth
            style={{ marginTop: 8 }}
          />
        </Card>

        {visibleClubs.length > 0 && (
          <View style={styles.clubListContainer}>
            <Text style={styles.clubListTitle}>🏟️ 내 클럽</Text>
            <FlatList
              data={visibleClubs}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.clubItem}
                  onPress={() => handleSelectClub(item.code)}
                  activeOpacity={0.7}
                >
                  <View style={styles.clubInfo}>
                    <Text style={styles.clubName}>{item.name}</Text>
                    <Text style={styles.clubCode}>{item.code}</Text>
                  </View>
                  <Text style={styles.clubArrow}>›</Text>
                </TouchableOpacity>
              )}
              scrollEnabled={false}
            />
          </View>
        )}

        <View style={styles.userInfo}>
          <Text style={styles.userInfoText}>
            로그인: {user?.email}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    padding: spacing['2xl'],
    maxWidth: MAX_WIDTH,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginTop: spacing['2xl'],
    marginBottom: spacing['3xl'],
  },
  subtitle: {
    fontSize: 15,
    color: colors.textTertiary,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.heroTitle,
    color: colors.text,
    letterSpacing: 1,
  },
  card: {
    marginBottom: spacing['2xl'],
  },
  cardTitle: {
    ...typography.title,
    fontSize: 18,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  cardDescription: {
    ...typography.body,
    color: colors.textTertiary,
    marginBottom: spacing.lg,
  },
  clubListContainer: {
    marginTop: spacing.sm,
  },
  clubListTitle: {
    ...typography.bodyMedium,
    color: colors.textTertiary,
    marginBottom: spacing.md,
    paddingLeft: spacing.xs,
  },
  clubItem: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
  },
  clubInfo: {
    flex: 1,
  },
  clubName: {
    ...typography.section,
    color: colors.text,
  },
  clubCode: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  clubArrow: {
    fontSize: 24,
    color: colors.textTertiary,
    fontWeight: '300',
  },
  userInfo: {
    marginTop: 'auto',
    paddingTop: spacing['2xl'],
    alignItems: 'center',
  },
  userInfoText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
});
