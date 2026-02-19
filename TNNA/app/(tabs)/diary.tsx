import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform, ActivityIndicator,
} from 'react-native';
import Svg, { Polygon, Line, Circle as SvgCircle, Text as SvgText } from 'react-native-svg';
import { FontAwesome } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';
import { useClubStore } from '../../stores/clubStore';
import { usePlayerStore } from '../../stores/playerStore';
import { useDiaryStore } from '../../stores/diaryStore';
import { Card, Button, Input, SegmentedTabs, ProgressBar, Chip, StatPill } from '../../components/ui';
import { colors, spacing, radius, typography, MAX_WIDTH, FONT_FAMILY } from '../../theme/tokens';
import { getHexagonPoints, buildPolygonString, buildDataPolygon } from '../../utils/radarChart';
import { RadarStatKey, SubStatKey, SkillKey, RacketInfo, StringInfo, DiaryEntry, DiaryMood, Match, MatchResult, Session, PersonalGame, CourtPosition, PlayerRating, GearSnapshot, PlayerEvaluation } from '../../types';
import * as diaryDataSvc from '../../services/diaryData';
import { generateDiaryAnalysisAI } from '../../services/gemini';
import { getSessionDates, getSession } from '../../services/sessions';
import { getMemberNames, saveMemberName } from '../../services/localData';

// ─── Constants ──────────────────────────────────
const MAIN_TABS = [
  { key: 'gear', label: '장비' },
  { key: 'radar', label: '레이더' },
  { key: 'journal', label: '일지' },
  { key: 'ai', label: 'AI분석' },
];

const STAT_LABELS: Record<RadarStatKey, string> = {
  serve: '서브',
  forehand: '포핸드',
  backhand: '백핸드',
  volley: '발리',
  step: '스텝',
  mental: '멘탈',
};

const SUB_STAT_LABELS: Record<SubStatKey, string> = {
  slice: '슬라이스',
  drop: '드롭샷',
  lob: '로브',
};

const MOOD_OPTIONS: { key: DiaryMood; label: string; emoji: string }[] = [
  { key: 'great', label: '최고', emoji: '🔥' },
  { key: 'good', label: '좋음', emoji: '😊' },
  { key: 'normal', label: '보통', emoji: '😐' },
  { key: 'bad', label: '나쁨', emoji: '😞' },
  { key: 'terrible', label: '최악', emoji: '😫' },
];

const SKILL_OPTIONS: { key: SkillKey; label: string }[] = [
  { key: 'forehand', label: '포핸드' },
  { key: 'backhand', label: '백핸드' },
  { key: 'serve', label: '서브' },
  { key: 'volley', label: '발리' },
  { key: 'step', label: '스텝' },
  { key: 'mental', label: '멘탈' },
  { key: 'slice', label: '슬라이스' },
  { key: 'drop', label: '드롭샷' },
  { key: 'lob', label: '로브' },
];

const ALL_SKILL_LABELS: Record<SkillKey, string> = {
  ...STAT_LABELS,
  ...SUB_STAT_LABELS,
};

const STAT_KEYS: RadarStatKey[] = ['serve', 'forehand', 'backhand', 'volley', 'step', 'mental'];
const SUB_KEYS: SubStatKey[] = ['slice', 'drop', 'lob'];

// ─── Helpers ────────────────────────────────────
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function calcLifespan(replacedAt: string, gamesSinceReplace: number, maxDays: number, maxGames: number) {
  const days = Math.max(0, (Date.now() - new Date(replacedAt).getTime()) / (1000 * 60 * 60 * 24));
  const dayRatio = 1 - days / maxDays;
  const gameRatio = 1 - gamesSinceReplace / maxGames;
  return Math.max(0, Math.min(1, Math.min(dayRatio, gameRatio)));
}

function lifespanColor(v: number) {
  if (v > 0.66) return colors.success;
  if (v > 0.33) return colors.warning;
  return colors.error;
}

