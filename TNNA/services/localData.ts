/**
 * Local Data Service
 * Provides local data storage via AsyncStorage (offline cache for Supabase sync)
 * Uses AsyncStorage for persistent storage
 */

import { Player, Session, Match, MatchResult, GameType, ClubSettings, ClubFeatureFlags, DuesData, LedgerData, AdminLevel, AdminPermissions, SubscriptionTier, TierFeatureConfig } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
const STORAGE_KEYS = {
  SESSIONS: (clubCode: string) => `@tennis_sessions_${clubCode}`,
  PLAYERS: (clubCode: string) => `@tennis_players_${clubCode}`,
  SETTINGS: (clubCode: string) => `@tennis_settings_${clubCode}`,
  FEATURE_FLAGS: (clubCode: string) => `@tennis_admin_flags_${clubCode}`,
  MEMBER_EMAILS: (clubCode: string) => `@tennis_members_${clubCode}`,
  MEMBER_NAMES: (clubCode: string) => `@tennis_member_names_${clubCode}`,
  DUES: (clubCode: string) => `@tennis_dues_${clubCode}`,
  ADMIN_LEVELS: (clubCode: string) => `@tennis_admin_levels_${clubCode}`,
  RESERVATIONS: (clubCode: string) => `@tennis_reservations_${clubCode}`,
  LEDGER: (clubCode: string) => `@tennis_ledger_${clubCode}`,
  CLUB_TIER: (clubCode: string) => `@tennis_club_tier_${clubCode}`,
  TIER_FEATURE_CONFIG: '@tennis_tier_feature_config',
  CLUBS_REGISTRY: '@tennis_clubs_registry',
  SUPER_ADMIN_EMAILS: '@tennis_super_admins',
};

// Import session data from JSON files
import HMMC_SESSIONS_RAW from '../assets/data/HMMC_sessions.json';
import MSPC_SESSIONS_RAW from '../assets/data/MSPC_sessions.json';

// Transform raw session data to our Session format
type RawScheduleItem = [string, string[], string[], number];
type RawSession = {
  schedule: RawScheduleItem[];
  results: Record<string, MatchResult>;
  court_type?: string;
  groups_snapshot?: Record<string, string>;
  group_only?: boolean;
  score_view_mode?: string; // "전체" or "조별 보기 (A/B조)"
};
type RawSessionsData = Record<string, RawSession>;

function transformSessions(rawData: RawSessionsData): Record<string, Session> {
  const sessions: Record<string, Session> = {};

  for (const [date, rawSession] of Object.entries(rawData)) {
    const schedule: Match[] = (rawSession.schedule || []).map((item: RawScheduleItem) => ({
      gameType: item[0] as GameType,
      team1: item[1],
      team2: item[2],
      court: item[3],
    }));

    // Determine groupOnly from score_view_mode or group_only field
    let groupOnly = rawSession.group_only;
    if (groupOnly === undefined && rawSession.score_view_mode) {
      // "조별 보기 (A/B조)" means groupOnly=true, "전체" means groupOnly=false
      groupOnly = rawSession.score_view_mode.includes('조별');
    }

    sessions[date] = {
      schedule,
      results: rawSession.results || {},
      courtType: rawSession.court_type,
      groupsSnapshot: rawSession.groups_snapshot,
      groupOnly: groupOnly || false,
      createdAt: new Date(date),
      updatedAt: new Date(date),
    };
  }

  return sessions;
}

// HMMC Players data
export const HMMC_PLAYERS: Omit<Player, 'id' | 'adminNtrp'>[] = [
  { name: "김동현", gender: "남", hand: "오른손", ageGroup: "30대", racket: "모름", group: "B조", ntrp: 2.0, mbti: null },
  { name: "남승화", gender: "여", hand: "오른손", ageGroup: "40대", racket: "모름", group: "B조", ntrp: 1.5, mbti: null },
  { name: "남유경", gender: "여", hand: "오른손", ageGroup: "40대", racket: "모름", group: "A조", ntrp: 2.3, mbti: null },
  { name: "문선오", gender: "여", hand: "오른손", ageGroup: "40대", racket: "모름", group: "B조", ntrp: 2.0, mbti: null },
  { name: "민솔기", gender: "여", hand: "오른손", ageGroup: "40대", racket: "모름", group: "A조", ntrp: 2.3, mbti: null },
  { name: "박기혜", gender: "여", hand: "오른손", ageGroup: "40대", racket: "모름", group: "A조", ntrp: 2.0, mbti: null },
  { name: "박아리", gender: "여", hand: "오른손", ageGroup: "40대", racket: "모름", group: "B조", ntrp: 2.0, mbti: null },
  { name: "박준수", gender: "남", hand: "오른손", ageGroup: "40대", racket: "모름", group: "B조", ntrp: 2.0, mbti: null },
  { name: "박진균", gender: "남", hand: "오른손", ageGroup: "30대", racket: "모름", group: "A조", ntrp: 2.5, mbti: null },
  { name: "배성균", gender: "남", hand: "오른손", ageGroup: "40대", racket: "윌슨", group: "A조", ntrp: 3.0, mbti: "ENFP" },
  { name: "배효진", gender: "여", hand: "오른손", ageGroup: "40대", racket: "모름", group: "B조", ntrp: 2.0, mbti: null },
  { name: "성지혜", gender: "여", hand: "오른손", ageGroup: "40대", racket: "모름", group: "A조", ntrp: 2.2, mbti: null },
  { name: "신영식", gender: "남", hand: "오른손", ageGroup: "50대", racket: "모름", group: "A조", ntrp: 3.0, mbti: null },
  { name: "양지선", gender: "여", hand: "오른손", ageGroup: "40대", racket: "모름", group: "A조", ntrp: 2.3, mbti: null },
  { name: "염보배", gender: "여", hand: "왼손", ageGroup: "40대", racket: "모름", group: "B조", ntrp: 2.0, mbti: null },
  { name: "유명규", gender: "남", hand: "오른손", ageGroup: "40대", racket: "모름", group: "A조", ntrp: 2.5, mbti: null },
  { name: "유연주", gender: "여", hand: "오른손", ageGroup: "40대", racket: "모름", group: "A조", ntrp: 2.3, mbti: null },
  { name: "이동은", gender: "남", hand: "왼손", ageGroup: "40대", racket: "모름", group: "A조", ntrp: 2.8, mbti: null },
  { name: "이상희", gender: "여", hand: "오른손", ageGroup: "40대", racket: "모름", group: "A조", ntrp: 3.0, mbti: null },
  { name: "이수경", gender: "여", hand: "오른손", ageGroup: "40대", racket: "모름", group: "A조", ntrp: 2.3, mbti: null },
  { name: "이수영", gender: "남", hand: "오른손", ageGroup: "40대", racket: "모름", group: "A조", ntrp: 2.3, mbti: null },
  { name: "이수옥", gender: "여", hand: "오른손", ageGroup: "40대", racket: "모름", group: "A조", ntrp: 2.5, mbti: null },
  { name: "이승준", gender: "남", hand: "오른손", ageGroup: "40대", racket: "모름", group: "A조", ntrp: 2.5, mbti: null },
  { name: "이영우", gender: "여", hand: "오른손", ageGroup: "50대", racket: "모름", group: "A조", ntrp: 2.3, mbti: null },
  { name: "이의정", gender: "여", hand: "오른손", ageGroup: "40대", racket: "모름", group: "B조", ntrp: 1.5, mbti: null },
  { name: "이정은", gender: "여", hand: "오른손", ageGroup: "40대", racket: "모름", group: "B조", ntrp: 2.0, mbti: null },
  { name: "이현목", gender: "남", hand: "오른손", ageGroup: "40대", racket: "모름", group: "A조", ntrp: 2.5, mbti: null },
  { name: "장홍선", gender: "남", hand: "오른손", ageGroup: "30대", racket: "모름", group: "B조", ntrp: 2.0, mbti: null },
  { name: "전희종", gender: "남", hand: "오른손", ageGroup: "40대", racket: "모름", group: "B조", ntrp: 2.0, mbti: null },
  { name: "정아연", gender: "여", hand: "오른손", ageGroup: "40대", racket: "모름", group: "B조", ntrp: 2.0, mbti: null },
  { name: "지문희", gender: "여", hand: "오른손", ageGroup: "40대", racket: "모름", group: "A조", ntrp: 2.5, mbti: null },
  { name: "최승준", gender: "남", hand: "오른손", ageGroup: "40대", racket: "모름", group: "A조", ntrp: 2.5, mbti: null },
  { name: "최용성", gender: "남", hand: "오른손", ageGroup: "30대", racket: "모름", group: "A조", ntrp: 2.5, mbti: null },
  { name: "한승현", gender: "남", hand: "오른손", ageGroup: "50대", racket: "모름", group: "A조", ntrp: 3.0, mbti: null },
  { name: "홍성현", gender: "남", hand: "오른손", ageGroup: "30대", racket: "모름", group: "B조", ntrp: 2.0, mbti: null },
];

