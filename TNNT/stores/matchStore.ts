import { create } from 'zustand';
import { Match, MatchResult, Session, DoublesMode, SinglesMode, ScheduleOptions, ManualSlot } from '../types';
import * as sessionService from '../services/sessions';
import { format } from 'date-fns';

type CourtType = '인조잔디' | '하드' | '클레이';

interface MatchState {
  // Current date
  selectedDate: string;

  // Available session dates
  availableDates: string[];

  // Schedule
  schedule: Match[];
  results: Record<string, MatchResult>;

  // Court type
  courtType: CourtType;

  // Special match (교류전)
  specialMatch: boolean;

  // Group snapshot (player groups at time of session)
  groupsSnapshot: Record<string, string>;
  groupOnly: boolean;

  // Team mode
  teamAssignments: Record<string, string>;

  // Player order
  playerOrder: string[];

  // Manual slots [round][court]
  manualSlots: ManualSlot[][];

  // Options
  options: ScheduleOptions;

  // Session change version (bumped on save/delete to notify other tabs)
  sessionVersion: number;

  // UI state
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Actions
  setSelectedDate: (date: string | Date) => void;
  loadSession: (clubCode: string, date?: string | Date) => Promise<void>;
  loadAvailableDates: (clubCode: string) => Promise<void>;
  saveSession: (clubCode: string) => Promise<boolean>;

  // Schedule management
  setSchedule: (schedule: Match[]) => void;
  updateMatch: (index: number, match: Match) => void;
  deleteMatch: (index: number) => void;
  removeMatch: (index: number) => void;
  addMatch: (match: Match) => void;
  clearSchedule: () => void;
  swapMatches: (indexA: number, indexB: number) => void;

  // Results management
  setResult: (matchIndex: number, result: MatchResult) => void;
  saveResult: (clubCode: string, matchIndex: number) => Promise<boolean>;
  clearResults: () => void;

  // Court type
  setCourtType: (courtType: CourtType) => void;

  // Special match
  setSpecialMatch: (specialMatch: boolean) => void;

  // Group snapshot
  setGroupsSnapshot: (groupsSnapshot: Record<string, string>) => void;
  setGroupOnly: (groupOnly: boolean) => void;

  // Team mode
  setTeamAssignments: (assignments: Record<string, string>) => void;

  // Player order
  setPlayerOrder: (order: string[]) => void;

  // Manual slots
  setManualSlots: (slots: ManualSlot[][]) => void;
  updateManualSlot: (round: number, court: number, slot: Partial<ManualSlot>) => void;

  // Options
  setOptions: (options: Partial<ScheduleOptions>) => void;

  // Session version bump
  bumpSessionVersion: () => void;
}

