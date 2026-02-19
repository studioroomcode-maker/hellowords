/**
 * Sync Manager
 * AsyncStorage(로컬) ↔ Supabase(서버) 동기화 관리
 *
 * 전략: Write-Local-First + Background Sync
 * - 쓰기: 로컬 먼저 → 온라인이면 서버에도
 * - 읽기: 로컬 → 서버에서 최신 가져와 로컬 갱신
 * - 충돌: 서버 우선 (last-write-wins)
 */

import { isSupabaseConfigured } from './supabase';
import * as remote from './supabaseData';
import {
  getLocalSession,
  saveLocalSession,
  getLocalSessionDates,
  deleteLocalSession,
  getLocalPlayers,
  saveLocalPlayers,
  getLocalClubSettings,
  saveLocalClubSettings,
  getLocalDues,
  saveLocalDues,
  getLocalLedger,
  saveLocalLedger,
  getLocalReservations,
  saveLocalReservations,
} from './localData';
import { Player, Session, ClubSettings, DuesData, LedgerData, LedgerEntry, CustomLedgerCategory } from '../types';

class SyncManager {
  private _online: boolean = true;

  /** 온라인 상태 확인 */
  isOnline(): boolean {
    return this._online && isSupabaseConfigured();
  }

  /** 온라인 상태 수동 설정 (네트워크 감지용) */
  setOnline(online: boolean) {
    this._online = online;
  }

  // ── 선수 동기화 ──

  /** 서버에서 선수 목록 가져와 로컬 갱신 */
  async pullPlayers(clubCode: string): Promise<Player[]> {
    if (!this.isOnline()) return getLocalPlayers(clubCode);

    try {
      const remotePlayers = await remote.getPlayers(clubCode);
      const localPlayers = await getLocalPlayers(clubCode);
      // 서버 데이터가 로컬보다 적으면 덮어쓰지 않음 (부분 동기화 방지)
      if (remotePlayers.length > 0 && remotePlayers.length >= localPlayers.length) {
        await saveLocalPlayers(clubCode, remotePlayers);
        return remotePlayers;
      }
      console.log('[Sync] pullPlayers: server has fewer players than local, keeping local',
        { remote: remotePlayers.length, local: localPlayers.length });
    } catch (e) {
      console.warn('[Sync] pullPlayers failed:', e);
    }
    return getLocalPlayers(clubCode);
  }

  /** 로컬 선수를 서버에 푸시 */
  async pushPlayer(clubCode: string, player: Omit<Player, 'id'>): Promise<void> {
    if (!this.isOnline()) return;
    try {
      await remote.addPlayer(clubCode, player);
    } catch (e) {
      console.warn('[Sync] pushPlayer failed:', e);
    }
  }

  async pushPlayerUpdate(clubCode: string, name: string, updates: Partial<Player>): Promise<void> {
    if (!this.isOnline()) return;
    try {
      await remote.updatePlayer(clubCode, name, updates);
    } catch (e) {
      console.warn('[Sync] pushPlayerUpdate failed:', e);
    }
  }

  async pushPlayerDelete(clubCode: string, name: string): Promise<void> {
    if (!this.isOnline()) return;
    try {
      await remote.deletePlayer(clubCode, name);
    } catch (e) {
      console.warn('[Sync] pushPlayerDelete failed:', e);
    }
  }

  // ── 세션 동기화 ──

  /** 서버에서 세션 가져와 로컬 갱신 */
  async pullSession(clubCode: string, date: string): Promise<Session | null> {
    if (!this.isOnline()) return getLocalSession(clubCode, date);

    try {
      const remoteSession = await remote.getSession(clubCode, date);
      if (remoteSession) {
        await saveLocalSession(clubCode, date, remoteSession);
        return remoteSession;
      }
    } catch (e) {
      console.warn('[Sync] pullSession failed:', e);
    }
    return getLocalSession(clubCode, date);
  }

  /** 로컬 세션을 서버에 푸시 */
  async pushSession(clubCode: string, date: string, session: Session): Promise<void> {
    if (!this.isOnline()) return;
    try {
      await remote.saveSession(clubCode, date, session);
    } catch (e) {
      console.warn('[Sync] pushSession failed:', e);
    }
  }

  async pushSessionDelete(clubCode: string, date: string): Promise<void> {
    if (!this.isOnline()) return;
    try {
      await remote.deleteSession(clubCode, date);
    } catch (e) {
      console.warn('[Sync] pushSessionDelete failed:', e);
    }
  }

  /** 서버에서 세션 날짜 목록 가져와 로컬과 병합 */
  async pullSessionDates(clubCode: string): Promise<string[]> {
    if (!this.isOnline()) return getLocalSessionDates(clubCode);

    try {
      const remoteDates = await remote.getSessionDates(clubCode);
      const localDates = await getLocalSessionDates(clubCode);
      // 합집합 (중복 제거)
      const merged = [...new Set([...remoteDates, ...localDates])].sort().reverse();
      return merged;
    } catch (e) {
      console.warn('[Sync] pullSessionDates failed:', e);
    }
    return getLocalSessionDates(clubCode);
  }

