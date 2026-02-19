// Scoring constants
export const WIN_POINT = 3;
export const DRAW_POINT = 1;
export const LOSE_POINT = 0;

// Age groups
export const AGE_GROUPS = ['20대', '30대', '40대', '50대', '60대 이상', '비밀'];

// Racket brands
export const RACKET_BRANDS = [
  '모름',
  '윌슨',
  '바볼랏',
  '헤드',
  '요넥스',
  '프린스',
  '던롭',
  '테크니화이버',
  '기타',
];

// Groups
export const GROUPS = ['A조', 'B조', '미배정'] as const;

// NTRP levels (1.0 to 7.0 in 0.1 increments)
export const NTRP_LEVELS = [
  { value: null, label: '모름' },
  ...Array.from({ length: 61 }, (_, i) => {
    const val = 1.0 + i * 0.1;
    return { value: Math.round(val * 10) / 10, label: val.toFixed(1) };
  }),
];

// MBTI types
export const MBTI_TYPES = [
  '모름',
  'ISTJ', 'ISFJ', 'INFJ', 'INTJ',
  'ISTP', 'ISFP', 'INFP', 'INTP',
  'ESTP', 'ESFP', 'ENFP', 'ENTP',
  'ESTJ', 'ESFJ', 'ENFJ', 'ENTJ',
];

// Match modes
export const DOUBLES_MODES = [
  '한울 AA',
  '혼합복식',
  '동성복식',
  '랜덤복식',
  '수동 대진',
] as const;

export const SINGLES_MODES = [
  '랜덤 단식',
  '동성 단식',
  '혼합 단식',
] as const;

// Side positions
export const SIDE_POSITIONS = ['포(듀스)', '백(애드)', '모름'] as const;

// Schedule weights for match generation
export const SCHEDULE_WEIGHTS = {
  W_PARTNER: 30.0,    // Partner repeat penalty (squared)
  W_OPP: 12.0,        // Opponent repeat penalty (squared)
  W_RECENT_P: 60.0,   // Recent partner strong penalty
  W_RECENT_O: 22.0,   // Recent opponent penalty
  W_FAIR: 16.0,       // Game count variance
  W_NTRP: 6.0,        // Team NTRP balance
  W_GAP_1: 120.0,     // Consecutive round penalty (0 rest)
  W_GAP_2: 45.0,      // One round rest penalty
  W_PACE: 18.0,       // Pace control (early/late distribution)
};

// Mixed doubles weights
export const MIXED_DOUBLES_WEIGHTS = {
  PARTNER_REPEAT: 200,
  OPPONENT_REPEAT: 25,
  GAME_COUNT: 2.0,
  NTRP_BALANCE: 12.0,
};

// Default values
export const DEFAULT_COURT_COUNT = 2;
export const DEFAULT_MAX_GAMES = 4;
export const DEFAULT_TOTAL_ROUNDS = 4;

// Team mode
export const TEAM_COLORS: Record<string, string> = {
  '레드팀': '#ef4444',
  '그린팀': '#22c55e',
  '블루팀': '#3b82f6',
  '옐로우팀': '#eab308',
};
export const TEAM_NAMES = ['레드팀', '그린팀', '블루팀', '옐로우팀'] as const;

// Manual mode gender options
export const GENDER_OPTIONS = ['성별랜덤', '동성', '혼합'] as const;
export const SAME_GENDER_SUB = ['동성복식', '남성복식', '여성복식'] as const;

// Game type options
export const GAME_TYPES = ['복식', '단식', '복식 팀전', '단식 팀전'] as const;

// Hanul AA patterns (5-16 players)
export const HANUL_AA_PATTERNS: Record<number, string[]> = {
  5: [
    "12:34",
    "13:25",
    "14:35",
    "15:24",
    "23:45",
  ],
  6: [
    "12:34",
    "15:46",
    "23:56",
    "14:25",
    "24:36",
    "16:35",
  ],
  7: [
    "12:34",
    "56:17",
    "35:24",
    "14:67",
    "23:57",
    "16:25",
    "46:37",
  ],
  8: [
    "12:34",
    "56:78",
    "13:57",
    "24:68",
    "37:48",
    "15:26",
    "16:38",
    "25:47",
  ],
  9: [
    "12:34",
    "56:78",
    "19:57",
    "23:68",
    "49:38",
    "15:26",
    "17:89",
    "36:45",
    "24:79",
  ],
  10: [
    "12:34",
    "56:78",
    "23:6A",
    "19:58",
    "3A:45",
    "27:89",
    "4A:68",
    "13:79",
    "46:59",
    "17:2A",
  ],
  11: [
    "12:34",
    "56:78",
    "1B:9A",
    "23:68",
    "4A:57",
    "26:9B",
    "13:5B",
    "49:8A",
    "17:28",
    "5A:6B",
    "39:47",
  ],
  12: [
    "12:34",
    "56:78",
    "9A:BC",
    "15:26",
    "39:4A",
    "7B:8C",
    "13:59",
    "24:6A",
    "7C:14",
    "8B:23",
    "67:9B",
    "58:AC",
  ],
  13: [
    "12:34",
    "56:78",
    "9A:BC",
    "1D:25",
    "37:4A",
    "68:9B",
    "CD:13",
    "26:5A",
    "47:8B",
    "9C:2D",
    "15:AB",
    "3C:67",
    "48:9D",
  ],
  14: [
    "12:34",
    "56:78",
    "9A:BC",
    "DE:13",
    "24:57",
    "68:9B",
    "26:CD",
    "79:AE",
    "14:8B",
    "5E:6A",
    "3C:7B",
    "2D:89",
    "3E:45",
    "AC:1D",
  ],
  15: [
    "12:34",
    "56:78",
    "9A:BC",
    "DE:1F",
    "23:57",
    "46:AB",
    "8D:9E",
    "4F:5C",
    "13:6B",
    "27:8A",
    "9C:5E",
    "36:DF",
    "1B:8C",
    "47:EF",
    "2A:9D",
  ],
  16: [
    "12:34",
    "56:78",
    "9A:BC",
    "DE:FG",
    "13:57",
    "24:68",
    "9B:DF",
    "AC:EG",
    "15:9D",
    "37:BF",
    "26:AE",
    "48:CG",
    "19:2A",
    "5D:6E",
    "3B:4C",
    "7F:8G",
  ],
};

// Hanul AA seed slots (positions to place seed players)
export const HANUL_AA_SEED_SLOTS: Record<number, string[]> = {
  6: ["1", "3"],
  7: ["1", "5"],
  8: ["1", "7"],
  9: ["1", "4", "8"],
  10: ["1", "8", "A"],
  11: ["1", "5", "8", "9"],
  12: ["2", "3", "8", "A"],
  13: ["1", "4", "6", "B"],
  14: ["2", "5", "8", "C"],
  15: ["1", "4", "5", "A", "D"],
  16: ["1", "6", "B", "G", "7", "A"],
};
