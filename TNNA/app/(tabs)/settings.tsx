import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Switch,
  TextInput,
  Alert,
  Modal,
  Linking,
  Image,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { uploadProfileImage } from '../../services/supabaseData';
import { router } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';
import { useClubStore } from '../../stores/clubStore';
import { usePlayerStore } from '../../stores/playerStore';
import { Card, Select, Footer } from '../../components/ui';
import { ClubSettings, Player, AdminLevel, AdminPermissions } from '../../types';
import { getMemberEmails, saveMemberEmails, getMemberNames, saveMemberName, updateClubCode, updateClubName, findAllClubsByEmail, updateClubAdminEmails, getLocalClub, getAdminLevels, saveAdminLevels, deleteClubFromRegistry } from '../../services/localData';
import { AGE_GROUPS, RACKET_BRANDS, NTRP_LEVELS, MBTI_TYPES, DOUBLES_MODES, SINGLES_MODES, GAME_TYPES } from '../../utils/constants';
import { colors, spacing, radius, typography, MAX_WIDTH } from '../../theme/tokens';
import * as notificationListener from '../../services/notificationListener';
import { testGeminiApiKey } from '../../services/gemini';
import {
  exportSessions, exportPlayers, exportDues,
  importSessions, importPlayers, importDues,
  downloadJson, pickJsonFile,
} from '../../services/backup';

// 대진 방식과 설정 키 매핑
const MODE_TO_SETTING_KEY: Record<string, keyof ClubSettings['showMatchOptions']> = {
  '한울 AA': 'hanulAA',
  '혼합복식': 'mixedDoubles',
  '동성복식': 'sameGenderDoubles',
  '랜덤복식': 'randomDoubles',
  '수동 대진': 'manualMatch',
};

// 기본 설정값
const getDefaultSettings = (): ClubSettings => ({
  useGroups: true,
  groups: ['A조', 'B조'],
  hideGroupFromMembers: false,
  hideNtrpFromMembers: false,
  showMatchOptions: {
    hanulAA: true,
    mixedDoubles: true,
    sameGenderDoubles: true,
    randomDoubles: true,
    manualMatch: true,
    singles: true,
  },
  defaultCourtCount: 2,
  defaultMaxGames: 6,
  useNtrpBalance: false,
  useAdminNtrp: false,
  defaultGameType: '복식',
  defaultIsManualMode: false,
  defaultDoublesMode: '랜덤복식',
  defaultGroupOnly: false,
  memberRestrictions: {
    hideMatch: false,
    hideRecords: false,
    hidePlayers: false,
    hideDues: true,
    hideSettings: false,
  },
});

