import { Session, Match, MatchResult } from '../types';
import { format, parse, isValid } from 'date-fns';
import {
  getLocalSession,
  getLocalSessionDates,
  saveLocalSession,
  deleteLocalSession,
} from './localData';
import { syncManager } from './syncManager';

// Date format for session IDs
const DATE_FORMAT = 'yyyy-MM-dd';

// Format date to session ID
export function formatSessionDate(date: Date): string {
  return format(date, DATE_FORMAT);
}

// Parse session ID to date
export function parseSessionDate(dateStr: string): Date | null {
  const parsed = parse(dateStr, DATE_FORMAT, new Date());
  return isValid(parsed) ? parsed : null;
}

// Get session by date (로컬 우선, 백그라운드 동기화)
export async function getSession(clubCode: string, date: string | Date): Promise<Session | null> {
  const dateStr = date instanceof Date ? formatSessionDate(date) : date;
  return getLocalSession(clubCode, dateStr);
}

// Get all session dates for a club (로컬 우선, 백그라운드 동기화)
export async function getSessionDates(clubCode: string): Promise<string[]> {
  return getLocalSessionDates(clubCode);
}

// Get sessions for a month
export async function getSessionsForMonth(clubCode: string, year: number, month: number): Promise<Record<string, Session>> {
  const dates = await getSessionDates(clubCode);
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const monthDates = dates.filter(d => d.startsWith(prefix));

  const sessions: Record<string, Session> = {};
  for (const date of monthDates) {
    const session = await getSession(clubCode, date);
    if (session) {
      sessions[date] = session;
    }
  }

  return sessions;
}

// Save session (create or update)
export async function saveSession(
  clubCode: string,
  date: string | Date,
  session: Partial<Session>
): Promise<boolean> {
  const dateStr = date instanceof Date ? formatSessionDate(date) : date;
  // 1. 로컬 먼저 저장
  const result = await saveLocalSession(clubCode, dateStr, session);
  // 2. 서버에도 저장
  syncManager.pushSession(clubCode, dateStr, session as Session);
  return result;
}

// Update match results
export async function updateMatchResults(
  clubCode: string,
  date: string | Date,
  matchIndex: number,
  result: MatchResult
): Promise<boolean> {
  const dateStr = date instanceof Date ? formatSessionDate(date) : date;

  const session = await getLocalSession(clubCode, dateStr);
  if (!session) return false;

  const results = { ...session.results };
  results[String(matchIndex)] = result;

  return saveSession(clubCode, dateStr, { ...session, results });
}

// Delete session
export async function deleteSession(clubCode: string, date: string | Date): Promise<boolean> {
  const dateStr = date instanceof Date ? formatSessionDate(date) : date;
  const result = await deleteLocalSession(clubCode, dateStr);
  syncManager.pushSessionDelete(clubCode, dateStr);
  return result;
}

// Import sessions from JSON (for migration)
export async function importSessions(
  clubCode: string,
  sessionsData: Record<string, any>
): Promise<number> {
  let imported = 0;

  for (const [date, data] of Object.entries(sessionsData)) {
    const schedule: Match[] = (data.schedule || []).map((item: any[]) => ({
      gameType: item[0],
      team1: item[1],
      team2: item[2],
      court: item[3],
    }));

    await saveSession(clubCode, date, {
      schedule,
      results: data.results || {},
      groupsSnapshot: data.groupsSnapshot,
    });
    imported++;
  }

  return imported;
}
