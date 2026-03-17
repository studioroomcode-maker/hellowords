# HelloWords 프로젝트 현황
> 업데이트: 2026-03-17

---

## 📦 상품 개요
- **상품명**: Hello Words
- **형태**: 시험별 기출/핵심 단어 포스트잇 + 모바일 예문 학습
- **카드 크기**: 51 × 76mm (포스트잇 실물 규격)
- **구성**
  - TOEIC: 600점대 / 700점대 / 800점대 — 각 300개, 총 900개
  - IELTS: Band 5 / 6 / 7 — 각 300개, 총 900개
  - TOPIK: 1급 / 2급 / 3급 / 4급 / 5급 / 6급 — 각 300개, 총 1,800개
- **언어 버전**
  - TOEIC / IELTS: English
  - TOPIK: English / 中文 / 日本語 / Tiếng Việt

---

## 📄 PDF 파일 현황

| 파일 | 단어 수 | 페이지 | 레이아웃 |
|------|--------|--------|---------|
| HelloWords_600.pdf | 300개 | 25페이지 | A4, 4열×3행=12카드/페이지 |
| HelloWords_700.pdf | 300개 | 25페이지 | A4, 4열×3행=12카드/페이지 |
| HelloWords_800.pdf | 300개 | 25페이지 | A4, 4열×3행=12카드/페이지 |
| HelloWords_IELTS_5.pdf | 300개 | 25페이지 | A4, 4열×3행=12카드/페이지 |
| HelloWords_IELTS_6.pdf | 300개 | 25페이지 | A4, 4열×3행=12카드/페이지 |
| HelloWords_IELTS_7.pdf | 300개 | 25페이지 | A4, 4열×3행=12카드/페이지 |

### 카드 디자인 구성
```
┌─────────────────────────┐
│ [EN] [600]   [암기완료□] │  ← 상단 accent 컬러 테이프
│ ─────────────────────── │
│  apply                  │  ← 단어 (font-weight:900)
│  əˈplaɪ   v.            │  ← 발음기호 + 품사
│                         │
│ 📍 상황 설명 한 줄        │
│ 예문1 영어 (핵심단어 강조) │
│ 예문1 한국어              │
│ 예문2 영어               │
│ 예문2 한국어              │
├ ─ ─ 접어서 뜻 맞히기 ─ ─ ┤  ← 점선 접는 선
│  지원하다, 신청하다        │  ← 뜻 (font-weight:900)
│  [submit] [request]      │  ← 동의어 태그
│  Hello Words™    [QR]   │  ← 브랜드 + QR코드
└─────────────────────────┘
```

### 색상 팔레트 (비비드 파스텔, 레벨별 5색 순환)
| 레벨 | 색상 1 | 색상 2 | 색상 3 | 색상 4 | 색상 5 |
|------|--------|--------|--------|--------|--------|
| 600 | #E07878 | #E0A040 | #60B080 | #5090C8 | #9070C0 |
| 700 | #D06090 | #5098C0 | #50A878 | #D08840 | #7070C8 |
| 800 | #C05858 | #4878B0 | #388A60 | #B87030 | #5850A8 |

### 레이아웃 수치 (wkhtmltopdf 96dpi 기준)
- 카드: 193 × 287px (= 51 × 76mm)
- 카드 간격: border-spacing 15px (≈ 4mm)
- 상하 여백: 116px (≈ 31mm), 좌우 여백: 26px (≈ 7mm)
- 그리드 가운데 정렬: `margin: 116px auto`

---

## 🌐 웹사이트 현황

### 도메인 및 URL 구조
- **도메인**: studioroomkr.com (GoDaddy → GitHub Pages 연결 완료)
- **호스팅**: GitHub Pages (단일 repo)

### 레벨별 접속 주소 (비공개 코드)
| 레벨 | URL |
|------|-----|
| 600점대 | studioroomkr.com/hw/NbrnTP/ |
| 700점대 | studioroomkr.com/hw/3fAbnF/ |
| 800점대 | studioroomkr.com/hw/bmOHnK/ |

### 단어 상세 페이지 URL 형식
```
studioroomkr.com/hw/NbrnTP/word.html?w=apply
studioroomkr.com/hw/3fAbnF/word.html?w=confirm
studioroomkr.com/hw/bmOHnK/word.html?w=manage
```

### 웹 페이지 기능
- **허브 (`hub_index.html`)**: TOEIC / IELTS / TOPIK 시리즈 진입
- **IELTS (`ielts/`)**: 밴드별 목록, 상세 페이지, TTS
- **TOPIK (`topik/`)**: 언어별 진입, 등급별 목록, 상세 페이지, TTS
- **단어 상세 페이지 공통 기능**
  - 메인 단어 폰트 자동 축소
  - 예문 10개
  - 한국어 TTS 버튼
  - 이전/다음 이동

### GitHub 저장소 구조
```
repo/
├── index.html
├── word.html  
├── words_data.json
└── hw/
    ├── NbrnTP/   ← 600점대
    │   ├── index.html
    │   ├── word.html
    │   └── words_data.json
    ├── 3fAbnF/   ← 700점대
    │   └── ...
    └── bmOHnK/   ← 800점대
        └── ...
```

---

## 🔑 QR 코드

- **생성 방식**: libqrencode (ctypes) — 시스템 라이브러리 직접 호출
- **이전 방식 문제**: 순수 Python 구현 → Format Info 오류로 스캔 불가
- **현재 QR 크기**: 카드 우하단 24×24px
- **인코딩 URL**: `https://studioroomkr.com/hw/{코드}/word.html?w={단어}`

---

## 🗂️ 주요 파일 경로 (서버 내)

| 파일 | 경로 |
|------|------|
| 단어 데이터 | `/home/claude/words_data_final.json` |
| PDF 생성 원본 HTML | `/home/claude/pdf_center/hw_600.html` 등 |
| 색상 기준 PDF | `/home/claude/pdf_center/` |
| 현재 최신 PDF | `/mnt/user-data/outputs/HelloWords_600~800.pdf` |

---

## ✅ 완료된 작업

- [x] TOEIC 900단어 데이터 구성 완료
- [x] IELTS 900단어 데이터 구성 완료
- [x] TOPIK 1,800단어 데이터 구성 완료
- [x] TOPIK 다국어 버전 구성 완료 (EN / CN / JP / VN)
- [x] TOEIC PDF 3종 생성 완료
- [x] IELTS PDF 3종 생성 완료
- [x] 허브 페이지 구축 및 시리즈 연결 완료
- [x] IELTS 웹 페이지 구축 완료
- [x] TOPIK 언어별/등급별 웹 페이지 구축 완료
- [x] 단어 상세 페이지 (예문 10개, TTS) 완료

## ⏳ 남은 작업

- [ ] 우측 상단 일러스트 (단어 뜻 연상 그림) 최종 확정
- [ ] 인쇄소 납품 (초도 물량 50부 권장)
- [ ] 스마트스토어 / 텀블벅 등록