export default function SettingsScreen() {
  const { user, setUser, signOut, isSuperAdmin } = useAuthStore();
  const { club, clubCode, isAdmin, userRole, clearClub, updateSettings, loadClub, adminLevel: myAdminLevel } = useClubStore();
  const isFeatureDisabled = useClubStore(s => s.isFeatureDisabled);
  const { players, updatePlayer, deletePlayer } = usePlayerStore();
  const [settings, setSettings] = useState<ClubSettings>(getDefaultSettings());
  const [newGroupName, setNewGroupName] = useState('');
  const [showGroupInput, setShowGroupInput] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [backupLoading, setBackupLoading] = useState<string | null>(null);
  // 내 프로필 수정
  const [editingProfile, setEditingProfile] = useState(false);
  const [myPlayer, setMyPlayer] = useState<Player | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    nickname: '',
    gender: '남' as '남' | '여',
    hand: '오른손' as '오른손' | '왼손',
    ageGroup: '40대',
    racket: '모름',
    ntrp: null as number | null,
    mbti: '모름',
    phone: '',
  });
  // 조 이름 변경
  const [editingGroupName, setEditingGroupName] = useState<string | null>(null);
  const [tempGroupName, setTempGroupName] = useState('');
  // 클럽 정보 변경 (관리자)
  const [editingClubName, setEditingClubName] = useState(false);
  const [tempClubName, setTempClubName] = useState('');
  const [editingClubCode, setEditingClubCode] = useState(false);
  const [tempClubCode, setTempClubCode] = useState('');
  const [showDeleteClub, setShowDeleteClub] = useState(false);
  // 회원 관리
  const [memberEmails, setMemberEmails] = useState<string[]>([]);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [showMemberInput, setShowMemberInput] = useState(false);
  // 알림 감지 설정 (Android)
  const [notifPermission, setNotifPermission] = useState(false);
  const notifAvailable = notificationListener.isAvailable();
  // 관리자 이메일 관리
  const [clubAdminEmails, setClubAdminEmails] = useState<string[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  // 관리자 등급 관리
  const [adminLevels, setAdminLevelState] = useState<Record<string, number>>({});
  const isLevel1 = myAdminLevel === 1 || userRole === 'superAdmin';
  // 관리자 등급 이름 편집
  const [editingLevelName, setEditingLevelName] = useState<number | null>(null);
  const [tempLevelName, setTempLevelName] = useState('');
  const DEFAULT_LEVEL_NAMES: Record<number, string> = { 1: '최고관리자', 2: '관리자', 3: '보조' };
  const getLevelName = (lvl: number) => settings.adminLevelNames?.[lvl] || DEFAULT_LEVEL_NAMES[lvl] || `등급${lvl}`;
  // 회원 연동 모달
  const [linkModal, setLinkModal] = useState<{ email: string; visible: boolean }>({ email: '', visible: false });
  // Gemini 도움말 토글
  const [showGeminiHelp, setShowGeminiHelp] = useState(false);
  const [geminiTestResult, setGeminiTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isTestingGemini, setIsTestingGemini] = useState(false);
  // 입금확인 연락처 추가
  const [showContactPhoneInput, setShowContactPhoneInput] = useState(false);
  const [newContactPhone, setNewContactPhone] = useState('');

  // Load settings from club
  useEffect(() => {
    if (club?.settings) {
      const loaded = { ...getDefaultSettings(), ...club.settings };
      // 구 duesContactPhone → duesContactPhones 마이그레이션
      if (!loaded.duesContactPhones?.length && (loaded as any).duesContactPhone) {
        loaded.duesContactPhones = [(loaded as any).duesContactPhone];
      }
      setSettings(loaded);
    }
  }, [club?.settings]);

  // 내 선수 데이터 찾기
  useEffect(() => {
    if (clubCode && user?.email) {
      getMemberNames(clubCode).then((names) => {
        const name = names[user.email!.toLowerCase()];
        const playerName = name || user?.displayName;
        if (playerName) {
          const found = players.find((p) => p.name === playerName);
          setMyPlayer(found || null);
        }
      });
    }
  }, [clubCode, user?.email, players]);

  // Load member emails + names
  useEffect(() => {
    if (clubCode && isAdmin) {
      getMemberEmails(clubCode).then(setMemberEmails);
      getMemberNames(clubCode).then(setMemberNames);
    }
  }, [clubCode, isAdmin]);

  // Load admin emails
  useEffect(() => {
    if (clubCode && isAdmin) {
      const club = getLocalClub(clubCode);
      if (club) setClubAdminEmails(club.adminEmails);
    }
  }, [clubCode, isAdmin]);

  // Load admin levels
  useEffect(() => {
    if (clubCode) {
      getAdminLevels(clubCode).then(setAdminLevelState);
    }
  }, [clubCode]);

  // 알림 권한 체크
  useEffect(() => {
    if (notifAvailable && isAdmin) {
      notificationListener.checkPermission().then(setNotifPermission);
    }
  }, [notifAvailable, isAdmin]);


  const handleSignOut = async () => {
    const confirmed = Platform.OS === 'web'
      ? window.confirm('로그아웃 하시겠습니까?')
      : true;

    if (confirmed) {
      await signOut();
      clearClub();
      router.replace('/');
    }
  };

  const handleChangeClub = () => {
    const confirmed = Platform.OS === 'web'
      ? window.confirm('다른 클럽으로 변경하시겠습니까?')
      : true;

    if (confirmed) {
      clearClub();
      router.replace('/(auth)/club-select');
    }
  };

  // 프로필 수정 시작
  const startEditProfile = () => {
    if (myPlayer) {
      setProfileForm({
        name: myPlayer.name,
        nickname: myPlayer.nickname || '',
        gender: myPlayer.gender,
        hand: myPlayer.hand,
        ageGroup: myPlayer.ageGroup,
        racket: myPlayer.racket,
        ntrp: myPlayer.ntrp,
        mbti: myPlayer.mbti || '모름',
        phone: myPlayer.phone || '',
      });
    } else {
      setProfileForm({
        name: user?.displayName || user?.email?.split('@')[0] || '',
        nickname: '',
        gender: '남',
        hand: '오른손',
        ageGroup: '40대',
        racket: '모름',
        ntrp: null,
        mbti: '모름',
        phone: '',
      });
    }
    setEditingProfile(true);
  };

  // 프로필 저장
  const handleSaveProfile = async () => {
    const trimmedName = profileForm.name.trim();
    if (!trimmedName || !user) return;

    // displayName 업데이트
    setUser({ ...user, displayName: trimmedName });

    // 선수 데이터 업데이트
    if (myPlayer?.id && clubCode) {
      const updates = {
        name: trimmedName,
        nickname: profileForm.nickname.trim() || undefined,
        gender: profileForm.gender,
        hand: profileForm.hand,
        ageGroup: profileForm.ageGroup,
        racket: profileForm.racket,
        ntrp: profileForm.ntrp,
        mbti: profileForm.mbti === '모름' ? null : profileForm.mbti,
        phone: profileForm.phone.trim() || undefined,
      };
      await updatePlayer(clubCode, myPlayer.id, updates);
      // 이름 매핑도 업데이트
      if (user.email) {
        await saveMemberName(clubCode, user.email, trimmedName);
      }
    }

    setEditingProfile(false);
  };

  // 프로필 이미지 선택 및 업로드
  const pickProfileImage = async () => {
    if (!myPlayer?.id || !clubCode || !user?.email) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      const msg = '갤러리 접근 권한이 필요합니다.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('권한 필요', msg);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setUploadingImage(true);
    try {
      const uri = result.assets[0].uri;
      const response = await fetch(uri);
      const blob = await response.blob();
      const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const downloadURL = await uploadProfileImage(clubCode, user.email!, blob, ext);
      if (!downloadURL) throw new Error('Upload failed');
      await updatePlayer(clubCode, myPlayer.id, { photoURL: downloadURL });
      setMyPlayer({ ...myPlayer, photoURL: downloadURL });
      const msg = '프로필 사진이 변경되었습니다.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('완료', msg);
    } catch (e: any) {
      const msg = '이미지 업로드에 실패했습니다.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('오류', msg);
    } finally {
      setUploadingImage(false);
    }
  };

  // 클럽명 변경
  const handleSaveClubName = async () => {
    const trimmed = tempClubName.trim();
    if (!trimmed || !clubCode) return;
    const success = await updateClubName(clubCode, trimmed);
    if (success) {
      await loadClub(clubCode);
      setEditingClubName(false);
    }
  };

  // 클럽코드 변경
  const handleSaveClubCode = async () => {
    const newCode = tempClubCode.trim().toUpperCase();
    if (!newCode || !clubCode) return;
    if (newCode === clubCode) {
      setEditingClubCode(false);
      return;
    }
    const success = await updateClubCode(clubCode, newCode);
    if (success) {
      await loadClub(newCode);
      setEditingClubCode(false);
    } else {
      if (Platform.OS === 'web') {
        alert('클럽 코드 변경에 실패했습니다. 이미 존재하는 코드일 수 있습니다.');
      } else {
        Alert.alert('오류', '클럽 코드 변경에 실패했습니다. 이미 존재하는 코드일 수 있습니다.');
      }
    }
  };

  const handleDeleteClub = async () => {
    if (!clubCode) return;
    await deleteClubFromRegistry(clubCode);
    clearClub();
    setShowDeleteClub(false);
    router.replace('/');
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    const success = await updateSettings(settings);
    setIsSaving(false);

    if (success) {
      if (Platform.OS === 'web') {
        alert('설정이 저장되었습니다.');
      } else {
        Alert.alert('알림', '설정이 저장되었습니다.');
      }
    } else {
      if (Platform.OS === 'web') {
        alert('설정 저장에 실패했습니다.');
      } else {
        Alert.alert('오류', '설정 저장에 실패했습니다.');
      }
    }
  };

  const toggleMatchOption = (key: keyof ClubSettings['showMatchOptions']) => {
    setSettings({
      ...settings,
      showMatchOptions: {
        ...settings.showMatchOptions,
        [key]: !settings.showMatchOptions[key],
      },
    });
  };

  const addGroup = () => {
    const trimmed = newGroupName.trim();
    if (!trimmed) return;
    if (settings.groups.includes(trimmed)) {
      if (Platform.OS === 'web') {
        alert('이미 존재하는 조 이름입니다.');
      } else {
        Alert.alert('오류', '이미 존재하는 조 이름입니다.');
      }
      return;
    }
    setSettings({
      ...settings,
      groups: [...settings.groups, trimmed],
    });
    setNewGroupName('');
    setShowGroupInput(false);
  };

  const removeGroup = (groupName: string) => {
    if (settings.groups.length <= 1) {
      if (Platform.OS === 'web') {
        alert('최소 1개의 조가 필요합니다.');
      } else {
        Alert.alert('오류', '최소 1개의 조가 필요합니다.');
      }
      return;
    }
    setSettings({
      ...settings,
      groups: settings.groups.filter((g) => g !== groupName),
    });
  };

  const renameGroup = async (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) {
      setEditingGroupName(null);
      return;
    }
    if (settings.groups.includes(trimmed)) {
      if (Platform.OS === 'web') alert('이미 존재하는 조 이름입니다.');
      else Alert.alert('오류', '이미 존재하는 조 이름입니다.');
      return;
    }
    setSettings({
      ...settings,
      groups: settings.groups.map((g) => (g === oldName ? trimmed : g)),
    });
    // 해당 조에 속한 선수들의 group 필드도 업데이트
    if (clubCode) {
      for (const p of players.filter((pl) => pl.group === oldName)) {
        if (p.id) await updatePlayer(clubCode, p.id, { group: trimmed });
      }
    }
    setEditingGroupName(null);
  };

  // 회원 이메일 추가
  const addMemberEmail = async () => {
    const trimmedEmail = newMemberEmail.trim().toLowerCase();
    if (!trimmedEmail) return;
    if (memberEmails.some((e) => e.toLowerCase() === trimmedEmail)) {
      if (Platform.OS === 'web') {
        alert('이미 등록된 이메일입니다.');
      } else {
        Alert.alert('오류', '이미 등록된 이메일입니다.');
      }
      return;
    }
    const updated = [...memberEmails, trimmedEmail];
    setMemberEmails(updated);
    setNewMemberEmail('');
    setShowMemberInput(false);
    if (clubCode) await saveMemberEmails(clubCode, updated);
    setLinkModal({ email: trimmedEmail, visible: true });
  };

  // 회원 이메일 삭제 (연동된 선수도 함께 삭제)
  const removeMemberEmail = async (email: string) => {
    const name = memberNames[email.toLowerCase()];
    const linkedPlayer = name ? players.find((p) => p.name === name) : null;

    const msg = linkedPlayer
      ? `${name} (${email}) 회원과 연동된 선수를 함께 삭제하시겠습니까?`
      : `${email} 회원을 삭제하시겠습니까?`;

    const confirmed = Platform.OS === 'web'
      ? window.confirm(msg)
      : await new Promise<boolean>((resolve) =>
          Alert.alert('회원 삭제', msg, [
            { text: '취소', style: 'cancel', onPress: () => resolve(false) },
            { text: '삭제', style: 'destructive', onPress: () => resolve(true) },
          ])
        );

    if (!confirmed) return;

    // 이메일 목록에서 제거
    const updated = memberEmails.filter((e) => e !== email);
    setMemberEmails(updated);
    if (clubCode) await saveMemberEmails(clubCode, updated);

    // 연동된 선수 삭제
    if (linkedPlayer?.id && clubCode) {
      await deletePlayer(clubCode, linkedPlayer.id);
    }
  };

  // 관리자 이메일 추가/삭제
  const handleAddAdminEmail = async () => {
    const email = newAdminEmail.trim().toLowerCase();
    if (!email || !clubCode) return;
    if (clubAdminEmails.some((e) => e.toLowerCase() === email)) return;
    const updated = [...clubAdminEmails, email];
    await updateClubAdminEmails(clubCode, updated);
    setClubAdminEmails(updated);
    setNewAdminEmail('');
    // 기존 회원 연동 모달 표시
    setLinkModal({ email, visible: true });
  };

  const handleRemoveAdminEmail = async (email: string) => {
    if (!clubCode) return;
    if (clubAdminEmails.length <= 1) {
      if (Platform.OS === 'web') {
        alert('최소 1명의 관리자가 필요합니다.');
      } else {
        Alert.alert('알림', '최소 1명의 관리자가 필요합니다.');
      }
      return;
    }
    const updated = clubAdminEmails.filter((e) => e !== email);
    await updateClubAdminEmails(clubCode, updated);
    setClubAdminEmails(updated);
  };

  // 회원 제한 토글
  const toggleMemberRestriction = (key: keyof NonNullable<ClubSettings['memberRestrictions']>) => {
    const current = settings.memberRestrictions || {
      hideMatch: false,
      hideRecords: false,
      hidePlayers: false,
      hideDues: true,
      hideSettings: false,
    };
    setSettings({
      ...settings,
      memberRestrictions: {
        ...current,
        [key]: !current[key],
      },
    });
  };

  // 섹션 제한 토글
  const toggleSectionRestriction = (key: string) => {
    const current = settings.sectionRestrictions || {};
    setSettings({
      ...settings,
      sectionRestrictions: {
        ...current,
        [key]: !current[key],
      },
    });
  };

  // 트리 펼침 상태
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // 계층 트리 정의
  type RestrictionNode = {
    key: string;
    label: string;
    icon?: string;
    children?: RestrictionNode[];
  };

  const RESTRICTION_TREE: RestrictionNode[] = [
    {
      key: 'home', label: '홈', icon: '🏠',
      children: [
        { key: 'home.notice', label: '공지사항' },
        { key: 'home.payment', label: '입금정보' },
        { key: 'home.fortune', label: '오늘의 운세' },
        { key: 'home.recentSchedule', label: '최근 대진표' },
      ],
    },
    {
      key: 'hideMatch', label: '대진 일정', icon: '🏸',
      children: [
        {
          key: 'match.score', label: '일정 보기',
          children: [
            { key: 'match.score.entryDisabled', label: '일정 등록 불가' },
          ],
        },
        { key: 'match.schedule', label: '대진표 생성' },
      ],
    },
    {
      key: 'hideRecords', label: '기록', icon: '📈',
      children: [
        {
          key: 'records.daily', label: '날짜별',
          children: [
            { key: 'records.daily.highlight', label: '오늘의 하이라이트' },
            { key: 'records.daily.matchView', label: '대진별 보기' },
            { key: 'records.daily.individualView', label: '개인별 보기' },
            { key: 'records.daily.inputDisabled', label: '점수 입력 불가' },
            { key: 'records.daily.lockDisabled', label: '게임 잠금 불가' },
          ],
        },
        {
          key: 'records.monthly', label: '월간',
          children: [
            { key: 'records.monthly.playerBests', label: '선수별 베스트' },
            { key: 'records.monthly.groupRanking', label: '조별 순위표' },
          ],
        },
        {
          key: 'records.personal', label: '개인별',
          children: [
            { key: 'records.personal.selfOnly', label: '본인만 보이기' },
          ],
        },
        { key: 'records.ranking', label: '랭킹' },
      ],
    },
    {
      key: 'hidePlayers', label: '선수', icon: '👥',
      children: [
        { key: 'players.stats.groupChart', label: '통계 - 조별 차트' },
        {
          key: 'players.fields', label: '선수 정보 항목',
          children: [
            { key: 'players.fields.gender', label: '성별' },
            { key: 'players.fields.group', label: '조' },
            { key: 'players.fields.age', label: '연령' },
            { key: 'players.fields.hand', label: '주손' },
            { key: 'players.fields.racket', label: '라켓' },
            { key: 'players.fields.ntrp', label: 'NTRP' },
            { key: 'players.fields.phone', label: '전화' },
            { key: 'players.fields.mbti', label: 'MBTI' },
          ],
        },
      ],
    },
    {
      key: 'hideDues', label: '회비', icon: '💳',
      children: [
        { key: 'dues.payment', label: '회비납부' },
        { key: 'dues.status', label: '납부현황' },
        { key: 'dues.settlement', label: '회비정산' },
      ],
    },
    { key: 'hideSettings', label: '설정', icon: '⚙️' },
  ];

  const memberRestrictionLabels: Record<keyof NonNullable<ClubSettings['memberRestrictions']>, string> = {
    hideMatch: '대진 일정',
    hideRecords: '기록',
    hidePlayers: '선수',
    hideDues: '회비',
    hideSettings: '설정',
  };

  // 노드 값 읽기 (탭 레벨 vs 섹션 레벨)
  const isTabKey = (key: string) => key.startsWith('hide');
  const getNodeValue = (key: string): boolean => {
    if (isTabKey(key)) {
      return settings.memberRestrictions?.[key as keyof NonNullable<ClubSettings['memberRestrictions']>] ?? false;
    }
    return settings.sectionRestrictions?.[key] ?? false;
  };
  const toggleNodeValue = (key: string) => {
    if (isTabKey(key)) {
      toggleMemberRestriction(key as keyof NonNullable<ClubSettings['memberRestrictions']>);
    } else {
      toggleSectionRestriction(key);
    }
  };

  // 상위가 숨김인지 체크 (비활성화용)
  const isParentHidden = (node: RestrictionNode, tree: RestrictionNode[]): boolean => {
    // 루트 노드는 부모 없음
    const findParent = (target: string, nodes: RestrictionNode[], parent?: RestrictionNode): RestrictionNode | null => {
      for (const n of nodes) {
        if (n.key === target) return parent || null;
        if (n.children) {
          const found = findParent(target, n.children, n);
          if (found) return found;
        }
      }
      return null;
    };
    const parent = findParent(node.key, tree);
    if (!parent) return false;
    if (getNodeValue(parent.key)) return true;
    return isParentHidden(parent, tree);
  };

  // 재귀 렌더링
  const renderRestrictionNode = (node: RestrictionNode, depth: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedKeys.has(node.key);
    const value = getNodeValue(node.key);
    const disabled = isParentHidden(node, RESTRICTION_TREE);

    return (
      <View key={node.key}>
        <View style={[styles.treeRow, { paddingLeft: depth * 24 }]}>
          {hasChildren ? (
            <TouchableOpacity
              style={styles.treeExpandBtn}
              onPress={() => toggleExpand(node.key)}
            >
              <FontAwesome
                name={isExpanded ? 'chevron-down' : 'chevron-right'}
                size={12}
                color={disabled ? colors.border : colors.textTertiary}
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.treeExpandPlaceholder} />
          )}
          <Text
            style={[
              styles.treeLabel,
              depth === 0 && styles.treeLabelRoot,
              disabled && styles.treeLabelDisabled,
            ]}
          >
            {node.icon ? `${node.icon} ` : ''}{node.label}
          </Text>
          <Switch
            value={disabled ? true : value}
            onValueChange={() => toggleNodeValue(node.key)}
            disabled={disabled}
            trackColor={{ false: colors.textTertiary, true: disabled ? colors.border : colors.primaryLight }}
            thumbColor={disabled ? colors.border : (value ? colors.primary : colors.bg)}
          />
        </View>
        {hasChildren && isExpanded && !disabled && (
          <View>
            {node.children!.map((child) => renderRestrictionNode(child, depth + 1))}
          </View>
        )}
      </View>
    );
  };

  const matchOptionLabels: Record<keyof ClubSettings['showMatchOptions'], string> = {
    hanulAA: '한울 AA',
    mixedDoubles: '혼합복식',
    sameGenderDoubles: '동성복식',
    randomDoubles: '랜덤복식',
    manualMatch: '수동 대진',
    singles: '단식',
  };

  // 구독 등급 제한
  if (isFeatureDisabled('disableSettings')) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <FontAwesome name="lock" size={48} color={colors.textTertiary} />
        <Text style={{ marginTop: 16, fontSize: 16, color: colors.textTertiary, fontWeight: '600' }}>이 기능은 현재 사용할 수 없습니다</Text>
        <Text style={{ marginTop: 8, fontSize: 14, color: colors.textTertiary }}>클럽 등급을 업그레이드하면 이용할 수 있습니다</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Section */}
      <Card>
        <View style={styles.profileSection}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={pickProfileImage}
            disabled={uploadingImage}
            activeOpacity={0.7}
          >
            <View style={styles.avatar}>
              {myPlayer?.photoURL ? (
                <Image source={{ uri: myPlayer.photoURL }} style={styles.avatarImage} />
              ) : (
                <FontAwesome name="user" size={32} color="rgba(255,255,255,0.7)" />
              )}
            </View>
            {!uploadingImage && (
              <View style={styles.avatarEditBadge}>
                <FontAwesome name="camera" size={10} color={colors.white} />
              </View>
            )}
            {uploadingImage && (
              <View style={styles.avatarLoadingOverlay}>
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.profileInfo}>
            <View style={styles.inlineEditRow}>
              <Text style={styles.profileName}>
                {user?.displayName || user?.email?.split('@')[0] || '사용자'}
              </Text>
              <TouchableOpacity onPress={startEditProfile} style={styles.inlineEditBtn}>
                <FontAwesome name="pencil" size={14} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.profileEmail}>{user?.email}</Text>
            {myPlayer && !editingProfile && (
              <View style={styles.profileSummary}>
                {myPlayer.nickname ? (
                  <Text style={styles.profileSummaryText}>별명: {myPlayer.nickname}</Text>
                ) : null}
                <Text style={styles.profileSummaryText}>
                  {myPlayer.gender} · {myPlayer.ageGroup} · {myPlayer.hand === '오른손' ? '우' : '좌'}
                  {myPlayer.ntrp ? ` · NTRP ${myPlayer.ntrp}` : ''}
                </Text>
              </View>
            )}
          </View>
        </View>

        {editingProfile && (
          <View style={styles.profileEditForm}>
            <View style={styles.profileEditDivider} />
            <Text style={styles.profileEditTitle}>내 정보 수정</Text>

            <Text style={styles.profileFieldLabel}>이름</Text>
            <TextInput
              style={styles.profileFieldInput}
              value={profileForm.name}
              onChangeText={(v) => setProfileForm({ ...profileForm, name: v })}
              placeholder="이름"
            />

            <Text style={styles.profileFieldLabel}>별명</Text>
            <TextInput
              style={styles.profileFieldInput}
              value={profileForm.nickname}
              onChangeText={(v) => setProfileForm({ ...profileForm, nickname: v })}
              placeholder="별명 (선택사항)"
            />

            <Text style={styles.profileFieldLabel}>성별</Text>
            <View style={styles.chipRow}>
              {(['남', '여'] as const).map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.chip, profileForm.gender === g && styles.chipActive]}
                  onPress={() => setProfileForm({ ...profileForm, gender: g })}
                >
                  <Text style={[styles.chipText, profileForm.gender === g && styles.chipTextActive]}>
                    {g === '남' ? '남자' : '여자'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.profileFieldLabel}>연령대</Text>
            <View style={styles.chipRow}>
              {AGE_GROUPS.map((age) => (
                <TouchableOpacity
                  key={age}
                  style={[styles.chip, profileForm.ageGroup === age && styles.chipActive]}
                  onPress={() => setProfileForm({ ...profileForm, ageGroup: age })}
                >
                  <Text style={[styles.chipText, profileForm.ageGroup === age && styles.chipTextActive]}>{age}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.profileFieldLabel}>주손</Text>
            <View style={styles.chipRow}>
              {(['오른손', '왼손'] as const).map((h) => (
                <TouchableOpacity
                  key={h}
                  style={[styles.chip, profileForm.hand === h && styles.chipActive]}
                  onPress={() => setProfileForm({ ...profileForm, hand: h })}
                >
                  <Text style={[styles.chipText, profileForm.hand === h && styles.chipTextActive]}>{h}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Select
              label="라켓"
              value={profileForm.racket}
              options={RACKET_BRANDS.map((r) => ({ label: r, value: r }))}
              onChange={(v) => setProfileForm({ ...profileForm, racket: v as string })}
            />

            <Select
              label="NTRP"
              value={profileForm.ntrp}
              options={NTRP_LEVELS.map((n) => ({ label: n.label, value: n.value }))}
              onChange={(v) => setProfileForm({ ...profileForm, ntrp: v as number | null })}
            />

            <Select
              label="MBTI"
              value={profileForm.mbti}
              options={MBTI_TYPES.map((m) => ({ label: m, value: m }))}
              onChange={(v) => setProfileForm({ ...profileForm, mbti: v as string })}
            />

            <Text style={styles.profileFieldLabel}>전화번호</Text>
            <TextInput
              style={styles.profileFieldInput}
              value={profileForm.phone}
              onChangeText={(v) => setProfileForm({ ...profileForm, phone: v })}
              placeholder="010-0000-0000"
              keyboardType="phone-pad"
            />

            <View style={styles.profileEditActions}>
              <TouchableOpacity style={styles.profileSaveBtn} onPress={handleSaveProfile}>
                <Text style={styles.profileSaveBtnText}>저장</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.profileCancelBtn} onPress={() => setEditingProfile(false)}>
                <Text style={styles.profileCancelBtnText}>취소</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Card>

      {/* Club Section */}
      <Card title="🏟️ 클럽 정보">
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>클럽명</Text>
          {isAdmin && editingClubName ? (
            <View style={styles.inlineEditRow}>
              <TextInput
                style={styles.inlineEditInputSmall}
                value={tempClubName}
                onChangeText={setTempClubName}
                onSubmitEditing={handleSaveClubName}
                autoFocus
              />
              <TouchableOpacity onPress={handleSaveClubName} style={styles.inlineEditBtn}>
                <FontAwesome name="check" size={14} color={colors.success} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditingClubName(false)} style={styles.inlineEditBtn}>
                <FontAwesome name="times" size={14} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.inlineEditRow}>
              <Text style={styles.infoValue}>{club?.name || '-'}</Text>
              {isAdmin && (
                <TouchableOpacity
                  onPress={() => {
                    setTempClubName(club?.name || '');
                    setEditingClubName(true);
                  }}
                  style={styles.inlineEditBtn}
                >
                  <FontAwesome name="pencil" size={12} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>클럽 코드</Text>
          {isAdmin && editingClubCode ? (
            <View style={styles.inlineEditRow}>
              <TextInput
                style={styles.inlineEditInputSmall}
                value={tempClubCode}
                onChangeText={setTempClubCode}
                onSubmitEditing={handleSaveClubCode}
                autoCapitalize="characters"
                autoFocus
              />
              <TouchableOpacity onPress={handleSaveClubCode} style={styles.inlineEditBtn}>
                <FontAwesome name="check" size={14} color={colors.success} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditingClubCode(false)} style={styles.inlineEditBtn}>
                <FontAwesome name="times" size={14} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.inlineEditRow}>
              <Text style={styles.infoValue}>{clubCode || '-'}</Text>
              {isAdmin && (
                <TouchableOpacity
                  onPress={() => {
                    setTempClubCode(clubCode || '');
                    setEditingClubCode(true);
                  }}
                  style={styles.inlineEditBtn}
                >
                  <FontAwesome name="pencil" size={12} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>권한</Text>
          <View style={[styles.badge, isAdmin ? styles.badgeAdmin : styles.badgeUser]}>
            <Text style={[styles.badgeText, isAdmin && { color: colors.accent }]}>
              {isSuperAdmin ? '슈퍼 관리자' : isAdmin ? '관리자' : '일반 회원'}
            </Text>
          </View>
        </View>

        {(isSuperAdmin || (user?.email && findAllClubsByEmail(user.email).length > 1)) && (
          <TouchableOpacity style={styles.menuItem} onPress={handleChangeClub}>
            <FontAwesome name="exchange" size={18} color={colors.textTertiary} />
            <Text style={styles.menuText}>클럽 변경</Text>
            <FontAwesome name="chevron-right" size={14} color={colors.textTertiary} />
          </TouchableOpacity>
        )}

        {isAdmin && (
          <>
            {showDeleteClub ? (
              <View style={styles.deleteClubConfirm}>
                <Text style={styles.deleteClubWarn}>
                  "{club?.name}" 클럽의 모든 데이터가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
                </Text>
                <View style={styles.deleteClubBtns}>
                  <TouchableOpacity style={styles.deleteClubYesBtn} onPress={handleDeleteClub}>
                    <Text style={styles.deleteClubYesBtnText}>삭제</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteClubCancelBtn} onPress={() => setShowDeleteClub(false)}>
                    <Text style={styles.deleteClubCancelBtnText}>취소</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.menuItem} onPress={() => setShowDeleteClub(true)}>
                <FontAwesome name="trash-o" size={18} color={colors.error} />
                <Text style={[styles.menuText, { color: colors.error }]}>클럽 삭제</Text>
                <FontAwesome name="chevron-right" size={14} color={colors.error} />
              </TouchableOpacity>
            )}
          </>
        )}
      </Card>

      {/* Club Custom Settings - Admin Only */}
      {isAdmin && (
        <>
          {/* 이름 표기 설정 */}
          <Card title="🏷️ 이름 표기">
            <Text style={styles.cardDesc}>
              회원 이름을 이름 또는 별명으로 표시합니다
            </Text>
            <View style={styles.chipRow}>
              {([
                { value: 'name', label: '이름 표기' },
                { value: 'nickname', label: '별명 표기' },
              ] as const).map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.chip, (settings.displayNameMode || 'name') === opt.value && styles.chipActive]}
                  onPress={() => setSettings({ ...settings, displayNameMode: opt.value })}
                >
                  <Text style={[styles.chipText, (settings.displayNameMode || 'name') === opt.value && styles.chipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          {/* 조 설정 */}
          <Card title="👥 조 설정">
            <View style={styles.settingRow}>
              <View style={styles.settingLabelContainer}>
                <Text style={styles.settingLabel}>조별 구분 사용</Text>
                <Text style={styles.settingDesc}>선수를 조별로 나누어 관리합니다</Text>
              </View>
              <Switch
                value={settings.useGroups}
                onValueChange={(value) => setSettings({ ...settings, useGroups: value })}
                trackColor={{ false: colors.textTertiary, true: colors.primaryLight }}
                thumbColor={settings.useGroups ? colors.primary : colors.bg}
              />
            </View>

            {settings.useGroups && (
              <>
                <View style={styles.groupsContainer}>
                  <Text style={styles.subLabel}>조 목록</Text>
                  <View style={styles.groupChips}>
                    {settings.groups.map((group) => (
                      <View key={group} style={styles.groupChip}>
                        {editingGroupName === group ? (
                          <TextInput
                            style={[styles.groupChipText, { minWidth: 40, padding: 0 }]}
                            value={tempGroupName}
                            onChangeText={setTempGroupName}
                            autoFocus
                            onSubmitEditing={() => renameGroup(group, tempGroupName)}
                            onBlur={() => renameGroup(group, tempGroupName)}
                            selectTextOnFocus
                          />
                        ) : (
                          <TouchableOpacity onPress={() => { setEditingGroupName(group); setTempGroupName(group); }}>
                            <Text style={styles.groupChipText}>{group}</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          onPress={() => removeGroup(group)}
                          style={styles.groupRemoveBtn}
                        >
                          <FontAwesome name="times" size={12} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </View>

                {showGroupInput ? (
                  <View style={styles.addGroupContainer}>
                    <TextInput
                      style={styles.groupInput}
                      placeholder="새 조 이름 (예: C조)"
                      value={newGroupName}
                      onChangeText={setNewGroupName}
                      onSubmitEditing={addGroup}
                    />
                    <TouchableOpacity style={styles.addGroupBtn} onPress={addGroup}>
                      <Text style={styles.addGroupBtnText}>추가</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cancelGroupBtn}
                      onPress={() => {
                        setShowGroupInput(false);
                        setNewGroupName('');
                      }}
                    >
                      <Text style={styles.cancelGroupBtnText}>취소</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.addGroupLink}
                    onPress={() => setShowGroupInput(true)}
                  >
                    <FontAwesome name="plus" size={14} color={colors.primary} />
                    <Text style={styles.addGroupLinkText}>조 추가</Text>
                  </TouchableOpacity>
                )}

                <View style={styles.settingRow}>
                  <View style={styles.settingLabelContainer}>
                    <Text style={styles.settingLabel}>회원에게 조 숨기기</Text>
                    <Text style={styles.settingDesc}>일반 회원에게 선수 조 정보를 숨깁니다</Text>
                  </View>
                  <Switch
                    value={settings.hideGroupFromMembers}
                    onValueChange={(value) => setSettings({ ...settings, hideGroupFromMembers: value })}
                    trackColor={{ false: colors.textTertiary, true: colors.primaryLight }}
                    thumbColor={settings.hideGroupFromMembers ? colors.primary : colors.bg}
                  />
                </View>
              </>
            )}
          </Card>

          {/* NTRP */}
          <Card title="NTRP">
            <View style={styles.settingRow}>
              <View style={styles.settingLabelContainer}>
                <Text style={styles.settingLabel}>회원에게 NTRP 숨기기</Text>
                <Text style={styles.settingDesc}>일반 회원에게 선수 NTRP 정보를 숨깁니다</Text>
              </View>
              <Switch
                value={settings.hideNtrpFromMembers}
                onValueChange={(value) => setSettings({ ...settings, hideNtrpFromMembers: value })}
                trackColor={{ false: colors.textTertiary, true: colors.primaryLight }}
                thumbColor={settings.hideNtrpFromMembers ? colors.primary : colors.bg}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingLabelContainer}>
                <Text style={styles.settingLabel}>NTRP 밸런스 기본 사용</Text>
                <Text style={styles.settingDesc}>대진 생성 시 NTRP 균형 맞추기</Text>
              </View>
              <Switch
                value={settings.useNtrpBalance}
                onValueChange={(value) => setSettings({ ...settings, useNtrpBalance: value })}
                trackColor={{ false: colors.textTertiary, true: colors.primaryLight }}
                thumbColor={settings.useNtrpBalance ? colors.primary : colors.bg}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingLabelContainer}>
                <Text style={styles.settingLabel}>관리NTRP 우선 사용</Text>
                <Text style={styles.settingDesc}>대진 생성 시 관리NTRP 기준으로 균형 맞추기</Text>
              </View>
              <Switch
                value={settings.useAdminNtrp}
                onValueChange={(value) => setSettings({ ...settings, useAdminNtrp: value })}
                trackColor={{ false: colors.textTertiary, true: colors.primaryLight }}
                thumbColor={settings.useAdminNtrp ? colors.primary : colors.bg}
              />
            </View>
          </Card>

          {/* 예상승률 */}
          <Card title="예상승률">
            <View style={styles.settingRow}>
              <View style={styles.settingLabelContainer}>
                <Text style={styles.settingLabel}>예상승률 표시</Text>
                <Text style={styles.settingDesc}>대진표/점수 입력에서 예상승률 표시</Text>
              </View>
              <Switch
                value={settings.showWinProbability !== false}
                onValueChange={(value) => setSettings({ ...settings, showWinProbability: value })}
                trackColor={{ false: colors.textTertiary, true: colors.primaryLight }}
                thumbColor={settings.showWinProbability !== false ? colors.primary : colors.bg}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingLabelContainer}>
                <Text style={styles.settingLabel}>JPG 캡처 시 예상승률 포함</Text>
                <Text style={styles.settingDesc}>이미지 저장 시 예상승률 표시 여부</Text>
              </View>
              <Switch
                value={settings.showProbInJpg !== false}
                onValueChange={(value) => setSettings({ ...settings, showProbInJpg: value })}
                trackColor={{ false: colors.textTertiary, true: colors.primaryLight }}
                thumbColor={settings.showProbInJpg !== false ? colors.primary : colors.bg}
              />
            </View>
          </Card>

          {/* 기본값 설정 */}
          <Card title="🔧 기본값 설정">
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>기본 코트 수</Text>
              <View style={styles.numberInput}>
                <TouchableOpacity
                  style={styles.numberBtn}
                  onPress={() =>
                    setSettings({
                      ...settings,
                      defaultCourtCount: Math.max(1, settings.defaultCourtCount - 1),
                    })
                  }
                >
                  <FontAwesome name="minus" size={14} color={colors.textTertiary} />
                </TouchableOpacity>
                <Text style={styles.numberValue}>{settings.defaultCourtCount}</Text>
                <TouchableOpacity
                  style={styles.numberBtn}
                  onPress={() =>
                    setSettings({
                      ...settings,
                      defaultCourtCount: Math.min(10, settings.defaultCourtCount + 1),
                    })
                  }
                >
                  <FontAwesome name="plus" size={14} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>기본 인당 경기 수</Text>
              <View style={styles.numberInput}>
                <TouchableOpacity
                  style={styles.numberBtn}
                  onPress={() =>
                    setSettings({
                      ...settings,
                      defaultMaxGames: Math.max(1, settings.defaultMaxGames - 1),
                    })
                  }
                >
                  <FontAwesome name="minus" size={14} color={colors.textTertiary} />
                </TouchableOpacity>
                <Text style={styles.numberValue}>{settings.defaultMaxGames}</Text>
                <TouchableOpacity
                  style={styles.numberBtn}
                  onPress={() =>
                    setSettings({
                      ...settings,
                      defaultMaxGames: Math.min(20, settings.defaultMaxGames + 1),
                    })
                  }
                >
                  <FontAwesome name="plus" size={14} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* 게임 타입 */}
            <View style={[styles.settingRow, { marginTop: spacing.md }]}>
              <Text style={styles.settingLabel}>게임 타입</Text>
            </View>
            <View style={styles.defaultRadioRow}>
              {GAME_TYPES.map((gt) => {
                const isActive = (settings.defaultGameType || '복식') === gt;
                return (
                  <TouchableOpacity
                    key={gt}
                    style={[styles.defaultRadioBtn, isActive && styles.defaultRadioBtnActive]}
                    onPress={() => {
                      const gameType = gt.includes('단식') ? '단식' : '복식';
                      const defaultMode = gameType === '단식' ? '동성 단식' : '랜덤복식';
                      setSettings({ ...settings, defaultGameType: gt, defaultDoublesMode: defaultMode });
                    }}
                  >
                    <Text style={[styles.defaultRadioBtnText, isActive && styles.defaultRadioBtnTextActive]}>{gt}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 대진 생성 방식 */}
            <View style={[styles.settingRow, { marginTop: spacing.md }]}>
              <Text style={styles.settingLabel}>대진 생성 방식</Text>
            </View>
            <View style={styles.defaultRadioRow}>
              <TouchableOpacity
                style={[styles.defaultRadioBtn, !settings.defaultIsManualMode && styles.defaultRadioBtnActive]}
                onPress={() => setSettings({ ...settings, defaultIsManualMode: false })}
              >
                <Text style={[styles.defaultRadioBtnText, !settings.defaultIsManualMode && styles.defaultRadioBtnTextActive]}>자동 생성</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.defaultRadioBtn, !!settings.defaultIsManualMode && styles.defaultRadioBtnActive]}
                onPress={() => setSettings({ ...settings, defaultIsManualMode: true })}
              >
                <Text style={[styles.defaultRadioBtnText, !!settings.defaultIsManualMode && styles.defaultRadioBtnTextActive]}>직접 배정(수동)</Text>
              </TouchableOpacity>
            </View>

            {/* 복식/단식 대진 방식 */}
            {!settings.defaultIsManualMode && (() => {
              const gt = settings.defaultGameType || '복식';
              const isSingles = gt.includes('단식');
              const modeList = isSingles
                ? SINGLES_MODES.map(m => ({ label: m, value: m }))
                : DOUBLES_MODES
                    .filter((mode) => {
                      if (!settings.showMatchOptions) return true;
                      const settingKey = MODE_TO_SETTING_KEY[mode];
                      if (!settingKey) return true;
                      return settings.showMatchOptions[settingKey] !== false;
                    })
                    .map((mode) => ({ label: mode, value: mode }));
              return (
                <Select
                  label={isSingles ? '단식 대진 방식' : '복식 대진 방식'}
                  value={settings.defaultDoublesMode || (isSingles ? '동성 단식' : '랜덤복식')}
                  options={modeList}
                  onChange={(v) => setSettings({ ...settings, defaultDoublesMode: v as string })}
                  containerStyle={{ marginTop: spacing.xs }}
                />
              );
            })()}

            {/* NTRP 균형 맞추기 */}
            <View style={[styles.settingRow, { marginTop: spacing.md }]}>
              <Text style={styles.settingLabel}>NTRP 균형 맞추기</Text>
              <Switch
                value={settings.useNtrpBalance}
                onValueChange={(v) => setSettings({ ...settings, useNtrpBalance: v })}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>

            {/* 같은 조끼리만 대진 생성 */}
            {settings.useGroups !== false && (
              <View style={[styles.settingRow, { marginTop: spacing.sm }]}>
                <Text style={styles.settingLabel}>같은 조끼리만 대진 생성</Text>
                <Switch
                  value={!!settings.defaultGroupOnly}
                  onValueChange={(v) => setSettings({ ...settings, defaultGroupOnly: v })}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>
            )}
          </Card>

          {/* 회비 결제 설정 */}
          <Card title="💳 회비 결제 설정">
            {/* 결제 방식 선택 탭 */}
            <View style={styles.payMethodTabs}>
              <TouchableOpacity
                style={[
                  styles.payMethodTab,
                  (settings.bankAccount?.paymentMethod || '무통장입금') === '무통장입금' && styles.payMethodTabActive,
                ]}
                onPress={() => setSettings({
                  ...settings,
                  bankAccount: {
                    ...settings.bankAccount!,
                    paymentMethod: '무통장입금',
                    bankName: settings.bankAccount?.bankName || '',
                    accountNumber: settings.bankAccount?.accountNumber || '',
                    accountHolder: settings.bankAccount?.accountHolder || '',
                  },
                })}
              >
                <FontAwesome name="bank" size={14} color={(settings.bankAccount?.paymentMethod || '무통장입금') === '무통장입금' ? colors.primary : colors.textTertiary} />
                <Text style={[
                  styles.payMethodTabText,
                  (settings.bankAccount?.paymentMethod || '무통장입금') === '무통장입금' && styles.payMethodTabTextActive,
                ]}>무통장입금</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.payMethodTab,
                  settings.bankAccount?.paymentMethod === '카카오페이' && styles.payMethodTabActive,
                ]}
                onPress={() => setSettings({
                  ...settings,
                  bankAccount: {
                    ...settings.bankAccount!,
                    paymentMethod: '카카오페이',
                    bankName: settings.bankAccount?.bankName || '',
                    accountNumber: settings.bankAccount?.accountNumber || '',
                    accountHolder: settings.bankAccount?.accountHolder || '',
                  },
                })}
              >
                <FontAwesome name="commenting" size={14} color={settings.bankAccount?.paymentMethod === '카카오페이' ? colors.primary : colors.textTertiary} />
                <Text style={[
                  styles.payMethodTabText,
                  settings.bankAccount?.paymentMethod === '카카오페이' && styles.payMethodTabTextActive,
                ]}>카카오페이</Text>
              </TouchableOpacity>
            </View>

            {/* 무통장입금 설정 */}
            {(settings.bankAccount?.paymentMethod || '무통장입금') === '무통장입금' && (
              <>
                <Text style={styles.cardDesc}>
                  회원이 입금 버튼을 누르면 아래 계좌정보가 자동으로 복사됩니다
                </Text>
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>은행명</Text>
                </View>
                <TextInput
                  style={styles.textInput}
                  value={settings.bankAccount?.bankName || ''}
                  onChangeText={(v) => setSettings({
                    ...settings,
                    bankAccount: {
                      ...settings.bankAccount!,
                      paymentMethod: settings.bankAccount?.paymentMethod || '무통장입금',
                      bankName: v,
                      accountNumber: settings.bankAccount?.accountNumber || '',
                      accountHolder: settings.bankAccount?.accountHolder || '',
                    },
                  })}
                  placeholder="카카오뱅크"
                />
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>계좌번호</Text>
                </View>
                <TextInput
                  style={styles.textInput}
                  value={settings.bankAccount?.accountNumber || ''}
                  onChangeText={(v) => setSettings({
                    ...settings,
                    bankAccount: {
                      ...settings.bankAccount!,
                      paymentMethod: settings.bankAccount?.paymentMethod || '무통장입금',
                      bankName: settings.bankAccount?.bankName || '',
                      accountNumber: v,
                      accountHolder: settings.bankAccount?.accountHolder || '',
                    },
                  })}
                  placeholder="3333-01-1234567"
                />
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>예금주</Text>
                </View>
                <TextInput
                  style={styles.textInput}
                  value={settings.bankAccount?.accountHolder || ''}
                  onChangeText={(v) => setSettings({
                    ...settings,
                    bankAccount: {
                      ...settings.bankAccount!,
                      paymentMethod: settings.bankAccount?.paymentMethod || '무통장입금',
                      bankName: settings.bankAccount?.bankName || '',
                      accountNumber: settings.bankAccount?.accountNumber || '',
                      accountHolder: v,
                    },
                  })}
                  placeholder="홍길동"
                />
              </>
            )}

            {/* 카카오페이 설정 */}
            {settings.bankAccount?.paymentMethod === '카카오페이' && (
              <>
                <Text style={styles.cardDesc}>
                  회원이 입금 버튼을 누르면 카카오페이 송금 페이지로 이동합니다
                </Text>
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>카카오페이 송금 링크</Text>
                </View>
                <TextInput
                  style={styles.textInput}
                  value={settings.bankAccount?.kakaoPayUrl || ''}
                  onChangeText={(v) => setSettings({
                    ...settings,
                    bankAccount: {
                      ...settings.bankAccount!,
                      kakaoPayUrl: v,
                    },
                  })}
                  placeholder="https://qr.kakaopay.com/..."
                  autoCapitalize="none"
                  keyboardType="url"
                />
                <Text style={styles.payMethodHint}>
                  카카오페이 앱 {'>'} 더보기 {'>'} 송금코드에서 링크를 복사하세요
                </Text>
              </>
            )}
            <Text style={styles.profileFieldLabel}>입금확인 연락처</Text>
            <Text style={styles.payMethodHint}>
              회원이 입금 후 이 번호로 확인 요청 메시지를 보냅니다
            </Text>
            {(settings.duesContactPhones || []).map((phone, idx) => (
              <View key={idx} style={styles.contactPhoneRow}>
                <FontAwesome name="phone" size={13} color={colors.textTertiary} />
                <Text style={styles.contactPhoneText}>{phone}</Text>
                <TouchableOpacity
                  style={styles.contactPhoneRemoveBtn}
                  onPress={() => {
                    const updated = (settings.duesContactPhones || []).filter((_, i) => i !== idx);
                    setSettings({ ...settings, duesContactPhones: updated });
                  }}
                >
                  <FontAwesome name="times" size={12} color={colors.error} />
                </TouchableOpacity>
              </View>
            ))}
            {showContactPhoneInput ? (
              <View style={styles.addGroupContainer}>
                <TextInput
                  style={styles.groupInput}
                  value={newContactPhone}
                  onChangeText={setNewContactPhone}
                  placeholder="010-0000-0000"
                  keyboardType="phone-pad"
                  onSubmitEditing={() => {
                    const trimmed = newContactPhone.trim();
                    if (!trimmed) return;
                    setSettings({
                      ...settings,
                      duesContactPhones: [...(settings.duesContactPhones || []), trimmed],
                    });
                    setNewContactPhone('');
                    setShowContactPhoneInput(false);
                  }}
                  autoFocus
                />
                <TouchableOpacity
                  style={styles.addGroupBtn}
                  onPress={() => {
                    const trimmed = newContactPhone.trim();
                    if (!trimmed) return;
                    setSettings({
                      ...settings,
                      duesContactPhones: [...(settings.duesContactPhones || []), trimmed],
                    });
                    setNewContactPhone('');
                    setShowContactPhoneInput(false);
                  }}
                >
                  <Text style={styles.addGroupBtnText}>추가</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelGroupBtn}
                  onPress={() => {
                    setShowContactPhoneInput(false);
                    setNewContactPhone('');
                  }}
                >
                  <Text style={styles.cancelGroupBtnText}>취소</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addGroupLink}
                onPress={() => setShowContactPhoneInput(true)}
              >
                <FontAwesome name="plus" size={14} color={colors.primary} />
                <Text style={styles.addGroupLinkText}>연락처 추가</Text>
              </TouchableOpacity>
            )}
          </Card>

          {/* 입금 알림 자동 감지 (Android Only) */}
          {notifAvailable && (
            <Card title="🔔 입금 알림 자동 감지">
              <Text style={styles.cardDesc}>
                은행/카카오톡 입금 알림을 자동 감지하여 회비 상태를 변경합니다 (Android 전용)
              </Text>

              <View style={styles.settingRow}>
                <View style={styles.settingLabelContainer}>
                  <Text style={styles.settingLabel}>알림 감지 활성화</Text>
                  <Text style={styles.settingDesc}>
                    회비 탭에서 입금 알림을 자동으로 감지합니다
                  </Text>
                </View>
                <Switch
                  value={settings.notificationListener?.enabled ?? false}
                  onValueChange={(value) => {
                    if (value && !notifPermission) {
                      // 권한 없으면 설정 화면으로
                      notificationListener.openPermissionSettings();
                      return;
                    }
                    setSettings({
                      ...settings,
                      notificationListener: {
                        enabled: value,
                        allowedPackages: settings.notificationListener?.allowedPackages || notificationListener.DEFAULT_PACKAGES,
                      },
                    });
                  }}
                  trackColor={{ false: colors.textTertiary, true: colors.primaryLight }}
                  thumbColor={settings.notificationListener?.enabled ? colors.primary : colors.bg}
                />
              </View>

              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>알림 접근 권한</Text>
                <View style={styles.notifPermRow}>
                  <View style={[styles.notifPermBadge, notifPermission ? styles.notifPermOn : styles.notifPermOff]}>
                    <Text style={styles.notifPermText}>
                      {notifPermission ? '허용됨' : '미허용'}
                    </Text>
                  </View>
                  {!notifPermission && (
                    <TouchableOpacity
                      style={styles.notifPermBtn}
                      onPress={async () => {
                        await notificationListener.openPermissionSettings();
                        // 설정에서 돌아오면 재확인
                        setTimeout(async () => {
                          const granted = await notificationListener.checkPermission();
                          setNotifPermission(granted);
                        }, 1000);
                      }}
                    >
                      <Text style={styles.notifPermBtnText}>설정 열기</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {(settings.notificationListener?.enabled ?? false) && (
                <>
                  <Text style={[styles.subLabel, { marginTop: 12 }]}>감지 대상 앱</Text>
                  <View style={styles.notifAppGrid}>
                    {notificationListener.BANK_PACKAGES.map((bank) => {
                      const selected = (settings.notificationListener?.allowedPackages || []).includes(bank.pkg);
                      return (
                        <TouchableOpacity
                          key={bank.pkg}
                          style={[styles.notifAppChip, selected && styles.notifAppChipActive]}
                          onPress={() => {
                            const current = settings.notificationListener?.allowedPackages || [];
                            const updated = selected
                              ? current.filter((p) => p !== bank.pkg)
                              : [...current, bank.pkg];
                            setSettings({
                              ...settings,
                              notificationListener: {
                                enabled: settings.notificationListener?.enabled ?? false,
                                allowedPackages: updated,
                              },
                            });
                          }}
                        >
                          <FontAwesome
                            name={selected ? 'check-square-o' : 'square-o'}
                            size={14}
                            color={selected ? colors.primary : colors.textTertiary}
                          />
                          <Text style={[styles.notifAppLabel, selected && styles.notifAppLabelActive]}>
                            {bank.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
            </Card>
          )}

          {/* 회원 메뉴 제한 */}
          <Card title="🔒 일반 회원 메뉴 제한">
            <Text style={styles.cardDesc}>
              일반 회원에게 숨길 탭/섹션을 선택하세요. 하위 항목을 개별 설정하려면 화살표를 눌러 펼치세요.
            </Text>
            {RESTRICTION_TREE.map((node) => renderRestrictionNode(node, 0))}
          </Card>

          {/* 관리자 이메일 관리 */}
          <Card title="🛡️ 관리자 관리">
            <Text style={styles.cardDesc}>
              관리자 이메일을 관리하세요 ({clubAdminEmails.length}명)
            </Text>
            {clubAdminEmails.map((email) => {
              const level = adminLevels[email.toLowerCase()] || 1;
              const adminName = memberNames[email.toLowerCase()];
              return (
                <View key={email} style={styles.memberEmailRow}>
                  <FontAwesome name="user-secret" size={14} color={colors.primary} />
                  <View style={styles.memberInfoCol}>
                    {adminName ? (
                      <>
                        <Text style={styles.memberNameText}>{adminName}</Text>
                        <Text style={styles.memberEmailSubText}>{email}</Text>
                      </>
                    ) : (
                      <Text style={styles.memberEmailText}>{email}</Text>
                    )}
                  </View>
                  {isLevel1 && (
                    <View style={styles.adminLevelDropdown}>
                      <Select
                        value={level}
                        options={[
                          { label: `Lv.1 ${getLevelName(1)}`, value: 1 },
                          { label: `Lv.2 ${getLevelName(2)}`, value: 2 },
                          { label: `Lv.3 ${getLevelName(3)}`, value: 3 },
                        ]}
                        textStyle={{ fontSize: 12 }}
                        onChange={async (v) => {
                          const newLevels = { ...adminLevels, [email.toLowerCase()]: v as number };
                          setAdminLevelState(newLevels);
                          if (clubCode) await saveAdminLevels(clubCode, newLevels);
                        }}
                      />
                    </View>
                  )}
                  {!isLevel1 && (
                    <Text style={styles.adminLevelText}>
                      Lv.{level} {getLevelName(level)}
                    </Text>
                  )}
                  {isLevel1 && (
                    <TouchableOpacity
                      onPress={() => setLinkModal({ email, visible: true })}
                      style={styles.memberLinkBtn}
                    >
                      <FontAwesome name="link" size={12} color={colors.primary} />
                    </TouchableOpacity>
                  )}
                  {isLevel1 && (
                    <TouchableOpacity
                      onPress={() => handleRemoveAdminEmail(email)}
                      style={styles.memberRemoveBtn}
                    >
                      <FontAwesome name="times" size={14} color={colors.error} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
            <View style={styles.addGroupContainer}>
              <TextInput
                style={styles.groupInput}
                placeholder="새 관리자 이메일"
                value={newAdminEmail}
                onChangeText={setNewAdminEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                onSubmitEditing={handleAddAdminEmail}
              />
              <TouchableOpacity style={styles.addGroupBtn} onPress={handleAddAdminEmail}>
                <Text style={styles.addGroupBtnText}>추가</Text>
              </TouchableOpacity>
            </View>
            {isLevel1 && (
              <View style={styles.adminPermSection}>
                {/* 등급 이름 변경 */}
                <Text style={[styles.cardDesc, { marginTop: 16, marginBottom: 8, fontWeight: '600' }]}>
                  등급 이름 설정
                </Text>
                {[1, 2, 3].map(lvl => (
                  <View key={lvl} style={styles.adminPermRow}>
                    <Text style={styles.adminPermLabel}>Lv.{lvl}</Text>
                    {editingLevelName === lvl ? (
                      <View style={styles.levelNameEditRow}>
                        <TextInput
                          style={styles.levelNameInput}
                          value={tempLevelName}
                          onChangeText={setTempLevelName}
                          autoFocus
                          onSubmitEditing={() => {
                            if (tempLevelName.trim()) {
                              const names = { ...settings.adminLevelNames, [lvl]: tempLevelName.trim() };
                              setSettings({ ...settings, adminLevelNames: names });
                            }
                            setEditingLevelName(null);
                          }}
                          onBlur={() => {
                            if (tempLevelName.trim()) {
                              const names = { ...settings.adminLevelNames, [lvl]: tempLevelName.trim() };
                              setSettings({ ...settings, adminLevelNames: names });
                            }
                            setEditingLevelName(null);
                          }}
                        />
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.levelNameDisplay}
                        onPress={() => {
                          setEditingLevelName(lvl);
                          setTempLevelName(getLevelName(lvl));
                        }}
                      >
                        <Text style={styles.levelNameText}>{getLevelName(lvl)}</Text>
                        <FontAwesome name="pencil" size={10} color={colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}

                <Text style={[styles.cardDesc, { marginTop: 16, marginBottom: 8, fontWeight: '600' }]}>
                  등급별 권한 설정
                </Text>
                {[2, 3].map(lvl => {
                  const perms = settings.adminLevelPermissions?.[lvl] || {
                    canAccessDues: lvl === 2,
                    canEditPlayers: lvl === 2,
                    canCreateSchedule: lvl === 2,
                    canInputScores: true,
                  };
                  return (
                    <View key={lvl} style={styles.adminPermBlock}>
                      <Text style={styles.adminPermTitle}>
                        Lv.{lvl} {getLevelName(lvl)}
                      </Text>
                      {([
                        ['canAccessDues', '회비탭 접근'],
                        ['canEditPlayers', '선수 정보 수정'],
                        ['canCreateSchedule', '대진 생성'],
                        ['canInputScores', '점수 입력'],
                      ] as [keyof AdminPermissions, string][]).map(([key, label]) => (
                        <View key={key} style={styles.adminPermRow}>
                          <Text style={styles.adminPermLabel}>{label}</Text>
                          <Switch
                            value={perms[key]}
                            onValueChange={(val) => {
                              const newPerms = {
                                ...settings.adminLevelPermissions,
                                [lvl]: { ...perms, [key]: val },
                              };
                              setSettings({ ...settings, adminLevelPermissions: newPerms });
                            }}
                            trackColor={{ false: colors.border, true: colors.primary }}
                          />
                        </View>
                      ))}
                    </View>
                  );
                })}
              </View>
            )}
          </Card>

          {/* 회원 이메일 관리 */}
          <Card title="👤 일반 회원 관리">
            <Text style={styles.cardDesc}>
              일반 회원 이메일을 등록하세요 ({memberEmails.length}명)
            </Text>

            {memberEmails.map((email) => {
              const name = memberNames[email.toLowerCase()];
              return (
                <View key={email} style={styles.memberEmailRow}>
                  <FontAwesome name="user-o" size={14} color={colors.textTertiary} />
                  <View style={styles.memberInfoCol}>
                    {name ? (
                      <>
                        <Text style={styles.memberNameText}>{name}</Text>
                        <Text style={styles.memberEmailSubText}>{email}</Text>
                      </>
                    ) : (
                      <Text style={styles.memberEmailText}>{email}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => setLinkModal({ email, visible: true })}
                    style={styles.memberLinkBtn}
                  >
                    <FontAwesome name="link" size={12} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => removeMemberEmail(email)}
                    style={styles.memberRemoveBtn}
                  >
                    <FontAwesome name="times" size={14} color={colors.error} />
                  </TouchableOpacity>
                </View>
              );
            })}

            {showMemberInput ? (
              <View style={styles.addGroupContainer}>
                <TextInput
                  style={styles.groupInput}
                  placeholder="이메일 주소"
                  value={newMemberEmail}
                  onChangeText={setNewMemberEmail}
                  onSubmitEditing={addMemberEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <TouchableOpacity style={styles.addGroupBtn} onPress={addMemberEmail}>
                  <Text style={styles.addGroupBtnText}>추가</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelGroupBtn}
                  onPress={() => {
                    setShowMemberInput(false);
                    setNewMemberEmail('');
                  }}
                >
                  <Text style={styles.cancelGroupBtnText}>취소</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addGroupLink}
                onPress={() => setShowMemberInput(true)}
              >
                <FontAwesome name="plus" size={14} color={colors.primary} />
                <Text style={styles.addGroupLinkText}>회원 추가</Text>
              </TouchableOpacity>
            )}
          </Card>

          {/* 회원 연동 모달 */}
          <Modal
            visible={linkModal.visible}
            transparent
            animationType="fade"
            onRequestClose={() => setLinkModal({ email: '', visible: false })}
          >
            <View style={styles.linkModalOverlay}>
              <View style={[styles.linkModalContainer, { width: 320, maxHeight: 400 }]}>
                <Text style={styles.scorePickerTitle}>회원 연동</Text>
                <Text style={[styles.cardDesc, { textAlign: 'center', marginBottom: 12 }]}>
                  {linkModal.email}을(를) 연동시킬{'\n'}기존 회원이 있습니까?
                </Text>
                <ScrollView style={{ maxHeight: 250 }}>
                  {players
                    .map(p => {
                      const linked = p.email?.toLowerCase() === linkModal.email.toLowerCase();
                      return (
                        <TouchableOpacity
                          key={p.id || p.name}
                          style={[styles.linkPlayerRow, linked && { backgroundColor: colors.primaryLight }]}
                          onPress={async () => {
                            if (clubCode && p.id) {
                              // 기존에 이 이메일로 연동된 선수가 있으면 해제
                              const prev = players.find(pl => pl.email?.toLowerCase() === linkModal.email.toLowerCase() && pl.id !== p.id);
                              if (prev?.id) await updatePlayer(clubCode, prev.id, { email: '' });
                              await updatePlayer(clubCode, p.id, { email: linkModal.email });
                              await saveMemberName(clubCode, linkModal.email, p.name);
                              setMemberNames(prev => ({ ...prev, [linkModal.email.toLowerCase()]: p.name }));
                            }
                            setLinkModal({ email: '', visible: false });
                          }}
                        >
                          <Text style={styles.linkPlayerName}>{p.name}</Text>
                          {linked ? (
                            <Text style={{ fontSize: 11, color: colors.primary }}>연동됨</Text>
                          ) : (
                            <FontAwesome name="link" size={12} color={colors.primary} />
                          )}
                        </TouchableOpacity>
                      );
                    })
                  }
                </ScrollView>
                <TouchableOpacity
                  style={[styles.addGroupLink, { marginTop: 12 }]}
                  onPress={async () => {
                    // 연동 해제
                    if (clubCode) {
                      const prev = players.find(pl => pl.email?.toLowerCase() === linkModal.email.toLowerCase());
                      if (prev?.id) await updatePlayer(clubCode, prev.id, { email: '' });
                      const nextNames = { ...memberNames };
                      delete nextNames[linkModal.email.toLowerCase()];
                      setMemberNames(nextNames);
                    }
                    setLinkModal({ email: '', visible: false });
                  }}
                >
                  <Text style={styles.cancelGroupBtnText}>연동 해제</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Gemini AI 설정 */}
          <Card title="🤖 AI분석 적용 (Gemini)">
            <Text style={styles.cardDesc}>
              Google Gemini API 키를 등록하면 대진분석, 개인분석, 경기총평, 동물프로필이 AI로 생성됩니다. 키가 없으면 오프라인 템플릿이 사용됩니다.
            </Text>
            <TouchableOpacity
              style={styles.geminiHelpToggle}
              onPress={() => setShowGeminiHelp(!showGeminiHelp)}
            >
              <FontAwesome name="question-circle" size={14} color={colors.primary} />
              <Text style={styles.geminiHelpToggleText}>
                API 키 발급 방법 {showGeminiHelp ? '▲' : '▼'}
              </Text>
            </TouchableOpacity>
            {showGeminiHelp && (
              <View style={styles.geminiHelpBox}>
                <Text style={styles.geminiHelpStep}>1. Google AI Studio 접속</Text>
                <TouchableOpacity onPress={() => Linking.openURL('https://aistudio.google.com/apikey')}>
                  <Text style={styles.geminiHelpLink}>https://aistudio.google.com/apikey</Text>
                </TouchableOpacity>
                <Text style={styles.geminiHelpStep}>2. Google 계정으로 로그인</Text>
                <Text style={styles.geminiHelpStep}>3. "API 키 만들기" 버튼 클릭</Text>
                <Text style={styles.geminiHelpStep}>4. 생성된 키(AIza..로 시작)를 복사하여 아래에 붙여넣기</Text>
                <Text style={styles.geminiHelpNote}>* 무료 사용량으로 충분합니다 (분당 15회)</Text>
              </View>
            )}
            <View style={styles.settingRow}>
              <TextInput
                style={styles.geminiKeyInput}
                value={settings.geminiApiKey || ''}
                onChangeText={(text) => {
                  setSettings({ ...settings, geminiApiKey: text.trim() });
                  setGeminiTestResult(null);
                }}
                placeholder="Gemini API Key 입력"
                placeholderTextColor={colors.textSecondary}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <TouchableOpacity
              style={[styles.geminiTestBtn, isTestingGemini && { opacity: 0.6 }]}
              disabled={isTestingGemini || !settings.geminiApiKey?.trim()}
              onPress={async () => {
                if (!settings.geminiApiKey?.trim()) return;
                setIsTestingGemini(true);
                setGeminiTestResult(null);
                const result = await testGeminiApiKey(settings.geminiApiKey.trim());
                setGeminiTestResult(result);
                setIsTestingGemini(false);
              }}
            >
              <FontAwesome name={isTestingGemini ? 'spinner' : 'check-circle'} size={14} color={colors.accent} />
              <Text style={styles.geminiTestBtnText}>
                {isTestingGemini ? ' 테스트 중...' : ' API 키 테스트'}
              </Text>
            </TouchableOpacity>
            {geminiTestResult && (
              <View style={[styles.geminiTestResult, { backgroundColor: geminiTestResult.ok ? colors.successBg : colors.errorBg }]}>
                <FontAwesome
                  name={geminiTestResult.ok ? 'check-circle' : 'times-circle'}
                  size={14}
                  color={geminiTestResult.ok ? colors.success : colors.error}
                />
                <Text style={[styles.geminiTestResultText, { color: geminiTestResult.ok ? colors.success : colors.error }]}>
                  {' '}{geminiTestResult.message}
                </Text>
              </View>
            )}
            <Text style={styles.geminiFeatureDesc}>
              API 키 등록 시 AI가 활성화되는 기능: 대진분석, 개인 대진분석, 경기총평, 동물 프로필
            </Text>
          </Card>

          {/* 저장 버튼 */}
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSaveSettings}
            disabled={isSaving}
          >
            <FontAwesome name="save" size={18} color={colors.accent} />
            <Text style={styles.saveButtonText}>
              {isSaving ? '저장 중...' : '설정 저장'}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {/* 데이터 백업 - 최고관리자만 */}
      {isLevel1 && <Card title="💾 데이터 백업">
        {([
          { key: 'sessions', label: '경기기록', exportFn: exportSessions, importFn: importSessions, unit: '세션' },
          { key: 'players', label: '선수', exportFn: exportPlayers, importFn: importPlayers, unit: '명' },
          { key: 'dues', label: '회비', exportFn: exportDues, importFn: importDues, unit: '' },
        ] as const).map((item, idx) => (
          <View key={item.key} style={[styles.backupRow, idx === 2 && { borderBottomWidth: 0 }]}>
            <Text style={styles.backupLabel}>{item.label}</Text>
            <View style={styles.backupBtns}>
              <TouchableOpacity
                style={styles.backupSaveBtn}
                disabled={!!backupLoading}
                onPress={async () => {
                  if (!clubCode) return;
                  setBackupLoading(`export_${item.key}`);
                  try {
                    const json = await item.exportFn(clubCode);
                    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                    const filename = `${item.label}_${clubCode}_${date}.json`;
                    await downloadJson(json, filename);
                  } catch (e: any) {
                    const msg = e?.message || '백업 저장에 실패했습니다.';
                    Platform.OS === 'web' ? alert(msg) : Alert.alert('오류', msg);
                  } finally {
                    setBackupLoading(null);
                  }
                }}
              >
                <FontAwesome name="download" size={12} color={colors.primary} />
                <Text style={styles.backupSaveBtnText}>
                  {backupLoading === `export_${item.key}` ? '...' : '저장'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.backupLoadBtn}
                disabled={!!backupLoading}
                onPress={async () => {
                  if (!clubCode) return;
                  const doImport = () => {
                    (async () => {
                      setBackupLoading(`import_${item.key}`);
                      try {
                        const json = await pickJsonFile();
                        if (!json) { setBackupLoading(null); return; }
                        if (item.key === 'sessions') {
                          const count = await importSessions(clubCode, json);
                          const msg = `경기기록 ${count}개 세션 복원 완료`;
                          Platform.OS === 'web' ? alert(msg) : Alert.alert('완료', msg);
                        } else if (item.key === 'players') {
                          const count = await importPlayers(clubCode, json);
                          const msg = `선수 ${count}명 복원 완료`;
                          Platform.OS === 'web' ? alert(msg) : Alert.alert('완료', msg);
                        } else {
                          await importDues(clubCode, json);
                          const msg = '회비 데이터 복원 완료';
                          Platform.OS === 'web' ? alert(msg) : Alert.alert('완료', msg);
                        }
                      } catch (e: any) {
                        const msg = e?.message || '복원에 실패했습니다.';
                        Platform.OS === 'web' ? alert(msg) : Alert.alert('오류', msg);
                      } finally {
                        setBackupLoading(null);
                      }
                    })();
                  };
                  if (Platform.OS === 'web') {
                    if (window.confirm('기존 데이터가 대체됩니다. 계속하시겠습니까?')) doImport();
                  } else {
                    Alert.alert('데이터 복원', '기존 데이터가 대체됩니다. 계속하시겠습니까?', [
                      { text: '취소', style: 'cancel' },
                      { text: '복원', style: 'destructive', onPress: doImport },
                    ]);
                  }
                }}
              >
                <FontAwesome name="upload" size={12} color={colors.textSecondary} />
                <Text style={styles.backupLoadBtnText}>
                  {backupLoading === `import_${item.key}` ? '...' : '불러오기'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </Card>}

      {/* App Info Section */}
      <Card title="ℹ️ 앱 정보">
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>버전</Text>
          <Text style={styles.infoValue}>1.0.0</Text>
        </View>
      </Card>

      {/* Account Section */}
      <Card title="🔐 계정">
        <TouchableOpacity style={styles.menuItem} onPress={handleSignOut}>
          <FontAwesome name="sign-out" size={18} color={colors.error} />
          <Text style={[styles.menuText, { color: colors.error }]}>로그아웃</Text>
        </TouchableOpacity>
      </Card>

      <Footer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
    maxWidth: MAX_WIDTH,
    alignSelf: 'center',
    width: '100%',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.card,
  },
  avatarLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
    marginLeft: spacing.lg,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  profileEmail: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  profileSummary: {
    marginTop: 6,
  },
  profileSummaryText: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  profileEditForm: {
    marginTop: 4,
  },
  profileEditDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.lg,
  },
  profileEditTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  profileFieldLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 6,
    marginTop: 10,
  },
  profileFieldInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.text,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
  },
  chipText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  profileEditActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  profileSaveBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  profileSaveBtnText: {
    color: colors.black,
    fontSize: 15,
    fontWeight: '600',
  },
  profileCancelBtn: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  profileCancelBtnText: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  badge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: 10,
    borderRadius: radius.md,
  },
  badgeAdmin: {
    backgroundColor: colors.navy,
  },
  badgeUser: {
    backgroundColor: colors.bg,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  menuText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    marginLeft: 14,
  },
  // 인라인 편집 스타일
  inlineEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inlineEditInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  inlineEditInputSmall: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: spacing.xs,
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    minWidth: 100,
  },
  inlineEditBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 설정 관련 스타일
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  settingLabelContainer: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    color: colors.text,
  },
  settingDesc: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
  },
  cardDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  geminiHelpToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  geminiHelpToggleText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  geminiHelpBox: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  geminiHelpStep: {
    fontSize: 13,
    color: colors.text,
    marginBottom: 4,
    lineHeight: 20,
  },
  geminiHelpLink: {
    fontSize: 13,
    color: colors.primary,
    textDecorationLine: 'underline' as const,
    marginBottom: 6,
    marginLeft: 4,
  },
  geminiHelpNote: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    fontStyle: 'italic' as const,
  },
  geminiKeyInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.bg,
    flex: 1,
  },
  geminiTestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.navy,
    paddingVertical: 10,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
  },
  geminiTestBtnText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  geminiTestResult: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
  },
  geminiTestResultText: {
    fontSize: 13,
    flex: 1,
  },
  geminiFeatureDesc: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.bg,
    marginBottom: spacing.md,
  },
  subLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 10,
  },
  // 조 관련 스타일
  groupsContainer: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  groupChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  groupChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D1B2A',
    paddingVertical: 6,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    borderRadius: radius.lg,
  },
  groupChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#818CF8',
    marginRight: 6,
  },
  groupRemoveBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#2D1215',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addGroupContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  groupInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
  },
  addGroupBtn: {
    backgroundColor: colors.navy,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  addGroupBtnText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  cancelGroupBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  cancelGroupBtnText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  addGroupLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: 6,
  },
  addGroupLinkText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  // 회원 이메일 스타일
  memberEmailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    gap: 10,
  },
  memberInfoCol: {
    flex: 1,
  },
  memberNameText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  memberEmailSubText: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 1,
  },
  memberEmailText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  memberLinkBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberRemoveBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.errorBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 숫자 입력
  numberInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
  },
  numberBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    minWidth: 32,
    textAlign: 'center',
  },
  // 저장 버튼
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.navy,
    paddingVertical: 14,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  saveButtonDisabled: {
    backgroundColor: colors.navyLight,
  },
  saveButtonText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '600',
  },
  // 결제 방식 탭 스타일
  payMethodTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  payMethodTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  payMethodTabActive: {
    backgroundColor: colors.primaryBg,
    borderColor: colors.primary,
  },
  payMethodTabText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  payMethodTabTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  payMethodHint: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  // 알림 감지 스타일
  notifPermRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notifPermBadge: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  notifPermOn: {
    backgroundColor: colors.successBg,
  },
  notifPermOff: {
    backgroundColor: colors.errorBg,
  },
  notifPermText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  notifPermBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  notifPermBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.black,
  },
  notifAppGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  notifAppChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notifAppChipActive: {
    backgroundColor: colors.primaryBg,
    borderColor: colors.primaryLight,
  },
  notifAppLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  notifAppLabelActive: {
    color: colors.primary,
    fontWeight: '500',
  },
  // 트리형 제한 스타일
  treeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  treeExpandBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  treeExpandPlaceholder: {
    width: 24,
    marginRight: 4,
  },
  treeLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  treeLabelRoot: {
    fontSize: 15,
    fontWeight: '500',
  },
  treeLabelDisabled: {
    color: colors.textTertiary,
  },
  contactPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    marginBottom: 6,
  },
  contactPhoneText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  contactPhoneRemoveBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.errorBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 관리자 등급 스타일
  adminLevelDropdown: {
    width: 130,
    marginRight: 8,
  },
  adminLevelText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginRight: 8,
  },
  adminPermSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 12,
    paddingTop: 4,
  },
  adminPermBlock: {
    marginBottom: 12,
  },
  adminPermTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  adminPermRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  adminPermLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  levelNameEditRow: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  levelNameInput: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    fontSize: 12,
    color: colors.text,
    backgroundColor: colors.white,
  },
  levelNameDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  levelNameText: {
    fontSize: 12,
    color: colors.text,
  },
  // 회원 연동 모달 스타일
  linkPlayerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  linkPlayerName: {
    fontSize: 14,
    color: colors.text,
  },
  linkModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkModalContainer: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
  },
  scorePickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  defaultRadioRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 6,
    marginTop: spacing.xs,
  },
  defaultRadioBtn: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  defaultRadioBtnActive: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
  },
  defaultRadioBtnText: {
    ...typography.captionMedium,
    color: colors.text,
  },
  defaultRadioBtnTextActive: {
    color: colors.accent,
    fontWeight: '600' as const,
  },
  // 백업 스타일
  backupRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  backupLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text,
  },
  backupBtns: {
    flexDirection: 'row' as const,
    gap: 8,
  },
  backupSaveBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.card,
  },
  backupSaveBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.primary,
  },
  backupLoadBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  backupLoadBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.textSecondary,
  },
  // 클럽 삭제
  deleteClubConfirm: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.errorBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.error,
  },
  deleteClubWarn: {
    fontSize: 13,
    color: colors.error,
    fontWeight: '600' as const,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  deleteClubBtns: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
  },
  deleteClubYesBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.error,
    alignItems: 'center' as const,
  },
  deleteClubYesBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  deleteClubCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: colors.border,
  },
  deleteClubCancelBtnText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600' as const,
  },
});
