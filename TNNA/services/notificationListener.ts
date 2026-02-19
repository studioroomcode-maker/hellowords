import { Platform } from 'react-native';
import { NotificationListenerConfig, NotificationMatchLog } from '../types';
import * as duesService from './dues';

// ─── 은행 앱 패키지명 목록 ───
export const BANK_PACKAGES: { pkg: string; label: string }[] = [
  { pkg: 'com.kbstar.kbbank', label: 'KB국민' },
  { pkg: 'com.shinhan.sbanking', label: '신한' },
  { pkg: 'nh.smart', label: 'NH농협' },
  { pkg: 'com.wooribank.smart.banking', label: '우리' },
  { pkg: 'com.ibk.neobanking', label: 'IBK기업' },
  { pkg: 'com.hanabank.ebk.channel.android.hananbank', label: '하나' },
  { pkg: 'com.kakaobank.channel', label: '카카오뱅크' },
  { pkg: 'com.kakao.talk', label: '카카오톡' },
];

export const DEFAULT_PACKAGES = BANK_PACKAGES.map((b) => b.pkg);

// ─── 알림 텍스트 파싱 ───
interface ParsedDeposit {
  name: string;
  amount: number;
}

/**
 * 한국 은행 입금 알림 텍스트에서 이름과 금액을 추출
 */
export function parseNotificationText(text: string): ParsedDeposit | null {
  if (!text) return null;

  // "입금" 키워드가 없으면 무시 (출금/결제 알림 제외)
  if (!text.includes('입금')) return null;

  const patterns: { regex: RegExp; nameIdx: number; amountIdx: number }[] = [
    // 패턴 1: "홍길동 1,000,000 입금" (KB, 농협 등)
    { regex: /([가-힣]{2,4})\s+([\d,]+)\s*입금/, nameIdx: 1, amountIdx: 2 },
    // 패턴 2: "홍길동님이 30,000원을 입금" (카카오톡 알림톡)
    { regex: /([가-힣]{2,4})님이\s*([\d,]+)원/, nameIdx: 1, amountIdx: 2 },
    // 패턴 3: "입금 100,000원 홍길동" (신한 등)
    { regex: /입금\s*([\d,]+)원?\s+([가-힣]{2,4})/, nameIdx: 2, amountIdx: 1 },
    // 패턴 4: "입금 홍길동 100,000" (일부 은행)
    { regex: /입금\s+([가-힣]{2,4})\s+([\d,]+)/, nameIdx: 1, amountIdx: 2 },
  ];

  for (const { regex, nameIdx, amountIdx } of patterns) {
    const match = text.match(regex);
    if (match) {
      const name = match[nameIdx];
      const amount = parseInt(match[amountIdx].replace(/,/g, ''), 10);
      if (name && !isNaN(amount) && amount > 0) {
        return { name, amount };
      }
    }
  }

  return null;
}

/**
 * 파싱된 입금 정보로 회비 매칭 + 자동 상태 변경
 * 이름+금액 정확히 일치 → 입금완료
 * 이름만 일치, 금액 다름 → 확인요망
 */
export async function matchAndUpdateDues(
  clubCode: string,
  parsed: ParsedDeposit
): Promise<NotificationMatchLog> {
  const log: NotificationMatchLog = {
    timestamp: new Date().toISOString(),
    rawText: `${parsed.name} ${parsed.amount}`,
    parsedName: parsed.name,
    parsedAmount: parsed.amount,
    matchedPlayer: null,
    matchedPeriod: null,
    success: false,
  };

  try {
    const dues = await duesService.getDues(clubCode);

    for (const period of dues.billingPeriods) {
      const records = dues.payments[period.id];
      if (!records) continue;

      const record = records.find(
        (r) =>
          r.playerName === parsed.name &&
          (r.status === '미납' || r.status === '확인요망')
      );

      if (record) {
        if (record.amount === parsed.amount) {
          // 이름 + 금액 정확히 일치 → 입금완료
          await duesService.updatePaymentStatus(
            clubCode,
            period.id,
            parsed.name,
            '입금완료'
          );
          log.matchedPlayer = parsed.name;
          log.matchedPeriod = period.name;
          log.success = true;
          return log;
        } else {
          // 이름만 일치, 금액 다름 → 확인요망
          if (record.status === '미납') {
            await duesService.updatePaymentStatus(
              clubCode,
              period.id,
              parsed.name,
              '확인요망'
            );
          }
          log.matchedPlayer = parsed.name;
          log.matchedPeriod = period.name;
          log.success = false;
          return log;
        }
      }
    }
  } catch (e) {
    // 매칭 실패 — 로그만 반환
  }

  return log;
}

// ─── Android 네이티브 리스너 ───
// Development Build에서만 동작 (Expo Go에서는 네이티브 모듈 없음)
// 사용법: npm install expo-android-notification-listener-service 후
//         npx expo prebuild && npx expo run:android 로 Development Build 생성

let nativeModule: any = null;
let subscription: any = null;
let moduleLoaded = false;

function getNativeModule() {
  if (Platform.OS !== 'android') return null;
  if (moduleLoaded) return nativeModule;
  moduleLoaded = true;

  // expo-android-notification-listener-service 패키지 설치 + Development Build 필요
  // 패키지 미설치 상태에서는 no-op (Expo Go 호환)
  // 패키지 설치 후 아래 주석을 해제하세요:
  // try {
  //   const { NativeModules } = require('react-native');
  //   if (NativeModules.ExpoAndroidNotificationListenerService) {
  //     nativeModule = require('expo-android-notification-listener-service');
  //   }
  // } catch {
  //   nativeModule = null;
  // }
  return nativeModule;
}

/** 알림 접근 권한 확인 */
export async function checkPermission(): Promise<boolean> {
  const mod = getNativeModule();
  if (!mod) return false;
  try {
    return await mod.isNotificationPermissionGranted();
  } catch {
    return false;
  }
}

/** 알림 접근 설정 화면 열기 */
export async function openPermissionSettings(): Promise<void> {
  const mod = getNativeModule();
  if (!mod) return;
  try {
    await mod.openNotificationListenerSettings();
  } catch {
    // ignore
  }
}

/** 리스너 시작 */
export async function startListening(
  clubCode: string,
  allowedPackages: string[],
  onMatch: (log: NotificationMatchLog) => void
): Promise<void> {
  const mod = getNativeModule();
  if (!mod) return;

  // 기존 구독 정리
  stopListening();

  try {
    if (allowedPackages.length > 0) {
      await mod.setAllowedPackages(allowedPackages);
    }

    subscription = mod.addListener(
      'onNotificationReceived',
      async (data: any) => {
        const text = data?.text || data?.bigText || '';
        const parsed = parseNotificationText(text);
        if (parsed) {
          const log = await matchAndUpdateDues(clubCode, parsed);
          onMatch(log);
        }
      }
    );
  } catch {
    // 리스너 시작 실패
  }
}

/** 리스너 중지 */
export function stopListening(): void {
  if (subscription) {
    subscription.remove();
    subscription = null;
  }
}

/** Android Development Build에서 사용 가능한지 체크 */
export function isAvailable(): boolean {
  if (Platform.OS !== 'android') return false;
  return getNativeModule() !== null;
}