// MSPC Players data
export const MSPC_PLAYERS: Omit<Player, 'id' | 'adminNtrp'>[] = [
  { name: "강상백", gender: "남", hand: "오른손", ageGroup: "30대", racket: "요넥스", group: "B조", ntrp: null, mbti: null },
  { name: "기원호", gender: "남", hand: "오른손", ageGroup: "30대", racket: "바볼랏", group: "B조", ntrp: null, mbti: null },
  { name: "김금비", gender: "여", hand: "오른손", ageGroup: "30대", racket: "윌슨", group: "B조", ntrp: 2.0, mbti: "ENFJ" },
  { name: "김연주", gender: "여", hand: "오른손", ageGroup: "30대", racket: "윌슨", group: "B조", ntrp: 2.0, mbti: "ENTP" },
  { name: "김주현", gender: "여", hand: "오른손", ageGroup: "30대", racket: "요넥스", group: "A조", ntrp: 2.0, mbti: "ESFP" },
  { name: "류미림", gender: "여", hand: "오른손", ageGroup: "미배정", racket: "모름", group: "B조", ntrp: null, mbti: null },
  { name: "박대운", gender: "남", hand: "오른손", ageGroup: "40대", racket: "모름", group: "B조", ntrp: null, mbti: null },
  { name: "박서영", gender: "여", hand: "오른손", ageGroup: "30대", racket: "헤드", group: "B조", ntrp: 2.0, mbti: "ESTP" },
  { name: "박진아", gender: "여", hand: "오른손", ageGroup: "30대", racket: "윌슨", group: "B조", ntrp: 2.0, mbti: "ENFP" },
  { name: "배성균", gender: "남", hand: "오른손", ageGroup: "40대", racket: "윌슨", group: "A조", ntrp: 3.4, mbti: "ENFP" },
  { name: "송윤선", gender: "여", hand: "왼손", ageGroup: "40대", racket: "윌슨", group: "B조", ntrp: 2.0, mbti: "ESFJ" },
  { name: "송지예", gender: "여", hand: "오른손", ageGroup: "30대", racket: "헤드", group: "B조", ntrp: 2.0, mbti: "ENFP" },
  { name: "안근우", gender: "남", hand: "오른손", ageGroup: "30대", racket: "윌슨", group: "B조", ntrp: 3.0, mbti: "ENTP" },
  { name: "양동구", gender: "남", hand: "오른손", ageGroup: "40대", racket: "요넥스", group: "B조", ntrp: null, mbti: "ISFJ" },
  { name: "양정우", gender: "남", hand: "오른손", ageGroup: "미배정", racket: "모름", group: "B조", ntrp: null, mbti: null },
  { name: "양진우", gender: "남", hand: "오른손", ageGroup: "40대", racket: "요넥스", group: "A조", ntrp: 3.0, mbti: "ENFJ" },
  { name: "유대한", gender: "남", hand: "오른손", ageGroup: "30대", racket: "윌슨", group: "A조", ntrp: 3.0, mbti: null },
  { name: "이병각", gender: "남", hand: "오른손", ageGroup: "미배정", racket: "모름", group: "B조", ntrp: null, mbti: null },
  { name: "이원형", gender: "남", hand: "왼손", ageGroup: "50대", racket: "요넥스", group: "A조", ntrp: null, mbti: "ENFJ" },
  { name: "이학수", gender: "남", hand: "오른손", ageGroup: "40대", racket: "바볼랏", group: "A조", ntrp: 3.8, mbti: "ENFP" },
  { name: "전연숙", gender: "여", hand: "오른손", ageGroup: "30대", racket: "요넥스", group: "B조", ntrp: 2.5, mbti: "ESFJ" },
  { name: "정동민", gender: "남", hand: "오른손", ageGroup: "40대", racket: "모름", group: "B조", ntrp: 2.0, mbti: "INFP" },
  { name: "정유민", gender: "남", hand: "오른손", ageGroup: "30대", racket: "헤드", group: "A조", ntrp: 3.0, mbti: null },
  { name: "정진환", gender: "남", hand: "오른손", ageGroup: "미배정", racket: "요넥스", group: "A조", ntrp: null, mbti: null },
  { name: "차혜주", gender: "여", hand: "오른손", ageGroup: "미배정", racket: "헤드", group: "B조", ntrp: 2.5, mbti: "ISFP" },
  { name: "채문현", gender: "남", hand: "오른손", ageGroup: "미배정", racket: "모름", group: "B조", ntrp: null, mbti: null },
  { name: "고준희", gender: "여", hand: "오른손", ageGroup: "30대", racket: "윌슨", group: "B조", ntrp: 1.8, mbti: null },
  { name: "허시완", gender: "남", hand: "오른손", ageGroup: "40대", racket: "모름", group: "B조", ntrp: null, mbti: null },
  { name: "허양재", gender: "남", hand: "오른손", ageGroup: "40대", racket: "모름", group: "B조", ntrp: null, mbti: null },
  { name: "황규석", gender: "남", hand: "오른손", ageGroup: "40대", racket: "바볼랏", group: "A조", ntrp: 3.5, mbti: "ESFJ" },
  { name: "황예슬", gender: "여", hand: "오른손", ageGroup: "30대", racket: "모름", group: "A조", ntrp: null, mbti: null },
  { name: "황태훈", gender: "남", hand: "오른손", ageGroup: "40대", racket: "모름", group: "B조", ntrp: null, mbti: null },
  { name: "황혜진", gender: "여", hand: "오른손", ageGroup: "40대", racket: "요넥스", group: "B조", ntrp: 2.0, mbti: null },
];

