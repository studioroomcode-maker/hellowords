/**
 * Diary Data Service
 * AsyncStorage CRUD for gear and radar stats
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { GearData, RadarStats, RadarStatsSnapshot, DiaryEntry, PersonalGame, PlayerEvaluation } from '../types';

const KEYS = {
  GEAR: (clubCode: string, email: string) => `@tennis_diary_gear_${clubCode}_${email}`,
  STATS: (clubCode: string, email: string) => `@tennis_diary_stats_${clubCode}_${email}`,
  STATS_HISTORY: (clubCode: string, email: string) => `@tennis_diary_stats_history_${clubCode}_${email}`,
  ENTRIES: (clubCode: string, email: string) => `@tennis_diary_entries_${clubCode}_${email}`,
  AI_ANALYSIS: (clubCode: string, email: string) => `@tennis_diary_ai_${clubCode}_${email}`,
  PERSONAL_GAMES: (email: string) => `@tennis_diary_personal_${email}`,
  SHARED_EVALS: (clubCode: string) => `@tennis_diary_shared_evals_${clubCode}`,
};

// --- Gear ---

export async function loadGear(clubCode: string, email: string): Promise<GearData | null> {
  const raw = await AsyncStorage.getItem(KEYS.GEAR(clubCode, email));
  return raw ? JSON.parse(raw) : null;
}

export async function saveGear(clubCode: string, email: string, data: GearData): Promise<void> {
  await AsyncStorage.setItem(KEYS.GEAR(clubCode, email), JSON.stringify(data));
}

// --- Radar Stats ---

export async function loadStats(clubCode: string, email: string): Promise<RadarStats | null> {
  const raw = await AsyncStorage.getItem(KEYS.STATS(clubCode, email));
  return raw ? JSON.parse(raw) : null;
}

export async function saveStats(clubCode: string, email: string, data: RadarStats): Promise<void> {
  await AsyncStorage.setItem(KEYS.STATS(clubCode, email), JSON.stringify(data));
}

// --- Stats History (monthly snapshots) ---

export async function loadStatsHistory(clubCode: string, email: string): Promise<RadarStatsSnapshot[]> {
  const raw = await AsyncStorage.getItem(KEYS.STATS_HISTORY(clubCode, email));
  return raw ? JSON.parse(raw) : [];
}

export async function saveStatsSnapshot(clubCode: string, email: string, snapshot: RadarStatsSnapshot): Promise<void> {
  const history = await loadStatsHistory(clubCode, email);
  // Replace existing month or append
  const idx = history.findIndex(h => h.month === snapshot.month);
  if (idx >= 0) {
    history[idx] = snapshot;
  } else {
    history.push(snapshot);
  }
  // Keep last 12 months
  const trimmed = history.slice(-12);
  await AsyncStorage.setItem(KEYS.STATS_HISTORY(clubCode, email), JSON.stringify(trimmed));
}

// --- Diary Entries ---

export async function loadEntries(clubCode: string, email: string): Promise<DiaryEntry[]> {
  const raw = await AsyncStorage.getItem(KEYS.ENTRIES(clubCode, email));
  return raw ? JSON.parse(raw) : [];
}

export async function saveEntries(clubCode: string, email: string, entries: DiaryEntry[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.ENTRIES(clubCode, email), JSON.stringify(entries));
}

export async function addEntry(clubCode: string, email: string, entry: DiaryEntry): Promise<void> {
  const entries = await loadEntries(clubCode, email);
  entries.unshift(entry); // newest first
  await saveEntries(clubCode, email, entries);
}

export async function updateEntry(clubCode: string, email: string, entry: DiaryEntry): Promise<void> {
  const entries = await loadEntries(clubCode, email);
  const idx = entries.findIndex(e => e.id === entry.id);
  if (idx >= 0) entries[idx] = entry;
  await saveEntries(clubCode, email, entries);
}

export async function deleteEntry(clubCode: string, email: string, entryId: string): Promise<void> {
  const entries = await loadEntries(clubCode, email);
  await saveEntries(clubCode, email, entries.filter(e => e.id !== entryId));
}

// --- AI Analysis Cache ---

export async function loadAIAnalysis(clubCode: string, email: string): Promise<{ text: string; hash: string; timestamp: number } | null> {
  const raw = await AsyncStorage.getItem(KEYS.AI_ANALYSIS(clubCode, email));
  return raw ? JSON.parse(raw) : null;
}

export async function saveAIAnalysis(clubCode: string, email: string, text: string, hash: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.AI_ANALYSIS(clubCode, email), JSON.stringify({ text, hash, timestamp: Date.now() }));
}

// --- Personal Games (클럽 무관, email 기준) ---

export async function loadPersonalGames(email: string): Promise<PersonalGame[]> {
  const raw = await AsyncStorage.getItem(KEYS.PERSONAL_GAMES(email));
  return raw ? JSON.parse(raw) : [];
}

export async function savePersonalGames(email: string, games: PersonalGame[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.PERSONAL_GAMES(email), JSON.stringify(games));
}

export async function addPersonalGame(email: string, game: PersonalGame): Promise<void> {
  const games = await loadPersonalGames(email);
  games.unshift(game);
  games.sort((a, b) => b.date.localeCompare(a.date));
  await savePersonalGames(email, games);
}

export async function updatePersonalGame(email: string, game: PersonalGame): Promise<void> {
  const games = await loadPersonalGames(email);
  const idx = games.findIndex(g => g.id === game.id);
  if (idx >= 0) games[idx] = game;
  await savePersonalGames(email, games);
}

export async function deletePersonalGame(email: string, gameId: string): Promise<void> {
  const games = await loadPersonalGames(email);
  await savePersonalGames(email, games.filter(g => g.id !== gameId));
}

// --- Shared Player Evaluations (클럽 레벨 공유) ---

type SharedEvalsMap = Record<string, PlayerEvaluation[]>;

export async function loadSharedEvals(clubCode: string): Promise<SharedEvalsMap> {
  const raw = await AsyncStorage.getItem(KEYS.SHARED_EVALS(clubCode));
  return raw ? JSON.parse(raw) : {};
}

export async function loadPlayerEvals(clubCode: string, playerName: string): Promise<PlayerEvaluation[]> {
  const all = await loadSharedEvals(clubCode);
  return all[playerName] || [];
}

export async function savePlayerEvals(
  clubCode: string,
  targetPlayer: string,
  evals: PlayerEvaluation[],
): Promise<void> {
  const all = await loadSharedEvals(clubCode);
  const existing = all[targetPlayer] || [];
  // Merge: remove old evals from same evaluator+date, then add new
  const deduped = existing.filter(
    e => !evals.some(ne => ne.evaluator === e.evaluator && ne.date === e.date),
  );
  all[targetPlayer] = [...deduped, ...evals].slice(-100); // keep last 100
  await AsyncStorage.setItem(KEYS.SHARED_EVALS(clubCode), JSON.stringify(all));
}
