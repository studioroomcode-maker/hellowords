import { Player } from '../types';
import {
  getLocalPlayers,
  addLocalPlayer,
  updateLocalPlayer,
  deleteLocalPlayer,
} from './localData';
import { syncManager } from './syncManager';

// Get all players for a club (로컬 우선, 서버 동기화는 fullSync에서 처리)
export async function getPlayers(clubCode: string): Promise<Player[]> {
  return getLocalPlayers(clubCode);
}

// Get single player
export async function getPlayer(clubCode: string, playerId: string): Promise<Player | null> {
  const players = await getPlayers(clubCode);
  return players.find(p => p.id === playerId) || null;
}

// Add new player
export async function addPlayer(clubCode: string, player: Omit<Player, 'id' | 'createdAt'>): Promise<string | null> {
  // 1. 로컬 먼저
  const id = await addLocalPlayer(clubCode, player as Omit<Player, 'id'>);
  // 2. 서버에도 저장
  syncManager.pushPlayer(clubCode, player as Omit<Player, 'id'>);
  return id;
}

// Update player
export async function updatePlayer(
  clubCode: string,
  playerId: string,
  updates: Partial<Omit<Player, 'id' | 'createdAt'>>
): Promise<boolean> {
  // 이름 찾기 (서버는 이름 기반)
  const players = await getLocalPlayers(clubCode);
  const player = players.find(p => p.id === playerId);

  // 1. 로컬 먼저
  const result = await updateLocalPlayer(clubCode, playerId, updates);
  // 2. 서버에도 저장
  if (player) {
    syncManager.pushPlayerUpdate(clubCode, player.name, updates);
  }
  return result;
}

// Delete player
export async function deletePlayer(clubCode: string, playerId: string): Promise<boolean> {
  // 이름 찾기
  const players = await getLocalPlayers(clubCode);
  const player = players.find(p => p.id === playerId);

  // 1. 로컬 먼저
  const result = await deleteLocalPlayer(clubCode, playerId);
  // 2. 서버에도 삭제
  if (player) {
    syncManager.pushPlayerDelete(clubCode, player.name);
  }
  return result;
}

// Get players by name (for lookup)
export async function getPlayersByNames(clubCode: string, names: string[]): Promise<Record<string, Player>> {
  const players = await getPlayers(clubCode);
  const playerMap: Record<string, Player> = {};

  for (const player of players) {
    if (names.includes(player.name)) {
      playerMap[player.name] = player;
    }
  }

  return playerMap;
}

// Bulk import players (for migration)
export async function importPlayers(
  clubCode: string,
  players: Omit<Player, 'id' | 'createdAt'>[]
): Promise<number> {
  let imported = 0;

  for (const player of players) {
    const result = await addPlayer(clubCode, player);
    if (result) {
      imported++;
    }
  }

  return imported;
}

// Get player statistics summary
export async function getPlayerStats(clubCode: string): Promise<{
  total: number;
  byGender: Record<string, number>;
  byGroup: Record<string, number>;
  byAgeGroup: Record<string, number>;
}> {
  const players = await getPlayers(clubCode);

  const stats = {
    total: players.length,
    byGender: {} as Record<string, number>,
    byGroup: {} as Record<string, number>,
    byAgeGroup: {} as Record<string, number>,
  };

  for (const player of players) {
    stats.byGender[player.gender] = (stats.byGender[player.gender] || 0) + 1;
    stats.byGroup[player.group] = (stats.byGroup[player.group] || 0) + 1;
    stats.byAgeGroup[player.ageGroup] = (stats.byAgeGroup[player.ageGroup] || 0) + 1;
  }

  return stats;
}