// Club registry
export const CLUBS: Record<string, { name: string; adminEmails: string[] }> = {
  HMMC: { name: "한미모스", adminEmails: ["admin@hmmc.com"] },
  MSPC: { name: "마리아상암포바", adminEmails: ["admin@mspc.com"] },
};

// Default data from JSON files (used as fallback if no saved data exists)
const DEFAULT_PLAYERS: Record<string, Player[]> = {
  HMMC: HMMC_PLAYERS.map((p, i) => ({ ...p, adminNtrp: p.ntrp, id: `hmmc-${i}` })),
  MSPC: MSPC_PLAYERS.map((p, i) => ({ ...p, adminNtrp: p.ntrp, id: `mspc-${i}` })),
};

const DEFAULT_SESSIONS: Record<string, Record<string, Session>> = {
  HMMC: transformSessions(HMMC_SESSIONS_RAW as RawSessionsData),
  MSPC: transformSessions(MSPC_SESSIONS_RAW as RawSessionsData),
};

// In-memory cache - starts empty, loaded from AsyncStorage or defaults
let localPlayers: Record<string, Player[]> = {};
let localSessions: Record<string, Record<string, Session>> = {};
let localReservations: Record<string, any> = {};
let initialized: Record<string, boolean> = {};

// Local data is always used (AsyncStorage = offline cache for Supabase sync)
export function shouldUseLocalData(): boolean {
  return true;
}

// Initialize data for a club from AsyncStorage or defaults
async function initializeClubData(clubCode: string): Promise<void> {
  if (initialized[clubCode]) return;

  try {
    // Load players from AsyncStorage or use defaults
    const storedPlayers = await AsyncStorage.getItem(STORAGE_KEYS.PLAYERS(clubCode));
    if (storedPlayers) {
      localPlayers[clubCode] = JSON.parse(storedPlayers);
    } else {
      localPlayers[clubCode] = DEFAULT_PLAYERS[clubCode] || [];
    }
    // 마이그레이션: adminNtrp 없는 기존 선수에 ntrp 값 복사
    for (const p of localPlayers[clubCode]) {
      if ((p as any).adminNtrp === undefined) {
        (p as any).adminNtrp = p.ntrp;
      }
    }

    // Load sessions from AsyncStorage or use defaults
    const storedSessions = await AsyncStorage.getItem(STORAGE_KEYS.SESSIONS(clubCode));
    if (storedSessions) {
      localSessions[clubCode] = JSON.parse(storedSessions);
    } else {
      localSessions[clubCode] = DEFAULT_SESSIONS[clubCode] || {};
    }

    initialized[clubCode] = true;
    console.log(`Initialized data for ${clubCode}, sessions:`, Object.keys(localSessions[clubCode] || {}).length);
  } catch (error) {
    console.error('Error initializing club data:', error);
    // Fallback to defaults
    localPlayers[clubCode] = DEFAULT_PLAYERS[clubCode] || [];
    localSessions[clubCode] = DEFAULT_SESSIONS[clubCode] || {};
    initialized[clubCode] = true;
  }
}

// Local player operations
export async function getLocalPlayers(clubCode: string): Promise<Player[]> {
  await initializeClubData(clubCode);
  return localPlayers[clubCode] || [];
}

/** 전체 선수 목록 덮어쓰기 (서버 동기화용) */
export async function saveLocalPlayers(clubCode: string, players: Player[]): Promise<void> {
  await initializeClubData(clubCode);
  localPlayers[clubCode] = players;
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.PLAYERS(clubCode), JSON.stringify(players));
  } catch (error) {
    console.error('Error saving players:', error);
  }
}

export async function addLocalPlayer(clubCode: string, player: Omit<Player, 'id'>): Promise<string> {
  await initializeClubData(clubCode);

  const id = `local-${Date.now()}`;
  if (!localPlayers[clubCode]) {
    localPlayers[clubCode] = [];
  }
  localPlayers[clubCode].push({ ...player, id });

  // Save to AsyncStorage
  try {
    await AsyncStorage.setItem(
      STORAGE_KEYS.PLAYERS(clubCode),
      JSON.stringify(localPlayers[clubCode])
    );
  } catch (error) {
    console.error('Error saving player:', error);
  }

  return id;
}

export async function updateLocalPlayer(clubCode: string, playerId: string, updates: Partial<Player>): Promise<boolean> {
  await initializeClubData(clubCode);

  const players = localPlayers[clubCode];
  if (!players) return false;

  const index = players.findIndex(p => String(p.id) === String(playerId));
  if (index === -1) return false;

  players[index] = { ...players[index], ...updates };

  // Save to AsyncStorage
  try {
    await AsyncStorage.setItem(
      STORAGE_KEYS.PLAYERS(clubCode),
      JSON.stringify(localPlayers[clubCode])
    );
  } catch (error) {
    console.error('Error updating player:', error);
    return false;
  }

  return true;
}

