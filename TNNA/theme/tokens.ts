/**
 * Stitch-style Design Tokens
 * Premium, minimal, card-based design system
 */

export const FONT_FAMILY = 'Lexend';

export const colors = {
  primary: '#D4FF00',
  primaryLight: '#E8FF66',
  primaryBg: '#1A2000',
  accent: '#D4FF00',
  accentDark: '#9BBF00',

  navy: '#101820',
  navyLight: '#252D35',

  bg: '#0A0E14',
  card: '#161B22',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  textTertiary: '#64748B',
  border: '#21262D',
  borderLight: '#161B22',
  divider: '#21262D',

  success: '#10B981',
  successBg: '#0D2818',
  error: '#EF4444',
  errorBg: '#2D1215',
  warning: '#F59E0B',
  warningBg: '#2D2006',
  info: '#3b82f6',
  infoBg: '#0D1B2A',

  // dues 상태색
  paid: '#16a34a',
  paidBg: '#0D2818',
  unpaid: '#dc2626',
  unpaidBg: '#2D1215',
  pending: '#d97706',
  pendingBg: '#2D2006',
  scheduledBg: '#2D2006',
  scheduledBorder: '#fbbf24',
  scheduledText: '#FCD34D',

  male: { bg: '#0D1B2A', text: '#60A5FA' },
  female: { bg: '#2D1A0D', text: '#F4A261' },

  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0, 0, 0, 0.6)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  '2xl': 32,
  full: 999,
} as const;

export const typography = {
  heroTitle: { fontSize: 28, fontWeight: '800' as const, lineHeight: 34, fontFamily: FONT_FAMILY },
  title: { fontSize: 20, fontWeight: '600' as const, lineHeight: 28, fontFamily: FONT_FAMILY },
  section: { fontSize: 16, fontWeight: '600' as const, lineHeight: 24, fontFamily: FONT_FAMILY },
  body: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20, fontFamily: FONT_FAMILY },
  bodyMedium: { fontSize: 14, fontWeight: '500' as const, lineHeight: 20, fontFamily: FONT_FAMILY },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16, fontFamily: FONT_FAMILY },
  captionMedium: { fontSize: 12, fontWeight: '500' as const, lineHeight: 16, fontFamily: FONT_FAMILY },
  stat: { fontSize: 24, fontWeight: '700' as const, lineHeight: 32, fontFamily: FONT_FAMILY },
  tabLabel: { fontSize: 10, fontWeight: '500' as const, lineHeight: 14, fontFamily: FONT_FAMILY },
  microLabel: { fontSize: 10, fontWeight: '700' as const, lineHeight: 14, letterSpacing: 1.2, fontFamily: FONT_FAMILY },
  statHero: { fontSize: 22, fontWeight: '900' as const, lineHeight: 28, fontFamily: FONT_FAMILY },
} as const;

export const shadows = {
  none: {},
  card: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardStitch: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 3,
  },
} as const;

export const MAX_WIDTH = 600;

export const layout = {
  maxWidth: MAX_WIDTH,
  screenPadding: 20,
  cardPadding: spacing.lg,
  sectionGap: 20,
  headerBottomRadius: 32,
} as const;
