// Player type
export interface Player {
  id?: string;
  name: string;
  nickname?: string;              // 별명
  gender: '남' | '여';
  hand: '오른손' | '왼손';
  ageGroup: string;
  racket: string;
  group: string; // 동적 조 (A조, B조, C조, 미배정 등 - 클럽 설정에서 관리)
  ntrp: number | null;
  adminNtrp: number | null;       // 관리NTRP (관리자만 열람/수정 가능)
  phone?: string;                 // 전화번호 (관리자만 열람/수정)
  email?: string;                 // 연동된 로그인 이메일
  mbti: string | null;
  photoURL?: string;                // 프로필 이미지 URL
  createdAt?: Date;
}

// Match types
export type GameType = '복식' | '단식' | '삭제';

export interface Match {
  gameType: GameType;
  team1: string[];
  team2: string[];
  court: number;
}

export type SidePosition = '포(듀스)' | '백(애드)' | '모름';

export interface MatchResult {
  t1: number | null;
  t2: number | null;
  sides?: Record<string, SidePosition>;
}

// Session type (daily game session)
export interface Session {
  schedule: Match[];
  results: Record<string, MatchResult>;
  courtType?: string;
  specialMatch?: boolean; // 교류전 - 통계에서 제외
  groupsSnapshot?: Record<string, string>;
  groupOnly?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Court reservation data
export type TargetGender = '남' | '여' | '무관' | '남녀';

export interface CustomEntry {
  time: string;
  place: string;
  court: string;
  fee?: string;
  target?: TargetGender;
  targetMaleCount?: number;
  targetFemaleCount?: number;
  ntrp?: string;
  memo?: string;
  participants?: string[];
  closed?: boolean;
}

export interface AnniversaryInfo {
  name: string;
  special: boolean;
}

export interface ReservationStore {
  reservationData: Record<string, string | CustomEntry[]>;
  customModes: Record<string, boolean>;
  anniversaryData: Record<string, AnniversaryInfo>;
}

// Club custom settings
export interface ClubSettings {
  // 조 관련 설정
  useGroups: boolean;              // 조별 구분 사용 여부
  groups: string[];                // 조 목록 (예: ['A조', 'B조', 'C조'])

  // 회원 정보 공개 설정
  hideGroupFromMembers: boolean;   // 회원들에게 조 정보 숨기기
  hideNtrpFromMembers: boolean;    // 회원들에게 NTRP 정보 숨기기

  // 대진 옵션 표시 설정
  showMatchOptions: {
    hanulAA: boolean;              // 한울 AA 방식
    mixedDoubles: boolean;         // 혼합복식
    sameGenderDoubles: boolean;    // 동성복식
    randomDoubles: boolean;        // 랜덤복식
    manualMatch: boolean;          // 수동 대진
    singles: boolean;              // 단식
  };

  // 기타 설정
  defaultCourtCount: number;       // 기본 코트 수
  defaultMaxGames: number;         // 기본 인당 경기 수
  useNtrpBalance: boolean;         // NTRP 밸런스 기본값
  useAdminNtrp: boolean;           // 관리NTRP 우선 사용
  showWinProbability?: boolean;    // 예상승률 표시 여부
  showProbInJpg?: boolean;         // JPG 캡처 시 예상승률 포함 여부

  // 대진 기본값
  defaultGameType?: string;        // '복식' | '단식' | '복식 팀전' | '단식 팀전'
  defaultIsManualMode?: boolean;   // 자동 생성 / 직접 배정(수동)
  defaultDoublesMode?: string;     // 복식/단식 대진 방식
  defaultGroupOnly?: boolean;      // 같은 조끼리만 대진 생성

  // 표시 이름 모드
  displayNameMode?: 'name' | 'nickname'; // 이름 표기 / 별명 표기

  // 공지사항
  notice?: string;

  // 회비 계좌 설정
  bankAccount?: BankAccountInfo;
  duesContactPhone?: string;        // 입금확인 연락처 (레거시 - 단일)
  duesContactPhones?: string[];     // 입금확인 연락처 목록 (복수)

  // 알림 감지 설정 (Android)
  notificationListener?: NotificationListenerConfig;

