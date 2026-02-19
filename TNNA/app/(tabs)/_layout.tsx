import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useAuthStore } from '../../stores/authStore';
import { useClubStore } from '../../stores/clubStore';
import { usePlayerStore } from '../../stores/playerStore';
import { colors, spacing, typography, MAX_WIDTH } from '../../theme/tokens';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={22} style={{ marginBottom: -3 }} {...props} />;
}

// 커스텀 헤더 컴포넌트
function CustomHeader({ title }: { title: string }) {
  return (
    <View style={styles.headerContainer}>
      <View style={styles.headerContent}>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
    </View>
  );
}

// 회원 제한에 따른 탭 숨김 매핑
const TAB_RESTRICTION_MAP: Record<string, keyof NonNullable<import('../../types').ClubSettings['memberRestrictions']>> = {
  match: 'hideMatch',
  records: 'hideRecords',
  players: 'hidePlayers',
  dues: 'hideDues',
  settings: 'hideSettings',
};

// 구독 등급 기반 탭 제한 매핑
const FEATURE_FLAG_TAB_MAP: Record<string, keyof import('../../types').ClubFeatureFlags> = {
  match: 'disableSchedule',
  records: 'disableRecords',
  players: 'disablePlayers',
  settings: 'disableSettings',
  dues: 'disableDues',
};

// 커스텀 탭 바 컴포넌트
function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { isSuperAdmin } = useAuthStore();
  const { userRole, club, isAdmin, effectiveFlags } = useClubStore();
  const hasPermission = useClubStore(s => s.hasPermission);
  const memberRestrictions = club?.settings?.memberRestrictions;

  // admin without canAccessDues permission should not see dues tab
  const canSeeDues = !isAdmin || hasPermission('canAccessDues');

  return (
    <View style={styles.tabBarContainer}>
      <View style={styles.tabBarContent}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          // admin 탭은 슈퍼 어드민만 표시
          if (route.name === 'admin' && !isSuperAdmin) return null;
          // admin without canAccessDues permission: hide dues tab
          if (route.name === 'dues' && !canSeeDues) return null;
          // 일반 회원이면 memberRestrictions에 따라 탭 숨김
          if (userRole === 'member' && memberRestrictions) {
            const restrictionKey = TAB_RESTRICTION_MAP[route.name];
            if (restrictionKey && memberRestrictions[restrictionKey]) return null;
          }
          // 구독 등급 기반 기능 제한 (슈퍼어드민 제외)
          if (!isSuperAdmin && effectiveFlags) {
            const flagKey = FEATURE_FLAG_TAB_MAP[route.name];
            if (flagKey && effectiveFlags[flagKey]) return null;
          }
          const label = options.title || route.name;
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          // 아이콘 이름 매핑
          const iconNames: Record<string, React.ComponentProps<typeof FontAwesome>['name']> = {
            home: 'home',
            diary: 'book',
            match: 'calendar',
            records: 'line-chart',
            players: 'users',
            dues: 'krw',
            settings: 'cog',
            admin: 'shield',
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={onPress}
              style={styles.tabItem}
            >
              <FontAwesome
                name={iconNames[route.name] || 'circle'}
                size={20}
                color={isFocused ? colors.accent : 'rgba(255,255,255,0.45)'}
                style={{ marginBottom: 2 }}
              />
              <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  const { user, isSuperAdmin } = useAuthStore();
  const { clubCode, club, loadClub, checkAdminStatus } = useClubStore();
  const { loadPlayers } = usePlayerStore();

  // Load club data
  useEffect(() => {
    if (clubCode && !club) {
      loadClub(clubCode);
    }
  }, [clubCode, club]);

  // Check admin status
  useEffect(() => {
    if (clubCode && user?.email) {
      checkAdminStatus(user.email);
    }
  }, [clubCode, user?.email]);

  // Load players
  useEffect(() => {
    if (clubCode) {
      loadPlayers(clubCode);
    }
  }, [clubCode]);

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        header: ({ options }) => <CustomHeader title={options.headerTitle as string || options.title || ''} />,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: '홈',
          headerShown: false,
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="diary"
        options={{
          title: '다이어리',
          tabBarIcon: ({ color }) => <TabBarIcon name="book" color={color} />,
          headerTitle: '다이어리',
        }}
      />
      <Tabs.Screen
        name="match"
        options={{
          title: '대진 일정',
          tabBarIcon: ({ color }) => <TabBarIcon name="calendar" color={color} />,
          headerTitle: '📋 대진 일정',
        }}
      />
      <Tabs.Screen
        name="records"
        options={{
          title: '기록',
          tabBarIcon: ({ color }) => <TabBarIcon name="line-chart" color={color} />,
          headerTitle: '📊 경기 기록',
        }}
      />
      <Tabs.Screen
        name="players"
        options={{
          title: '선수',
          tabBarIcon: ({ color }) => <TabBarIcon name="users" color={color} />,
          headerTitle: '🏃 선수 관리',
        }}
      />
      <Tabs.Screen
        name="dues"
        options={{
          title: '회비',
          tabBarIcon: ({ color }) => <TabBarIcon name="krw" color={color} />,
          headerTitle: '💰 회비 관리',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '설정',
          tabBarIcon: ({ color }) => <TabBarIcon name="cog" color={color} />,
          headerTitle: '⚙️ 설정',
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'TN 관리',
          tabBarIcon: ({ color }) => <TabBarIcon name="shield" color={color} />,
          headerTitle: '🎾 Tennis Note 관리',
          href: isSuperAdmin ? undefined : null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // 커스텀 헤더 스타일
  headerContainer: {
    backgroundColor: colors.navy,
    paddingTop: 50,
  },
  headerContent: {
    maxWidth: MAX_WIDTH,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  // 커스텀 탭 바 스타일
  tabBarContainer: {
    backgroundColor: colors.navy,
    borderTopWidth: 0,
    paddingBottom: Platform.OS === 'android' ? 48 : 34,
  },
  tabBarContent: {
    maxWidth: MAX_WIDTH,
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    paddingTop: 10,
    paddingBottom: spacing.xs,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  tabLabel: {
    ...typography.tabLabel,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 3,
  },
  tabLabelActive: {
    color: colors.accent,
    fontWeight: '700',
  },
});