export async function deleteLocalPlayer(clubCode: string, playerId: string): Promise<boolean> {
  await initializeClubData(clubCode);

  const players = localPlayers[clubCode];
  if (!players) return false;

  const index = players.findIndex(p => String(p.id) === String(playerId));
  if (index === -1) return false;

  players.splice(index, 1);

  // Save to AsyncStorage
  try {
    await AsyncStorage.setItem(
      STORAGE_KEYS.PLAYERS(clubCode),
      JSON.stringify(localPlayers[clubCode])
    );
  } catch (error) {
    console.error('Error deleting player:', error);
    return false;
  }

  return true;
}

// Local session operations
export async function getLocalSession(clubCode: string, date: string): Promise<Session | null> {
  await initializeClubData(clubCode);
  return localSessions[clubCode]?.[date] || null;
}

export async function getLocalSessionDates(clubCode: string): Promise<string[]> {
  await initializeClubData(clubCode);
  const sessions = localSessions[clubCode];
  if (!sessions) return [];
  return Object.keys(sessions).sort().reverse();
}

export async function saveLocalSession(clubCode: string, date: string, session: Partial<Session>): Promise<boolean> {
  await initializeClubData(clubCode);

  try {
    const existing = localSessions[clubCode]?.[date];

    if (!localSessions[clubCode]) {
      localSessions[clubCode] = {};
    }

    localSessions[clubCode][date] = {
      schedule: session.schedule || existing?.schedule || [],
      results: session.results || existing?.results || {},
      courtType: session.courtType || existing?.courtType,
      groupsSnapshot: session.groupsSnapshot || existing?.groupsSnapshot,
      groupOnly: session.groupOnly !== undefined ? session.groupOnly : existing?.groupOnly,
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    // Save to AsyncStorage
    await AsyncStorage.setItem(
      STORAGE_KEYS.SESSIONS(clubCode),
      JSON.stringify(localSessions[clubCode])
    );

    console.log('Session saved successfully:', clubCode, date);
    return true;
  } catch (error) {
    console.error('Error saving local session:', error);
    return false;
  }
}

export async function deleteLocalSession(clubCode: string, date: string): Promise<boolean> {
  await initializeClubData(clubCode);
  try {
    if (!localSessions[clubCode]?.[date]) return true;
    delete localSessions[clubCode][date];
    await AsyncStorage.setItem(
      STORAGE_KEYS.SESSIONS(clubCode),
      JSON.stringify(localSessions[clubCode])
    );
    console.log('Session deleted successfully:', clubCode, date);
    return true;
  } catch (error) {
    console.error('Error deleting local session:', error);
    return false;
  }
}

// Court reservation operations
export async function getLocalReservations(clubCode: string): Promise<any> {
  const key = STORAGE_KEYS.RESERVATIONS(clubCode.toUpperCase());
  if (localReservations[clubCode]) return localReservations[clubCode];
  try {
    const stored = await AsyncStorage.getItem(key);
    const data = stored ? JSON.parse(stored) : { reservationData: {}, customModes: {}, anniversaryData: {} };
    localReservations[clubCode] = data;
    return data;
  } catch {
    return { reservationData: {}, customModes: {}, anniversaryData: {} };
  }
}

export async function saveLocalReservations(clubCode: string, data: any): Promise<boolean> {
  const key = STORAGE_KEYS.RESERVATIONS(clubCode.toUpperCase());
  try {
    localReservations[clubCode] = data;
    await AsyncStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Error saving reservations:', error);
    return false;
  }
}

// Local club operations
export function getLocalClub(clubCode: string): { name: string; adminEmails: string[] } | null {
  return CLUBS[clubCode.toUpperCase()] || null;
}

export function getAllLocalClubs(): { code: string; name: string }[] {
  return Object.entries(CLUBS).map(([code, data]) => ({
    code,
    name: data.name,
  }));
}

export function isLocalClubAdmin(clubCode: string, email: string): boolean {
  const club = CLUBS[clubCode.toUpperCase()];
  if (!club) return false;
  const lower = email.toLowerCase();
  // 슈퍼 어드민은 모든 클럽의 관리자
  if (SUPER_ADMIN_EMAILS.includes(lower)) return true;
  return club.adminEmails.some((e) => e.toLowerCase() === lower);
}

// Default club settings
export function getDefaultClubSettings(): ClubSettings {
  return {
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
    defaultMaxGames: 4,
    useNtrpBalance: false,
    memberRestrictions: {
      hideMatch: false,
      hideRecords: false,
      hidePlayers: false,
      hideDues: true,
      hideSettings: false,
    },
  };
}

// In-memory settings cache
let localSettings: Record<string, ClubSettings> = {};

// Get club settings
export async function getLocalClubSettings(clubCode: string): Promise<ClubSettings> {
  const normalizedCode = clubCode.toUpperCase();

  // Return from cache if available
  if (localSettings[normalizedCode]) {
    return localSettings[normalizedCode];
  }

  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS(normalizedCode));
    if (stored) {
      const settings = JSON.parse(stored);
      // Merge with defaults to ensure all fields exist
      localSettings[normalizedCode] = { ...getDefaultClubSettings(), ...settings };
    } else {
      localSettings[normalizedCode] = getDefaultClubSettings();
    }
  } catch (error) {
    console.error('Error loading club settings:', error);
    localSettings[normalizedCode] = getDefaultClubSettings();
  }

  return localSettings[normalizedCode];
}

// Save club settings
export async function saveLocalClubSettings(clubCode: string, settings: ClubSettings): Promise<boolean> {
  const normalizedCode = clubCode.toUpperCase();

  try {
    localSettings[normalizedCode] = settings;
    await AsyncStorage.setItem(
      STORAGE_KEYS.SETTINGS(normalizedCode),
      JSON.stringify(settings)
    );
    console.log('Club settings saved successfully:', normalizedCode);
    return true;
  } catch (error) {
    console.error('Error saving club settings:', error);
    return false;
  }
}

// =============================================
// Super Admin (슈퍼 어드민)
// =============================================

const SEED_SUPER_ADMIN = 'studioroomcode@gmail.com';
export let SUPER_ADMIN_EMAILS = [SEED_SUPER_ADMIN];

export function checkIsSuperAdmin(email: string | null): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
}

export function getSuperAdminEmails(): string[] {
  return [...SUPER_ADMIN_EMAILS];
}

