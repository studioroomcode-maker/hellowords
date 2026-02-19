import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { format, addDays, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, parseISO, addMonths, subMonths } from 'date-fns';
import { ko } from 'date-fns/locale';
import { router, useLocalSearchParams } from 'expo-router';

function useSafeSearchParams() {
  try {
    return useLocalSearchParams<{ tab?: string }>();
  } catch {
    return {} as { tab?: string };
  }
}
import { useClubStore } from '../../stores/clubStore';
import { usePlayerStore } from '../../stores/playerStore';
import { useMatchStore } from '../../stores/matchStore';
import { Card, Button, Checkbox, Select, SegmentedTabs, ProgressBar, Footer } from '../../components/ui';
import { colors, spacing, radius, typography, MAX_WIDTH } from '../../theme/tokens';
import { buildSchedule, buildHanulAASchedule, applyHanulAASeedOrder, buildManualSchedule, autoFillSlots, buildTeamSchedule, createEmptySlots } from '../../utils/matchmaking';
import { DOUBLES_MODES, SINGLES_MODES, SIDE_POSITIONS, TEAM_COLORS, TEAM_NAMES, GENDER_OPTIONS, SAME_GENDER_SUB, GAME_TYPES } from '../../utils/constants';
import { Match, MatchResult, DoublesMode, SinglesMode, SidePosition, Session, ClubSettings, ManualSlot, Player } from '../../types';
import { getSessionDates, getSessionsForMonth, getSession } from '../../services/sessions';
import { calculateMatchProbability, getHeadToHead } from '../../utils/stats';
import { analyzeResultDay } from '../../utils/matchAnalysis';
import { calculateDailyStats, findMVP } from '../../utils/scoring';
import { generateResultAnalysisAI } from '../../services/gemini';
import { createDisplayNameFn } from '../../utils/displayName';
import { getLocalReservations, saveLocalReservations, getMemberNames } from '../../services/localData';
import { syncManager } from '../../services/syncManager';
import { useAuthStore } from '../../stores/authStore';
import { CustomEntry, AnniversaryInfo, TargetGender } from '../../types';
import * as Clipboard from 'expo-clipboard';
import * as Notifications from 'expo-notifications';
import { toJpeg } from 'html-to-image';

type TabType = 'schedule' | 'score';

// 알림 핸들러 설정
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// 대진 방식과 설정 키 매핑
const MODE_TO_SETTING_KEY: Record<string, keyof ClubSettings['showMatchOptions']> = {
  '한울 AA': 'hanulAA',
  '혼합복식': 'mixedDoubles',
  '동성복식': 'sameGenderDoubles',
  '랜덤복식': 'randomDoubles',
  '수동 대진': 'manualMatch',
};

const RES_HOURS = Array.from({length: 25}, (_, i) => String(i).padStart(2, '0'));
const RES_NTRP = ['1.0','1.5','2.0','2.5','3.0','3.5','4.0','4.5','5.0','5.5','6.0','6.5','7.0'];

