import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// AsyncStorage 키 패턴 (localData.ts와 동일)
const KEYS = {
  SESSIONS: (c: string) => `@tennis_sessions_${c}`,
  PLAYERS: (c: string) => `@tennis_players_${c}`,
  DUES: (c: string) => `@tennis_dues_${c}`,
  LEDGER: (c: string) => `@tennis_ledger_${c}`,
};

interface BackupFile {
  type: 'sessions' | 'players' | 'dues';
  version: 1;
  clubCode: string;
  exportDate: string;
  data: any;
}

// =============================================
// 내보내기 (Export)
// =============================================

export async function exportSessions(clubCode: string): Promise<string> {
  const raw = await AsyncStorage.getItem(KEYS.SESSIONS(clubCode.toUpperCase()));
  const data = raw ? JSON.parse(raw) : {};
  const backup: BackupFile = {
    type: 'sessions',
    version: 1,
    clubCode: clubCode.toUpperCase(),
    exportDate: new Date().toISOString(),
    data,
  };
  return JSON.stringify(backup, null, 2);
}

export async function exportPlayers(clubCode: string): Promise<string> {
  const raw = await AsyncStorage.getItem(KEYS.PLAYERS(clubCode.toUpperCase()));
  const data = raw ? JSON.parse(raw) : [];
  const backup: BackupFile = {
    type: 'players',
    version: 1,
    clubCode: clubCode.toUpperCase(),
    exportDate: new Date().toISOString(),
    data,
  };
  return JSON.stringify(backup, null, 2);
}

export async function exportDues(clubCode: string): Promise<string> {
  const code = clubCode.toUpperCase();
  const duesRaw = await AsyncStorage.getItem(KEYS.DUES(code));
  const ledgerRaw = await AsyncStorage.getItem(KEYS.LEDGER(code));
  const dues = duesRaw ? JSON.parse(duesRaw) : { billingPeriods: [], payments: {} };
  const ledger = ledgerRaw ? JSON.parse(ledgerRaw) : { entries: [] };
  const backup: BackupFile = {
    type: 'dues',
    version: 1,
    clubCode: code,
    exportDate: new Date().toISOString(),
    data: { dues, ledger },
  };
  return JSON.stringify(backup, null, 2);
}

// =============================================
// 가져오기 (Import)
// =============================================

function validateBackup(json: string, expectedType: BackupFile['type']): BackupFile {
  let parsed: any;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('올바른 JSON 파일이 아닙니다.');
  }
  if (!parsed || parsed.type !== expectedType || parsed.version !== 1) {
    throw new Error(`올바른 ${expectedType === 'sessions' ? '경기기록' : expectedType === 'players' ? '선수' : '회비'} 백업 파일이 아닙니다.`);
  }
  return parsed as BackupFile;
}

export async function importSessions(clubCode: string, json: string): Promise<number> {
  const backup = validateBackup(json, 'sessions');
  const data = backup.data as Record<string, any>;
  const count = Object.keys(data).length;
  if (count === 0) throw new Error('백업 파일에 경기 데이터가 없습니다.');
  await AsyncStorage.setItem(KEYS.SESSIONS(clubCode.toUpperCase()), JSON.stringify(data));
  return count;
}

export async function importPlayers(clubCode: string, json: string): Promise<number> {
  const backup = validateBackup(json, 'players');
  const data = backup.data as any[];
  if (!Array.isArray(data)) throw new Error('올바른 선수 백업 파일이 아닙니다.');
  if (data.length === 0) throw new Error('백업 파일에 선수 데이터가 없습니다.');
  await AsyncStorage.setItem(KEYS.PLAYERS(clubCode.toUpperCase()), JSON.stringify(data));
  return data.length;
}

export async function importDues(clubCode: string, json: string): Promise<void> {
  const backup = validateBackup(json, 'dues');
  const { dues, ledger } = backup.data as { dues: any; ledger: any };
  if (!dues) throw new Error('올바른 회비 백업 파일이 아닙니다.');
  const code = clubCode.toUpperCase();
  await AsyncStorage.setItem(KEYS.DUES(code), JSON.stringify(dues));
  if (ledger) {
    await AsyncStorage.setItem(KEYS.LEDGER(code), JSON.stringify(ledger));
  }
}

// =============================================
// 파일 다운로드/업로드 헬퍼
// =============================================

export async function downloadJson(json: string, filename: string): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    const { cacheDirectory, writeAsStringAsync, EncodingType } = await import('expo-file-system/legacy');
    const { shareAsync } = await import('expo-sharing');
    const fileUri = (cacheDirectory || '') + filename;
    await writeAsStringAsync(fileUri, json, { encoding: EncodingType.UTF8 });
    await shareAsync(fileUri, { mimeType: 'application/json', UTI: 'public.json' });
  }
}

export function pickJsonFile(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) { resolve(null); return; }
        const text = await file.text();
        resolve(text);
      };
      input.addEventListener('cancel', () => resolve(null));
      input.click();
    });
  } else {
    return (async () => {
      const DocumentPicker = await import('expo-document-picker');
      const { readAsStringAsync, EncodingType } = await import('expo-file-system/legacy');
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
      if (result.canceled || !result.assets?.length) return null;
      const content = await readAsStringAsync(result.assets[0].uri, {
        encoding: EncodingType.UTF8,
      });
      return content;
    })();
  }
}