export async function addSuperAdminEmail(email: string): Promise<boolean> {
  const lower = email.toLowerCase().trim();
  if (!lower || SUPER_ADMIN_EMAILS.includes(lower)) return false;
  SUPER_ADMIN_EMAILS = [...SUPER_ADMIN_EMAILS, lower];
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.SUPER_ADMIN_EMAILS, JSON.stringify(SUPER_ADMIN_EMAILS));
    return true;
  } catch (error) {
    console.error('Error saving super admin emails:', error);
    return false;
  }
}

export async function removeSuperAdminEmail(email: string): Promise<boolean> {
  const lower = email.toLowerCase().trim();
  if (SUPER_ADMIN_EMAILS.length <= 1) return false;
  SUPER_ADMIN_EMAILS = SUPER_ADMIN_EMAILS.filter((e) => e !== lower);
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.SUPER_ADMIN_EMAILS, JSON.stringify(SUPER_ADMIN_EMAILS));
    return true;
  } catch (error) {
    console.error('Error saving super admin emails:', error);
    return false;
  }
}

// =============================================
// 회원 이메일 관리
// =============================================

// 인메모리 캐시
let memberEmailsCache: Record<string, string[]> = {};

export async function getMemberEmails(clubCode: string): Promise<string[]> {
  const norm = clubCode.toUpperCase();
  if (memberEmailsCache[norm]) return memberEmailsCache[norm];
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.MEMBER_EMAILS(norm));
    if (stored) {
      memberEmailsCache[norm] = JSON.parse(stored);
      return memberEmailsCache[norm];
    }
  } catch (error) {
    console.error('Error loading member emails:', error);
  }
  memberEmailsCache[norm] = [];
  return [];
}

export async function saveMemberEmails(clubCode: string, emails: string[]): Promise<boolean> {
  const norm = clubCode.toUpperCase();
  memberEmailsCache[norm] = emails;
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.MEMBER_EMAILS(norm), JSON.stringify(emails));
    return true;
  } catch (error) {
    console.error('Error saving member emails:', error);
    return false;
  }
}

// 회원 이메일 → 이름 매핑
let memberNamesCache: Record<string, Record<string, string>> = {};

export async function getMemberNames(clubCode: string): Promise<Record<string, string>> {
  const norm = clubCode.toUpperCase();
  if (memberNamesCache[norm]) return memberNamesCache[norm];
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.MEMBER_NAMES(norm));
    if (stored) {
      memberNamesCache[norm] = JSON.parse(stored);
      return memberNamesCache[norm];
    }
  } catch (error) {
    console.error('Error loading member names:', error);
  }
  memberNamesCache[norm] = {};
  return {};
}

export async function saveMemberName(clubCode: string, email: string, name: string): Promise<void> {
  const norm = clubCode.toUpperCase();
  if (!memberNamesCache[norm]) memberNamesCache[norm] = {};
  memberNamesCache[norm][email.toLowerCase()] = name;
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.MEMBER_NAMES(norm), JSON.stringify(memberNamesCache[norm]));
  } catch (error) {
    console.error('Error saving member name:', error);
  }
}

// 앱 초기화 시 모든 클럽 회원 이메일 로드 (로그인 검증용)
export async function loadAllMemberEmails(): Promise<void> {
  for (const code of Object.keys(CLUBS)) {
    await getMemberEmails(code);
  }
}

// 등록된 이메일인지 확인 (슈퍼어드민 / 클럽 관리자 / 일반 회원)
export function isRegisteredEmail(email: string): boolean {
  const lower = email.toLowerCase();
  if (SUPER_ADMIN_EMAILS.includes(lower)) return true;
  for (const [code, club] of Object.entries(CLUBS)) {
    if (club.adminEmails.some((e) => e.toLowerCase() === lower)) return true;
    if (memberEmailsCache[code]?.some((e) => e.toLowerCase() === lower)) return true;
  }
  return false;
}

// 이메일이 속한 클럽코드 찾기 (없으면 null)
export function findClubByEmail(email: string): string | null {
  const lower = email.toLowerCase();
  for (const [code, club] of Object.entries(CLUBS)) {
    if (club.adminEmails.some((e) => e.toLowerCase() === lower)) return code;
    if (memberEmailsCache[code]?.some((e) => e.toLowerCase() === lower)) return code;
  }
  return null;
}

// 이메일이 속한 모든 클럽코드 반환
export function findAllClubsByEmail(email: string): string[] {
  const lower = email.toLowerCase();
  const clubs: string[] = [];
  for (const [code, club] of Object.entries(CLUBS)) {
    if (club.adminEmails.some((e) => e.toLowerCase() === lower)) { clubs.push(code); continue; }
    if (memberEmailsCache[code]?.some((e) => e.toLowerCase() === lower)) clubs.push(code);
  }
  return clubs;
}

// 이메일의 역할 판별: 'superAdmin' | 'admin' | 'member' | null
export function getUserRole(email: string | null, clubCode: string | null): 'superAdmin' | 'admin' | 'member' | null {
  if (!email) return null;
  const lower = email.toLowerCase();
  if (SUPER_ADMIN_EMAILS.includes(lower)) return 'superAdmin';
  if (clubCode) {
    const club = CLUBS[clubCode.toUpperCase()];
    if (club?.adminEmails.some((e) => e.toLowerCase() === lower)) return 'admin';
    if (memberEmailsCache[clubCode.toUpperCase()]?.some((e) => e.toLowerCase() === lower)) return 'member';
  }
  return null;
}

// =============================================
// 회비 데이터 관리
// =============================================
let localDues: Record<string, DuesData> = {};

function getDefaultDuesData(): DuesData {
  return { billingPeriods: [], payments: {} };
}

export async function getLocalDues(clubCode: string): Promise<DuesData> {
  const norm = clubCode.toUpperCase();
  if (localDues[norm]) return localDues[norm];
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.DUES(norm));
    if (stored) {
      localDues[norm] = { ...getDefaultDuesData(), ...JSON.parse(stored) };
    } else {
      localDues[norm] = getDefaultDuesData();
    }
  } catch (error) {
    console.error('Error loading dues data:', error);
    localDues[norm] = getDefaultDuesData();
  }
  return localDues[norm];
}

export async function saveLocalDues(clubCode: string, dues: DuesData): Promise<boolean> {
  const norm = clubCode.toUpperCase();
  try {
    localDues[norm] = dues;
    await AsyncStorage.setItem(STORAGE_KEYS.DUES(norm), JSON.stringify(dues));
    return true;
  } catch (error) {
    console.error('Error saving dues data:', error);
    return false;
  }
}

