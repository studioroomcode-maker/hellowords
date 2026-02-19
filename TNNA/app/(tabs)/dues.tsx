import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
  Alert,
  Switch,
  Linking,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { FontAwesome } from '@expo/vector-icons';
import { useClubStore } from '../../stores/clubStore';
import { usePlayerStore } from '../../stores/playerStore';
import { Card, Button, Checkbox, Select, Footer, SegmentedTabs } from '../../components/ui';
import { createDisplayNameFn } from '../../utils/displayName';
import { BillingPeriod, PaymentStatus, DuesData, BankAccountInfo, PaymentRecord, NotificationMatchLog, LedgerEntry, LedgerData, LedgerCategory, LedgerEntryType, CustomLedgerCategory } from '../../types';
import { getMemberNames, getLocalClub, getAdminLevels } from '../../services/localData';
import * as duesService from '../../services/dues';
import * as ledgerService from '../../services/ledger';
import * as notifListener from '../../services/notificationListener';
import { colors, spacing, radius, typography, MAX_WIDTH } from '../../theme/tokens';
const NAME_COL_WIDTH = 60;
const PERIOD_COL_WIDTH = 76;

// 등급별 차등금액 타입
type DiffMode = '직접입력' | '퍼센트할인' | '면제';
interface LevelDiffConfig {
  mode: DiffMode;
  value: string;
}
const DEFAULT_LEVEL_NAMES: Record<number, string> = { 1: '최고관리자', 2: '관리자', 3: '보조' };
const DIFF_MODE_OPTIONS = [
  { label: '직접입력', value: '직접입력' },
  { label: '퍼센트할인', value: '퍼센트할인' },
  { label: '면제', value: '면제' },
];

function calcLevelAmount(baseAmount: number, config: LevelDiffConfig): number {
  if (config.mode === '면제') return 0;
  if (config.mode === '직접입력') return parseInt(config.value, 10) || 0;
  // 퍼센트할인: 기본금액에서 할인율 적용, 100원 단위 반올림
  const pct = parseFloat(config.value) || 0;
  const discounted = baseAmount * (1 - pct / 100);
  return Math.round(discounted / 100) * 100;
}

// 가계부 기본 카테고리
const DEFAULT_LEDGER_CATEGORIES: { label: string; value: string; type: LedgerEntryType; icon: string }[] = [
  { label: '회비', value: '회비', type: '수입', icon: 'money' },
  { label: '코트비', value: '코트비', type: '지출', icon: 'map-marker' },
  { label: '식비', value: '식비', type: '지출', icon: 'cutlery' },
  { label: '용품구매', value: '용품구매', type: '지출', icon: 'shopping-cart' },
  { label: '대회비', value: '대회비', type: '지출', icon: 'trophy' },
  { label: '기타수입', value: '기타수입', type: '수입', icon: 'plus-circle' },
  { label: '기타지출', value: '기타지출', type: '지출', icon: 'minus-circle' },
];

// SMS 송신 헬퍼
function openSmsToAdmin(phones: string[], clubName: string, playerName: string, amount: number, periodName: string) {
  if (!phones.length) return;
  const body = `${clubName} ${periodName} ${playerName} ${amount.toLocaleString()}원 입금 확인 바랍니다.`;
  const sep = Platform.OS === 'ios' ? '&' : '?';
  const url = `sms:${phones.join(',')}${sep}body=${encodeURIComponent(body)}`;
  Linking.openURL(url).catch(() => {});
}

// 상태 뱃지 컴포넌트
function StatusBadge({
  status,
  isAdmin,
  bankAccount,
  amount,
  playerName,
  periodId,
  periodName,
  contactPhones,
  clubName,
  onStatusChange,
  onRemove,
  onEditAmount,
}: {
  status: PaymentStatus;
  isAdmin: boolean;
  bankAccount?: BankAccountInfo;
  amount: number;
  playerName: string;
  periodId: string;
  periodName: string;
  contactPhones: string[];
  clubName?: string;
  onStatusChange: (periodId: string, playerName: string, newStatus: PaymentStatus) => void;
  onRemove?: (periodId: string, playerName: string) => void;
  onEditAmount?: (periodId: string, playerName: string, currentAmount: number) => void;
}) {
  // 관리자 길게 누르기 → 금액 수정 / 삭제 메뉴
  const handleAdminLongPress = () => {
    if (!isAdmin) return;
    const label = `${periodName} · ${amount.toLocaleString()}원`;
    if (Platform.OS === 'web') {
      const action = window.prompt(`${playerName} (${label})\n\n1: 금액 수정\n2: 삭제`);
      if (action === '1') onEditAmount?.(periodId, playerName, amount);
      else if (action === '2') {
        if (window.confirm(`${playerName}님을 삭제하시겠습니까?`)) onRemove?.(periodId, playerName);
      }
    } else {
      const buttons: any[] = [
        { text: '취소', style: 'cancel' },
        { text: '금액 수정', onPress: () => onEditAmount?.(periodId, playerName, amount) },
      ];
      if (status !== '미납') {
        buttons.push({ text: '미납으로 변경', onPress: () => onStatusChange(periodId, playerName, '미납') });
      }
      buttons.push({ text: '삭제', style: 'destructive', onPress: () => onRemove?.(periodId, playerName) });
      Alert.alert(playerName, label, buttons);
    }
  };

  if (status === '미납') {
    if (isAdmin) {
      const handleAdminUnpaidPress = () => {
        if (Platform.OS === 'web') {
          if (window.confirm(`${playerName} - 입금확인 하시겠습니까?`)) {
            onStatusChange(periodId, playerName, '입금완료');
          }
        } else {
          Alert.alert(playerName, '입금확인 하시겠습니까?', [
            { text: '취소', style: 'cancel' },
            { text: '입금확인', onPress: () => onStatusChange(periodId, playerName, '입금완료') },
          ]);
        }
      };
      return (
        <TouchableOpacity
          style={[styles.badge, styles.badgeUnpaid]}
          onPress={handleAdminUnpaidPress}
          onLongPress={handleAdminLongPress}
        >
          <Text style={styles.badgeUnpaidText}>미납</Text>
        </TouchableOpacity>
      );
    }
    // 회원: 계좌이체 + 카카오페이 버튼 모두 표시
    const hasBank = !!bankAccount?.accountNumber;
    const hasKakao = !!bankAccount?.kakaoPayUrl;

    const handlePayment = async (type: 'bank' | 'kakao') => {
      if (type === 'kakao' && bankAccount?.kakaoPayUrl) {
        try { await Linking.openURL(bankAccount.kakaoPayUrl); } catch {}
      } else if (type === 'bank' && bankAccount?.accountNumber) {
        const text = `${bankAccount.bankName} ${bankAccount.accountNumber} (${bankAccount.accountHolder}) ${amount.toLocaleString()}원`;
        try { await Clipboard.setStringAsync(text); } catch {}
      }
      onStatusChange(periodId, playerName, '확인요망');
      if (type === 'bank' && bankAccount?.accountNumber) {
        const detail = `계좌 정보가 복사되었습니다.\n\n${bankAccount.bankName} ${bankAccount.accountNumber}\n예금주: ${bankAccount.accountHolder}\n금액: ${amount.toLocaleString()}원`;
        if (Platform.OS === 'web') {
          alert(detail);
        } else {
          Alert.alert('계좌 정보', detail);
        }
      } else if (type === 'kakao') {
        const msg = '카카오페이 송금 페이지로 이동합니다.\n입금 후 관리자가 확인합니다.';
        Platform.OS === 'web' ? alert(msg) : Alert.alert('알림', msg);
      } else {
        const msg = '관리자에게 계좌 정보를 요청하세요.';
        Platform.OS === 'web' ? alert(msg) : Alert.alert('알림', msg);
      }
    };

    return (
      <View style={styles.payBtnStack}>
        {hasBank && (
          <TouchableOpacity style={[styles.badgeMini, styles.badgePay]} onPress={() => handlePayment('bank')}>
            <Text style={styles.badgeMiniText}>계좌이체</Text>
          </TouchableOpacity>
        )}
        {hasKakao && (
          <TouchableOpacity style={[styles.badgeMini, styles.badgeKakao]} onPress={() => handlePayment('kakao')}>
            <Text style={[styles.badgeMiniText, styles.badgeKakaoText]}>카카오송금</Text>
          </TouchableOpacity>
        )}
        {!hasBank && !hasKakao && (
          <View style={[styles.badge, styles.badgeUnpaid]}>
            <Text style={styles.badgeUnpaidText}>미납</Text>
          </View>
        )}
      </View>
    );
  }

  if (status === '확인요망') {
    if (isAdmin) {
      return (
        <TouchableOpacity
          style={[styles.badge, styles.badgePending]}
          onPress={() => {
            if (Platform.OS === 'web') {
              if (window.confirm(`${playerName}님이 입금 되었습니까?`)) {
                onStatusChange(periodId, playerName, '입금완료');
              }
            } else {
              Alert.alert('입금 확인', `${playerName}님이 입금 되었습니까?`, [
                { text: '취소', style: 'cancel' },
                { text: '입금내역 없음', style: 'destructive', onPress: () => onStatusChange(periodId, playerName, '미납') },
                { text: '확인', onPress: () => onStatusChange(periodId, playerName, '입금완료') },
              ]);
            }
          }}
          onLongPress={handleAdminLongPress}
        >
          <Text style={styles.badgePendingText}>확인요망</Text>
        </TouchableOpacity>
      );
    }
    // 회원: 입금확인요청 + 입금대기 + 재입금
    return (
      <View style={styles.payBtnStack}>
        {contactPhones.length > 0 && clubName ? (
          <TouchableOpacity
            style={[styles.badgeMini, styles.badgeRequest]}
            onPress={() => openSmsToAdmin(contactPhones, clubName, playerName, amount, periodName)}
          >
            <Text style={styles.badgeRequestText}>확인요청</Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.badge, styles.badgePending]}>
            <Text style={styles.badgePendingText}>입금대기</Text>
          </View>
        )}
        <TouchableOpacity onPress={() => onStatusChange(periodId, playerName, '미납')}>
          <Text style={styles.retryText}>재입금</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 입금완료
  if (isAdmin) {
    return (
      <TouchableOpacity
        style={[styles.badge, styles.badgeDone]}
        onPress={() => {
          if (Platform.OS === 'web') {
            if (window.confirm(`${playerName}님의 입금확인완료를 다시 해제하시겠습니까?`)) {
              onStatusChange(periodId, playerName, '미납');
            }
          } else {
            Alert.alert('입금 해제', `${playerName}님의 입금확인완료를 다시 해제하시겠습니까?`, [
              { text: '아니오', style: 'cancel' },
              { text: '예', style: 'destructive', onPress: () => onStatusChange(periodId, playerName, '미납') },
            ]);
          }
        }}
        onLongPress={handleAdminLongPress}
      >
        <FontAwesome name="check" size={10} color={colors.success} />
        <Text style={styles.badgeDoneText}> 완료</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.badge, styles.badgeDone]}>
      <FontAwesome name="check" size={10} color={colors.success} />
      <Text style={styles.badgeDoneText}> 완료</Text>
    </View>
  );
}

