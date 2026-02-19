// === Tailwind Config (Design Reference) ===
// Google Stitch 디자인 토큰 — 실제 RN 앱에서는 theme/tokens.ts로 매핑

const config = {
  darkMode: 'class' as const,
  theme: {
    extend: {
      colors: {
        primary: '#135BEC',
        secondary: '#D4F01E',
        navy: '#0F172A',
        'background-light': '#F8FAFC',
        'background-dark': '#020617',
        'card-light': '#FFFFFF',
        'card-dark': '#1E293B',
      },
      fontFamily: {
        sans: ['Lexend', 'sans-serif'],
      },
      borderRadius: {
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
};

export default config;
