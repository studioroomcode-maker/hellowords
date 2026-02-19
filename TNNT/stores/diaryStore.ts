import { create } from 'zustand';
import {
  GearData, RacketInfo, StringInfo, ShoeInfo, OvergripInfo,
  RadarStats, RadarStatKey, SubStatKey, RadarStatsSnapshot,
  DiaryEntry, DiaryMood, PersonalGame, PlayerEvaluation,
} from '../types';
import * as diaryData from '../services/diaryData';

const DEFAULT_STATS: RadarStats = {
  main: { serve: 50, forehand: 50, backhand: 50, volley: 50, step: 50, mental: 50 },
  sub: { slice: 50, drop: 50, lob: 50 },
  updatedAt: new Date().toISOString(),
};

const DEFAULT_GEAR: GearData = {
  rackets: [],
  strings: {},
  shoes: null,
  overgrip: null,
  overgrips: {},
};

interface DiaryState {
  gear: GearData;
  stats: RadarStats;
  statsHistory: RadarStatsSnapshot[];
  entries: DiaryEntry[];
  personalGames: PersonalGame[];
  receivedEvals: PlayerEvaluation[];
  aiAnalysis: string | null;
  aiLoading: boolean;
  isLoading: boolean;

  // Load
  loadAll: (clubCode: string, email: string, playerName?: string) => Promise<void>;

  // Gear actions
  addRacket: (racket: RacketInfo) => void;
  removeRacket: (racketId: string) => void;
  updateRacket: (racketId: string, updates: Partial<RacketInfo>) => void;
  updateString: (racketId: string, info: StringInfo) => void;
  updateShoes: (shoes: ShoeInfo | null) => void;
  updateOvergrip: (overgrip: OvergripInfo | null) => void; // legacy
  updateOvergripForRacket: (racketId: string, overgrip: OvergripInfo) => void;
  saveGear: (clubCode: string, email: string) => Promise<void>;

  // Stats actions
  setMainStat: (key: RadarStatKey, value: number) => void;
  setSubStat: (key: SubStatKey, value: number) => void;
  saveStats: (clubCode: string, email: string) => Promise<void>;
  saveSnapshot: (clubCode: string, email: string, month: string) => Promise<void>;

  // Entry actions
  addEntry: (clubCode: string, email: string, entry: DiaryEntry) => Promise<void>;
  updateEntry: (clubCode: string, email: string, entry: DiaryEntry) => Promise<void>;
  deleteEntry: (clubCode: string, email: string, entryId: string) => Promise<void>;

  // Personal game actions
  addPersonalGame: (email: string, game: PersonalGame) => Promise<void>;
  updatePersonalGame: (email: string, game: PersonalGame) => Promise<void>;
  deletePersonalGame: (email: string, gameId: string) => Promise<void>;

  // AI
  setAiAnalysis: (text: string | null) => void;
  setAiLoading: (loading: boolean) => void;
  loadCachedAI: (clubCode: string, email: string, hash: string) => Promise<string | null>;
  saveCachedAI: (clubCode: string, email: string, text: string, hash: string) => Promise<void>;
}