export default function DuesScreen() {
  const { clubCode, isAdmin, club } = useClubStore();
  const hasPermission = useClubStore(s => s.hasPermission);
  const { players } = usePlayerStore();
  const bankAccount = club?.settings?.bankAccount;

  // admin without canAccessDues permission sees member view
  const effectiveAdmin = isAdmin && hasPermission('canAccessDues');

  const sr = club?.settings?.sectionRestrictions || {};
  const isSectionRestricted = (key: string) => !isAdmin && sr[key];

  const displayNameMode = club?.settings?.displayNameMode;
  const dn = useMemo(() => createDisplayNameFn(players, displayNameMode), [players, displayNameMode]);

  const [duesTab, setDuesTab] = useState<'payment' | 'status' | 'settlement'>('payment');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'dues' | 'other'>('all');
  const [paymentPeriodFilter, setPaymentPeriodFilter] = useState<string>('all');

  const [duesData, setDuesData] = useState<DuesData>({ billingPeriods: [], payments: {} });
  const [isLoading, setIsLoading] = useState(true);

  // 청구 추가 모달
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPeriodName, setNewPeriodName] = useState('');
  const [newPeriodAmount, setNewPeriodAmount] = useState('');
  const [newPeriodDate, setNewPeriodDate] = useState('');
  const [newPeriodCategory, setNewPeriodCategory] = useState<string>('회비');
  const [useDiffAmount, setUseDiffAmount] = useState(false);
  const [levelDiffConfigs, setLevelDiffConfigs] = useState<Record<number, LevelDiffConfig>>({
    1: { mode: '직접입력', value: '' },
    2: { mode: '직접입력', value: '' },
    3: { mode: '직접입력', value: '' },
  });
  const [selectedMembers, setSelectedMembers] = useState<Record<string, boolean>>({});
  const [memberCustomAmounts, setMemberCustomAmounts] = useState<Record<string, string>>({});

  // 청구 수정 모달
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<BillingPeriod | null>(null);
  const [editPeriodName, setEditPeriodName] = useState('');
  const [editPeriodAmount, setEditPeriodAmount] = useState('');
  const [editSelectedMembers, setEditSelectedMembers] = useState<Record<string, boolean>>({});
  const [editMemberAmounts, setEditMemberAmounts] = useState<Record<string, string>>({});

  // 납부요청 SMS 모달
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [smsPeriodId, setSmsPeriodId] = useState<string>('');
  const [smsChecked, setSmsChecked] = useState<Record<string, boolean>>({});
  const [smsBody, setSmsBody] = useState('');

  // 개별 금액 수정 모달
  const [editRecordState, setEditRecordState] = useState<{
    periodId: string;
    playerName: string;
    amount: string;
  } | null>(null);

  // ======== 가계부 상태 ========
  const [ledgerData, setLedgerData] = useState<LedgerData>({ entries: [] });
  const [ledgerFilterMonth, setLedgerFilterMonth] = useState<string>('all');
  const [ledgerFilterCategory, setLedgerFilterCategory] = useState<LedgerCategory | 'all'>('all');
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [editingLedgerEntry, setEditingLedgerEntry] = useState<LedgerEntry | null>(null);
  const [ledgerFormDate, setLedgerFormDate] = useState('');
  const [ledgerFormDesc, setLedgerFormDesc] = useState('');
  const [ledgerFormType, setLedgerFormType] = useState<LedgerEntryType>('지출');
  const [ledgerFormAmount, setLedgerFormAmount] = useState('');
  const [ledgerFormCategory, setLedgerFormCategory] = useState<LedgerCategory>('기타지출');
  const [ledgerFormMemo, setLedgerFormMemo] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);

  // 예약 청구
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  // 알림 감지
  const [isListening, setIsListening] = useState(false);
  const [lastMatchLog, setLastMatchLog] = useState<NotificationMatchLog | null>(null);

  // 관리자/일반회원 이름 구분 (선수명 → 등급)
  const [playerAdminLevels, setPlayerAdminLevels] = useState<Record<string, number>>({});

  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => a.name.localeCompare(b.name)),
    [players]
  );

  // 관리자에 해당하는 선수 이름 + 등급 구하기
  useEffect(() => {
    const findAdminLevels = async () => {
      if (!clubCode) return;
      const clubInfo = getLocalClub(clubCode);
      if (!clubInfo) return;
      const memberNames = await getMemberNames(clubCode);
      const levels = await getAdminLevels(clubCode);
      const result: Record<string, number> = {};
      for (const adminEmail of clubInfo.adminEmails) {
        const emailLower = adminEmail.toLowerCase();
        const name = memberNames[emailLower];
        if (name) {
          result[name] = (levels[emailLower] as number) || 1;
        }
      }
      setPlayerAdminLevels(result);
    };
    findAdminLevels();
  }, [clubCode, players]);

  // 입금확인 연락처 (설정에서 지정, 복수 지원)
  const duesContactPhones: string[] = club?.settings?.duesContactPhones?.length
    ? club.settings.duesContactPhones
    : club?.settings?.duesContactPhone
      ? [club.settings.duesContactPhone]
      : [];

  const loadDues = useCallback(async () => {
    if (!clubCode) return;
    setIsLoading(true);
    await duesService.syncDuesMembers(clubCode, players.map((p) => p.name));
    // 예약 청구 자동 처리
    const { dues: processedDues, processed } = await duesService.processScheduledBillings(clubCode);
    if (processed.length > 0) {
      // 처리된 예약 청구의 가계부 자동 등록
      for (const sb of processed) {
        if (sb.ledgerCategory) {
          const newPeriod = processedDues.billingPeriods.find(p => p.name === sb.name && p.amount === sb.amount);
          if (newPeriod) {
            await ledgerService.addEntry(clubCode, {
              date: sb.date || new Date().toISOString().substring(0, 10),
              description: `${sb.name} (0/${sb.memberAmounts.length}명 입금)`,
              type: '수입',
              amount: 0,
              category: sb.ledgerCategory,
              billingPeriodId: newPeriod.id,
            });
          }
        }
      }
      const ledger = await ledgerService.getLedger(clubCode);
      setLedgerData(ledger);
      const msg = `예약 청구 ${processed.length}건이 자동 등록되었습니다.`;
      Platform.OS === 'web' ? alert(msg) : Alert.alert('예약 청구', msg);
    }
    const data = await duesService.getDues(clubCode);
    setDuesData(data);
    setIsLoading(false);
  }, [clubCode, players]);

  useEffect(() => {
    loadDues();
  }, [loadDues]);

  // 알림 감지 리스너
  useEffect(() => {
    if (!effectiveAdmin || !clubCode) return;
    const notifConfig = club?.settings?.notificationListener;
    if (!notifConfig?.enabled) return;
    if (!notifListener.isAvailable()) return;

    let active = true;

    const start = async () => {
      const hasPermission = await notifListener.checkPermission();
      if (!hasPermission || !active) return;

      setIsListening(true);
      await notifListener.startListening(
        clubCode,
        notifConfig.allowedPackages || notifListener.DEFAULT_PACKAGES,
        (log) => {
          if (!active) return;
          setLastMatchLog(log);
          if (log.success) {
            // 매칭 성공 시 데이터 새로고침
            loadDues();
          }
        }
      );
    };

    start();

    return () => {
      active = false;
      notifListener.stopListening();
      setIsListening(false);
    };
  }, [effectiveAdmin, clubCode, club?.settings?.notificationListener, loadDues]);

  // 확인요망 건수
  const pendingCount = useMemo(() => {
    let count = 0;
    for (const records of Object.values(duesData.payments)) {
      count += records.filter((r) => r.status === '확인요망').length;
    }
    return count;
  }, [duesData]);

  // 테이블에 표시할 선수 (전체 선수 - 비대상도 표시)
  const getPlayersForDisplay = useMemo(() => {
    return sortedPlayers;
  }, [sortedPlayers]);

  // ======== 청구 추가 ========
  const openAddModal = () => {
    setNewPeriodName('');
    setNewPeriodAmount('');
    setNewPeriodDate(new Date().toISOString().substring(0, 10));
    setNewPeriodCategory('회비');
    setUseDiffAmount(false);
    setLevelDiffConfigs({
      1: { mode: '직접입력', value: '' },
      2: { mode: '직접입력', value: '' },
      3: { mode: '직접입력', value: '' },
    });
    // 전체 선택
    const sel: Record<string, boolean> = {};
    sortedPlayers.forEach((p) => { sel[p.name] = true; });
    setSelectedMembers(sel);
    setMemberCustomAmounts({});
    setShowAddModal(true);
  };

  const toggleSelectAll = (val: boolean) => {
    const sel: Record<string, boolean> = {};
    sortedPlayers.forEach((p) => { sel[p.name] = val; });
    setSelectedMembers(sel);
  };

  const allSelected = sortedPlayers.length > 0 && sortedPlayers.every((p) => selectedMembers[p.name]);

  const handleAddBillingPeriod = async () => {
    if (!clubCode || !newPeriodName.trim()) return;

    const baseAmount = parseInt(newPeriodAmount, 10);
    if (isNaN(baseAmount) || baseAmount <= 0) {
      const msg = '올바른 금액을 입력하세요.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('알림', msg);
      return;
    }

    const selected = sortedPlayers.filter((p) => selectedMembers[p.name]);
    if (selected.length === 0) {
      const msg = '최소 한 명 이상 선택하세요.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('알림', msg);
      return;
    }

    const memberAmounts = selected.map((p) => {
      // 개별 금액이 있으면 우선
      const custom = memberCustomAmounts[p.name];
      if (custom) {
        const customAmt = parseInt(custom, 10);
        if (!isNaN(customAmt) && customAmt >= 0) return { playerName: p.name, amount: customAmt };
      }
      // 등급별 차등 금액
      if (useDiffAmount) {
        const lvl = playerAdminLevels[p.name];
        if (lvl && levelDiffConfigs[lvl]) {
          const amt = calcLevelAmount(baseAmount, levelDiffConfigs[lvl]);
          return { playerName: p.name, amount: amt };
        }
      }
      return { playerName: p.name, amount: baseAmount };
    });

    const updated = await duesService.addBillingPeriod(
      clubCode,
      { name: newPeriodName.trim(), amount: baseAmount, date: newPeriodDate || undefined, ledgerCategory: newPeriodCategory || undefined },
      memberAmounts
    );
    setDuesData(updated);

    // 카테고리가 선택되었으면 가계부에 자동 등록 (입금완료 금액 기준이므로 초기 0원)
    if (newPeriodCategory) {
      const newPeriod = updated.billingPeriods[updated.billingPeriods.length - 1];
      const ledgerUpdated = await ledgerService.addEntry(clubCode, {
        date: newPeriodDate || new Date().toISOString().substring(0, 10),
        description: `${newPeriodName.trim()} (0/${memberAmounts.length}명 입금)`,
        type: '수입',
        amount: 0,
        category: newPeriodCategory,
        billingPeriodId: newPeriod.id,
      });
      setLedgerData(ledgerUpdated);
    }

    setShowAddModal(false);
  };

  // ======== 예약 청구 ========
  const handleScheduleBilling = async () => {
    if (!clubCode || !newPeriodName.trim()) return;

    const baseAmount = parseInt(newPeriodAmount, 10);
    if (isNaN(baseAmount) || baseAmount <= 0) {
      const msg = '올바른 금액을 입력하세요.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('알림', msg);
      return;
    }
    if (!scheduleDate || !scheduleTime) {
      const msg = '예약 날짜와 시간을 입력하세요.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('알림', msg);
      return;
    }
    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}:00`);
    if (isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
      const msg = '예약 시간은 현재 시간 이후여야 합니다.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('알림', msg);
      return;
    }

    const selected = sortedPlayers.filter((p) => selectedMembers[p.name]);
    if (selected.length === 0) {
      const msg = '최소 한 명 이상 선택하세요.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('알림', msg);
      return;
    }

    const memberAmounts = selected.map((p) => {
      const custom = memberCustomAmounts[p.name];
      if (custom) {
        const customAmt = parseInt(custom, 10);
        if (!isNaN(customAmt) && customAmt >= 0) return { playerName: p.name, amount: customAmt };
      }
      if (useDiffAmount) {
        const lvl = playerAdminLevels[p.name];
        if (lvl && levelDiffConfigs[lvl]) {
          return { playerName: p.name, amount: calcLevelAmount(baseAmount, levelDiffConfigs[lvl]) };
        }
      }
      return { playerName: p.name, amount: baseAmount };
    });

    const updated = await duesService.addScheduledBilling(clubCode, {
      scheduledAt: scheduledAt.toISOString(),
      name: newPeriodName.trim(),
      amount: baseAmount,
      date: newPeriodDate || undefined,
      ledgerCategory: newPeriodCategory || undefined,
      memberAmounts,
    });
    setDuesData(updated);
    setShowAddModal(false);
    setShowScheduleModal(false);
    const msg = `${scheduleDate} ${scheduleTime}에 "${newPeriodName.trim()}" 청구가 예약되었습니다.`;
    Platform.OS === 'web' ? alert(msg) : Alert.alert('예약 완료', msg);
  };

  const handleDeleteScheduled = async (id: string) => {
    if (!clubCode) return;
    const updated = await duesService.deleteScheduledBilling(clubCode, id);
    setDuesData(updated);
  };

  // ======== 청구 수정 ========
  const openEditModal = (period: BillingPeriod) => {
    setEditingPeriod(period);
    setEditPeriodName(period.name);
    setEditPeriodAmount(period.amount.toString());

    // 현재 선수 상태 초기화
    const currentRecords = duesData?.payments[period.id] || [];
    const currentPlayerSet = new Set(currentRecords.map(r => r.playerName));
    const sel: Record<string, boolean> = {};
    const amounts: Record<string, string> = {};
    sortedPlayers.forEach(p => {
      sel[p.name] = currentPlayerSet.has(p.name);
    });
    currentRecords.forEach(r => {
      amounts[r.playerName] = r.amount.toString();
    });
    setEditSelectedMembers(sel);
    setEditMemberAmounts(amounts);
    setShowEditModal(true);
  };

  const editAllSelected = sortedPlayers.length > 0 && sortedPlayers.every(p => editSelectedMembers[p.name]);
  const editToggleSelectAll = (val: boolean) => {
    const sel: Record<string, boolean> = {};
    sortedPlayers.forEach(p => { sel[p.name] = val; });
    setEditSelectedMembers(sel);
  };

  const handleEditBillingPeriod = async () => {
    if (!clubCode || !editingPeriod || !editPeriodName.trim()) return;
    const amount = parseInt(editPeriodAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      const msg = '올바른 금액을 입력하세요.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('알림', msg);
      return;
    }
    // 1) 청구 이름/금액 업데이트
    let updated = await duesService.updateBillingPeriod(clubCode, editingPeriod.id, {
      name: editPeriodName.trim(),
      amount,
    });

    // 2) 선수 변경 처리
    const currentRecords = duesData?.payments[editingPeriod.id] || [];
    const currentPlayerSet = new Set(currentRecords.map(r => r.playerName));

    for (const player of sortedPlayers) {
      const wasIncluded = currentPlayerSet.has(player.name);
      const isNowIncluded = !!editSelectedMembers[player.name];

      if (!wasIncluded && isNowIncluded) {
        // 새로 추가
        const playerAmt = parseInt(editMemberAmounts[player.name], 10) || amount;
        updated = await duesService.addPaymentRecord(clubCode, editingPeriod.id, player.name, playerAmt);
      } else if (wasIncluded && !isNowIncluded) {
        // 제거
        updated = await duesService.removePaymentRecord(clubCode, editingPeriod.id, player.name);
      } else if (wasIncluded && isNowIncluded) {
        // 금액 변경 확인
        const oldRecord = currentRecords.find(r => r.playerName === player.name);
        const newAmt = parseInt(editMemberAmounts[player.name], 10) || amount;
        if (oldRecord && oldRecord.amount !== newAmt) {
          updated = await duesService.updatePaymentAmount(clubCode, editingPeriod.id, player.name, newAmt);
        }
      }
    }

    setDuesData(updated);
    setShowEditModal(false);
    setEditingPeriod(null);
  };

  // ======== 납부요청 SMS ========
  const initSmsChecked = (periodId: string) => {
    const records = duesData?.payments[periodId] || [];
    const checked: Record<string, boolean> = {};
    records.forEach(r => {
      if (r.status === '미납') {
        const player = sortedPlayers.find(p => p.name === r.playerName);
        checked[r.playerName] = !!player?.phone;
      }
    });
    setSmsChecked(checked);
  };

  const buildSmsBody = (periodId: string) => {
    const period = duesData?.billingPeriods?.find(p => p.id === periodId);
    return period ? `${period.name} ${period.amount.toLocaleString()}원 납부 부탁드립니다.` : '';
  };

  const openSmsModal = () => {
    const firstPeriod = duesData?.billingPeriods[0];
    if (!firstPeriod) return;
    setSmsPeriodId(firstPeriod.id);
    initSmsChecked(firstPeriod.id);
    setSmsBody(buildSmsBody(firstPeriod.id));
    setShowSmsModal(true);
  };

  const sendPaymentSms = () => {
    const period = duesData?.billingPeriods?.find(p => p.id === smsPeriodId);
    if (!period) return;
    const phones: string[] = [];
    Object.entries(smsChecked).forEach(([name, isChecked]) => {
      if (!isChecked) return;
      const player = sortedPlayers.find(p => p.name === name);
      if (player?.phone) phones.push(player.phone);
    });
    if (phones.length === 0) {
      const msg = '전화번호가 등록된 회원이 없습니다.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('알림', msg);
      return;
    }
    const body = smsBody || `${period.name} ${period.amount.toLocaleString()}원 납부 부탁드립니다.`;
    const sep = Platform.OS === 'ios' ? '&' : '?';
    Linking.openURL(`sms:${phones.join(',')}${sep}body=${encodeURIComponent(body)}`).catch(() => {});
    setShowSmsModal(false);
  };

  const smsAllChecked = Object.values(smsChecked).length > 0 && Object.values(smsChecked).every(v => v);
  const smsToggleAll = (val: boolean) => {
    const checked: Record<string, boolean> = {};
    const records = duesData?.payments[smsPeriodId] || [];
    records.forEach(r => {
      if (r.status === '미납') {
        const player = sortedPlayers.find(p => p.name === r.playerName);
        checked[r.playerName] = val && !!player?.phone;
      }
    });
    setSmsChecked(checked);
  };

  // ======== 삭제/상태변경 ========
  const handleDeletePeriod = (period: BillingPeriod) => {
    if (!clubCode) return;
    const msg = `"${period.name}" 청구를 삭제하시겠습니까?\n모든 납부 기록이 삭제됩니다.`;
    const doDelete = async () => {
      const updated = await duesService.deleteBillingPeriod(clubCode, period.id);
      setDuesData(updated);
      // 연동된 가계부 항목도 삭제
      if (period.ledgerCategory) {
        const ledgerUpdated = await ledgerService.deleteByBillingPeriod(clubCode, period.id);
        setLedgerData(ledgerUpdated);
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) doDelete();
    } else {
      Alert.alert('청구 삭제', msg, [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const handleStatusChange = async (periodId: string, playerName: string, newStatus: PaymentStatus) => {
    if (!clubCode) return;
    const updated = await duesService.updatePaymentStatus(clubCode, periodId, playerName, newStatus);
    setDuesData(updated);

    // 가계부 연동: 입금완료 합계로 금액 업데이트
    const period = updated.billingPeriods.find(p => p.id === periodId);
    if (period?.ledgerCategory) {
      const records = updated.payments[periodId] || [];
      const confirmedRecords = records.filter(r => r.status === '입금완료');
      const confirmedAmount = confirmedRecords.reduce((sum, r) => sum + (r.amount || period.amount), 0);
      const ledgerUpdated = await ledgerService.updateByBillingPeriod(clubCode, periodId, {
        amount: confirmedAmount,
        description: `${period.name} (${confirmedRecords.length}/${records.length}명 입금)`,
      });
      setLedgerData(ledgerUpdated);
    }
  };

  const handleRemoveRecord = async (periodId: string, playerName: string) => {
    if (!clubCode) return;
    const updated = await duesService.removePaymentRecord(clubCode, periodId, playerName);
    setDuesData(updated);
  };

  const handleEditAmount = (periodId: string, playerName: string, currentAmount: number) => {
    setEditRecordState({ periodId, playerName, amount: currentAmount.toString() });
  };

  const handleAddRecord = async (periodId: string, playerName: string, defaultAmount: number) => {
    if (!clubCode) return;
    const updated = await duesService.addPaymentRecord(clubCode, periodId, playerName, defaultAmount);
    setDuesData(updated);
  };

  const handleSaveEditAmount = async () => {
    if (!clubCode || !editRecordState) return;
    const newAmount = parseInt(editRecordState.amount, 10);
    if (isNaN(newAmount) || newAmount <= 0) {
      const msg = '올바른 금액을 입력하세요.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('알림', msg);
      return;
    }
    const updated = await duesService.updatePaymentAmount(
      clubCode, editRecordState.periodId, editRecordState.playerName, newAmount
    );
    setDuesData(updated);
    setEditRecordState(null);
  };

  // ======== 가계부 로드 & 핸들러 ========
  const loadLedger = useCallback(async () => {
    if (!clubCode) return;
    const data = await ledgerService.getLedger(clubCode);
    setLedgerData(data);
  }, [clubCode]);

  useEffect(() => {
    if (duesTab === 'settlement') loadLedger();
  }, [duesTab, loadLedger]);

  // 기본 + 커스텀 카테고리 병합 (커스텀은 기타수입/기타지출 앞에 삽입)
  const allLedgerCategories = useMemo(() => {
    const customs = (ledgerData.customCategories || []).map(c => ({
      label: c.label,
      value: c.label,
      type: c.type,
      icon: c.type === '수입' ? 'plus-circle' : 'minus-circle',
    }));
    const base = DEFAULT_LEDGER_CATEGORIES.filter(c => c.value !== '기타수입' && c.value !== '기타지출');
    const etcIncome = DEFAULT_LEDGER_CATEGORIES.find(c => c.value === '기타수입')!;
    const etcExpense = DEFAULT_LEDGER_CATEGORIES.find(c => c.value === '기타지출')!;
    return [...base, ...customs, etcIncome, etcExpense];
  }, [ledgerData.customCategories]);

  const incomeCategories = useMemo(() => allLedgerCategories.filter(c => c.type === '수입'), [allLedgerCategories]);
  const expenseCategories = useMemo(() => allLedgerCategories.filter(c => c.type === '지출'), [allLedgerCategories]);

  const ledgerMonthOptions = useMemo(() => {
    const months = new Set<string>();
    const years = new Set<string>();
    ledgerData.entries.forEach(e => {
      months.add(e.date.substring(0, 7));
      years.add(e.date.substring(0, 4));
    });
    const sortedYears = Array.from(years).sort().reverse();
    const sortedMonths = Array.from(months).sort().reverse();
    const options: { label: string; value: string }[] = [{ label: '전체', value: 'all' }];
    for (const year of sortedYears) {
      options.push({ label: `${year}년 전체`, value: year });
      for (const m of sortedMonths) {
        if (m.startsWith(year)) {
          options.push({ label: `  ${parseInt(m.substring(5, 7))}월`, value: m });
        }
      }
    }
    return options;
  }, [ledgerData.entries]);

  const filteredLedgerEntries = useMemo(() => {
    let entries = ledgerData.entries;
    if (ledgerFilterMonth !== 'all') entries = entries.filter(e => e.date.startsWith(ledgerFilterMonth));
    if (ledgerFilterCategory !== 'all') entries = entries.filter(e => e.category === ledgerFilterCategory);
    return entries;
  }, [ledgerData.entries, ledgerFilterMonth, ledgerFilterCategory]);

  const ledgerSummary = useMemo(() => {
    const totalIncome = filteredLedgerEntries.filter(e => e.type === '수입').reduce((s, e) => s + e.amount, 0);
    const totalExpense = filteredLedgerEntries.filter(e => e.type === '지출').reduce((s, e) => s + e.amount, 0);
    return { totalIncome, totalExpense, balance: totalIncome - totalExpense };
  }, [filteredLedgerEntries]);

  const overallBalance = useMemo(() => {
    return ledgerData.entries.reduce((bal, e) => e.type === '수입' ? bal + e.amount : bal - e.amount, 0);
  }, [ledgerData.entries]);

  const openAddLedgerModal = (type: LedgerEntryType) => {
    setEditingLedgerEntry(null);
    setLedgerFormDate(new Date().toISOString().substring(0, 10));
    setLedgerFormDesc('');
    setLedgerFormType(type);
    setLedgerFormAmount('');
    setLedgerFormCategory(type === '수입' ? '회비' : '코트비');
    setLedgerFormMemo('');
    setShowNewCategoryInput(false);
    setShowLedgerModal(true);
  };

  const openEditLedgerModal = (entry: LedgerEntry) => {
    setEditingLedgerEntry(entry);
    setLedgerFormDate(entry.date);
    setLedgerFormDesc(entry.description);
    setLedgerFormType(entry.type);
    setLedgerFormAmount(entry.amount.toString());
    setLedgerFormCategory(entry.category);
    setLedgerFormMemo(entry.memo || '');
    setShowNewCategoryInput(false);
    setShowLedgerModal(true);
  };

  const handleSaveLedgerEntry = async () => {
    if (!clubCode) return;
    if (!ledgerFormDesc.trim()) {
      const msg = '항목 설명을 입력하세요.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('알림', msg);
      return;
    }
    const amount = parseInt(ledgerFormAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      const msg = '올바른 금액을 입력하세요.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('알림', msg);
      return;
    }
    if (!ledgerFormDate) {
      const msg = '날짜를 입력하세요.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('알림', msg);
      return;
    }
    const payload = {
      date: ledgerFormDate,
      description: ledgerFormDesc.trim(),
      type: ledgerFormType,
      amount,
      category: ledgerFormCategory,
      memo: ledgerFormMemo.trim() || undefined,
    };
    let updated: LedgerData;
    if (editingLedgerEntry) {
      updated = await ledgerService.updateEntry(clubCode, editingLedgerEntry.id, payload);
    } else {
      updated = await ledgerService.addEntry(clubCode, payload);
    }
    setLedgerData(updated);
    setShowLedgerModal(false);
  };

  const handleDeleteLedgerEntry = (entry: LedgerEntry) => {
    if (!clubCode) return;
    const msg = `"${entry.description}" 항목을 삭제하시겠습니까?`;
    const doDelete = async () => {
      const updated = await ledgerService.deleteEntry(clubCode, entry.id);
      setLedgerData(updated);
    };
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) doDelete();
    } else {
      Alert.alert('항목 삭제', msg, [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  // 회비납부 필터링
  const filteredBillingPeriods = useMemo(() => {
    let periods = duesData.billingPeriods;
    if (paymentFilter === 'dues') {
      periods = periods.filter(p => p.ledgerCategory === '회비');
    } else if (paymentFilter === 'other') {
      periods = periods.filter(p => p.ledgerCategory !== '회비');
    }
    if (paymentPeriodFilter !== 'all') {
      periods = periods.filter(p => p.date && p.date.startsWith(paymentPeriodFilter));
    }
    return periods;
  }, [duesData.billingPeriods, paymentFilter, paymentPeriodFilter]);

  // 회비납부 연/월 필터 옵션
  const paymentPeriodOptions = useMemo(() => {
    const months = new Set<string>();
    const years = new Set<string>();
    duesData.billingPeriods.forEach(p => {
      if (p.date) {
        months.add(p.date.substring(0, 7));
        years.add(p.date.substring(0, 4));
      }
    });
    const sortedYears = Array.from(years).sort().reverse();
    const sortedMonths = Array.from(months).sort().reverse();
    const opts: { label: string; value: string }[] = [{ label: '전체', value: 'all' }];
    for (const year of sortedYears) {
      opts.push({ label: `${year}년`, value: year });
      for (const m of sortedMonths) {
        if (m.startsWith(year)) {
          opts.push({ label: `  ${parseInt(m.substring(5, 7))}월`, value: m });
        }
      }
    }
    return opts;
  }, [duesData.billingPeriods]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>로딩 중...</Text>
      </View>
    );
  }

  const displayPlayers = getPlayersForDisplay;

  return (
    <View style={styles.outerContainer}>
      {/* 서브탭 헤더 */}
      <View style={styles.subTabHeader}>
        <View style={{ maxWidth: MAX_WIDTH, width: '100%', alignSelf: 'center' }}>
          <SegmentedTabs
            tabs={[
              { key: 'payment', label: '회비납부' },
              { key: 'status', label: '납부현황' },
              { key: 'settlement', label: '회비정산' },
            ].filter((t) => !isSectionRestricted(`dues.${t.key}`))}
            activeKey={duesTab}
            onTabPress={(key) => setDuesTab(key as 'payment' | 'status' | 'settlement')}
          />
        </View>
      </View>

      {/* 납부현황 탭 */}
      {duesTab === 'status' && (
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.inner}>
            {/* 기간 필터 */}
            <View style={styles.paymentFilterRow}>
              <View style={styles.paymentFilterInner}>
                <View style={styles.paymentFilterTabs}>
                  {([['all', '전체'], ['dues', '회비'], ['other', '그외']] as const).map(([key, label]) => (
                    <TouchableOpacity
                      key={key}
                      style={[styles.paymentFilterTab, paymentFilter === key && styles.paymentFilterTabActive]}
                      onPress={() => setPaymentFilter(key)}
                    >
                      <Text style={[styles.paymentFilterTabText, paymentFilter === key && styles.paymentFilterTabTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.paymentFilterInner}>
                <Select
                  value={paymentPeriodFilter}
                  onChange={(v) => setPaymentPeriodFilter(v as string)}
                  options={paymentPeriodOptions}
                  placeholder="기간"
                />
              </View>
            </View>

            {filteredBillingPeriods.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>해당 기간의 청구가 없습니다</Text>
              </View>
            ) : (
              filteredBillingPeriods.map(period => {
                const records = duesData.payments[period.id] || [];
                const total = records.length;
                const paid = records.filter(r => r.status === '입금완료').length;
                const pending = records.filter(r => r.status === '확인요망').length;
                const unpaid = records.filter(r => r.status === '미납').length;
                const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
                const paidSum = records.filter(r => r.status === '입금완료').reduce((s, r) => s + (r.amount || 0), 0);
                const unpaidSum = records.filter(r => r.status !== '입금완료').reduce((s, r) => s + (r.amount || 0), 0);
                const totalSum = records.reduce((s, r) => s + (r.amount || 0), 0);

                return (
                  <View key={period.id} style={styles.statusCard}>
                    <View style={styles.statusCardHeader}>
                      <Text style={styles.statusCardTitle}>{period.name}</Text>
                      <Text style={styles.statusCardDate}>{period.date || ''}</Text>
                    </View>

                    {/* 진행바 */}
                    <View style={styles.statusBarBg}>
                      <View style={[styles.statusBarFill, { width: `${pct}%` }]} />
                    </View>
                    <Text style={styles.statusBarLabel}>{paid}/{total}명 입금 ({pct}%)</Text>

                    {/* 상태 요약 */}
                    <View style={styles.statusSummaryRow}>
                      <View style={[styles.statusSummaryItem, { backgroundColor: colors.paidBg }]}>
                        <Text style={[styles.statusSummaryNum, { color: colors.paid }]}>{paid}</Text>
                        <Text style={styles.statusSummaryLabel}>입금완료</Text>
                      </View>
                      <View style={[styles.statusSummaryItem, { backgroundColor: colors.pendingBg }]}>
                        <Text style={[styles.statusSummaryNum, { color: colors.pending }]}>{pending}</Text>
                        <Text style={styles.statusSummaryLabel}>확인요망</Text>
                      </View>
                      <View style={[styles.statusSummaryItem, { backgroundColor: colors.unpaidBg }]}>
                        <Text style={[styles.statusSummaryNum, { color: colors.unpaid }]}>{unpaid}</Text>
                        <Text style={styles.statusSummaryLabel}>미납</Text>
                      </View>
                    </View>

                    {/* 금액 요약 */}
                    <View style={styles.statusAmountRow}>
                      <View style={styles.statusAmountItem}>
                        <Text style={styles.statusAmountLabel}>납부</Text>
                        <Text style={[styles.statusAmountValue, { color: colors.paid }]}>{paidSum.toLocaleString()}원</Text>
                      </View>
                      <View style={styles.statusAmountItem}>
                        <Text style={styles.statusAmountLabel}>미납</Text>
                        <Text style={[styles.statusAmountValue, { color: colors.unpaid }]}>{unpaidSum.toLocaleString()}원</Text>
                      </View>
                      <View style={styles.statusAmountItem}>
                        <Text style={styles.statusAmountLabel}>총액</Text>
                        <Text style={[styles.statusAmountValue, { fontWeight: '700' }]}>{totalSum.toLocaleString()}원</Text>
                      </View>
                    </View>

                    {/* 미납자 목록 */}
                    {unpaid > 0 && (
                      <View style={styles.statusUnpaidList}>
                        <Text style={styles.statusUnpaidTitle}>미납자</Text>
                        <Text style={styles.statusUnpaidNames}>
                          {records.filter(r => r.status === '미납').map(r => dn(r.playerName)).join(', ')}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
          <Footer />
        </ScrollView>
      )}

      {/* 회비정산 탭 */}
      {duesTab === 'settlement' && (<>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.inner}>

            {/* 정산 요약 */}
            <Card title="정산 요약">
              <View style={ls.summaryGrid}>
                <View style={ls.summaryBox}>
                  <Text style={ls.summaryLabel}>총 수입</Text>
                  <Text style={[ls.summaryValue, { color: colors.paid }]}>
                    {ledgerSummary.totalIncome.toLocaleString()}원
                  </Text>
                </View>
                <View style={ls.summaryBox}>
                  <Text style={ls.summaryLabel}>총 지출</Text>
                  <Text style={[ls.summaryValue, { color: colors.unpaid }]}>
                    {ledgerSummary.totalExpense.toLocaleString()}원
                  </Text>
                </View>
                <View style={[ls.summaryBox, ls.balanceBox]}>
                  <Text style={ls.summaryLabel}>잔액</Text>
                  <Text style={[ls.summaryValue, { color: ledgerSummary.balance >= 0 ? colors.primary : colors.error }]}>
                    {ledgerSummary.balance.toLocaleString()}원
                  </Text>
                </View>
              </View>
              {ledgerFilterMonth !== 'all' && (
                <View style={ls.overallRow}>
                  <Text style={ls.overallLabel}>전체 누적 잔액: </Text>
                  <Text style={[ls.overallValue, { color: overallBalance >= 0 ? colors.paid : colors.unpaid }]}>
                    {overallBalance.toLocaleString()}원
                  </Text>
                </View>
              )}
            </Card>

            {/* 필터 & 추가 버튼 */}
            <View style={ls.filterRow}>
              <View style={{ flex: 1, marginRight: spacing.sm }}>
                <Select
                  value={ledgerFilterMonth}
                  onChange={(v) => setLedgerFilterMonth(v as string)}
                  options={ledgerMonthOptions}
                  placeholder="월 선택"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Select
                  value={ledgerFilterCategory}
                  onChange={(v) => setLedgerFilterCategory(v as LedgerCategory | 'all')}
                  options={[{ label: '전체 카테고리', value: 'all' }, ...allLedgerCategories.map(c => ({ label: c.label, value: c.value }))]}
                  placeholder="카테고리"
                />
              </View>
            </View>

            {effectiveAdmin && (
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: spacing.sm }}>
                <Button title="+ 수입 추가" onPress={() => openAddLedgerModal('수입')} variant="primary" size="small" />
                <Button title="+ 지출 추가" onPress={() => openAddLedgerModal('지출')} variant="outline" size="small" />
              </View>
            )}

            {/* 가계부 테이블 */}
            <Card>
              <View style={ls.tableHeader}>
                <Text style={[ls.headerText, ls.colDate]}>날짜</Text>
                <Text style={[ls.headerText, ls.colCategory]}>분류</Text>
                <Text style={[ls.headerText, ls.colDesc]}>항목</Text>
                <Text style={[ls.headerText, ls.colAmount]}>수입</Text>
                <Text style={[ls.headerText, ls.colAmount]}>지출</Text>
                <Text style={[ls.headerText, ls.colBalance]}>잔액</Text>
              </View>

              {filteredLedgerEntries.length === 0 ? (
                <View style={styles.emptyState}>
                  <FontAwesome name="book" size={40} color={colors.textTertiary} />
                  <Text style={styles.emptyText}>
                    {effectiveAdmin ? '항목을 추가하세요' : '등록된 항목이 없습니다'}
                  </Text>
                </View>
              ) : (
                (() => {
                  const chrono = [...filteredLedgerEntries].reverse();
                  let runBal = 0;
                  if (ledgerFilterMonth !== 'all') {
                    const all = [...ledgerData.entries].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
                    for (const e of all) {
                      if (e.date.substring(0, 7) >= ledgerFilterMonth) break;
                      runBal += e.type === '수입' ? e.amount : -e.amount;
                    }
                  }
                  const balMap: Record<string, number> = {};
                  for (const e of chrono) {
                    runBal += e.type === '수입' ? e.amount : -e.amount;
                    balMap[e.id] = runBal;
                  }
                  return filteredLedgerEntries.map((entry, idx) => (
                    <TouchableOpacity
                      key={entry.id}
                      style={[ls.tableRow, idx % 2 === 0 && { backgroundColor: colors.bg }]}
                      onPress={() => effectiveAdmin && openEditLedgerModal(entry)}
                      onLongPress={() => effectiveAdmin && handleDeleteLedgerEntry(entry)}
                      activeOpacity={effectiveAdmin ? 0.6 : 1}
                      disabled={!effectiveAdmin}
                    >
                      <View style={ls.colDate}>
                        <Text style={ls.dateText}>{entry.date.substring(5).replace('-', '/')}</Text>
                      </View>
                      <View style={ls.colCategory}>
                        <Text style={ls.categoryText} numberOfLines={1}>{entry.category}</Text>
                      </View>
                      <View style={ls.colDesc}>
                        <Text style={ls.descText} numberOfLines={1}>{entry.description}</Text>
                        {entry.memo ? <Text style={ls.memoText} numberOfLines={1}>{entry.memo}</Text> : null}
                      </View>
                      <View style={ls.colAmount}>
                        <Text style={[ls.amountText, { color: colors.paid }]}>
                          {entry.type === '수입' ? entry.amount.toLocaleString() : ''}
                        </Text>
                      </View>
                      <View style={ls.colAmount}>
                        <Text style={[ls.amountText, { color: colors.unpaid }]}>
                          {entry.type === '지출' ? entry.amount.toLocaleString() : ''}
                        </Text>
                      </View>
                      <View style={ls.colBalance}>
                        <Text style={[ls.balanceText, { color: (balMap[entry.id] ?? 0) >= 0 ? colors.text : colors.error }]}>
                          {(balMap[entry.id] ?? 0).toLocaleString()}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ));
                })()
              )}
            </Card>

          </View>
          <Footer />
        </ScrollView>

        {/* 가계부 항목 추가/수정 모달 */}
        <Modal
          visible={showLedgerModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowLedgerModal(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalInner}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowLedgerModal(false)}>
                  <Text style={styles.modalCancel}>취소</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>{editingLedgerEntry ? '항목 수정' : `${ledgerFormType} 항목 추가`}</Text>
                <TouchableOpacity onPress={handleSaveLedgerEntry}>
                  <Text style={styles.modalSave}>{editingLedgerEntry ? '저장' : '추가'}</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalContent}>
                <View style={[styles.paymentFilterTabs, { alignSelf: 'flex-start', marginBottom: spacing.sm }]}>
                  <View style={[styles.paymentFilterTab, ledgerFormType === '수입' ? styles.paymentFilterTabActive : {}]}>
                    <Text style={[styles.paymentFilterTabText, ledgerFormType === '수입' ? styles.paymentFilterTabTextActive : {}]}>수입</Text>
                  </View>
                  <View style={[styles.paymentFilterTab, ledgerFormType === '지출' ? styles.paymentFilterTabActive : {}]}>
                    <Text style={[styles.paymentFilterTabText, ledgerFormType === '지출' ? styles.paymentFilterTabTextActive : {}]}>지출</Text>
                  </View>
                </View>

                <Text style={styles.inputLabel}>날짜</Text>
                <TextInput
                  style={styles.input}
                  value={ledgerFormDate}
                  onChangeText={setLedgerFormDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textTertiary}
                />

                <Text style={styles.inputLabel}>카테고리</Text>
                <Select
                  value={ledgerFormCategory}
                  onChange={(v) => setLedgerFormCategory(v as LedgerCategory)}
                  options={(ledgerFormType === '수입' ? incomeCategories : expenseCategories).map(c => ({ label: c.label, value: c.value }))}
                />
                {!showNewCategoryInput ? (
                  <TouchableOpacity style={ls.addCategoryBtn} onPress={() => { setShowNewCategoryInput(true); setNewCategoryName(''); }}>
                    <FontAwesome name="plus" size={10} color={colors.primary} />
                    <Text style={ls.addCategoryBtnText}> 카테고리 추가</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={ls.newCategoryRow}>
                    <TextInput
                      style={[styles.input, { flex: 1, marginBottom: 0 }]}
                      value={newCategoryName}
                      onChangeText={setNewCategoryName}
                      placeholder="새 카테고리 이름"
                      placeholderTextColor={colors.textTertiary}
                    />
                    <TouchableOpacity
                      style={ls.newCategorySaveBtn}
                      onPress={async () => {
                        const name = newCategoryName.trim();
                        if (!name) return;
                        if (allLedgerCategories.some(c => c.value === name)) {
                          const msg = '이미 존재하는 카테고리입니다.';
                          Platform.OS === 'web' ? alert(msg) : Alert.alert('알림', msg);
                          return;
                        }
                        if (!clubCode) return;
                        const customs = [...(ledgerData.customCategories || []), { label: name, type: ledgerFormType }];
                        const updated = await ledgerService.updateCustomCategories(clubCode, customs);
                        setLedgerData(updated);
                        setLedgerFormCategory(name);
                        setNewCategoryName('');
                        setShowNewCategoryInput(false);
                      }}
                    >
                      <Text style={ls.newCategorySaveBtnText}>추가</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={ls.newCategoryCancelBtn} onPress={() => setShowNewCategoryInput(false)}>
                      <Text style={ls.newCategoryCancelBtnText}>취소</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <Text style={styles.inputLabel}>항목</Text>
                <TextInput
                  style={styles.input}
                  value={ledgerFormDesc}
                  onChangeText={setLedgerFormDesc}
                  placeholder="예: 1월 코트 대여비"
                  placeholderTextColor={colors.textTertiary}
                />

                <Text style={styles.inputLabel}>금액 (원)</Text>
                <TextInput
                  style={styles.input}
                  value={ledgerFormAmount}
                  onChangeText={setLedgerFormAmount}
                  placeholder="금액 입력"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                />

                <Text style={styles.inputLabel}>{(ledgerFormCategory === '기타수입' || ledgerFormCategory === '기타지출') ? '주석 (어떤 항목인지 입력)' : '메모 (선택)'}</Text>
                <TextInput
                  style={[styles.input, { minHeight: 60 }]}
                  value={ledgerFormMemo}
                  onChangeText={setLedgerFormMemo}
                  placeholder={(ledgerFormCategory === '기타수입' || ledgerFormCategory === '기타지출') ? '예: 대회 상금, 중고라켓 판매 등' : '메모 입력'}
                  placeholderTextColor={colors.textTertiary}
                  multiline
                />

                {editingLedgerEntry && (
                  <TouchableOpacity
                    style={ls.deleteBtn}
                    onPress={() => {
                      handleDeleteLedgerEntry(editingLedgerEntry);
                      setShowLedgerModal(false);
                    }}
                  >
                    <FontAwesome name="trash" size={14} color={colors.error} />
                    <Text style={ls.deleteBtnText}> 이 항목 삭제</Text>
                  </TouchableOpacity>
                )}
                <View style={{ height: 40 }} />
              </ScrollView>
            </View>
          </View>
        </Modal>
      </>)}

      {/* 회비납부 탭 */}
      {duesTab === 'payment' && (<>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.inner}>
          {/* 관리자 알림바 */}
          {effectiveAdmin && pendingCount > 0 && (
            <View style={styles.alertBar}>
              <FontAwesome name="exclamation-circle" size={16} color={colors.warning} />
              <Text style={styles.alertText}> 확인요망 {pendingCount}건</Text>
            </View>
          )}

          {/* 알림 감지 인디케이터 */}
          {effectiveAdmin && isListening && (
            <View style={styles.notifBar}>
              <FontAwesome name="bell" size={13} color={colors.primary} />
              <Text style={styles.notifBarText}> 알림 감지 중</Text>
              {lastMatchLog && (
                <Text style={styles.notifBarDetail} numberOfLines={1}>
                  {lastMatchLog.success
                    ? ` · ${lastMatchLog.matchedPlayer} ${lastMatchLog.parsedAmount?.toLocaleString()}원 자동 확인`
                    : lastMatchLog.parsedName
                      ? ` · ${lastMatchLog.parsedName} 매칭 실패`
                      : ''}
                </Text>
              )}
            </View>
          )}

          {/* 관리자 청구 추가 버튼 */}
          {effectiveAdmin && (
            <View style={styles.topActions}>
              <Button
                title="+ 청구 추가"
                onPress={openAddModal}
                variant="primary"
                size="small"
              />
              {duesData.billingPeriods.length > 0 && (
                <Button
                  title="📩 납부요청"
                  onPress={openSmsModal}
                  variant="outline"
                  size="small"
                />
              )}
            </View>
          )}

          {/* 예약 청구 목록 */}
          {effectiveAdmin && (duesData.scheduledBillings || []).length > 0 && (
            <View style={styles.scheduledSection}>
              <Text style={styles.scheduledTitle}>예약된 청구</Text>
              {(duesData.scheduledBillings || []).map(sb => {
                const dt = new Date(sb.scheduledAt);
                const label = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
                return (
                  <View key={sb.id} style={styles.scheduledRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.scheduledName}>{sb.name} ({sb.memberAmounts.length}명)</Text>
                      <Text style={styles.scheduledInfo}>{label} 자동 등록 | {sb.amount.toLocaleString()}원</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        const doDelete = () => handleDeleteScheduled(sb.id);
                        if (Platform.OS === 'web') {
                          if (window.confirm('이 예약 청구를 취소하시겠습니까?')) doDelete();
                        } else {
                          Alert.alert('예약 취소', '이 예약 청구를 취소하시겠습니까?', [
                            { text: '아니오', style: 'cancel' },
                            { text: '예', style: 'destructive', onPress: doDelete },
                          ]);
                        }
                      }}
                    >
                      <FontAwesome name="times-circle" size={20} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}

          {/* 필터 */}
          <View style={styles.paymentFilterRow}>
            <View style={styles.paymentFilterTabs}>
              {([['all', '전체'], ['dues', '회비'], ['other', '그외']] as const).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.paymentFilterTab, paymentFilter === key && styles.paymentFilterTabActive]}
                  onPress={() => setPaymentFilter(key)}
                >
                  <Text style={[styles.paymentFilterTabText, paymentFilter === key && styles.paymentFilterTabTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flex: 1, maxWidth: 120 }}>
              <Select
                value={paymentPeriodFilter}
                onChange={(v) => setPaymentPeriodFilter(v as string)}
                options={paymentPeriodOptions}
                placeholder="기간"
              />
            </View>
          </View>

          {/* 테이블 */}
          {filteredBillingPeriods.length === 0 ? (
            <View style={styles.emptyState}>
              <FontAwesome name="money" size={40} color={colors.textTertiary} />
              <Text style={styles.emptyText}>
                {duesData.billingPeriods.length === 0
                  ? (effectiveAdmin ? '청구를 추가하세요' : '등록된 청구가 없습니다')
                  : '해당 조건의 청구가 없습니다'}
              </Text>
            </View>
          ) : (
            <View style={styles.tableWrapper}>
              {/* 고정 이름 컬럼 */}
              <View style={styles.fixedColumn}>
                <View style={styles.nameHeaderCell}>
                  <Text style={styles.nameHeaderText}>이름</Text>
                </View>
                {displayPlayers.map((player, index) => (
                  <View
                    key={player.name}
                    style={[styles.nameCell, index % 2 === 0 && styles.rowEven]}
                  >
                    <Text style={styles.nameCellText} numberOfLines={1}>
                      {dn(player.name)}
                    </Text>
                  </View>
                ))}
                <View style={styles.summaryLabelCell}>
                  <Text style={[styles.summaryLabelText, { color: colors.paid }]}>납부</Text>
                </View>
                <View style={styles.summaryLabelCell}>
                  <Text style={[styles.summaryLabelText, { color: colors.unpaid }]}>미납</Text>
                </View>
                <View style={styles.summaryLabelCell}>
                  <Text style={[styles.summaryLabelText, { color: colors.text }]}>총액</Text>
                </View>
              </View>

              {/* 스크롤 가능한 청구 컬럼들 */}
              <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                <View>
                  {/* 헤더 */}
                  <View style={styles.periodHeaderRow}>
                    {filteredBillingPeriods.map((period) => {
                      const records = duesData.payments[period.id] || [];
                      const total = records.length;
                      const paid = records.filter(r => r.status === '입금완료').length;
                      const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
                      return (
                        <TouchableOpacity
                          key={period.id}
                          style={styles.periodHeaderCell}
                          onPress={() => effectiveAdmin && openEditModal(period)}
                          onLongPress={() => effectiveAdmin && handleDeletePeriod(period)}
                          activeOpacity={effectiveAdmin ? 0.6 : 1}
                        >
                          <Text style={styles.periodName} numberOfLines={1}>
                            {period.name}
                          </Text>
                          <Text style={styles.periodAmount}>
                            {period.amount.toLocaleString()}원
                          </Text>
                          <Text style={[styles.periodPct, { color: pct === 100 ? colors.paid : pct > 0 ? colors.pending : colors.unpaid }]}>
                            {paid}/{total} ({pct}%)
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* 데이터 행 */}
                  {displayPlayers.map((player, rowIndex) => (
                    <View
                      key={player.name}
                      style={[styles.dataRow, rowIndex % 2 === 0 && styles.rowEven]}
                    >
                      {filteredBillingPeriods.map((period) => {
                        const record = duesData.payments[period.id]?.find(
                          (r) => r.playerName === player.name
                        );
                        if (!record) {
                          return (
                            <View key={period.id} style={styles.statusCell}>
                              <View style={[styles.badge, styles.badgeNA]}>
                                <Text style={styles.badgeNAText}>-</Text>
                              </View>
                            </View>
                          );
                        }
                        return (
                          <View key={period.id} style={styles.statusCell}>
                            <StatusBadge
                              status={record.status}
                              isAdmin={effectiveAdmin}
                              bankAccount={bankAccount}
                              amount={record.amount}
                              playerName={player.name}
                              periodId={period.id}
                              periodName={period.name}
                              contactPhones={duesContactPhones}
                              clubName={club?.name || ''}
                              onStatusChange={handleStatusChange}
                              onRemove={effectiveAdmin ? handleRemoveRecord : undefined}
                              onEditAmount={effectiveAdmin ? handleEditAmount : undefined}
                            />
                          </View>
                        );
                      })}
                    </View>
                  ))}

                  {/* 요약 행: 납부 */}
                  <View style={styles.summaryRow}>
                    {filteredBillingPeriods.map((period) => {
                      const records = duesData.payments[period.id] || [];
                      const paidSum = records
                        .filter((r) => r.status === '입금완료')
                        .reduce((sum, r) => sum + (r.amount || 0), 0);
                      return (
                        <View key={period.id} style={styles.summaryCell}>
                          <Text style={[styles.summaryValueText, { color: colors.paid }]}>
                            {paidSum.toLocaleString()}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                  {/* 요약 행: 미납 */}
                  <View style={styles.summaryRow}>
                    {filteredBillingPeriods.map((period) => {
                      const records = duesData.payments[period.id] || [];
                      const unpaidSum = records
                        .filter((r) => r.status !== '입금완료')
                        .reduce((sum, r) => sum + (r.amount || 0), 0);
                      return (
                        <View key={period.id} style={styles.summaryCell}>
                          <Text style={[styles.summaryValueText, { color: colors.unpaid }]}>
                            {unpaidSum.toLocaleString()}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                  {/* 요약 행: 총액 */}
                  <View style={styles.summaryRow}>
                    {filteredBillingPeriods.map((period) => {
                      const records = duesData.payments[period.id] || [];
                      const totalSum = records.reduce((sum, r) => sum + (r.amount || 0), 0);
                      return (
                        <View key={period.id} style={styles.summaryCell}>
                          <Text style={[styles.summaryValueText, { fontWeight: '700' }]}>
                            {totalSum.toLocaleString()}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </ScrollView>
            </View>
          )}
        </View>
        <Footer />
      </ScrollView>

      {/* ======== 청구 추가 모달 ======== */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalInner}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => { setShowAddModal(false); setShowScheduleModal(false); }}>
                <Text style={styles.modalCancel}>취소</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{showScheduleModal ? '예약 청구' : '청구 추가'}</Text>
              <TouchableOpacity onPress={showScheduleModal ? handleScheduleBilling : handleAddBillingPeriod}>
                <Text style={styles.modalSave}>{showScheduleModal ? '예약' : '추가'}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              <Text style={styles.inputLabel}>청구 이름</Text>
              <TextInput
                style={styles.input}
                value={newPeriodName}
                onChangeText={setNewPeriodName}
                placeholder="예: 1월 회비"
                placeholderTextColor={colors.textTertiary}
                autoFocus
              />

              <Text style={styles.inputLabel}>날짜</Text>
              <TextInput
                style={styles.input}
                value={newPeriodDate}
                onChangeText={setNewPeriodDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textTertiary}
              />

              <Text style={styles.inputLabel}>정산 카테고리</Text>
              <Select
                value={newPeriodCategory}
                onChange={(v) => setNewPeriodCategory(v as string)}
                options={[
                  { label: '연동 안함', value: '' },
                  ...[...allLedgerCategories].filter(c => c.type === '수입').sort((a, b) => a.label.localeCompare(b.label, 'ko')).map(c => ({ label: c.label, value: c.value })),
                ]}
              />

              <Text style={styles.inputLabel}>기본 금액 (원)</Text>
              <TextInput
                style={styles.input}
                value={newPeriodAmount}
                onChangeText={setNewPeriodAmount}
                placeholder="금액 입력"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
              />

              {/* 등급별 차등 금액 */}
              <View style={styles.diffToggleRow}>
                <Text style={styles.diffToggleLabel}>등급별 차등 금액</Text>
                <Switch
                  value={useDiffAmount}
                  onValueChange={setUseDiffAmount}
                  trackColor={{ false: colors.border, true: colors.primaryLight }}
                  thumbColor={useDiffAmount ? colors.primary : colors.bg}
                />
              </View>

              {useDiffAmount && (
                <View style={{ marginTop: 8 }}>
                  {[1, 2, 3].map(lvl => {
                    const config = levelDiffConfigs[lvl] || { mode: '직접입력' as DiffMode, value: '' };
                    const lvlName = club?.settings?.adminLevelNames?.[lvl] || DEFAULT_LEVEL_NAMES[lvl];
                    const base = parseInt(newPeriodAmount, 10) || 0;
                    const calcAmt = config.mode !== '직접입력' || config.value ? calcLevelAmount(base, config) : base;
                    return (
                      <View key={lvl} style={styles.levelDiffCard}>
                        <Text style={styles.levelDiffHeader}>Lv.{lvl} {lvlName}</Text>
                        <View style={styles.levelDiffRow}>
                          <View style={{ flex: 1 }}>
                            <Select
                              value={config.mode}
                              onChange={(v) => setLevelDiffConfigs(prev => ({
                                ...prev,
                                [lvl]: { mode: v as DiffMode, value: v === '면제' ? '' : prev[lvl]?.value || '' },
                              }))}
                              options={DIFF_MODE_OPTIONS}
                            />
                          </View>
                          {config.mode !== '면제' && (
                            <TextInput
                              style={[styles.input, { flex: 1, marginLeft: 8, marginTop: 0 }]}
                              value={config.value}
                              onChangeText={(v) => setLevelDiffConfigs(prev => ({
                                ...prev,
                                [lvl]: { ...prev[lvl], value: v },
                              }))}
                              placeholder={config.mode === '퍼센트할인' ? '할인율 (%)' : '금액 입력'}
                              placeholderTextColor={colors.textTertiary}
                              keyboardType="numeric"
                            />
                          )}
                        </View>
                        <Text style={styles.levelDiffResult}>
                          {config.mode === '면제' ? '→ 0원 (면제)' :
                           config.mode === '퍼센트할인' && config.value ? `→ ${calcAmt.toLocaleString()}원 (${config.value}% 할인)` :
                           config.mode === '직접입력' && config.value ? `→ ${calcAmt.toLocaleString()}원` :
                           `→ ${base.toLocaleString()}원 (기본금액)`}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* 대상 선택 */}
              <View style={styles.memberSelectHeader}>
                <Text style={styles.inputLabel}>대상 선택</Text>
                <TouchableOpacity onPress={() => toggleSelectAll(!allSelected)}>
                  <Text style={styles.selectAllBtn}>{allSelected ? '전체 해제' : '전체 선택'}</Text>
                </TouchableOpacity>
              </View>

              {sortedPlayers.map((player) => {
                const playerLvl = playerAdminLevels[player.name];
                const customAmt = memberCustomAmounts[player.name] || '';
                const base = parseInt(newPeriodAmount, 10) || 0;
                const lvlAmt = useDiffAmount && playerLvl && levelDiffConfigs[playerLvl]
                  ? calcLevelAmount(base, levelDiffConfigs[playerLvl])
                  : base;
                return (
                  <View key={player.name} style={styles.memberRow}>
                    <TouchableOpacity
                      style={styles.memberCheckRow}
                      onPress={() => setSelectedMembers((prev) => ({ ...prev, [player.name]: !prev[player.name] }))}
                    >
                      <FontAwesome
                        name={selectedMembers[player.name] ? 'check-square' : 'square-o'}
                        size={18}
                        color={selectedMembers[player.name] ? colors.primary : colors.textTertiary}
                      />
                      <Text style={styles.memberName}>{dn(player.name)}</Text>
                      {playerLvl && (
                        <View style={styles.adminBadge}>
                          <Text style={styles.adminBadgeText}>Lv.{playerLvl}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                    {selectedMembers[player.name] && (
                      <TextInput
                        style={styles.memberAmountInput}
                        value={customAmt}
                        onChangeText={(v) => setMemberCustomAmounts((prev) => ({ ...prev, [player.name]: v }))}
                        placeholder={lvlAmt.toLocaleString() || '0'}
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="numeric"
                      />
                    )}
                  </View>
                );
              })}
              {/* 예약 모드 전환 */}
              {showScheduleModal ? (
                <View style={styles.scheduleInputSection}>
                  <Text style={styles.inputLabel}>예약 날짜</Text>
                  <TextInput
                    style={styles.input}
                    value={scheduleDate}
                    onChangeText={setScheduleDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textTertiary}
                  />
                  <Text style={styles.inputLabel}>예약 시간</Text>
                  <TextInput
                    style={styles.input}
                    value={scheduleTime}
                    onChangeText={setScheduleTime}
                    placeholder="HH:MM (예: 09:00)"
                    placeholderTextColor={colors.textTertiary}
                  />
                  <TouchableOpacity
                    style={styles.scheduleToggleBtn}
                    onPress={() => setShowScheduleModal(false)}
                  >
                    <Text style={styles.scheduleToggleText}>즉시 추가로 전환</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.scheduleToggleBtn}
                  onPress={() => {
                    setShowScheduleModal(true);
                    if (!scheduleDate) {
                      const tomorrow = new Date();
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      setScheduleDate(tomorrow.toISOString().substring(0, 10));
                    }
                    if (!scheduleTime) setScheduleTime('09:00');
                  }}
                >
                  <FontAwesome name="clock-o" size={14} color={colors.primary} />
                  <Text style={styles.scheduleToggleText}> 예약 청구로 전환</Text>
                </TouchableOpacity>
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ======== 청구 수정 모달 ======== */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalInner}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Text style={styles.modalCancel}>취소</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>청구 수정</Text>
              <TouchableOpacity onPress={handleEditBillingPeriod}>
                <Text style={styles.modalSave}>저장</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
              <Text style={styles.inputLabel}>청구 이름</Text>
              <TextInput
                style={styles.input}
                value={editPeriodName}
                onChangeText={setEditPeriodName}
                placeholder="예: 1월 회비"
                placeholderTextColor={colors.textTertiary}
              />
              <Text style={styles.inputLabel}>금액 (원)</Text>
              <TextInput
                style={styles.input}
                value={editPeriodAmount}
                onChangeText={setEditPeriodAmount}
                placeholder="금액 입력"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
              />

              {/* 대상 선수 */}
              <View style={styles.memberSelectHeader}>
                <Text style={styles.inputLabel}>👤 대상 선수</Text>
                <TouchableOpacity onPress={() => editToggleSelectAll(!editAllSelected)}>
                  <Text style={styles.selectAllBtn}>{editAllSelected ? '전체 해제' : '전체 선택'}</Text>
                </TouchableOpacity>
              </View>

              {sortedPlayers.map((player) => {
                const playerLvl = playerAdminLevels[player.name];
                const existingAmt = editMemberAmounts[player.name] || '';
                return (
                  <View key={player.name} style={styles.memberRow}>
                    <TouchableOpacity
                      style={styles.memberCheckRow}
                      onPress={() => setEditSelectedMembers((prev) => ({ ...prev, [player.name]: !prev[player.name] }))}
                    >
                      <FontAwesome
                        name={editSelectedMembers[player.name] ? 'check-square' : 'square-o'}
                        size={18}
                        color={editSelectedMembers[player.name] ? colors.primary : colors.textTertiary}
                      />
                      <Text style={styles.memberName}>{dn(player.name)}</Text>
                      {playerLvl && (
                        <View style={styles.adminBadge}>
                          <Text style={styles.adminBadgeText}>Lv.{playerLvl}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                    {editSelectedMembers[player.name] && (
                      <TextInput
                        style={styles.memberAmountInput}
                        value={existingAmt}
                        onChangeText={(v) => setEditMemberAmounts((prev) => ({ ...prev, [player.name]: v }))}
                        placeholder={editPeriodAmount || '0'}
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="numeric"
                      />
                    )}
                  </View>
                );
              })}

              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => {
                  if (editingPeriod) {
                    handleDeletePeriod(editingPeriod);
                    setShowEditModal(false);
                    setEditingPeriod(null);
                  }
                }}
              >
                <FontAwesome name="trash" size={14} color={colors.error} />
                <Text style={styles.deleteBtnText}> 이 청구 삭제</Text>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ======== 개별 금액 수정 모달 ======== */}
      <Modal
        visible={!!editRecordState}
        animationType="fade"
        transparent
        onRequestClose={() => setEditRecordState(null)}
      >
        <View style={styles.editOverlay}>
          <View style={styles.editBox}>
            <Text style={styles.editBoxTitle}>
              {editRecordState?.playerName ? dn(editRecordState.playerName) : ''} 금액 수정
            </Text>
            <TextInput
              style={styles.input}
              value={editRecordState?.amount || ''}
              onChangeText={(v) =>
                setEditRecordState((prev) => prev ? { ...prev, amount: v } : null)
              }
              keyboardType="numeric"
              autoFocus
              selectTextOnFocus
            />
            <View style={styles.editBoxBtns}>
              <TouchableOpacity
                style={styles.editBoxCancelBtn}
                onPress={() => setEditRecordState(null)}
              >
                <Text style={styles.editBoxCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.editBoxSaveBtn}
                onPress={handleSaveEditAmount}
              >
                <Text style={styles.editBoxSaveText}>저장</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======== 납부요청 SMS 모달 ======== */}
      <Modal
        visible={showSmsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSmsModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalInner}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowSmsModal(false)}>
                <Text style={styles.modalCancel}>취소</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>📩 납부요청</Text>
              <TouchableOpacity onPress={sendPaymentSms}>
                <Text style={styles.modalSave}>보내기</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
              <Text style={styles.inputLabel}>청구 선택</Text>
              <Select
                value={smsPeriodId}
                onChange={(v) => { setSmsPeriodId(v as string); initSmsChecked(v as string); setSmsBody(buildSmsBody(v as string)); }}
                options={(duesData?.billingPeriods || []).map(p => ({ label: `${p.name} (${p.amount.toLocaleString()}원)`, value: p.id }))}
              />

              <View style={styles.smsPreview}>
                <Text style={styles.smsPreviewLabel}>💬 메시지 미리보기 (수정 가능)</Text>
                <View style={styles.smsPreviewBox}>
                  <TextInput
                    style={[styles.smsPreviewText, { minHeight: 60, textAlignVertical: 'top' }]}
                    value={smsBody}
                    onChangeText={setSmsBody}
                    multiline
                    placeholder="메시지를 입력하세요"
                  />
                </View>
              </View>

              <View style={styles.memberSelectHeader}>
                <Text style={styles.inputLabel}>📱 발송 대상 (미납 회원)</Text>
                <TouchableOpacity onPress={() => smsToggleAll(!smsAllChecked)}>
                  <Text style={styles.selectAllBtn}>{smsAllChecked ? '전체 해제' : '전체 선택'}</Text>
                </TouchableOpacity>
              </View>

              {(() => {
                const records = duesData?.payments[smsPeriodId] || [];
                const unpaid = records.filter(r => r.status === '미납');
                if (unpaid.length === 0) {
                  return <Text style={{ color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.lg }}>미납 회원이 없습니다.</Text>;
                }
                return unpaid.map(r => {
                  const player = sortedPlayers.find(p => p.name === r.playerName);
                  const hasPhone = !!player?.phone;
                  return (
                    <View key={r.playerName} style={styles.memberRow}>
                      <TouchableOpacity
                        style={styles.memberCheckRow}
                        onPress={() => hasPhone && setSmsChecked(prev => ({ ...prev, [r.playerName]: !prev[r.playerName] }))}
                        disabled={!hasPhone}
                      >
                        <FontAwesome
                          name={smsChecked[r.playerName] ? 'check-square' : 'square-o'}
                          size={18}
                          color={!hasPhone ? colors.textTertiary : smsChecked[r.playerName] ? colors.primary : colors.textTertiary}
                        />
                        <Text style={[styles.memberName, !hasPhone && { color: colors.textTertiary }]}>{dn(r.playerName)}</Text>
                      </TouchableOpacity>
                      <Text style={{ ...typography.caption, color: hasPhone ? colors.textSecondary : colors.error }}>
                        {hasPhone ? player!.phone : '번호 미등록'}
                      </Text>
                    </View>
                  );
                });
              })()}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
      </>)}
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  subTabHeader: {
    backgroundColor: colors.navy,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 0,
  },
  container: {
    flexGrow: 1,
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    padding: spacing.lg,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },

  // 알림바
  alertBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningBg,
    borderRadius: radius.sm,
    padding: 10,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  alertText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.warning,
  },

  // 알림 감지 바
  notifBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryBg,
    borderRadius: radius.sm,
    padding: 10,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  notifBarText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.male.text,
  },
  notifBarDetail: {
    flex: 1,
    fontSize: 12,
    color: colors.primaryLight,
  },

  // 상단
  topActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  // 예약 청구
  scheduledSection: {
    marginBottom: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.scheduledBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.scheduledBorder,
  },
  scheduledTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.scheduledText,
    marginBottom: 6,
  },
  scheduledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.scheduledBorder,
  },
  scheduledName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  scheduledInfo: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  scheduleInputSection: {
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.scheduledBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.scheduledBorder,
  },
  scheduleToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  scheduleToggleText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },

  // 빈 상태
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: spacing.md,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textTertiary,
  },

  // 테이블
  tableWrapper: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  fixedColumn: {
    width: NAME_COL_WIDTH,
    borderRightWidth: 1,
    borderRightColor: colors.divider,
    zIndex: 1,
    backgroundColor: colors.card,
  },
  nameHeaderCell: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primaryBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  nameHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  nameCell: {
    height: 38,
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  nameCellText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
  },

  // 요약
  summaryLabelCell: {
    height: 28,
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
    backgroundColor: '#0D1B2A',
  },
  summaryLabelText: {
    fontSize: 10,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    height: 28,
    backgroundColor: '#0D1B2A',
  },
  summaryCell: {
    width: PERIOD_COL_WIDTH,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  summaryValueText: {
    fontSize: 10,
    fontWeight: '600',
  },

  // 헤더
  periodHeaderRow: {
    flexDirection: 'row',
    height: 44,
    backgroundColor: colors.primaryBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  periodHeaderCell: {
    width: PERIOD_COL_WIDTH,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.divider,
    paddingHorizontal: 2,
  },
  periodName: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  periodAmount: {
    fontSize: 9,
    color: colors.textSecondary,
    marginTop: 1,
  },
  periodPct: {
    fontSize: 8,
    fontWeight: '600',
    marginTop: 1,
  },

  // 데이터
  dataRow: {
    flexDirection: 'row',
    height: 38,
  },
  rowEven: {
    backgroundColor: colors.bg,
  },
  statusCell: {
    width: PERIOD_COL_WIDTH,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },

  // 회비/그외/전체 필터
  paymentFilterRow: {
    gap: 6,
    marginBottom: spacing.sm,
  },
  paymentFilterInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paymentFilterTabs: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 0,
    overflow: 'hidden',
    backgroundColor: colors.bg,
    padding: 2,
  },
  paymentFilterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'transparent',
    borderRadius: radius.sm,
  },
  paymentFilterTabActive: {
    backgroundColor: colors.navy,
  },
  paymentFilterTabText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  paymentFilterTabTextActive: {
    color: colors.accent,
  },

  // 납부현황 카드
  statusCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  statusCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  statusCardDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  statusBarBg: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  statusBarFill: {
    height: 8,
    backgroundColor: colors.paid,
    borderRadius: 4,
  },
  statusBarLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'right',
  },
  statusSummaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  statusSummaryItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  statusSummaryNum: {
    fontSize: 18,
    fontWeight: '800',
  },
  statusSummaryLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusAmountRow: {
    flexDirection: 'row',
    marginTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    paddingTop: 8,
  },
  statusAmountItem: {
    flex: 1,
    alignItems: 'center',
  },
  statusAmountLabel: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  statusAmountValue: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  statusUnpaidList: {
    marginTop: 10,
    padding: 8,
    backgroundColor: colors.errorBg,
    borderRadius: 6,
  },
  statusUnpaidTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.unpaid,
    marginBottom: 4,
  },
  statusUnpaidNames: {
    fontSize: 11,
    color: '#FCA5A5',
    lineHeight: 16,
  },

  // 뱃지
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.full,
    minWidth: 46,
  },
  badgeUnpaid: { backgroundColor: colors.errorBg, borderWidth: 1, borderColor: '#5F1E1E' },
  badgeUnpaidText: { fontSize: 11, color: colors.error, fontWeight: '700' },
  badgePay: { backgroundColor: colors.primary },
  badgePayText: { fontSize: 11, color: colors.black, fontWeight: '700' },
  badgeKakao: { backgroundColor: '#FEE500' },
  badgeKakaoText: { color: '#3C1E1E' },
  badgePending: { backgroundColor: colors.warningBg, borderWidth: 1, borderColor: '#5F4B00' },
  badgePendingText: { fontSize: 10, color: '#FCD34D', fontWeight: '700' },
  badgeDone: { backgroundColor: colors.successBg, borderWidth: 1, borderColor: '#0D4B2A' },
  badgeDoneText: { fontSize: 11, color: '#34D399', fontWeight: '700' },

  // 회원 결제 버튼 스택 (2개 세로 배치)
  payBtnStack: {
    alignItems: 'center',
    gap: 3,
  },
  badgeMini: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    minWidth: 62,
    alignItems: 'center',
  },
  badgeMiniText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.white,
  },
  badgeNA: { backgroundColor: colors.divider },
  badgeNAText: { fontSize: 10, color: colors.textTertiary, fontWeight: '500' },
  badgeRequest: { backgroundColor: '#f97316' },
  badgeRequestText: { fontSize: 10, fontWeight: '700', color: colors.white },
  retryText: {
    fontSize: 9,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
    marginTop: 2,
  },

  // 청구 삭제 버튼
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing['2xl'],
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: colors.errorBg,
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.error,
  },

  // 모달
  modalContainer: { flex: 1, backgroundColor: colors.bg },
  modalInner: { flex: 1, maxWidth: MAX_WIDTH, width: '100%', alignSelf: 'center' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    paddingTop: 56,
    backgroundColor: colors.navy,
    borderBottomWidth: 0,
  },
  modalCancel: { fontSize: 16, color: 'rgba(255,255,255,0.7)' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.white },
  modalSave: { fontSize: 16, fontWeight: '700', color: colors.accent },
  modalContent: { flex: 1, padding: spacing.lg },
  modalContentPadded: { padding: spacing.lg },
  inputLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6, marginTop: spacing.md },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.card,
  },

  // 차등 금액
  diffToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 4,
  },
  diffToggleLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  diffAmountRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  diffAmountCol: { flex: 1 },
  diffAmountLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.xs },

  // 등급별 차등 금액
  levelDiffCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 10,
    marginBottom: 8,
    backgroundColor: colors.card,
  },
  levelDiffHeader: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.text,
    marginBottom: 6,
  },
  levelDiffRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  levelDiffResult: {
    fontSize: 12,
    color: colors.primary,
    marginTop: 4,
  },

  // 대상 선택
  memberSelectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  selectAllBtn: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.divider,
  },
  memberCheckRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberName: { fontSize: 14, color: colors.text },
  adminBadge: {
    backgroundColor: colors.primaryBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adminBadgeText: { fontSize: 10, color: colors.male.text, fontWeight: '600' },
  memberAmountInput: {
    width: 80,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: 13,
    color: colors.text,
    backgroundColor: colors.card,
    textAlign: 'right',
  },

  // 개별 금액 수정 모달
  editOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing['2xl'],
  },
  editBox: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 320,
  },
  editBoxTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  editBoxBtns: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  editBoxCancelBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
  },
  editBoxCancelText: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
  editBoxSaveBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
  },
  editBoxSaveText: { fontSize: 14, color: colors.black, fontWeight: '700' },
  smsPreview: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  smsPreviewLabel: {
    ...typography.captionMedium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  smsPreviewBox: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  smsPreviewText: {
    ...typography.body,
    color: colors.text,
  },
});

// ── 가계부 스타일 ──
const ls = StyleSheet.create({
  summaryGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  summaryBox: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    padding: spacing.md,
    alignItems: 'center',
  },
  balanceBox: {
    backgroundColor: colors.primaryBg,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  overallRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  overallLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  overallValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    marginVertical: spacing.sm,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.navy,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 0,
  },
  headerText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    alignItems: 'center',
    minHeight: 48,
  },
  colDate: {
    width: 44,
    justifyContent: 'center',
  },
  colCategory: {
    width: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colDesc: {
    flex: 1,
    paddingHorizontal: spacing.xs,
    justifyContent: 'center',
  },
  colAmount: {
    width: 60,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  colBalance: {
    width: 68,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  dateText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  descText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
  },
  memoText: {
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 2,
  },
  amountText: {
    fontSize: 12,
    fontWeight: '600',
  },
  balanceText: {
    fontSize: 12,
    fontWeight: '700',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  deleteBtnText: {
    color: colors.error,
    fontWeight: '600',
    fontSize: 14,
  },
  addCategoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    marginTop: spacing.xs,
  },
  addCategoryBtnText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  newCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  newCategorySaveBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  newCategorySaveBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  newCategoryCancelBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  newCategoryCancelBtnText: {
    color: colors.textTertiary,
    fontSize: 13,
  },
});