export default function MatchScreen() {
  const { tab } = useSafeSearchParams();
  const { clubCode, club, isAdmin } = useClubStore();
  const hasPermission = useClubStore(s => s.hasPermission);
  const isFeatureDisabled = useClubStore(s => s.isFeatureDisabled);
  const { players, selectedPlayers, togglePlayerSelection, setSelectedPlayers, clearSelection, selectAll } = usePlayerStore();
  const {
    schedule,
    results,
    options,
    selectedDate: selectedDateStr,
    availableDates,
    courtType,
    setSchedule,
    setOptions,
    setResult,
    setSelectedDate: setStoreDateStr,
    loadSession,
    loadAvailableDates,
    saveSession,
    isSaving,
    deleteMatch,
    removeMatch,
    updateMatch,
    swapMatches,
    setCourtType,
    specialMatch,
    setSpecialMatch,
    groupsSnapshot,
    groupOnly,
    setGroupsSnapshot,
    setGroupOnly,
    teamAssignments,
    setTeamAssignments,
    playerOrder,
    setPlayerOrder,
    manualSlots,
    setManualSlots,
    updateManualSlot,
  } = useMatchStore();

  // 섹션 제한
  const sr = club?.settings?.sectionRestrictions || {};
  const isSectionRestricted = (key: string) => !isAdmin && sr[key];

  const [activeTab, setActiveTab] = useState<TabType>(tab === 'schedule' ? 'schedule' : 'score');
  const [scoreViewMode, setScoreViewMode] = useState<'match' | 'individual'>('match');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [guestPlayers, setGuestPlayers] = useState<Record<string, Player>>({});
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [scorePicker, setScorePicker] = useState<{ matchIndex: number; team: 't1' | 't2' } | null>(null);

  // ── 코트 예약 달력 state ──
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
  const { user } = useAuthStore();
  const [resMyName, setResMyName] = useState<string | null>(null);
  const [resData, setResData] = useState<Record<string, CustomEntry[]>>({});
  const [resAnni, setResAnni] = useState<Record<string, AnniversaryInfo>>({});
  const [resModal, setResModal] = useState<{
    visible: boolean;
    mode: 'edit' | 'detail' | 'anni';
    key: string;
    customIndex: number;
  }>({ visible: false, mode: 'edit', key: '', customIndex: -1 });
  const [resInputTimeStart, setResInputTimeStart] = useState('');
  const [resInputTimeEnd, setResInputTimeEnd] = useState('');
  const [resInputPlace, setResInputPlace] = useState('');
  const [resInputCourt, setResInputCourt] = useState('');
  const [resInputTargetM, setResInputTargetM] = useState(false);
  const [resInputTargetF, setResInputTargetF] = useState(false);
  const [resInputTargetMC, setResInputTargetMC] = useState('');
  const [resInputTargetFC, setResInputTargetFC] = useState('');
  const [resInputNtrpMin, setResInputNtrpMin] = useState('');
  const [resInputNtrpMax, setResInputNtrpMax] = useState('');
  const [resInputFee, setResInputFee] = useState('');
  const [resInputMemo, setResInputMemo] = useState('');
  const [resDropOpen, setResDropOpen] = useState('');
  const [resInputAnni, setResInputAnni] = useState('');
  const [resInputSpecial, setResInputSpecial] = useState(false);

  // 본인 이름 로드
  useEffect(() => {
    if (clubCode && user?.email) {
      const emailLower = user.email!.toLowerCase();
      getMemberNames(clubCode).then((names) => {
        if (names[emailLower]) {
          setResMyName(names[emailLower]);
        } else {
          // memberNames에 없으면 players에서 email 매칭
          const matched = players.find(p => p.email?.toLowerCase() === emailLower);
          setResMyName(matched?.name || null);
        }
      });
    }
  }, [clubCode, user?.email, players]);

  // 공휴일 데이터
  const getHolidays = (year: number): Record<string, string> => {
    const solar: Record<string, string> = {
      '1-1': '신정', '3-1': '삼일절', '5-5': '어린이날', '6-6': '현충일',
      '8-15': '광복절', '10-3': '개천절', '10-9': '한글날', '12-25': '성탄절',
    };
    const lunar: Record<number, Record<string, string>> = {
      2025: { '1-28': '설날연휴', '1-29': '설날', '1-30': '설날연휴', '5-5': '부처님오신날', '10-5': '추석연휴', '10-6': '추석', '10-7': '추석연휴' },
      2026: { '2-16': '설날연휴', '2-17': '설날', '2-18': '설날연휴', '5-24': '부처님오신날', '9-24': '추석연휴', '9-25': '추석', '9-26': '추석연휴' },
    };
    let combined = { ...solar };
    if (lunar[year]) combined = { ...combined, ...lunar[year] };
    if (year === 2026) {
      combined['3-2'] = '대체공휴일'; combined['5-25'] = '대체공휴일';
      combined['8-17'] = '대체공휴일'; combined['10-5'] = '대체공휴일';
    }
    return combined;
  };

  // 예약 데이터 로드
  useEffect(() => {
    if (clubCode) {
      getLocalReservations(clubCode).then((data) => {
        const raw = data.reservationData || {};
        for (const entries of Object.values(raw) as CustomEntry[][]) {
          for (const e of entries) {
            if ((e.target as string) === '녀') e.target = '여';
          }
        }
        setResData(raw);
        setResAnni(data.anniversaryData || {});
      });
    }
  }, [clubCode]);

  // 예약 데이터 저장
  const saveResData = (
    newResData?: Record<string, CustomEntry[]>,
    newAnni?: Record<string, AnniversaryInfo>,
  ) => {
    if (!clubCode) return;
    const rd = newResData ?? resData;
    const an = newAnni ?? resAnni;
    const resPayload = { reservationData: rd, customModes: {}, anniversaryData: an };
    saveLocalReservations(clubCode, resPayload);
    syncManager.pushReservations(clubCode, resPayload);
  };

  // 예약 텍스트 복사
  const copyResText = async () => {
    const daysInMonth = new Date(calYear, calMonth, 0).getDate();
    let text = `🎾 ${club?.name || ''} ${calMonth}월 코트 일정\n\n`;
    let hasData = false;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${calYear}-${calMonth}-${d}`;
      let dayText = '';
      const entries = resData[dateKey] || [];
      entries.forEach(item => { dayText += `${calMonth}/${d} [${item.time}] ${item.place} : ${item.court}\n`; });
      if (dayText) { text += dayText; hasData = true; }
    }
    if (!hasData) text += '등록된 일정이 없습니다.';
    await Clipboard.setStringAsync(text);
    Platform.OS === 'web' ? alert('일정이 텍스트로 복사되었습니다!') : Alert.alert('복사 완료', '일정이 복사되었습니다.');
  };

  const displayNameMode = club?.settings?.displayNameMode;
  const dn = useMemo(() => createDisplayNameFn(players, displayNameMode), [players, displayNameMode]);

  // 제한된 탭이면 첫 번째 허용 탭으로 전환
  useEffect(() => {
    const allTabs: TabType[] = ['score', 'schedule'];
    const available = allTabs.filter((t) => !isSectionRestricted(`match.${t}`));
    if (available.length > 0 && isSectionRestricted(`match.${activeTab}`)) {
      setActiveTab(available[0]);
    }
  }, [sr, isAdmin]);

  // JPG 저장용 refs
  const scoreCardRef = useRef<View>(null);
  const indivCardRef = useRef<View>(null);
  const previewCardRef = useRef<View>(null);
  const lastResultAiKeyRef = useRef<string>('');

  const saveAsJpg = async (ref: React.RefObject<View>, filename: string) => {
    if (!ref.current) {
      const msg = '저장할 대상이 없습니다.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('오류', msg);
      return;
    }
    // 캡처 모드 전환 (UI 요소 숨기기) 후 렌더링 대기
    setIsSavingJpg(true);
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
      if (Platform.OS === 'web') {
        const dataUrl = await toJpeg(ref.current as unknown as HTMLElement, {
          quality: 0.95,
          backgroundColor: '#ffffff',
        });
        const link = document.createElement('a');
        link.download = `${filename}.jpg`;
        link.href = dataUrl;
        link.click();
      } else {
        const { captureRef } = await import('react-native-view-shot');
        const uri = await captureRef(ref, { format: 'jpg', quality: 0.9 });
        const { shareAsync } = await import('expo-sharing');
        await shareAsync(uri, { mimeType: 'image/jpeg' });
      }
    } catch (e: any) {
      console.error('JPG save error:', e);
      const msg = '이미지 저장에 실패했습니다.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('오류', msg);
    } finally {
      setIsSavingJpg(false);
    }
  };

  const copyScheduleAsText = async () => {
    const maxCourt = Math.max(...activeMatches.map(m => m.court || 1), 1);
    const lines: string[] = [];

    // 전체 참가 선수 목록
    const allPlayersInSession = new Set<string>();
    activeMatches.forEach(m => {
      m.team1.forEach(n => allPlayersInSession.add(n));
      m.team2.forEach(n => allPlayersInSession.add(n));
    });
    // selectedPlayers가 있으면 그것 사용, 없으면 세션 전체 선수
    const fullRoster = selectedPlayers.length > 0
      ? [...new Set([...selectedPlayers, ...allPlayersInSession])]
      : [...allPlayersInSession];

    // 라운드별로 출력
    const totalRounds = Math.ceil(activeMatches.length / maxCourt);
    for (let round = 0; round < totalRounds; round++) {
      const roundMatches = activeMatches.slice(round * maxCourt, (round + 1) * maxCourt);
      const roundPlaying = new Set<string>();
      for (const match of roundMatches) {
        const courtNum = match.court || 1;
        lines.push(`${round + 1}게임 코트${courtNum} : ${match.team1.map(dn).join(',')} vs ${match.team2.map(dn).join(',')}`);
        match.team1.forEach(n => roundPlaying.add(n));
        match.team2.forEach(n => roundPlaying.add(n));
      }
      const resting = fullRoster.filter(n => !roundPlaying.has(n));
      if (resting.length > 0) {
        lines.push(`쉬는사람: ${resting.map(dn).join(',')}`);
      }
      if (round < totalRounds - 1) lines.push('');
    }
    const text = lines.join('\n');
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(text);
      } else {
        await Clipboard.setStringAsync(text);
      }
      const msg = '클립보드에 복사되었습니다.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('알림', msg);
    } catch (e: any) {
      console.error('Clipboard error:', e);
      const msg = '클립보드 복사에 실패했습니다.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('오류', msg);
    }
  };

  // 대진표 생성 관련 state
  const [shuffleCount, setShuffleCount] = useState(0);
  const [orderMode, setOrderMode] = useState<'random' | 'manual'>('random');
  const [orderViewMode, setOrderViewMode] = useState<'all' | 'group'>('all');
  const [groupManualSlots, setGroupManualSlots] = useState<Record<string, ManualSlot[][]>>({});
  const [manualGenderMode, setManualGenderMode] = useState<string>('성별랜덤');
  const [sameGenderSub, setSameGenderSub] = useState<string>('동성복식');
  const [manualFillNtrp, setManualFillNtrp] = useState(false);
  const [gameCountMode, setGameCountMode] = useState<'perPlayer' | 'totalRounds' | 'totalGames'>('perPlayer');
  const [totalGamesValue, setTotalGamesValue] = useState(10);
  const [teamCount, setTeamCount] = useState(2);
  const [customTeamNames, setCustomTeamNames] = useState<Record<string, string>>({});
  const [customTeamColors, setCustomTeamColors] = useState<Record<string, string>>({});
  const [editingTeamIdx, setEditingTeamIdx] = useState<number | null>(null);
  const [editingTeamNameValue, setEditingTeamNameValue] = useState('');
  const [editingColorIdx, setEditingColorIdx] = useState<number | null>(null);
  const [pendingSchedule, setPendingSchedule] = useState<{ schedule: Match[]; snapshot: Record<string, string> } | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestGender, setGuestGender] = useState<'남' | '여'>('남');
  const [guestGroup, setGuestGroup] = useState('미배정');
  const [guestNtrp, setGuestNtrp] = useState('');
  const [editingMatchIndex, setEditingMatchIndex] = useState<number | null>(null);
  const [allSessions, setAllSessions] = useState<Record<string, Session>>({});
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [recordModal, setRecordModal] = useState<{
    visible: boolean;
    player: string;
    partner: string | null;
    opponents: string[];
    filterMode: 'all' | 'recent5';
  }>({ visible: false, player: '', partner: null, opponents: [], filterMode: 'all' });

  // 대진 수정 관련 state
  const [showPlayerEdit, setShowPlayerEdit] = useState(false);
  const [showGameReorder, setShowGameReorder] = useState(false);
  const [swapOldName, setSwapOldName] = useState<string | null>(null);
  const [swapNewName, setSwapNewName] = useState<string | null>(null);
  const [editGameIndex, setEditGameIndex] = useState<number>(0);
  const [editTeam1, setEditTeam1] = useState<string[]>([]);
  const [editTeam2, setEditTeam2] = useState<string[]>([]);
  const [swapGameA, setSwapGameA] = useState<number>(0);
  const [swapGameB, setSwapGameB] = useState<number>(0);
  const [deleteGameIndex, setDeleteGameIndex] = useState<number>(0);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);
  const [isSavingJpg, setIsSavingJpg] = useState(false);
  const [resultAnalysis, setResultAnalysis] = useState<{ title: string; summary: string } | null>(null);
  const [isAiResultAnalysis, setIsAiResultAnalysis] = useState(false);
  const [isLoadingResultAnalysis, setIsLoadingResultAnalysis] = useState(false);

  // Parse date string to Date object for date picker
  const selectedDate = selectedDateStr ? parseISO(selectedDateStr) : new Date();
  const selectedDateDisplay = format(selectedDate, 'M월 d일 (EEEE)', { locale: ko });
  const isToday = isSameDay(selectedDate, new Date());

  // Wrapper to update both local state representation and store
  const setSelectedDate = (dateOrFn: Date | ((d: Date) => Date)) => {
    const newDate = typeof dateOrFn === 'function' ? dateOrFn(selectedDate) : dateOrFn;
    setStoreDateStr(format(newDate, 'yyyy-MM-dd'));
  };

  // Load all sessions for win probability calculation
  const loadAllSessions = async () => {
    if (!clubCode) return;
    setSessionsLoading(true);
    try {
      const dates = await getSessionDates(clubCode);
      const sessions: Record<string, Session> = {};
      // Load sessions from last 6 months for better statistics
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const recentDates = dates.filter(d => new Date(d) >= sixMonthsAgo);

      // Load sessions in parallel for better performance
      const sessionPromises = recentDates.map(async (date) => {
        const session = await getSession(clubCode, date);
        return { date, session };
      });

      const results = await Promise.all(sessionPromises);
      for (const { date, session } of results) {
        if (session) {
          sessions[date] = session;
        }
      }
      setAllSessions(sessions);
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => {
    if (clubCode) {
      loadSession(clubCode, selectedDateStr);
      loadAvailableDates(clubCode);
      loadAllSessions();
    }
  }, [clubCode, selectedDateStr]);

  // Set initial date to most recent available date only for score tab
  useEffect(() => {
    if (activeTab === 'score' && availableDates.length > 0) {
      const mostRecent = availableDates[availableDates.length - 1];
      if (!availableDates.includes(selectedDateStr)) {
        setStoreDateStr(mostRecent);
      }
    }
  }, [availableDates, activeTab]);

  // Reset to today when switching to schedule tab
  useEffect(() => {
    if (activeTab === 'schedule') {
      const today = format(new Date(), 'yyyy-MM-dd');
      setStoreDateStr(today);
    }
  }, [activeTab]);

  // Navigation for score tab - only available dates
  const goToPrevAvailableDate = () => {
    const currentIdx = availableDates.indexOf(selectedDateStr);
    if (currentIdx > 0) {
      setStoreDateStr(availableDates[currentIdx - 1]);
    }
  };

  const goToNextAvailableDate = () => {
    const currentIdx = availableDates.indexOf(selectedDateStr);
    if (currentIdx >= 0 && currentIdx < availableDates.length - 1) {
      setStoreDateStr(availableDates[currentIdx + 1]);
    }
  };

  const hasPrevAvailableDate = availableDates.indexOf(selectedDateStr) > 0;
  const hasNextAvailableDate = (() => {
    const idx = availableDates.indexOf(selectedDateStr);
    return idx >= 0 && idx < availableDates.length - 1;
  })();

  // 클럽 설정
  const clubSettings = club?.settings;
  const showProb = clubSettings?.showWinProbability !== false;
  const showProbInJpg = clubSettings?.showProbInJpg !== false;

  // 클럽 설정 기본값 적용 (최초 1회)
  const [settingsApplied, setSettingsApplied] = useState(false);
  useEffect(() => {
    if (clubSettings && !settingsApplied) {
      const gt = clubSettings.defaultGameType || '복식';
      const gameType = (gt.includes('단식') ? '단식' : '복식') as '복식' | '단식';
      const isTeam = gt.includes('팀전');
      const defaultMode = gameType === '단식'
        ? '동성 단식'
        : (clubSettings.defaultDoublesMode || '랜덤복식');
      setOptions({
        courtCount: clubSettings.defaultCourtCount || 2,
        maxGames: clubSettings.defaultMaxGames || 4,
        useNtrp: clubSettings.useNtrpBalance || false,
        useAdminNtrp: clubSettings.useAdminNtrp || false,
        gameType,
        isTeamMode: isTeam,
        isManualMode: clubSettings.defaultIsManualMode || false,
        mode: defaultMode as any,
        groupOnly: clubSettings.defaultGroupOnly || false,
      });
      setSettingsApplied(true);
    }
  }, [clubSettings, settingsApplied]);

  // Mode options for select - 클럽 설정 + 구독 등급에 따라 필터링
  const advancedModesDisabled = isFeatureDisabled('disableAdvancedModes');
  const modeOptions = useMemo(() => {
    return DOUBLES_MODES
      .filter((mode) => {
        // 구독 등급: 고급대진 비활성화 시 한울AA/수동 숨김
        if (advancedModesDisabled && (mode === '한울 AA' || mode === '수동 대진')) return false;
        if (!clubSettings?.showMatchOptions) return true;
        const settingKey = MODE_TO_SETTING_KEY[mode];
        if (!settingKey) return true;
        return clubSettings.showMatchOptions[settingKey] !== false;
      })
      .map((mode) => ({
        label: mode,
        value: mode,
      }));
  }, [clubSettings?.showMatchOptions, advancedModesDisabled]);

  // 현재 선택된 모드가 숨겨진 경우 첫 번째 가능한 모드로 변경
  useEffect(() => {
    if (options.gameType === '단식') {
      // 단식 모드에서는 SINGLES_MODES 기준으로 체크
      const singlesAvailable = SINGLES_MODES.some(m => m === options.mode);
      if (!singlesAvailable) {
        setOptions({ mode: '동성 단식' });
      }
    } else {
      // 복식 모드에서는 modeOptions 기준으로 체크
      if (modeOptions.length > 0) {
        const currentModeAvailable = modeOptions.some((opt) => opt.value === options.mode);
        if (!currentModeAvailable) {
          setOptions({ mode: modeOptions[0].value as DoublesMode });
        }
      }
    }
  }, [modeOptions, options.mode, options.gameType]);

  // Court count options
  const courtOptions = [1, 2, 3, 4, 5].map((n) => ({
    label: `${n}코트`,
    value: n,
  }));

  // Max games options
  const gamesOptions = [2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({
    label: `${n}경기`,
    value: n,
  }));

  // Get roster by name for matchmaking (includes guest players)
  const rosterByName = useMemo(() => {
    const map: Record<string, typeof players[0]> = {};
    for (const p of players) {
      map[p.name] = p;
    }
    for (const [name, guest] of Object.entries(guestPlayers)) {
      map[name] = guest;
    }
    return map;
  }, [players, guestPlayers]);

  // Generate schedule
  const handleGenerateSchedule = () => {
    if (selectedPlayers.length < 4) {
      Alert.alert('선수 부족', '최소 4명의 선수를 선택해주세요.');
      return;
    }

    // Hanul AA requires 5-16 players
    if (options.mode === '한울 AA') {
      if (selectedPlayers.length < 5 || selectedPlayers.length > 16) {
        Alert.alert('인원 제한', '한울 AA는 5~16명에서만 사용할 수 있습니다.');
        return;
      }
    }

    const newSchedule = buildSchedule(selectedPlayers, rosterByName, options);

    if (newSchedule.length === 0) {
      Alert.alert('생성 실패', '조건에 맞는 대진표를 생성할 수 없습니다.');
      return;
    }

    // Create groups snapshot from current player data
    const snapshot: Record<string, string> = {};
    for (const playerName of selectedPlayers) {
      const player = rosterByName[playerName];
      if (player) {
        snapshot[playerName] = player.group;
      } else if (guestPlayers[playerName]) {
        snapshot[playerName] = '미배정';
      }
    }

    setSchedule(newSchedule);
    setGroupsSnapshot(snapshot);
    setGroupOnly(options.groupOnly);
    if (clubCode) saveSession(clubCode);
    Alert.alert('완료', `${newSchedule.length}경기 대진표가 생성되었습니다.`);
  };

  // Save schedule
  const handleSaveSchedule = async () => {
    if (!clubCode) {
      Alert.alert('오류', '클럽 코드가 없습니다. 설정에서 클럽을 확인해주세요.');
      return;
    }
    if (schedule.length === 0) {
      Alert.alert('오류', '저장할 대진표가 없습니다.');
      return;
    }

    try {
      const success = await saveSession(clubCode);
      if (success) {
        Alert.alert('저장 완료', '대진표가 저장되었습니다.');
      } else {
        Alert.alert('저장 실패', '다시 시도해주세요.');
      }
    } catch (e) {
      Alert.alert('저장 실패', `오류: ${e}`);
    }
  };

  // Update score
  const handleScoreChange = (matchIndex: number, team: 't1' | 't2', value: string) => {
    const numValue = value === '' ? null : Math.min(6, Math.max(0, parseInt(value) || 0));
    const current = results[String(matchIndex + 1)] || { t1: null, t2: null };
    setResult(matchIndex + 1, {
      ...current,
      [team]: numValue,
    });
  };

  // Score select (dropdown)
  const handleScoreSelect = (matchIndex: number, team: 't1' | 't2', value: number | null) => {
    const current = results[String(matchIndex + 1)] || { t1: null, t2: null };
    setResult(matchIndex + 1, { ...current, [team]: value });
  };

  // Update side position with auto-toggle for partner
  const handleSideChange = (matchIndex: number, playerName: string, side: SidePosition) => {
    const current = results[String(matchIndex + 1)] || { t1: null, t2: null };
    const currentSides = current.sides || {};
    const match = schedule[matchIndex];

    // Find partner (same team)
    const team1 = match?.team1 || [];
    const team2 = match?.team2 || [];
    const isTeam1 = team1.includes(playerName);
    const teammates = isTeam1 ? team1 : team2;
    const partner = teammates.find(p => p !== playerName);

    // If already selected, deselect both player and partner
    if (currentSides[playerName] === side) {
      const newSides = { ...currentSides };
      delete newSides[playerName];
      if (partner) {
        delete newSides[partner];
      }
      setResult(matchIndex + 1, {
        ...current,
        sides: newSides,
      });
      return;
    }

    // Determine opposite side
    const oppositeSide: SidePosition = side === '포(듀스)' ? '백(애드)' : '포(듀스)';

    const newSides = {
      ...currentSides,
      [playerName]: side,
    };

    // Auto-set partner's side to opposite
    if (partner) {
      newSides[partner] = oppositeSide;
    }

    setResult(matchIndex + 1, {
      ...current,
      sides: newSides,
    });
  };

  // Delete match from schedule
  const handleDeleteMatch = (index: number) => {
    Alert.alert(
      '경기 삭제',
      `${index + 1}번 경기를 삭제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => deleteMatch(index),
        },
      ]
    );
  };

  // Add guest player
  const handleAddGuest = () => {
    if (!guestName.trim()) {
      Alert.alert('오류', '게스트 이름을 입력해주세요.');
      return;
    }
    const name = `G${guestName.trim()}`;
    if (guestPlayers[name] || players.some(p => p.name === name)) {
      Alert.alert('오류', '이미 등록된 이름입니다.');
      return;
    }
    const ntrpVal = guestNtrp.trim() ? parseFloat(guestNtrp.trim()) : null;
    const guestPlayer: Player = {
      name,
      gender: guestGender,
      hand: '오른손',
      ageGroup: '',
      racket: '',
      group: guestGroup,
      ntrp: isNaN(ntrpVal as number) ? null : ntrpVal,
      adminNtrp: isNaN(ntrpVal as number) ? null : ntrpVal,
      mbti: null,
    };
    setGuestPlayers({ ...guestPlayers, [name]: guestPlayer });
    togglePlayerSelection(name);
    setPlayerOrder([...playerOrder, name]);
    setGuestName('');
    setGuestGender('남');
    setGuestGroup('미배정');
    setGuestNtrp('');
    setShowGuestModal(false);
  };

  // Remove guest player
  const handleRemoveGuest = (name: string) => {
    const updated = { ...guestPlayers };
    delete updated[name];
    setGuestPlayers(updated);
    if (selectedPlayers.includes(name)) {
      togglePlayerSelection(name);
      setPlayerOrder(playerOrder.filter(n => n !== name));
    }
  };

  // 선수 선택 토글 + 순서 동기화
  const handleTogglePlayer = (name: string) => {
    const isSelected = selectedPlayers.includes(name);
    togglePlayerSelection(name);
    if (isSelected) {
      // 해제: playerOrder에서도 제거
      setPlayerOrder(playerOrder.filter(n => n !== name));
    } else {
      // 선택: playerOrder 끝에 추가
      setPlayerOrder([...playerOrder, name]);
    }
  };

  // Shuffle selected players order
  const handleShufflePlayers = () => {
    const shuffled = [...selectedPlayers].sort(() => Math.random() - 0.5);
    setSelectedPlayers(shuffled);
    setPlayerOrder(shuffled);
    setShuffleCount(prev => prev + 1);
  };

  // 수동 순서 이동
  const handleMovePlayer = (index: number, direction: 'up' | 'down') => {
    const order = playerOrder.length > 0 ? [...playerOrder] : [...selectedPlayers];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= order.length) return;
    [order[index], order[targetIdx]] = [order[targetIdx], order[index]];
    setPlayerOrder(order);
    setSelectedPlayers(order);
  };

  // 조별 보기에서 그룹 내 순서 이동
  const handleMovePlayerInGroup = (groupMembers: string[], memberIdx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? memberIdx - 1 : memberIdx + 1;
    if (targetIdx < 0 || targetIdx >= groupMembers.length) return;
    const order = playerOrder.length > 0 ? [...playerOrder] : [...selectedPlayers];
    const playerA = groupMembers[memberIdx];
    const playerB = groupMembers[targetIdx];
    const globalIdxA = order.indexOf(playerA);
    const globalIdxB = order.indexOf(playerB);
    if (globalIdxA === -1 || globalIdxB === -1) return;
    [order[globalIdxA], order[globalIdxB]] = [order[globalIdxB], order[globalIdxA]];
    setPlayerOrder(order);
    setSelectedPlayers(order);
  };

  // 수동 슬롯 초기화
  const handleInitManualSlots = () => {
    const slots = createEmptySlots(options.totalRounds, options.courtCount, options.gameType);
    setManualSlots(slots);
  };

  // 빈칸 자동 채우기
  const handleAutoFill = (checkedOnly: boolean) => {
    const globalMode = manualGenderMode === '동성' ? sameGenderSub : manualGenderMode;
    const filled = autoFillSlots(
      manualSlots,
      playerOrder.length > 0 ? playerOrder : selectedPlayers,
      rosterByName,
      options.gameType,
      options.courtCount,
      globalMode,
      manualFillNtrp,
      checkedOnly,
      club?.settings?.useAdminNtrp,
    );
    setManualSlots(filled);
  };

  // 전체 초기화
  const handleClearManualSlots = (checkedOnly: boolean) => {
    if (checkedOnly) {
      const newSlots = manualSlots.map(round =>
        round.map(slot => slot.checked
          ? { ...slot, team1: slot.team1.map(() => null), team2: slot.team2.map(() => null) }
          : slot
        )
      );
      setManualSlots(newSlots);
    } else {
      handleInitManualSlots();
    }
  };

  // 전체 선택/해제
  const handleCheckAll = (checked: boolean) => {
    const newSlots = manualSlots.map(round =>
      round.map(slot => ({ ...slot, checked }))
    );
    setManualSlots(newSlots);
  };

  // 체크된 게임 수
  const checkedCount = useMemo(() => {
    let count = 0;
    for (const round of manualSlots) {
      for (const slot of round) {
        if (slot.checked) count++;
      }
    }
    return count;
  }, [manualSlots]);

  // 수동 슬롯에서 선수 변경
  const handleManualSlotPlayerChange = (
    roundIdx: number, courtIdx: number,
    teamIdx: 0 | 1, playerIdx: number, value: string | null,
  ) => {
    const slot = manualSlots[roundIdx]?.[courtIdx];
    if (!slot) return;
    const team = teamIdx === 0 ? [...slot.team1] : [...slot.team2];
    team[playerIdx] = value;
    updateManualSlot(roundIdx, courtIdx, teamIdx === 0 ? { team1: team } : { team2: team });
  };

  // 조별 수동 슬롯 업데이트
  const updateGroupManualSlot = (groupName: string, roundIdx: number, courtIdx: number, update: Partial<ManualSlot>) => {
    setGroupManualSlots(prev => {
      const gSlots = prev[groupName];
      if (!gSlots) return prev;
      const newSlots = gSlots.map((round, ri) =>
        ri === roundIdx
          ? round.map((slot, ci) => ci === courtIdx ? { ...slot, ...update } : slot)
          : round
      );
      return { ...prev, [groupName]: newSlots };
    });
  };

  const handleGroupManualSlotPlayerChange = (
    groupName: string, roundIdx: number, courtIdx: number,
    teamIdx: 0 | 1, playerIdx: number, value: string | null,
  ) => {
    const gSlots = groupManualSlots[groupName];
    const slot = gSlots?.[roundIdx]?.[courtIdx];
    if (!slot) return;
    const team = teamIdx === 0 ? [...slot.team1] : [...slot.team2];
    team[playerIdx] = value;
    updateGroupManualSlot(groupName, roundIdx, courtIdx, teamIdx === 0 ? { team1: team } : { team2: team });
  };

  const handleGroupAutoFill = (groupName: string, checkedOnly: boolean) => {
    const gSlots = groupManualSlots[groupName];
    if (!gSlots) return;
    const orderedList = playerOrder.length > 0 ? playerOrder : selectedPlayers;
    const groupPlayers = orderedList.filter(n => (rosterByName[n]?.group || '미배정') === groupName);
    const globalMode = manualGenderMode === '동성' ? sameGenderSub : manualGenderMode;
    const filled = autoFillSlots(
      gSlots, groupPlayers, rosterByName, options.gameType,
      Math.min(options.courtCount, gSlots[0]?.length || 1),
      globalMode, manualFillNtrp, checkedOnly, club?.settings?.useAdminNtrp,
    );
    setGroupManualSlots(prev => ({ ...prev, [groupName]: filled }));
  };

  const handleGroupClearManualSlots = (groupName: string, checkedOnly: boolean) => {
    if (checkedOnly) {
      const gSlots = groupManualSlots[groupName];
      if (!gSlots) return;
      const newSlots = gSlots.map(round =>
        round.map(slot => slot.checked
          ? { ...slot, team1: slot.team1.map(() => null), team2: slot.team2.map(() => null) }
          : slot
        )
      );
      setGroupManualSlots(prev => ({ ...prev, [groupName]: newSlots }));
    } else {
      const gSlots = groupManualSlots[groupName];
      if (!gSlots || gSlots.length === 0) return;
      const courts = gSlots[0].length;
      const newSlots = createEmptySlots(options.totalRounds, courts, options.gameType);
      setGroupManualSlots(prev => ({ ...prev, [groupName]: newSlots }));
    }
  };

  // 대진표 생성 (자동/수동/팀별 통합)
  const handleGenerateScheduleNew = () => {
    const orderedPlayers = playerOrder.length > 0 ? playerOrder : selectedPlayers;
    const minPlayers = options.gameType === '단식' ? 2 : 4;

    if (orderedPlayers.length < minPlayers) {
      Alert.alert('선수 부족', `최소 ${minPlayers}명의 선수를 선택해주세요.`);
      return;
    }

    // 게임수 모드에 따라 maxGames 계산
    const effectiveOptions = { ...options };
    let trimToTotal: number | null = null;
    if (gameCountMode === 'totalRounds') {
      const playersPerMatch = options.gameType === '단식' ? 2 : 4;
      const matchesPerRound = Math.min(options.courtCount, Math.floor(orderedPlayers.length / playersPerMatch));
      const totalMatches = options.totalRounds * matchesPerRound;
      effectiveOptions.maxGames = Math.max(1, Math.ceil((totalMatches * playersPerMatch) / orderedPlayers.length));
    } else if (gameCountMode === 'totalGames') {
      trimToTotal = totalGamesValue;
      // maxGames를 넉넉히 설정하여 충분한 경기 생성 후 잘라냄
      const playersPerMatch = options.gameType === '단식' ? 2 : 4;
      effectiveOptions.maxGames = Math.max(1, Math.ceil((totalGamesValue * playersPerMatch) / orderedPlayers.length) + 2);
    }

    let newSchedule: Match[] = [];

    if (options.isManualMode) {
      // 수동 대진
      if (orderViewMode === 'group' && clubSettings?.useGroups !== false) {
        // 조별 수동 대진: groupManualSlots 사용
        let combined: Match[] = [];
        const sortedGroupNames = Object.keys(groupManualSlots).sort((a, b) => {
          if (a === '미배정') return 1;
          if (b === '미배정') return -1;
          return a.localeCompare(b, 'ko');
        });
        for (const gName of sortedGroupNames) {
          const gSlots = groupManualSlots[gName];
          if (!gSlots || gSlots.length === 0) continue;
          const gSchedule = buildManualSchedule(gSlots, options.gameType, options.courtCount);
          combined = [...combined, ...gSchedule];
        }
        newSchedule = combined;
      } else {
        newSchedule = buildManualSchedule(manualSlots, options.gameType, options.courtCount);
      }
      if (newSchedule.length === 0) {
        // 빈 슬롯 수 확인해서 상세 에러
        const slotsToCheck = (orderViewMode === 'group' && clubSettings?.useGroups !== false)
          ? Object.values(groupManualSlots).flat()
          : manualSlots;
        let emptyCount = 0;
        for (const round of slotsToCheck) {
          for (const slot of round) {
            const allPlayers = [...slot.team1, ...slot.team2].filter(n => n && n !== '선택');
            if (allPlayers.length === 0) emptyCount++;
          }
        }
        Alert.alert('오류', emptyCount > 0
          ? `${emptyCount}개 게임이 비어있습니다. 선수를 배정하거나 자동 채우기를 사용해주세요.`
          : '유효한 게임이 없습니다. 각 게임에 선수를 모두 선택해주세요.');
        return;
      }
    } else if (options.isTeamMode) {
      // 팀전 대진 - 팀 검증
      const activeTeams = TEAM_NAMES.slice(0, teamCount);
      const teamSizes: Record<string, number> = {};
      for (const t of activeTeams) {
        teamSizes[t] = orderedPlayers.filter(p => teamAssignments[p] === t).length;
      }
      const playersPerTeam = options.gameType === '단식' ? 1 : 2;
      const validTeams = activeTeams.filter(t => teamSizes[t] >= playersPerTeam);
      if (validTeams.length < 2) {
        Alert.alert('팀 부족', `최소 2개 팀에 각각 ${playersPerTeam}명 이상 배정해주세요.`);
        return;
      }

      // 경기수 모드에 따라 totalRounds 결정
      let teamRounds = options.totalRounds;
      if (gameCountMode === 'perPlayer') {
        const ppm = options.gameType === '단식' ? 2 : 4;
        const mpr = Math.min(options.courtCount, Math.floor(orderedPlayers.length / ppm));
        teamRounds = Math.max(1, Math.ceil((orderedPlayers.length * options.maxGames) / (ppm * Math.max(1, mpr))));
      } else if (gameCountMode === 'totalGames') {
        teamRounds = Math.max(1, Math.ceil(totalGamesValue / options.courtCount));
        trimToTotal = totalGamesValue;
      }

      newSchedule = buildTeamSchedule(
        orderedPlayers, rosterByName, teamAssignments,
        [...activeTeams], options.gameType, teamRounds,
        options.courtCount, options.mode, options.useNtrp,
      );
    } else if (orderViewMode === 'group' && clubSettings?.useGroups !== false) {
      // 조별 자동 대진: 각 그룹별로 별도 생성
      const groupedPlayers: Record<string, string[]> = {};
      for (const name of orderedPlayers) {
        const g = rosterByName[name]?.group || '미배정';
        if (!groupedPlayers[g]) groupedPlayers[g] = [];
        groupedPlayers[g].push(name);
      }
      const sortedGroups = Object.keys(groupedPlayers).sort((a, b) => {
        if (a === '미배정') return 1;
        if (b === '미배정') return -1;
        return a.localeCompare(b, 'ko');
      });
      let combined: Match[] = [];
      for (const g of sortedGroups) {
        const gPlayers = groupedPlayers[g];
        if (gPlayers.length < minPlayers) continue;
        const gOptions = { ...effectiveOptions, groupOnly: false };
        const gSchedule = buildSchedule(gPlayers, rosterByName, gOptions);
        combined = [...combined, ...gSchedule];
      }
      newSchedule = combined;
    } else {
      // 자동 대진 (전체)
      const isAA = options.mode === '한울 AA' && options.gameType === '복식';
      if (isAA) {
        if (orderedPlayers.length < 5 || orderedPlayers.length > 16) {
          Alert.alert('인원 제한', '한울 AA는 5~16명에서만 사용할 수 있습니다.');
          return;
        }
        // 한울 AA: 코트 2, 인당 4경기 강제
        const aaOptions = { ...options, courtCount: 2, maxGames: 4 };
        newSchedule = buildSchedule(orderedPlayers, rosterByName, aaOptions);
      } else {
        newSchedule = buildSchedule(orderedPlayers, rosterByName, effectiveOptions);
      }
    }

    // 총게임수 모드: 정확히 N경기로 자르기
    if (trimToTotal !== null && newSchedule.length > trimToTotal) {
      newSchedule = newSchedule.slice(0, trimToTotal);
      // 코트 번호 재할당 (라운드별 순환)
      for (let i = 0; i < newSchedule.length; i++) {
        newSchedule[i] = { ...newSchedule[i], court: (i % options.courtCount) + 1 };
      }
    }

    if (newSchedule.length === 0) {
      Alert.alert('생성 실패', '조건에 맞는 대진표를 생성할 수 없습니다. 인원수나 옵션을 확인해주세요.');
      return;
    }

    // snapshot은 orderedPlayers 기준 (스케줄과 동일 리스트)
    const snapshot: Record<string, string> = {};
    for (const playerName of orderedPlayers) {
      const player = rosterByName[playerName];
      if (player) {
        snapshot[playerName] = player.group;
      } else if (guestPlayers[playerName]) {
        snapshot[playerName] = '미배정';
      }
    }

    // 해당 날짜에 이미 저장된 대진표가 있는지 확인
    const hasExisting = availableDates.includes(selectedDateStr) && clubCode;

    if (hasExisting) {
      // 인라인 확인 UI 표시 (Alert.alert 콜백은 웹에서 불안정)
      setPendingSchedule({ schedule: newSchedule, snapshot });
    } else {
      setSchedule(newSchedule);
      setGroupsSnapshot(snapshot);
      const effectiveGroupOnly = orderViewMode === 'group' ? true : false;
      setGroupOnly(effectiveGroupOnly);
      if (clubCode) saveSession(clubCode);
    }
  };

  // 기존 대진표 존재 시 처리
  const handlePendingOverwrite = () => {
    if (!pendingSchedule) return;
    setSchedule(pendingSchedule.schedule);
    setGroupsSnapshot(pendingSchedule.snapshot);
    const effectiveGroupOnly = orderViewMode === 'group' ? true : false;
    setGroupOnly(effectiveGroupOnly);
    setPendingSchedule(null);
    if (clubCode) saveSession(clubCode);
  };

  const handlePendingAppend = async () => {
    if (!pendingSchedule || !clubCode) return;
    const existing = await getSession(clubCode, selectedDateStr);
    if (existing) {
      const merged = [...existing.schedule, ...pendingSchedule.schedule];
      const mergedSnapshot = { ...(existing.groupsSnapshot || {}), ...pendingSchedule.snapshot };
      setSchedule(merged);
      setGroupsSnapshot(mergedSnapshot);
    } else {
      setSchedule(pendingSchedule.schedule);
      setGroupsSnapshot(pendingSchedule.snapshot);
    }
    const effectiveGroupOnly = orderViewMode === 'group' ? true : false;
    setGroupOnly(effectiveGroupOnly);
    setPendingSchedule(null);
    if (clubCode) saveSession(clubCode);
  };

  // options 변경 시 수동 슬롯 갱신 (기존 데이터 최대한 보존)
  useEffect(() => {
    if (!options.isManualMode) return;
    if (manualSlots.length === 0) {
      // 첫 초기화
      handleInitManualSlots();
      return;
    }
    const playersPerTeam = options.gameType === '단식' ? 1 : 2;
    // 라운드 수 변경: 확장/축소
    const newSlots = [...manualSlots.map(r => [...r])];
    while (newSlots.length < options.totalRounds) {
      const round: ManualSlot[] = [];
      for (let c = 0; c < options.courtCount; c++) {
        round.push({ team1: Array(playersPerTeam).fill(null), team2: Array(playersPerTeam).fill(null), checked: false });
      }
      newSlots.push(round);
    }
    while (newSlots.length > options.totalRounds) {
      newSlots.pop();
    }
    // 코트 수 변경: 각 라운드의 코트 수 확장/축소
    for (let r = 0; r < newSlots.length; r++) {
      while (newSlots[r].length < options.courtCount) {
        newSlots[r].push({ team1: Array(playersPerTeam).fill(null), team2: Array(playersPerTeam).fill(null), checked: false });
      }
      while (newSlots[r].length > options.courtCount) {
        newSlots[r].pop();
      }
    }
    setManualSlots(newSlots);
  }, [options.isManualMode, options.totalRounds, options.courtCount]);

  // 조별 수동 슬롯 초기화
  useEffect(() => {
    if (!options.isManualMode || orderViewMode !== 'group' || clubSettings?.useGroups === false) return;
    const orderedList = playerOrder.length > 0 ? playerOrder : selectedPlayers;
    if (orderedList.length === 0) return;
    const grouped: Record<string, string[]> = {};
    for (const name of orderedList) {
      const g = rosterByName[name]?.group || '미배정';
      if (!grouped[g]) grouped[g] = [];
      grouped[g].push(name);
    }
    const newGroupSlots: Record<string, ManualSlot[][]> = {};
    for (const [gName, gMembers] of Object.entries(grouped)) {
      const ppm = options.gameType === '단식' ? 2 : 4;
      const gCourts = Math.min(options.courtCount, Math.floor(gMembers.length / ppm));
      if (gCourts < 1) continue;
      newGroupSlots[gName] = createEmptySlots(options.totalRounds, gCourts, options.gameType);
    }
    setGroupManualSlots(newGroupSlots);
  }, [options.isManualMode, orderViewMode, options.totalRounds, options.courtCount, selectedPlayers.length]);

  // 선수 순서 초기화
  useEffect(() => {
    if (selectedPlayers.length > 0 && playerOrder.length === 0) {
      setPlayerOrder([...selectedPlayers]);
    }
  }, [selectedPlayers]);

  // 대진표에 등장하는 선수 목록
  const dayPlayerNames = useMemo(() => {
    const names = new Set<string>();
    for (const m of schedule) {
      if (m.gameType === '삭제') continue;
      m.team1.forEach(n => { if (n) names.add(n); });
      m.team2.forEach(n => { if (n) names.add(n); });
    }
    return Array.from(names).sort();
  }, [schedule]);

  // roster 선수 목록
  const rosterNames = useMemo(() => {
    return players.map(p => p.name).sort();
  }, [players]);

  // 게임 라벨 생성 함수
  const getGameLabel = (m: Match, idx: number) => {
    const t1 = m.team1.map(dn).join(' / ');
    const t2 = m.team2.map(dn).join(' / ');
    return `${idx + 1}번 (${m.gameType}, 코트 ${m.court}) ${t1} vs ${t2}`;
  };

  // (A) 일괄 선수 교체
  const handlePlayerSwapAll = async () => {
    if (!swapOldName || !swapNewName || swapOldName === swapNewName) {
      Alert.alert('오류', '기존/새 이름이 같거나 선택되지 않았습니다.');
      return;
    }
    const newSchedule = schedule.map(m => ({
      ...m,
      team1: m.team1.map(n => n === swapOldName ? swapNewName : n),
      team2: m.team2.map(n => n === swapOldName ? swapNewName : n),
    }));
    setSchedule(newSchedule);
    if (clubCode) {
      const success = await saveSession(clubCode);
      if (success) {
        Alert.alert('완료', `'${swapOldName}' → '${swapNewName}' 교체 완료!`);
      }
    }
  };

  // (A-2) 한 게임만 선수 변경
  const handlePlayerSwapOne = async () => {
    if (editGameIndex < 0 || editGameIndex >= schedule.length) return;
    const allPlayers = [...editTeam1, ...editTeam2].filter(n => n);
    if (allPlayers.length !== new Set(allPlayers).size) {
      Alert.alert('오류', '같은 선수가 중복되어 있습니다.');
      return;
    }
    const match = schedule[editGameIndex];
    updateMatch(editGameIndex, {
      ...match,
      team1: editTeam1,
      team2: editTeam2,
    });
    if (clubCode) {
      // Need to save after state update
      setTimeout(async () => {
        const success = await saveSession(clubCode);
        if (success) {
          Alert.alert('완료', `${editGameIndex + 1}번 게임 선수 변경 완료!`);
        }
      }, 100);
    }
  };

  // (B) 게임 순서 교환
  const handleGameSwap = async () => {
    if (swapGameA === swapGameB) {
      Alert.alert('안내', '같은 게임이라서 교환할 게 없습니다.');
      return;
    }
    swapMatches(swapGameA, swapGameB);
    if (clubCode) {
      setTimeout(async () => {
        const success = await saveSession(clubCode);
        if (success) {
          Alert.alert('완료', '게임 순서 교환 완료!');
        }
      }, 100);
    }
  };

  // (C) 게임 삭제 - 확인 UI 표시
  const handleGameDeleteRequest = (index: number) => {
    setDeleteConfirmIndex(index);
  };

  // (C) 게임 삭제 - 실행
  const handleGameDeleteExecute = async (index: number) => {
    removeMatch(index);
    setDeleteConfirmIndex(null);
    // deleteGameIndex가 범위를 벗어나면 초기화
    if (deleteGameIndex >= schedule.length - 1) {
      setDeleteGameIndex(Math.max(0, schedule.length - 2));
    }
    if (clubCode) {
      setTimeout(async () => {
        const success = await saveSession(clubCode);
        if (success) {
          Alert.alert('완료', '게임이 삭제되었습니다.');
        }
      }, 100);
    }
  };

  // editGameIndex 변경 시 해당 게임의 선수 정보 로드
  useEffect(() => {
    if (schedule.length > 0 && editGameIndex >= 0 && editGameIndex < schedule.length) {
      const m = schedule[editGameIndex];
      setEditTeam1([...m.team1]);
      setEditTeam2([...m.team2]);
    }
  }, [editGameIndex, schedule]);

  // Active matches for display
  const activeMatches = schedule.filter((m) => m.gameType !== '삭제');

  // Completion stats
  const completedCount = activeMatches.filter((_, i) => {
    const r = results[String(i + 1)];
    return r?.t1 !== null && r?.t1 !== undefined;
  }).length;
  const completionPercent = activeMatches.length > 0
    ? Math.round((completedCount / activeMatches.length) * 100)
    : 0;

  // 오늘의 하이라이트 데이터
  const highlightData = useMemo(() => {
    if (completedCount === 0) return null;
    const memberSet = new Set(players.map(p => p.name));
    const session: Session = { schedule, results };
    const stats = calculateDailyStats(session, memberSet);
    const mvp = findMVP(stats);
    const attendees = Object.keys(stats).filter(n => stats[n].games > 0);
    const totalGames = activeMatches.filter((_, i) => {
      const r = results[String(i + 1)];
      return r?.t1 !== null && r?.t1 !== undefined;
    }).length;
    const undefeated = attendees.filter(n => stats[n].losses === 0 && stats[n].games > 0);
    const shutouts: Record<string, number> = {};
    schedule.forEach((match, idx) => {
      if (match.gameType === '삭제') return;
      const r = results[String(idx + 1)];
      if (!r || r.t1 === null) return;
      if (r.t1 === 0) match.team2.forEach(n => { shutouts[n] = (shutouts[n] || 0) + 1; });
      if (r.t2 === 0) match.team1.forEach(n => { shutouts[n] = (shutouts[n] || 0) + 1; });
    });
    const maxShutouts = Math.max(0, ...Object.values(shutouts));
    const shutoutLeaders = Object.entries(shutouts)
      .filter(([_, c]) => c === maxShutouts && maxShutouts > 0)
      .map(([n]) => n);
    return { stats, mvp, attendees, totalGames, undefeated, shutoutLeaders, maxShutouts };
  }, [completedCount, schedule, results, players]);

  // 개인별 보기 랭킹
  const dailyRanking = useMemo(() => {
    if (!highlightData) return [];
    return Object.values(highlightData.stats).sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return (b.scoreFor - b.scoreAgainst) - (a.scoreFor - a.scoreAgainst);
    });
  }, [highlightData]);

  // 경기 결과 총평 분석
  useEffect(() => {
    if (completedCount === 0 || activeMatches.length === 0) {
      setResultAnalysis(null);
      lastResultAiKeyRef.current = '';
      return;
    }
    const session: Session = { schedule, results };
    const analysis = analyzeResultDay(session);
    setResultAnalysis({ title: '', summary: analysis.overallVerdict });
    setIsAiResultAnalysis(false);

    const apiKey = club?.settings?.geminiApiKey;
    if (!apiKey || !clubCode) return;

    // 데이터 변경 여부 확인 → 같으면 AI 호출 스킵
    const aiKey = `${selectedDateStr}-${completedCount}-${schedule.length}`;
    if (aiKey === lastResultAiKeyRef.current) return;
    lastResultAiKeyRef.current = aiKey;

    console.log('[Match] Gemini: calling result analysis (data changed)');
    setIsLoadingResultAnalysis(true);
    generateResultAnalysisAI(apiKey, analysis, clubCode, selectedDateStr)
      .then((aiResult) => {
        if (aiResult) {
          setResultAnalysis(aiResult);
          setIsAiResultAnalysis(true);
        }
      })
      .finally(() => setIsLoadingResultAnalysis(false));
  }, [completedCount, schedule.length, selectedDateStr]);

  // Permission checks
  const entryDisabled = isSectionRestricted('match.score.entryDisabled');
  const canCreateSchedule = !isAdmin || hasPermission('canCreateSchedule');

  // 구독 등급 제한
  if (isFeatureDisabled('disableSchedule')) {
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
      {/* Tab Header */}
      <View style={styles.tabHeaderContainer}>
        <View style={styles.tabHeader}>
          <SegmentedTabs
            tabs={[
              { key: 'score', label: '일정 보기' },
              { key: 'schedule', label: '대진표 생성' },
            ].filter((t) => !isSectionRestricted(`match.${t.key}`))}
            activeKey={activeTab}
            onTabPress={(key) => setActiveTab(key as TabType)}
          />
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Date selector - schedule tab only */}
        {activeTab === 'schedule' && (
        <View style={styles.dateRow}>
              <TouchableOpacity
                style={styles.dateNavBtn}
                onPress={() => setSelectedDate((d) => subDays(d, 1))}
              >
                <FontAwesome name="chevron-left" size={14} color={colors.black} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dateDisplay}
                onPress={() => setShowDatePicker(true)}
              >
                <FontAwesome name="calendar" size={14} color={colors.black} style={{ marginRight: 8 }} />
                <Text style={styles.dateText}>{selectedDateDisplay}</Text>
                {isToday && <Text style={styles.todayBadge}>오늘</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dateNavBtn}
                onPress={() => setSelectedDate((d) => addDays(d, 1))}
              >
                <FontAwesome name="chevron-right" size={14} color={colors.black} />
              </TouchableOpacity>
        </View>
        )}

        {/* Date picker modal - Full month calendar (schedule tab only) */}
        <Modal
          visible={activeTab === 'schedule' && showDatePicker}
          animationType="fade"
          transparent
          onRequestClose={() => setShowDatePicker(false)}
        >
          <TouchableOpacity
            style={styles.datePickerOverlay}
            activeOpacity={1}
            onPress={() => setShowDatePicker(false)}
          >
            <View style={styles.datePickerContainer} onStartShouldSetResponder={() => true}>
              <View style={styles.datePickerHeader}>
                <TouchableOpacity
                  style={styles.monthNavBtn}
                  onPress={() => setSelectedDate((d) => subMonths(d, 1))}
                >
                  <FontAwesome name="chevron-left" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
                <Text style={styles.datePickerTitle}>
                  {format(selectedDate, 'yyyy년 M월', { locale: ko })}
                </Text>
                <TouchableOpacity
                  style={styles.monthNavBtn}
                  onPress={() => setSelectedDate((d) => addMonths(d, 1))}
                >
                  <FontAwesome name="chevron-right" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.weekDaysRow}>
                {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
                  <Text key={day} style={[
                    styles.weekDayText,
                    idx === 0 && styles.weekDaySun,
                    idx === 6 && styles.weekDaySat,
                  ]}>{day}</Text>
                ))}
              </View>

              <View style={styles.monthGrid}>
                {(() => {
                  const monthStart = startOfMonth(selectedDate);
                  const monthEnd = endOfMonth(selectedDate);
                  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
                  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
                  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

                  return days.map((day) => {
                    const isSelected = isSameDay(day, selectedDate);
                    const isTodayDate = isSameDay(day, new Date());
                    const isCurrentMonth = isSameMonth(day, selectedDate);
                    const dayStr = format(day, 'yyyy-MM-dd');
                    const hasSession = availableDates.includes(dayStr);
                    const dayOfWeek = day.getDay();

                    return (
                      <TouchableOpacity
                        key={day.toISOString()}
                        style={[
                          styles.dayBtn,
                          isSelected && styles.dayBtnSelected,
                          isTodayDate && !isSelected && styles.dayBtnToday,
                          !isCurrentMonth && styles.dayBtnOtherMonth,
                        ]}
                        onPress={() => {
                          setSelectedDate(day);
                          setShowDatePicker(false);
                        }}
                      >
                        <Text style={[
                          styles.dayText,
                          isSelected && styles.dayTextSelected,
                          isTodayDate && !isSelected && styles.dayTextToday,
                          !isCurrentMonth && styles.dayTextOtherMonth,
                          dayOfWeek === 0 && isCurrentMonth && !isSelected && styles.dayTextSun,
                          dayOfWeek === 6 && isCurrentMonth && !isSelected && styles.dayTextSat,
                        ]}>
                          {format(day, 'd')}
                        </Text>
                        {hasSession && (
                          <View style={[
                            styles.sessionDot,
                            isSelected && styles.sessionDotSelected,
                          ]} />
                        )}
                      </TouchableOpacity>
                    );
                  });
                })()}
              </View>

              <TouchableOpacity
                style={styles.todayBtn}
                onPress={() => {
                  setSelectedDate(new Date());
                  setShowDatePicker(false);
                }}
              >
                <Text style={styles.todayBtnText}>오늘로 이동</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {activeTab === 'schedule' ? (
          <>
            {/* Player Selection */}
            <Card title={`🙋 참가 선수 (${selectedPlayers.length}명 선택)`}>
              <View style={styles.selectionHeader}>
                <Button
                  title="전체 선택"
                  onPress={() => { selectAll(); setPlayerOrder(players.map(p => p.name).concat(Object.keys(guestPlayers))); }}
                  variant="outline"
                  size="small"
                />
                <Button
                  title="선택 해제"
                  onPress={() => { clearSelection(); setPlayerOrder([]); }}
                  variant="outline"
                  size="small"
                  style={{ marginLeft: 8 }}
                />
              </View>

              <View style={styles.playerGrid}>
                {players.map((player) => {
                  const isSelected = selectedPlayers.includes(player.name);
                  const genderStyle = player.gender === '남' ? styles.playerChipMale : styles.playerChipFemale;
                  const genderSelectedStyle = player.gender === '남' ? styles.playerChipMaleSelected : styles.playerChipFemaleSelected;
                  return (
                    <TouchableOpacity
                      key={player.id || player.name}
                      style={[
                        styles.playerChip,
                        genderStyle,
                        isSelected && genderSelectedStyle,
                      ]}
                      onPress={() => handleTogglePlayer(player.name)}
                    >
                      <Text
                        style={[
                          styles.playerChipText,
                          isSelected && styles.playerChipTextSelected,
                        ]}
                      >
                        {dn(player.name)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                {/* Guest Players */}
                {Object.entries(guestPlayers).map(([gName, gData]) => (
                  <TouchableOpacity
                    key={gName}
                    style={[
                      styles.playerChip,
                      styles.guestChip,
                      selectedPlayers.includes(gName) && (gData.gender === '여' ? styles.playerChipFemaleSelected : styles.playerChipMaleSelected),
                    ]}
                    onPress={() => handleTogglePlayer(gName)}
                    onLongPress={() => handleRemoveGuest(gName)}
                  >
                    <Text
                      style={[
                        styles.playerChipText,
                        selectedPlayers.includes(gName) && styles.playerChipTextSelected,
                      ]}
                    >
                      {gName.replace(/^G/, '')}
                    </Text>
                    <Text style={styles.guestBadge}>G</Text>
                  </TouchableOpacity>
                ))}

                {/* Add Guest Button */}
                <TouchableOpacity
                  style={styles.addGuestChip}
                  onPress={() => setShowGuestModal(true)}
                >
                  <FontAwesome name="plus" size={12} color={colors.textSecondary} />
                  <Text style={styles.addGuestText}>게스트</Text>
                </TouchableOpacity>
              </View>

              {/* 선택 순서 + 순서 정하기 통합 */}
              {selectedPlayers.length > 0 && (
                <View style={styles.selectedOrderSection}>
                  <Text style={styles.selectedOrderTitle}>선택 순서 ({selectedPlayers.length}명)</Text>

                  {/* 순서 방식: 랜덤 / 수동 */}
                  <View style={styles.radioRow}>
                    <TouchableOpacity
                      style={[styles.radioBtn, orderMode === 'random' && styles.radioBtnActive]}
                      onPress={() => setOrderMode('random')}
                    >
                      <Text style={[styles.radioBtnText, orderMode === 'random' && styles.radioBtnTextActive]}>랜덤</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.radioBtn, orderMode === 'manual' && styles.radioBtnActive]}
                      onPress={() => setOrderMode('manual')}
                    >
                      <Text style={[styles.radioBtnText, orderMode === 'manual' && styles.radioBtnTextActive]}>수동</Text>
                    </TouchableOpacity>
                    {orderMode === 'random' && (
                      <>
                        <Button
                          title="섞기"
                          onPress={handleShufflePlayers}
                          variant="outline"
                          size="small"
                          style={{ marginLeft: 8 }}
                        />
                        {shuffleCount > 0 && (
                          <Text style={styles.shuffleCountText}>({shuffleCount}회)</Text>
                        )}
                      </>
                    )}
                  </View>

                  {/* 표시 방식: 전체 / 조별 */}
                  {clubSettings?.useGroups !== false && (
                  <View style={[styles.radioRow, { marginTop: 6 }]}>
                    <Text style={styles.radioLabel}>표시:</Text>
                    <TouchableOpacity
                      style={[styles.radioBtn, orderViewMode === 'all' && styles.radioBtnActive]}
                      onPress={() => setOrderViewMode('all')}
                    >
                      <Text style={[styles.radioBtnText, orderViewMode === 'all' && styles.radioBtnTextActive]}>전체</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.radioBtn, orderViewMode === 'group' && styles.radioBtnActive]}
                      onPress={() => setOrderViewMode('group')}
                    >
                      <Text style={[styles.radioBtnText, orderViewMode === 'group' && styles.radioBtnTextActive]}>조별</Text>
                    </TouchableOpacity>
                  </View>
                  )}

                  {/* 선수 목록 */}
                  <View style={{ marginTop: 10 }} />
                  {orderViewMode === 'all' ? (
                    orderMode === 'manual' ? (
                      /* 수동 모드: 위/아래 버튼으로 순서 변경 */
                      <View style={styles.manualOrderList}>
                        {(playerOrder.length > 0 ? playerOrder : selectedPlayers).map((name, idx, arr) => {
                          const p = rosterByName[name];
                          const isMale = p?.gender === '남';
                          const isFemale = p?.gender === '여';
                          return (
                            <View key={name} style={styles.manualOrderRow}>
                              <View style={styles.manualOrderArrows}>
                                <TouchableOpacity
                                  onPress={() => handleMovePlayer(idx, 'up')}
                                  disabled={idx === 0}
                                  style={styles.manualOrderArrowBtn}
                                >
                                  <FontAwesome name="caret-up" size={20} color={idx === 0 ? colors.textTertiary : colors.textSecondary} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  onPress={() => handleMovePlayer(idx, 'down')}
                                  disabled={idx === arr.length - 1}
                                  style={styles.manualOrderArrowBtn}
                                >
                                  <FontAwesome name="caret-down" size={20} color={idx === arr.length - 1 ? colors.textTertiary : colors.textSecondary} />
                                </TouchableOpacity>
                              </View>
                              <View
                                style={[
                                  styles.manualOrderChip,
                                  isMale && styles.selectedOrderChipMale,
                                  isFemale && styles.selectedOrderChipFemale,
                                ]}
                              >
                                <Text style={[
                                  styles.selectedOrderNum,
                                  isMale && { color: colors.male.text },
                                  isFemale && { color: colors.female.text },
                                ]}>{idx + 1}</Text>
                                <Text style={[
                                  styles.selectedOrderName,
                                  isMale && { color: colors.male.text },
                                  isFemale && { color: colors.female.text },
                                  { flex: 1 },
                                ]}>{dn(name)}</Text>
                                <TouchableOpacity
                                  style={styles.selectedOrderRemove}
                                  onPress={() => handleTogglePlayer(name)}
                                >
                                  <FontAwesome name="times" size={10} color={colors.textTertiary} />
                                </TouchableOpacity>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    ) : (
                      /* 랜덤 모드: 기존 칩 형태 */
                      <View style={styles.selectedOrderList}>
                        {(playerOrder.length > 0 ? playerOrder : selectedPlayers).map((name, idx) => {
                          const p = rosterByName[name];
                          const isMale = p?.gender === '남';
                          const isFemale = p?.gender === '여';
                          return (
                            <View
                              key={name}
                              style={[
                                styles.selectedOrderChip,
                                isMale && styles.selectedOrderChipMale,
                                isFemale && styles.selectedOrderChipFemale,
                              ]}
                            >
                              <Text style={[
                                styles.selectedOrderNum,
                                isMale && { color: colors.male.text },
                                isFemale && { color: colors.female.text },
                              ]}>{idx + 1}</Text>
                              <Text style={[
                                styles.selectedOrderName,
                                isMale && { color: colors.male.text },
                                isFemale && { color: colors.female.text },
                              ]}>{dn(name)}</Text>
                              <TouchableOpacity
                                style={styles.selectedOrderRemove}
                                onPress={() => handleTogglePlayer(name)}
                              >
                                <FontAwesome name="times" size={10} color={colors.textTertiary} />
                              </TouchableOpacity>
                            </View>
                          );
                        })}
                      </View>
                    )
                  ) : (
                    (() => {
                      const groups: Record<string, string[]> = {};
                      const orderedList = playerOrder.length > 0 ? playerOrder : selectedPlayers;
                      for (const name of orderedList) {
                        const p = rosterByName[name];
                        const g = p?.group || '미배정';
                        if (!groups[g]) groups[g] = [];
                        groups[g].push(name);
                      }
                      const sortedEntries = Object.entries(groups).sort(([a], [b]) => {
                        if (a === '미배정') return 1;
                        if (b === '미배정') return -1;
                        return a.localeCompare(b, 'ko');
                      });
                      return sortedEntries.map(([groupName, members]) => (
                        <View key={groupName} style={styles.groupSection}>
                          <Text style={styles.groupSectionTitle}>{groupName} ({members.length}명)</Text>
                          {orderMode === 'manual' ? (
                            <View style={styles.manualOrderList}>
                              {members.map((name, idx) => {
                                const p = rosterByName[name];
                                const isMale = p?.gender === '남';
                                const isFemale = p?.gender === '여';
                                return (
                                  <View key={name} style={styles.manualOrderRow}>
                                    <View style={styles.manualOrderArrows}>
                                      <TouchableOpacity
                                        onPress={() => handleMovePlayerInGroup(members, idx, 'up')}
                                        disabled={idx === 0}
                                        style={styles.manualOrderArrowBtn}
                                      >
                                        <FontAwesome name="caret-up" size={20} color={idx === 0 ? colors.textTertiary : colors.textSecondary} />
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        onPress={() => handleMovePlayerInGroup(members, idx, 'down')}
                                        disabled={idx === members.length - 1}
                                        style={styles.manualOrderArrowBtn}
                                      >
                                        <FontAwesome name="caret-down" size={20} color={idx === members.length - 1 ? colors.textTertiary : colors.textSecondary} />
                                      </TouchableOpacity>
                                    </View>
                                    <View style={[styles.manualOrderChip, isMale && styles.selectedOrderChipMale, isFemale && styles.selectedOrderChipFemale]}>
                                      <Text style={[styles.selectedOrderNum, isMale && { color: colors.male.text }, isFemale && { color: colors.female.text }]}>{idx + 1}</Text>
                                      <Text style={[styles.selectedOrderName, isMale && { color: colors.male.text }, isFemale && { color: colors.female.text }, { flex: 1 }]}>{dn(name)}</Text>
                                      <TouchableOpacity style={styles.selectedOrderRemove} onPress={() => handleTogglePlayer(name)}>
                                        <FontAwesome name="times" size={10} color={colors.textTertiary} />
                                      </TouchableOpacity>
                                    </View>
                                  </View>
                                );
                              })}
                            </View>
                          ) : (
                            <View style={styles.selectedOrderList}>
                              {members.map((name, idx) => {
                                const p = rosterByName[name];
                                const isMale = p?.gender === '남';
                                const isFemale = p?.gender === '여';
                                return (
                                  <View
                                    key={name}
                                    style={[
                                      styles.selectedOrderChip,
                                      isMale && styles.selectedOrderChipMale,
                                      isFemale && styles.selectedOrderChipFemale,
                                    ]}
                                  >
                                    <Text style={[styles.selectedOrderNum, isMale && { color: colors.male.text }, isFemale && { color: colors.female.text }]}>{idx + 1}</Text>
                                    <Text style={[styles.selectedOrderName, isMale && { color: colors.male.text }, isFemale && { color: colors.female.text }]}>{dn(name)}</Text>
                                    <TouchableOpacity style={styles.selectedOrderRemove} onPress={() => handleTogglePlayer(name)}>
                                      <FontAwesome name="times" size={10} color={colors.textTertiary} />
                                    </TouchableOpacity>
                                  </View>
                                );
                              })}
                            </View>
                          )}
                        </View>
                      ));
                    })()
                  )}
                </View>
              )}

              {/* Special Match (교류전) */}
              <View style={styles.checkboxRow}>
                <Checkbox
                  checked={specialMatch}
                  onPress={() => setSpecialMatch(!specialMatch)}
                  label="스페셜 매치 (교류전) - 통계 미반영"
                />
              </View>
            </Card>

            {/* Guest Modal */}
            <Modal
              visible={showGuestModal}
              animationType="fade"
              transparent
              onRequestClose={() => setShowGuestModal(false)}
            >
              <TouchableOpacity
                style={styles.datePickerOverlay}
                activeOpacity={1}
                onPress={() => setShowGuestModal(false)}
              >
                <View style={styles.guestModalContainer} onStartShouldSetResponder={() => true}>
                  <Text style={styles.guestModalTitle}>게스트 추가</Text>
                  <TextInput
                    style={styles.guestInput}
                    placeholder="이름"
                    value={guestName}
                    onChangeText={setGuestName}
                    autoFocus
                  />
                  {/* 성별 */}
                  <Text style={styles.guestFieldLabel}>성별</Text>
                  <View style={styles.guestRadioRow}>
                    {(['남', '여'] as const).map((g) => (
                      <TouchableOpacity
                        key={g}
                        style={[styles.guestRadioBtn, guestGender === g && styles.guestRadioBtnActive]}
                        onPress={() => setGuestGender(g)}
                      >
                        <Text style={[styles.guestRadioText, guestGender === g && styles.guestRadioTextActive]}>
                          {g === '남' ? '남자' : '여자'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {/* 조 */}
                  <Text style={styles.guestFieldLabel}>조</Text>
                  <View style={styles.guestRadioRow}>
                    {(() => {
                      const groupSet = new Set(players.map(p => p.group));
                      groupSet.add('미배정');
                      return Array.from(groupSet).sort().map((g) => (
                        <TouchableOpacity
                          key={g}
                          style={[styles.guestRadioBtn, guestGroup === g && styles.guestRadioBtnActive]}
                          onPress={() => setGuestGroup(g)}
                        >
                          <Text style={[styles.guestRadioText, guestGroup === g && styles.guestRadioTextActive]}>{g}</Text>
                        </TouchableOpacity>
                      ));
                    })()}
                  </View>
                  {/* NTRP */}
                  <Text style={styles.guestFieldLabel}>NTRP</Text>
                  <TextInput
                    style={styles.guestInput}
                    placeholder="예: 3.5 (선택사항)"
                    value={guestNtrp}
                    onChangeText={setGuestNtrp}
                    keyboardType="decimal-pad"
                  />
                  <View style={styles.guestModalButtons}>
                    <Button
                      title="취소"
                      variant="outline"
                      onPress={() => setShowGuestModal(false)}
                      style={{ flex: 1, marginRight: 8 }}
                    />
                    <Button
                      title="추가"
                      onPress={handleAddGuest}
                      style={{ flex: 1 }}
                    />
                  </View>
                </View>
              </TouchableOpacity>
            </Modal>

            {/* 대진 설정 */}
            <Card title="⚙️ 대진 설정">
              {/* 게임 타입 */}
              <Text style={styles.optionLabel}>게임 타입</Text>
              <View style={styles.radioRow}>
                {GAME_TYPES.map((gt) => {
                  const isTeam = gt.includes('팀전');
                  const gameType = gt.includes('단식') ? '단식' : '복식';
                  const isActive = options.gameType === gameType && options.isTeamMode === isTeam;
                  return (
                    <TouchableOpacity
                      key={gt}
                      style={[styles.radioBtn, isActive && styles.radioBtnActive]}
                      onPress={() => {
                        const defaultMode = gameType === '단식' ? '동성 단식' : '랜덤복식';
                        setOptions({ gameType: gameType as '복식' | '단식', isTeamMode: isTeam, mode: defaultMode });
                        setManualGenderMode('성별랜덤');
                        setSameGenderSub(gameType === '단식' ? '동성단식' : '동성복식');
                      }}
                    >
                      <Text style={[styles.radioBtnText, isActive && styles.radioBtnTextActive]}>{gt}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* 대진 생성 방식 */}
              <Text style={[styles.optionLabel, { marginTop: 12 }]}>대진 생성 방식</Text>
              <View style={styles.radioRow}>
                <TouchableOpacity
                  style={[styles.radioBtn, !options.isManualMode && styles.radioBtnActive]}
                  onPress={() => setOptions({ isManualMode: false })}
                >
                  <Text style={[styles.radioBtnText, !options.isManualMode && styles.radioBtnTextActive]}>자동 생성</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.radioBtn, options.isManualMode && styles.radioBtnActive]}
                  onPress={() => setOptions({ isManualMode: true })}
                >
                  <Text style={[styles.radioBtnText, options.isManualMode && styles.radioBtnTextActive]}>직접 배정(수동)</Text>
                </TouchableOpacity>
              </View>

              {/* 팀 구성 (팀별 모드일 때) */}
              {options.isTeamMode && (
                <View style={styles.teamSection}>
                  <Text style={[styles.optionLabel, { marginTop: 12 }]}>팀 구성</Text>
                  <View style={styles.radioRow}>
                    {[2, 3, 4].map((n) => (
                      <TouchableOpacity
                        key={n}
                        style={[styles.radioBtn, teamCount === n && styles.radioBtnActive]}
                        onPress={() => setTeamCount(n)}
                      >
                        <Text style={[styles.radioBtnText, teamCount === n && styles.radioBtnTextActive]}>{n}팀</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {TEAM_NAMES.slice(0, teamCount).map((tName, tIdx) => {
                    const teamColor = customTeamColors[tName] || TEAM_COLORS[tName];
                    const displayName = customTeamNames[tName] || tName;
                    const teamMembers = Object.entries(teamAssignments)
                      .filter(([, t]) => t === tName)
                      .map(([name]) => name);
                    const COLOR_SWATCHES = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#1e293b'];
                    return (
                      <View key={tName} style={[styles.teamCard, { borderLeftColor: teamColor }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                          {editingTeamIdx === tIdx ? (
                            <TextInput
                              style={[styles.teamCardTitle, { color: teamColor, borderBottomWidth: 1, borderBottomColor: teamColor, minWidth: 80, padding: 0, margin: 0 }]}
                              value={editingTeamNameValue}
                              onChangeText={setEditingTeamNameValue}
                              autoFocus
                              onBlur={() => {
                                if (editingTeamNameValue.trim()) {
                                  setCustomTeamNames({ ...customTeamNames, [tName]: editingTeamNameValue.trim() });
                                }
                                setEditingTeamIdx(null);
                              }}
                              onSubmitEditing={() => {
                                if (editingTeamNameValue.trim()) {
                                  setCustomTeamNames({ ...customTeamNames, [tName]: editingTeamNameValue.trim() });
                                }
                                setEditingTeamIdx(null);
                              }}
                            />
                          ) : (
                            <TouchableOpacity onPress={() => { setEditingTeamIdx(tIdx); setEditingTeamNameValue(displayName); }}>
                              <Text style={[styles.teamCardTitle, { marginBottom: 0 }]}>
                                <Text style={{ color: teamColor }}>{displayName}</Text>
                                <Text style={{ color: colors.textTertiary, fontSize: 11 }}> ({teamMembers.length}명) </Text>
                                <FontAwesome name="pencil" size={11} color={colors.textTertiary} />
                              </Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            style={[styles.colorPickerBtn, { backgroundColor: teamColor }]}
                            onPress={() => setEditingColorIdx(editingColorIdx === tIdx ? null : tIdx)}
                          >
                            <FontAwesome name="paint-brush" size={10} color="#fff" />
                          </TouchableOpacity>
                        </View>
                        {editingColorIdx === tIdx && (
                          <View style={styles.colorSwatchRow}>
                            {COLOR_SWATCHES.map((c) => (
                              <TouchableOpacity
                                key={c}
                                style={[
                                  styles.colorSwatch,
                                  { backgroundColor: c },
                                  teamColor === c && styles.colorSwatchActive,
                                ]}
                                onPress={() => {
                                  setCustomTeamColors({ ...customTeamColors, [tName]: c });
                                  setEditingColorIdx(null);
                                }}
                              />
                            ))}
                          </View>
                        )}
                        <View style={styles.playerGrid}>
                          {selectedPlayers.map((pName) => {
                            const assigned = teamAssignments[pName] === tName;
                            return (
                              <TouchableOpacity
                                key={pName}
                                style={[
                                  styles.teamPlayerChip,
                                  assigned && { backgroundColor: teamColor, borderColor: teamColor },
                                ]}
                                onPress={() => {
                                  const newAssignments = { ...teamAssignments };
                                  if (assigned) {
                                    delete newAssignments[pName];
                                  } else {
                                    newAssignments[pName] = tName;
                                  }
                                  setTeamAssignments(newAssignments);
                                }}
                              >
                                <Text style={[
                                  styles.teamPlayerChipText,
                                  assigned && { color: '#fff' },
                                ]}>{dn(pName)}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })}

                  {/* 미배정 선수 */}
                  {(() => {
                    const unassigned = selectedPlayers.filter((p) => !teamAssignments[p]);
                    if (unassigned.length === 0) return null;
                    return (
                      <View style={[styles.teamCard, { borderLeftColor: colors.textTertiary }]}>
                        <Text style={[styles.teamCardTitle, { color: colors.textTertiary }]}>미배정 ({unassigned.length}명)</Text>
                        <View style={styles.orderList}>
                          {unassigned.map((name) => (
                            <View key={name} style={[styles.orderChip, { borderColor: colors.textTertiary }]}>
                              <Text style={styles.orderName}>{dn(name)}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    );
                  })()}
                </View>
              )}

              {/* 대진 방식 (자동 모드 + 팀 자동 모드) */}
              {!options.isManualMode && (
                <View style={{ marginTop: 12 }}>
                  <Select
                    label={options.gameType === '단식' ? '단식 대진 방식' : '복식 대진 방식'}
                    value={options.mode}
                    options={
                      options.gameType === '단식'
                        ? SINGLES_MODES.map(m => ({ label: m, value: m }))
                        : options.isTeamMode
                          ? modeOptions.filter(m => m.value !== '한울 AA' && m.value !== '수동 대진')
                          : modeOptions
                    }
                    onChange={(v) => setOptions({ mode: v as DoublesMode | SinglesMode })}
                  />
                </View>
              )}

              {/* 경기수 기준 + 코트 수 */}
              {(() => {
                const isAA = options.mode === '한울 AA' && options.gameType === '복식' && !options.isManualMode && !options.isTeamMode;
                const forceRounds = options.isManualMode;
                const effectiveMode = forceRounds ? 'totalRounds' : gameCountMode;
                const modeDisabled = isAA || forceRounds;

                const modeLabels: { key: typeof gameCountMode; label: string }[] = [
                  { key: 'totalRounds', label: '총라운드' },
                  { key: 'perPlayer', label: '인당게임' },
                  { key: 'totalGames', label: '총게임수' },
                ];

                return (
                  <>
                    <Text style={[styles.optionLabel, { marginTop: 12 }]}>경기수 기준</Text>
                    <View style={styles.radioRow}>
                      {modeLabels.map((m) => (
                        <TouchableOpacity
                          key={m.key}
                          style={[
                            styles.radioBtn,
                            effectiveMode === m.key && styles.radioBtnActive,
                            modeDisabled && styles.radioBtnDisabled,
                          ]}
                          onPress={() => !modeDisabled && setGameCountMode(m.key)}
                          disabled={modeDisabled}
                        >
                          <Text style={[
                            styles.radioBtnText,
                            effectiveMode === m.key && styles.radioBtnTextActive,
                            modeDisabled && { color: colors.textTertiary },
                          ]}>{m.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={styles.optionRow}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        {effectiveMode === 'totalRounds' && (
                          <Select
                            label="총 라운드 수"
                            value={isAA ? 4 : options.totalRounds}
                            options={Array.from({ length: 19 }, (_, i) => i + 2).map(n => ({ label: `${n}라운드`, value: n }))}
                            onChange={(v) => !isAA && setOptions({ totalRounds: v as number })}
                            disabled={isAA}
                          />
                        )}
                        {effectiveMode === 'perPlayer' && (
                          <Select
                            label="인당 경기수"
                            value={isAA ? 4 : options.maxGames}
                            options={gamesOptions}
                            onChange={(v) => !isAA && setOptions({ maxGames: v as number })}
                            disabled={isAA}
                          />
                        )}
                        {effectiveMode === 'totalGames' && (
                          <Select
                            label="총 게임 수"
                            value={isAA ? 8 : totalGamesValue}
                            options={Array.from({ length: 32 }, (_, i) => i + 1).map(n => ({ label: `${n}게임`, value: n }))}
                            onChange={(v) => !isAA && setTotalGamesValue(v as number)}
                            disabled={isAA}
                          />
                        )}
                      </View>
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Select
                          label="코트 수"
                          value={isAA ? 2 : options.courtCount}
                          options={courtOptions}
                          onChange={(v) => !isAA && setOptions({ courtCount: v as number })}
                          disabled={isAA}
                        />
                      </View>
                    </View>
                  </>
                );
              })()}

              <View style={styles.checkboxRow}>
                <Checkbox
                  checked={options.isManualMode ? false : options.useNtrp}
                  onPress={() => !options.isManualMode && setOptions({ useNtrp: !options.useNtrp })}
                  label="NTRP 균형 맞추기"
                  disabled={options.isManualMode}
                />
              </View>

              {clubSettings?.useGroups !== false &&
               !(clubSettings?.hideGroupFromMembers && !isAdmin) &&
               orderViewMode !== 'group' && (
                <View style={styles.checkboxRow}>
                  <Checkbox
                    checked={(options.isManualMode || options.isTeamMode) ? false : options.groupOnly}
                    onPress={() => !(options.isManualMode || options.isTeamMode) && setOptions({ groupOnly: !options.groupOnly })}
                    label="같은 조끼리만 대진 생성"
                    disabled={options.isManualMode || options.isTeamMode}
                  />
                </View>
              )}
            </Card>

            {/* 직접 배정(수동) 입력 */}
            {options.isManualMode && (
              <Card title="✏️ 직접 배정(수동) 입력">
                {/* 성별 옵션 */}
                <Text style={styles.optionLabel}>성별 옵션</Text>
                <View style={styles.radioRow}>
                  {GENDER_OPTIONS.map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[styles.radioBtn, manualGenderMode === g && styles.radioBtnActive]}
                      onPress={() => setManualGenderMode(g)}
                    >
                      <Text style={[styles.radioBtnText, manualGenderMode === g && styles.radioBtnTextActive]}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* 동성 서브옵션 */}
                {manualGenderMode === '동성' && (
                  <View style={[styles.radioRow, { marginTop: 4 }]}>
                    {SAME_GENDER_SUB.map((s) => {
                      const label = options.gameType === '단식' ? s.replace('복식', '단식') : s;
                      return (
                        <TouchableOpacity
                          key={s}
                          style={[styles.radioBtn, sameGenderSub === s && styles.radioBtnActive]}
                          onPress={() => setSameGenderSub(s)}
                        >
                          <Text style={[styles.radioBtnText, sameGenderSub === s && styles.radioBtnTextActive]}>{label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* NTRP 고려 체크박스 */}
                <View style={styles.checkboxRow}>
                  <Checkbox
                    checked={manualFillNtrp}
                    onPress={() => setManualFillNtrp(!manualFillNtrp)}
                    label="자동 채우기 시 NTRP 고려"
                  />
                </View>

                {/* 빈칸 채우기/초기화/선택 버튼 (전체 모드에서만 표시) */}
                {!(orderViewMode === 'group' && clubSettings?.useGroups !== false) && (<>
                <View style={styles.manualBtnRow}>
                  <Button title="전체 채우기" onPress={() => handleAutoFill(false)} variant="outline" size="small" style={{ flex: 1 }} />
                  <Button title="전체 초기화" onPress={() => handleClearManualSlots(false)} variant="outline" size="small" style={{ flex: 1, marginLeft: 6 }} />
                </View>
                <View style={[styles.manualBtnRow, { marginTop: 4 }]}>
                  <Button title="체크만 채우기" onPress={() => handleAutoFill(true)} variant="outline" size="small" style={{ flex: 1 }} />
                  <Button title="체크만 초기화" onPress={() => handleClearManualSlots(true)} variant="outline" size="small" style={{ flex: 1, marginLeft: 6 }} />
                </View>
                <View style={[styles.manualBtnRow, { marginTop: 4 }]}>
                  <Button title="전체 선택" onPress={() => handleCheckAll(true)} variant="outline" size="small" style={{ flex: 1 }} />
                  <Button title="전체 해제" onPress={() => handleCheckAll(false)} variant="outline" size="small" style={{ flex: 1, marginLeft: 6 }} />
                  <Text style={styles.checkedCountText}>{checkedCount}개 선택됨</Text>
                </View>
                </>)}

                {/* 게임별 수동 슬롯 */}
                {orderViewMode === 'group' && clubSettings?.useGroups !== false ? (
                  // 조별 수동 슬롯
                  Object.keys(groupManualSlots).sort((a, b) => {
                    if (a === '미배정') return 1;
                    if (b === '미배정') return -1;
                    return a.localeCompare(b, 'ko');
                  }).map((gName) => {
                    const gSlots = groupManualSlots[gName];
                    if (!gSlots || gSlots.length === 0) return null;
                    const gCourts = gSlots[0]?.length || 1;
                    let gGameOffset = 0;
                    return (
                      <View key={gName}>
                        <View style={[styles.groupDivider, { marginTop: spacing.md }]}>
                          <View style={styles.groupDividerLine} />
                          <Text style={styles.groupDividerText}>{gName} 직접 배정</Text>
                          <View style={styles.groupDividerLine} />
                        </View>
                        <View style={[styles.manualBtnRow, { marginTop: 4 }]}>
                          <Button title="채우기" onPress={() => handleGroupAutoFill(gName, false)} variant="outline" size="small" style={{ flex: 1 }} />
                          <Button title="초기화" onPress={() => handleGroupClearManualSlots(gName, false)} variant="outline" size="small" style={{ flex: 1, marginLeft: 6 }} />
                        </View>
                        {gSlots.map((round, roundIdx) => {
                          return (
                            <View key={roundIdx}>
                              <View style={styles.manualRoundHeader}>
                                <Text style={styles.manualRoundTitle}>{roundIdx + 1}라운드</Text>
                              </View>
                              {round.map((slot, courtIdx) => {
                                gGameOffset++;
                                const playersPerTeam = options.gameType === '단식' ? 1 : 2;
                                const usedInRound = new Set<string>();
                                for (let oc = 0; oc < round.length; oc++) {
                                  if (oc === courtIdx) continue;
                                  [...round[oc].team1, ...round[oc].team2].forEach(n => {
                                    if (n && n !== '선택') usedInRound.add(n);
                                  });
                                }
                                const orderedList = playerOrder.length > 0 ? playerOrder : selectedPlayers;
                                const groupPlayers = orderedList.filter(n => (rosterByName[n]?.group || '미배정') === gName);
                                const getOptionsFor = (teamIdx: number, slotIdx: number) => {
                                  const currentValue = teamIdx === 0 ? slot.team1[slotIdx] : slot.team2[slotIdx];
                                  const usedInSlot = new Set<string>();
                                  slot.team1.forEach((n, i) => { if (n && n !== '선택' && !(teamIdx === 0 && i === slotIdx)) usedInSlot.add(n); });
                                  slot.team2.forEach((n, i) => { if (n && n !== '선택' && !(teamIdx === 1 && i === slotIdx)) usedInSlot.add(n); });
                                  return [
                                    { label: '선택...', value: '' },
                                    ...groupPlayers
                                      .filter(n => n === currentValue || (!usedInRound.has(n) && !usedInSlot.has(n)))
                                      .map(n => {
                                        const player = rosterByName[n];
                                        const bgColor = player?.gender === '남' ? colors.male.bg : player?.gender === '여' ? colors.female.bg : undefined;
                                        return { label: dn(n), value: n, bgColor };
                                      }),
                                  ];
                                };
                                return (
                                  <View key={courtIdx} style={[styles.manualSlotCard, slot.checked && styles.manualSlotCardChecked]}>
                                    <View style={styles.manualSlotHeader}>
                                      <Checkbox
                                        checked={slot.checked || false}
                                        onPress={() => updateGroupManualSlot(gName, roundIdx, courtIdx, { checked: !slot.checked })}
                                      />
                                      <Text style={styles.manualSlotTitle}>게임 {gGameOffset} · 코트 {courtIdx + 1}</Text>
                                    </View>
                                    <View style={styles.manualSlotTeams}>
                                      <View style={styles.manualSlotTeam}>
                                        {Array.from({ length: playersPerTeam }).map((_, pi) => (
                                          <View key={`t1-${pi}`} style={styles.manualSlotSelect}>
                                            <Select
                                              value={slot.team1[pi] || ''}
                                              options={getOptionsFor(0, pi)}
                                              onChange={(v) => handleGroupManualSlotPlayerChange(gName, roundIdx, courtIdx, 0, pi, v === '' ? null : v as string)}
                                            />
                                          </View>
                                        ))}
                                      </View>
                                      <Text style={styles.manualVs}>vs</Text>
                                      <View style={styles.manualSlotTeam}>
                                        {Array.from({ length: playersPerTeam }).map((_, pi) => (
                                          <View key={`t2-${pi}`} style={styles.manualSlotSelect}>
                                            <Select
                                              value={slot.team2[pi] || ''}
                                              options={getOptionsFor(1, pi)}
                                              onChange={(v) => handleGroupManualSlotPlayerChange(gName, roundIdx, courtIdx, 1, pi, v === '' ? null : v as string)}
                                            />
                                          </View>
                                        ))}
                                      </View>
                                    </View>
                                  </View>
                                );
                              })}
                            </View>
                          );
                        })}
                      </View>
                    );
                  })
                ) : (
                  // 전체 수동 슬롯 (기존)
                  manualSlots.map((round, roundIdx) => (
                  <View key={roundIdx}>
                    <View style={styles.manualRoundHeader}>
                      <Text style={styles.manualRoundTitle}>{roundIdx + 1}라운드</Text>
                    </View>
                    {round.map((slot, courtIdx) => {
                      const gameNum = roundIdx * options.courtCount + courtIdx + 1;
                      const playersPerTeam = options.gameType === '단식' ? 1 : 2;

                      // 같은 라운드의 다른 코트에서 이미 배정된 선수 수집
                      const usedInRound = new Set<string>();
                      for (let oc = 0; oc < round.length; oc++) {
                        if (oc === courtIdx) continue;
                        const otherSlot = round[oc];
                        [...otherSlot.team1, ...otherSlot.team2].forEach(n => {
                          if (n && n !== '선택') usedInRound.add(n);
                        });
                      }

                      // 드롭다운 옵션 생성 함수: 같은 라운드 + 같은 슬롯 내 다른 자리 제외
                      const getOptionsFor = (teamIdx: number, slotIdx: number) => {
                        const currentValue = teamIdx === 0 ? slot.team1[slotIdx] : slot.team2[slotIdx];
                        const usedInSlot = new Set<string>();
                        // 같은 슬롯 내 다른 자리에 배정된 선수
                        slot.team1.forEach((n, i) => { if (n && n !== '선택' && !(teamIdx === 0 && i === slotIdx)) usedInSlot.add(n); });
                        slot.team2.forEach((n, i) => { if (n && n !== '선택' && !(teamIdx === 1 && i === slotIdx)) usedInSlot.add(n); });

                        return [
                          { label: '선택...', value: '' },
                          ...(playerOrder.length > 0 ? playerOrder : selectedPlayers)
                            .filter(n => n === currentValue || (!usedInRound.has(n) && !usedInSlot.has(n)))
                            .map(n => {
                              const player = rosterByName[n];
                              const bgColor = player?.gender === '남' ? colors.male.bg : player?.gender === '여' ? colors.female.bg : undefined;
                              return { label: dn(n), value: n, bgColor };
                            }),
                        ];
                      };

                      return (
                        <View key={courtIdx} style={[styles.manualSlotCard, slot.checked && styles.manualSlotCardChecked]}>
                          <View style={styles.manualSlotHeader}>
                            <Checkbox
                              checked={slot.checked || false}
                              onPress={() => updateManualSlot(roundIdx, courtIdx, { checked: !slot.checked })}
                            />
                            <Text style={styles.manualSlotTitle}>게임 {gameNum} · 코트 {courtIdx + 1}</Text>
                          </View>
                          <View style={styles.manualSlotTeams}>
                            <View style={styles.manualSlotTeam}>
                              {Array.from({ length: playersPerTeam }).map((_, pi) => (
                                <View key={`t1-${pi}`} style={styles.manualSlotSelect}>
                                  <Select
                                    value={slot.team1[pi] || ''}
                                    options={getOptionsFor(0, pi)}
                                    onChange={(v) => handleManualSlotPlayerChange(roundIdx, courtIdx, 0, pi, v === '' ? null : v as string)}
                                  />
                                </View>
                              ))}
                            </View>
                            <Text style={styles.manualVs}>vs</Text>
                            <View style={styles.manualSlotTeam}>
                              {Array.from({ length: playersPerTeam }).map((_, pi) => (
                                <View key={`t2-${pi}`} style={styles.manualSlotSelect}>
                                  <Select
                                    value={slot.team2[pi] || ''}
                                    options={getOptionsFor(1, pi)}
                                    onChange={(v) => handleManualSlotPlayerChange(roundIdx, courtIdx, 1, pi, v === '' ? null : v as string)}
                                  />
                                </View>
                              ))}
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ))
                )}
              </Card>
            )}

            {/* Generate Button */}
            <Button
              title="대진표 생성"
              onPress={handleGenerateScheduleNew}
              fullWidth
              size="large"
              style={{ marginTop: 8 }}
              disabled={!canCreateSchedule}
            />

            {/* 기존 대진표 존재 시 확인 UI */}
            {pendingSchedule && (
              <Card title="⚠️ 대진표가 이미 존재합니다" style={{ marginTop: 8, borderColor: colors.warning, borderWidth: 1 }}>
                <Text style={{ fontSize: 13, color: colors.text, marginBottom: 10 }}>
                  해당 날짜에 이미 저장된 대진표가 있습니다. 어떻게 하시겠습니까?
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button
                    title="기존에 추가"
                    onPress={handlePendingAppend}
                    size="small"
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="덮어쓰기"
                    onPress={handlePendingOverwrite}
                    variant="outline"
                    size="small"
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="취소"
                    onPress={() => setPendingSchedule(null)}
                    variant="outline"
                    size="small"
                    style={{ flex: 1 }}
                  />
                </View>
              </Card>
            )}

            {/* Generated Schedule Preview */}
            {schedule.length > 0 && (<>
              <View ref={previewCardRef}>
              {isSavingJpg && (
                <View style={styles.jpgWatermark}>
                  <Text style={styles.jpgWatermarkText}>{selectedDateStr}  {club?.name || ''} 대진표</Text>
                </View>
              )}
              <Card
                title={isSavingJpg ? undefined : `생성된 대진표 (${activeMatches.length}경기)`}
                style={isSavingJpg ? { marginTop: 0, paddingVertical: spacing.sm } : { marginTop: 16 }}
              >
                {sessionsLoading && (
                  <Text style={styles.loadingText}>통계 데이터 로딩중...</Text>
                )}
                {(() => {
                  const maxCourt = Math.max(...activeMatches.map(m => m.court || 1));
                  let activeIdx = -1;
                  let prevMatchGroup: string | null = null;

                  return schedule.map((match, index) => {
                    if (match.gameType === '삭제') return null;
                    activeIdx++;

                    // Calculate win probability with NTRP and historical data
                    const prob = calculateMatchProbability(allSessions, match.team1, match.team2, rosterByName);
                    const courtNum = match.court || 1;
                    const isNewRound = activeIdx > 0 && courtNum === 1;
                    const roundNum = Math.floor(activeIdx / maxCourt) + 1;

                    // 조별 대진 그룹 헤더 감지 (groupOnly일 때만)
                    const matchGroup = groupOnly && groupsSnapshot?.[match.team1[0]] || null;
                    const isNewGroup = matchGroup && matchGroup !== prevMatchGroup;
                    if (matchGroup) prevMatchGroup = matchGroup;

                    return (
                      <React.Fragment key={index}>
                        {isNewGroup && (
                          <View style={styles.groupDivider}>
                            <View style={styles.groupDividerLine} />
                            <Text style={styles.groupDividerText}>{matchGroup} 대진</Text>
                            <View style={styles.groupDividerLine} />
                          </View>
                        )}
                        {isNewRound && !isNewGroup && (
                          <View style={styles.roundDivider}>
                            <View style={styles.roundDividerLine} />
                            <Text style={styles.roundDividerText}>{roundNum}라운드</Text>
                            <View style={styles.roundDividerLine} />
                          </View>
                        )}
                        <View style={[styles.matchPreview, isSavingJpg && { paddingVertical: 4 }]}>
                          <View style={styles.matchHeaderCenter}>
                            <Text style={styles.matchNoCenter}>
                              {activeIdx + 1}번 경기 · 코트 {courtNum}
                            </Text>
                        {!isSavingJpg && (
                        <TouchableOpacity
                          style={styles.deleteMatchBtnAbs}
                          onPress={() => handleDeleteMatch(index)}
                        >
                          <FontAwesome name="times" size={14} color="#ef4444" />
                        </TouchableOpacity>
                        )}
                      </View>
                      <View style={styles.matchTeams}>
                        <View style={styles.teamNamesCol1}>
                          {match.team1.map((name, i) => {
                            const gender = rosterByName[name]?.gender;
                            const boxStyle = gender === '남' ? styles.matchNameMaleBox
                              : gender === '여' ? styles.matchNameFemaleBox
                              : styles.matchNameDefaultBox;
                            const textStyle = gender === '남' ? styles.matchNameMaleText
                              : gender === '여' ? styles.matchNameFemaleText
                              : styles.matchNameDefaultText;
                            const partner = match.team1.find(p => p !== name) || null;
                            return (
                              <View key={i} style={styles.playerNameRow}>
                                {!isSavingJpg && (
                                <TouchableOpacity
                                  style={styles.recordBtn}
                                  onPress={() => setRecordModal({
                                    visible: true,
                                    player: name,
                                    partner,
                                    opponents: match.team2,
                                  })}
                                >
                                  <FontAwesome name="bar-chart" size={10} color={colors.accent} />
                                </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                  onPress={() => router.push(`/(tabs)/records?player=${encodeURIComponent(name)}`)}
                                >
                                  <View style={boxStyle}>
                                    <Text style={textStyle}>{dn(name)}</Text>
                                  </View>
                                </TouchableOpacity>
                              </View>
                            );
                          })}
                        </View>
                        <View style={styles.vsContainer}>
                          {showProb && !isFeatureDisabled('disableWinProbability') && !(isSavingJpg && !showProbInJpg) && (
                          <Text style={[
                            styles.probText,
                            prob?.hasEnoughData && prob.team1WinRate != null && prob.team1WinRate > 0.5 && styles.probTextHigh
                          ]}>
                            {prob?.hasEnoughData && prob.team1WinRate !== null
                              ? `${Math.max(10, Math.round(prob.team1WinRate * 100))}%`
                              : ''}
                          </Text>
                          )}
                          <Text style={styles.vsText}>vs</Text>
                          {showProb && !isFeatureDisabled('disableWinProbability') && !(isSavingJpg && !showProbInJpg) && (
                          <Text style={[
                            styles.probText,
                            prob?.hasEnoughData && prob.team2WinRate != null && prob.team2WinRate > 0.5 && styles.probTextHigh
                          ]}>
                            {prob?.hasEnoughData && prob.team2WinRate !== null
                              ? `${Math.max(10, Math.round(prob.team2WinRate * 100))}%`
                              : ''}
                          </Text>
                          )}
                        </View>
                        <View style={styles.teamNamesCol2}>
                          {match.team2.map((name, i) => {
                            const gender = rosterByName[name]?.gender;
                            const boxStyle = gender === '남' ? styles.matchNameMaleBox
                              : gender === '여' ? styles.matchNameFemaleBox
                              : styles.matchNameDefaultBox;
                            const textStyle = gender === '남' ? styles.matchNameMaleText
                              : gender === '여' ? styles.matchNameFemaleText
                              : styles.matchNameDefaultText;
                            const partner = match.team2.find(p => p !== name) || null;
                            return (
                              <View key={i} style={styles.playerNameRow}>
                                <TouchableOpacity
                                  onPress={() => router.push(`/(tabs)/records?player=${encodeURIComponent(name)}`)}
                                >
                                  <View style={boxStyle}>
                                    <Text style={textStyle}>{dn(name)}</Text>
                                  </View>
                                </TouchableOpacity>
                                {!isSavingJpg && (
                                <TouchableOpacity
                                  style={styles.recordBtn}
                                  onPress={() => setRecordModal({
                                    visible: true,
                                    player: name,
                                    partner,
                                    opponents: match.team1,
                                  })}
                                >
                                  <FontAwesome name="bar-chart" size={10} color={colors.accent} />
                                </TouchableOpacity>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    </View>
                    </React.Fragment>
                  );
                });
              })()}

                {/* 인당 경기수 */}
                {(() => {
                  const gameCounts: Record<string, number> = {};
                  for (const m of activeMatches) {
                    for (const name of [...m.team1, ...m.team2]) {
                      gameCounts[name] = (gameCounts[name] || 0) + 1;
                    }
                  }
                  const orderedPlayers = playerOrder.length > 0 ? playerOrder : selectedPlayers;
                  const byCount: Record<number, string[]> = {};
                  for (const p of orderedPlayers) {
                    const c = gameCounts[p] || 0;
                    if (!byCount[c]) byCount[c] = [];
                    byCount[c].push(p);
                  }
                  const counts = Object.values(gameCounts);
                  const maxC = counts.length > 0 ? Math.max(...counts) : 0;
                  const minC = counts.length > 0 ? Math.min(...counts) : 0;
                  const diff = maxC - minC;

                  if (isSavingJpg) return null;
                  return (
                    <View style={styles.gameCountSection}>
                      <Text style={styles.gameCountTitle}>인당 경기수</Text>
                      {diff > 1 && (
                        <Text style={styles.gameCountWarning}>
                          ⚠ 인당 경기수 차이가 {diff}게임입니다. (인원/성별/옵션 제약으로 공평하게 맞추기 어려울 수 있어요)
                        </Text>
                      )}
                      {Object.keys(byCount).sort((a, b) => Number(a) - Number(b)).map((cnt) => (
                        <View key={cnt} style={styles.gameCountRow}>
                          <Text style={styles.gameCountNum}>{cnt}게임 :</Text>
                          <View style={styles.gameCountNames}>
                            {byCount[Number(cnt)].map((name) => {
                              const p = rosterByName[name];
                              const isMale = p?.gender === '남';
                              const isFemale = p?.gender === '여';
                              return (
                                <View
                                  key={name}
                                  style={[
                                    styles.gameCountBadge,
                                    isMale && { backgroundColor: colors.male.bg },
                                    isFemale && { backgroundColor: colors.female.bg },
                                  ]}
                                >
                                  <Text style={styles.gameCountBadgeText}>{dn(name)}</Text>
                                </View>
                              );
                            })}
                          </View>
                        </View>
                      ))}
                    </View>
                  );
                })()}

                {!isSavingJpg && (
                <Button
                  title="대진표 저장"
                  onPress={handleSaveSchedule}
                  loading={isSaving}
                  fullWidth
                  style={{ marginTop: 12 }}
                />
                )}
              </Card>
              </View>
              <View style={styles.saveRow}>
                {!isFeatureDisabled('disableJpgCapture') && (
                <TouchableOpacity style={styles.saveJpgBtn} onPress={() => saveAsJpg(previewCardRef, `대진표_${selectedDateStr}`)}>
                  <FontAwesome name="camera" size={12} color={colors.textSecondary} />
                  <Text style={styles.saveJpgText}>JPG 저장</Text>
                </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.saveJpgBtn} onPress={copyScheduleAsText}>
                  <FontAwesome name="copy" size={12} color={colors.textSecondary} />
                  <Text style={styles.saveJpgText}>텍스트 복사</Text>
                </TouchableOpacity>
              </View>
            </>)}
          </>
        ) : isFeatureDisabled('disableReservation') ? (
          <View style={{ padding: 32, alignItems: 'center' }}>
            <FontAwesome name="lock" size={32} color={colors.textTertiary} />
            <Text style={{ color: colors.textTertiary, marginTop: 8, fontSize: 13 }}>코트 예약 기능은 현재 등급에서 사용할 수 없습니다</Text>
          </View>
        ) : (
          <>
            {/* ── 코트 예약 달력 ── */}
            {/* 월 네비게이션 */}
            <View style={rs.navRow}>
              <TouchableOpacity style={rs.navBtn} onPress={() => {
                if (calMonth === 1) { setCalMonth(12); setCalYear(calYear - 1); }
                else setCalMonth(calMonth - 1);
              }}>
                <FontAwesome name="chevron-left" size={14} color={colors.black} />
              </TouchableOpacity>
              <View style={rs.navDisplay}>
                <FontAwesome name="calendar" size={14} color={colors.black} style={{ marginRight: 8 }} />
                <Text style={rs.navTitle}>{calYear}년 {calMonth}월</Text>
              </View>
              <TouchableOpacity style={rs.navBtn} onPress={() => {
                if (calMonth === 12) { setCalMonth(1); setCalYear(calYear + 1); }
                else setCalMonth(calMonth + 1);
              }}>
                <FontAwesome name="chevron-right" size={14} color={colors.black} />
              </TouchableOpacity>
            </View>

            {/* 액션 버튼 */}
            <View style={rs.actionRow}>
              <TouchableOpacity style={rs.actionBtn} onPress={copyResText}>
                <FontAwesome name="copy" size={12} color={colors.textSecondary} />
                <Text style={rs.actionBtnText}>텍스트 복사</Text>
              </TouchableOpacity>
            </View>

            {/* 요일 헤더 */}
            <Card style={{ padding: spacing.sm }}>
              <View style={rs.calGrid}>
                {['일','월','화','수','목','금','토'].map((day, i) => (
                  <View key={day} style={rs.dayLabel}>
                    <Text style={[rs.dayLabelText, i === 0 && { color: '#e53935' }, i === 6 && { color: '#1e88e5' }]}>{day}</Text>
                  </View>
                ))}

                {/* 빈 셀 (첫째 날 앞) */}
                {Array.from({ length: new Date(calYear, calMonth - 1, 1).getDay() }).map((_, i) => (
                  <View key={`empty-${i}`} style={rs.dayCell} />
                ))}

                {/* 날짜 셀 */}
                {Array.from({ length: new Date(calYear, calMonth, 0).getDate() }).map((_, idx) => {
                  const d = idx + 1;
                  const dateKey = `${calYear}-${calMonth}-${d}`;
                  const holidays = getHolidays(calYear);
                  const holidayName = holidays[`${calMonth}-${d}`];
                  const anni = resAnni[dateKey];
                  const dateObj = new Date(calYear, calMonth - 1, d);
                  const isSun = dateObj.getDay() === 0;
                  const isSat = dateObj.getDay() === 6;
                  const isSpecial = anni?.special || false;

                  return (
                    <View key={d} style={[rs.dayCell, isSpecial && rs.dayCellSpecial]}>
                      {/* 날짜 헤더 */}
                      <View style={rs.dateHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
                          <TouchableOpacity onPress={() => {
                            if (!isAdmin) return;
                            setResInputAnni(anni?.name || '');
                            setResInputSpecial(anni?.special || false);
                            setResModal({ visible: true, mode: 'anni', key: dateKey, customIndex: -1 });
                          }}>
                            <Text style={[rs.dateNum, (isSun || holidayName) && { color: '#e53935' }, isSat && !holidayName && { color: '#1e88e5' }]}>
                              {d}
                            </Text>
                          </TouchableOpacity>
                          {holidayName && <Text style={rs.holidayName}>({holidayName})</Text>}
                          {anni?.name ? <Text style={rs.anniName}>{anni.name}</Text> : null}
                        </View>
                      </View>

                      {/* 일정 항목 */}
                      <View>
                        {(resData[dateKey] || []).map((item, ci) => {
                          const isClosed = item.closed || false;
                          return (
                            <TouchableOpacity
                              key={ci}
                              style={[rs.customEntry, { backgroundColor: isClosed ? '#b0b0b0' : item.target === '여' ? '#f48fb1' : item.target === '남' ? '#90caf9' : item.target === '남녀' ? '#b39ddb' : colors.primary }]}
                              onPress={() => {
                                setResModal({ visible: true, mode: 'detail', key: dateKey, customIndex: ci });
                              }}
                            >
                              <View style={rs.customEntryHeader}>
                                <Text style={rs.customTimeText}>{item.time}</Text>
                                {item.target && item.target !== '무관' && (
                                  <View style={rs.genderBadge}>
                                    {(item.target === '남' || item.target === '남녀') && <Text style={[rs.genderBadgeText, { color: '#1565c0' }]}>♂</Text>}
                                    {(item.target === '여' || item.target === '남녀') && <Text style={[rs.genderBadgeText, { color: '#c62828' }]}>♀</Text>}
                                  </View>
                                )}
                                {isClosed && <Text style={rs.closedBadgeSmall}>마감</Text>}
                              </View>
                              <Text style={rs.customInfoText}>{item.place}</Text>
                            </TouchableOpacity>
                          );
                        })}
                        {(isAdmin || !entryDisabled) && (
                          <TouchableOpacity
                            style={rs.customAddBtn}
                            onPress={() => {
                              setResInputTimeStart(''); setResInputTimeEnd('');
                              setResInputPlace(''); setResInputCourt(''); setResInputFee('');
                              setResInputTargetM(false); setResInputTargetF(false);
                              setResInputTargetMC(''); setResInputTargetFC('');
                              setResInputNtrpMin(''); setResInputNtrpMax('');
                              setResInputMemo(''); setResDropOpen('');
                              setResModal({ visible: true, mode: 'edit', key: dateKey, customIndex: -1 });
                            }}
                          >
                            <Text style={rs.customAddBtnText}>+ 추가</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </Card>

            {/* 예약 모달 */}
            <Modal visible={resModal.visible} transparent animationType="fade" onRequestClose={() => setResModal({ ...resModal, visible: false })}>
              <View style={rs.modalOverlay}>
                <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setResModal({ ...resModal, visible: false })} />
                <View style={rs.modalBox}>
                  {/* 일정 편집 모달 (관리자) */}
                  {resModal.mode === 'edit' && (
                    <>
                      <Text style={rs.modalTitle}>일정 입력</Text>
                      {/* 시간 드롭다운 */}
                      <Text style={rs.modalLabel}>시간</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
                        <TouchableOpacity style={rs.dropdownBtn} onPress={() => setResDropOpen(resDropOpen === 'timeStart' ? '' : 'timeStart')}>
                          <Text style={rs.dropdownBtnText}>{resInputTimeStart || '시작'}</Text>
                          <FontAwesome name="caret-down" size={12} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <Text style={{ fontWeight: '700', color: colors.text }}>시 ~</Text>
                        <TouchableOpacity style={rs.dropdownBtn} onPress={() => setResDropOpen(resDropOpen === 'timeEnd' ? '' : 'timeEnd')}>
                          <Text style={rs.dropdownBtnText}>{resInputTimeEnd || '종료'}</Text>
                          <FontAwesome name="caret-down" size={12} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <Text style={{ fontWeight: '700', color: colors.text }}>시</Text>
                      </View>
                      {(resDropOpen === 'timeStart' || resDropOpen === 'timeEnd') && (
                        <View style={rs.dropdownGrid}>
                          {RES_HOURS.map(h => (
                            <TouchableOpacity key={h} style={[rs.dropdownItem, (resDropOpen === 'timeStart' ? resInputTimeStart : resInputTimeEnd) === h && rs.dropdownItemActive]}
                              onPress={() => {
                                if (resDropOpen === 'timeStart') { setResInputTimeStart(h); }
                                else { setResInputTimeEnd(h); }
                                setResDropOpen('');
                              }}>
                              <Text style={[rs.dropdownItemText, (resDropOpen === 'timeStart' ? resInputTimeStart : resInputTimeEnd) === h && rs.dropdownItemTextActive]}>{h}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}

                      <TextInput style={rs.modalInput} value={resInputPlace} onChangeText={setResInputPlace} placeholder="장소" />
                      <TextInput style={rs.modalInput} value={resInputCourt} onChangeText={setResInputCourt} placeholder="코트/번호" />
                      <TextInput style={rs.modalInput} value={resInputFee} onChangeText={setResInputFee} placeholder="참가비 (선택)" keyboardType="numeric" />

                      {/* 대상 (체크박스 + 인원수 + 무관) */}
                      <Text style={rs.modalLabel}>대상</Text>
                      <View style={[rs.targetRow, { flexWrap: 'wrap' }]}>
                        <TouchableOpacity style={[rs.targetBtn, resInputTargetM && rs.targetBtnActive]} onPress={() => { setResInputTargetM(!resInputTargetM); if (resInputTargetM) setResInputTargetMC(''); }}>
                          <FontAwesome name={resInputTargetM ? 'check-square' : 'square-o'} size={14} color={resInputTargetM ? '#fff' : colors.text} />
                          <Text style={[rs.targetBtnText, resInputTargetM && rs.targetBtnTextActive]}> ♂ 남자</Text>
                        </TouchableOpacity>
                        {resInputTargetM && (
                          <View style={rs.targetCountWrap}>
                            <TextInput style={rs.targetCountInput} value={resInputTargetMC} onChangeText={setResInputTargetMC} placeholder="0" keyboardType="numeric" maxLength={2} />
                            <Text style={rs.targetCountText}>명</Text>
                          </View>
                        )}
                        <TouchableOpacity style={[rs.targetBtn, resInputTargetF && rs.targetBtnActive]} onPress={() => { setResInputTargetF(!resInputTargetF); if (resInputTargetF) setResInputTargetFC(''); }}>
                          <FontAwesome name={resInputTargetF ? 'check-square' : 'square-o'} size={14} color={resInputTargetF ? '#fff' : colors.text} />
                          <Text style={[rs.targetBtnText, resInputTargetF && rs.targetBtnTextActive]}> ♀ 여자</Text>
                        </TouchableOpacity>
                        {resInputTargetF && (
                          <View style={rs.targetCountWrap}>
                            <TextInput style={rs.targetCountInput} value={resInputTargetFC} onChangeText={setResInputTargetFC} placeholder="0" keyboardType="numeric" maxLength={2} />
                            <Text style={rs.targetCountText}>명</Text>
                          </View>
                        )}
                        <TouchableOpacity style={[rs.targetBtn, { flex: 0, paddingHorizontal: 12 }, !resInputTargetM && !resInputTargetF && rs.targetBtnActive]}
                          onPress={() => { setResInputTargetM(false); setResInputTargetF(false); setResInputTargetMC(''); setResInputTargetFC(''); }}>
                          <Text style={[rs.targetBtnText, !resInputTargetM && !resInputTargetF && rs.targetBtnTextActive]}>무관</Text>
                        </TouchableOpacity>
                      </View>

                      {/* NTRP 드롭다운 */}
                      <Text style={rs.modalLabel}>NTRP</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                        <TouchableOpacity style={rs.dropdownBtn} onPress={() => setResDropOpen(resDropOpen === 'ntrpMin' ? '' : 'ntrpMin')}>
                          <Text style={rs.dropdownBtnText}>{resInputNtrpMin || '하한'}</Text>
                          <FontAwesome name="caret-down" size={12} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <Text style={{ fontWeight: '700', color: colors.text }}>~</Text>
                        <TouchableOpacity style={rs.dropdownBtn} onPress={() => setResDropOpen(resDropOpen === 'ntrpMax' ? '' : 'ntrpMax')}>
                          <Text style={rs.dropdownBtnText}>{resInputNtrpMax || '상한'}</Text>
                          <FontAwesome name="caret-down" size={12} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[rs.targetBtn, { flex: 0, paddingHorizontal: 12 }, !resInputNtrpMin && !resInputNtrpMax && rs.targetBtnActive]}
                          onPress={() => { setResInputNtrpMin(''); setResInputNtrpMax(''); setResDropOpen(''); }}>
                          <Text style={[rs.targetBtnText, !resInputNtrpMin && !resInputNtrpMax && rs.targetBtnTextActive]}>무관</Text>
                        </TouchableOpacity>
                      </View>
                      {(resDropOpen === 'ntrpMin' || resDropOpen === 'ntrpMax') && (
                        <View style={rs.dropdownGrid}>
                          {RES_NTRP.filter(v => {
                            if (resDropOpen === 'ntrpMax' && resInputNtrpMin) return parseFloat(v) >= parseFloat(resInputNtrpMin);
                            return true;
                          }).map(v => (
                              <TouchableOpacity key={v}
                                style={[rs.dropdownItem, (resDropOpen === 'ntrpMin' ? resInputNtrpMin : resInputNtrpMax) === v && rs.dropdownItemActive]}
                                onPress={() => {
                                  if (resDropOpen === 'ntrpMin') {
                                    setResInputNtrpMin(v);
                                    if (resInputNtrpMax && parseFloat(v) > parseFloat(resInputNtrpMax)) setResInputNtrpMax(v);
                                  } else { setResInputNtrpMax(v); }
                                  setResDropOpen('');
                                }}>
                                <Text style={[rs.dropdownItemText, (resDropOpen === 'ntrpMin' ? resInputNtrpMin : resInputNtrpMax) === v && rs.dropdownItemTextActive]}>{v}</Text>
                              </TouchableOpacity>
                          ))}
                        </View>
                      )}

                      {/* 메모 */}
                      <Text style={rs.modalLabel}>메모</Text>
                      <TextInput style={[rs.modalInput, { height: 60, textAlignVertical: 'top' }]} value={resInputMemo} onChangeText={setResInputMemo} placeholder="메모 (선택사항)" multiline />

                      <View style={[rs.modalBtnRow, { marginTop: 12 }]}>
                        <TouchableOpacity style={[rs.modalBtn, { backgroundColor: colors.info }]} onPress={() => {
                          const dateKey = resModal.key;
                          const next = { ...resData };
                          const existing = resModal.customIndex >= 0 && next[dateKey]?.[resModal.customIndex];
                          const target: TargetGender = resInputTargetM && resInputTargetF ? '남녀' : resInputTargetM ? '남' : resInputTargetF ? '여' : '무관';
                          const ntrpStr = resInputNtrpMin && resInputNtrpMax ? `${resInputNtrpMin}~${resInputNtrpMax}` : resInputNtrpMin || resInputNtrpMax || '';
                          const newItem: CustomEntry = {
                            time: (resInputTimeStart && resInputTimeEnd) ? `${resInputTimeStart}시~${resInputTimeEnd}시` : resInputTimeStart ? `${resInputTimeStart}시` : '',
                            place: resInputPlace.trim(),
                            court: resInputCourt.trim(),
                            fee: resInputFee.trim() || undefined,
                            target,
                            targetMaleCount: resInputTargetM && resInputTargetMC ? Number(resInputTargetMC) : undefined,
                            targetFemaleCount: resInputTargetF && resInputTargetFC ? Number(resInputTargetFC) : undefined,
                            ntrp: ntrpStr || '무관',
                            memo: resInputMemo.trim() || undefined,
                            participants: existing ? (existing as CustomEntry).participants || [] : [],
                          };
                          const arr = next[dateKey] ? [...next[dateKey]] : [];
                          if (resModal.customIndex >= 0) arr[resModal.customIndex] = newItem;
                          else arr.push(newItem);
                          next[dateKey] = arr;
                          setResData(next);
                          saveResData(next, undefined);
                          setResModal({ ...resModal, visible: false });
                        }}>
                          <Text style={rs.modalBtnText}>저장</Text>
                        </TouchableOpacity>
                        {resModal.customIndex >= 0 && (
                          <TouchableOpacity style={[rs.modalBtn, { backgroundColor: colors.error }]} onPress={() => {
                            const dateKey = resModal.key;
                            const next = { ...resData };
                            const arr = next[dateKey] ? [...next[dateKey]] : [];
                            arr.splice(resModal.customIndex, 1);
                            if (arr.length === 0) delete next[dateKey];
                            else next[dateKey] = arr;
                            setResData(next);
                            saveResData(next, undefined);
                            setResModal({ ...resModal, visible: false });
                          }}>
                            <Text style={rs.modalBtnText}>삭제</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity style={[rs.modalBtn, { backgroundColor: colors.textTertiary }]} onPress={() => setResModal({ ...resModal, visible: false })}>
                          <Text style={rs.modalBtnText}>취소</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}

                  {/* 상세 보기 모달 (모든 사용자) */}
                  {resModal.mode === 'detail' && (() => {
                    const item = resData[resModal.key]?.[resModal.customIndex];
                    if (!item) return null;
                    const participants = item.participants || [];
                    const amIJoined = resMyName ? participants.includes(resMyName) : false;
                    const isClosed = item.closed || false;
                    const genderLabel = item.target === '남' ? '♂ 남' : item.target === '여' ? '♀ 여' : item.target === '남녀' ? '♂ 남 / ♀ 여' : '무관';
                    return (
                      <>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                          <Text style={rs.modalTitle}>일정 상세</Text>
                          {isClosed && <View style={rs.closedTag}><Text style={rs.closedTagText}>모집마감</Text></View>}
                        </View>
                        <View style={rs.detailRow}><Text style={rs.detailLabel}>시간</Text><Text style={rs.detailValue}>{item.time}</Text></View>
                        <View style={rs.detailRow}><Text style={rs.detailLabel}>장소</Text><Text style={rs.detailValue}>{item.place}</Text></View>
                        <View style={rs.detailRow}><Text style={rs.detailLabel}>코트</Text><Text style={rs.detailValue}>{item.court}</Text></View>
                        {item.fee ? <View style={rs.detailRow}><Text style={rs.detailLabel}>참가비</Text><Text style={rs.detailValue}>{Number(item.fee).toLocaleString()}원</Text></View> : null}
                        <View style={rs.detailRow}><Text style={rs.detailLabel}>대상</Text><Text style={rs.detailValue}>{genderLabel}{item.targetMaleCount ? ` (남${item.targetMaleCount}명)` : ''}{item.targetFemaleCount ? ` (여${item.targetFemaleCount}명)` : ''}</Text></View>
                        <View style={rs.detailRow}><Text style={rs.detailLabel}>NTRP</Text><Text style={rs.detailValue}>{item.ntrp || '무관'}</Text></View>
                        {item.memo ? <View style={[rs.detailRow, { alignItems: 'flex-start' }]}><Text style={rs.detailLabel}>메모</Text><Text style={[rs.detailValue, { flex: 1 }]}>{item.memo}</Text></View> : null}
                        <View style={[rs.detailRow, { alignItems: 'flex-start' }]}>
                          <Text style={rs.detailLabel}>참가 ({participants.length})</Text>
                          <Text style={[rs.detailValue, { flex: 1 }]}>{participants.length > 0 ? participants.join(', ') : '없음'}</Text>
                        </View>

                        {/* 참가/취소 버튼 */}
                        {resMyName && !isClosed && (
                          <TouchableOpacity
                            style={[rs.joinBtn, amIJoined && rs.joinBtnLeave]}
                            onPress={() => {
                              const dateKey = resModal.key;
                              const next = { ...resData };
                              const arr = next[dateKey] ? [...next[dateKey]] : [];
                              const entry = { ...arr[resModal.customIndex] };
                              const pList = [...(entry.participants || [])];
                              if (amIJoined) {
                                entry.participants = pList.filter(n => n !== resMyName);
                              } else {
                                pList.push(resMyName!);
                                entry.participants = pList;
                              }
                              arr[resModal.customIndex] = entry;
                              next[dateKey] = arr;
                              setResData(next);
                              saveResData(next, undefined);
                            }}
                          >
                            <FontAwesome name={amIJoined ? 'times-circle' : 'check-circle'} size={16} color="#fff" />
                            <Text style={rs.joinBtnText}>{amIJoined ? '참가 취소' : '참가'}</Text>
                          </TouchableOpacity>
                        )}

                        {/* 알림 설정 버튼 */}
                        <TouchableOpacity
                          style={rs.alarmBtn}
                          onPress={async () => {
                            const timeMatch = item.time.match(/(\d+)시/);
                            if (!timeMatch) {
                              if (Platform.OS === 'web') alert('시간 정보를 읽을 수 없습니다.');
                              else Alert.alert('알림', '시간 정보를 읽을 수 없습니다.');
                              return;
                            }
                            const hour = parseInt(timeMatch[1], 10);
                            const [y, mo, d] = resModal.key.split('-').map(Number);
                            const triggerDate = new Date(y, mo - 1, d, hour - 1, 0, 0);
                            if (triggerDate.getTime() <= Date.now()) {
                              if (Platform.OS === 'web') alert('이미 지난 시간입니다.');
                              else Alert.alert('알림', '이미 지난 시간입니다.');
                              return;
                            }
                            if (Platform.OS === 'web') {
                              alert(`${mo}/${d} ${hour - 1}:00 알림은 모바일 앱에서만 지원됩니다.`);
                              return;
                            }
                            const { status } = await Notifications.requestPermissionsAsync();
                            if (status !== 'granted') {
                              Alert.alert('알림', '알림 권한이 필요합니다. 설정에서 허용해주세요.');
                              return;
                            }
                            await Notifications.scheduleNotificationAsync({
                              content: {
                                title: '테니스 일정 알림',
                                body: `${item.place} ${item.time} 일정이 1시간 후 시작됩니다.`,
                                sound: true,
                              },
                              trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
                            });
                            Alert.alert('알림 설정', `${mo}/${d} ${hour - 1}:00에 알림이 울립니다.`);
                          }}
                        >
                          <FontAwesome name="bell" size={14} color="#fff" />
                          <Text style={rs.alarmBtnText}>1시간 전 알림</Text>
                        </TouchableOpacity>

                        <View style={[rs.modalBtnRow, { marginTop: 12 }]}>
                          {(isAdmin || !entryDisabled) && (
                            <TouchableOpacity
                              style={[rs.modalBtn, { backgroundColor: isClosed ? colors.success : colors.error }]}
                              onPress={() => {
                                const dateKey = resModal.key;
                                const next = { ...resData };
                                const arr = next[dateKey] ? [...next[dateKey]] : [];
                                const entry = { ...arr[resModal.customIndex] };
                                entry.closed = !isClosed;
                                arr[resModal.customIndex] = entry;
                                next[dateKey] = arr;
                                setResData(next);
                                saveResData(next, undefined);
                                setResModal({ ...resModal, visible: false });
                              }}
                            >
                              <Text style={rs.modalBtnText}>{isClosed ? '모집재개' : '모집마감'}</Text>
                            </TouchableOpacity>
                          )}
                          {(isAdmin || !entryDisabled) && (
                            <TouchableOpacity style={[rs.modalBtn, { backgroundColor: colors.warning }]} onPress={() => {
                              const timeMatch = item.time.match(/(\d+)시~(\d+)시/);
                              setResInputTimeStart(timeMatch ? timeMatch[1].padStart(2, '0') : '');
                              setResInputTimeEnd(timeMatch ? timeMatch[2].padStart(2, '0') : '');
                              setResInputPlace(item.place);
                              setResInputCourt(item.court);
                              setResInputFee(item.fee || '');
                              const t = item.target || '무관';
                              setResInputTargetM(t === '남' || t === '남녀');
                              setResInputTargetF(t === '여' || t === '남녀');
                              setResInputTargetMC(item.targetMaleCount ? String(item.targetMaleCount) : '');
                              setResInputTargetFC(item.targetFemaleCount ? String(item.targetFemaleCount) : '');
                              const ntrpVal = item.ntrp === '무관' ? '' : (item.ntrp || '');
                              const ntrpMatch = ntrpVal.match(/^([\d.]+)~([\d.]+)$/);
                              setResInputNtrpMin(ntrpMatch ? ntrpMatch[1] : ntrpVal);
                              setResInputNtrpMax(ntrpMatch ? ntrpMatch[2] : '');
                              setResInputMemo(item.memo || '');
                              setResDropOpen('');
                              setResModal({ ...resModal, mode: 'edit' });
                            }}>
                              <Text style={rs.modalBtnText}>수정</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity style={[rs.modalBtn, { backgroundColor: colors.textTertiary }]} onPress={() => setResModal({ ...resModal, visible: false })}>
                            <Text style={rs.modalBtnText}>닫기</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    );
                  })()}

                  {/* 기념일 모달 */}
                  {resModal.mode === 'anni' && (
                    <>
                      <Text style={rs.modalTitle}>기념일 / 강조 설정</Text>
                      <TextInput style={rs.modalInput} value={resInputAnni} onChangeText={setResInputAnni} placeholder="행사 내용" />
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}
                        onPress={() => setResInputSpecial(!resInputSpecial)}
                      >
                        <FontAwesome name={resInputSpecial ? 'check-square' : 'square-o'} size={20} color="#d35400" />
                        <Text style={{ fontWeight: '700', color: '#d35400' }}>특별한 날 강조</Text>
                      </TouchableOpacity>
                      <View style={rs.modalBtnRow}>
                        <TouchableOpacity style={[rs.modalBtn, { backgroundColor: colors.info }]} onPress={() => {
                          const next = { ...resAnni };
                          if (resInputAnni.trim() || resInputSpecial) {
                            next[resModal.key] = { name: resInputAnni.trim(), special: resInputSpecial };
                          } else {
                            delete next[resModal.key];
                          }
                          setResAnni(next);
                          saveResData(undefined, next);
                          setResModal({ ...resModal, visible: false });
                        }}>
                          <Text style={rs.modalBtnText}>저장</Text>
                        </TouchableOpacity>
                        {resAnni[resModal.key] && (
                          <TouchableOpacity style={[rs.modalBtn, { backgroundColor: colors.error }]} onPress={() => {
                            const next = { ...resAnni };
                            delete next[resModal.key];
                            setResAnni(next);
                            saveResData(undefined, next);
                            setResModal({ ...resModal, visible: false });
                          }}>
                            <Text style={rs.modalBtnText}>삭제</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity style={[rs.modalBtn, { backgroundColor: colors.textTertiary }]} onPress={() => setResModal({ ...resModal, visible: false })}>
                          <Text style={rs.modalBtnText}>취소</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              </View>
            </Modal>
          </>
        )}
        <Footer />
      </ScrollView>

      {/* Player Record Modal - Outside tab conditional for both tabs */}
      <Modal
        visible={recordModal.visible}
        animationType="fade"
        transparent
        onRequestClose={() => setRecordModal({ ...recordModal, visible: false })}
      >
        <TouchableOpacity
          style={styles.datePickerOverlay}
          activeOpacity={1}
          onPress={() => setRecordModal({ ...recordModal, visible: false })}
        >
          <View style={styles.recordModalContainer}>
            <Text style={styles.recordModalTitle}>{dn(recordModal.player)} 전적</Text>

            {/* Filter Buttons */}
            <View style={styles.recordFilterRow}>
              <TouchableOpacity
                style={[
                  styles.recordFilterBtn,
                  recordModal.filterMode === 'all' && styles.recordFilterBtnActive
                ]}
                onPress={() => setRecordModal({ ...recordModal, filterMode: 'all' })}
              >
                <Text style={[
                  styles.recordFilterBtnText,
                  recordModal.filterMode === 'all' && styles.recordFilterBtnTextActive
                ]}>전체</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.recordFilterBtn,
                  recordModal.filterMode === 'recent5' && styles.recordFilterBtnActive
                ]}
                onPress={() => setRecordModal({ ...recordModal, filterMode: 'recent5' })}
              >
                <Text style={[
                  styles.recordFilterBtnText,
                  recordModal.filterMode === 'recent5' && styles.recordFilterBtnTextActive
                ]}>최근 5게임</Text>
              </TouchableOpacity>
            </View>

            {/* Partner Record */}
            {recordModal.partner && (
              <View style={styles.recordSection}>
                <Text style={styles.recordSectionTitle}>
                  파트너: {dn(recordModal.partner)}
                </Text>
                {(() => {
                  if (sessionsLoading) {
                    return <Text style={styles.recordNoData}>데이터 로딩중...</Text>;
                  }
                  if (Object.keys(allSessions).length === 0) {
                    return <Text style={styles.recordNoData}>저장된 경기 기록 없음</Text>;
                  }
                  const h2h = getHeadToHead(
                    allSessions,
                    recordModal.player,
                    recordModal.partner,
                    recordModal.filterMode === 'recent5' ? { limitPartner: 5, limitOpponent: 5 } : undefined
                  );
                  if (h2h.asPartner.games === 0) {
                    return <Text style={styles.recordNoData}>함께한 기록 없음</Text>;
                  }
                  const winRate = h2h.asPartner.games > 0
                    ? Math.round((h2h.asPartner.wins / h2h.asPartner.games) * 100)
                    : 0;
                  return (
                    <View style={styles.recordStats}>
                      <Text style={styles.recordStatText}>
                        {h2h.asPartner.games}경기: {h2h.asPartner.wins}승 {h2h.asPartner.draws}무 {h2h.asPartner.losses}패
                      </Text>
                      <Text style={[
                        styles.recordWinRate,
                        winRate >= 50 ? styles.recordWinRateHigh : styles.recordWinRateLow
                      ]}>
                        승률 {winRate}%
                      </Text>
                    </View>
                  );
                })()}
              </View>
            )}

            {/* Opponent Records */}
            <View style={styles.recordSection}>
              <Text style={styles.recordSectionTitle}>상대 전적</Text>
              {sessionsLoading ? (
                <Text style={styles.recordNoData}>데이터 로딩중...</Text>
              ) : Object.keys(allSessions).length === 0 ? (
                <Text style={styles.recordNoData}>저장된 경기 기록 없음</Text>
              ) : (
                recordModal.opponents.map((opp) => {
                  const h2h = getHeadToHead(
                    allSessions,
                    recordModal.player,
                    opp,
                    recordModal.filterMode === 'recent5' ? { limitPartner: 5, limitOpponent: 5 } : undefined
                  );
                  if (h2h.asOpponent.games === 0) {
                    return (
                      <View key={opp} style={styles.recordOpponentRow}>
                        <Text style={styles.recordOpponentName}>{dn(opp)}</Text>
                        <Text style={styles.recordNoData}>기록 없음</Text>
                      </View>
                    );
                  }
                  const winRate = h2h.asOpponent.games > 0
                    ? Math.round((h2h.asOpponent.wins / h2h.asOpponent.games) * 100)
                    : 0;
                  return (
                    <View key={opp} style={styles.recordOpponentRow}>
                      <Text style={styles.recordOpponentName}>{dn(opp)}</Text>
                      <Text style={styles.recordStatText}>
                        {h2h.asOpponent.wins}승 {h2h.asOpponent.draws}무 {h2h.asOpponent.losses}패
                      </Text>
                      <Text style={[
                        styles.recordWinRateSmall,
                        winRate >= 50 ? styles.recordWinRateHigh : styles.recordWinRateLow
                      ]}>
                        {winRate}%
                      </Text>
                    </View>
                  );
                })
              )}
            </View>

            <TouchableOpacity
              style={styles.recordCloseBtn}
              onPress={() => setRecordModal({ ...recordModal, visible: false })}
            >
              <Text style={styles.recordCloseBtnText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Score Picker Modal */}
      <Modal
        visible={scorePicker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setScorePicker(null)}
      >
        <TouchableOpacity style={styles.scorePickerOverlay} activeOpacity={1} onPress={() => setScorePicker(null)}>
          <View style={styles.scorePickerContainer}>
            <Text style={styles.scorePickerTitle}>점수 선택</Text>
            <View style={styles.scorePickerGrid}>
              {[0,1,2,3,4,5,6,7,8,9,10].map(v => (
                <TouchableOpacity
                  key={v}
                  style={[
                    styles.scorePickerItem,
                    scorePicker && results[String(scorePicker.matchIndex + 1)]?.[scorePicker.team] === v && styles.scorePickerItemActive
                  ]}
                  onPress={() => {
                    if (scorePicker) {
                      handleScoreSelect(scorePicker.matchIndex, scorePicker.team, v);
                      setScorePicker(null);
                    }
                  }}
                >
                  <Text style={[
                    styles.scorePickerItemText,
                    scorePicker && results[String(scorePicker.matchIndex + 1)]?.[scorePicker.team] === v && styles.scorePickerItemTextActive
                  ]}>{v}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  tabHeaderContainer: {
    backgroundColor: colors.navy,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 0,
  },
  tabHeader: {
    maxWidth: MAX_WIDTH,
    width: '100%',
    alignSelf: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing['3xl'],
    maxWidth: MAX_WIDTH,
    alignSelf: 'center',
    width: '100%',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  dateNavBtn: {
    padding: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
  },
  dateNavBtnDisabled: {
    opacity: 0.4,
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    borderWidth: 0,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.black,
  },
  todayBadge: {
    fontSize: 10,
    color: colors.accent,
    backgroundColor: colors.navy,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    marginLeft: spacing.sm,
    overflow: 'hidden',
  },
  quickDateRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  quickDateBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: colors.bg,
    borderRadius: radius.full,
    marginHorizontal: spacing.xs,
  },
  quickDateBtnActive: {
    backgroundColor: colors.navy,
  },
  quickDateText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  quickDateTextActive: {
    color: colors.white,
    fontWeight: '700',
  },
  // Date picker modal styles
  datePickerOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerContainer: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    width: '90%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  monthNavBtn: {
    padding: spacing.sm,
  },
  datePickerTitle: {
    ...typography.section,
    fontWeight: '700',
    color: colors.text,
  },
  weekDaysRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingBottom: spacing.sm,
  },
  weekDayText: {
    flex: 1,
    textAlign: 'center',
    ...typography.captionMedium,
    color: colors.textTertiary,
  },
  weekDaySun: {
    color: colors.error,
  },
  weekDaySat: {
    color: colors.primary,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayBtn: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    position: 'relative',
    paddingTop: 2,
  },
  dayBtnSelected: {
    backgroundColor: colors.primary,
  },
  dayBtnToday: {
    backgroundColor: colors.primaryBg,
  },
  dayBtnOtherMonth: {
    opacity: 0.3,
  },
  dayText: {
    fontSize: 13,
    color: colors.text,
  },
  dayTextSelected: {
    color: colors.black,
    fontWeight: '600',
  },
  dayTextToday: {
    color: colors.primary,
    fontWeight: '600',
  },
  dayTextOtherMonth: {
    color: colors.textTertiary,
  },
  dayTextSun: {
    color: colors.error,
  },
  dayTextSat: {
    color: colors.primary,
  },
  sessionDot: {
    position: 'absolute',
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.success,
  },
  sessionDotSelected: {
    backgroundColor: colors.white,
  },
  todayBtn: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  todayBtnText: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  selectionHeader: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  playerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -2,
  },
  playerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.full,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    margin: 2,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  playerChipMale: {
    backgroundColor: colors.male.bg,
    borderColor: '#1E3A5F',
  },
  playerChipFemale: {
    backgroundColor: colors.female.bg,
    borderColor: '#5F1E3A',
  },
  playerChipMaleSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  playerChipFemaleSelected: {
    backgroundColor: colors.error,
    borderColor: colors.error,
  },
  playerChipText: {
    ...typography.captionMedium,
    fontWeight: '600',
    color: colors.text,
  },
  playerChipTextSelected: {
    color: colors.black,
    fontWeight: '700',
  },
  optionRow: {
    flexDirection: 'row',
  },
  checkboxRow: {
    marginTop: 8,
  },
  // Round divider styles
  roundDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  roundDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  roundDividerText: {
    ...typography.captionMedium,
    fontWeight: '700',
    color: colors.textSecondary,
    paddingHorizontal: spacing.md,
  },
  // Group divider styles (조별 대진)
  groupDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.navy,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    borderRadius: radius.sm,
  },
  groupDividerLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.accent,
    opacity: 0.3,
  },
  groupDividerText: {
    ...typography.bodyMedium,
    fontWeight: '700',
    color: colors.accent,
    paddingHorizontal: spacing.md,
  },
  matchPreview: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  matchHeaderCenter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    position: 'relative',
  },
  matchNo: {
    ...typography.captionMedium,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  matchNoCenter: {
    ...typography.captionMedium,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  matchCourt: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  matchTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamNamesCol: {
    flex: 1,
    gap: 2,
  },
  teamNamesCol1: {
    flex: 1,
    gap: 2,
    alignItems: 'flex-end',
  },
  teamNamesCol2: {
    flex: 1,
    gap: 2,
    alignItems: 'flex-start',
  },
  matchNameMaleBox: {
    backgroundColor: colors.male.bg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#3B6EA5',
  },
  matchNameMaleText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.male.text,
  },
  matchNameFemaleBox: {
    backgroundColor: colors.female.bg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#A5713B',
  },
  matchNameFemaleText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.female.text,
  },
  matchNameDefaultBox: {
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  matchNameDefaultText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  vsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  vsText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textTertiary,
    marginHorizontal: 2,
  },
  probText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textTertiary,
    minWidth: 24,
    textAlign: 'center',
  },
  probTextHigh: {
    color: colors.success,
    fontWeight: '700',
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recordBtn: {
    padding: 4,
    backgroundColor: colors.navy,
    borderRadius: 6,
    borderWidth: 0,
  },
  // Record Modal Styles
  recordModalContainer: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.xl,
    width: '90%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
  },
  recordModalTitle: {
    ...typography.title,
    fontSize: 18,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  recordFilterRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  recordFilterBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recordFilterBtnActive: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
  },
  recordFilterBtnText: {
    ...typography.captionMedium,
    color: colors.textSecondary,
  },
  recordFilterBtnTextActive: {
    color: colors.accent,
  },
  recordSection: {
    marginBottom: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  recordSectionTitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  recordStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordStatText: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  recordWinRate: {
    fontSize: 16,
    fontWeight: '700',
  },
  recordWinRateSmall: {
    fontSize: 13,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'right',
  },
  recordWinRateHigh: {
    color: colors.success,
  },
  recordWinRateLow: {
    color: colors.error,
  },
  recordNoData: {
    ...typography.caption,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
  recordOpponentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  recordOpponentName: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  recordCloseBtn: {
    backgroundColor: colors.navy,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  recordCloseBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
  },
  emptyScore: {
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
  },
  emptyText: {
    ...typography.body,
    color: colors.textTertiary,
    marginTop: spacing.md,
  },
  // Court type selector styles
  courtTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  courtTypeLabel: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.text,
  },
  courtTypeBtns: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  courtTypeBtn: {
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  courtTypeBtnGrass: {
    backgroundColor: colors.successBg,
    borderColor: colors.success,
  },
  courtTypeBtnHard: {
    backgroundColor: colors.primaryBg,
    borderColor: colors.primary,
  },
  courtTypeBtnClay: {
    backgroundColor: colors.warningBg,
    borderColor: colors.warning,
  },
  courtTypeBtnText: {
    ...typography.captionMedium,
    color: colors.textSecondary,
  },
  courtTypeBtnTextGrass: {
    color: colors.success,
    fontWeight: '600',
  },
  courtTypeBtnTextHard: {
    color: colors.primary,
    fontWeight: '600',
  },
  courtTypeBtnTextClay: {
    color: colors.warning,
    fontWeight: '600',
  },
  // Progress
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  progressPercent: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '700',
  },
  scoreCard: {
    marginTop: spacing.sm,
  },
  groupHeader: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: colors.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  scoreViewToggle: {
    flexDirection: 'row' as const,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: 3,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  scoreViewBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    alignItems: 'center' as const,
  },
  scoreViewBtnActive: {
    backgroundColor: colors.navy,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  scoreViewBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.textSecondary,
  },
  scoreViewBtnTextActive: {
    color: colors.white,
  },
  indivTable: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    overflow: 'hidden' as const,
    backgroundColor: colors.card,
  },
  indivRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  indivNameCol: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    width: 80,
    gap: 4,
  },
  indivRank: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.textTertiary,
    width: 18,
    textAlign: 'center' as const,
  },
  indivPlayerName: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.text,
  },
  indivGamesCol: {
    flex: 1,
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 3,
    justifyContent: 'center' as const,
  },
  indivGameCell: {
    alignItems: 'center' as const,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 36,
  },
  indivCellWin: {
    backgroundColor: colors.successBg,
  },
  indivCellLoss: {
    backgroundColor: colors.errorBg,
  },
  indivCellDraw: {
    backgroundColor: colors.warningBg,
  },
  indivCellNoResult: {
    backgroundColor: colors.borderLight,
  },
  indivGameNum: {
    fontSize: 9,
    color: colors.textTertiary,
    fontWeight: '600' as const,
  },
  indivGameScore: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: colors.text,
  },
  indivSummaryCol: {
    alignItems: 'flex-end' as const,
    minWidth: 65,
  },
  indivRecord: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: colors.text,
  },
  indivDiff: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: colors.textSecondary,
  },
  highlightRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  highlightEmoji: {
    fontSize: 14,
    width: 22,
    textAlign: 'center' as const,
  },
  highlightLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.textSecondary,
    width: 55,
  },
  highlightValue: {
    fontSize: 13,
    color: colors.text,
    flex: 1,
  },
  scoreCardComplete: {
    opacity: 0.7,
  },
  scoreMatchContainer: {
    paddingVertical: spacing.md,
  },
  scoreMatchComplete: {
    // No longer used
  },
  scoreMatchBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
    paddingTop: spacing.lg,
  },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  scoreMatchNo: {
    ...typography.captionMedium,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  scoreCourt: {
    ...typography.captionMedium,
    color: colors.textSecondary,
  },
  scoreTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  scoreTeamCol: {
    flex: 1,
  },
  scoreTeamCol1: {
    flex: 1,
    alignItems: 'flex-end',
    paddingRight: 2,
    minWidth: 0,
  },
  scoreTeamCol2: {
    flex: 1,
    alignItems: 'flex-start',
    paddingLeft: 2,
    minWidth: 0,
  },
  scoreTeamName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 18,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.bg,
    overflow: 'hidden',
    maxWidth: 70,
  },
  scoreTeamNameMale: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.male.text,
    lineHeight: 18,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.male.bg,
    overflow: 'hidden',
    maxWidth: 70,
  },
  scoreTeamNameFemale: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.female.text,
    lineHeight: 18,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.female.bg,
    overflow: 'hidden',
    maxWidth: 70,
  },
  scoreInputCol: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    flexShrink: 0,
  },
  // Score dropdown UI
  scoreDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 36,
    gap: 4,
  },
  scoreDropdownText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  scoreColon: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textTertiary,
    marginHorizontal: 4,
  },
  // Score picker modal
  scorePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scorePickerContainer: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    width: 280,
  },
  scorePickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  scorePickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  scorePickerItem: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scorePickerItemActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  scorePickerItemText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  scorePickerItemTextActive: {
    color: '#fff',
  },
  probTextSmall: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.textTertiary,
    marginHorizontal: 1,
    minWidth: 22,
    textAlign: 'center',
  },
  recordBtnSmall: {
    padding: 3,
    marginHorizontal: 1,
    backgroundColor: colors.primaryBg,
    borderRadius: 3,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  playerRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    justifyContent: 'flex-end',
    flexWrap: 'nowrap',
  },
  playerRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    justifyContent: 'flex-start',
    flexWrap: 'nowrap',
  },
  sideToggle: {
    flexDirection: 'row',
    marginHorizontal: 1,
  },
  sideBtn: {
    paddingVertical: 1,
    paddingHorizontal: 3,
    backgroundColor: colors.bg,
    borderRadius: 2,
    marginHorizontal: 0,
  },
  sideBtnActive: {
    backgroundColor: colors.primary,
  },
  sideBtnText: {
    fontSize: 8,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  sideBtnTextActive: {
    color: colors.black,
  },
  // Guest player styles
  guestChip: {
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: colors.textTertiary,
    paddingHorizontal: spacing.sm,
  },
  guestBadge: {
    fontSize: 9,
    color: colors.warning,
    fontWeight: '600',
    marginLeft: 3,
  },
  addGuestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.full,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    margin: 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  addGuestText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  // Guest modal styles
  guestModalContainer: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    width: '85%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: colors.border,
  },
  guestModalTitle: {
    ...typography.section,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  guestInput: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  guestModalButtons: {
    flexDirection: 'row',
  },
  guestFieldLabel: {
    ...typography.captionMedium,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  guestRadioRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  guestRadioBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  guestRadioBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  guestRadioText: {
    ...typography.captionMedium,
    color: colors.text,
  },
  guestRadioTextActive: {
    color: colors.black,
  },
  // Delete match button
  deleteMatchBtn: {
    padding: 8,
    marginLeft: 'auto',
  },
  deleteMatchBtnAbs: {
    position: 'absolute',
    right: 0,
    padding: 8,
  },
  // Loading text
  loadingText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  // 대진 수정 섹션 스타일
  editSectionHeader: {
    paddingVertical: spacing.md,
  },
  editSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  editSectionContent: {
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  editSubTitle: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  editTeamLabel: {
    ...typography.captionMedium,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  editApplyBtn: {
    backgroundColor: colors.successBg,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.success,
  },
  editApplyBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.success,
  },
  editDeleteBtn: {
    backgroundColor: colors.errorBg,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.error,
  },
  editDeleteBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.error,
  },
  editCaption: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 6,
    lineHeight: 18,
  },
  editDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  editDeleteWarning: {
    ...typography.captionMedium,
    color: colors.error,
    backgroundColor: colors.errorBg,
    padding: spacing.md,
    borderRadius: radius.sm,
    lineHeight: 20,
  },
  editCancelBtn: {
    backgroundColor: colors.bg,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
    marginTop: 0,
  },
  editCancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  // --- 선택 순서 표시 ---
  selectedOrderSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  selectedOrderTitle: {
    ...typography.captionMedium,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  selectedOrderList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  selectedOrderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingLeft: spacing.sm,
    paddingRight: 6,
    borderRadius: radius.full,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedOrderChipMale: {
    backgroundColor: colors.male.bg,
    borderColor: '#1E3A5F',
  },
  selectedOrderChipFemale: {
    backgroundColor: colors.female.bg,
    borderColor: '#5F1E3A',
  },
  selectedOrderNum: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    marginRight: 3,
    minWidth: 14,
    textAlign: 'center',
  },
  selectedOrderName: {
    ...typography.captionMedium,
    color: colors.text,
  },
  selectedOrderRemove: {
    marginLeft: spacing.xs,
    padding: 2,
  },
  manualOrderList: {
    marginTop: spacing.sm,
  },
  manualOrderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  manualOrderArrows: {
    alignItems: 'center',
    marginRight: spacing.xs,
    width: 24,
  },
  manualOrderArrowBtn: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
  },
  manualOrderChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingLeft: spacing.sm,
    paddingRight: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  // --- 대진 생성 탭 추가 스타일 ---
  radioRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.xs,
    alignItems: 'center',
  },
  radioBtn: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  radioBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  radioBtnDisabled: {
    opacity: 0.5,
  },
  radioBtnText: {
    ...typography.captionMedium,
    color: colors.text,
  },
  radioBtnTextActive: {
    color: colors.black,
    fontWeight: '600',
  },
  radioLabel: {
    ...typography.captionMedium,
    fontWeight: '600',
    color: colors.text,
    marginRight: 6,
  },
  optionLabel: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  shuffleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  shuffleCountText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  orderList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.sm,
  },
  orderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: colors.bg,
  },
  orderNum: {
    fontSize: 11,
    fontWeight: '700',
    marginRight: spacing.xs,
  },
  orderName: {
    ...typography.captionMedium,
    color: colors.text,
  },
  groupSection: {
    marginTop: spacing.sm,
    width: '100%',
  },
  groupSectionTitle: {
    ...typography.captionMedium,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  teamSection: {
    marginTop: spacing.xs,
  },
  teamCard: {
    borderLeftWidth: 3,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  colorPickerBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  colorSwatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
    marginTop: 2,
  },
  colorSwatch: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchActive: {
    borderColor: colors.white,
    borderWidth: 3,
  },
  teamCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  teamPlayerChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  teamPlayerChipText: {
    ...typography.caption,
    color: colors.text,
  },
  manualBtnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  checkedCountText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  gameCountSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  gameCountTitle: {
    ...typography.bodyMedium,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  gameCountWarning: {
    ...typography.caption,
    color: colors.warning,
    backgroundColor: colors.warningBg,
    borderRadius: 6,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  gameCountRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 6,
  },
  gameCountNum: {
    ...typography.captionMedium,
    fontWeight: '700',
    color: colors.text,
    minWidth: 60,
  },
  gameCountNames: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    flex: 1,
    gap: spacing.xs,
  },
  gameCountBadge: {
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 6,
  },
  gameCountBadgeText: {
    ...typography.captionMedium,
    fontWeight: '600',
    color: colors.text,
  },
  manualRoundHeader: {
    paddingVertical: 6,
    marginTop: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  manualRoundTitle: {
    ...typography.bodyMedium,
    fontWeight: '700',
    color: colors.text,
  },
  manualSlotCard: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  manualSlotCardChecked: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryBg,
  },
  manualSlotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  manualSlotTitle: {
    ...typography.captionMedium,
    fontWeight: '600',
    color: colors.text,
    marginLeft: 6,
  },
  manualSlotTeams: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  manualSlotTeam: {
    flex: 1,
  },
  manualSlotSelect: {
    marginBottom: spacing.xs,
  },
  manualVs: {
    ...typography.captionMedium,
    fontWeight: '700',
    color: colors.textTertiary,
    marginHorizontal: spacing.sm,
  },
  saveRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  saveJpgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  saveJpgText: {
    ...typography.captionMedium,
    color: colors.textSecondary,
    marginLeft: 6,
  },
  jpgWatermark: {
    backgroundColor: colors.card,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  jpgWatermarkText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
    fontSize: 14,
  },
});

// ── 코트 예약 달력 스타일 ──
const rs = StyleSheet.create({
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  navBtn: {
    padding: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
  },
  navDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  navTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.black,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionBtnText: {
    ...typography.captionMedium,
    color: colors.textSecondary,
    marginLeft: 6,
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayLabel: {
    width: '14.28%',
    alignItems: 'center',
    paddingVertical: 6,
    backgroundColor: colors.navyLight,
    borderRadius: 4,
  },
  dayLabelText: {
    fontWeight: '700',
    fontSize: 12,
    color: colors.text,
  },
  dayCell: {
    width: '14.28%',
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    padding: 3,
    backgroundColor: colors.card,
  },
  dayCellSpecial: {
    borderWidth: 3,
    borderColor: '#ffd32a',
    backgroundColor: '#2D2006',
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    marginBottom: 3,
    paddingBottom: 2,
  },
  dateNum: {
    fontWeight: '700',
    fontSize: 11,
    paddingHorizontal: 2,
    color: colors.text,
  },
  holidayName: {
    fontSize: 8,
    fontWeight: '700',
    color: '#e53935',
    marginLeft: 1,
  },
  anniName: {
    fontSize: 8,
    fontWeight: '700',
    color: '#d35400',
    backgroundColor: '#2D2006',
    paddingHorizontal: 2,
    borderRadius: 2,
    marginLeft: 2,
    borderWidth: 1,
    borderColor: '#f39c12',
  },
  customEntry: {
    borderRadius: 4,
    padding: 3,
    marginBottom: 2,
  },
  customEntryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.15)',
    paddingBottom: 1,
    marginBottom: 1,
    gap: 2,
  },
  customTimeText: {
    fontSize: 8,
    color: colors.black,
    fontWeight: '700',
  },
  customInfoText: {
    fontSize: 8,
    color: colors.black,
    fontWeight: '600',
  },
  genderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 3,
    paddingHorizontal: 2,
    paddingVertical: 0,
    gap: 1,
  },
  genderBadgeText: {
    fontSize: 9,
    fontWeight: '900',
  },
  closedBadgeSmall: {
    fontSize: 7,
    fontWeight: '700',
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 3,
    overflow: 'hidden',
  },
  closedTag: {
    backgroundColor: colors.error,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  closedTagText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  customAddBtn: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 4,
    padding: 3,
    alignItems: 'center',
  },
  customAddBtnText: {
    fontSize: 9,
    color: colors.textTertiary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    backgroundColor: colors.card,
    padding: 24,
    borderRadius: 15,
    width: 370,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
    color: colors.text,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
    backgroundColor: colors.bg,
    color: colors.text,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 8,
    color: colors.text,
  },
  targetRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
    alignItems: 'center',
  },
  targetCountWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 2,
  },
  targetCountInput: {
    width: 32,
    height: 30,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    textAlign: 'center',
    fontSize: 13,
    paddingVertical: 2,
    backgroundColor: colors.bg,
    color: colors.text,
  },
  targetCountText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  targetBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 3,
  },
  targetBtnActive: {
    backgroundColor: colors.info,
    borderColor: colors.info,
  },
  targetBtnText: {
    fontSize: 13,
    color: colors.text,
  },
  targetBtnTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  detailRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.borderLight,
  },
  detailLabel: {
    width: 60,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: 13,
    color: colors.text,
  },
  joinBtn: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.success,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  joinBtnLeave: {
    backgroundColor: colors.error,
  },
  joinBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  alarmBtn: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.warning,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  alarmBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    minWidth: 60,
    justifyContent: 'center',
  },
  dropdownBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  dropdownGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 8,
    padding: 8,
    backgroundColor: colors.navyLight,
    borderRadius: 8,
  },
  dropdownItem: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 42,
    alignItems: 'center',
  },
  dropdownItemActive: {
    backgroundColor: colors.info,
    borderColor: colors.info,
  },
  dropdownItemText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '500',
  },
  dropdownItemTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
});
