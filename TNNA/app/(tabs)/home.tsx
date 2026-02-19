import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
  Linking,
  Modal,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useAuthStore } from '../../stores/authStore';
import { useClubStore } from '../../stores/clubStore';
import { usePlayerStore } from '../../stores/playerStore';
import { useMatchStore } from '../../stores/matchStore';
import { Card, Footer } from '../../components/ui';
import { colors, spacing, radius, typography, layout, MAX_WIDTH, FONT_FAMILY } from '../../theme/tokens';
import { getCompletionPercentage } from '../../utils/scoring';
import { createDisplayNameFn } from '../../utils/displayName';
import { getSessionDates, getSession } from '../../services/sessions';
import { getMemberNames, saveMemberName, getLocalClub } from '../../services/localData';
import * as duesService from '../../services/dues';
import { aggregateStats, getAttendance, getOpponentStats, getPartnerStats, calculateMatchProbability, getHeadToHead } from '../../utils/stats';
import { calculateDailyStats, findMVP } from '../../utils/scoring';
import { analyzeMatchDay, MatchDayAnalysis } from '../../utils/matchAnalysis';
import { generateMatchAnalysisAI, generatePersonalMatchAnalysisAI } from '../../services/gemini';
import { Session, DuesData, BillingPeriod, PaymentRecord, PaymentStatus, PlayerStats } from '../../types';

// SMS 송신 헬퍼
function openSmsToAdmin(phones: string[], clubName: string, playerName: string, amount: number, periodName: string) {
  if (!phones.length) return;
  const body = `${clubName} ${periodName} ${playerName} ${amount.toLocaleString()}원 입금 확인 바랍니다.`;
  const sep = Platform.OS === 'ios' ? '&' : '?';
  const url = `sms:${phones.join(',')}${sep}body=${encodeURIComponent(body)}`;
  Linking.openURL(url).catch(() => {});
}

// 성별에 따른 이름 뱃지 색상
const GENDER_COLORS = {
  male: { bg: colors.male.bg, text: colors.male.text },     // 파란색 (남)
  female: { bg: colors.female.bg, text: colors.female.text },   // 분홍색 (여)
  default: { bg: colors.divider, text: colors.text },  // 회색 (기본)
};

