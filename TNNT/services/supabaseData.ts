/**
 * Supabase Data Service
 * localData.ts의 온라인 버전 - Supabase CRUD 함수들
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { Player, Session, ClubSettings, Club, DuesData, LedgerData, LedgerEntry, LedgerEntryType, CustomLedgerCategory, ClubFeatureFlags, SubscriptionTier } from '../types';

// ── 클럽 ──

export async function getClub(code: string): Promise<Club | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabase
    .from('clubs')
    .select('*')
    .eq('code', code)
    .maybeSingle();
  if (error || !data) return null;
  return {
    name: data.name,
    adminEmails: [], // club_members에서 별도 조회
    settings: data.settings as ClubSettings || undefined,
  };
}

export async function getClubSettings(code: string): Promise<ClubSettings | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabase
    .from('clubs')
    .select('settings')
    .eq('code', code)
    .maybeSingle();
  if (error || !data) return null;
  return data.settings as ClubSettings;
}

export async function updateClubSettings(code: string, settings: ClubSettings): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabase
    .from('clubs')
    .update({ settings, updated_at: new Date().toISOString() })
    .eq('code', code);
}

export async function createClub(code: string, name: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabase.from('clubs').upsert({ code, name }, { onConflict: 'code' });
}

// ── 선수 ──

export async function getPlayers(clubCode: string): Promise<Player[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('club_code', clubCode)
    .order('name');
  if (error || !data) return [];
  return data.map(dbPlayerToPlayer);
}

export async function addPlayer(clubCode: string, player: Omit<Player, 'id'>): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabase.from('players').insert(playerToDbPlayer(clubCode, player));
}

export async function updatePlayer(clubCode: string, name: string, updates: Partial<Player>): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const dbUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.nickname !== undefined) dbUpdates.nickname = updates.nickname;
  if (updates.gender !== undefined) dbUpdates.gender = updates.gender;
  if (updates.hand !== undefined) dbUpdates.hand = updates.hand;
  if (updates.ageGroup !== undefined) dbUpdates.age_group = updates.ageGroup;
  if (updates.racket !== undefined) dbUpdates.racket = updates.racket;
  if (updates.group !== undefined) dbUpdates.player_group = updates.group;
  if (updates.ntrp !== undefined) dbUpdates.ntrp = updates.ntrp;
  if (updates.adminNtrp !== undefined) dbUpdates.admin_ntrp = updates.adminNtrp;
  if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
  if (updates.email !== undefined) dbUpdates.email = updates.email;
  if (updates.mbti !== undefined) dbUpdates.mbti = updates.mbti;
  if (updates.photoURL !== undefined) dbUpdates.photo_url = updates.photoURL;

  await supabase
    .from('players')
    .update(dbUpdates)
    .eq('club_code', clubCode)
    .eq('name', name);
}

export async function deletePlayer(clubCode: string, name: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabase.from('players').delete().eq('club_code', clubCode).eq('name', name);
}

// ── 세션 ──

export async function getSession(clubCode: string, date: string): Promise<Session | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabase
    .from('sessions')
    .select('data')
    .eq('club_code', clubCode)
    .eq('date', date)
    .maybeSingle();
  if (error || !data) return null;
  return data.data as Session;
}

export async function getSessionDates(clubCode: string): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from('sessions')
    .select('date')
    .eq('club_code', clubCode)
    .order('date', { ascending: false });
  if (error || !data) return [];
  return data.map(d => d.date);
}

export async function saveSession(clubCode: string, date: string, session: Session): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabase.from('sessions').upsert(
    { club_code: clubCode, date, data: session, updated_at: new Date().toISOString() },
    { onConflict: 'club_code,date' },
  );
}

export async function deleteSession(clubCode: string, date: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabase.from('sessions').delete().eq('club_code', clubCode).eq('date', date);
}

// ── 회비 ──

export async function getDues(clubCode: string): Promise<DuesData | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabase
    .from('dues')
    .select('data')
    .eq('club_code', clubCode)
    .maybeSingle();
  if (error || !data) return null;
  return data.data as DuesData;
}

export async function saveDues(clubCode: string, duesData: DuesData): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabase.from('dues').upsert(
    { club_code: clubCode, data: duesData, updated_at: new Date().toISOString() },
    { onConflict: 'club_code' },
  );
}

// ── 가계부 ──

export async function getLedgerEntries(clubCode: string): Promise<LedgerEntry[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from('ledger_entries')
    .select('*')
    .eq('club_code', clubCode)
    .order('date', { ascending: false });
  if (error || !data) return [];
  return data.map(dbLedgerToLedger);
}

export async function addLedgerEntry(clubCode: string, entry: LedgerEntry): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabase.from('ledger_entries').insert({
    id: entry.id,
    club_code: clubCode,
    date: entry.date,
    description: entry.description,
    entry_type: entry.type,
    amount: entry.amount,
    category: entry.category,
    memo: entry.memo,
    billing_period_id: entry.billingPeriodId,
    player_name: entry.playerName,
  });
}

export async function updateLedgerEntry(clubCode: string, entryId: string, updates: Partial<LedgerEntry>): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const dbUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (updates.date !== undefined) dbUpdates.date = updates.date;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.type !== undefined) dbUpdates.entry_type = updates.type;
  if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
  if (updates.category !== undefined) dbUpdates.category = updates.category;
  if (updates.memo !== undefined) dbUpdates.memo = updates.memo;

  await supabase.from('ledger_entries').update(dbUpdates).eq('id', entryId);
}

export async function deleteLedgerEntry(entryId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabase.from('ledger_entries').delete().eq('id', entryId);
}

export async function deleteLedgerEntriesByBillingPeriod(clubCode: string, billingPeriodId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabase.from('ledger_entries').delete()
    .eq('club_code', clubCode)
    .eq('billing_period_id', billingPeriodId);
}

export async function deleteLedgerEntriesByBillingPayment(
  clubCode: string, billingPeriodId: string, playerName: string
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabase.from('ledger_entries').delete()
    .eq('club_code', clubCode)
    .eq('billing_period_id', billingPeriodId)
    .eq('player_name', playerName);
}

export async function updateLedgerEntriesByBillingPeriod(
  clubCode: string, billingPeriodId: string, updates: { amount: number; description?: string }
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const dbUpdates: Record<string, any> = { amount: updates.amount, updated_at: new Date().toISOString() };
  if (updates.description) dbUpdates.description = updates.description;
  await supabase.from('ledger_entries').update(dbUpdates)
    .eq('club_code', clubCode)
    .eq('billing_period_id', billingPeriodId);
}

export async function getLedgerCategories(clubCode: string): Promise<CustomLedgerCategory[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from('ledger_categories')
    .select('*')
    .eq('club_code', clubCode);
  if (error || !data) return [];
  return data.map(c => ({ label: c.label, type: c.entry_type as LedgerEntryType }));
}

export async function saveLedgerCategories(clubCode: string, categories: CustomLedgerCategory[]): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabase.from('ledger_categories').delete().eq('club_code', clubCode);
  if (categories.length > 0) {
    await supabase.from('ledger_categories').insert(
      categories.map(c => ({ club_code: clubCode, label: c.label, entry_type: c.type }))
    );
  }
}

// ── 예약 ──

export async function getReservations(clubCode: string): Promise<any | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabase
    .from('reservations')
    .select('data')
    .eq('club_code', clubCode)
    .maybeSingle();
  if (error || !data) return null;
  return data.data;
}

export async function saveReservations(clubCode: string, reservationData: any): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabase.from('reservations').upsert(
    { club_code: clubCode, data: reservationData, updated_at: new Date().toISOString() },
    { onConflict: 'club_code' },
  );
}

// ── Feature Flags ──

export async function getClubFeatureFlags(clubCode: string): Promise<ClubFeatureFlags | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabase
    .from('clubs')
    .select('feature_flags')
    .eq('code', clubCode)
    .maybeSingle();
  if (error || !data) return null;
  return data.feature_flags as ClubFeatureFlags;
}

export async function getClubTier(clubCode: string): Promise<SubscriptionTier | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabase
    .from('clubs')
    .select('subscription_tier')
    .eq('code', clubCode)
    .maybeSingle();
  if (error || !data) return null;
  return data.subscription_tier as SubscriptionTier;
}

// ── 회원 ──

export async function getClubMembers(clubCode: string): Promise<{ email: string; playerName: string; role: string; adminLevel: number | null }[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from('club_members')
    .select('email, player_name, role, admin_level')
    .eq('club_code', clubCode);
  if (error || !data) return [];
  return data.map(m => ({
    email: m.email,
    playerName: m.player_name,
    role: m.role,
    adminLevel: m.admin_level,
  }));
}

// ── Storage (프로필 이미지) ──

export async function uploadProfileImage(clubCode: string, email: string, blob: Blob, ext: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const path = `profiles/${clubCode}/${email}.${ext}`;
  const { error } = await supabase.storage.from('avatars').upload(path, blob, {
    upsert: true,
    contentType: `image/${ext === 'png' ? 'png' : 'jpeg'}`,
  });
  if (error) {
    console.error('[Storage] Upload failed:', error);
    return null;
  }
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}

// ── 변환 헬퍼 ──

function dbPlayerToPlayer(row: any): Player {
  return {
    id: String(row.id),
    name: row.name,
    nickname: row.nickname ?? undefined,
    gender: row.gender || '남',
    hand: row.hand || '오른손',
    ageGroup: row.age_group || '40대',
    racket: row.racket || '모름',
    group: row.player_group || '미배정',
    ntrp: row.ntrp,
    adminNtrp: row.admin_ntrp,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    mbti: row.mbti,
    photoURL: row.photo_url ?? undefined,
    createdAt: row.created_at ? new Date(row.created_at) : undefined,
  };
}

function playerToDbPlayer(clubCode: string, player: Omit<Player, 'id'>): Record<string, any> {
  return {
    club_code: clubCode,
    name: player.name,
    nickname: player.nickname || null,
    gender: player.gender,
    hand: player.hand,
    age_group: player.ageGroup,
    racket: player.racket,
    player_group: player.group,
    ntrp: player.ntrp,
    admin_ntrp: player.adminNtrp,
    phone: player.phone || null,
    email: player.email || null,
    mbti: player.mbti,
    photo_url: player.photoURL || null,
  };
}

function dbLedgerToLedger(row: any): LedgerEntry {
  return {
    id: row.id,
    date: row.date,
    description: row.description,
    type: row.entry_type,
    amount: row.amount,
    category: row.category || '',
    memo: row.memo ?? undefined,
    billingPeriodId: row.billing_period_id ?? undefined,
    playerName: row.player_name ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
