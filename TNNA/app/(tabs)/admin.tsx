import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  RefreshControl,
  Platform,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { useClubStore } from '../../stores/clubStore';
import { Card, Footer } from '../../components/ui';
import { ClubSettings, ClubFeatureFlags, SubscriptionTier, TierFeatureConfig } from '../../types';
import {
  ClubSummary,
  getAllClubsSummary,
  saveClubFeatureFlags,
  saveLocalClubSettings,
  addClubToRegistry,
  updateClubAdminEmails,
  updateClubCode,
  updateClubName,
  getDefaultClubSettings,
  getDefaultFeatureFlags,
  getSuperAdminEmails,
  addSuperAdminEmail,
  removeSuperAdminEmail,
  getTierFeatureConfig,
  saveTierFeatureConfig,
  getDefaultTierFeatureConfig,
  saveClubTier,
  deleteClubFromRegistry,
} from '../../services/localData';
import { colors, spacing, radius, typography, MAX_WIDTH } from '../../theme/tokens';

const TIERS: SubscriptionTier[] = ['Basic', 'Plus', 'Pro', 'Prime'];
const TIER_COLORS: Record<SubscriptionTier, string> = {
  Basic: colors.textTertiary,
  Plus: '#3B82F6',
  Pro: '#F59E0B',
  Prime: colors.success,
};