// 선수 이름 뱃지 컴포넌트
const PlayerNameBadge = ({ name, gender }: { name: string; gender?: '남' | '여' }) => {
  const colors = gender === '남' ? GENDER_COLORS.male
    : gender === '여' ? GENDER_COLORS.female
    : GENDER_COLORS.default;

  return (
    <View style={[styles.nameBadge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.nameBadgeText, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">{name}</Text>
    </View>
  );
};

export default function HomeScreen() {
  const { user } = useAuthStore();
  const { club, clubCode, isAdmin, updateSettings } = useClubStore();

  // 섹션 제한
  const sr = club?.settings?.sectionRestrictions || {};
  const isSectionRestricted = (key: string) => !isAdmin && sr[key];
  const { players } = usePlayerStore();
  const { schedule, results, loadSession, selectedDate, sessionVersion } = useMatchStore();
  const [refreshing, setRefreshing] = useState(false);
  const [recentDate, setRecentDate] = useState<string | null>(null);
  const [recentSession, setRecentSession] = useState<Session | null>(null);
  const [duesData, setDuesData] = useState<DuesData>({ billingPeriods: [], payments: {} });
  const [myPlayerName, setMyPlayerName] = useState<string | null>(null);
  const [duesContactPhones, setDuesContactPhones] = useState<string[]>([]);
  const [myStats, setMyStats] = useState<PlayerStats | null>(null);
  const [myAttendance, setMyAttendance] = useState(0);
  const [myMvpCount, setMyMvpCount] = useState(0);
  const prevStatusRef = useRef<Record<string, PaymentStatus>>({});
  const lastAiAnalysisKeyRef = useRef<string>('');
  const lastPersonalAiKeyRef = useRef<string>('');
  // 공지사항
  const [editingNotice, setEditingNotice] = useState(false);
  const [noticeText, setNoticeText] = useState('');
  // 대진 분석
  const [allSessions, setAllSessions] = useState<Record<string, Session>>({});
  const [matchAnalysisText, setMatchAnalysisText] = useState<{ title: string; summary: string } | null>(null);
  const [isAiAnalysis, setIsAiAnalysis] = useState(false);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  // 개인 대진 분석
  const [myMatchAnalysis, setMyMatchAnalysis] = useState<string | null>(null);
  const [isAiMyAnalysis, setIsAiMyAnalysis] = useState(false);
  const [isLoadingMyAnalysis, setIsLoadingMyAnalysis] = useState(false);
  // 대진전적 모달
  const [recordModal, setRecordModal] = useState<{
    visible: boolean;
    player: string;
    partner: string | null;
    opponents: string[];
    filterMode: 'all' | 'recent5';
  }>({ visible: false, player: '', partner: null, opponents: [], filterMode: 'all' });

  const displayNameMode = club?.settings?.displayNameMode;
  const dn = useMemo(() => createDisplayNameFn(players, displayNameMode), [players, displayNameMode]);

  const today = format(new Date(), 'yyyy-MM-dd');
  const todayDisplay = format(new Date(), 'M월 d일 (EEEE)', { locale: ko });

  // 회비 + 내 이름 로드 (탭 포커스될 때마다)
  const loadDuesAndMyName = useCallback(async () => {
    if (!clubCode) return;
    // 내 선수 이름 찾기
    let foundName: string | null = null;
    if (user?.email) {
      const names = await getMemberNames(clubCode);
      foundName = names[user.email.toLowerCase()] || null;
      // memberNames에 없으면 players에서 email로 찾아서 매핑 복구
      if (!foundName && players.length > 0) {
        const linked = players.find(p => p.email?.toLowerCase() === user.email!.toLowerCase());
        if (linked) {
          foundName = linked.name;
          await saveMemberName(clubCode, user.email, linked.name);
        }
      }
      setMyPlayerName(foundName);
    }
    // 전체 세션 로드 (내 통계 + 대진 분석 공용)
    try {
      const dates = await getSessionDates(clubCode);
      const sessions: Record<string, Session> = {};
      for (const date of dates) {
        const session = await getSession(clubCode, date);
        if (session && !session.specialMatch) sessions[date] = session;
      }
      setAllSessions(sessions);

      if (foundName && players.length > 0) {
        const memberSet = new Set(players.map((p) => p.name));
        const allStats = aggregateStats(sessions, memberSet);
        setMyStats(allStats[foundName] || null);
        // 출석일수
        const attendance = getAttendance(sessions, memberSet);
        setMyAttendance(attendance[foundName] || 0);
        // 일일 MVP 횟수
        let mvpCnt = 0;
        for (const session of Object.values(sessions)) {
          const daily = calculateDailyStats(session, memberSet);
          const mvp = findMVP(daily);
          if (mvp && mvp.name === foundName) mvpCnt++;
        }
        setMyMvpCount(mvpCnt);
      }
    } catch {}
    // 입금확인 연락처 (설정에서, 복수 지원)
    const phones = club?.settings?.duesContactPhones?.length
      ? club.settings.duesContactPhones
      : club?.settings?.duesContactPhone
        ? [club.settings.duesContactPhone]
        : [];
    setDuesContactPhones(phones);
    // 회비 데이터 로드
    const data = await duesService.getDues(clubCode);
    setDuesData(data);
  }, [clubCode, user?.email, players, club?.settings?.duesContactPhones, club?.settings?.duesContactPhone]);

  useFocusEffect(
    useCallback(() => {
      loadDuesAndMyName();
    }, [loadDuesAndMyName])
  );

  // players가 늦게 로드되었을 때 통계 재계산
  useEffect(() => {
    if (!myPlayerName || players.length === 0 || Object.keys(allSessions).length === 0) return;
    const memberSet = new Set(players.map((p) => p.name));
    const allStats = aggregateStats(allSessions, memberSet);
    setMyStats(allStats[myPlayerName] || null);
    const attendance = getAttendance(allSessions, memberSet);
    setMyAttendance(attendance[myPlayerName] || 0);
    let mvpCnt = 0;
    for (const session of Object.values(allSessions)) {
      const daily = calculateDailyStats(session, memberSet);
      const mvp = findMVP(daily);
      if (mvp && mvp.name === myPlayerName) mvpCnt++;
    }
    setMyMvpCount(mvpCnt);
  }, [myPlayerName, players, allSessions]);

  // 내 미납/확인요망/입금완료(미삭제) 회비 항목
  const myDuesItems = useMemo(() => {
    if (!myPlayerName) return [];
    const items: { period: BillingPeriod; record: PaymentRecord }[] = [];
    for (const period of duesData.billingPeriods) {
      const record = duesData.payments[period.id]?.find((r) => r.playerName === myPlayerName);
      if (record && !record.dismissed) {
        items.push({ period, record });
      }
    }
    return items;
  }, [duesData, myPlayerName]);

  // 회비 상태 알림 (로그인 시 + 상태 변화 시)
  useEffect(() => {
    if (!myPlayerName) return;
    if (duesData.billingPeriods.length === 0) return;

    const isFirstLoad = Object.keys(prevStatusRef.current).length === 0;
    const confirmed: string[] = [];
    const rejected: string[] = [];
    const currentStatuses: Record<string, PaymentStatus> = {};

    for (const period of duesData.billingPeriods) {
      const record = duesData.payments[period.id]?.find((r) => r.playerName === myPlayerName);
      if (!record) continue;

      const key = period.id;
      currentStatuses[key] = record.status;
      const prev = prevStatusRef.current[key];

      if (isFirstLoad) {
        // 로그인 직후: 입금완료(미해제) 알림
        if (record.status === '입금완료' && !record.dismissed) {
          confirmed.push(`${period.name} 회비 입금이 확인되었습니다.`);
        }
      } else if (prev && prev !== record.status) {
        if (record.status === '입금완료') {
          confirmed.push(`${period.name} 회비 입금이 확인되었습니다.`);
        } else if (record.status === '미납' && prev === '확인요망') {
          rejected.push(`${period.name} 회비 입금이 확인되지 않았습니다.\n재입금 바랍니다.`);
        }
      }
    }

    prevStatusRef.current = currentStatuses;

    if (confirmed.length > 0) {
      const msg = confirmed.join('\n\n');
      Platform.OS === 'web' ? alert(msg) : Alert.alert('입금 확인', msg);
    }
    if (rejected.length > 0) {
      const msg = rejected.join('\n\n');
      setTimeout(() => {
        Platform.OS === 'web' ? alert(msg) : Alert.alert('입금 미확인', msg);
      }, confirmed.length > 0 ? 500 : 0);
    }
  }, [duesData, myPlayerName]);

  // Load today's session and most recent session
  useEffect(() => {
    if (clubCode) {
      loadSession(clubCode, today);
      loadRecentSession();
    }
  }, [clubCode]);

  // sessionVersion이 변경될 때 최근 세션 새로고침 (다른 탭에서 저장/삭제 시)
  useEffect(() => {
    if (clubCode && sessionVersion > 0) {
      loadRecentSession();
    }
  }, [sessionVersion]);

  const loadRecentSession = async () => {
    if (!clubCode) return;
    const dates = await getSessionDates(clubCode);
    if (dates.length > 0) {
      // dates are sorted in descending order, get the most recent (first one)
      const mostRecent = dates[0];
      setRecentDate(mostRecent);
      const session = await getSession(clubCode, mostRecent);
      setRecentSession(session);
    } else {
      setRecentDate(null);
      setRecentSession(null);
    }
  };

  // 대진 분석 실행
  useEffect(() => {
    if (!recentSession || !recentDate || Object.keys(allSessions).length === 0 || players.length === 0) return;

    const matches = recentSession.schedule.filter(m => m.gameType !== '삭제');
    if (matches.length === 0) return;

    const useAdminNtrp = club?.settings?.useAdminNtrp || false;
    const analysis = analyzeMatchDay(recentSession, allSessions, players, useAdminNtrp);

    // 데이터 변경 여부 확인
    const aiKey = `${recentDate}-${analysis.totalMatches}-${analysis.totalPlayers}-${analysis.notableMatchups.length}`;
    if (aiKey === lastAiAnalysisKeyRef.current) return; // 같은 데이터면 전체 스킵 (AI 결과 보존)
    lastAiAnalysisKeyRef.current = aiKey;

    // 오프라인 결과 즉시 표시
    setMatchAnalysisText({ title: '', summary: analysis.overallVerdict });
    setIsAiAnalysis(false);

    // Gemini API 키가 있으면 AI 분석 시도
    const apiKey = club?.settings?.geminiApiKey;
    if (!apiKey || !clubCode) return;

    console.log('[Home] Gemini: calling AI analysis (data changed)');
    let cancelled = false;
    setIsLoadingAnalysis(true);

    generateMatchAnalysisAI(apiKey, analysis, clubCode, recentDate).then((result) => {
      if (cancelled) return;
      if (result) {
        setMatchAnalysisText(result);
        setIsAiAnalysis(true);
      }
    }).finally(() => {
      if (!cancelled) setIsLoadingAnalysis(false);
    });

    return () => { cancelled = true; };
  }, [recentSession, recentDate, allSessions, players, club?.settings?.geminiApiKey]);

  // 개인 대진 분석 — 경기별 예측 + 재미 요소
  useEffect(() => {
    if (!recentSession || !myPlayerName || Object.keys(allSessions).length === 0) {
      setMyMatchAnalysis(null);
      return;
    }
    const matches = recentSession.schedule.filter(m => m.gameType !== '삭제');
    const allPlayerNames = new Set<string>();
    matches.forEach(m => {
      m.team1.forEach(p => allPlayerNames.add(p));
      m.team2.forEach(p => allPlayerNames.add(p));
    });

    if (!allPlayerNames.has(myPlayerName)) {
      setMyMatchAnalysis('이 날 대진에는 참가하지 않습니다.');
      return;
    }

    // 내 경기 추출
    const myMatches = matches.filter(m =>
      m.team1.includes(myPlayerName) || m.team2.includes(myPlayerName)
    );

    // 전적 캐시
    const oppStats = getOpponentStats(allSessions, myPlayerName);
    const oppMap = new Map(oppStats.map(o => [o.opponent, o]));
    const partStats = getPartnerStats(allSessions, myPlayerName);
    const partMap = new Map(partStats.map(p => [p.partner, p]));

    const lines: string[] = [];
    let totalExcitement = 0;
    let totalDifficulty = 0;
    let hardestMatch = -1;
    let hardestScore = 0;
    let mostExcitingMatch = -1;
    let excitingScore = 0;
    let predictedWins = 0;
    let predictedLosses = 0;

    // 경기별 분석
    for (let mi = 0; mi < myMatches.length; mi++) {
      const match = myMatches[mi];
      const opponents = match.team1.includes(myPlayerName) ? match.team2 : match.team1;
      const partners = (match.team1.includes(myPlayerName) ? match.team1 : match.team2).filter(n => n !== myPlayerName);
      const matchNum = matches.indexOf(match) + 1;
      let excitement = 0;
      let difficulty = 0;
      const comments: string[] = [];

      // 상대 분석
      for (const opp of opponents) {
        const record = oppMap.get(opp);
        if (record && record.games >= 2) {
          if (record.winRate <= 0.25) {
            difficulty += 3;
            excitement += 2;
            const nemPhrases = [
              `${dn(opp)}은 천적! (${Math.round(record.winRate * 100)}%)`,
              `${dn(opp)} 앞에서 쫄지 마세요! (${Math.round(record.winRate * 100)}%)`,
              `주의! ${dn(opp)}에게 약합니다 (${Math.round(record.winRate * 100)}%)`,
            ];
            comments.push(nemPhrases[mi % nemPhrases.length]);
          } else if (record.winRate <= 0.4) {
            difficulty += 2;
            excitement += 1;
            comments.push(`${dn(opp)}에게 약세 (${Math.round(record.winRate * 100)}%)`);
          } else if (record.winRate >= 0.75) {
            difficulty -= 1;
            const domPhrases = [
              `${dn(opp)}은 밥! (${Math.round(record.winRate * 100)}%)`,
              `${dn(opp)} 상대론 여유 (${Math.round(record.winRate * 100)}%)`,
              `${dn(opp)} 가볍게! (${Math.round(record.winRate * 100)}%)`,
            ];
            comments.push(domPhrases[mi % domPhrases.length]);
          } else if (record.winRate >= 0.6) {
            difficulty -= 0.5;
            comments.push(`${dn(opp)}에게 강세 (${Math.round(record.winRate * 100)}%)`);
          } else if (record.games >= 3 && record.winRate >= 0.4 && record.winRate <= 0.6) {
            excitement += 2;
            const rivalPhrases = [
              `${dn(opp)}과 호각세! (${Math.round(record.winRate * 100)}%)`,
              `${dn(opp)}과 팽팽! 접전 예감 (${Math.round(record.winRate * 100)}%)`,
              `${dn(opp)}과 50:50! 스릴 만점 (${Math.round(record.winRate * 100)}%)`,
            ];
            comments.push(rivalPhrases[mi % rivalPhrases.length]);
          }
        } else if (!record || record.games === 0) {
          excitement += 1;
          comments.push(`${dn(opp)} 첫 대결!`);
        }
      }

      // 파트너 분석
      for (const p of partners) {
        const record = partMap.get(p);
        if (record && record.games >= 3 && record.winRate >= 0.7) {
          difficulty -= 1;
          excitement += 1;
          const partPhrases = [
            `파트너 ${dn(p)}과 드림팀! (${Math.round(record.winRate * 100)}%)`,
            `${dn(p)}과 함께면 무적! (${Math.round(record.winRate * 100)}%)`,
            `${dn(p)} 파트너 믿고 간다! (${Math.round(record.winRate * 100)}%)`,
          ];
          comments.push(partPhrases[mi % partPhrases.length]);
        } else if (record && record.games >= 3 && record.winRate <= 0.3) {
          difficulty += 1;
          comments.push(`${dn(p)}과는 궁합이 안 맞을수도... (${Math.round(record.winRate * 100)}%)`);
        }
      }

      totalExcitement += excitement;
      totalDifficulty += difficulty;
      if (difficulty > hardestScore) { hardestScore = difficulty; hardestMatch = mi; }
      if (excitement > excitingScore) { excitingScore = excitement; mostExcitingMatch = mi; }

      // 승패 예측
      if (difficulty >= 2) predictedLosses++;
      else predictedWins++;

      // 경기별 코멘트 생성
      if (comments.length > 0) {
        let emoji = '🎾';
        if (excitement >= 3) emoji = '🔥';
        else if (difficulty >= 2) emoji = '⚡';
        else if (difficulty <= -1) emoji = '😎';
        lines.push(`${emoji} ${matchNum}경기: ${comments.join(', ')}`);
      }
    }

    // 종합 예측
    if (myMatches.length >= 2) {
      const predLines: string[] = [];
      if (hardestMatch >= 0 && hardestScore >= 2) {
        const hMatchNum = matches.indexOf(myMatches[hardestMatch]) + 1;
        const hardPhrases = [
          `${hMatchNum}경기가 최대 고비!`,
          `${hMatchNum}경기가 가장 힘든 싸움!`,
          `${hMatchNum}경기 조심! 여기가 분수령!`,
          `${hMatchNum}경기에서 멘탈 관리 필수!`,
          `${hMatchNum}경기를 넘으면 오늘 완승!`,
        ];
        predLines.push(hardPhrases[(totalDifficulty + myMatches.length) % hardPhrases.length]);
      }
      if (mostExcitingMatch >= 0 && excitingScore >= 2 && mostExcitingMatch !== hardestMatch) {
        const eMatchNum = matches.indexOf(myMatches[mostExcitingMatch]) + 1;
        predLines.push(`${eMatchNum}경기가 가장 기대되는 빅매치!`);
      }
      if (predictedWins > 0 || predictedLosses > 0) {
        const total = predictedWins + predictedLosses;
        if (predictedWins >= total) {
          const sweepPhrases = ['올승 예감!', '전승 가능!', '완벽한 하루 될 듯!'];
          predLines.push(sweepPhrases[myMatches.length % sweepPhrases.length]);
        } else if (predictedWins > predictedLosses) {
          predLines.push(`${predictedWins}승 ${predictedLosses}패 예상!`);
        } else {
          const toughPhrases = ['힘든 하루가 될 수도! 각오 단단히!', '도전의 날! 이겨내면 성장!'];
          predLines.push(toughPhrases[myMatches.length % toughPhrases.length]);
        }
      }
      if (predLines.length > 0) {
        lines.push(`📊 ${predLines.join(' ')}`);
      }
    }

    // 마무리 한마디
    if (lines.length === 0) {
      lines.push(`총 ${myMatches.length}경기 참가!`);
    }
    const closings = [
      '오늘도 파이팅! 🔥',
      '좋은 경기 하세요! 🎾',
      '화이팅! 오늘이 최고의 날! 💪',
      '코트 위 주인공은 바로 당신! ⭐',
      '라켓에 영혼을 담아서! 🏆',
    ];
    const cSeed = myMatches.length * 5 + (totalExcitement + totalDifficulty);
    lines.push(closings[Math.abs(cSeed) % closings.length]);

    const offlineText = lines.join('\n');

    // 데이터 변경 여부 확인 → 같으면 전체 스킵 (AI 결과 보존)
    const personalKey = `${recentDate}-${myPlayerName}-${myMatches.length}-${matches.length}`;
    if (personalKey === lastPersonalAiKeyRef.current) return;
    lastPersonalAiKeyRef.current = personalKey;

    setMyMatchAnalysis(offlineText);
    setIsAiMyAnalysis(false);

    // AI 분석 시도
    const apiKey = club?.settings?.geminiApiKey;
    if (!apiKey || !clubCode || !recentDate) return;

    // AI용 경기 정보 구성
    const matchDetailsForAI = myMatches.map((match, mi) => {
      const opponents = match.team1.includes(myPlayerName) ? match.team2 : match.team1;
      const partners = (match.team1.includes(myPlayerName) ? match.team1 : match.team2).filter(n => n !== myPlayerName);
      const oppRecords: string[] = [];
      const partRecords: string[] = [];
      for (const opp of opponents) {
        const rec = oppMap.get(opp);
        if (rec && rec.games >= 2) oppRecords.push(`${opp}: ${rec.games}전 승률${Math.round(rec.winRate * 100)}%`);
        else oppRecords.push(`${opp}: 전적 없음`);
      }
      for (const p of partners) {
        const rec = partMap.get(p);
        if (rec && rec.games >= 2) partRecords.push(`${p}: ${rec.games}전 승률${Math.round(rec.winRate * 100)}%`);
      }
      return { matchNum: matches.indexOf(match) + 1, opponents, partners, oppRecords, partRecords };
    });

    let cancelled = false;
    setIsLoadingMyAnalysis(true);

    generatePersonalMatchAnalysisAI(apiKey, myPlayerName, offlineText, matchDetailsForAI, myMatches.length, clubCode, recentDate)
      .then((aiResult) => {
        if (cancelled) return;
        if (aiResult) {
          setMyMatchAnalysis(aiResult);
          setIsAiMyAnalysis(true);
        }
      })
      .finally(() => { if (!cancelled) setIsLoadingMyAnalysis(false); });

    return () => { cancelled = true; };
  }, [recentSession, myPlayerName, allSessions, players, club?.settings?.geminiApiKey]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (clubCode) {
      await loadSession(clubCode, today);
      await loadRecentSession();
      await loadDuesAndMyName();
    }
    setRefreshing(false);
  };

  // 회비 상태 변경 핸들러
  const handleDuesStatusChange = async (periodId: string, playerName: string, newStatus: '미납' | '확인요망' | '입금완료') => {
    if (!clubCode) return;
    const updated = await duesService.updatePaymentStatus(clubCode, periodId, playerName, newStatus);
    setDuesData(updated);
  };

  // 회비 버튼 지우기 핸들러
  const handleDuesDismiss = async (periodId: string, playerName: string) => {
    if (!clubCode) return;
    const updated = await duesService.dismissPayment(clubCode, periodId, playerName);
    setDuesData(updated);
  };

  // Create roster by name lookup
  const rosterByName = useMemo(() => {
    const map: Record<string, { gender?: '남' | '여' }> = {};
    players.forEach((p) => {
      map[p.name] = { gender: p.gender };
    });
    return map;
  }, [players]);

  // Today's stats for summary card
  const activeMatches = schedule.filter((m) => m.gameType !== '삭제');
  const todayPlayers = new Set<string>();
  for (const match of activeMatches) {
    match.team1.forEach((p) => todayPlayers.add(p));
    match.team2.forEach((p) => todayPlayers.add(p));
  }

  // Tennis fortune generator (consistent for the same day)
  const getTodayFortune = () => {
    const fortuneMessages = [
      "(주손)잡이가 귀인이다.",
      "(주손)잡이를 조심하라.",
      "이름에 '(자음)' 이 들어가는 사람을 조심하라.",
      "이름에 '(자음)' 이 들어가는 사람이 귀인이다.",
      "(라켓)을(를) 든 사람이 귀인이다.",
      "(라켓)을(를) 든 사람을 조심하라.",
      "(연령대)가 귀인이다.",
      "(연령대)를 조심하라.",
      "애드(백)사이드가 복을 가져다 준다.",
      "듀스(포)사이드가 복을 가져다 준다.",
      "네트 플레이가 행운을 부른다. 과감하게 전진하라.",
      "심호흡이 오늘의 MVP다. 급하면 진다.",
      "볼 줍다가 인생의 기회를 주운다. 허리 조심해라.",
      "오늘의 라이벌은 가장 친한 사람이다. 조심하라.",
      "안경을 쓴 사람이 귀인이다.",
      "모자 쓴 사람과 팀이 되면 기회가 온다.",
      "너무 잘하면 시기받는다. 적당히 해라.",
      "로브는 오늘의 비책이다. 예상치 못한 순간 써라.",
      "물 많이 마시는 사람과 팀이 되면 복이 따른다.",
      "오늘은 '미안!'을 많이 해야 한다.",
      "실수해도 괜찮다. 어차피 모두가 기억 못 한다. 네가 져도 아무도 관심 없다.",
      "오늘 코트 라인은 네 편이 아니다. 걔는 그냥 선이다. 집착하지 마라.",
      "스매시 하려다 미스샷 나면 멘탈 나간다. 그냥 하지 마라.",
      "공 못 맞히면 핑계 준비해라. '바람 때문' 추천한다.",
      "아웃인지 인인지 애매하면 그냥 네 점수라고 우겨라. 운도 뻔뻔한 사람 편이다.",
      "랠리 길어지면 인생 생각하지 마라. 그냥 살아남아라.",
      "공이 네 얼굴을 향하면 회피하지 마라. 운명의 싸움이다.",
      "오늘은 코트에서 철학자 등장 가능. '테니스란 무엇인가' 생각 들면 졌다.",
      "내가 왜 여기 있는지 모르겠으면 물 마셔라. 정신 돌아온다.",
      "내가 실수하더라도 파트너 때문이라고 생각 해라.",
      "테니스 별거 없다. 그냥 치자.",
      "(프로선수) 빙의하는 날.",
      "운세에 의지하지마라.",
      "너의 오늘은 코트 위 별자리다. 연결하면 의미가 된다.",
      "오늘의 행운은 '발'에 있다. 잔발을 많이 구르면 없던 각도 만들어낸다.",
      "첫 서브가 기막히게 들어가면 의심해라. 오늘 운을 거기 다 썼을 수도 있다. 자만 금지.",
      "백핸드 쪽으로 공이 오면 피하지 마라. 오늘은 역크로스가 터지는 날이다.",
      "오늘 너의 필살기는 '침묵'이다. 입으로 테니스 치지 말고 라켓으로 보여줘라.",
      "네트 맞고 들어가는 행운(네트인)이 2번 있을 예정이다. 미안해하지 말고 주먹 불끈 쥐어라.",
      "오늘 스텝이 좀 꼬인다 싶으면 그냥 달리기로 승부해라. 테니스는 발 빠른 놈이 장땡이다.",
      "스코어가 기억 안 나면 당당하게 너한테 유리하게 불러라. 확신에 찬 목소리는 진실보다 강하다.",
      "세게 후려치고 싶은 순간 딱 힘을 30%만 빼라. 그럼 마법처럼 베이스라인 안쪽에 뚝 떨어진다.",
      "오늘 너의 럭키 존은 '센터'다. 멋 부리려고 앵글 샷 날리다 홈런 치지 말고, 그냥 가운데만 파라. 그게 이기는 길이다.",
      "리턴할 때 다운더라인 쳐다보지도 마라. 오늘 넌 조코비치가 아니다. 얌전히 크로스로 넘겨라.",
      "오늘 발리는 '프라이팬'이다. 라켓을 휘두르지 말고 면만 만들어라. 넌 공을 요리할 수 있다.",
      "준비 자세(스플릿 스텝) 없이 공을 치는 건 무면허 운전이다. 콩콩 뛰는 만큼 승률이 올라간다.",
      "게임이 안 풀리면 라켓 줄(스트링)을 심각하게 만지작거려라. 고수들은 다 그렇게 멘탈 잡는다. 일단 있어 보인다.",
      "파트너가 앞에서 알짱거려도 참아라. 홧김에 맞추면 치료비가 더 나온다. 인내심이 돈 버는 거다.",
      "상대가 못 친 게 아니라 네가 공을 잘 준 거다. 착각은 자유고, 그 착각이 오늘의 자신감을 만든다.",
      "기합 소리는 실력과 무관하다. 하지만 샤라포바처럼 지르면 상대가 쫄아서 실수한다. 소리로 제압해라.",
      "신발 끈 꽉 묶어라. 오늘 네가 공을 쫓아다니는 게 아니라, 공이 널 피해 다닐 운명이다. 미친 듯이 뛰어야 산다.",
      "백핸드 슬라이스 자제해라. 멋있게 깔리는 게 아니라 네트에 처박힐 운명이다. 그냥 쳐라.",
      "어려운 공 멋있게 치려 하지 마라. 관중석엔 아무도 없다. '개폼'이라도 넘기는 놈이 승자다.",
      "공을 째려봐라. 네 눈빛에 공이 쫄아서 라인 안으로 들어간다. 끝까지 보는 게 이기는 거다.",
      "오늘은 토스가 전부다. 토스만 일정해도 너는 오늘 코트의 지배자다. 공 띄우는 손에 영혼을 실어라.",
      "상대가 네트 앞에 있으면 무조건 로브다. 키 넘기는 순간 상대의 멘탈도 같이 넘어간다.",
      "발리는 손맛이 아니라 발맛이다. 공이 오면 라켓보다 발이 먼저 마중 나가게 해라.",
      "라인 시비가 붙으면 목소리 깔고 단호하게 말해라. 원래 테니스는 확신범이 이기는 게임이다.",
      "숨이 턱 끝까지 차오르면 신발끈 묶는 척해라. 아무도 모른다. 그 30초가 너를 살린다.",
      "상대가 잘 치면 '운 좋네'라고 중얼거려라. 상대의 실력을 운으로 치부하는 것, 그게 바로 멘탈 방어다."
    ];

    const chosung = ['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅈ','ㅊ','ㅎ'];
    const rackets = ['윌슨', '요넥스', '헤드', '바볼랏', '던롭'];
    const ages = ['20대', '30대', '40대', '50대'];
    const hands = ['오른손', '왼손'];
    const proPlayers = ['페더러','나달','조코비치','정현','신산희','권순우','야닉시너','알카라즈','손흥민','메시','마이클조던','오타니','이재용','젠슨황','무하마드 알리','타이거 우즈','도널드 트럼프','일론 머스크','샤라포바'];

    // 이메일 + 날짜 기반 시드 → 유저마다 다르고, 하루 단위로 변경
    const emailHash = (user?.email || '').split('').reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 0);
    const dateNum = parseInt(today.replace(/-/g, ''), 10);
    const baseSeed = dateNum + Math.abs(emailHash);

    const seededRandom = (seed: number) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };

    const getRandomItem = <T,>(arr: T[], seed: number): T => {
      const index = Math.floor(seededRandom(seed) * arr.length);
      return arr[index];
    };

    // Pick fortune message and replacements
    let fortune = getRandomItem(fortuneMessages, baseSeed);
    fortune = fortune
      .replace('(주손)', getRandomItem(hands, baseSeed + 1))
      .replace('(라켓)', getRandomItem(rackets, baseSeed + 2))
      .replace('(연령대)', getRandomItem(ages, baseSeed + 3))
      .replace('(프로선수)', getRandomItem(proPlayers, baseSeed + 4))
      .replace('(자음)', getRandomItem(chosung, dateNum + 5));

    return fortune;
  };

  const fortune = getTodayFortune();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Navy Header */}
      <View style={styles.navyHeader}>
        <View style={styles.navyHeaderInner}>
          <View style={styles.navyTopRow}>
            <View style={styles.navyUserInfo}>
              <View style={styles.navyAvatar}>
                <FontAwesome name="user" size={20} color="#94A3B8" />
              </View>
              <View>
                <Text style={styles.navyWelcome}>안녕하세요,</Text>
                <Text style={styles.navyUserName}>
                  {myPlayerName ? dn(myPlayerName) : (user?.email?.split('@')[0] || '회원')}님
                </Text>
              </View>
            </View>
            <View style={styles.navyDateBox}>
              <Text style={styles.navyDate}>{todayDisplay}</Text>
              {club?.name && (
                <Text style={styles.navyClubName}>{club.name}</Text>
              )}
            </View>
          </View>

          {myPlayerName && myStats && (
            <View style={styles.navySkillBar}>
              <View style={styles.navySkillItem}>
                <Text style={styles.navySkillLabel}>승률</Text>
                <Text style={styles.navySkillValue}>
                  {(myStats.winRate * 100).toFixed(0)}%
                </Text>
              </View>
              <View style={styles.navySkillDivider} />
              <View style={styles.navySkillItem}>
                <Text style={styles.navySkillLabel}>경기</Text>
                <Text style={styles.navySkillValue}>{myStats.games}</Text>
              </View>
              <View style={styles.navySkillDivider} />
              <View style={styles.navySkillItem}>
                <Text style={styles.navySkillLabel}>출석</Text>
                <Text style={styles.navySkillValue}>{myAttendance}</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* 내 게임 통계 — 3컬럼 그리드 */}
      {myPlayerName && myStats && (() => {
        const g = myStats.games || 1;
        const avgFor = myStats.scoreFor / g;
        const avgAgainst = myStats.scoreAgainst / g;

        return (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push(`/(tabs)/records?player=${encodeURIComponent(myPlayerName)}`)}
          >
            {/* 상단 3컬럼 StatCard */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statCardLabel}>승률</Text>
                <Text style={[styles.statCardValue, { color: colors.accent }]}>
                  {(myStats.winRate * 100).toFixed(0)}%
                </Text>
                <View style={styles.statCardProgress}>
                  <View style={[styles.statCardProgressFill, { width: `${Math.min(myStats.winRate * 100, 100)}%` }]} />
                </View>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statCardLabel}>경기</Text>
                <Text style={styles.statCardValue}>{myStats.games}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statCardLabel}>승</Text>
                <Text style={[styles.statCardValue, { color: colors.success }]}>{myStats.wins}</Text>
              </View>
            </View>

            {/* 보조 통계 카드 */}
            <View style={styles.secondaryStatsCard}>
              <View style={styles.secondaryStatsRow}>
                <View style={styles.secondaryStat}>
                  <Text style={styles.secondaryValue}>{myStats.losses}</Text>
                  <Text style={styles.secondaryLabel}>패</Text>
                </View>
                <View style={styles.secondaryStat}>
                  <Text style={styles.secondaryValue}>{myStats.draws}</Text>
                  <Text style={styles.secondaryLabel}>무</Text>
                </View>
                <View style={styles.secondaryStat}>
                  <Text style={[styles.secondaryValue, { color: colors.warning }]}>{myMvpCount}</Text>
                  <Text style={styles.secondaryLabel}>MVP</Text>
                </View>
                <View style={styles.secondaryStat}>
                  <Text style={styles.secondaryValue}>{myStats.points}</Text>
                  <Text style={styles.secondaryLabel}>점수</Text>
                </View>
                <View style={styles.secondaryStat}>
                  <Text style={styles.secondaryValue}>{avgFor.toFixed(1)}</Text>
                  <Text style={styles.secondaryLabel}>평균득점</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        );
      })()}

      {/* 공지사항 */}
      {!isSectionRestricted('home.notice') && (club?.settings?.notice || isAdmin) && (
        <Card title="공지사항" variant="accent">
          {editingNotice ? (
            <View>
              <TextInput
                style={styles.noticeInput}
                value={noticeText}
                onChangeText={setNoticeText}
                placeholder="공지사항을 입력하세요"
                multiline
                autoFocus
              />
              <View style={styles.noticeActions}>
                <TouchableOpacity
                  style={styles.noticeSaveBtn}
                  onPress={async () => {
                    if (!club?.settings) return;
                    await updateSettings({ ...club.settings, notice: noticeText.trim() });
                    setEditingNotice(false);
                  }}
                >
                  <Text style={styles.noticeSaveBtnText}>저장</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.noticeCancelBtn}
                  onPress={() => setEditingNotice(false)}
                >
                  <Text style={styles.noticeCancelBtnText}>취소</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              activeOpacity={isAdmin ? 0.6 : 1}
              onPress={() => {
                if (!isAdmin) return;
                setNoticeText(club?.settings?.notice || '');
                setEditingNotice(true);
              }}
            >
              {club?.settings?.notice ? (
                <Text style={styles.noticeText}>{club.settings.notice}</Text>
              ) : isAdmin ? (
                <Text style={styles.noticePlaceholder}>✍️ 탭하여 공지사항을 작성하세요</Text>
              ) : null}
              {isAdmin && (
                <View style={styles.noticeEditHint}>
                  <FontAwesome name="pencil" size={11} color="#9ca3af" />
                  <Text style={styles.noticeEditHintText}> 탭하여 수정</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </Card>
      )}

      {/* 회비 입금 (일반회원용) */}
      {!isSectionRestricted('home.payment') && myPlayerName && myDuesItems.length > 0 && (
        <Card title="회비 납부">
          {myDuesItems.map(({ period, record }) => (
            <View key={period.id} style={styles.duesItem}>
              <View style={styles.duesInfo}>
                <Text style={styles.duesName}>{period.name}</Text>
                <Text style={styles.duesAmount}>{(record.amount || period.amount).toLocaleString()}원</Text>
              </View>
              <View style={styles.duesActions}>
                {record.status === '미납' && (() => {
                  const bank = club?.settings?.bankAccount;
                  const hasBank = !!bank?.accountNumber;
                  const hasKakao = !!bank?.kakaoPayUrl;
                  const amt = record.amount || period.amount;

                  const handlePayment = async (type: 'bank' | 'kakao') => {
                    if (type === 'kakao' && bank?.kakaoPayUrl) {
                      try { await Linking.openURL(bank.kakaoPayUrl); } catch {}
                    } else if (type === 'bank' && bank?.accountNumber) {
                      const text = `${bank.bankName} ${bank.accountNumber} (${bank.accountHolder}) ${amt.toLocaleString()}원`;
                      try { await Clipboard.setStringAsync(text); } catch {}
                    }
                    await handleDuesStatusChange(period.id, myPlayerName, '확인요망');
                    if (type === 'bank' && bank?.accountNumber) {
                      const detail = `계좌 정보가 복사되었습니다.\n\n${bank.bankName} ${bank.accountNumber}\n예금주: ${bank.accountHolder}\n금액: ${amt.toLocaleString()}원`;
                      if (Platform.OS === 'web') {
                        alert(detail);
                      } else {
                        Alert.alert('계좌 정보', detail);
                      }
                    } else if (type === 'kakao') {
                      const msg = '카카오페이 송금 페이지로 이동합니다.\n입금 후 관리자가 확인합니다.';
                      Platform.OS === 'web' ? alert(msg) : Alert.alert('알림', msg);
                    }
                  };

                  return (
                    <View style={styles.duesBtnRow}>
                      {hasBank && (
                        <TouchableOpacity
                          style={styles.duesPayBtn}
                          onPress={() => handlePayment('bank')}
                        >
                          <FontAwesome name="credit-card" size={13} color="#fff" />
                          <Text style={styles.duesPayBtnText}> 계좌이체</Text>
                        </TouchableOpacity>
                      )}
                      {hasKakao && (
                        <TouchableOpacity
                          style={[styles.duesPayBtn, styles.duesKakaoBtn]}
                          onPress={() => handlePayment('kakao')}
                        >
                          <FontAwesome name="commenting" size={13} color="#3C1E1E" />
                          <Text style={[styles.duesPayBtnText, styles.duesKakaoBtnText]}> 카카오송금</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })()}
                {record.status === '확인요망' && (
                  <View style={styles.duesPendingRow}>
                    {duesContactPhones.length > 0 && club?.name ? (
                      <TouchableOpacity
                        style={styles.duesRequestBtn}
                        onPress={() => openSmsToAdmin(duesContactPhones, club.name, myPlayerName, record.amount || period.amount, period.name)}
                      >
                        <FontAwesome name="envelope-o" size={12} color="#fff" />
                        <Text style={styles.duesRequestBtnText}> 확인요청</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.duesPendingBadge}>
                        <FontAwesome name="clock-o" size={12} color="#92400e" />
                        <Text style={styles.duesPendingText}> 입금대기</Text>
                      </View>
                    )}
                    <TouchableOpacity onPress={() => handleDuesStatusChange(period.id, myPlayerName, '미납')}>
                      <Text style={styles.duesRetryText}>재입금</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {record.status === '입금완료' && (
                  <View style={styles.duesDoneRow}>
                    <View style={styles.duesDoneBadge}>
                      <FontAwesome name="check-circle" size={12} color="#16a34a" />
                      <Text style={styles.duesDoneText}> 입금확인완료</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.duesDismissBtn}
                      onPress={() => handleDuesDismiss(period.id, myPlayerName)}
                    >
                      <Text style={styles.duesDismissText}>지우기</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          ))}
        </Card>
      )}

      {/* Today's Tennis Fortune */}
      {!isSectionRestricted('home.fortune') && (
        <Card>
          <View style={styles.fortuneContainer}>
            <View style={styles.fortuneHeader}>
              <Text style={styles.fortuneEmoji}>🍀</Text>
              <Text style={styles.fortuneTitle}>오늘의 테니스 운세</Text>
            </View>
            <Text style={styles.fortuneMessage}>{fortune}</Text>
          </View>
        </Card>
      )}

      {/* 건강 데이터 (스마트워치 연동 준비) */}
      {!isSectionRestricted('home.health') && (
        <Card title="오늘의 활동">
          <View style={styles.healthGrid}>
            <View style={styles.healthItem}>
              <View style={[styles.healthIconBox, { backgroundColor: colors.errorBg }]}>
                <FontAwesome name="heartbeat" size={20} color="#EF4444" />
              </View>
              <Text style={styles.healthValue}>--</Text>
              <Text style={styles.healthLabel}>소모 칼로리</Text>
              <Text style={styles.healthUnit}>kcal</Text>
            </View>
            <View style={styles.healthDivider} />
            <View style={styles.healthItem}>
              <View style={[styles.healthIconBox, { backgroundColor: colors.infoBg }]}>
                <FontAwesome name="road" size={18} color="#3b82f6" />
              </View>
              <Text style={styles.healthValue}>--</Text>
              <Text style={styles.healthLabel}>걸음 수</Text>
              <Text style={styles.healthUnit}>걸음</Text>
            </View>
            <View style={styles.healthDivider} />
            <View style={styles.healthItem}>
              <View style={[styles.healthIconBox, { backgroundColor: colors.successBg }]}>
                <FontAwesome name="clock-o" size={20} color="#10B981" />
              </View>
              <Text style={styles.healthValue}>--</Text>
              <Text style={styles.healthLabel}>운동 시간</Text>
              <Text style={styles.healthUnit}>분</Text>
            </View>
          </View>
          <View style={styles.healthConnectRow}>
            <FontAwesome name="bluetooth-b" size={12} color={colors.textTertiary} />
            <Text style={styles.healthConnectText}>
              {Platform.OS === 'web'
                ? '스마트워치 연동은 모바일 앱에서 지원됩니다'
                : '스마트워치 연동 준비 중'}
            </Text>
          </View>
        </Card>
      )}

      {/* 대진 분석 카드 */}
      {matchAnalysisText && recentSession && recentDate && (
        <Card title={`대진 분석 - ${format(parseISO(recentDate), 'M월 d일', { locale: ko })}${recentDate === today ? ' (오늘)' : ''}`} variant="elevated">
          <View style={styles.analysisCard}>
            {matchAnalysisText.title ? (
              <View style={styles.analysisTitleRow}>
                <Text style={styles.analysisTitle}>"{matchAnalysisText.title}"</Text>
                {isAiAnalysis && (
                  <View style={styles.aiBadge}>
                    <Text style={styles.aiBadgeText}>AI</Text>
                  </View>
                )}
              </View>
            ) : null}
            <Text style={styles.analysisSummary}>{matchAnalysisText.summary}</Text>
            {isLoadingAnalysis && (
              <Text style={styles.analysisLoading}>AI 분석 중...</Text>
            )}
          </View>
          {/* 개인 대진 분석 */}
          {myPlayerName && myMatchAnalysis && (
            <>
              <View style={{ borderTopWidth: 1, borderTopColor: colors.divider, marginVertical: spacing.md }} />
              <View style={styles.analysisCard}>
                <View style={styles.analysisTitleRow}>
                  <Text style={{ ...typography.captionMedium, fontWeight: '700', color: colors.text }}>
                    🎾 {dn(myPlayerName)}의 대진
                  </Text>
                  {isAiMyAnalysis && (
                    <View style={styles.aiBadge}>
                      <Text style={styles.aiBadgeText}>AI</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.analysisSummary}>{myMatchAnalysis}</Text>
                {isLoadingMyAnalysis && (
                  <Text style={styles.analysisLoading}>AI 분석 중...</Text>
                )}
              </View>
            </>
          )}
        </Card>
      )}

      {/* Most Recent Schedule */}
      {!isSectionRestricted('home.recentSchedule') && recentSession && recentSession.schedule && (() => {
        const recentMatches = recentSession.schedule.filter((m) => m.gameType !== '삭제');
        if (recentMatches.length === 0) return null;

        const recentCompletion = getCompletionPercentage(recentSession);
        const recentDateDisplay = recentDate
          ? format(parseISO(recentDate), 'M월 d일 (EEE)', { locale: ko })
          : '';
        const isRecentToday = recentDate === today;
        const showProb = club?.settings?.showWinProbability !== false && Object.keys(allSessions).length > 0;

        // Calculate max court number for round detection
        const maxCourt = Math.max(...recentMatches.map(m => m.court || 1));
        const groupsSnapshot = recentSession.groupsSnapshot;
        const isGroupMode = recentSession.groupOnly && groupsSnapshot && Object.keys(groupsSnapshot).length > 0;

        // 매치 렌더링 함수 (조별/전체 공용)
        const renderMatchRow = (match: typeof recentMatches[0], origIndex: number, displayNum: number) => {
                const result = recentSession.results?.[String(origIndex + 1)];
                const s1 = result?.t1;
                const s2 = result?.t2;
                const hasResult = s1 !== null && s1 !== undefined;
                const team1Won = hasResult && s1 > s2;
                const team2Won = hasResult && s2 > s1;
                const isDraw = hasResult && s1 === s2;
                const courtNum = match.court || 1;
                const prob = showProb ? calculateMatchProbability(allSessions, match.team1, match.team2) : null;

                return (
                    <View key={origIndex} style={styles.matchTableRow}>
                      <View style={[styles.matchTableCell, styles.cellTeam, styles.cellTeam1]}>
                        {match.team1.map((name, i) => {
                          const partner = match.team1.find(p => p !== name) || null;
                          return (
                            <View key={i} style={styles.playerNameRow}>
                              <TouchableOpacity
                                style={styles.recordBtn}
                                onPress={() => setRecordModal({
                                  visible: true, player: name, partner, opponents: match.team2, filterMode: 'all',
                                })}
                              >
                                <FontAwesome name="bar-chart" size={9} color="#3b82f6" />
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => router.push(`/(tabs)/records?player=${encodeURIComponent(name)}`)}>
                                <PlayerNameBadge name={dn(name)} gender={rosterByName[name]?.gender} />
                              </TouchableOpacity>
                            </View>
                          );
                        })}
                      </View>
                      <View style={[styles.matchTableCell, styles.cellScoreCol]}>
                        <Text style={styles.matchNoLabel}>{displayNum}경기 {courtNum}코트</Text>
                        {showProb && prob?.hasEnoughData && (
                          <View style={styles.probRow}>
                            <Text style={[styles.probText, prob.team1WinRate != null && prob.team1WinRate > 0.5 && styles.probTextHigh]}>
                              {prob.team1WinRate !== null ? `${Math.max(10, Math.round(prob.team1WinRate * 100))}%` : ''}
                            </Text>
                            <Text style={styles.probVs}>vs</Text>
                            <Text style={[styles.probText, prob.team2WinRate != null && prob.team2WinRate > 0.5 && styles.probTextHigh]}>
                              {prob.team2WinRate !== null ? `${Math.max(10, Math.round(prob.team2WinRate * 100))}%` : ''}
                            </Text>
                          </View>
                        )}
                        <View style={styles.scoreRow}>
                          <Text style={[styles.scoreText, team1Won && styles.scoreWinner, team2Won && styles.scoreLoss, isDraw && styles.scoreDraw]}>
                            {s1 ?? '-'}
                          </Text>
                          <Text style={styles.scoreColon}>:</Text>
                          <Text style={[styles.scoreText, team2Won && styles.scoreWinner, team1Won && styles.scoreLoss, isDraw && styles.scoreDraw]}>
                            {s2 ?? '-'}
                          </Text>
                        </View>
                      </View>
                      <View style={[styles.matchTableCell, styles.cellTeam, styles.cellTeam2]}>
                        {match.team2.map((name, i) => {
                          const partner = match.team2.find(p => p !== name) || null;
                          return (
                            <View key={i} style={styles.playerNameRow}>
                              <TouchableOpacity onPress={() => router.push(`/(tabs)/records?player=${encodeURIComponent(name)}`)}>
                                <PlayerNameBadge name={dn(name)} gender={rosterByName[name]?.gender} />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.recordBtn}
                                onPress={() => setRecordModal({
                                  visible: true, player: name, partner, opponents: match.team1, filterMode: 'all',
                                })}
                              >
                                <FontAwesome name="bar-chart" size={9} color="#3b82f6" />
                              </TouchableOpacity>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                );
        };

        return (
          <Card title={`최근 대진표 - ${recentDateDisplay}${isRecentToday ? ' (오늘)' : ''}`}>
            <View style={styles.matchTable}>
              {/* 헤더 */}
              <View style={styles.matchTableHeader}>
                <View style={[styles.matchTableCell, styles.cellTeamHeader, styles.cellTeam1Header]}>
                  <Text style={styles.headerText}>팀1</Text>
                </View>
                <Text style={[styles.matchTableCell, styles.cellScoreHeader]}>점수</Text>
                <View style={[styles.matchTableCell, styles.cellTeamHeader, styles.cellTeam2Header]}>
                  <Text style={styles.headerText}>팀2</Text>
                </View>
              </View>
              {/* 경기 목록 */}
              {isGroupMode ? (() => {
                // 조별 분리 모드
                const groupMap: Record<string, { match: typeof recentMatches[0]; origIdx: number }[]> = {};
                recentMatches.forEach((m, i) => {
                  const g = groupsSnapshot[m.team1[0]] || '미배정';
                  if (!groupMap[g]) groupMap[g] = [];
                  groupMap[g].push({ match: m, origIdx: i });
                });
                const sortedGroups = Object.keys(groupMap).sort((a, b) => {
                  if (a === '미배정') return 1;
                  if (b === '미배정') return -1;
                  return a.localeCompare(b, 'ko');
                });
                return sortedGroups.map(gName => (
                  <React.Fragment key={gName}>
                    <View style={styles.roundDivider}>
                      <View style={styles.roundDividerLine} />
                      <Text style={[styles.roundDividerText, { color: colors.primary, fontWeight: '700' }]}>{gName} 대진</Text>
                      <View style={styles.roundDividerLine} />
                    </View>
                    {groupMap[gName].map((item, groupLocalIdx) =>
                      renderMatchRow(item.match, item.origIdx, groupLocalIdx + 1)
                    )}
                  </React.Fragment>
                ));
              })() : recentMatches.map((match, index) => {
                const courtNum = match.court || 1;
                const isNewRound = index === 0 || courtNum === 1;
                const roundNum = Math.floor(index / maxCourt) + 1;
                return (
                  <React.Fragment key={index}>
                    {isNewRound && (
                      <View style={styles.roundDivider}>
                        <View style={styles.roundDividerLine} />
                        <Text style={styles.roundDividerText}>{roundNum}라운드</Text>
                        <View style={styles.roundDividerLine} />
                      </View>
                    )}
                    {renderMatchRow(match, index, index + 1)}
                  </React.Fragment>
                );
              })}
            </View>

            <View style={styles.completionRow}>
              <Text style={styles.completionText}>{recentCompletion}% 완료</Text>
            </View>
          </Card>
        );
      })()}

      {/* Player Record Modal */}
      <Modal
        visible={recordModal.visible}
        animationType="fade"
        transparent
        onRequestClose={() => setRecordModal({ ...recordModal, visible: false })}
      >
        <View style={styles.recordOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setRecordModal({ ...recordModal, visible: false })}
          />
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
                  const winRate = Math.round((h2h.asPartner.wins / h2h.asPartner.games) * 100);
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
              {Object.keys(allSessions).length === 0 ? (
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
                  const winRate = Math.round((h2h.asOpponent.wins / h2h.asOpponent.games) * 100);
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
        </View>
      </Modal>

      {/* Empty state - only show if no recent session */}
      {!recentSession && (
        <Card>
          <View style={styles.emptyState}>
            <FontAwesome name="calendar-o" size={40} color={colors.textTertiary} />
            <Text style={styles.emptyText}>아직 등록된 경기가 없어요 🥺</Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push('/(tabs)/match')}
            >
              <Text style={styles.emptyButtonText}>🎯 대진표 만들기</Text>
            </TouchableOpacity>
          </View>
        </Card>
      )}

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
    padding: layout.screenPadding,
    paddingTop: 0,
    paddingBottom: spacing['3xl'],
    maxWidth: MAX_WIDTH,
    alignSelf: 'center',
    width: '100%',
  },
  // Navy Header
  navyHeader: {
    backgroundColor: colors.navy,
    borderBottomLeftRadius: layout.headerBottomRadius,
    borderBottomRightRadius: layout.headerBottomRadius,
    marginHorizontal: -layout.screenPadding,
    paddingTop: 56,
    paddingHorizontal: 24,
    paddingBottom: 24,
    marginBottom: -12,
  },
  navyHeaderInner: {
    maxWidth: MAX_WIDTH,
    width: '100%',
    alignSelf: 'center',
  },
  navyTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  navyUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navyAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.navyLight,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navyWelcome: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  navyUserName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  navyDateBox: {
    alignItems: 'flex-end',
  },
  navyDate: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  navyClubName: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  navySkillBar: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navySkillItem: {
    alignItems: 'center',
  },
  navySkillLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  navySkillValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  navySkillDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  // 통계 3컬럼 그리드
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: layout.sectionGap,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.navy,
    borderRadius: radius.lg,
    padding: 16,
    alignItems: 'center',
    borderWidth: 0,
  },
  statCardLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  statCardValue: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.white,
  },
  statCardProgress: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    marginTop: 8,
    overflow: 'hidden',
  },
  statCardProgressFill: {
    height: 4,
    backgroundColor: colors.primary,
    borderRadius: 999,
  },
  secondaryStatsCard: {
    backgroundColor: colors.navy,
    borderRadius: radius.lg,
    padding: 14,
    marginTop: 12,
    borderWidth: 0,
  },
  secondaryStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  secondaryStat: {
    alignItems: 'center',
  },
  secondaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
  secondaryLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  // 회비 스타일
  duesItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  duesInfo: {
    flex: 1,
  },
  duesName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  duesAmount: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  duesActions: {
    marginLeft: spacing.md,
  },
  duesPayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  duesPayBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.black,
  },
  duesBtnRow: {
    flexDirection: 'row',
    gap: 6,
  },
  duesKakaoBtn: {
    backgroundColor: '#FEE500',
  },
  duesKakaoBtnText: {
    color: '#3C1E1E',
  },
  duesPendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  duesRequestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f97316',
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.sm,
  },
  duesRequestBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  duesRetryText: {
    fontSize: 12,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
  // 공지사항
  noticeText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 21,
  },
  noticePlaceholder: {
    fontSize: 14,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
  noticeEditHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  noticeEditHintText: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  noticeInput: {
    borderWidth: 1,
    borderColor: colors.textTertiary,
    borderRadius: radius.sm,
    padding: 10,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.card,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  noticeActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: 10,
  },
  noticeSaveBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  noticeSaveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.black,
  },
  noticeCancelBtn: {
    backgroundColor: colors.borderLight,
    paddingHorizontal: spacing.xl,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  noticeCancelBtnText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  duesPendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningBg,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#5F4B00',
  },
  duesPendingText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.warning,
  },
  duesDoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  duesDoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  duesDoneText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.success,
  },
  duesDismissBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  duesDismissText: {
    fontSize: 12,
    color: colors.textTertiary,
    textDecorationLine: 'underline',
  },
  // 건강 데이터 스타일
  healthGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
  },
  healthItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  healthIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  healthValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  healthLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  healthUnit: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.textTertiary,
  },
  healthDivider: {
    width: 1,
    height: 60,
    backgroundColor: colors.divider,
    alignSelf: 'center',
  },
  healthConnectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  healthConnectText: {
    fontSize: 11,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  // Match table styles (matching records.tsx)
  matchTable: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  matchTableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.navy,
    paddingVertical: 10,
  },
  matchTableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.card,
  },
  matchTableCell: {
    paddingHorizontal: spacing.xs,
  },
  cellTeam: {
    flex: 1,
    paddingHorizontal: spacing.xs,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 0,
  },
  cellTeam1: {
    justifyContent: 'flex-end',
  },
  cellTeam2: {
    justifyContent: 'flex-start',
  },
  cellTeamHeader: {
    flex: 1,
    paddingHorizontal: 6,
  },
  cellTeam1Header: {
    alignItems: 'flex-end',
  },
  cellTeam2Header: {
    alignItems: 'flex-start',
  },
  headerText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.5,
  },
  cellScoreHeader: {
    width: 80,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.5,
  },
  cellScoreCol: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  matchNoLabel: {
    fontSize: 10,
    color: colors.textTertiary,
    fontWeight: '600',
    marginBottom: 3,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textSecondary,
    width: 20,
    textAlign: 'center',
  },
  scoreWinner: {
    color: colors.success,
  },
  scoreDraw: {
    color: colors.textTertiary,
  },
  scoreLoss: {
    color: colors.error,
  },
  scoreColon: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textTertiary,
    marginHorizontal: 4,
  },
  // Round divider styles
  roundDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.borderLight,
  },
  roundDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  roundDividerText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.navy,
    paddingHorizontal: 10,
    letterSpacing: 0.5,
  },
  // Name badge styles
  nameBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius.sm,
    maxWidth: 70,
  },
  nameBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  completionRow: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    alignItems: 'center',
  },
  completionText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  // Player record & probability styles
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  recordBtn: {
    padding: 3,
    backgroundColor: colors.male.bg,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },
  probRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    marginBottom: 2,
  },
  probText: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.textTertiary,
    minWidth: 20,
    textAlign: 'center',
  },
  probTextHigh: {
    color: colors.success,
    fontWeight: '700',
  },
  probVs: {
    fontSize: 8,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  // Record modal styles
  recordOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordModalContainer: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing['2xl'],
    width: '90%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  recordModalTitle: {
    ...typography.title,
    fontSize: 18,
    fontWeight: '800',
    color: colors.navy,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  recordFilterRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  recordFilterBtn: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: radius.full,
    backgroundColor: colors.borderLight,
  },
  recordFilterBtnActive: {
    backgroundColor: colors.navy,
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
    backgroundColor: colors.borderLight,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  recordCloseBtnText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
  },
  emptyText: {
    fontSize: 15,
    color: colors.textTertiary,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  emptyButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: spacing['2xl'],
    borderRadius: radius.lg,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.black,
    letterSpacing: 0.3,
  },
  // Fortune styles
  fortuneContainer: {
    backgroundColor: colors.navy,
    borderRadius: radius.md,
    padding: 18,
  },
  fortuneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  fortuneEmoji: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  fortuneTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent,
  },
  fortuneMessage: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 22,
  },
  // 대진 분석 스타일
  analysisCard: {
    gap: spacing.sm,
  },
  analysisTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 4,
  },
  analysisTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.accent,
    backgroundColor: colors.navy,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  aiBadge: {
    backgroundColor: colors.navy,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  aiBadgeText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  analysisSummary: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  analysisLoading: {
    fontSize: 12,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
});