export const useMatchStore = create<MatchState>((set, get) => ({
  selectedDate: format(new Date(), 'yyyy-MM-dd'),
  availableDates: [],
  schedule: [],
  results: {},
  courtType: '하드',
  sessionVersion: 0,
  specialMatch: false,
  groupsSnapshot: {},
  groupOnly: false,
  teamAssignments: {},
  playerOrder: [],
  manualSlots: [],
  options: {
    mode: '랜덤복식',
    gameType: '복식',
    isTeamMode: false,
    isManualMode: false,
    maxGames: 4,
    courtCount: 2,
    totalRounds: 4,
    useNtrp: false,
    groupOnly: false,
  },
  isLoading: false,
  isSaving: false,
  error: null,

  setSelectedDate: (date) => {
    const dateStr = date instanceof Date ? format(date, 'yyyy-MM-dd') : date;
    set({ selectedDate: dateStr });
  },

  loadAvailableDates: async (clubCode) => {
    try {
      const dates = await sessionService.getSessionDates(clubCode);
      dates.sort();
      set({ availableDates: dates });
    } catch (error) {
      console.error('Error loading available dates:', error);
    }
  },

  loadSession: async (clubCode, date) => {
    const dateStr = date
      ? date instanceof Date
        ? format(date, 'yyyy-MM-dd')
        : date
      : get().selectedDate;

    set({ isLoading: true, error: null });

    try {
      const session = await sessionService.getSession(clubCode, dateStr);

      if (session) {
        set({
          schedule: session.schedule,
          results: session.results,
          courtType: (session.courtType as CourtType) || '하드',
          specialMatch: session.specialMatch || false,
          groupsSnapshot: session.groupsSnapshot || {},
          groupOnly: session.groupOnly || false,
          isLoading: false,
        });
      } else {
        set({
          schedule: [],
          results: {},
          courtType: '하드',
          specialMatch: false,
          groupsSnapshot: {},
          groupOnly: false,
          isLoading: false,
        });
      }
    } catch (error) {
      console.error('Error loading session:', error);
      set({ error: 'Failed to load session', isLoading: false });
    }
  },

  saveSession: async (clubCode) => {
    const { selectedDate, schedule, results, courtType, specialMatch, groupsSnapshot, groupOnly, loadAvailableDates, bumpSessionVersion } = get();

    set({ isSaving: true });

    try {
      const success = await sessionService.saveSession(clubCode, selectedDate, {
        schedule,
        results,
        courtType,
        specialMatch,
        groupsSnapshot,
        groupOnly,
      });

      set({ isSaving: false });

      if (success) {
        bumpSessionVersion();
        await loadAvailableDates(clubCode);
      }

      return success;
    } catch (error) {
      console.error('Error saving session:', error);
      set({ error: 'Failed to save session', isSaving: false });
      return false;
    }
  },

  setSchedule: (schedule) => {
    set({ schedule });
  },

  updateMatch: (index, match) => {
    set((state) => ({
      schedule: state.schedule.map((m, i) => (i === index ? match : m)),
    }));
  },

  deleteMatch: (index) => {
    set((state) => ({
      schedule: state.schedule.map((m, i) =>
        i === index ? { ...m, gameType: '삭제' as const } : m
      ),
    }));
  },

  removeMatch: (index) => {
    set((state) => {
      const newSchedule = state.schedule.filter((_, i) => i !== index);
      const oldResults = state.results;
      const newResults: Record<string, MatchResult> = {};
      let newIdx = 1;
      for (let i = 0; i < state.schedule.length; i++) {
        if (i === index) continue;
        const oldKey = String(i + 1);
        if (oldResults[oldKey]) {
          newResults[String(newIdx)] = oldResults[oldKey];
        }
        newIdx++;
      }
      return { schedule: newSchedule, results: newResults };
    });
  },

  addMatch: (match) => {
    set((state) => ({
      schedule: [...state.schedule, match],
    }));
  },

  clearSchedule: () => {
    set({ schedule: [], results: {} });
  },

  swapMatches: (indexA, indexB) => {
    set((state) => {
      const newSchedule = [...state.schedule];
      const courtA = newSchedule[indexA].court;
      const courtB = newSchedule[indexB].court;
      [newSchedule[indexA], newSchedule[indexB]] = [newSchedule[indexB], newSchedule[indexA]];
      newSchedule[indexA] = { ...newSchedule[indexA], court: courtA };
      newSchedule[indexB] = { ...newSchedule[indexB], court: courtB };

      const newResults = { ...state.results };
      const keyA = String(indexA + 1);
      const keyB = String(indexB + 1);
      const tempA = newResults[keyA];
      const tempB = newResults[keyB];
      if (tempA || tempB) {
        newResults[keyA] = tempB || { t1: null, t2: null };
        newResults[keyB] = tempA || { t1: null, t2: null };
      }

      return { schedule: newSchedule, results: newResults };
    });
  },

  setResult: (matchIndex, result) => {
    set((state) => ({
      results: {
        ...state.results,
        [String(matchIndex)]: result,
      },
    }));
  },

  saveResult: async (clubCode, matchIndex) => {
    const { selectedDate, results } = get();
    const result = results[String(matchIndex)];
    if (!result) return false;

    set({ isSaving: true });
    try {
      const success = await sessionService.updateMatchResults(
        clubCode,
        selectedDate,
        matchIndex,
        result
      );
      set({ isSaving: false });
      return success;
    } catch (error) {
      console.error('Error saving result:', error);
      set({ isSaving: false });
      return false;
    }
  },

  clearResults: () => {
    set({ results: {} });
  },

  setCourtType: (courtType) => {
    set({ courtType });
  },

  setSpecialMatch: (specialMatch) => {
    set({ specialMatch });
  },

  setGroupsSnapshot: (groupsSnapshot) => {
    set({ groupsSnapshot });
  },

  setGroupOnly: (groupOnly) => {
    set({ groupOnly });
  },

  setTeamAssignments: (assignments) => {
    set({ teamAssignments: assignments });
  },

  setPlayerOrder: (order) => {
    set({ playerOrder: order });
  },

  setManualSlots: (slots) => {
    set({ manualSlots: slots });
  },

  updateManualSlot: (round, court, slot) => {
    set((state) => {
      const newSlots = state.manualSlots.map(r => r.map(c => ({ ...c })));
      while (newSlots.length <= round) newSlots.push([]);
      while (newSlots[round].length <= court) {
        newSlots[round].push({ team1: [null, null], team2: [null, null], checked: false });
      }
      newSlots[round][court] = { ...newSlots[round][court], ...slot };
      return { manualSlots: newSlots };
    });
  },

  setOptions: (options) => {
    set((state) => ({
      options: { ...state.options, ...options },
    }));
  },

  bumpSessionVersion: () => {
    set((state) => ({ sessionVersion: state.sessionVersion + 1 }));
  },
}));