  // ── 클럽 설정 동기화 ──

  async pullSettings(clubCode: string): Promise<ClubSettings | null> {
    if (!this.isOnline()) return getLocalClubSettings(clubCode);

    try {
      const remoteSettings = await remote.getClubSettings(clubCode);
      // 서버 설정이 실제 내용이 있을 때만 로컬 덮어쓰기 (빈 {} 무시)
      if (remoteSettings && Object.keys(remoteSettings).length > 0) {
        await saveLocalClubSettings(clubCode, remoteSettings);
        return remoteSettings;
      }
    } catch (e) {
      console.warn('[Sync] pullSettings failed:', e);
    }
    return getLocalClubSettings(clubCode);
  }

  async pushSettings(clubCode: string, settings: ClubSettings): Promise<void> {
    if (!this.isOnline()) return;
    try {
      await remote.updateClubSettings(clubCode, settings);
    } catch (e) {
      console.warn('[Sync] pushSettings failed:', e);
    }
  }

  // ── 회비 동기화 ──

  async pullDues(clubCode: string): Promise<DuesData | null> {
    if (!this.isOnline()) return getLocalDues(clubCode);

    try {
      const remoteDues = await remote.getDues(clubCode);
      if (remoteDues) {
        await saveLocalDues(clubCode, remoteDues);
        return remoteDues;
      }
    } catch (e) {
      console.warn('[Sync] pullDues failed:', e);
    }
    return getLocalDues(clubCode);
  }

  async pushDues(clubCode: string, duesData: DuesData): Promise<void> {
    if (!this.isOnline()) return;
    try {
      await remote.saveDues(clubCode, duesData);
    } catch (e) {
      console.warn('[Sync] pushDues failed:', e);
    }
  }

  // ── 가계부 동기화 ──

  async pullLedger(clubCode: string): Promise<LedgerData> {
    if (!this.isOnline()) return getLocalLedger(clubCode);

    try {
      const [entries, categories] = await Promise.all([
        remote.getLedgerEntries(clubCode),
        remote.getLedgerCategories(clubCode),
      ]);
      if (entries.length > 0 || categories.length > 0) {
        const ledger: LedgerData = { entries, customCategories: categories };
        await saveLocalLedger(clubCode, ledger);
        return ledger;
      }
    } catch (e) {
      console.warn('[Sync] pullLedger failed:', e);
    }
    return getLocalLedger(clubCode);
  }

  async pushLedgerEntry(clubCode: string, entry: LedgerEntry): Promise<void> {
    if (!this.isOnline()) return;
    try {
      await remote.addLedgerEntry(clubCode, entry);
    } catch (e) {
      console.warn('[Sync] pushLedgerEntry failed:', e);
    }
  }

  async pushLedgerEntryUpdate(clubCode: string, entryId: string, updates: Partial<LedgerEntry>): Promise<void> {
    if (!this.isOnline()) return;
    try {
      await remote.updateLedgerEntry(clubCode, entryId, updates);
    } catch (e) {
      console.warn('[Sync] pushLedgerEntryUpdate failed:', e);
    }
  }

  async pushLedgerEntryDelete(clubCode: string, entryId: string): Promise<void> {
    if (!this.isOnline()) return;
    try {
      await remote.deleteLedgerEntry(entryId);
    } catch (e) {
      console.warn('[Sync] pushLedgerEntryDelete failed:', e);
    }
  }

  async pushLedgerDeleteByBillingPeriod(clubCode: string, billingPeriodId: string): Promise<void> {
    if (!this.isOnline()) return;
    try {
      await remote.deleteLedgerEntriesByBillingPeriod(clubCode, billingPeriodId);
    } catch (e) {
      console.warn('[Sync] pushLedgerDeleteByBillingPeriod failed:', e);
    }
  }

  async pushLedgerDeleteByBillingPayment(clubCode: string, billingPeriodId: string, playerName: string): Promise<void> {
    if (!this.isOnline()) return;
    try {
      await remote.deleteLedgerEntriesByBillingPayment(clubCode, billingPeriodId, playerName);
    } catch (e) {
      console.warn('[Sync] pushLedgerDeleteByBillingPayment failed:', e);
    }
  }

  async pushLedgerUpdateByBillingPeriod(
    clubCode: string, billingPeriodId: string, updates: { amount: number; description?: string }
  ): Promise<void> {
    if (!this.isOnline()) return;
    try {
      await remote.updateLedgerEntriesByBillingPeriod(clubCode, billingPeriodId, updates);
    } catch (e) {
      console.warn('[Sync] pushLedgerUpdateByBillingPeriod failed:', e);
    }
  }

