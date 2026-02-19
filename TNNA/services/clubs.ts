import { Club, ClubSettings } from '../types';
import {
  getLocalClub,
  getAllLocalClubs,
  isLocalClubAdmin,
  getLocalClubSettings,
  saveLocalClubSettings,
  CLUBS,
} from './localData';
import { syncManager } from './syncManager';
import * as remote from './supabaseData';

// Get club by code (로컬 우선)
export async function getClub(clubCode: string): Promise<Club | null> {
  const local = getLocalClub(clubCode);
  if (local) {
    const settings = await getLocalClubSettings(clubCode);
    return {
      name: local.name,
      adminEmails: local.adminEmails,
      settings: settings || undefined,
    };
  }

  // 로컬에 없으면 서버에서 확인
  if (syncManager.isOnline()) {
    const remoteClub = await remote.getClub(clubCode);
    if (remoteClub) return remoteClub;
  }

  return null;
}

// Get club settings
export async function getClubSettings(clubCode: string): Promise<ClubSettings | null> {
  if (syncManager.isOnline()) {
    return syncManager.pullSettings(clubCode);
  }
  return getLocalClubSettings(clubCode);
}

// Check if club exists
export async function clubExists(clubCode: string): Promise<boolean> {
  if (CLUBS[clubCode.toUpperCase()]) return true;
  if (syncManager.isOnline()) {
    const remoteClub = await remote.getClub(clubCode);
    return !!remoteClub;
  }
  return false;
}

// Get all clubs (for club selection)
export async function getAllClubs(): Promise<{ code: string; name: string }[]> {
  return getAllLocalClubs();
}

// Create new club
export async function createClub(
  clubCode: string,
  name: string,
  adminEmail: string
): Promise<boolean> {
  // 서버에 클럽 생성
  await remote.createClub(clubCode, name);
  return true;
}

// Update club settings
export async function updateClubSettings(
  clubCode: string,
  settings: ClubSettings
): Promise<boolean> {
  // 1. 로컬 먼저
  const result = await saveLocalClubSettings(clubCode, settings);
  // 2. 서버에도 저장
  syncManager.pushSettings(clubCode, settings);
  return result;
}

// Check if user is admin of club
export async function isClubAdmin(clubCode: string, email: string): Promise<boolean> {
  return isLocalClubAdmin(clubCode, email);
}

// Add admin to club
export async function addClubAdmin(clubCode: string, email: string): Promise<boolean> {
  console.log('Local mode: Admin add skipped');
  return true;
}