export const useDiaryStore = create<DiaryState>()((set, get) => ({
  gear: DEFAULT_GEAR,
  stats: DEFAULT_STATS,
  statsHistory: [],
  entries: [],
  personalGames: [],
  receivedEvals: [],
  aiAnalysis: null,
  aiLoading: false,
  isLoading: false,

  loadAll: async (clubCode, email, playerName) => {
    set({ isLoading: true });
    const [gear, stats, history, entries, cached, pGames, evals] = await Promise.all([
      diaryData.loadGear(clubCode, email),
      diaryData.loadStats(clubCode, email),
      diaryData.loadStatsHistory(clubCode, email),
      diaryData.loadEntries(clubCode, email),
      diaryData.loadAIAnalysis(clubCode, email),
      diaryData.loadPersonalGames(email),
      playerName ? diaryData.loadPlayerEvals(clubCode, playerName) : Promise.resolve([]),
    ]);
    set({
      gear: gear || DEFAULT_GEAR,
      stats: stats || DEFAULT_STATS,
      statsHistory: history,
      entries,
      personalGames: pGames,
      receivedEvals: evals,
      aiAnalysis: cached?.text || null,
      isLoading: false,
    });
  },

  // --- Gear ---
  addRacket: (racket) => set(s => ({
    gear: { ...s.gear, rackets: [...s.gear.rackets, racket] },
  })),

  removeRacket: (racketId) => set(s => {
    const newStrings = { ...s.gear.strings };
    delete newStrings[racketId];
    const newOvergrips = { ...(s.gear.overgrips || {}) };
    delete newOvergrips[racketId];
    return {
      gear: {
        ...s.gear,
        rackets: s.gear.rackets.filter(r => r.id !== racketId),
        strings: newStrings,
        overgrips: newOvergrips,
      },
    };
  }),

  updateRacket: (racketId, updates) => set(s => ({
    gear: {
      ...s.gear,
      rackets: s.gear.rackets.map(r => r.id === racketId ? { ...r, ...updates } : r),
    },
  })),

  updateString: (racketId, info) => set(s => ({
    gear: { ...s.gear, strings: { ...s.gear.strings, [racketId]: info } },
  })),

  updateShoes: (shoes) => set(s => ({
    gear: { ...s.gear, shoes },
  })),

  updateOvergrip: (overgrip) => set(s => ({
    gear: { ...s.gear, overgrip },
  })),

  updateOvergripForRacket: (racketId, overgrip) => set(s => ({
    gear: { ...s.gear, overgrips: { ...(s.gear.overgrips || {}), [racketId]: overgrip } },
  })),

  saveGear: async (clubCode, email) => {
    await diaryData.saveGear(clubCode, email, get().gear);
  },

  // --- Stats ---
  setMainStat: (key, value) => set(s => ({
    stats: {
      ...s.stats,
      main: { ...s.stats.main, [key]: Math.max(0, Math.min(100, value)) },
      updatedAt: new Date().toISOString(),
    },
  })),

  setSubStat: (key, value) => set(s => ({
    stats: {
      ...s.stats,
      sub: { ...s.stats.sub, [key]: Math.max(0, Math.min(100, value)) },
      updatedAt: new Date().toISOString(),
    },
  })),

  saveStats: async (clubCode, email) => {
    await diaryData.saveStats(clubCode, email, get().stats);
  },

  saveSnapshot: async (clubCode, email, month) => {
    const snapshot: RadarStatsSnapshot = { stats: get().stats, month };
    await diaryData.saveStatsSnapshot(clubCode, email, snapshot);
    const history = await diaryData.loadStatsHistory(clubCode, email);
    set({ statsHistory: history });
  },

  // --- Entries ---
  addEntry: async (clubCode, email, entry) => {
    await diaryData.addEntry(clubCode, email, entry);
    set(s => ({ entries: [entry, ...s.entries] }));
  },

  updateEntry: async (clubCode, email, entry) => {
    await diaryData.updateEntry(clubCode, email, entry);
    set(s => ({ entries: s.entries.map(e => e.id === entry.id ? entry : e) }));
  },

  deleteEntry: async (clubCode, email, entryId) => {
    await diaryData.deleteEntry(clubCode, email, entryId);
    set(s => ({ entries: s.entries.filter(e => e.id !== entryId) }));
  },

  // --- Personal Games ---
  addPersonalGame: async (email, game) => {
    await diaryData.addPersonalGame(email, game);
    set(s => {
      const updated = [game, ...s.personalGames];
      updated.sort((a, b) => b.date.localeCompare(a.date));
      return { personalGames: updated };
    });
  },

  updatePersonalGame: async (email, game) => {
    await diaryData.updatePersonalGame(email, game);
    set(s => ({ personalGames: s.personalGames.map(g => g.id === game.id ? game : g) }));
  },

  deletePersonalGame: async (email, gameId) => {
    await diaryData.deletePersonalGame(email, gameId);
    set(s => ({ personalGames: s.personalGames.filter(g => g.id !== gameId) }));
  },

  // --- AI ---
  setAiAnalysis: (text) => set({ aiAnalysis: text }),
  setAiLoading: (loading) => set({ aiLoading: loading }),

  loadCachedAI: async (clubCode, email, hash) => {
    const cached = await diaryData.loadAIAnalysis(clubCode, email);
    if (cached && cached.hash === hash) return cached.text;
    return null;
  },

  saveCachedAI: async (clubCode, email, text, hash) => {
    await diaryData.saveAIAnalysis(clubCode, email, text, hash);
    set({ aiAnalysis: text });
  },
}));