  async pushLedgerCategories(clubCode: string, categories: CustomLedgerCategory[]): Promise<void> {
    if (!this.isOnline()) return;
    try {
      await remote.saveLedgerCategories(clubCode, categories);
    } catch (e) {
      console.warn('[Sync] pushLedgerCategories failed:', e);
    }
  }

  // ── 예약 동기화 ──

  async pullReservations(clubCode: string): Promise<any> {
    if (!this.isOnline()) return getLocalReservations(clubCode);

    try {
      const remoteData = await remote.getReservations(clubCode);
      if (remoteData) {
        await saveLocalReservations(clubCode, remoteData);
        return remoteData;
      }
    } catch (e) {
      console.warn('[Sync] pullReservations failed:', e);
    }
    return getLocalReservations(clubCode);
  }

  async pushReservations(clubCode: string, data: any): Promise<void> {
    if (!this.isOnline()) return;
    try {
      await remote.saveReservations(clubCode, data);
    } catch (e) {
      console.warn('[Sync] pushReservations failed:', e);
    }
  }

  // ── 전체 동기화 ──

  /** 앱 시작 시 전체 pull (서버 → 로컬) */
  async fullPull(clubCode: string): Promise<void> {
    if (!this.isOnline()) return;

    console.log('[Sync] Full pull starting for', clubCode);
    try {
      await Promise.all([
        this.pullPlayers(clubCode),
        this.pullSettings(clubCode),
        this.pullDues(clubCode),
        this.pullLedger(clubCode),
        this.pullReservations(clubCode),
      ]);
      // 세션은 날짜 목록만 가져옴 (개별 세션은 필요할 때 lazy load)
      await this.pullSessionDates(clubCode);
      console.log('[Sync] Full pull completed');
    } catch (e) {
      console.warn('[Sync] Full pull failed:', e);
    }
  }

  /** 로컬 → 서버 전체 push (기존 데이터 마이그레이션용) */
  async fullPush(clubCode: string): Promise<void> {
    if (!this.isOnline()) return;

    console.log('[Sync] Full push starting for', clubCode);
    try {
      // 클럽을 서버에 등록 (없으면 생성)
      const { getLocalClub } = await import('./localData');
      const localClub = getLocalClub(clubCode);
      if (localClub) {
        await remote.createClub(clubCode, localClub.name);
      }

      // 클럽 설정 push
      const settings = await getLocalClubSettings(clubCode);
      if (settings) {
        await this.pushSettings(clubCode, settings);
      }

      // 선수 전체 push
      const players = await getLocalPlayers(clubCode);
      for (const player of players) {
        const { id, createdAt, ...rest } = player as any;
        await this.pushPlayer(clubCode, rest);
      }

      // 회비 push
      const dues = await getLocalDues(clubCode);
      if (dues && (dues.billingPeriods?.length > 0 || Object.keys(dues.payments || {}).length > 0)) {
        await this.pushDues(clubCode, dues);
      }

      // 가계부 push
      const ledger = await getLocalLedger(clubCode);
      if (ledger.entries?.length > 0) {
        for (const entry of ledger.entries) {
          await this.pushLedgerEntry(clubCode, entry);
        }
      }
      if (ledger.customCategories?.length) {
        await this.pushLedgerCategories(clubCode, ledger.customCategories);
      }

      // 예약 push
      const reservations = await getLocalReservations(clubCode);
      if (reservations && Object.keys(reservations.reservationData || {}).length > 0) {
        await this.pushReservations(clubCode, reservations);
      }

      // 세션 전체 push
      const dates = await getLocalSessionDates(clubCode);
      for (const date of dates) {
        const session = await getLocalSession(clubCode, date);
        if (session) {
          await this.pushSession(clubCode, date, session);
        }
      }

      console.log('[Sync] Full push completed -', players.length, 'players,', dates.length, 'sessions');
    } catch (e) {
      console.warn('[Sync] Full push failed:', e);
    }
  }

  /** 스마트 동기화: 서버가 비어있으면 로컬→서버 push, 아니면 서버→로컬 pull */
  async fullSync(clubCode: string): Promise<void> {
    if (!this.isOnline()) return;

    // 서버에 선수 데이터가 있는지 확인
    const remotePlayers = await remote.getPlayers(clubCode);
    if (remotePlayers.length === 0) {
      // 서버 비어있음 → 로컬 데이터를 서버로 push
      const localPlayers = await getLocalPlayers(clubCode);
      if (localPlayers.length > 0) {
        console.log('[Sync] Server empty, pushing local data...');
        await this.fullPush(clubCode);
        return;
      }
    }
    // 서버에 데이터 있음 → 서버에서 pull
    await this.fullPull(clubCode);
  }
}

export const syncManager = new SyncManager();
