import { DuesData, BillingPeriod, PaymentStatus, PaymentRecord, ScheduledBilling } from '../types';
import { getLocalDues, saveLocalDues } from './localData';
import { syncManager } from './syncManager';

// React state 업데이트를 위해 새 객체 참조 반환
function cloneDues(dues: DuesData): DuesData {
  return JSON.parse(JSON.stringify(dues));
}

// 로컬 저장 + 서버 동기화
async function saveDuesWithSync(clubCode: string, dues: DuesData): Promise<boolean> {
  const result = await saveLocalDues(clubCode, dues);
  syncManager.pushDues(clubCode, dues);
  return result;
}

export async function getDues(clubCode: string): Promise<DuesData> {
  return cloneDues(await getLocalDues(clubCode));
}

export async function saveDues(clubCode: string, dues: DuesData): Promise<boolean> {
  return saveDuesWithSync(clubCode, dues);
}

export async function addBillingPeriod(
  clubCode: string,
  period: { name: string; amount: number; date?: string; ledgerCategory?: string },
  memberAmounts: { playerName: string; amount: number }[]
): Promise<DuesData> {
  const dues = await getLocalDues(clubCode);
  const newPeriod: BillingPeriod = {
    id: `bp-${Date.now()}`,
    name: period.name,
    amount: period.amount,
    date: period.date,
    ledgerCategory: period.ledgerCategory,
    createdAt: new Date().toISOString(),
  };
  dues.billingPeriods.push(newPeriod);
  dues.payments[newPeriod.id] = memberAmounts.map((m) => ({
    playerName: m.playerName,
    status: '미납' as PaymentStatus,
    amount: m.amount,
    updatedAt: new Date().toISOString(),
  }));
  await saveDuesWithSync(clubCode, dues);
  return cloneDues(dues);
}

export async function updateBillingPeriod(
  clubCode: string,
  periodId: string,
  updates: { name?: string; amount?: number }
): Promise<DuesData> {
  const dues = await getLocalDues(clubCode);
  const period = dues.billingPeriods.find((p) => p.id === periodId);
  if (period) {
    if (updates.name !== undefined) period.name = updates.name;
    if (updates.amount !== undefined) period.amount = updates.amount;
  }
  await saveDuesWithSync(clubCode, dues);
  return cloneDues(dues);
}

export async function updatePaymentStatus(
  clubCode: string,
  periodId: string,
  playerName: string,
  newStatus: PaymentStatus
): Promise<DuesData> {
  const dues = await getLocalDues(clubCode);
  const records = dues.payments[periodId];
  if (records) {
    const record = records.find((r) => r.playerName === playerName);
    if (record) {
      record.status = newStatus;
      record.updatedAt = new Date().toISOString();
    }
  }
  await saveDuesWithSync(clubCode, dues);
  return cloneDues(dues);
}

export async function removePaymentRecord(
  clubCode: string,
  periodId: string,
  playerName: string
): Promise<DuesData> {
  const dues = await getLocalDues(clubCode);
  const records = dues.payments[periodId];
  if (records) {
    dues.payments[periodId] = records.filter((r) => r.playerName !== playerName);
  }
  await saveDuesWithSync(clubCode, dues);
  return cloneDues(dues);
}

export async function deleteBillingPeriod(
  clubCode: string,
  periodId: string
): Promise<DuesData> {
  const dues = await getLocalDues(clubCode);
  dues.billingPeriods = dues.billingPeriods.filter((p) => p.id !== periodId);
  delete dues.payments[periodId];
  await saveDuesWithSync(clubCode, dues);
  return cloneDues(dues);
}

export async function syncDuesMembers(
  clubCode: string,
  currentPlayerNames: string[]
): Promise<DuesData> {
  const dues = await getLocalDues(clubCode);
  const currentSet = new Set(currentPlayerNames);
  let changed = false;

  for (const periodId of Object.keys(dues.payments)) {
    const existing = dues.payments[periodId];
    const period = dues.billingPeriods.find((p) => p.id === periodId);
    const defaultAmount = period?.amount || 0;
    // amount 필드 마이그레이션 (기존 레코드에 amount 없는 경우)
    for (const record of existing) {
      if ((record as any).amount === undefined) {
        (record as any).amount = defaultAmount;
        changed = true;
      }
    }

    // 삭제된 선수 제거
    const filtered = existing.filter((r) => currentSet.has(r.playerName));
    if (filtered.length !== existing.length) {
      dues.payments[periodId] = filtered;
      changed = true;
    }
  }

  if (changed) await saveDuesWithSync(clubCode, dues);
  return cloneDues(dues);
}