// =============================================
// 가계부 (Ledger) 데이터 관리
// =============================================
let localLedger: Record<string, LedgerData> = {};

function getDefaultLedgerData(): LedgerData {
  return { entries: [] };
}

export async function getLocalLedger(clubCode: string): Promise<LedgerData> {
  const norm = clubCode.toUpperCase();
  if (localLedger[norm]) return localLedger[norm];
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.LEDGER(norm));
    if (stored) {
      localLedger[norm] = { ...getDefaultLedgerData(), ...JSON.parse(stored) };
    } else {
      localLedger[norm] = getDefaultLedgerData();
    }
  } catch (error) {
    console.error('Error loading ledger data:', error);
    localLedger[norm] = getDefaultLedgerData();
  }
  return localLedger[norm];
}

export async function saveLocalLedger(clubCode: string, ledger: LedgerData): Promise<boolean> {
  const norm = clubCode.toUpperCase();
  try {
    localLedger[norm] = ledger;
    await AsyncStorage.setItem(STORAGE_KEYS.LEDGER(norm), JSON.stringify(ledger));
    return true;
  } catch (error) {
    console.error('Error saving ledger data:', error);
    return false;
  }
}

// 기본 기능 플래그 (모두 활성화)
export function getDefaultFeatureFlags(): ClubFeatureFlags {
  return {
    disableSchedule: false,
    disableAdvancedModes: false,
    disableJpgCapture: false,
    disableWinProbability: false,
    disableRecords: false,
    disableScoreEdit: false,
    disableHighlights: false,
    disableAIAnalysis: false,
    disableStats: false,
    disablePersonalStats: false,
    disableRanking: false,
    disablePlayers: false,
    disableSettings: false,
    disableDues: false,
    disableReservation: false,
  };
}

// 클럽별 기능 제한 플래그 조회
export async function getClubFeatureFlags(clubCode: string): Promise<ClubFeatureFlags> {
  const normalizedCode = clubCode.toUpperCase();
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.FEATURE_FLAGS(normalizedCode));
    if (stored) {
      return { ...getDefaultFeatureFlags(), ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Error loading feature flags:', error);
  }
  return getDefaultFeatureFlags();
}

// 클럽별 기능 제한 플래그 저장
export async function saveClubFeatureFlags(clubCode: string, flags: ClubFeatureFlags): Promise<boolean> {
  const normalizedCode = clubCode.toUpperCase();
  try {
    await AsyncStorage.setItem(
      STORAGE_KEYS.FEATURE_FLAGS(normalizedCode),
      JSON.stringify(flags)
    );
    return true;
  } catch (error) {
    console.error('Error saving feature flags:', error);
    return false;
  }
}

// 기본 등급별 기능 매핑
export function getDefaultTierFeatureConfig(): TierFeatureConfig {
  return {
    Basic: {
      disableSchedule: false,
      disableAdvancedModes: true,
      disableJpgCapture: true,
      disableWinProbability: true,
      disableRecords: true,
      disableScoreEdit: true,
      disableHighlights: true,
      disableAIAnalysis: true,
      disableStats: true,
      disablePersonalStats: true,
      disableRanking: true,
      disablePlayers: true,
      disableSettings: true,
      disableDues: true,
      disableReservation: true,
    },
    Plus: {
      disableSchedule: false,
      disableAdvancedModes: true,
      disableJpgCapture: false,
      disableWinProbability: true,
      disableRecords: false,
      disableScoreEdit: true,
      disableHighlights: false,
      disableAIAnalysis: true,
      disableStats: false,
      disablePersonalStats: true,
      disableRanking: false,
      disablePlayers: true,
      disableSettings: true,
      disableDues: true,
      disableReservation: true,
    },
    Pro: {
      disableSchedule: false,
      disableAdvancedModes: false,
      disableJpgCapture: false,
      disableWinProbability: false,
      disableRecords: false,
      disableScoreEdit: false,
      disableHighlights: false,
      disableAIAnalysis: true,
      disableStats: false,
      disablePersonalStats: false,
      disableRanking: false,
      disablePlayers: false,
      disableSettings: true,
      disableDues: false,
      disableReservation: false,
    },
    Prime: {
      disableSchedule: false,
      disableAdvancedModes: false,
      disableJpgCapture: false,
      disableWinProbability: false,
      disableRecords: false,
      disableScoreEdit: false,
      disableHighlights: false,
      disableAIAnalysis: false,
      disableStats: false,
      disablePersonalStats: false,
      disableRanking: false,
      disablePlayers: false,
      disableSettings: false,
      disableDues: false,
      disableReservation: false,
    },
  };
}

// 글로벌 등급별 기능 설정 조회
export async function getTierFeatureConfig(): Promise<TierFeatureConfig> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.TIER_FEATURE_CONFIG);
    if (stored) {
      return { ...getDefaultTierFeatureConfig(), ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Error loading tier feature config:', error);
  }
  return getDefaultTierFeatureConfig();
}

// 글로벌 등급별 기능 설정 저장
export async function saveTierFeatureConfig(config: TierFeatureConfig): Promise<boolean> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.TIER_FEATURE_CONFIG, JSON.stringify(config));
    return true;
  } catch (error) {
    console.error('Error saving tier feature config:', error);
    return false;
  }
}

// 클럽 구독 등급 조회 (기본: 'Prime' → 기존 클럽 기능 유지)
export async function getClubTier(clubCode: string): Promise<SubscriptionTier> {
  const normalizedCode = clubCode.toUpperCase();
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.CLUB_TIER(normalizedCode));
    if (stored) {
      return JSON.parse(stored) as SubscriptionTier;
    }
  } catch (error) {
    console.error('Error loading club tier:', error);
  }
  return 'Prime';
}

// 클럽 구독 등급 저장
export async function saveClubTier(clubCode: string, tier: SubscriptionTier): Promise<boolean> {
  const normalizedCode = clubCode.toUpperCase();
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.CLUB_TIER(normalizedCode), JSON.stringify(tier));
    return true;
  } catch (error) {
    console.error('Error saving club tier:', error);
    return false;
  }
}