export default function AdminScreen() {
  const { user, isSuperAdmin } = useAuthStore();
  const { viewOverride, setViewOverride, checkAdminStatus } = useClubStore();
  const [clubs, setClubs] = useState<ClubSummary[]>([]);
  const [expandedClub, setExpandedClub] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  // 슈퍼어드민 이메일 관리
  const [superAdminEmails, setSuperAdminEmails] = useState<string[]>([]);
  const [newSuperAdminInput, setNewSuperAdminInput] = useState('');

  // 새 클럽 추가 폼
  const [newClubCode, setNewClubCode] = useState('');
  const [newClubName, setNewClubName] = useState('');
  const [newClubAdmin, setNewClubAdmin] = useState('');
  const [newClubError, setNewClubError] = useState('');

  // 관리자 이메일 추가 입력
  const [addAdminInput, setAddAdminInput] = useState<Record<string, string>>({});

  // 클럽코드/이름 편집 상태
  const [editingClubInfo, setEditingClubInfo] = useState<string | null>(null);
  const [editClubCode, setEditClubCode] = useState('');
  const [editClubName, setEditClubName] = useState('');
  const [editClubError, setEditClubError] = useState('');
  const [editAdminEmails, setEditAdminEmails] = useState<string[]>([]);
  const [editNewAdminEmail, setEditNewAdminEmail] = useState('');
  const [deleteConfirmClub, setDeleteConfirmClub] = useState<string | null>(null);

  // 수정 중인 기능 플래그 및 설정 (로컬 상태)
  const [editFlags, setEditFlags] = useState<Record<string, ClubFeatureFlags>>({});
  const [editSettings, setEditSettings] = useState<Record<string, ClubSettings>>({});

  // 등급별 메뉴 설정
  const [tierConfig, setTierConfig] = useState<TierFeatureConfig>(getDefaultTierFeatureConfig());
  const [clubTiers, setClubTiers] = useState<Record<string, SubscriptionTier>>({});
  const [tierConfigExpanded, setTierConfigExpanded] = useState(false);

  const loadData = useCallback(async () => {
    const data = await getAllClubsSummary();
    setClubs(data);
    setSuperAdminEmails(getSuperAdminEmails());

    // 등급 설정 로드
    const config = await getTierFeatureConfig();
    setTierConfig(config);

    // 클럽별 등급 로드
    const tiers: Record<string, SubscriptionTier> = {};
    for (const club of data) {
      tiers[club.code] = club.subscriptionTier;
    }
    setClubTiers(tiers);

    // editFlags / editSettings 초기화
    const flags: Record<string, ClubFeatureFlags> = {};
    const settings: Record<string, ClubSettings> = {};
    for (const club of data) {
      flags[club.code] = { ...club.featureFlags };
      settings[club.code] = { ...club.settings };
    }
    setEditFlags(flags);
    setEditSettings(settings);
  }, []);

  useEffect(() => {
    if (isSuperAdmin) {
      loadData();
    }
  }, [isSuperAdmin]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // 권한 없는 사용자
  if (!isSuperAdmin) {
    return (
      <View style={styles.noAccess}>
        <FontAwesome name="lock" size={48} color={colors.textTertiary} />
        <Text style={styles.noAccessText}>접근 권한이 없습니다</Text>
      </View>
    );
  }

  // 통계 요약
  const totalPlayers = clubs.reduce((sum, c) => sum + c.playerCount, 0);
  const totalSessions = clubs.reduce((sum, c) => sum + c.sessionCount, 0);

  const toggleExpand = (code: string) => {
    setExpandedClub(expandedClub === code ? null : code);
  };

  const handleToggleFlag = (clubCode: string, key: keyof ClubFeatureFlags) => {
    setEditFlags((prev) => ({
      ...prev,
      [clubCode]: {
        ...prev[clubCode],
        [key]: !prev[clubCode][key],
      },
    }));
  };

  const handleSettingChange = (clubCode: string, key: keyof ClubSettings, value: any) => {
    setEditSettings((prev) => ({
      ...prev,
      [clubCode]: {
        ...prev[clubCode],
        [key]: value,
      },
    }));
  };

  const handleSaveClub = async (clubCode: string) => {
    setSaving(clubCode);
    const flagsOk = await saveClubFeatureFlags(clubCode, editFlags[clubCode]);
    const settingsOk = await saveLocalClubSettings(clubCode, editSettings[clubCode]);

    if (flagsOk && settingsOk) {
      if (Platform.OS === 'web') {
        alert('저장되었습니다.');
      }
    } else {
      if (Platform.OS === 'web') {
        alert('저장에 실패했습니다.');
      }
    }
    setSaving(null);
    await loadData();
  };

  const handleAddClub = async () => {
    const code = newClubCode.trim().toUpperCase();
    const name = newClubName.trim();
    const admin = newClubAdmin.trim();

    if (!code || !name || !admin) {
      setNewClubError('모든 필드를 입력해주세요.');
      return;
    }

    const success = await addClubToRegistry(code, name, admin);
    if (success) {
      setNewClubCode('');
      setNewClubName('');
      setNewClubAdmin('');
      setNewClubError('');
      await loadData();
    } else {
      setNewClubError('이미 존재하는 클럽코드입니다.');
    }
  };

  const handleAddAdmin = async (clubCode: string) => {
    const email = (addAdminInput[clubCode] || '').trim();
    if (!email) return;

    const club = clubs.find((c) => c.code === clubCode);
    if (!club) return;
    if (club.adminEmails.includes(email)) return;

    const newEmails = [...club.adminEmails, email];
    await updateClubAdminEmails(clubCode, newEmails);
    setAddAdminInput((prev) => ({ ...prev, [clubCode]: '' }));
    await loadData();
  };

  const startEditClubInfo = (club: ClubSummary) => {
    setEditingClubInfo(club.code);
    setEditClubCode(club.code);
    setEditClubName(club.name);
    setEditAdminEmails([...club.adminEmails]);
    setEditNewAdminEmail('');
    setEditClubError('');
    setDeleteConfirmClub(null);
  };

  const cancelEditClubInfo = () => {
    setEditingClubInfo(null);
    setEditClubCode('');
    setEditClubName('');
    setEditAdminEmails([]);
    setEditNewAdminEmail('');
    setEditClubError('');
    setDeleteConfirmClub(null);
  };

  const handleSaveClubInfo = async (originalCode: string) => {
    const trimmedCode = editClubCode.trim().toUpperCase();
    const trimmedName = editClubName.trim();

    if (!trimmedCode || !trimmedName) {
      setEditClubError('코드와 이름을 모두 입력해주세요.');
      return;
    }

    // 관리자 이메일 변경
    const origClub = clubs.find((c) => c.code === originalCode);
    if (origClub && JSON.stringify(editAdminEmails) !== JSON.stringify(origClub.adminEmails)) {
      await updateClubAdminEmails(originalCode, editAdminEmails);
    }

    // 이름 변경
    if (trimmedName !== origClub?.name) {
      const nameOk = await updateClubName(originalCode, trimmedName);
      if (!nameOk) {
        setEditClubError('이름 변경에 실패했습니다.');
        return;
      }
    }

    // 코드 변경
    if (trimmedCode !== originalCode) {
      const codeOk = await updateClubCode(originalCode, trimmedCode);
      if (!codeOk) {
        setEditClubError('이미 존재하는 코드이거나 변경에 실패했습니다.');
        return;
      }
      if (expandedClub === originalCode) {
        setExpandedClub(trimmedCode);
      }
    }

    cancelEditClubInfo();
    await loadData();
  };

  const handleDeleteClub = async (clubCode: string) => {
    await deleteClubFromRegistry(clubCode);
    setDeleteConfirmClub(null);
    cancelEditClubInfo();
    const { clubCode: currentClub, clearClub } = useClubStore.getState();
    if (currentClub === clubCode) {
      clearClub();
      router.replace('/');
    }
    await loadData();
  };

  const handleRemoveAdmin = async (clubCode: string, email: string) => {
    const club = clubs.find((c) => c.code === clubCode);
    if (!club) return;
    if (club.adminEmails.length <= 1) {
      if (Platform.OS === 'web') {
        alert('최소 1명의 관리자가 필요합니다.');
      }
      return;
    }
    const newEmails = club.adminEmails.filter((e) => e !== email);
    await updateClubAdminEmails(clubCode, newEmails);
    await loadData();
  };

  // 슈퍼어드민 이메일 추가/삭제
  const handleAddSuperAdmin = async () => {
    const email = newSuperAdminInput.trim().toLowerCase();
    if (!email) return;
    if (superAdminEmails.includes(email)) return;
    const ok = await addSuperAdminEmail(email);
    if (ok) {
      setSuperAdminEmails(getSuperAdminEmails());
      setNewSuperAdminInput('');
    }
  };

  const handleRemoveSuperAdmin = async (email: string) => {
    if (superAdminEmails.length <= 1) {
      if (Platform.OS === 'web') alert('최소 1명의 슈퍼어드민이 필요합니다.');
      return;
    }
    const ok = await removeSuperAdminEmail(email);
    if (ok) {
      setSuperAdminEmails(getSuperAdminEmails());
    }
  };

  // 뷰 토글
  const handleViewToggle = (mode: 'admin' | 'member') => {
    if (mode === 'member') {
      setViewOverride('member');
    } else {
      setViewOverride(null);
      if (user?.email) checkAdminStatus(user.email);
    }
  };

  // 등급 변경
  const handleTierChange = async (clubCode: string, tier: SubscriptionTier) => {
    setClubTiers((prev) => ({ ...prev, [clubCode]: tier }));
    await saveClubTier(clubCode, tier);
  };

  // 등급 설정 저장
  const handleSaveTierConfig = async () => {
    const ok = await saveTierFeatureConfig(tierConfig);
    if (Platform.OS === 'web') alert(ok ? '등급 설정이 저장되었습니다.' : '저장 실패');
  };

  const flagLabels: Record<keyof ClubFeatureFlags, string> = {
    disableSchedule: '대진표 생성',
    disableAdvancedModes: '고급대진',
    disableJpgCapture: 'JPG 캡처',
    disableWinProbability: '예상승률',
    disableRecords: '기록 보기',
    disableScoreEdit: '점수 편집',
    disableHighlights: '하이라이트/MVP',
    disableAIAnalysis: 'AI 분석',
    disableStats: '통계 (월별)',
    disablePersonalStats: '개인별 통계',
    disableRanking: '랭킹',
    disablePlayers: '선수 관리',
    disableSettings: '설정',
    disableDues: '회비 관리',
    disableReservation: '코트 예약',
  };

  const FLAG_CATEGORIES: { label: string; keys: (keyof ClubFeatureFlags)[] }[] = [
    { label: '대진표', keys: ['disableSchedule', 'disableAdvancedModes', 'disableJpgCapture', 'disableWinProbability'] },
    { label: '기록', keys: ['disableRecords', 'disableScoreEdit', 'disableHighlights', 'disableAIAnalysis'] },
    { label: '통계', keys: ['disableStats', 'disablePersonalStats', 'disableRanking'] },
    { label: '기타', keys: ['disablePlayers', 'disableSettings', 'disableDues', 'disableReservation'] },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* 뷰 토글 */}
      <View style={styles.viewToggleBar}>
        <TouchableOpacity
          style={[styles.viewToggleBtn, !viewOverride && styles.viewToggleBtnActive]}
          onPress={() => handleViewToggle('admin')}
        >
          <FontAwesome name="shield" size={14} color={!viewOverride ? colors.white : colors.textTertiary} />
          <Text style={[styles.viewToggleBtnText, !viewOverride && styles.viewToggleBtnTextActive]}>
            관리자로 보기
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewToggleBtn, viewOverride === 'member' && styles.viewToggleBtnActive]}
          onPress={() => handleViewToggle('member')}
        >
          <FontAwesome name="user" size={14} color={viewOverride === 'member' ? colors.white : colors.textTertiary} />
          <Text style={[styles.viewToggleBtnText, viewOverride === 'member' && styles.viewToggleBtnTextActive]}>
            회원으로 보기
          </Text>
        </TouchableOpacity>
      </View>

      {/* 전체 개요 */}
      <Card title="전체 개요">
        <View style={styles.overviewRow}>
          <View style={styles.overviewItem}>
            <FontAwesome name="building" size={20} color={colors.primary} />
            <Text style={styles.overviewValue}>{clubs.length}</Text>
            <Text style={styles.overviewLabel}>클럽</Text>
          </View>
          <View style={styles.overviewItem}>
            <FontAwesome name="users" size={20} color={colors.success} />
            <Text style={styles.overviewValue}>{totalPlayers}</Text>
            <Text style={styles.overviewLabel}>전체 회원</Text>
          </View>
          <View style={styles.overviewItem}>
            <FontAwesome name="calendar-check-o" size={20} color={colors.warning} />
            <Text style={styles.overviewValue}>{totalSessions}</Text>
            <Text style={styles.overviewLabel}>전체 세션</Text>
          </View>
        </View>
      </Card>

      {/* 등급별 메뉴 설정 */}
      <Card>
        <TouchableOpacity
          style={styles.tierConfigHeader}
          onPress={() => setTierConfigExpanded(!tierConfigExpanded)}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <FontAwesome name="sliders" size={16} color={colors.primary} />
            <Text style={styles.tierConfigTitle}>등급별 메뉴 설정</Text>
          </View>
          <FontAwesome
            name={tierConfigExpanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={colors.textTertiary}
          />
        </TouchableOpacity>

        {tierConfigExpanded && (
          <View style={styles.tierConfigBody}>
            {/* 매트릭스 헤더 */}
            <View style={styles.tierMatrixHeader}>
              <Text style={[styles.tierMatrixLabel, { flex: 2 }]}>기능</Text>
              {TIERS.map((tier) => (
                <Text key={tier} style={[styles.tierMatrixTierLabel, { color: TIER_COLORS[tier] }]}>
                  {tier}
                </Text>
              ))}
            </View>

            {/* 카테고리별 기능 행 */}
            {FLAG_CATEGORIES.map((cat) => (
              <View key={cat.label}>
                <View style={styles.tierCategoryHeader}>
                  <Text style={styles.tierCategoryLabel}>{cat.label}</Text>
                </View>
                {cat.keys.map((flagKey) => (
                  <View key={flagKey} style={styles.tierMatrixRow}>
                    <Text style={[styles.tierMatrixLabel, { flex: 2 }]}>
                      {flagLabels[flagKey]}
                    </Text>
                    {TIERS.map((tier) => (
                      <TouchableOpacity
                        key={tier}
                        style={styles.tierMatrixCell}
                        onPress={() => {
                          setTierConfig((prev) => ({
                            ...prev,
                            [tier]: {
                              ...prev[tier],
                              [flagKey]: !prev[tier][flagKey],
                            },
                          }));
                        }}
                      >
                        <FontAwesome
                          name={tierConfig[tier][flagKey] ? 'times-circle' : 'check-circle'}
                          size={20}
                          color={tierConfig[tier][flagKey] ? colors.error : colors.success}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
              </View>
            ))}

            {/* 범례 */}
            <View style={styles.tierLegend}>
              <View style={styles.tierLegendItem}>
                <FontAwesome name="check-circle" size={14} color={colors.success} />
                <Text style={styles.tierLegendText}>사용 가능</Text>
              </View>
              <View style={styles.tierLegendItem}>
                <FontAwesome name="times-circle" size={14} color={colors.error} />
                <Text style={styles.tierLegendText}>비활성화</Text>
              </View>
            </View>

            {/* 저장 버튼 */}
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveTierConfig}>
              <FontAwesome name="save" size={16} color={colors.white} />
              <Text style={styles.saveBtnText}>등급 설정 저장</Text>
            </TouchableOpacity>
          </View>
        )}
      </Card>

      {/* 클럽별 카드 */}
      {clubs.map((club) => {
        const isExpanded = expandedClub === club.code;
        const flags = editFlags[club.code] || getDefaultFeatureFlags();
        const settings = editSettings[club.code] || getDefaultClubSettings();
        const isEditingThis = editingClubInfo === club.code;
        const currentTier = clubTiers[club.code] || 'Prime';

        return (
          <Card key={club.code}>
            {/* 헤더 (항상 표시) */}
            {isEditingThis ? (
              <View style={styles.editClubInfoSection}>
                <View style={styles.editClubInfoRow}>
                  <Text style={styles.editClubInfoLabel}>클럽코드</Text>
                  <TextInput
                    style={styles.editClubInfoInput}
                    value={editClubCode}
                    onChangeText={(t) => { setEditClubCode(t.toUpperCase()); setEditClubError(''); }}
                    autoCapitalize="characters"
                  />
                </View>
                <View style={styles.editClubInfoRow}>
                  <Text style={styles.editClubInfoLabel}>클럽이름</Text>
                  <TextInput
                    style={styles.editClubInfoInput}
                    value={editClubName}
                    onChangeText={(t) => { setEditClubName(t); setEditClubError(''); }}
                  />
                </View>

                {/* 관리자 이메일 편집 */}
                <Text style={[styles.editClubInfoLabel, { marginTop: 12, marginBottom: 4 }]}>관리자 이메일</Text>
                {editAdminEmails.map((email, idx) => (
                  <View key={idx} style={styles.editAdminRow}>
                    <FontAwesome name="user-secret" size={12} color={colors.primary} />
                    <Text style={styles.editAdminEmail}>{email}</Text>
                    {editAdminEmails.length > 1 && (
                      <TouchableOpacity
                        onPress={() => setEditAdminEmails(editAdminEmails.filter((_, i) => i !== idx))}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <FontAwesome name="times" size={12} color={colors.error} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                <View style={styles.editAdminAddRow}>
                  <TextInput
                    style={styles.editAdminInput}
                    placeholder="새 관리자 이메일"
                    value={editNewAdminEmail}
                    onChangeText={setEditNewAdminEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    onSubmitEditing={() => {
                      const t = editNewAdminEmail.trim().toLowerCase();
                      if (t && t.includes('@') && !editAdminEmails.includes(t)) {
                        setEditAdminEmails([...editAdminEmails, t]);
                        setEditNewAdminEmail('');
                      }
                    }}
                  />
                  <TouchableOpacity
                    style={styles.editAdminAddBtn}
                    onPress={() => {
                      const t = editNewAdminEmail.trim().toLowerCase();
                      if (t && t.includes('@') && !editAdminEmails.includes(t)) {
                        setEditAdminEmails([...editAdminEmails, t]);
                        setEditNewAdminEmail('');
                      }
                    }}
                  >
                    <Text style={styles.editAdminAddBtnText}>추가</Text>
                  </TouchableOpacity>
                </View>

                {editClubError ? (
                  <Text style={styles.errorText}>{editClubError}</Text>
                ) : null}
                <View style={styles.editClubInfoBtns}>
                  <TouchableOpacity
                    style={styles.editClubInfoSaveBtn}
                    onPress={() => handleSaveClubInfo(club.code)}
                  >
                    <Text style={styles.editClubInfoSaveBtnText}>저장</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.editClubInfoCancelBtn}
                    onPress={cancelEditClubInfo}
                  >
                    <Text style={styles.editClubInfoCancelBtnText}>취소</Text>
                  </TouchableOpacity>
                </View>

                {/* 클럽 삭제 */}
                <View style={styles.editDeleteSection}>
                  {deleteConfirmClub === club.code ? (
                    <View style={styles.editDeleteConfirm}>
                      <Text style={styles.editDeleteConfirmText}>
                        "{club.name}" 클럽의 모든 데이터가 삭제됩니다.
                      </Text>
                      <View style={styles.editDeleteConfirmBtns}>
                        <TouchableOpacity
                          style={styles.editDeleteYesBtn}
                          onPress={() => handleDeleteClub(club.code)}
                        >
                          <Text style={styles.editDeleteYesBtnText}>삭제</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.editDeleteCancelBtn}
                          onPress={() => setDeleteConfirmClub(null)}
                        >
                          <Text style={styles.editDeleteCancelBtnText}>취소</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.editDeleteBtn}
                      onPress={() => setDeleteConfirmClub(club.code)}
                    >
                      <FontAwesome name="trash-o" size={13} color={colors.error} />
                      <Text style={styles.editDeleteBtnText}>클럽 삭제</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.clubHeader}
                onPress={() => toggleExpand(club.code)}
                activeOpacity={0.7}
              >
                <View style={styles.clubHeaderLeft}>
                  <View style={styles.clubNameRow}>
                    <Text style={styles.clubName}>{club.name}</Text>
                    <TouchableOpacity
                      style={styles.editClubBtn}
                      onPress={() => startEditClubInfo(club)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <FontAwesome name="pencil" size={13} color={colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.clubCode}>{club.code}</Text>
                </View>
                <FontAwesome
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={colors.textTertiary}
                />
              </TouchableOpacity>
            )}

            {/* 등급 선택 배지 */}
            <View style={styles.tierBadgeRow}>
              {TIERS.map((tier) => {
                const isSelected = currentTier === tier;
                return (
                  <TouchableOpacity
                    key={tier}
                    style={[
                      styles.tierBadge,
                      isSelected
                        ? { backgroundColor: TIER_COLORS[tier] }
                        : { borderColor: TIER_COLORS[tier], borderWidth: 1 },
                    ]}
                    onPress={() => handleTierChange(club.code, tier)}
                  >
                    <Text
                      style={[
                        styles.tierBadgeText,
                        isSelected ? { color: colors.white } : { color: TIER_COLORS[tier] },
                      ]}
                    >
                      {tier}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 요약 정보 (항상 표시) */}
            <View style={styles.clubSummaryRow}>
              <Text style={styles.clubSummaryText}>
                회원: {club.playerCount}명
              </Text>
              <Text style={styles.clubSummaryDot}> | </Text>
              <Text style={styles.clubSummaryText}>
                세션: {club.sessionCount}회
              </Text>
            </View>
            <Text style={styles.clubMeta}>
              마지막 경기: {club.lastSessionDate || '-'}
            </Text>
            <Text style={styles.clubMeta}>
              관리자: {club.adminEmails.join(', ')}
            </Text>

            {/* 펼친 상세 영역 */}
            {isExpanded && (
              <View style={styles.expandedSection}>
                {/* 기능 제한 오버라이드 */}
                <Text style={styles.sectionTitle}>기능 제한 오버라이드 (등급 외 추가 제한)</Text>
                {FLAG_CATEGORIES.map((cat) => (
                  <View key={cat.label}>
                    <Text style={styles.overrideCategoryLabel}>{cat.label}</Text>
                    {cat.keys.map((key) => (
                      <View key={key} style={styles.settingRow}>
                        <Text style={styles.settingLabel}>{flagLabels[key]} 비활성화</Text>
                        <Switch
                          value={flags[key]}
                          onValueChange={() => handleToggleFlag(club.code, key)}
                          trackColor={{ false: colors.textTertiary, true: colors.error }}
                          thumbColor={flags[key] ? colors.error : colors.bg}
                        />
                      </View>
                    ))}
                  </View>
                ))}

                {/* 클럽 설정 오버라이드 */}
                <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
                  클럽 설정 오버라이드
                </Text>
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>기본 코트 수</Text>
                  <View style={styles.numberInput}>
                    <TouchableOpacity
                      style={styles.numberBtn}
                      onPress={() =>
                        handleSettingChange(
                          club.code,
                          'defaultCourtCount',
                          Math.max(1, settings.defaultCourtCount - 1)
                        )
                      }
                    >
                      <FontAwesome name="minus" size={12} color={colors.textTertiary} />
                    </TouchableOpacity>
                    <Text style={styles.numberValue}>{settings.defaultCourtCount}</Text>
                    <TouchableOpacity
                      style={styles.numberBtn}
                      onPress={() =>
                        handleSettingChange(
                          club.code,
                          'defaultCourtCount',
                          Math.min(10, settings.defaultCourtCount + 1)
                        )
                      }
                    >
                      <FontAwesome name="plus" size={12} color={colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>기본 인당 경기 수</Text>
                  <View style={styles.numberInput}>
                    <TouchableOpacity
                      style={styles.numberBtn}
                      onPress={() =>
                        handleSettingChange(
                          club.code,
                          'defaultMaxGames',
                          Math.max(1, settings.defaultMaxGames - 1)
                        )
                      }
                    >
                      <FontAwesome name="minus" size={12} color={colors.textTertiary} />
                    </TouchableOpacity>
                    <Text style={styles.numberValue}>{settings.defaultMaxGames}</Text>
                    <TouchableOpacity
                      style={styles.numberBtn}
                      onPress={() =>
                        handleSettingChange(
                          club.code,
                          'defaultMaxGames',
                          Math.min(20, settings.defaultMaxGames + 1)
                        )
                      }
                    >
                      <FontAwesome name="plus" size={12} color={colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>NTRP 밸런스</Text>
                  <Switch
                    value={settings.useNtrpBalance}
                    onValueChange={(v) =>
                      handleSettingChange(club.code, 'useNtrpBalance', v)
                    }
                    trackColor={{ false: colors.textTertiary, true: colors.primaryLight }}
                    thumbColor={settings.useNtrpBalance ? colors.primary : colors.bg}
                  />
                </View>

                {/* 관리자 이메일 관리 */}
                <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
                  관리자 이메일 관리
                </Text>
                {club.adminEmails.map((email) => (
                  <View key={email} style={styles.adminEmailRow}>
                    <Text style={styles.adminEmail}>{email}</Text>
                    <TouchableOpacity
                      style={styles.removeAdminBtn}
                      onPress={() => handleRemoveAdmin(club.code, email)}
                    >
                      <FontAwesome name="times" size={12} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                ))}
                <View style={styles.addAdminRow}>
                  <TextInput
                    style={styles.addAdminInput}
                    placeholder="새 관리자 이메일"
                    value={addAdminInput[club.code] || ''}
                    onChangeText={(text) =>
                      setAddAdminInput((prev) => ({ ...prev, [club.code]: text }))
                    }
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.addAdminBtn}
                    onPress={() => handleAddAdmin(club.code)}
                  >
                    <Text style={styles.addAdminBtnText}>추가</Text>
                  </TouchableOpacity>
                </View>

                {/* 저장 버튼 */}
                <TouchableOpacity
                  style={[styles.saveBtn, saving === club.code && styles.saveBtnDisabled]}
                  onPress={() => handleSaveClub(club.code)}
                  disabled={saving === club.code}
                >
                  <FontAwesome name="save" size={16} color={colors.white} />
                  <Text style={styles.saveBtnText}>
                    {saving === club.code ? '저장 중...' : '설정 저장'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </Card>
        );
      })}

      {/* 슈퍼어드민 관리 */}
      <Card title="슈퍼어드민 관리">
        {superAdminEmails.map((email) => (
          <View key={email} style={styles.adminEmailRow}>
            <Text style={styles.adminEmail}>{email}</Text>
            <TouchableOpacity
              style={styles.removeAdminBtn}
              onPress={() => handleRemoveSuperAdmin(email)}
            >
              <FontAwesome name="times" size={12} color={colors.error} />
            </TouchableOpacity>
          </View>
        ))}
        <View style={styles.addAdminRow}>
          <TextInput
            style={styles.addAdminInput}
            placeholder="새 슈퍼어드민 이메일"
            value={newSuperAdminInput}
            onChangeText={setNewSuperAdminInput}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={styles.addAdminBtn}
            onPress={handleAddSuperAdmin}
          >
            <Text style={styles.addAdminBtnText}>추가</Text>
          </TouchableOpacity>
        </View>
      </Card>

      {/* 새 클럽 추가 */}
      <Card title="새 클럽 추가">
        <View style={styles.formField}>
          <Text style={styles.formLabel}>클럽 코드</Text>
          <TextInput
            style={styles.formInput}
            placeholder="예: NEWCLUB"
            value={newClubCode}
            onChangeText={(t) => {
              setNewClubCode(t.toUpperCase());
              setNewClubError('');
            }}
            autoCapitalize="characters"
          />
        </View>
        <View style={styles.formField}>
          <Text style={styles.formLabel}>클럽 이름</Text>
          <TextInput
            style={styles.formInput}
            placeholder="예: 새테니스클럽"
            value={newClubName}
            onChangeText={(t) => {
              setNewClubName(t);
              setNewClubError('');
            }}
          />
        </View>
        <View style={styles.formField}>
          <Text style={styles.formLabel}>관리자 이메일</Text>
          <TextInput
            style={styles.formInput}
            placeholder="admin@example.com"
            value={newClubAdmin}
            onChangeText={(t) => {
              setNewClubAdmin(t);
              setNewClubError('');
            }}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>
        {newClubError ? (
          <Text style={styles.errorText}>{newClubError}</Text>
        ) : null}
        <TouchableOpacity style={styles.createClubBtn} onPress={handleAddClub}>
          <FontAwesome name="plus-circle" size={18} color={colors.accent} />
          <Text style={styles.createClubBtnText}>클럽 생성</Text>
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
  noAccess: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  noAccessText: {
    marginTop: spacing.md,
    fontSize: 16,
    color: colors.textTertiary,
  },
  // 개요
  overviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.sm,
  },
  overviewItem: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  overviewValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  overviewLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  // 등급별 메뉴 설정
  tierConfigHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tierConfigTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  tierConfigBody: {
    marginTop: spacing.md,
  },
  tierMatrixHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  tierCategoryHeader: {
    backgroundColor: colors.bg,
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginTop: 4,
    borderRadius: 4,
  },
  tierCategoryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  overrideCategoryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 10,
    marginBottom: 4,
  },
  tierMatrixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  tierMatrixLabel: {
    fontSize: 13,
    color: colors.text,
    flex: 2,
  },
  tierMatrixTierLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  tierMatrixCell: {
    flex: 1,
    alignItems: 'center',
  },
  tierLegend: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
  },
  tierLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tierLegendText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  // 클럽 카드
  clubHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
  },
  clubHeaderLeft: {
    flex: 1,
  },
  clubNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clubName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  editClubBtn: {
    padding: 2,
  },
  clubCode: {
    fontSize: 13,
    color: colors.textTertiary,
    marginTop: 2,
  },
  // 등급 배지
  tierBadgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
    marginBottom: 4,
  },
  tierBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  tierBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  // 클럽 정보 편집
  editClubInfoSection: {
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.sm,
  },
  editClubInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  editClubInfoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    width: 60,
  },
  editClubInfoInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    backgroundColor: colors.card,
  },
  editClubInfoBtns: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  editClubInfoSaveBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  editClubInfoSaveBtnText: {
    color: colors.black,
    fontSize: 14,
    fontWeight: '600',
  },
  editClubInfoCancelBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  editClubInfoCancelBtnText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  editAdminRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 3,
  },
  editAdminEmail: {
    fontSize: 13,
    color: colors.text,
    flex: 1,
  },
  editAdminAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  editAdminInput: {
    flex: 1,
    height: 32,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    fontSize: 13,
    color: colors.text,
    backgroundColor: colors.card,
  },
  editAdminAddBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  editAdminAddBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
  },
  editDeleteSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  editDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editDeleteBtnText: {
    fontSize: 13,
    color: colors.error,
    fontWeight: '500',
  },
  editDeleteConfirm: {
    backgroundColor: colors.errorBg,
    borderRadius: radius.sm,
    padding: 10,
  },
  editDeleteConfirmText: {
    fontSize: 13,
    color: colors.error,
    marginBottom: 8,
  },
  editDeleteConfirmBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  editDeleteYesBtn: {
    backgroundColor: colors.error,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: radius.sm,
  },
  editDeleteYesBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.white,
  },
  editDeleteCancelBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: radius.sm,
  },
  editDeleteCancelBtnText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  clubSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  clubSummaryText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  clubSummaryDot: {
    color: colors.border,
  },
  clubMeta: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  // 확장 영역
  expandedSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  settingLabel: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  numberInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
  },
  numberBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    minWidth: 28,
    textAlign: 'center',
  },
  // 관리자 이메일
  adminEmailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  adminEmail: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
  },
  removeAdminBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.errorBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addAdminRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  addAdminInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
  },
  addAdminBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  addAdminBtnText: {
    color: colors.black,
    fontSize: 14,
    fontWeight: '600',
  },
  // 저장 버튼
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 10,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  saveBtnDisabled: {
    backgroundColor: colors.primaryLight,
  },
  saveBtnText: {
    color: colors.black,
    fontSize: 15,
    fontWeight: '600',
  },
  // 새 클럽 추가 폼
  formField: {
    marginBottom: 12,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 6,
  },
  formInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: colors.card,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  createClubBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.navy,
    paddingVertical: spacing.md,
    borderRadius: 10,
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  createClubBtnText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  // 뷰 토글
  viewToggleBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.xs,
    marginBottom: spacing.md,
    gap: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  viewToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radius.sm,
    gap: 6,
  },
  viewToggleBtnActive: {
    backgroundColor: colors.primary,
  },
  viewToggleBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  viewToggleBtnTextActive: {
    color: colors.black,
  },
});
