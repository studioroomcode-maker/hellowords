import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  TextInput,
  Dimensions,
  Platform,
} from 'react-native';
import Svg, { G, Path, Circle, Text as SvgText } from 'react-native-svg';
import { FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useClubStore } from '../../stores/clubStore';
import { usePlayerStore } from '../../stores/playerStore';
import { Card, Button, Input, Select, Checkbox, Footer, SegmentedTabs } from '../../components/ui';
import { Player } from '../../types';
import { createDisplayNameFn } from '../../utils/displayName';
import { colors, spacing, radius, typography, MAX_WIDTH } from '../../theme/tokens';
import {
  AGE_GROUPS,
  RACKET_BRANDS,
  NTRP_LEVELS,
  MBTI_TYPES,
} from '../../utils/constants';

// 파이 차트 컴포넌트
interface PieChartData {
  label: string;
  value: number;
  color: string;
}

const PieChart = ({
  data,
  size = 160,
  showLabels = true,
  title
}: {
  data: PieChartData[];
  size?: number;
  showLabels?: boolean;
  title?: string;
}) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return null;

  const radius = size / 2 - 10;
  const centerX = size / 2;
  const centerY = size / 2;

  // SVG arc path 계산
  const createArcPath = (startAngle: number, endAngle: number, r: number) => {
    const startRad = (startAngle - 90) * Math.PI / 180;
    const endRad = (endAngle - 90) * Math.PI / 180;

    const x1 = centerX + r * Math.cos(startRad);
    const y1 = centerY + r * Math.sin(startRad);
    const x2 = centerX + r * Math.cos(endRad);
    const y2 = centerY + r * Math.sin(endRad);

    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

    return `M ${centerX} ${centerY} L ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
  };

  let currentAngle = 0;
  const slices = data.filter(d => d.value > 0).map((item) => {
    const sliceAngle = (item.value / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    currentAngle = endAngle;

    // 라벨 위치 계산 (슬라이스 중간)
    const midAngle = (startAngle + endAngle) / 2;
    const midRad = (midAngle - 90) * Math.PI / 180;
    const labelRadius = radius * 0.65;
    const labelX = centerX + labelRadius * Math.cos(midRad);
    const labelY = centerY + labelRadius * Math.sin(midRad);

    return {
      ...item,
      path: createArcPath(startAngle, Math.min(endAngle, startAngle + 359.99), radius),
      percentage: ((item.value / total) * 100).toFixed(0),
      labelX,
      labelY,
    };
  });

  return (
    <View style={pieStyles.container}>
      {title && <Text style={pieStyles.title}>{title}</Text>}
      <View style={pieStyles.chartRow}>
        <Svg width={size} height={size}>
          <G>
            {slices.map((slice, index) => (
              <Path
                key={index}
                d={slice.path}
                fill={slice.color}
                stroke={colors.card}
                strokeWidth={2}
              />
            ))}
            {/* 가운데 원 (도넛 형태) */}
            <Circle cx={centerX} cy={centerY} r={radius * 0.4} fill={colors.card} />
            {/* 중앙 텍스트 */}
            <SvgText
              x={centerX}
              y={centerY - 4}
              fontSize="10"
              fontWeight="600"
              fill={colors.textSecondary}
              textAnchor="middle"
            >
              총
            </SvgText>
            <SvgText
              x={centerX}
              y={centerY + 10}
              fontSize="13"
              fontWeight="700"
              fill={colors.text}
              textAnchor="middle"
            >
              {total}명
            </SvgText>
          </G>
        </Svg>
        {showLabels && (
          <View style={pieStyles.legend}>
            {slices.map((slice, index) => (
              <View key={index} style={pieStyles.legendItem}>
                <View style={[pieStyles.legendColor, { backgroundColor: slice.color }]} />
                <Text style={pieStyles.legendLabel}>{slice.label}</Text>
                <Text style={pieStyles.legendValue}>{slice.value}명</Text>
                <Text style={pieStyles.legendPercent}>({slice.percentage}%)</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
};

const pieStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.lg,
    alignSelf: 'flex-start',
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legend: {
    marginLeft: spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 3,
    marginRight: 8,
  },
  legendLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    width: 50,
  },
  legendValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    width: 36,
    textAlign: 'right',
  },
  legendPercent: {
    fontSize: 12,
    color: colors.textTertiary,
    marginLeft: spacing.xs,
    width: 40,
  },
});

export default function PlayersScreen() {
  const { clubCode, isAdmin, club } = useClubStore();
  const hasPermission = useClubStore(s => s.hasPermission);
  const isFeatureDisabled = useClubStore(s => s.isFeatureDisabled);
  const canEditPlayers = isAdmin && hasPermission('canEditPlayers');
  const { players, addPlayer, updatePlayer, deletePlayer, isLoading } = usePlayerStore();
  // 클럽 설정에서 동적 그룹 목록 가져오기
  const clubSettings = club?.settings;

  // 섹션 제한
  const sr = clubSettings?.sectionRestrictions || {};
  const isSectionRestricted = (key: string) => !isAdmin && sr[key];
  const dynamicGroups = useMemo(() => {
    const groups = clubSettings?.groups || ['A조', 'B조'];
    return [...groups, '미배정'];
  }, [clubSettings?.groups]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupTab, setGroupTab] = useState<string>('all');
  const [showCharts, setShowCharts] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    nickname: '',
    gender: '남' as '남' | '여',
    hand: '오른손' as '오른손' | '왼손',
    ageGroup: '40대',
    racket: '모름',
    group: '미배정',
    ntrp: null as number | null,
    adminNtrp: null as number | null,
    phone: '',
    mbti: '모름',
  });

  // Options for selects
  const genderOptions = [
    { label: '남자', value: '남' },
    { label: '여자', value: '여' },
  ];

  const handOptions = [
    { label: '오른손', value: '오른손' },
    { label: '왼손', value: '왼손' },
  ];

  const ageGroupOptions = AGE_GROUPS.map((g) => ({ label: g, value: g }));
  const racketOptions = RACKET_BRANDS.map((r) => ({ label: r, value: r }));
  const groupOptions = dynamicGroups.map((g) => ({ label: g, value: g }));
  const ntrpOptions = NTRP_LEVELS.map((n) => ({
    label: n.label,
    value: n.value,
  }));
  const mbtiOptions = MBTI_TYPES.map((m) => ({ label: m, value: m }));

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      nickname: '',
      gender: '남',
      hand: '오른손',
      ageGroup: '40대',
      racket: '모름',
      group: '미배정',
      ntrp: null,
      adminNtrp: null,
      phone: '',
      mbti: '모름',
    });
    setEditingPlayer(null);
  };

  // Open modal for add
  const handleAdd = () => {
    resetForm();
    setIsModalOpen(true);
  };

  // Open modal for edit (admin only)
  const handleEdit = (player: Player) => {
    setEditingPlayer(player);
    setFormData({
      name: player.name,
      nickname: player.nickname || '',
      gender: player.gender,
      hand: player.hand,
      ageGroup: player.ageGroup,
      racket: player.racket,
      group: player.group,
      ntrp: player.ntrp,
      adminNtrp: player.adminNtrp ?? player.ntrp,
      phone: player.phone || '',
      mbti: player.mbti || '모름',
    });
    setIsModalOpen(true);
  };

  // 선수 행 클릭 처리
  const handlePlayerPress = (player: Player) => {
    if (canEditPlayers) {
      // 관리자: 수정 모달
      handleEdit(player);
    } else {
      // 일반 회원: 개인 성적 페이지로 이동
      router.push({ pathname: '/(tabs)/records', params: { player: player.name } });
    }
  };

  // Save player
  const handleSave = async () => {
    if (!clubCode) return;

    if (!formData.name.trim()) {
      Alert.alert('오류', '이름을 입력해주세요.');
      return;
    }

    // Check for duplicate name (only for new players)
    if (!editingPlayer && players.some((p) => p.name === formData.name.trim())) {
      Alert.alert('오류', '이미 등록된 선수입니다.');
      return;
    }

    const playerData = {
      name: formData.name.trim(),
      nickname: formData.nickname.trim() || undefined,
      gender: formData.gender,
      hand: formData.hand,
      ageGroup: formData.ageGroup,
      racket: formData.racket,
      group: formData.group,
      ntrp: formData.ntrp,
      adminNtrp: formData.adminNtrp,
      phone: formData.phone.trim() || undefined,
      mbti: formData.mbti === '모름' ? null : formData.mbti,
    };

    let success: boolean;

    if (editingPlayer?.id) {
      success = await updatePlayer(clubCode, editingPlayer.id, playerData);
    } else {
      const id = await addPlayer(clubCode, playerData);
      success = !!id;
    }

    if (success) {
      setIsModalOpen(false);
      resetForm();
      Alert.alert('완료', editingPlayer ? '선수 정보가 수정되었습니다.' : '선수가 추가되었습니다.');
    } else {
      Alert.alert('오류', '저장에 실패했습니다.');
    }
  };

  // Delete player
  const handleDelete = async (player: Player) => {
    if (!clubCode || !player.id) return;

    const confirmed = Platform.OS === 'web'
      ? window.confirm(`${player.name} 선수를 삭제하시겠습니까?`)
      : await new Promise<boolean>((resolve) =>
          Alert.alert('선수 삭제', `${player.name} 선수를 삭제하시겠습니까?`, [
            { text: '취소', style: 'cancel', onPress: () => resolve(false) },
            { text: '삭제', style: 'destructive', onPress: () => resolve(true) },
          ])
        );

    if (!confirmed) return;

    const success = await deletePlayer(clubCode, player.id!);
    if (Platform.OS === 'web') {
      alert(success ? '선수가 삭제되었습니다.' : '삭제에 실패했습니다.');
    } else {
      Alert.alert(success ? '완료' : '오류', success ? '선수가 삭제되었습니다.' : '삭제에 실패했습니다.');
    }
  };

  // Display name helper
  const displayNameMode = clubSettings?.displayNameMode;
  const dn = useMemo(() => createDisplayNameFn(players, displayNameMode), [players, displayNameMode]);

  // Filter players by search and group
  const filteredPlayers = players.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = p.name.toLowerCase().includes(q) || (p.nickname || '').toLowerCase().includes(q);
    // 조별 구분 사용하지 않으면 그룹 필터 무시
    const matchesGroup = clubSettings?.useGroups === false || groupTab === 'all' || p.group === groupTab;
    return matchesSearch && matchesGroup;
  });

  // Stats
  const maleCount = players.filter((p) => p.gender === '남').length;
  const femaleCount = players.filter((p) => p.gender === '여').length;
  const groupACount = players.filter((p) => p.group === 'A조').length;
  const groupBCount = players.filter((p) => p.group === 'B조').length;

  // Pie chart colors
  const PIE_COLORS = {
    gender: [colors.primaryLight, '#ec4899'],
    age: [colors.warning, colors.success, colors.primaryLight, '#8b5cf6', '#ec4899', colors.error, '#06b6d4'],
    hand: [colors.primaryLight, colors.error],
    group: [colors.success, colors.warning, colors.textTertiary],
    ntrp: ['#06b6d4', colors.primaryLight, '#8b5cf6', '#ec4899', colors.error, colors.warning],
    racket: [colors.error, colors.primaryLight, colors.success, colors.warning, '#8b5cf6', '#ec4899', '#06b6d4'],
  };

  // Distribution calculations for pie charts
  const genderPieData: PieChartData[] = [
    { label: '남자', value: maleCount, color: PIE_COLORS.gender[0] },
    { label: '여자', value: femaleCount, color: PIE_COLORS.gender[1] },
  ].filter(d => d.value > 0);

  const agePieData: PieChartData[] = AGE_GROUPS.map((age, idx) => ({
    label: age,
    value: players.filter(p => p.ageGroup === age).length,
    color: PIE_COLORS.age[idx % PIE_COLORS.age.length],
  })).filter(d => d.value > 0);

  const handPieData: PieChartData[] = [
    { label: '오른손', value: players.filter(p => p.hand === '오른손').length, color: PIE_COLORS.hand[0] },
    { label: '왼손', value: players.filter(p => p.hand === '왼손').length, color: PIE_COLORS.hand[1] },
  ].filter(d => d.value > 0);

  const groupPieData: PieChartData[] = [
    { label: 'A조', value: groupACount, color: PIE_COLORS.group[0] },
    { label: 'B조', value: groupBCount, color: PIE_COLORS.group[1] },
    { label: '미배정', value: players.filter(p => p.group === '미배정').length, color: PIE_COLORS.group[2] },
  ].filter(d => d.value > 0);

  const ntrpPieData: PieChartData[] = NTRP_LEVELS
    .filter(n => n.value !== null)
    .map((n, idx) => ({
      label: n.label,
      value: players.filter(p => p.ntrp === n.value).length,
      color: PIE_COLORS.ntrp[idx % PIE_COLORS.ntrp.length],
    }))
    .filter(d => d.value > 0);

  const racketPieData: PieChartData[] = RACKET_BRANDS
    .filter(r => r !== '모름')
    .map((r, idx) => ({
      label: r,
      value: players.filter(p => p.racket === r).length,
      color: PIE_COLORS.racket[idx % PIE_COLORS.racket.length],
    }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // 구독 등급 제한
  if (isFeatureDisabled('disablePlayers')) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <FontAwesome name="lock" size={48} color={colors.textTertiary} />
        <Text style={{ marginTop: 16, fontSize: 16, color: colors.textTertiary, fontWeight: '600' }}>이 기능은 현재 사용할 수 없습니다</Text>
        <Text style={{ marginTop: 8, fontSize: 14, color: colors.textTertiary }}>클럽 등급을 업그레이드하면 이용할 수 있습니다</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Stats Summary */}
      <View style={styles.statsBarContainer}>
        <TouchableOpacity
          style={styles.statsBar}
          onPress={() => setShowCharts(true)}
          activeOpacity={0.7}
        >
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{players.length}</Text>
            <Text style={styles.statLabel}>전체</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{maleCount}</Text>
            <Text style={styles.statLabel}>남</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{femaleCount}</Text>
            <Text style={styles.statLabel}>여</Text>
          </View>
          {clubSettings?.useGroups !== false && !isSectionRestricted('players.stats.groupChart') && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{groupACount}</Text>
                <Text style={styles.statLabel}>A조</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{groupBCount}</Text>
                <Text style={styles.statLabel}>B조</Text>
              </View>
            </>
          )}
          <View style={styles.chartHint}>
            <FontAwesome name="pie-chart" size={12} color={colors.textTertiary} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Charts Modal */}
      <Modal
        visible={showCharts}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCharts(false)}
      >
        <View style={styles.chartsContainer}>
          <View style={styles.chartsHeaderWrapper}>
            <View style={styles.chartsHeader}>
              <Text style={styles.chartsTitle}>선수 분포 차트</Text>
              <TouchableOpacity onPress={() => setShowCharts(false)}>
                <FontAwesome name="times" size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView style={styles.chartsContent} contentContainerStyle={styles.chartsContentContainer}>
            {/* Gender Distribution */}
            <View style={styles.chartSection}>
              <PieChart data={genderPieData} title="성별 분포" size={140} />
            </View>

            {/* Group Distribution */}
            {!isSectionRestricted('players.stats.groupChart') && (
              <View style={styles.chartSection}>
                <PieChart data={groupPieData} title="조 분포" size={140} />
              </View>
            )}

            {/* Age Distribution */}
            <View style={styles.chartSection}>
              <PieChart data={agePieData} title="연령대 분포" size={140} />
            </View>

            {/* Hand Distribution */}
            <View style={styles.chartSection}>
              <PieChart data={handPieData} title="주손 분포" size={140} />
            </View>

            {/* NTRP Distribution */}
            {ntrpPieData.length > 0 && (
              <View style={styles.chartSection}>
                <PieChart data={ntrpPieData} title="NTRP 분포" size={140} />
              </View>
            )}

            {/* Racket Distribution */}
            {racketPieData.length > 0 && (
              <View style={styles.chartSection}>
                <PieChart data={racketPieData} title="라켓 브랜드 TOP 6" size={140} />
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Group Tabs - 조별 구분 사용 시에만 표시 */}
      {clubSettings?.useGroups !== false && !isSectionRestricted('players.stats.groupChart') && (
        <View style={styles.groupTabBarContainer}>
          <View style={styles.groupTabBar}>
            <SegmentedTabs
              tabs={[
                { key: 'all', label: `전체 ${players.length}` },
                { key: 'byGroup', label: '조별구분' },
              ]}
              activeKey={groupTab}
              onTabPress={(key) => setGroupTab(key)}
            />
          </View>
        </View>
      )}

      {/* Search and Add */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchBar}>
          <View style={styles.searchInputWrapper}>
            <FontAwesome name="search" size={16} color={colors.textTertiary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="선수 검색"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          {canEditPlayers && <Button title="추가" onPress={handleAdd} size="small" />}
        </View>
      </View>

      {/* Player Table */}
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {groupTab === 'byGroup' ? (
          // 조별 구분 보기
          <>
            {dynamicGroups.map((group) => {
              const groupPlayers = players
                .filter((p) => p.group === group)
                .filter((p) => {
                  const q = searchQuery.toLowerCase();
                  return p.name.toLowerCase().includes(q) || (p.nickname || '').toLowerCase().includes(q);
                });

              if (groupPlayers.length === 0 && searchQuery) return null;

              return (
                <View key={group} style={styles.groupSection}>
                  <View style={styles.groupSectionHeader}>
                    <Text style={styles.groupSectionTitle}>{group}</Text>
                    <Text style={styles.groupSectionCount}>{groupPlayers.length}명</Text>
                  </View>
                  <View style={styles.tableContainer}>
                    {/* 테이블 헤더 */}
                    <View style={styles.tableHeader}>
                      <Text style={[styles.tableHeaderCell, styles.cellName]}>이름</Text>
                      {!isSectionRestricted('players.fields.gender') && (
                        <Text style={[styles.tableHeaderCell, styles.cellGender]}>성별</Text>
                      )}
                      {!isSectionRestricted('players.fields.age') && (
                        <Text style={[styles.tableHeaderCell, styles.cellAge]}>연령</Text>
                      )}
                      {!isSectionRestricted('players.fields.hand') && (
                        <Text style={[styles.tableHeaderCell, styles.cellHand]}>주손</Text>
                      )}
                      {!isSectionRestricted('players.fields.racket') && (
                        <Text style={[styles.tableHeaderCell, styles.cellRacket]}>라켓</Text>
                      )}
                      {!isSectionRestricted('players.fields.ntrp') && (isAdmin || !clubSettings?.hideNtrpFromMembers) && (
                        <Text style={[styles.tableHeaderCell, styles.cellNtrp]}>NTRP</Text>
                      )}
                      {isAdmin && (
                        <Text style={[styles.tableHeaderCell, styles.cellAdminNtrp]}>관리</Text>
                      )}
                      {!isSectionRestricted('players.fields.phone') && isAdmin && (
                        <Text style={[styles.tableHeaderCell, styles.cellPhone]}>전화</Text>
                      )}
                      {!isSectionRestricted('players.fields.mbti') && (
                        <Text style={[styles.tableHeaderCell, styles.cellMbti]}>MBTI</Text>
                      )}
                      {isAdmin && (
                        <Text style={[styles.tableHeaderCell, styles.cellEmail]}>이메일</Text>
                      )}
                    </View>
                    {/* 테이블 바디 */}
                    {groupPlayers.map((player, index) => (
                      <TouchableOpacity
                        key={player.id || player.name}
                        style={[
                          styles.tableRow,
                          index % 2 === 0 && styles.tableRowEven,
                        ]}
                        onPress={() => handlePlayerPress(player)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.tableCell, styles.cellName]}>
                          <Text style={styles.tableCellName}>{dn(player.name)}</Text>
                        </View>
                        {!isSectionRestricted('players.fields.gender') && (
                          <View style={[styles.tableCell, styles.cellGender]}>
                            <View style={[
                              styles.genderBadge,
                              player.gender === '남' ? styles.genderMale : styles.genderFemale
                            ]}>
                              <Text style={styles.genderBadgeText}>{player.gender}</Text>
                            </View>
                          </View>
                        )}
                        {!isSectionRestricted('players.fields.age') && (
                          <View style={[styles.tableCell, styles.cellAge]}>
                            <Text style={styles.tableCellText}>{player.ageGroup}</Text>
                          </View>
                        )}
                        {!isSectionRestricted('players.fields.hand') && (
                          <View style={[styles.tableCell, styles.cellHand]}>
                            <Text style={styles.tableCellText}>
                              {player.hand === '오른손' ? '우' : '좌'}
                            </Text>
                          </View>
                        )}
                        {!isSectionRestricted('players.fields.racket') && (
                          <View style={[styles.tableCell, styles.cellRacket]}>
                            <Text style={styles.tableCellTextSmall} numberOfLines={1}>
                              {player.racket === '모름' ? '-' : player.racket}
                            </Text>
                          </View>
                        )}
                        {!isSectionRestricted('players.fields.ntrp') && (isAdmin || !clubSettings?.hideNtrpFromMembers) && (
                          <View style={[styles.tableCell, styles.cellNtrp]}>
                            <Text style={styles.tableCellText}>
                              {player.ntrp ?? '-'}
                            </Text>
                          </View>
                        )}
                        {isAdmin && (
                          <View style={[styles.tableCell, styles.cellAdminNtrp]}>
                            <Text style={[styles.tableCellText, player.adminNtrp != null && player.ntrp != null && player.adminNtrp !== player.ntrp && { color: colors.error, fontWeight: '700' }]}>
                              {player.adminNtrp ?? '-'}
                            </Text>
                          </View>
                        )}
                        {!isSectionRestricted('players.fields.phone') && isAdmin && (
                          <View style={[styles.tableCell, styles.cellPhone]}>
                            <Text style={styles.tableCellTextSmall} numberOfLines={1}>
                              {player.phone || '-'}
                            </Text>
                          </View>
                        )}
                        {!isSectionRestricted('players.fields.mbti') && (
                          <View style={[styles.tableCell, styles.cellMbti]}>
                            <Text style={styles.tableCellTextSmall}>
                              {player.mbti === '모름' || !player.mbti ? '-' : player.mbti}
                            </Text>
                          </View>
                        )}
                        {isAdmin && (
                          <View style={[styles.tableCell, styles.cellEmail]}>
                            <Text style={styles.tableCellTextSmall} numberOfLines={1}>
                              {player.email || '-'}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                    {groupPlayers.length === 0 && (
                      <View style={styles.emptyGroupRow}>
                        <Text style={styles.emptyGroupText}>선수 없음</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </>
        ) : (
          // 전체 보기
          <View style={styles.tableContainer}>
            {/* 테이블 헤더 */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, styles.cellName]}>이름</Text>
              {!isSectionRestricted('players.fields.gender') && (
                <Text style={[styles.tableHeaderCell, styles.cellGender]}>성별</Text>
              )}
              {!isSectionRestricted('players.fields.group') && (isAdmin || !clubSettings?.hideGroupFromMembers) && clubSettings?.useGroups !== false && (
                <Text style={[styles.tableHeaderCell, styles.cellGroup]}>조</Text>
              )}
              {!isSectionRestricted('players.fields.age') && (
                <Text style={[styles.tableHeaderCell, styles.cellAge]}>연령</Text>
              )}
              {!isSectionRestricted('players.fields.hand') && (
                <Text style={[styles.tableHeaderCell, styles.cellHand]}>주손</Text>
              )}
              {!isSectionRestricted('players.fields.racket') && (
                <Text style={[styles.tableHeaderCell, styles.cellRacket]}>라켓</Text>
              )}
              {!isSectionRestricted('players.fields.ntrp') && (isAdmin || !clubSettings?.hideNtrpFromMembers) && (
                <Text style={[styles.tableHeaderCell, styles.cellNtrp]}>NTRP</Text>
              )}
              {isAdmin && (
                <Text style={[styles.tableHeaderCell, styles.cellAdminNtrp]}>관리</Text>
              )}
              {!isSectionRestricted('players.fields.phone') && isAdmin && (
                <Text style={[styles.tableHeaderCell, styles.cellPhone]}>전화</Text>
              )}
              {!isSectionRestricted('players.fields.mbti') && (
                <Text style={[styles.tableHeaderCell, styles.cellMbti]}>MBTI</Text>
              )}
              {isAdmin && (
                <Text style={[styles.tableHeaderCell, styles.cellEmail]}>이메일</Text>
              )}
            </View>

            {/* 테이블 바디 */}
            {filteredPlayers.map((player, index) => (
              <TouchableOpacity
                key={player.id || player.name}
                style={[
                  styles.tableRow,
                  index % 2 === 0 && styles.tableRowEven,
                ]}
                onPress={() => handlePlayerPress(player)}
                activeOpacity={0.7}
              >
                <View style={[styles.tableCell, styles.cellName]}>
                  <Text style={styles.tableCellName}>{dn(player.name)}</Text>
                </View>
                {!isSectionRestricted('players.fields.gender') && (
                  <View style={[styles.tableCell, styles.cellGender]}>
                    <View style={[
                      styles.genderBadge,
                      player.gender === '남' ? styles.genderMale : styles.genderFemale
                    ]}>
                      <Text style={styles.genderBadgeText}>{player.gender}</Text>
                    </View>
                  </View>
                )}
                {!isSectionRestricted('players.fields.group') && (isAdmin || !clubSettings?.hideGroupFromMembers) && clubSettings?.useGroups !== false && (
                  <View style={[styles.tableCell, styles.cellGroup]}>
                    <Text style={styles.tableCellText}>
                      {player.group === '미배정' ? '-' : player.group}
                    </Text>
                  </View>
                )}
                {!isSectionRestricted('players.fields.age') && (
                  <View style={[styles.tableCell, styles.cellAge]}>
                    <Text style={styles.tableCellText}>{player.ageGroup}</Text>
                  </View>
                )}
                {!isSectionRestricted('players.fields.hand') && (
                  <View style={[styles.tableCell, styles.cellHand]}>
                    <Text style={styles.tableCellText}>
                      {player.hand === '오른손' ? '우' : '좌'}
                    </Text>
                  </View>
                )}
                {!isSectionRestricted('players.fields.racket') && (
                  <View style={[styles.tableCell, styles.cellRacket]}>
                    <Text style={styles.tableCellTextSmall} numberOfLines={1}>
                      {player.racket === '모름' ? '-' : player.racket}
                    </Text>
                  </View>
                )}
                {!isSectionRestricted('players.fields.ntrp') && (isAdmin || !clubSettings?.hideNtrpFromMembers) && (
                  <View style={[styles.tableCell, styles.cellNtrp]}>
                    <Text style={styles.tableCellText}>
                      {player.ntrp ?? '-'}
                    </Text>
                  </View>
                )}
                {isAdmin && (
                  <View style={[styles.tableCell, styles.cellAdminNtrp]}>
                    <Text style={styles.tableCellText}>
                      {player.adminNtrp ?? '-'}
                    </Text>
                  </View>
                )}
                {!isSectionRestricted('players.fields.phone') && isAdmin && (
                  <View style={[styles.tableCell, styles.cellPhone]}>
                    <Text style={styles.tableCellTextSmall} numberOfLines={1}>
                      {player.phone || '-'}
                    </Text>
                  </View>
                )}
                {!isSectionRestricted('players.fields.mbti') && (
                  <View style={[styles.tableCell, styles.cellMbti]}>
                    <Text style={styles.tableCellTextSmall}>
                      {player.mbti === '모름' || !player.mbti ? '-' : player.mbti}
                    </Text>
                  </View>
                )}
                {isAdmin && (
                  <View style={[styles.tableCell, styles.cellEmail]}>
                    <Text style={styles.tableCellTextSmall} numberOfLines={1}>
                      {player.email || '-'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {filteredPlayers.length === 0 && groupTab !== 'byGroup' && (
          <View style={styles.emptyState}>
            <FontAwesome name="users" size={40} color={colors.textTertiary} />
            <Text style={styles.emptyText}>
              {searchQuery ? '검색 결과가 없습니다' : '등록된 선수가 없습니다'}
            </Text>
          </View>
        )}

        <Footer />
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal
        visible={isModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalInner}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setIsModalOpen(false)}>
              <Text style={styles.modalCancel}>취소</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingPlayer ? '선수 수정' : '선수 추가'}
            </Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={styles.modalSave}>저장</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Input
              label="이름"
              value={formData.name}
              onChangeText={(v) => setFormData({ ...formData, name: v })}
              placeholder="선수 이름"
              editable={!editingPlayer}
            />

            <Input
              label="별명"
              value={formData.nickname}
              onChangeText={(v) => setFormData({ ...formData, nickname: v })}
              placeholder="별명 (선택)"
            />

            {editingPlayer?.email && (
              <View style={{ marginBottom: 12 }}>
                <Text style={styles.phoneLabel}>연동 이메일</Text>
                <Text style={[styles.phoneLabelSub, { color: colors.textSecondary }]}>
                  {editingPlayer.email}
                </Text>
              </View>
            )}

            <View style={styles.formRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Select
                  label="성별"
                  value={formData.gender}
                  options={genderOptions}
                  onChange={(v) => setFormData({ ...formData, gender: v as '남' | '여' })}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Select
                  label="주손"
                  value={formData.hand}
                  options={handOptions}
                  onChange={(v) => setFormData({ ...formData, hand: v as '오른손' | '왼손' })}
                />
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={{ flex: clubSettings?.useGroups !== false ? 1 : undefined, marginRight: clubSettings?.useGroups !== false ? 8 : 0, width: clubSettings?.useGroups !== false ? undefined : '100%' }}>
                <Select
                  label="연령대"
                  value={formData.ageGroup}
                  options={ageGroupOptions}
                  onChange={(v) => setFormData({ ...formData, ageGroup: v as string })}
                />
              </View>
              {/* 그룹 선택 - 조별 구분 사용 시 + 관리자만 변경 가능 */}
              {clubSettings?.useGroups !== false && isAdmin && (
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Select
                    label="그룹"
                    value={formData.group}
                    options={groupOptions}
                    onChange={(v) => setFormData({ ...formData, group: v as string })}
                  />
                </View>
              )}
            </View>

            <Select
              label="라켓"
              value={formData.racket}
              options={racketOptions}
              onChange={(v) => setFormData({ ...formData, racket: v as string })}
            />

            {/* NTRP - 관리자이거나 숨기기 설정이 꺼져있을 때만 */}
            {(isAdmin || !clubSettings?.hideNtrpFromMembers) && (
              <Select
                label="NTRP"
                value={formData.ntrp}
                options={ntrpOptions}
                onChange={(v) => setFormData({ ...formData, ntrp: v as number | null })}
              />
            )}

            {/* 관리NTRP - 관리자만 */}
            {isAdmin && (
              <Select
                label="관리NTRP"
                value={formData.adminNtrp}
                options={ntrpOptions}
                onChange={(v) => setFormData({ ...formData, adminNtrp: v as number | null })}
              />
            )}

            {isAdmin && (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.phoneLabel}>전화번호</Text>
                <TextInput
                  style={styles.phoneInput}
                  value={formData.phone}
                  onChangeText={(v) => setFormData({ ...formData, phone: v })}
                  placeholder="010-0000-0000"
                  keyboardType="phone-pad"
                />
              </View>
            )}

            <Select
              label="MBTI"
              value={formData.mbti}
              options={mbtiOptions}
              onChange={(v) => setFormData({ ...formData, mbti: v as string })}
            />

            {editingPlayer && canEditPlayers && (
              <Button
                title="선수 삭제"
                onPress={async () => {
                  const player = editingPlayer;
                  if (!clubCode || !player.id) return;

                  const confirmed = Platform.OS === 'web'
                    ? window.confirm(`${player.name} 선수를 삭제하시겠습니까?`)
                    : await new Promise<boolean>((resolve) =>
                        Alert.alert('선수 삭제', `${player.name} 선수를 삭제하시겠습니까?`, [
                          { text: '취소', style: 'cancel', onPress: () => resolve(false) },
                          { text: '삭제', style: 'destructive', onPress: () => resolve(true) },
                        ])
                      );

                  if (!confirmed) return;

                  const success = await deletePlayer(clubCode, player.id!);
                  setIsModalOpen(false);
                  resetForm();
                  if (Platform.OS === 'web') {
                    alert(success ? '선수가 삭제되었습니다.' : '삭제에 실패했습니다.');
                  } else {
                    Alert.alert(success ? '완료' : '오류', success ? '선수가 삭제되었습니다.' : '삭제에 실패했습니다.');
                  }
                }}
                variant="danger"
                fullWidth
                style={{ marginTop: 24 }}
              />
            )}
          </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  statsBarContainer: {
    backgroundColor: colors.navy,
    borderBottomWidth: 0,
  },
  statsBar: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: spacing.xs,
  },
  searchBarContainer: {
    backgroundColor: colors.card,
    borderBottomWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    maxWidth: MAX_WIDTH,
    width: '100%',
    alignSelf: 'center',
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    marginRight: spacing.md,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: spacing.sm,
    maxWidth: 500,
    alignSelf: 'center',
    width: '100%',
  },
  // 테이블 스타일
  tableContainer: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.navy,
    borderBottomWidth: 0,
    paddingVertical: 10,
    paddingHorizontal: spacing.xs,
  },
  tableHeaderCell: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
  },
  tableRowEven: {
    backgroundColor: colors.bg,
  },
  tableCell: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableCellText: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  tableCellName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  // 컬럼 너비 (모바일 최적화)
  cellName: {
    width: 56,
    alignItems: 'center',
  },
  cellGender: {
    width: 32,
  },
  cellGroup: {
    width: 36,
  },
  cellAge: {
    width: 40,
  },
  cellHand: {
    width: 24,
  },
  cellNtrp: {
    width: 32,
  },
  cellAdminNtrp: {
    width: 32,
  },
  cellPhone: {
    width: 72,
  },
  cellRacket: {
    width: 44,
  },
  cellMbti: {
    width: 36,
  },
  cellEmail: {
    width: 100,
  },
  tableCellTextSmall: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  // 전화번호 입력
  phoneLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 6,
  },
  phoneLabelSub: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  phoneInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.text,
  },
  // 성별 뱃지
  genderBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  genderMale: {
    backgroundColor: colors.male.bg,
  },
  genderFemale: {
    backgroundColor: colors.female.bg,
  },
  genderBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  // 조별 구분 섹션
  groupSection: {
    marginBottom: 20,
  },
  groupSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  groupSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  groupSectionCount: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  emptyGroupRow: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  emptyGroupText: {
    fontSize: 13,
    color: colors.textTertiary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['5xl'],
  },
  emptyText: {
    fontSize: 14,
    color: colors.textTertiary,
    marginTop: spacing.md,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
  },
  modalInner: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_WIDTH,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    backgroundColor: colors.navy,
    borderBottomWidth: 0,
  },
  modalCancel: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.white,
  },
  modalSave: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.accent,
  },
  modalContent: {
    flex: 1,
    padding: spacing.lg,
  },
  formRow: {
    flexDirection: 'row',
  },
  // Group tab styles
  groupTabBarContainer: {
    backgroundColor: colors.navy,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 0,
  },
  groupTabBar: {
    maxWidth: MAX_WIDTH,
    width: '100%',
    alignSelf: 'center',
  },
  // Chart hint
  chartHint: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -6,
  },
  // Charts modal styles
  chartsContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
  },
  chartsHeaderWrapper: {
    width: '100%',
    backgroundColor: colors.navy,
    borderBottomWidth: 0,
    alignItems: 'center',
  },
  chartsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    width: '100%',
    maxWidth: MAX_WIDTH,
  },
  chartsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.white,
  },
  chartsContent: {
    flex: 1,
    padding: spacing.lg,
    width: '100%',
    maxWidth: MAX_WIDTH,
  },
  chartsContentContainer: {
    paddingBottom: spacing['3xl'],
    maxWidth: 500,
    alignSelf: 'center',
    width: '100%',
  },
  chartSection: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  chartLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  barChart: {
    gap: 8,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  barLabel: {
    width: 50,
    fontSize: 13,
    color: colors.textSecondary,
  },
  barTrack: {
    flex: 1,
    height: 20,
    backgroundColor: colors.bg,
    borderRadius: 4,
    marginHorizontal: spacing.sm,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  barMale: {
    backgroundColor: colors.primaryLight,
  },
  barFemale: {
    backgroundColor: '#ec4899',
  },
  barAge: {
    backgroundColor: '#8b5cf6',
  },
  barNtrp: {
    backgroundColor: colors.success,
  },
  barRacket: {
    backgroundColor: colors.warning,
  },
  barValue: {
    width: 40,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  pieContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  pieItem: {
    alignItems: 'center',
  },
  pieColor: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 8,
  },
  pieLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  pieValue: {
    fontSize: 12,
    color: colors.textTertiary,
  },
});