  // 일반 회원 메뉴 제한 (관리자가 설정)
  memberRestrictions?: {
    hideMatch: boolean;            // 오늘 경기 탭 숨기기
    hideRecords: boolean;          // 기록 탭 숨기기
    hidePlayers: boolean;          // 선수 탭 숨기기
    hideDues: boolean;             // 회비 탭 숨기기
    hideSettings: boolean;         // 설정 탭 숨기기
  };

  // 하위 섹션별 제한 (관리자가 설정)
  sectionRestrictions?: Record<string, boolean>;

  // 관리자 등급별 권한 설정
  adminLevelPermissions?: Record<number, AdminPermissions>;

  // 관리자 등급 이름 커스텀
  adminLevelNames?: Record<number, string>;

  // Gemini AI API 키 (동물 프로필 생성용)
  geminiApiKey?: string;
}

// 관리자 등급
export type AdminLevel = 1 | 2 | 3;

// 관리자 권한
export interface AdminPermissions {
  canAccessDues: boolean;       // 회비탭 접근
  canEditPlayers: boolean;      // 선수 정보 수정
  canCreateSchedule: boolean;   // 대진 생성
  canInputScores: boolean;      // 점수 입력
}

// Club type
export interface Club {
  name: string;
  adminEmails: string[];
  adminLevels?: Record<string, AdminLevel>;  // email → level (1=최고, 2=관리자, 3=보조)
  createdAt?: Date;
  settings?: ClubSettings;
}

// User/Auth types
export interface User {
  email: string;
  displayName?: string;
  photoURL?: string;
}

// Statistics types
export interface PlayerStats {
  name: string;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  scoreFor: number;
  scoreAgainst: number;
  winRate: number;
}

// Match mode types
export type DoublesMode =
  | '한울 AA'
  | '혼합복식'
  | '동성복식'
  | '랜덤복식'
  | '수동 대진';

export type SinglesMode =
  | '랜덤 단식'
  | '동성 단식'
  | '혼합 단식';

// Schedule generation options
export interface ScheduleOptions {
  mode: DoublesMode | SinglesMode;
  gameType: '복식' | '단식';
  isTeamMode: boolean;
  isManualMode: boolean;
  maxGames: number;
  courtCount: number;
  totalRounds: number;
  useNtrp: boolean;
  useAdminNtrp?: boolean;
  groupOnly: boolean;
}

// 팀 배정 (선수명 → 팀명)
export type TeamAssignment = Record<string, string>;

// 수동 게임 슬롯
export interface ManualSlot {
  team1: (string | null)[];
  team2: (string | null)[];
  genderMode?: string;
  checked?: boolean;
}

// For hanul AA patterns
export interface HanulAAPattern {
  [key: number]: string[];
}

// 구독 등급 (Basic → Plus → Pro → Prime, 상위 등급은 하위 기능 포함)
export type SubscriptionTier = 'Basic' | 'Plus' | 'Pro' | 'Prime';

// 등급별 기능 매핑 설정 (슈퍼 어드민이 글로벌 설정)
export type TierFeatureConfig = Record<SubscriptionTier, ClubFeatureFlags>;

// 클럽별 기능 제한 플래그 (슈퍼 어드민용)
export interface ClubFeatureFlags {
  // 대진표
  disableSchedule: boolean;        // 대진표 생성
  disableAdvancedModes: boolean;   // 고급대진 (한울AA/수동)
  disableJpgCapture: boolean;      // JPG 캡처
  disableWinProbability: boolean;  // 예상승률
  // 기록
  disableRecords: boolean;         // 기록 보기
  disableScoreEdit: boolean;       // 점수 편집
  disableHighlights: boolean;      // 하이라이트/MVP
  disableAIAnalysis: boolean;      // AI 분석
  // 통계
  disableStats: boolean;           // 통계 (월별)
  disablePersonalStats: boolean;   // 개인별 통계
  disableRanking: boolean;         // 랭킹
  // 기타
  disablePlayers: boolean;         // 선수 관리
  disableSettings: boolean;        // 설정
  disableDues: boolean;            // 회비 관리
  disableReservation: boolean;     // 코트 예약/일정
}

// 회비 관련 타입
export type PaymentMethod = '무통장입금' | '카카오페이';

export interface BankAccountInfo {
  paymentMethod: PaymentMethod;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  kakaoPayUrl?: string;
}

export type PaymentStatus = '미납' | '확인요망' | '입금완료';

export interface BillingPeriod {
  id: string;
  name: string;
  amount: number;
  date?: string;
  ledgerCategory?: string;
  createdAt: string;
}

export interface PaymentRecord {
  playerName: string;
  status: PaymentStatus;
  amount: number;
  updatedAt: string;
  dismissed?: boolean;
}

export interface ScheduledBilling {
  id: string;
  scheduledAt: string; // ISO datetime
  name: string;
  amount: number;
  date?: string;
  ledgerCategory?: string;
  memberAmounts: { playerName: string; amount: number }[];
  createdAt: string;
}

export interface DuesData {
  billingPeriods: BillingPeriod[];
  payments: Record<string, PaymentRecord[]>;
  scheduledBillings?: ScheduledBilling[];
}

// 회비정산 가계부 타입
export type LedgerEntryType = '수입' | '지출';

export type LedgerCategory = string;

export interface CustomLedgerCategory {
  label: string;
  type: LedgerEntryType;
}

export interface LedgerEntry {
  id: string;
  date: string;
  description: string;
  type: LedgerEntryType;
  amount: number;
  category: LedgerCategory;
  memo?: string;
  billingPeriodId?: string;
  playerName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LedgerData {
  entries: LedgerEntry[];
  customCategories?: CustomLedgerCategory[];
}

// 알림 감지 설정
export interface NotificationListenerConfig {
  enabled: boolean;
  allowedPackages: string[];
}

// 알림 매칭 로그
export interface NotificationMatchLog {
  timestamp: string;
  rawText: string;
  parsedName: string | null;
  parsedAmount: number | null;
  matchedPlayer: string | null;
  matchedPeriod: string | null;
  success: boolean;
}

// 다이어리 - 장비 관리
export interface RacketInfo {
  id: string;
  brand: string;
  model: string;
  isMain: boolean;
}

export interface StringInfo {
  racketId: string;
  name: string;
  tension: number;
  replacedAt: string;
  gamesSinceReplace: number;
}

export interface ShoeInfo {
  brand: string;
  model: string;
  purchasedAt?: string;
}

export interface OvergripInfo {
  replacedAt: string;
  gamesSinceReplace: number;
}

export interface GearData {
  rackets: RacketInfo[];
  strings: Record<string, StringInfo>;
  shoes: ShoeInfo | null;
  overgrip: OvergripInfo | null; // legacy (single)
  overgrips?: Record<string, OvergripInfo>; // per-racket
}

// 다이어리 - 레이더 스탯
export type RadarStatKey = 'serve' | 'forehand' | 'backhand' | 'volley' | 'step' | 'mental';
export type SubStatKey = 'slice' | 'drop' | 'lob';
export type SkillKey = RadarStatKey | SubStatKey;

export interface RadarStats {
  main: Record<RadarStatKey, number>;
  sub: Record<SubStatKey, number>;
  updatedAt: string;
}

export interface RadarStatsSnapshot {
  stats: RadarStats;
  month: string;
}

// 다이어리 - 일지
export type DiaryMood = 'great' | 'good' | 'normal' | 'bad' | 'terrible';

export interface PlayerRating {
  name: string;
  role: '상대' | '파트너';
  goodSkills: SkillKey[];
  badSkills: SkillKey[];
  // legacy
  rating?: number;
  comment?: string;
}

export interface GearSnapshot {
  racket?: string;
  shoes?: string;
}

// 다른 사람이 나를 평가한 기록 (공유 저장소)
export interface PlayerEvaluation {
  evaluator: string;
  date: string;
  goodSkills: SkillKey[];
  badSkills: SkillKey[];
}

export interface DiaryEntry {
  id: string;
  date: string;
  title: string;
  content: string;
  mood: DiaryMood;
  tags: string[]; // legacy
  goodSkills?: SkillKey[];
  badSkills?: SkillKey[];
  matchDate?: string;
  serveAccuracy?: number | null; // 0~100
  gearSnapshot?: GearSnapshot;
  playerRatings?: PlayerRating[];
  createdAt: string;
  updatedAt: string;
}

// 다이어리 - 개인 경기
export type CourtPosition = '듀스(포)' | '애드(백)';

export interface PersonalGame {
  id: string;
  date: string;
  gameType: '단식' | '복식';
  opponents: string[];
  partners: string[];
  myScore: number | null;
  oppScore: number | null;
  myPosition?: CourtPosition | null;
  location?: string;
  createdAt: string;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