// 유효한 기능 플래그 계산 (등급 기본값 + 클럽별 오버라이드, OR 병합)
export function computeEffectiveFlags(
  tierFlags: ClubFeatureFlags,
  clubOverrides: ClubFeatureFlags
): ClubFeatureFlags {
  const result = {} as ClubFeatureFlags;
  for (const key of Object.keys(tierFlags) as (keyof ClubFeatureFlags)[]) {
    result[key] = tierFlags[key] || clubOverrides[key];
  }
  return result;
}

// 클럽 요약 정보 (슈퍼 어드민 대시보드용)
export interface ClubSummary {
  code: string;
  name: string;
  adminEmails: string[];
  playerCount: number;
  sessionCount: number;
  lastSessionDate: string | null;
  settings: ClubSettings;
  featureFlags: ClubFeatureFlags;
  subscriptionTier: SubscriptionTier;
}

export async function getAllClubsSummary(): Promise<ClubSummary[]> {
  const summaries: ClubSummary[] = [];

  for (const [code, clubInfo] of Object.entries(CLUBS)) {
    await initializeClubData(code);

    const players = localPlayers[code] || [];
    const sessions = localSessions[code] || {};
    const sessionDates = Object.keys(sessions).sort();
    const lastSessionDate = sessionDates.length > 0 ? sessionDates[sessionDates.length - 1] : null;
    const settings = await getLocalClubSettings(code);
    const featureFlags = await getClubFeatureFlags(code);
    const subscriptionTier = await getClubTier(code);

    summaries.push({
      code,
      name: clubInfo.name,
      adminEmails: [...clubInfo.adminEmails],
      playerCount: players.length,
      sessionCount: sessionDates.length,
      lastSessionDate,
      settings,
      featureFlags,
      subscriptionTier,
    });
  }

  return summaries;
}

// 새 클럽 추가 (런타임 + AsyncStorage에 저장)
export async function addClubToRegistry(
  clubCode: string,
  name: string,
  adminEmail: string
): Promise<boolean> {
  const normalizedCode = clubCode.toUpperCase();
  if (CLUBS[normalizedCode]) return false; // 이미 존재

  CLUBS[normalizedCode] = { name, adminEmails: [adminEmail] };
  localPlayers[normalizedCode] = [];
  localSessions[normalizedCode] = {};
  initialized[normalizedCode] = true;

  // Save updated clubs registry
  try {
    const registry = Object.entries(CLUBS).map(([code, data]) => ({
      code,
      name: data.name,
      adminEmails: data.adminEmails,
    }));
    await AsyncStorage.setItem(STORAGE_KEYS.CLUBS_REGISTRY, JSON.stringify(registry));
  } catch (error) {
    console.error('Error saving clubs registry:', error);
  }

  return true;
}

// 클럽 삭제 (레지스트리 + 모든 관련 데이터)
export async function deleteClubFromRegistry(clubCode: string): Promise<boolean> {
  const normalizedCode = clubCode.toUpperCase();
  if (!CLUBS[normalizedCode]) return false;

  delete CLUBS[normalizedCode];
  delete localPlayers[normalizedCode];
  delete localSessions[normalizedCode];
  delete localReservations[normalizedCode];
  delete initialized[normalizedCode];

  try {
    // 레지스트리 업데이트
    const registry = Object.entries(CLUBS).map(([code, data]) => ({
      code,
      name: data.name,
      adminEmails: data.adminEmails,
    }));
    await AsyncStorage.setItem(STORAGE_KEYS.CLUBS_REGISTRY, JSON.stringify(registry));

    // 관련 AsyncStorage 키 삭제
    const keysToRemove = [
      STORAGE_KEYS.PLAYERS(normalizedCode),
      STORAGE_KEYS.SESSIONS(normalizedCode),
      STORAGE_KEYS.SETTINGS(normalizedCode),
      STORAGE_KEYS.FEATURE_FLAGS(normalizedCode),
      STORAGE_KEYS.MEMBER_EMAILS(normalizedCode),
      STORAGE_KEYS.MEMBER_NAMES(normalizedCode),
      STORAGE_KEYS.DUES(normalizedCode),
      STORAGE_KEYS.ADMIN_LEVELS(normalizedCode),
      STORAGE_KEYS.RESERVATIONS(normalizedCode),
      STORAGE_KEYS.LEDGER(normalizedCode),
      STORAGE_KEYS.CLUB_TIER(normalizedCode),
    ];
    await AsyncStorage.multiRemove(keysToRemove);
  } catch (error) {
    console.error('Error deleting club:', error);
  }

  return true;
}

// 클럽 관리자 이메일 업데이트
export async function updateClubAdminEmails(clubCode: string, emails: string[]): Promise<boolean> {
  const normalizedCode = clubCode.toUpperCase();
  const club = CLUBS[normalizedCode];
  if (!club) return false;

  club.adminEmails = emails;

  // Persist registry
  try {
    const registry = Object.entries(CLUBS).map(([code, data]) => ({
      code,
      name: data.name,
      adminEmails: data.adminEmails,
    }));
    await AsyncStorage.setItem(STORAGE_KEYS.CLUBS_REGISTRY, JSON.stringify(registry));
  } catch (error) {
    console.error('Error saving clubs registry:', error);
  }

  return true;
}

// 관리자 레벨 관리
const adminLevelsCache: Record<string, Record<string, number>> = {};

export async function getAdminLevels(clubCode: string): Promise<Record<string, number>> {
  const norm = clubCode.toUpperCase();
  if (adminLevelsCache[norm]) return adminLevelsCache[norm];
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.ADMIN_LEVELS(norm));
    if (stored) {
      adminLevelsCache[norm] = JSON.parse(stored);
      return adminLevelsCache[norm];
    }
  } catch (error) {
    console.error('Error loading admin levels:', error);
  }
  adminLevelsCache[norm] = {};
  return {};
}

export async function saveAdminLevels(clubCode: string, levels: Record<string, number>): Promise<boolean> {
  const norm = clubCode.toUpperCase();
  adminLevelsCache[norm] = levels;
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.ADMIN_LEVELS(norm), JSON.stringify(levels));
    return true;
  } catch (error) {
    console.error('Error saving admin levels:', error);
    return false;
  }
}

