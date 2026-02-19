# Tennis Note

테니스 클럽 경기 기록 및 대진표 관리 앱

## 기능

- **로그인**: Google 로그인 + 클럽 코드 입력
- **홈**: 클럽 현황 요약, 오늘의 MVP, 빠른 메뉴
- **오늘 경기**: 대진표 생성 + 점수 입력
  - 한울 AA (5~16명 전용 패턴)
  - 혼합복식 (남+여)
  - 동성복식
  - 랜덤복식
  - 수동 대진
- **경기 기록**: 날짜별/월별/개인별 통계, 랭킹
- **선수 관리**: 선수 추가/수정/삭제
- **설정**: 클럽 변경, 로그아웃

## 기술 스택

- **Framework**: React Native (Expo)
- **Router**: Expo Router
- **State**: Zustand
- **Backend**: Firebase (Auth + Firestore)
- **Language**: TypeScript

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

`.env.example`을 복사하여 `.env` 파일을 만들고 Firebase 설정값을 입력하세요.

```bash
cp .env.example .env
```

### 3. Firebase 설정

1. [Firebase Console](https://console.firebase.google.com)에서 프로젝트 생성
2. Firestore Database 활성화
3. Authentication에서 Google 로그인 활성화
4. 웹 앱 추가 후 설정값을 `.env`에 복사

### 4. 실행

```bash
# 웹
npm run web

# iOS (macOS만)
npm run ios

# Android
npm run android
```

## 데이터 마이그레이션

기존 JSON 파일에서 Firebase로 데이터를 이전하려면:

```bash
npx ts-node scripts/migrate-data.ts HMMC ../ admin@example.com
```

## 프로젝트 구조

```
TennisApp/
├── app/                    # Expo Router 화면
│   ├── (auth)/            # 인증 관련 화면
│   └── (tabs)/            # 메인 탭 화면
├── components/            # 재사용 컴포넌트
│   └── ui/               # 기본 UI 컴포넌트
├── services/             # Firebase 서비스
├── stores/               # Zustand 상태 관리
├── utils/                # 유틸리티 함수
│   ├── matchmaking.ts    # 대진표 생성 알고리즘
│   ├── scoring.ts        # 점수 계산
│   └── stats.ts          # 통계 계산
├── types/                # TypeScript 타입
└── scripts/              # 마이그레이션 스크립트
```

## 대진표 알고리즘

### 한울 AA 방식
- 5~16명에서 동작
- 미리 정의된 패턴으로 인당 정확히 4게임 보장

### 복식 스케줄러
- 파트너/상대 중복 최소화
- 게임 간격 균등 (연속 출전 방지)
- NTRP 밸런스 옵션
- 조별 분리 옵션

## 빌드

### 웹 빌드
```bash
npx expo export -p web
```

### 모바일 빌드 (EAS)
```bash
# Preview 빌드
eas build --platform android --profile preview
eas build --platform ios --profile preview

# Production 빌드
eas build --platform all --profile production
```

## 라이선스

Copyright 2026. Studioroom. All rights reserved.
