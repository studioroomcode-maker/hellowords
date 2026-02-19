import { LedgerData, LedgerEntry, LedgerCategory, LedgerEntryType, CustomLedgerCategory } from '../types';
import { getLocalLedger, saveLocalLedger } from './localData';
import { syncManager } from './syncManager';

function cloneLedger(ledger: LedgerData): LedgerData {
  return JSON.parse(JSON.stringify(ledger));
}

function sortEntries(entries: LedgerEntry[]): LedgerEntry[] {
  return entries.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export async function getLedger(clubCode: string): Promise<LedgerData> {
  return cloneLedger(await getLocalLedger(clubCode));
}

export async function addEntry(
  clubCode: string,
  entry: Omit<LedgerEntry, 'id' | 'createdAt' | 'updatedAt'>
): Promise<LedgerData> {
  const ledger = await getLocalLedger(clubCode);
  const now = new Date().toISOString();
  const newEntry: LedgerEntry = {
    ...entry,
    id: `le-${Date.now()}`,
    createdAt: now,
    updatedAt: now,
  };
  ledger.entries.push(newEntry);
  sortEntries(ledger.entries);
  await saveLocalLedger(clubCode, ledger);
  syncManager.pushLedgerEntry(clubCode, newEntry);
  return cloneLedger(ledger);
}

export async function updateEntry(
  clubCode: string,
  entryId: string,
  updates: Partial<Omit<LedgerEntry, 'id' | 'createdAt'>>
): Promise<LedgerData> {
  const ledger = await getLocalLedger(clubCode);
  const entry = ledger.entries.find(e => e.id === entryId);
  if (entry) {
    Object.assign(entry, updates, { updatedAt: new Date().toISOString() });
  }
  sortEntries(ledger.entries);
  await saveLocalLedger(clubCode, ledger);
  syncManager.pushLedgerEntryUpdate(clubCode, entryId, updates);
  return cloneLedger(ledger);
}

export async function deleteEntry(
  clubCode: string,
  entryId: string
): Promise<LedgerData> {
  const ledger = await getLocalLedger(clubCode);
  ledger.entries = ledger.entries.filter(e => e.id !== entryId);
  await saveLocalLedger(clubCode, ledger);
  syncManager.pushLedgerEntryDelete(clubCode, entryId);
  return cloneLedger(ledger);
}

export async function deleteByBillingPayment(
  clubCode: string,
  billingPeriodId: string,
  playerName: string
): Promise<LedgerData> {
  const ledger = await getLocalLedger(clubCode);
  ledger.entries = ledger.entries.filter(
    e => !(e.billingPeriodId === billingPeriodId && e.playerName === playerName)
  );
  await saveLocalLedger(clubCode, ledger);
  syncManager.pushLedgerDeleteByBillingPayment(clubCode, billingPeriodId, playerName);
  return cloneLedger(ledger);
}

export async function deleteByBillingPeriod(
  clubCode: string,
  billingPeriodId: string
): Promise<LedgerData> {
  const ledger = await getLocalLedger(clubCode);
  ledger.entries = ledger.entries.filter(e => e.billingPeriodId !== billingPeriodId);
  await saveLocalLedger(clubCode, ledger);
  syncManager.pushLedgerDeleteByBillingPeriod(clubCode, billingPeriodId);
  return cloneLedger(ledger);
}

export async function updateByBillingPeriod(
  clubCode: string,
  billingPeriodId: string,
  updates: { amount: number; description?: string }
): Promise<LedgerData> {
  const ledger = await getLocalLedger(clubCode);
  const entry = ledger.entries.find(e => e.billingPeriodId === billingPeriodId);
  if (entry) {
    entry.amount = updates.amount;
    if (updates.description) entry.description = updates.description;
    entry.updatedAt = new Date().toISOString();
  }
  await saveLocalLedger(clubCode, ledger);
  syncManager.pushLedgerUpdateByBillingPeriod(clubCode, billingPeriodId, updates);
  return cloneLedger(ledger);
}

export async function updateCustomCategories(
  clubCode: string,
  categories: CustomLedgerCategory[]
): Promise<LedgerData> {
  const ledger = await getLocalLedger(clubCode);
  ledger.customCategories = categories;
  await saveLocalLedger(clubCode, ledger);
  syncManager.pushLedgerCategories(clubCode, categories);
  return cloneLedger(ledger);
}
