import { create } from 'zustand';
import { Player } from '../types';
import * as playerService from '../services/players';

interface PlayerState {
  players: Player[];
  selectedPlayers: string[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadPlayers: (clubCode: string) => Promise<void>;
  addPlayer: (clubCode: string, player: Omit<Player, 'id' | 'createdAt'>) => Promise<boolean>;
  updatePlayer: (clubCode: string, playerId: string, updates: Partial<Player>) => Promise<boolean>;
  deletePlayer: (clubCode: string, playerId: string) => Promise<boolean>;

  // Selection
  togglePlayerSelection: (name: string) => void;
  setSelectedPlayers: (names: string[]) => void;
  clearSelection: () => void;
  selectAll: () => void;

  // Helpers
  getPlayerByName: (name: string) => Player | undefined;
  getPlayersByNames: (names: string[]) => Record<string, Player>;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  players: [],
  selectedPlayers: [],
  isLoading: false,
  error: null,

  loadPlayers: async (clubCode) => {
    set({ isLoading: true, error: null });
    try {
      const players = await playerService.getPlayers(clubCode);
      players.sort((a, b) => a.name.localeCompare(b.name));
      set({ players, isLoading: false });
    } catch (error) {
      console.error('Error loading players:', error);
      set({ error: 'Failed to load players', isLoading: false });
    }
  },

  addPlayer: async (clubCode, player) => {
    try {
      const id = await playerService.addPlayer(clubCode, player);
      if (id) {
        const newPlayer = { ...player, id, createdAt: new Date() };
        set((state) => ({
          players: [...state.players, newPlayer].sort((a, b) =>
            a.name.localeCompare(b.name)
          ),
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error adding player:', error);
      return false;
    }
  },

  updatePlayer: async (clubCode, playerId, updates) => {
    try {
      const success = await playerService.updatePlayer(clubCode, playerId, updates);
      if (success) {
        set((state) => ({
          players: state.players.map((p) =>
            p.id === playerId ? { ...p, ...updates } : p
          ),
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error updating player:', error);
      return false;
    }
  },

  deletePlayer: async (clubCode, playerId) => {
    try {
      const success = await playerService.deletePlayer(clubCode, playerId);
      if (success) {
        set((state) => ({
          players: state.players.filter((p) => p.id !== playerId),
          selectedPlayers: state.selectedPlayers.filter(
            (name) => state.players.find((p) => p.id === playerId)?.name !== name
          ),
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting player:', error);
      return false;
    }
  },

  togglePlayerSelection: (name) => {
    set((state) => ({
      selectedPlayers: state.selectedPlayers.includes(name)
        ? state.selectedPlayers.filter((n) => n !== name)
        : [...state.selectedPlayers, name],
    }));
  },

  setSelectedPlayers: (names) => {
    set({ selectedPlayers: names });
  },

  clearSelection: () => {
    set({ selectedPlayers: [] });
  },

  selectAll: () => {
    set((state) => ({
      selectedPlayers: state.players.map((p) => p.name),
    }));
  },

  getPlayerByName: (name) => {
    return get().players.find((p) => p.name === name);
  },

  getPlayersByNames: (names) => {
    const players = get().players;
    const map: Record<string, Player> = {};
    for (const name of names) {
      const player = players.find((p) => p.name === name);
      if (player) {
        map[name] = player;
      }
    }
    return map;
  },
}));