// 클럽코드 변경 (oldCode → newCode, 모든 데이터 마이그레이션)
export async function updateClubCode(oldCode: string, newCode: string): Promise<boolean> {
  const oldNorm = oldCode.toUpperCase();
  const newNorm = newCode.toUpperCase();
  if (oldNorm === newNorm) return true;
  if (!CLUBS[oldNorm]) return false;
  if (CLUBS[newNorm]) return false; // 이미 존재하는 코드

  try {
    await initializeClubData(oldNorm);

    // 1. 런타임 데이터 복사
    CLUBS[newNorm] = { ...CLUBS[oldNorm] };
    localPlayers[newNorm] = localPlayers[oldNorm] || [];
    localSessions[newNorm] = localSessions[oldNorm] || {};
    localSettings[newNorm] = localSettings[oldNorm] || getDefaultClubSettings();
    initialized[newNorm] = true;

    // 2. AsyncStorage에 새 키로 저장
    await AsyncStorage.setItem(STORAGE_KEYS.PLAYERS(newNorm), JSON.stringify(localPlayers[newNorm]));
    await AsyncStorage.setItem(STORAGE_KEYS.SESSIONS(newNorm), JSON.stringify(localSessions[newNorm]));
    await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS(newNorm), JSON.stringify(localSettings[newNorm]));

    // feature flags 마이그레이션
    const oldFlags = await AsyncStorage.getItem(STORAGE_KEYS.FEATURE_FLAGS(oldNorm));
    if (oldFlags) {
      await AsyncStorage.setItem(STORAGE_KEYS.FEATURE_FLAGS(newNorm), oldFlags);
    }

    // tier 마이그레이션
    const oldTier = await AsyncStorage.getItem(STORAGE_KEYS.CLUB_TIER(oldNorm));
    if (oldTier) {
      await AsyncStorage.setItem(STORAGE_KEYS.CLUB_TIER(newNorm), oldTier);
    }

    // dues 마이그레이션
    const oldDues = await AsyncStorage.getItem(STORAGE_KEYS.DUES(oldNorm));
    if (oldDues) {
      await AsyncStorage.setItem(STORAGE_KEYS.DUES(newNorm), oldDues);
    }
    localDues[newNorm] = localDues[oldNorm] || getDefaultDuesData();

    // ledger 마이그레이션
    const oldLedger = await AsyncStorage.getItem(STORAGE_KEYS.LEDGER(oldNorm));
    if (oldLedger) {
      await AsyncStorage.setItem(STORAGE_KEYS.LEDGER(newNorm), oldLedger);
    }
    localLedger[newNorm] = localLedger[oldNorm] || getDefaultLedgerData();

    // 2.5. 회원 이메일/이름 캐시 마이그레이션
    if (memberEmailsCache[oldNorm]) {
      memberEmailsCache[newNorm] = memberEmailsCache[oldNorm];
      await AsyncStorage.setItem(STORAGE_KEYS.MEMBER_EMAILS(newNorm), JSON.stringify(memberEmailsCache[newNorm]));
    }
    if (memberNamesCache[oldNorm]) {
      memberNamesCache[newNorm] = memberNamesCache[oldNorm];
      await AsyncStorage.setItem(STORAGE_KEYS.MEMBER_NAMES(newNorm), JSON.stringify(memberNamesCache[newNorm]));
    }

    // 3. 옛 데이터 삭제
    delete CLUBS[oldNorm];
    delete localPlayers[oldNorm];
    delete localSessions[oldNorm];
    delete localSettings[oldNorm];
    delete localDues[oldNorm];
    delete localLedger[oldNorm];
    delete memberEmailsCache[oldNorm];
    delete memberNamesCache[oldNorm];
    delete initialized[oldNorm];

    await AsyncStorage.removeItem(STORAGE_KEYS.PLAYERS(oldNorm));
    await AsyncStorage.removeItem(STORAGE_KEYS.SESSIONS(oldNorm));
    await AsyncStorage.removeItem(STORAGE_KEYS.SETTINGS(oldNorm));
    await AsyncStorage.removeItem(STORAGE_KEYS.FEATURE_FLAGS(oldNorm));
    await AsyncStorage.removeItem(STORAGE_KEYS.CLUB_TIER(oldNorm));
    await AsyncStorage.removeItem(STORAGE_KEYS.DUES(oldNorm));
    await AsyncStorage.removeItem(STORAGE_KEYS.LEDGER(oldNorm));
    await AsyncStorage.removeItem(STORAGE_KEYS.MEMBER_EMAILS(oldNorm));
    await AsyncStorage.removeItem(STORAGE_KEYS.MEMBER_NAMES(oldNorm));

    // 4. 레지스트리 업데이트
    const registry = Object.entries(CLUBS).map(([code, data]) => ({
      code,
      name: data.name,
      adminEmails: data.adminEmails,
    }));
    await AsyncStorage.setItem(STORAGE_KEYS.CLUBS_REGISTRY, JSON.stringify(registry));

    return true;
  } catch (error) {
    console.error('Error updating club code:', error);
    return false;
  }
}

// 클럽 이름 변경
export async function updateClubName(clubCode: string, newName: string): Promise<boolean> {
  const normalizedCode = clubCode.toUpperCase();
  const club = CLUBS[normalizedCode];
  if (!club) return false;

  club.name = newName;

  try {
    const registry = Object.entries(CLUBS).map(([code, data]) => ({
      code,
      name: data.name,
      adminEmails: data.adminEmails,
    }));
    await AsyncStorage.setItem(STORAGE_KEYS.CLUBS_REGISTRY, JSON.stringify(registry));
    return true;
  } catch (error) {
    console.error('Error updating club name:', error);
    return false;
  }
}

// 앱 시작 시 저장된 클럽 레지스트리 복원
export async function restoreClubsRegistry(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.CLUBS_REGISTRY);
    if (stored) {
      const registry = JSON.parse(stored) as { code: string; name: string; adminEmails: string[] }[];
      for (const item of registry) {
        if (!CLUBS[item.code]) {
          CLUBS[item.code] = { name: item.name, adminEmails: item.adminEmails };
        } else {
          // Update admin emails from registry
          CLUBS[item.code].adminEmails = item.adminEmails;
        }
      }
    }
  } catch (error) {
    console.error('Error restoring clubs registry:', error);
  }

  // 슈퍼어드민 이메일 복원
  try {
    const storedSA = await AsyncStorage.getItem(STORAGE_KEYS.SUPER_ADMIN_EMAILS);
    if (storedSA) {
      const emails = JSON.parse(storedSA) as string[];
      // seed 이메일 항상 포함 보장
      if (!emails.includes(SEED_SUPER_ADMIN)) {
        emails.unshift(SEED_SUPER_ADMIN);
      }
      SUPER_ADMIN_EMAILS = emails;
    }
  } catch (error) {
    console.error('Error restoring super admin emails:', error);
  }
}