function emojiGauge(v: number): string {
  const filled = Math.round(v * 5);
  const empty = 5 - filled;
  const block = v > 0.66 ? '🟩' : v > 0.33 ? '🟨' : '🟥';
  return block.repeat(filled) + '⬜'.repeat(empty);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ─── My Game record type ────────────────────────
interface MyGame {
  date: string;
  matchIndex: number;
  match: Match;
  result: MatchResult | null;
  isTeam1: boolean; // which team I'm on
}

function getResultLabel(game: MyGame): string {
  if (!game.result || game.result.t1 == null || game.result.t2 == null) return '미입력';
  const my = game.isTeam1 ? game.result.t1 : game.result.t2;
  const opp = game.isTeam1 ? game.result.t2 : game.result.t1;
  if (my > opp) return '승';
  if (my === opp) return '무';
  return '패';
}

function getResultColor(label: string): string {
  if (label === '승') return colors.success;
  if (label === '패') return colors.error;
  if (label === '무') return colors.warning;
  return colors.textTertiary;
}

function getScoreText(game: MyGame): string {
  if (!game.result || game.result.t1 == null || game.result.t2 == null) return '-';
  return `${game.result.t1} : ${game.result.t2}`;
}

function pgResultLabel(pg: PersonalGame): string {
  if (pg.myScore == null || pg.oppScore == null) return '미입력';
  if (pg.myScore > pg.oppScore) return '승';
  if (pg.myScore === pg.oppScore) return '무';
  return '패';
}

function pgScoreText(pg: PersonalGame): string {
  if (pg.myScore == null || pg.oppScore == null) return '-';
  return `${pg.myScore} : ${pg.oppScore}`;
}

// Unified timeline item
type TimelineItem =
  | { type: 'club'; date: string; game: MyGame }
  | { type: 'personal'; date: string; pg: PersonalGame };

// ─── Share helper ───────────────────────────────
async function shareRadarImage(ref: React.RefObject<View | null>) {
  if (!ref.current) return;
  try {
    if (Platform.OS === 'web') {
      const { default: html2canvas } = await import('html2canvas' as any).catch(() => ({ default: null }));
      if (html2canvas && (ref.current as any)._nativeTag !== undefined) {
        // web fallback — not always available
      }
      // Simple web fallback: copy text
      return;
    }
    const { captureRef } = await import('react-native-view-shot');
    const uri = await captureRef(ref, { format: 'png', quality: 0.95 });
    const { shareAsync } = await import('expo-sharing');
    await shareAsync(uri, { mimeType: 'image/png', dialogTitle: '테니스 레이더 공유' });
  } catch (e) {
    console.warn('Share error:', e);
  }
}

// ─── Component ──────────────────────────────────
export default function DiaryScreen() {
  const { user } = useAuthStore();
  const { clubCode, club } = useClubStore();
  const { players } = usePlayerStore();
  const store = useDiaryStore();

  const [activeTab, setActiveTab] = useState('gear');
  const [showCompare, setShowCompare] = useState(false);
  // Racket add form
  const [showAddRacket, setShowAddRacket] = useState(false);
  const [newBrand, setNewBrand] = useState('');
  const [newModel, setNewModel] = useState('');

  // String edit
  const [editStringId, setEditStringId] = useState<string | null>(null);
  const [stringName, setStringName] = useState('');
  const [stringTension, setStringTension] = useState('');

  // Shoes edit
  const [editShoes, setEditShoes] = useState(false);
  const [shoeBrand, setShoeBrand] = useState('');
  const [shoeModel, setShoeModel] = useState('');

  // Journal
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [editEntryId, setEditEntryId] = useState<string | null>(null);
  const [entryTitle, setEntryTitle] = useState('');
  const [entryContent, setEntryContent] = useState('');
  const [entryMood, setEntryMood] = useState<DiaryMood>('normal');
  const [entryGoodSkills, setEntryGoodSkills] = useState<SkillKey[]>([]);
  const [entryBadSkills, setEntryBadSkills] = useState<SkillKey[]>([]);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [selectedGameForEntry, setSelectedGameForEntry] = useState<MyGame | null>(null);
  const [entryServeAcc, setEntryServeAcc] = useState('');
  const [entryGearSnapshot, setEntryGearSnapshot] = useState<GearSnapshot>({});
  const [entryOpponents, setEntryOpponents] = useState<string[]>([]);
  const [entryPartners, setEntryPartners] = useState<string[]>([]);
  const [playerRatings, setPlayerRatings] = useState<Record<string, { goodSkills: SkillKey[]; badSkills: SkillKey[] }>>({});
  const [expandedRatingPlayer, setExpandedRatingPlayer] = useState<string | null>(null);

  // Personal game add form
  const [showAddPersonal, setShowAddPersonal] = useState(false);
  const [editPersonalId, setEditPersonalId] = useState<string | null>(null);
  const [pgGameType, setPgGameType] = useState<'단식' | '복식'>('복식');
  const [pgDate, setPgDate] = useState(todayStr());
  const [pgOpp1, setPgOpp1] = useState('');
  const [pgOpp2, setPgOpp2] = useState('');
  const [pgPartners, setPgPartners] = useState('');
  const [pgMyScore, setPgMyScore] = useState('');
  const [pgOppScore, setPgOppScore] = useState('');
  const [pgLocation, setPgLocation] = useState('');
  const [pgPosition, setPgPosition] = useState<CourtPosition | null>(null);

  // My games history
  const [myPlayerName, setMyPlayerName] = useState<string | null>(null);
  const [myGames, setMyGames] = useState<MyGame[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);

  // Share ref
  const radarShareRef = useRef<View>(null);

  const email = user?.email || '';
  const geminiKey = club?.settings?.geminiApiKey || '';

  // Load data
  useEffect(() => {
    if (clubCode && email) {
      store.loadAll(clubCode, email, myPlayerName || undefined);
    }
  }, [clubCode, email, myPlayerName]);

  // Resolve player name from email
  useEffect(() => {
    if (!clubCode || !email) return;
    getMemberNames(clubCode).then(async (names) => {
      let name = names[email.toLowerCase()] || null;
      if (!name) {
        const linked = players.find(p => p.email?.toLowerCase() === email.toLowerCase());
        if (linked) {
          name = linked.name;
          await saveMemberName(clubCode, email, linked.name);
        }
      }
      setMyPlayerName(name);
    });
  }, [clubCode, email, players]);

  // Load my games history
  useEffect(() => {
    if (!clubCode || !myPlayerName) return;
    let cancelled = false;
    setGamesLoading(true);

    (async () => {
      const dates = await getSessionDates(clubCode);
      const games: MyGame[] = [];

      for (const date of dates) {
        if (games.length >= 100) break; // limit for perf
        const session = await getSession(clubCode, date);
        if (!session?.schedule) continue;

        session.schedule.forEach((match, idx) => {
          if (match.gameType === '삭제') return;
          const inTeam1 = match.team1.includes(myPlayerName);
          const inTeam2 = match.team2.includes(myPlayerName);
          if (!inTeam1 && !inTeam2) return;

          const resultKey = String(idx + 1);
          const result = session.results?.[resultKey] || null;
          games.push({ date, matchIndex: idx, match, result, isTeam1: inTeam1 });
        });
      }

      if (!cancelled) {
        setMyGames(games);
        setGamesLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [clubCode, myPlayerName]);

  // Map of matchDate → diary entry (for showing written/unwritten state)
  const entryByMatchDate = useMemo(() => {
    const map: Record<string, DiaryEntry> = {};
    store.entries.forEach(e => {
      if (e.matchDate) map[e.matchDate] = e;
    });
    return map;
  }, [store.entries]);

  // Unified timeline: club games + personal games, grouped by date
  const timelineByDate = useMemo(() => {
    const map: Record<string, TimelineItem[]> = {};
    myGames.forEach(g => {
      if (!map[g.date]) map[g.date] = [];
      map[g.date].push({ type: 'club', date: g.date, game: g });
    });
    store.personalGames.forEach(pg => {
      if (!map[pg.date]) map[pg.date] = [];
      map[pg.date].push({ type: 'personal', date: pg.date, pg });
    });
    return map;
  }, [myGames, store.personalGames]);

  const timelineDates = useMemo(() =>
    Object.keys(timelineByDate).sort((a, b) => b.localeCompare(a)),
  [timelineByDate]);

  // 교체일 이후 등록된 게임 자동 카운트
  const countGamesAfter = useCallback((sinceDate: string): number => {
    const since = sinceDate.slice(0, 10); // YYYY-MM-DD
    let count = 0;
    myGames.forEach(g => { if (g.date >= since) count++; });
    store.personalGames.forEach(pg => { if (pg.date >= since) count++; });
    return count;
  }, [myGames, store.personalGames]);

  // 최근 8주 기반 주간 운동 빈도 → 스트링 교체 주기 자동 결정
  const weeklyFreq = useMemo(() => {
    const now = Date.now();
    const cutoff = new Date(now - 8 * 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    let cnt = 0;
    myGames.forEach(g => { if (g.date >= cutoff) cnt++; });
    store.personalGames.forEach(pg => { if (pg.date >= cutoff) cnt++; });
    return cnt / 8;
  }, [myGames, store.personalGames]);

  // 주 1회→1년, 주 2회→6개월, 주 3회+→3.5개월
  const stringCycle = useMemo(() => {
    if (weeklyFreq >= 3) return { maxDays: 105, maxGames: 45, label: '주3회+ → 3~4개월' };
    if (weeklyFreq >= 2) return { maxDays: 180, maxGames: 52, label: '주2회 → 6개월' };
    return { maxDays: 365, maxGames: 52, label: '주1회 → 1년' };
  }, [weeklyFreq]);

  // ─── 누적 기반 레이더 자동 계산 ─────────────
  const computedStats = useMemo(() => {
    const allKeys: SkillKey[] = [...STAT_KEYS, ...SUB_KEYS];
    const scores: Record<string, { good: number; bad: number }> = {};
    allKeys.forEach(k => { scores[k] = { good: 0, bad: 0 }; });
    let totalEntries = 0;

    // 내 일지 (self-eval)
    store.entries.forEach(entry => {
      if (!entry.goodSkills?.length && !entry.badSkills?.length) return;
      totalEntries++;

      // 승/패 가중치: 승리 시 잘한것 1.5x, 패배 시 못한것 1.5x
      let isWin = false;
      let isLoss = false;
      if (entry.matchDate) {
        if (entry.matchDate.startsWith('pg_')) {
          const pg = store.personalGames.find(g => `pg_${g.id}` === entry.matchDate);
          if (pg && pg.myScore != null && pg.oppScore != null) {
            isWin = pg.myScore > pg.oppScore;
            isLoss = pg.myScore < pg.oppScore;
          }
        } else {
          const game = myGames.find(g => `${g.date}_${g.matchIndex}` === entry.matchDate);
          if (game) {
            const label = getResultLabel(game);
            isWin = label === '승';
            isLoss = label === '패';
          }
        }
      }

      entry.goodSkills?.forEach(sk => { if (scores[sk]) scores[sk].good += isWin ? 1.5 : 1; });
      entry.badSkills?.forEach(sk => { if (scores[sk]) scores[sk].bad += isLoss ? 1.5 : 1; });
    });

    // 다른 사람의 평가 (가중치 0.5)
    store.receivedEvals.forEach(ev => {
      ev.goodSkills.forEach(sk => { if (scores[sk]) scores[sk].good += 0.5; });
      ev.badSkills.forEach(sk => { if (scores[sk]) scores[sk].bad += 0.5; });
      totalEntries += 0.5;
    });

    const denom = Math.max(totalEntries, 5);
    const result: Record<string, number> = {};
    allKeys.forEach(key => {
      const net = scores[key].good - scores[key].bad;
      result[key] = Math.max(0, Math.min(100, Math.round(50 + (net / denom) * 25)));
    });
    return result as Record<SkillKey, number>;
  }, [store.entries, store.receivedEvals, store.personalGames, myGames]);

  const buildGearSnapshot = useCallback((): GearSnapshot => {
    const mainRacket = store.gear.rackets.find(r => r.isMain);
    return {
      racket: mainRacket ? `${mainRacket.brand} ${mainRacket.model}` : undefined,
      shoes: store.gear.shoes ? `${store.gear.shoes.brand} ${store.gear.shoes.model}` : undefined,
    };
  }, [store.gear]);

  const loadRatingsFromEntry = (entry: DiaryEntry) => {
    const map: Record<string, { goodSkills: SkillKey[]; badSkills: SkillKey[] }> = {};
    entry.playerRatings?.forEach(pr => {
      map[pr.name] = { goodSkills: pr.goodSkills || [], badSkills: pr.badSkills || [] };
    });
    return map;
  };

  const autoSaveGear = useCallback(async () => {
    if (clubCode && email) await store.saveGear(clubCode, email);
  }, [clubCode, email]);

  // ─── Gear: Racket ─────────────────────────
  const handleAddRacket = async () => {
    if (!newBrand.trim() || !newModel.trim()) return;
    const racket: RacketInfo = {
      id: generateId(),
      brand: newBrand.trim(),
      model: newModel.trim(),
      isMain: store.gear.rackets.length === 0,
    };
    store.addRacket(racket);
    setNewBrand('');
    setNewModel('');
    setShowAddRacket(false);
    setTimeout(autoSaveGear, 50);
  };

  const handleRemoveRacket = async (id: string) => {
    store.removeRacket(id);
    setTimeout(autoSaveGear, 50);
  };

  const handleToggleMain = async (id: string) => {
    store.gear.rackets.forEach(r => {
      store.updateRacket(r.id, { isMain: r.id === id });
    });
    setTimeout(autoSaveGear, 50);
  };

  // ─── Gear: String ─────────────────────────
  const handleSaveString = async (racketId: string) => {
    const info: StringInfo = {
      racketId,
      name: stringName.trim() || '알 수 없음',
      tension: parseFloat(stringTension) || 50,
      replacedAt: store.gear.strings[racketId]?.replacedAt || new Date().toISOString().slice(0, 10),
      gamesSinceReplace: store.gear.strings[racketId]?.gamesSinceReplace || 0,
    };
    store.updateString(racketId, info);
    setEditStringId(null);
    setTimeout(autoSaveGear, 50);
  };

  const handleReplaceString = async (racketId: string) => {
    const existing = store.gear.strings[racketId];
    if (existing) {
      store.updateString(racketId, {
        ...existing,
        replacedAt: new Date().toISOString().slice(0, 10),
        gamesSinceReplace: 0,
      });
      setTimeout(autoSaveGear, 50);
    }
  };

  // ─── Gear: Overgrip ───────────────────────
  const handleReplaceOvergrip = async (racketId: string) => {
    store.updateOvergripForRacket(racketId, {
      replacedAt: new Date().toISOString().slice(0, 10),
      gamesSinceReplace: 0,
    });
    setTimeout(autoSaveGear, 50);
  };

  // ─── Gear: Shoes ──────────────────────────
  const handleSaveShoes = async () => {
    store.updateShoes({
      brand: shoeBrand.trim() || '-',
      model: shoeModel.trim() || '-',
      purchasedAt: store.gear.shoes?.purchasedAt || new Date().toISOString().slice(0, 10),
    });
    setEditShoes(false);
    setTimeout(autoSaveGear, 50);
  };

  // ─── Journal ──────────────────────────────
  const resetEntryForm = () => {
    setEntryTitle('');
    setEntryContent('');
    setEntryMood('normal');
    setEntryGoodSkills([]);
    setEntryBadSkills([]);
    setEntryServeAcc('');
    setEntryGearSnapshot({});
    setEntryOpponents([]);
    setEntryPartners([]);
    setPlayerRatings({});
    setExpandedRatingPlayer(null);
    setEditEntryId(null);
    setShowAddEntry(false);
    setSelectedGameForEntry(null);
    if (pgEntryMatchKeyRef.current) pgEntryMatchKeyRef.current = null;
  };

  const openEntryFormForGame = (game: MyGame) => {
    const matchKey = `${game.date}_${game.matchIndex}`;
    const existing = store.entries.find(e => e.matchDate === matchKey);
    const opponents = game.isTeam1 ? game.match.team2 : game.match.team1;
    const partners = game.isTeam1
      ? game.match.team1.filter(n => n !== myPlayerName)
      : game.match.team2.filter(n => n !== myPlayerName);

    setEntryOpponents(opponents);
    setEntryPartners(partners);

    if (existing) {
      setEditEntryId(existing.id);
      setEntryTitle(existing.title);
      setEntryContent(existing.content);
      setEntryMood(existing.mood);
      setEntryGoodSkills(existing.goodSkills || []);
      setEntryBadSkills(existing.badSkills || []);
      setEntryServeAcc(existing.serveAccuracy != null ? String(existing.serveAccuracy) : '');
      setEntryGearSnapshot(existing.gearSnapshot || buildGearSnapshot());
      setPlayerRatings(loadRatingsFromEntry(existing));
    } else {
      const resultLabel = getResultLabel(game);
      const score = getScoreText(game);
      const partnerStr = partners.length > 0 ? ` (파트너: ${partners.join(', ')})` : '';
      setEntryTitle(`vs ${opponents.join(', ')}${partnerStr} ${score} ${resultLabel}`);
      setEntryContent('');
      setEntryMood(resultLabel === '승' ? 'good' : resultLabel === '패' ? 'bad' : 'normal');
      setEntryGoodSkills([]);
      setEntryBadSkills([]);
      setEntryServeAcc('');
      setEntryGearSnapshot(buildGearSnapshot());
      setPlayerRatings({});
      setEditEntryId(null);
    }
    setExpandedRatingPlayer(null);
    setSelectedGameForEntry(game);
    setShowAddEntry(true);
  };

  const handleSaveEntry = async () => {
    if (!clubCode || !email || !entryTitle.trim()) return;
    const nowStr = new Date().toISOString();
    const matchKey = selectedGameForEntry
      ? `${selectedGameForEntry.date}_${selectedGameForEntry.matchIndex}`
      : pgEntryMatchKeyRef.current || undefined;

    const parsedServeAcc = entryServeAcc.trim() ? parseInt(entryServeAcc, 10) : null;
    const serveAccuracy = parsedServeAcc != null && !isNaN(parsedServeAcc)
      ? Math.max(0, Math.min(100, parsedServeAcc)) : null;

    // Build playerRatings array from map (skill-based)
    const allPlayers = [...entryOpponents, ...entryPartners];
    const ratings: PlayerRating[] = allPlayers
      .filter(name => {
        const r = playerRatings[name];
        return r && (r.goodSkills.length > 0 || r.badSkills.length > 0);
      })
      .map(name => ({
        name,
        role: entryOpponents.includes(name) ? '상대' as const : '파트너' as const,
        goodSkills: playerRatings[name].goodSkills,
        badSkills: playerRatings[name].badSkills,
      }));

    if (editEntryId) {
      const existing = store.entries.find(e => e.id === editEntryId);
      if (existing) {
        await store.updateEntry(clubCode, email, {
          ...existing,
          title: entryTitle.trim(),
          content: entryContent.trim(),
          mood: entryMood,
          tags: [], // legacy
          goodSkills: entryGoodSkills.length > 0 ? entryGoodSkills : undefined,
          badSkills: entryBadSkills.length > 0 ? entryBadSkills : undefined,
          serveAccuracy,
          gearSnapshot: entryGearSnapshot,
          playerRatings: ratings.length > 0 ? ratings : undefined,
          updatedAt: nowStr,
        });
      }
    } else {
      const entry: DiaryEntry = {
        id: generateId(),
        date: selectedGameForEntry?.date || todayStr(),
        title: entryTitle.trim(),
        content: entryContent.trim(),
        mood: entryMood,
        tags: [], // legacy
        goodSkills: entryGoodSkills.length > 0 ? entryGoodSkills : undefined,
        badSkills: entryBadSkills.length > 0 ? entryBadSkills : undefined,
        serveAccuracy,
        gearSnapshot: entryGearSnapshot,
        playerRatings: ratings.length > 0 ? ratings : undefined,
        matchDate: matchKey,
        createdAt: nowStr,
        updatedAt: nowStr,
      };
      await store.addEntry(clubCode, email, entry);
    }

    // Save player evaluations to shared store (so others see my ratings of them)
    if (clubCode && myPlayerName && ratings.length > 0) {
      const entryDate = selectedGameForEntry?.date || todayStr();
      for (const r of ratings) {
        await diaryDataSvc.savePlayerEvals(clubCode, r.name, [{
          evaluator: myPlayerName,
          date: entryDate,
          goodSkills: r.goodSkills,
          badSkills: r.badSkills,
        }]);
      }
    }

    resetEntryForm();
  };

  const handleEditEntry = (entry: DiaryEntry, opps?: string[], parts?: string[]) => {
    setEditEntryId(entry.id);
    setEntryTitle(entry.title);
    setEntryContent(entry.content);
    setEntryMood(entry.mood);
    setEntryGoodSkills(entry.goodSkills || []);
    setEntryBadSkills(entry.badSkills || []);
    setEntryServeAcc(entry.serveAccuracy != null ? String(entry.serveAccuracy) : '');
    setEntryGearSnapshot(entry.gearSnapshot || buildGearSnapshot());
    setPlayerRatings(loadRatingsFromEntry(entry));
    if (opps) setEntryOpponents(opps);
    if (parts) setEntryPartners(parts);
    setExpandedRatingPlayer(null);
    setSelectedGameForEntry(null);
    setShowAddEntry(true);
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!clubCode || !email) return;
    await store.deleteEntry(clubCode, email, entryId);
  };

  // ─── Personal Game ────────────────────────
  const resetPersonalForm = () => {
    setShowAddPersonal(false);
    setEditPersonalId(null);
    setPgGameType('복식');
    setPgDate(todayStr());
    setPgOpp1('');
    setPgOpp2('');
    setPgPartners('');
    setPgMyScore('');
    setPgOppScore('');
    setPgLocation('');
    setPgPosition(null);
  };

  const handleSavePersonalGame = async () => {
    if (!email || !pgOpp1.trim()) return;
    const opponents = [pgOpp1.trim(), pgOpp2.trim()].filter(Boolean);
    const partners = pgPartners.split(',').map(s => s.trim()).filter(Boolean);
    const myScore = pgMyScore ? parseInt(pgMyScore, 10) : null;
    const oppScore = pgOppScore ? parseInt(pgOppScore, 10) : null;

    if (editPersonalId) {
      const existing = store.personalGames.find(g => g.id === editPersonalId);
      if (existing) {
        await store.updatePersonalGame(email, {
          ...existing,
          date: pgDate,
          gameType: pgGameType,
          opponents,
          partners,
          myScore: isNaN(myScore as number) ? null : myScore,
          oppScore: isNaN(oppScore as number) ? null : oppScore,
          location: pgLocation.trim() || undefined,
          myPosition: pgPosition,
        });
      }
    } else {
      const game: PersonalGame = {
        id: generateId(),
        date: pgDate,
        gameType: pgGameType,
        opponents,
        partners,
        myScore: isNaN(myScore as number) ? null : myScore,
        oppScore: isNaN(oppScore as number) ? null : oppScore,
        location: pgLocation.trim() || undefined,
        myPosition: pgPosition,
        createdAt: new Date().toISOString(),
      };
      await store.addPersonalGame(email, game);
    }
    resetPersonalForm();
  };

  const handleEditPersonalGame = (pg: PersonalGame) => {
    setEditPersonalId(pg.id);
    setPgGameType(pg.gameType);
    setPgDate(pg.date);
    setPgOpp1(pg.opponents[0] || '');
    setPgOpp2(pg.opponents[1] || '');
    setPgPartners(pg.partners.join(', '));
    setPgMyScore(pg.myScore != null ? String(pg.myScore) : '');
    setPgOppScore(pg.oppScore != null ? String(pg.oppScore) : '');
    setPgLocation(pg.location || '');
    setPgPosition(pg.myPosition || null);
    setShowAddPersonal(true);
  };

  const handleDeletePersonalGame = async (gameId: string) => {
    if (!email) return;
    await store.deletePersonalGame(email, gameId);
  };

  const openEntryFormForPersonalGame = (pg: PersonalGame) => {
    const matchKey = `pg_${pg.id}`;
    const existing = store.entries.find(e => e.matchDate === matchKey);

    setEntryOpponents(pg.opponents);
    setEntryPartners(pg.partners);

    if (existing) {
      setEditEntryId(existing.id);
      setEntryTitle(existing.title);
      setEntryContent(existing.content);
      setEntryMood(existing.mood);
      setEntryGoodSkills(existing.goodSkills || []);
      setEntryBadSkills(existing.badSkills || []);
      setEntryServeAcc(existing.serveAccuracy != null ? String(existing.serveAccuracy) : '');
      setEntryGearSnapshot(existing.gearSnapshot || buildGearSnapshot());
      setPlayerRatings(loadRatingsFromEntry(existing));
    } else {
      const resultLabel = pgResultLabel(pg);
      const score = pgScoreText(pg);
      const partnerStr = pg.partners.length > 0 ? ` (파트너: ${pg.partners.join(', ')})` : '';
      setEntryTitle(`[개인] vs ${pg.opponents.join(', ')}${partnerStr} ${score} ${resultLabel}`);
      setEntryContent('');
      setEntryMood(resultLabel === '승' ? 'good' : resultLabel === '패' ? 'bad' : 'normal');
      setEntryGoodSkills([]);
      setEntryBadSkills([]);
      setEntryServeAcc('');
      setEntryGearSnapshot(buildGearSnapshot());
      setPlayerRatings({});
      setEditEntryId(null);
    }
    setExpandedRatingPlayer(null);
    setSelectedGameForEntry(null);
    setShowAddEntry(true);
    pgEntryMatchKeyRef.current = matchKey;
  };

  const pgEntryMatchKeyRef = useRef<string | null>(null);

  // ─── AI Analysis ──────────────────────────
  const handleAIAnalysis = async () => {
    if (!geminiKey || !clubCode || !email) return;
    store.setAiLoading(true);
    try {
      const hash = `${JSON.stringify(store.stats.main)}-${store.entries.length}-${store.gear.rackets.length}`;
      const cached = await store.loadCachedAI(clubCode, email, hash);
      if (cached) {
        store.setAiAnalysis(cached);
        store.setAiLoading(false);
        return;
      }
      const result = await generateDiaryAnalysisAI(geminiKey, {
        stats: store.stats,
        history: store.statsHistory,
        gear: store.gear,
        recentEntries: store.entries.slice(0, 5),
        playerName: user?.displayName || undefined,
      });
      if (result) {
        await store.saveCachedAI(clubCode, email, result, hash);
      }
      store.setAiAnalysis(result);
    } catch (e) {
      console.warn('AI analysis error:', e);
    }
    store.setAiLoading(false);
  };

  // ─── Radar Chart SVG ──────────────────────
  const CHART_SIZE = 260;
  const cx = CHART_SIZE / 2;
  const cy = CHART_SIZE / 2;
  const maxR = CHART_SIZE / 2 - 30;
  const levels = [0.25, 0.5, 0.75, 1];

  const currentValues = STAT_KEYS.map(k => computedStats[k]);

  const now = new Date();
  const prevMonth = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;
  const prevSnapshot = store.statsHistory.find(s => s.month === prevMonth);
  const prevValues = prevSnapshot ? STAT_KEYS.map(k => prevSnapshot.stats.main[k]) : null;

  const labelPoints = STAT_KEYS.map((_, i) => {
    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    return { x: cx + (maxR + 22) * Math.cos(angle), y: cy + (maxR + 22) * Math.sin(angle) };
  });

  // ─── Render ───────────────────────────────
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <View style={s.container}>
        <SegmentedTabs tabs={MAIN_TABS} activeKey={activeTab} onTabPress={setActiveTab} style={{ marginBottom: spacing.lg }} />

        {/* ════════ 장비 탭 ════════ */}
        {activeTab === 'gear' && (
          <>
            <Card title="라켓" headerRight={
              <TouchableOpacity onPress={() => setShowAddRacket(!showAddRacket)}>
                <FontAwesome name={showAddRacket ? 'close' : 'plus'} size={16} color={colors.primary} />
              </TouchableOpacity>
            }>
              {showAddRacket && (
                <View style={s.addForm}>
                  <Input placeholder="브랜드" value={newBrand} onChangeText={setNewBrand} containerStyle={{ marginVertical: 4 }} />
                  <Input placeholder="모델명" value={newModel} onChangeText={setNewModel} containerStyle={{ marginVertical: 4 }} />
                  <Button title="추가" size="small" onPress={handleAddRacket} style={{ marginTop: 8, alignSelf: 'flex-end' }} />
                </View>
              )}
              {store.gear.rackets.length === 0 && !showAddRacket && (
                <Text style={s.emptyText}>라켓을 추가해주세요</Text>
              )}
              {store.gear.rackets.map(r => (
                <View key={r.id} style={s.racketRow}>
                  <TouchableOpacity onPress={() => handleToggleMain(r.id)} style={s.racketInfo}>
                    <Text style={s.racketName}>{r.brand} {r.model}</Text>
                    <Chip label={r.isMain ? '메인' : '서브'} variant={r.isMain ? 'info' : 'default'} size="small" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleRemoveRacket(r.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <FontAwesome name="trash-o" size={16} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              ))}
            </Card>

            {store.gear.rackets.length > 0 && (
              <Card title="스트링 / 오버그립">
                {store.gear.rackets.map(r => {
                  const si = store.gear.strings[r.id];
                  const autoGames = si ? countGamesAfter(si.replacedAt) : 0;
                  const sLife = si ? calcLifespan(si.replacedAt, autoGames, stringCycle.maxDays, stringCycle.maxGames) : 0;
                  const isEditing = editStringId === r.id;

                  const og = store.gear.overgrips?.[r.id];
                  const ogAutoGames = og ? countGamesAfter(og.replacedAt) : 0;
                  const ogLife = og ? calcLifespan(og.replacedAt, ogAutoGames, 14, 10) : 0;

                  return (
                    <View key={r.id} style={s.stringBlock}>
                      <View style={s.stringHeader}>
                        <Text style={s.stringRacketName}>{r.brand} {r.model}</Text>
                        {si && (
                          <TouchableOpacity onPress={() => {
                            if (isEditing) { setEditStringId(null); } else {
                              setEditStringId(r.id);
                              setStringName(si.name);
                              setStringTension(String(si.tension));
                            }
                          }}>
                            <FontAwesome name={isEditing ? 'close' : 'pencil'} size={14} color={colors.textSecondary} />
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* 스트링 */}
                      {si ? (
                        <>
                          {isEditing ? (
                            <View style={s.addForm}>
                              <Input placeholder="스트링 이름" value={stringName} onChangeText={setStringName} containerStyle={{ marginVertical: 4 }} />
                              <Input placeholder="텐션" value={stringTension} onChangeText={setStringTension} keyboardType="numeric" containerStyle={{ marginVertical: 4 }} />
                              <Button title="저장" size="small" onPress={() => handleSaveString(r.id)} style={{ marginTop: 4, alignSelf: 'flex-end' }} />
                            </View>
                          ) : (
                            <>
                              <Text style={s.stringDetail}>{si.name} · {si.tension}lb · {autoGames}게임 · 교체일 {si.replacedAt}</Text>
                              <View style={s.gaugeRow}>
                                <Text style={s.emojiGauge}>{emojiGauge(sLife)}</Text>
                                <Text style={[s.gaugePercent, { color: lifespanColor(sLife) }]}>{Math.round(sLife * 100)}%</Text>
                              </View>
                              {sLife <= 0.1 && <Text style={s.warningText}>교체 필요!</Text>}
                              <View style={s.stringActions}>
                                <Button title="스트링 교체" size="small" variant="outline" onPress={() => handleReplaceString(r.id)} />
                              </View>
                            </>
                          )}
                        </>
                      ) : (
                        <View style={s.addForm}>
                          <Input placeholder="스트링 이름" value={editStringId === r.id ? stringName : ''} onChangeText={(t) => { setEditStringId(r.id); setStringName(t); }} containerStyle={{ marginVertical: 4 }} />
                          <Input placeholder="텐션 (lb)" value={editStringId === r.id ? stringTension : ''} onChangeText={(t) => { setEditStringId(r.id); setStringTension(t); }} keyboardType="numeric" containerStyle={{ marginVertical: 4 }} />
                          <Button title="등록" size="small" onPress={() => handleSaveString(r.id)} style={{ marginTop: 4, alignSelf: 'flex-end' }} />
                        </View>
                      )}

                      {/* 오버그립 */}
                      <View style={s.ogSection}>
                        <Text style={s.ogLabel}>오버그립</Text>
                        {og ? (
                          <>
                            <Text style={s.ogDetail}>{ogAutoGames}게임 · 교체일 {og.replacedAt}</Text>
                            <View style={s.gaugeRow}>
                              <Text style={s.emojiGauge}>{emojiGauge(ogLife)}</Text>
                              <Text style={[s.gaugePercent, { color: lifespanColor(ogLife) }]}>{Math.round(ogLife * 100)}%</Text>
                            </View>
                            {ogLife <= 0.1 && <Text style={s.warningText}>교체 필요!</Text>}
                            <View style={s.stringActions}>
                              <Button title="그립 교체" size="small" variant="outline" onPress={() => handleReplaceOvergrip(r.id)} />
                            </View>
                          </>
                        ) : (
                          <Button title="오버그립 교체 시작" size="small" variant="outline" onPress={() => handleReplaceOvergrip(r.id)} style={{ marginTop: 4 }} />
                        )}
                      </View>
                    </View>
                  );
                })}
              </Card>
            )}

            <Card title="신발" headerRight={
              <TouchableOpacity onPress={() => {
                if (editShoes) { setEditShoes(false); } else {
                  setEditShoes(true);
                  setShoeBrand(store.gear.shoes?.brand || '');
                  setShoeModel(store.gear.shoes?.model || '');
                }
              }}>
                <FontAwesome name={editShoes ? 'close' : store.gear.shoes ? 'pencil' : 'plus'} size={16} color={colors.primary} />
              </TouchableOpacity>
            }>
              {editShoes ? (
                <View style={s.addForm}>
                  <Input placeholder="브랜드" value={shoeBrand} onChangeText={setShoeBrand} containerStyle={{ marginVertical: 4 }} />
                  <Input placeholder="모델명" value={shoeModel} onChangeText={setShoeModel} containerStyle={{ marginVertical: 4 }} />
                  <Button title="저장" size="small" onPress={handleSaveShoes} style={{ marginTop: 8, alignSelf: 'flex-end' }} />
                </View>
              ) : store.gear.shoes ? (
                <Text style={s.shoeText}>{store.gear.shoes.brand} {store.gear.shoes.model}</Text>
              ) : (
                <Text style={s.emptyText}>신발 정보를 추가해주세요</Text>
              )}
            </Card>
          </>
        )}

        {/* ════════ 레이더 탭 ════════ */}
        {activeTab === 'radar' && (
          <>
            {/* Share card with ref */}
            <View ref={radarShareRef} collapsable={false}>
              <Card headerRight={
                Platform.OS !== 'web' ? (
                  <TouchableOpacity onPress={() => shareRadarImage(radarShareRef)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <FontAwesome name="share-alt" size={16} color={colors.primary} />
                  </TouchableOpacity>
                ) : undefined
              }>
                <View style={s.chartWrap}>
                  <Svg width={CHART_SIZE} height={CHART_SIZE}>
                    {levels.map(lv => (
                      <Polygon
                        key={lv}
                        points={buildPolygonString(getHexagonPoints(cx, cy, maxR * lv))}
                        fill="none"
                        stroke={colors.border}
                        strokeWidth={1}
                      />
                    ))}
                    {STAT_KEYS.map((_, i) => {
                      const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
                      return (
                        <Line
                          key={i}
                          x1={cx}
                          y1={cy}
                          x2={cx + maxR * Math.cos(angle)}
                          y2={cy + maxR * Math.sin(angle)}
                          stroke={colors.border}
                          strokeWidth={0.5}
                        />
                      );
                    })}
                    {showCompare && prevValues && (
                      <Polygon
                        points={buildDataPolygon(cx, cy, maxR, prevValues)}
                        fill="rgba(59,130,246,0.15)"
                        stroke="#3b82f6"
                        strokeWidth={2}
                      />
                    )}
                    <Polygon
                      points={buildDataPolygon(cx, cy, maxR, currentValues)}
                      fill="rgba(212,255,0,0.15)"
                      stroke={colors.primary}
                      strokeWidth={2}
                    />
                    <SvgCircle cx={cx} cy={cy} r={2} fill={colors.textTertiary} />
                    {labelPoints.map((p, i) => (
                      <SvgText
                        key={STAT_KEYS[i]}
                        x={p.x}
                        y={p.y}
                        fontSize={11}
                        fontFamily={FONT_FAMILY}
                        fill={colors.textSecondary}
                        textAnchor="middle"
                        alignmentBaseline="central"
                      >
                        {STAT_LABELS[STAT_KEYS[i]]}
                      </SvgText>
                    ))}
                  </Svg>
                </View>
                <TouchableOpacity
                  style={s.compareToggle}
                  onPress={() => setShowCompare(prev => !prev)}
                  activeOpacity={0.7}
                >
                  <FontAwesome
                    name={showCompare ? 'check-square-o' : 'square-o'}
                    size={16}
                    color={showCompare ? colors.primary : colors.textTertiary}
                  />
                  <Text style={[s.compareToggleText, showCompare && { color: colors.primary }]}>
                    지난달 비교
                  </Text>
                </TouchableOpacity>
                {showCompare && !prevValues && (
                  <Text style={s.compareHint}>지난달 기록이 없습니다</Text>
                )}
                {showCompare && prevValues && (
                  <View style={s.legendRow}>
                    <View style={[s.legendDot, { backgroundColor: colors.primary }]} />
                    <Text style={s.legendText}>이번달</Text>
                    <View style={[s.legendDot, { backgroundColor: '#3b82f6' }]} />
                    <Text style={s.legendText}>지난달</Text>
                  </View>
                )}
              </Card>
            </View>

            <Card title="스탯 (일지 기반 자동 계산)">
              {STAT_KEYS.map(key => {
                const val = computedStats[key];
                return (
                  <View key={key} style={s.statRow}>
                    <View style={s.statLabel}>
                      <Text style={s.statLabelText}>{STAT_LABELS[key]}</Text>
                      <Text style={s.statValue}>{val}</Text>
                    </View>
                    <ProgressBar progress={val / 100} color={colors.primary} height={6} style={{ marginTop: 4 }} />
                  </View>
                );
              })}
              <Text style={s.computedHint}>일지의 잘한것/못한것 + 타인평가 반영 (기준 50)</Text>
            </Card>

            <Card title="서브 스탯">
              <View style={s.subStatRow}>
                {SUB_KEYS.map(key => (
                  <StatPill
                    key={key}
                    label={SUB_STAT_LABELS[key]}
                    value={computedStats[key] ?? 50}
                    color={colors.primary}
                    bgColor={colors.bg}
                    size="small"
                  />
                ))}
              </View>
              {SUB_KEYS.map(key => {
                const val = computedStats[key] ?? 50;
                return (
                  <View key={key} style={s.subSliderRow}>
                    <Text style={s.subLabel}>{SUB_STAT_LABELS[key]}</Text>
                    <View style={s.subBarWrap}>
                      <ProgressBar progress={val / 100} color={colors.info} height={6} />
                    </View>
                    <Text style={[s.gaugePercent, { color: colors.info }]}>{val}</Text>
                  </View>
                );
              })}
            </Card>

            <Button
              title="이번달 스냅샷 저장"
              variant="primary"
              fullWidth
              onPress={async () => {
                if (clubCode && email) {
                  // Sync computedStats into store before snapshot
                  STAT_KEYS.forEach(k => store.setMainStat(k, computedStats[k]));
                  SUB_KEYS.forEach(k => store.setSubStat(k, computedStats[k] ?? 50));
                  await store.saveStats(clubCode, email);
                  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                  await store.saveSnapshot(clubCode, email, month);
                }
              }}
              style={{ marginTop: spacing.md, marginBottom: spacing['3xl'] }}
            />
          </>
        )}

        {/* ════════ 일지 탭 ════════ */}
        {activeTab === 'journal' && (
          <>
            {/* ── 일지 작성 폼 (경기 선택 시 열림) ── */}
            {showAddEntry && (
              <Card title={selectedGameForEntry ? `${selectedGameForEntry.date} 경기 일지` : '일지 작성'}
                headerRight={
                  <TouchableOpacity onPress={resetEntryForm}>
                    <FontAwesome name="close" size={16} color={colors.primary} />
                  </TouchableOpacity>
                }
              >
                <View style={s.addForm}>
                  {/* 장비 표시 (라켓 변경 가능) */}
                  {(store.gear.rackets.length > 0 || entryGearSnapshot.shoes) && (
                    <View style={s.gearSnapshotRow}>
                      {store.gear.rackets.length > 0 && (
                        <TouchableOpacity
                          style={s.gearSnapshotItem}
                          onPress={() => {
                            const rackets = store.gear.rackets;
                            const currentIdx = rackets.findIndex(r => `${r.brand} ${r.model}` === entryGearSnapshot.racket);
                            const nextIdx = (currentIdx + 1) % rackets.length;
                            setEntryGearSnapshot(prev => ({
                              ...prev,
                              racket: `${rackets[nextIdx].brand} ${rackets[nextIdx].model}`,
                            }));
                          }}
                          activeOpacity={0.6}
                        >
                          <FontAwesome name="tablet" size={12} color={colors.primary} />
                          <Text style={[s.gearSnapshotText, { color: colors.primary }]}>
                            {entryGearSnapshot.racket || '라켓 선택'}
                          </Text>
                          {store.gear.rackets.length > 1 && (
                            <FontAwesome name="exchange" size={9} color={colors.textTertiary} />
                          )}
                        </TouchableOpacity>
                      )}
                      {entryGearSnapshot.shoes ? (
                        <View style={s.gearSnapshotItem}>
                          <FontAwesome name="road" size={12} color={colors.textTertiary} />
                          <Text style={s.gearSnapshotText}>{entryGearSnapshot.shoes}</Text>
                        </View>
                      ) : null}
                    </View>
                  )}

                  <Input
                    placeholder="제목"
                    value={entryTitle}
                    onChangeText={setEntryTitle}
                    containerStyle={{ marginVertical: 4 }}
                  />
                  <Input
                    placeholder="이 경기에서 느낀 점, 배운 점을 기록하세요..."
                    value={entryContent}
                    onChangeText={setEntryContent}
                    multiline
                    numberOfLines={5}
                    style={{ minHeight: 100, textAlignVertical: 'top' }}
                    containerStyle={{ marginVertical: 4 }}
                  />

                  <Text style={s.formLabel}>컨디션</Text>
                  <View style={s.moodRow}>
                    {MOOD_OPTIONS.map(m => (
                      <TouchableOpacity
                        key={m.key}
                        style={[s.moodBtn, entryMood === m.key && s.moodBtnActive]}
                        onPress={() => setEntryMood(m.key)}
                      >
                        <Text style={s.moodEmoji}>{m.emoji}</Text>
                        <Text style={[s.moodLabel, entryMood === m.key && s.moodLabelActive]}>{m.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={s.formLabel}>잘한 것</Text>
                  <View style={s.tagRow}>
                    {SKILL_OPTIONS.map(sk => (
                      <Chip
                        key={sk.key}
                        label={sk.label}
                        selected={entryGoodSkills.includes(sk.key)}
                        onPress={() => setEntryGoodSkills(prev =>
                          prev.includes(sk.key) ? prev.filter(k => k !== sk.key) : [...prev, sk.key]
                        )}
                        size="small"
                        variant={entryGoodSkills.includes(sk.key) ? 'success' : 'default'}
                        style={{ marginRight: 6, marginBottom: 6 }}
                      />
                    ))}
                  </View>

                  <Text style={s.formLabel}>못한 것</Text>
                  <View style={s.tagRow}>
                    {SKILL_OPTIONS.map(sk => (
                      <Chip
                        key={sk.key}
                        label={sk.label}
                        selected={entryBadSkills.includes(sk.key)}
                        onPress={() => setEntryBadSkills(prev =>
                          prev.includes(sk.key) ? prev.filter(k => k !== sk.key) : [...prev, sk.key]
                        )}
                        size="small"
                        variant={entryBadSkills.includes(sk.key) ? 'error' : 'default'}
                        style={{ marginRight: 6, marginBottom: 6 }}
                      />
                    ))}
                  </View>

                  <Input
                    label="1st 서브 정확도 (0~100%)"
                    placeholder="예: 65"
                    value={entryServeAcc}
                    onChangeText={setEntryServeAcc}
                    keyboardType="numeric"
                    containerStyle={{ marginVertical: 4, marginTop: spacing.md }}
                  />

                  {/* 상대/파트너 평가 */}
                  {(entryOpponents.length > 0 || entryPartners.length > 0) && (
                    <>
                      <Text style={s.formLabel}>상대/파트너 평가</Text>
                      {[
                        ...entryOpponents.map(n => ({ name: n, role: '상대' as const })),
                        ...entryPartners.map(n => ({ name: n, role: '파트너' as const })),
                      ].map(({ name, role }) => {
                        const r = playerRatings[name] || { goodSkills: [], badSkills: [] };
                        const isOpen = expandedRatingPlayer === name;
                        return (
                          <View key={name} style={s.ratingBlock}>
                            <TouchableOpacity
                              style={s.ratingHeader}
                              onPress={() => setExpandedRatingPlayer(isOpen ? null : name)}
                              activeOpacity={0.7}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={s.ratingName}>{name}</Text>
                                <Text style={s.ratingRole}>{role}</Text>
                              </View>
                              {(r.goodSkills.length > 0 || r.badSkills.length > 0) && (
                                <Text style={s.ratingBadge}>
                                  {r.goodSkills.length > 0 ? `+${r.goodSkills.length}` : ''}{r.goodSkills.length > 0 && r.badSkills.length > 0 ? ' ' : ''}{r.badSkills.length > 0 ? `-${r.badSkills.length}` : ''}
                                </Text>
                              )}
                              <FontAwesome name={isOpen ? 'chevron-up' : 'chevron-down'} size={10} color={colors.textTertiary} style={{ marginLeft: 8 }} />
                            </TouchableOpacity>
                            {isOpen && (
                              <View style={{ marginTop: spacing.sm }}>
                                <Text style={s.skillSubLabel}>잘한 것</Text>
                                <View style={s.tagRow}>
                                  {SKILL_OPTIONS.map(sk => (
                                    <Chip
                                      key={sk.key}
                                      label={sk.label}
                                      selected={r.goodSkills.includes(sk.key)}
                                      onPress={() => {
                                        setPlayerRatings(prev => {
                                          const cur = prev[name] || { goodSkills: [], badSkills: [] };
                                          const gs = cur.goodSkills.includes(sk.key)
                                            ? cur.goodSkills.filter(k => k !== sk.key)
                                            : [...cur.goodSkills, sk.key];
                                          return { ...prev, [name]: { ...cur, goodSkills: gs } };
                                        });
                                      }}
                                      size="small"
                                      variant={r.goodSkills.includes(sk.key) ? 'success' : 'default'}
                                      style={{ marginRight: 6, marginBottom: 6 }}
                                    />
                                  ))}
                                </View>
                                <Text style={s.skillSubLabel}>못한 것</Text>
                                <View style={s.tagRow}>
                                  {SKILL_OPTIONS.map(sk => (
                                    <Chip
                                      key={sk.key}
                                      label={sk.label}
                                      selected={r.badSkills.includes(sk.key)}
                                      onPress={() => {
                                        setPlayerRatings(prev => {
                                          const cur = prev[name] || { goodSkills: [], badSkills: [] };
                                          const bs = cur.badSkills.includes(sk.key)
                                            ? cur.badSkills.filter(k => k !== sk.key)
                                            : [...cur.badSkills, sk.key];
                                          return { ...prev, [name]: { ...cur, badSkills: bs } };
                                        });
                                      }}
                                      size="small"
                                      variant={r.badSkills.includes(sk.key) ? 'error' : 'default'}
                                      style={{ marginRight: 6, marginBottom: 6 }}
                                    />
                                  ))}
                                </View>
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </>
                  )}

                  <Button
                    title={editEntryId ? '수정' : '저장'}
                    onPress={handleSaveEntry}
                    disabled={!entryTitle.trim()}
                    fullWidth
                    style={{ marginTop: spacing.md }}
                  />
                </View>
              </Card>
            )}

            {/* ── 개인 경기 추가 폼 ── */}
            {!showAddEntry && showAddPersonal && (
              <Card title={editPersonalId ? '개인 경기 수정' : '개인 경기 추가'} headerRight={
                <TouchableOpacity onPress={resetPersonalForm}>
                  <FontAwesome name="close" size={16} color={colors.primary} />
                </TouchableOpacity>
              }>
                <View style={s.addForm}>
                  {/* 단식/복식 */}
                  <Text style={s.formLabel}>경기 유형</Text>
                  <View style={s.moodRow}>
                    {(['단식', '복식'] as const).map(gt => (
                      <TouchableOpacity
                        key={gt}
                        style={[s.moodBtn, pgGameType === gt && s.moodBtnActive, { flex: 1 }]}
                        onPress={() => setPgGameType(gt)}
                      >
                        <Text style={[s.moodLabel, pgGameType === gt && s.moodLabelActive]}>{gt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Input label="날짜" placeholder="2026-02-19" value={pgDate} onChangeText={setPgDate} containerStyle={{ marginVertical: 4 }} />
                  {pgGameType === '복식' ? (
                    <>
                      <View style={s.scoreInputRow}>
                        <Input label="상대 1" placeholder="이름" value={pgOpp1} onChangeText={setPgOpp1} containerStyle={{ flex: 1, marginVertical: 4 }} />
                        <Input label="상대 2" placeholder="이름" value={pgOpp2} onChangeText={setPgOpp2} containerStyle={{ flex: 1, marginVertical: 4 }} />
                      </View>
                      <Input label="파트너" placeholder="파트너 이름" value={pgPartners} onChangeText={setPgPartners} containerStyle={{ marginVertical: 4 }} />
                    </>
                  ) : (
                    <Input label="상대방" placeholder="이름" value={pgOpp1} onChangeText={setPgOpp1} containerStyle={{ marginVertical: 4 }} />
                  )}

                  <View style={s.scoreInputRow}>
                    <Input label="내 점수" placeholder="6" value={pgMyScore} onChangeText={setPgMyScore} keyboardType="numeric" containerStyle={{ flex: 1, marginVertical: 4 }} />
                    <Text style={s.scoreColon}>:</Text>
                    <Input label="상대 점수" placeholder="4" value={pgOppScore} onChangeText={setPgOppScore} keyboardType="numeric" containerStyle={{ flex: 1, marginVertical: 4 }} />
                  </View>

                  <Input label="장소 (선택)" placeholder="코트 / 장소" value={pgLocation} onChangeText={setPgLocation} containerStyle={{ marginVertical: 4 }} />

                  <Text style={s.formLabel}>내 포지션 (선택)</Text>
                  <View style={s.moodRow}>
                    {(['듀스(포)', '애드(백)'] as CourtPosition[]).map(pos => (
                      <TouchableOpacity
                        key={pos}
                        style={[s.moodBtn, pgPosition === pos && s.moodBtnActive, { flex: 1 }]}
                        onPress={() => setPgPosition(pgPosition === pos ? null : pos)}
                      >
                        <Text style={[s.moodLabel, pgPosition === pos && s.moodLabelActive]}>{pos}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Button
                    title={editPersonalId ? '수정' : '추가'}
                    onPress={handleSavePersonalGame}
                    disabled={!pgOpp1.trim()}
                    fullWidth
                    style={{ marginTop: spacing.md }}
                  />
                </View>
              </Card>
            )}

            {/* ── 내 경기 기록 목록 ── */}
            {!showAddEntry && !showAddPersonal && (
              <>
                {/* 개인 경기 추가 버튼 */}
                <TouchableOpacity style={s.addPersonalBtn} onPress={() => setShowAddPersonal(true)}>
                  <FontAwesome name="plus-circle" size={16} color={colors.primary} />
                  <Text style={s.addPersonalBtnText}>개인 경기 추가</Text>
                </TouchableOpacity>

                {!myPlayerName && store.personalGames.length === 0 && (
                  <Card>
                    <Text style={s.emptyText}>선수 정보와 연동된 계정이 필요합니다</Text>
                  </Card>
                )}

                {myPlayerName && gamesLoading && (
                  <View style={s.loadingWrap}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[s.emptyText, { paddingVertical: spacing.sm }]}>경기 기록 불러오는 중...</Text>
                  </View>
                )}

                {!gamesLoading && timelineDates.length === 0 && myPlayerName && (
                  <Card>
                    <Text style={s.emptyText}>참가한 경기 기록이 없습니다</Text>
                  </Card>
                )}

                {!gamesLoading && timelineDates.map(date => {
                  const items = timelineByDate[date];
                  return (
                    <View key={date}>
                      <Text style={s.gameDateHeader}>{date}</Text>
                      {items.map(item => {
                        if (item.type === 'club') {
                          const game = item.game;
                          const matchKey = `${game.date}_${game.matchIndex}`;
                          const existingEntry = entryByMatchDate[matchKey];
                          const resultLabel = getResultLabel(game);
                          const resultColor = getResultColor(resultLabel);
                          const opponents = game.isTeam1 ? game.match.team2 : game.match.team1;
                          const partners = game.isTeam1
                            ? game.match.team1.filter(n => n !== myPlayerName)
                            : game.match.team2.filter(n => n !== myPlayerName);
                          const isExpanded = expandedEntryId === matchKey;

                          return (
                            <Card key={matchKey} style={{ marginVertical: 4 }}>
                              <TouchableOpacity
                                onPress={() => {
                                  if (existingEntry) {
                                    setExpandedEntryId(isExpanded ? null : matchKey);
                                  } else {
                                    openEntryFormForGame(game);
                                  }
                                }}
                                activeOpacity={0.7}
                              >
                                <View style={s.gameRow}>
                                  <View style={s.gameResultBadge}>
                                    <Text style={[s.gameResultText, { color: resultColor }]}>{resultLabel}</Text>
                                  </View>
                                  <View style={{ flex: 1 }}>
                                    <Text style={s.gameOpponents} numberOfLines={1}>
                                      vs {opponents.join(', ')}
                                    </Text>
                                    {partners.length > 0 && (
                                      <Text style={s.gamePartner} numberOfLines={1}>
                                        파트너: {partners.join(', ')}
                                      </Text>
                                    )}
                                  </View>
                                  <View style={s.gameScoreWrap}>
                                    <Text style={s.gameScore}>{getScoreText(game)}</Text>
                                  </View>
                                  {existingEntry ? (
                                    <FontAwesome name="pencil-square" size={16} color={colors.primary} style={{ marginLeft: 8 }} />
                                  ) : (
                                    <FontAwesome name="pencil" size={14} color={colors.textTertiary} style={{ marginLeft: 8 }} />
                                  )}
                                </View>
                              </TouchableOpacity>

                              {isExpanded && existingEntry && (
                                <View style={s.entryBody}>
                                  {existingEntry.gearSnapshot && (existingEntry.gearSnapshot.racket || existingEntry.gearSnapshot.shoes) && (
                                    <View style={s.gearSnapshotRow}>
                                      {existingEntry.gearSnapshot.racket ? (
                                        <View style={s.gearSnapshotItem}>
                                          <FontAwesome name="tablet" size={11} color={colors.textTertiary} />
                                          <Text style={s.gearSnapshotText}>{existingEntry.gearSnapshot.racket}</Text>
                                        </View>
                                      ) : null}
                                      {existingEntry.gearSnapshot.shoes ? (
                                        <View style={s.gearSnapshotItem}>
                                          <FontAwesome name="road" size={11} color={colors.textTertiary} />
                                          <Text style={s.gearSnapshotText}>{existingEntry.gearSnapshot.shoes}</Text>
                                        </View>
                                      ) : null}
                                    </View>
                                  )}
                                  <View style={s.entryHeader}>
                                    <Text style={s.entryMoodEmoji}>{MOOD_OPTIONS.find(m => m.key === existingEntry.mood)?.emoji || '😐'}</Text>
                                    <Text style={[s.entryTitle, { flex: 1 }]}>{existingEntry.title}</Text>
                                  </View>
                                  {existingEntry.content ? (
                                    <Text style={s.entryContent}>{existingEntry.content}</Text>
                                  ) : null}
                                  {existingEntry.serveAccuracy != null && (
                                    <Text style={s.serveAccText}>1st 서브 정확도: {existingEntry.serveAccuracy}%</Text>
                                  )}
                                  {(existingEntry.goodSkills?.length || existingEntry.badSkills?.length) ? (
                                    <View style={s.ratingsDisplay}>
                                      <View style={s.ratingDisplayRow}>
                                        <Chip label="나" size="small" variant="success" />
                                        {existingEntry.goodSkills?.map(sk => (
                                          <Chip key={`g_${sk}`} label={ALL_SKILL_LABELS[sk] || sk} size="small" variant="success" style={{ marginRight: 3 }} />
                                        ))}
                                        {existingEntry.badSkills?.map(sk => (
                                          <Chip key={`b_${sk}`} label={ALL_SKILL_LABELS[sk] || sk} size="small" variant="error" style={{ marginRight: 3 }} />
                                        ))}
                                      </View>
                                    </View>
                                  ) : null}
                                  {existingEntry.playerRatings && existingEntry.playerRatings.length > 0 && (
                                    <View style={s.ratingsDisplay}>
                                      {existingEntry.playerRatings.map(pr => (
                                        <View key={pr.name} style={s.ratingDisplayRow}>
                                          <Chip label={pr.role} size="small" variant={pr.role === '상대' ? 'warning' : 'info'} />
                                          <Text style={s.ratingDisplayName}>{pr.name}</Text>
                                          {pr.goodSkills?.length > 0 && (
                                            <View style={s.skillChipRow}>
                                              {pr.goodSkills.map(sk => (
                                                <Chip key={sk} label={ALL_SKILL_LABELS[sk] || sk} size="small" variant="success" style={{ marginRight: 3 }} />
                                              ))}
                                            </View>
                                          )}
                                          {pr.badSkills?.length > 0 && (
                                            <View style={s.skillChipRow}>
                                              {pr.badSkills.map(sk => (
                                                <Chip key={sk} label={ALL_SKILL_LABELS[sk] || sk} size="small" variant="error" style={{ marginRight: 3 }} />
                                              ))}
                                            </View>
                                          )}
                                        </View>
                                      ))}
                                    </View>
                                  )}
                                  <View style={s.entryActions}>
                                    <Button title="수정" size="small" variant="ghost" onPress={() => {
                                      setSelectedGameForEntry(game);
                                      handleEditEntry(existingEntry, opponents, partners);
                                    }} />
                                    <Button title="삭제" size="small" variant="ghost" textStyle={{ color: colors.error }} onPress={() => handleDeleteEntry(existingEntry.id)} />
                                  </View>
                                </View>
                              )}
                            </Card>
                          );
                        }

                        // Personal game
                        const pg = item.pg;
                        const pgKey = `pg_${pg.id}`;
                        const existingEntry = entryByMatchDate[pgKey];
                        const rLabel = pgResultLabel(pg);
                        const rColor = getResultColor(rLabel);
                        const isExpanded = expandedEntryId === pgKey;

                        return (
                          <Card key={pgKey} style={{ marginVertical: 4 }}>
                            <TouchableOpacity
                              onPress={() => {
                                if (existingEntry) {
                                  setExpandedEntryId(isExpanded ? null : pgKey);
                                } else {
                                  openEntryFormForPersonalGame(pg);
                                }
                              }}
                              activeOpacity={0.7}
                            >
                              <View style={s.gameRow}>
                                <View style={s.gameResultBadge}>
                                  <Text style={[s.gameResultText, { color: rColor }]}>{rLabel}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    <Chip label="개인" size="small" variant="warning" />
                                    <Chip label={pg.gameType} size="small" variant="default" />
                                    {pg.myPosition ? (
                                      <Chip label={pg.myPosition} size="small" variant="info" />
                                    ) : null}
                                  </View>
                                  <Text style={[s.gameOpponents, { marginTop: 4 }]} numberOfLines={1}>
                                    vs {pg.opponents.join(', ')}
                                  </Text>
                                  {pg.partners.length > 0 && (
                                    <Text style={s.gamePartner} numberOfLines={1}>
                                      파트너: {pg.partners.join(', ')}
                                    </Text>
                                  )}
                                  {pg.location ? (
                                    <Text style={s.gamePartner} numberOfLines={1}>{pg.location}</Text>
                                  ) : null}
                                </View>
                                <View style={s.gameScoreWrap}>
                                  <Text style={s.gameScore}>{pgScoreText(pg)}</Text>
                                </View>
                                {existingEntry ? (
                                  <FontAwesome name="pencil-square" size={16} color={colors.primary} style={{ marginLeft: 8 }} />
                                ) : (
                                  <FontAwesome name="pencil" size={14} color={colors.textTertiary} style={{ marginLeft: 8 }} />
                                )}
                              </View>
                            </TouchableOpacity>

                            {/* Expanded: diary entry or edit/delete controls */}
                            {isExpanded && existingEntry && (
                              <View style={s.entryBody}>
                                {existingEntry.gearSnapshot && (existingEntry.gearSnapshot.racket || existingEntry.gearSnapshot.shoes) && (
                                  <View style={s.gearSnapshotRow}>
                                    {existingEntry.gearSnapshot.racket ? (
                                      <View style={s.gearSnapshotItem}>
                                        <FontAwesome name="tablet" size={11} color={colors.textTertiary} />
                                        <Text style={s.gearSnapshotText}>{existingEntry.gearSnapshot.racket}</Text>
                                      </View>
                                    ) : null}
                                    {existingEntry.gearSnapshot.shoes ? (
                                      <View style={s.gearSnapshotItem}>
                                        <FontAwesome name="road" size={11} color={colors.textTertiary} />
                                        <Text style={s.gearSnapshotText}>{existingEntry.gearSnapshot.shoes}</Text>
                                      </View>
                                    ) : null}
                                  </View>
                                )}
                                <View style={s.entryHeader}>
                                  <Text style={s.entryMoodEmoji}>{MOOD_OPTIONS.find(m => m.key === existingEntry.mood)?.emoji || '😐'}</Text>
                                  <Text style={[s.entryTitle, { flex: 1 }]}>{existingEntry.title}</Text>
                                </View>
                                {existingEntry.content ? (
                                  <Text style={s.entryContent}>{existingEntry.content}</Text>
                                ) : null}
                                {existingEntry.serveAccuracy != null && (
                                  <Text style={s.serveAccText}>1st 서브 정확도: {existingEntry.serveAccuracy}%</Text>
                                )}
                                {(existingEntry.goodSkills?.length || existingEntry.badSkills?.length) ? (
                                  <View style={s.ratingsDisplay}>
                                    <View style={s.ratingDisplayRow}>
                                      <Chip label="나" size="small" variant="success" />
                                      {existingEntry.goodSkills?.map(sk => (
                                        <Chip key={`g_${sk}`} label={ALL_SKILL_LABELS[sk] || sk} size="small" variant="success" style={{ marginRight: 3 }} />
                                      ))}
                                      {existingEntry.badSkills?.map(sk => (
                                        <Chip key={`b_${sk}`} label={ALL_SKILL_LABELS[sk] || sk} size="small" variant="error" style={{ marginRight: 3 }} />
                                      ))}
                                    </View>
                                  </View>
                                ) : null}
                                {existingEntry.playerRatings && existingEntry.playerRatings.length > 0 && (
                                  <View style={s.ratingsDisplay}>
                                    {existingEntry.playerRatings.map(pr => (
                                      <View key={pr.name} style={s.ratingDisplayRow}>
                                        <Chip label={pr.role} size="small" variant={pr.role === '상대' ? 'warning' : 'info'} />
                                        <Text style={s.ratingDisplayName}>{pr.name}</Text>
                                        {pr.goodSkills?.length > 0 && (
                                          <View style={s.skillChipRow}>
                                            {pr.goodSkills.map(sk => (
                                              <Chip key={sk} label={ALL_SKILL_LABELS[sk] || sk} size="small" variant="success" style={{ marginRight: 3 }} />
                                            ))}
                                          </View>
                                        )}
                                        {pr.badSkills?.length > 0 && (
                                          <View style={s.skillChipRow}>
                                            {pr.badSkills.map(sk => (
                                              <Chip key={sk} label={ALL_SKILL_LABELS[sk] || sk} size="small" variant="error" style={{ marginRight: 3 }} />
                                            ))}
                                          </View>
                                        )}
                                      </View>
                                    ))}
                                  </View>
                                )}
                                <View style={s.entryActions}>
                                  <Button title="일지 수정" size="small" variant="ghost" onPress={() => {
                                    openEntryFormForPersonalGame(pg);
                                  }} />
                                  <Button title="일지 삭제" size="small" variant="ghost" textStyle={{ color: colors.error }} onPress={() => handleDeleteEntry(existingEntry.id)} />
                                  <View style={{ flex: 1 }} />
                                  <Button title="게임 수정" size="small" variant="outline" onPress={() => handleEditPersonalGame(pg)} />
                                  <Button title="게임 삭제" size="small" variant="ghost" textStyle={{ color: colors.error }} onPress={() => handleDeletePersonalGame(pg.id)} />
                                </View>
                              </View>
                            )}
                            {isExpanded && !existingEntry && (
                              <View style={[s.entryActions, { marginTop: spacing.md }]}>
                                <Button title="게임 수정" size="small" variant="outline" onPress={() => handleEditPersonalGame(pg)} />
                                <Button title="게임 삭제" size="small" variant="ghost" textStyle={{ color: colors.error }} onPress={() => handleDeletePersonalGame(pg.id)} />
                              </View>
                            )}
                          </Card>
                        );
                      })}
                    </View>
                  );
                })}
              </>
            )}
          </>
        )}

        {/* ════════ AI 분석 탭 ════════ */}
        {activeTab === 'ai' && (
          <>
            <Card title="AI 코치 분석">
              {!geminiKey ? (
                <Text style={s.emptyText}>설정 {'>'} Gemini API 키를 먼저 등록해주세요</Text>
              ) : (
                <>
                  <Button
                    title={store.aiLoading ? '분석 중...' : '내 스탯 분석하기'}
                    onPress={handleAIAnalysis}
                    loading={store.aiLoading}
                    disabled={store.aiLoading}
                    variant="primary"
                    fullWidth
                    style={{ marginBottom: spacing.lg }}
                  />
                  {store.aiAnalysis ? (
                    <Text style={s.aiText}>{store.aiAnalysis}</Text>
                  ) : !store.aiLoading ? (
                    <Text style={s.emptyText}>분석 버튼을 눌러 AI 코치의 조언을 받아보세요</Text>
                  ) : null}
                </>
              )}
            </Card>

            {/* Quick stat summary for context */}
            <Card title="현재 스탯 요약">
              <View style={s.subStatRow}>
                {STAT_KEYS.map(key => (
                  <StatPill
                    key={key}
                    label={STAT_LABELS[key]}
                    value={computedStats[key]}
                    color={colors.primary}
                    bgColor={colors.bg}
                    size="small"
                  />
                ))}
              </View>
            </Card>
          </>
        )}

        <View style={{ height: 40 }} />
      </View>
    </ScrollView>
  );
}

// ─── Styles ─────────────────────────────────────
const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingBottom: 80,
  },
  container: {
    maxWidth: MAX_WIDTH,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },

  // Gear
  addForm: {
    marginBottom: spacing.md,
  },
  emptyText: {
    ...typography.body,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  racketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  racketInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  racketName: {
    ...typography.bodyMedium,
    color: colors.text,
  },

  // String
  stringBlock: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stringHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  stringRacketName: {
    ...typography.captionMedium,
    color: colors.textSecondary,
  },
  stringDetail: {
    ...typography.body,
    color: colors.text,
    marginBottom: 6,
  },
  gaugeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 4,
  },
  gaugePercent: {
    ...typography.captionMedium,
    width: 36,
    textAlign: 'right',
  },
  warningText: {
    ...typography.caption,
    color: colors.error,
    fontWeight: '700',
    marginTop: 2,
    marginBottom: 4,
  },
  stringActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },

  // Shoes
  shoeText: {
    ...typography.body,
    color: colors.text,
  },

  // Radar Chart
  chartWrap: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  compareHint: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginRight: spacing.md,
  },

  // Stat controls
  statRow: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
  },
  statLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statLabelText: {
    ...typography.bodyMedium,
    color: colors.text,
    flex: 1,
  },
  statValue: {
    ...typography.bodyMedium,
    color: colors.primary,
    marginRight: spacing.sm,
    minWidth: 28,
    textAlign: 'right',
  },
  statSlider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
  },
  statBtn: {
    backgroundColor: colors.navyLight,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statBtnText: {
    ...typography.captionMedium,
    color: colors.text,
  },
  statBarWrap: {
    flex: 1,
  },

  // Sub stats
  subStatRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    flexWrap: 'wrap',
  },
  subSliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  subLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    width: 50,
  },
  subBarWrap: {
    flex: 1,
  },

  // Journal form
  formLabel: {
    ...typography.captionMedium,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  journalHint: {
    ...typography.body,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  moodRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  moodBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    flex: 1,
  },
  moodBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryBg,
  },
  moodEmoji: {
    fontSize: 20,
    marginBottom: 2,
  },
  moodLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  moodLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  // Entry list
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  entryMoodEmoji: {
    fontSize: 24,
  },
  entryTitle: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  entryDate: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  entryBody: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  entryContent: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
  },
  entryTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
  entryActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  serveAccText: {
    ...typography.captionMedium,
    color: colors.info,
    marginTop: spacing.sm,
  },

  // AI
  aiText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 24,
  },

  // Game history
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
  },
  gameDateHeader: {
    ...typography.section,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    paddingLeft: 2,
  },
  gameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  gameResultBadge: {
    width: 32,
    alignItems: 'center',
  },
  gameResultText: {
    ...typography.bodyMedium,
    fontWeight: '700',
  },
  gameOpponents: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  gamePartner: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  gameScoreWrap: {
    paddingHorizontal: spacing.sm,
  },
  gameScore: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },

  // Personal game add button
  addPersonalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.md,
  },
  addPersonalBtnText: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  scoreInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  scoreColon: {
    ...typography.title,
    color: colors.textSecondary,
    paddingBottom: 16,
  },

  // Gear snapshot display
  gearSnapshotRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.navyLight,
    borderRadius: radius.sm,
  },
  gearSnapshotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  gearSnapshotText: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  // Player rating (form)
  ratingBlock: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
  },
  ratingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ratingName: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  ratingRole: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  // Player rating (display)
  ratingsDisplay: {
    marginTop: spacing.sm,
  },
  ratingDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
    flexWrap: 'wrap',
  },
  ratingDisplayName: {
    ...typography.captionMedium,
    color: colors.text,
  },
  ratingComment: {
    ...typography.caption,
    color: colors.textTertiary,
    width: '100%',
    paddingLeft: spacing.xl,
  },
  ratingBadge: {
    ...typography.captionMedium,
    color: colors.primary,
  },
  skillSubLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: 4,
    marginTop: 4,
  },
  skillChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 2,
  },
  computedHint: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  compareToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  compareToggleText: {
    ...typography.captionMedium,
    color: colors.textTertiary,
  },
  emojiGauge: {
    fontSize: 14,
    letterSpacing: 2,
  },
  ogSection: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderStyle: 'dashed' as any,
  },
  ogLabel: {
    ...typography.captionMedium,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  ogDetail: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: 4,
  },
});