export async function updatePaymentAmount(
  clubCode: string,
  periodId: string,
  playerName: string,
  newAmount: number
): Promise<DuesData> {
  const dues = await getLocalDues(clubCode);
  const records = dues.payments[periodId];
  if (records) {
    const record = records.find((r) => r.playerName === playerName);
    if (record) {
      record.amount = newAmount;
      record.updatedAt = new Date().toISOString();
    }
  }
  await saveDuesWithSync(clubCode, dues);
  return cloneDues(dues);
}

export async function addPaymentRecord(
  clubCode: string,
  periodId: string,
  playerName: string,
  amount: number
): Promise<DuesData> {
  const dues = await getLocalDues(clubCode);
  const records = dues.payments[periodId];
  if (records) {
    if (!records.find((r) => r.playerName === playerName)) {
      records.push({
        playerName,
        status: '미납' as PaymentStatus,
        amount,
        updatedAt: new Date().toISOString(),
      });
    }
  }
  await saveDuesWithSync(clubCode, dues);
  return cloneDues(dues);
}

export async function dismissPayment(
  clubCode: string,
  periodId: string,
  playerName: string
): Promise<DuesData> {
  const dues = await getLocalDues(clubCode);
  const records = dues.payments[periodId];
  if (records) {
    const record = records.find((r) => r.playerName === playerName);
    if (record) {
      record.dismissed = true;
    }
  }
  await saveDuesWithSync(clubCode, dues);
  return cloneDues(dues);
}

export async function addScheduledBilling(
  clubCode: string,
  scheduled: Omit<ScheduledBilling, 'id' | 'createdAt'>
): Promise<DuesData> {
  const dues = await getLocalDues(clubCode);
  if (!dues.scheduledBillings) dues.scheduledBillings = [];
  dues.scheduledBillings.push({
    ...scheduled,
    id: `sb-${Date.now()}`,
    createdAt: new Date().toISOString(),
  });
  dues.scheduledBillings.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  await saveDuesWithSync(clubCode, dues);
  return cloneDues(dues);
}

export async function deleteScheduledBilling(
  clubCode: string,
  scheduledId: string
): Promise<DuesData> {
  const dues = await getLocalDues(clubCode);
  if (dues.scheduledBillings) {
    dues.scheduledBillings = dues.scheduledBillings.filter(s => s.id !== scheduledId);
  }
  await saveDuesWithSync(clubCode, dues);
  return cloneDues(dues);
}

export async function processScheduledBillings(
  clubCode: string
): Promise<{ dues: DuesData; processed: ScheduledBilling[] }> {
  const dues = await getLocalDues(clubCode);
  if (!dues.scheduledBillings || dues.scheduledBillings.length === 0) {
    return { dues: cloneDues(dues), processed: [] };
  }
  const now = new Date().toISOString();
  const due = dues.scheduledBillings.filter(s => s.scheduledAt <= now);
  const remaining = dues.scheduledBillings.filter(s => s.scheduledAt > now);

  for (const sb of due) {
    const newPeriod: BillingPeriod = {
      id: `bp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: sb.name,
      amount: sb.amount,
      date: sb.date,
      ledgerCategory: sb.ledgerCategory,
      createdAt: new Date().toISOString(),
    };
    dues.billingPeriods.push(newPeriod);
    dues.payments[newPeriod.id] = sb.memberAmounts.map(m => ({
      playerName: m.playerName,
      status: '미납' as PaymentStatus,
      amount: m.amount,
      updatedAt: new Date().toISOString(),
    }));
  }

  dues.scheduledBillings = remaining;
  await saveDuesWithSync(clubCode, dues);
  return { dues: cloneDues(dues), processed: due };
}
