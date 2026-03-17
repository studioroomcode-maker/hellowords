"""Hello Words — TOEIC 600 Mini Strip (50×15mm) — 1page test"""
import json, io, os, re
from fpdf import FPDF
from fpdf.enums import Corner
import qrcode

# ── 설정 ──────────────────────────────────────────────────────────────
DATA_FILE  = 'words_600.json'
OUTPUT_PDF = 'HelloWords_TOEIC_600_mini_v7.pdf'
QR_BASE    = 'https://studioroomkr.com/w/ZjeXrl/word.html?w='

COLORS = ['#E8837A', '#E8A842', '#5BB880', '#4F96D4', '#9175C8']

FONT_EN  = 'C:/Windows/Fonts/NotoSans-Regular.ttf'
FONT_ENB = 'C:/Windows/Fonts/NotoSans-Bold.ttf'
FONT_ENI = 'C:/Windows/Fonts/NotoSans-Italic.ttf'
FONT_KO  = 'PretendardR.ttf'
FONT_KOB = 'PretendardB.ttf'

PAGE_W, PAGE_H = 210, 297
CW, CH   = 50, 15          # 카드 크기 (mm)
COLS     = 4
ROWS     = 16              # 16행 × 15mm = 240mm
MX       = (PAGE_W - COLS * CW) / 2   # 5mm
MY       = (PAGE_H - ROWS * CH) / 2   # 28.5mm

R    = 1.8   # 카드 모서리
SW   = 3.0   # 좌측 컬러 스트라이프 폭
QR_S = 8.5   # QR 크기

# 품사별 고정 색상 (비비드 파스텔)
POS_COLORS = {
    'n.'    : '#4F96D4',   # 명사  — 스카이블루
    'v.'    : '#5BB880',   # 동사  — 민트그린
    'adj.'  : '#E8837A',   # 형용사 — 코랄레드
    'adv.'  : '#9175C8',   # 부사  — 라벤더
    'prep.' : '#3DBFBF',   # 전치사 — 아쿠아
    'pron.' : '#E8A842',   # 대명사 — 선플라워
    'conj.' : '#E8729A',   # 접속사 — 로즈핑크
    'abbr.' : '#FF9F43',   # 약어  — 탠저린오렌지
}

ALL4  = (Corner.TOP_LEFT, Corner.TOP_RIGHT, Corner.BOTTOM_LEFT, Corner.BOTTOM_RIGHT)
LEFT2 = (Corner.TOP_LEFT, Corner.BOTTOM_LEFT)

# ── 유틸 ──────────────────────────────────────────────────────────────
def h2r(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def pastel(r, g, b, a=0.12):
    return (int(r*a+255*(1-a)), int(g*a+255*(1-a)), int(b*a+255*(1-a)))

def fit_sz(pdf, text, max_w, start, stop=4.5):
    s = float(start)
    while s >= stop:
        pdf.set_font_size(s)
        if pdf.get_string_width(text) <= max_w:
            return s
        s -= 0.3
    return stop

def make_qr(url, fill_color, back_color='white'):
    qr = qrcode.QRCode(version=2, box_size=3, border=1,
                       error_correction=qrcode.constants.ERROR_CORRECT_M)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color=fill_color, back_color=back_color)
    buf = io.BytesIO()
    img.save(buf, 'PNG')
    buf.seek(0)
    return buf

# ── 미니 카드 1장 ──────────────────────────────────────────────────────
def draw_mini_card(pdf, wd, cx, cy, color_hex):
    r, g, b = h2r(color_hex)
    pc = pastel(r, g, b, 0.12)   # 연한 배경색

    # ── 카드 외곽 ─────────────────────────────────────────────────────
    pdf.set_fill_color(255, 255, 255)
    pdf.set_draw_color(225, 225, 225)
    pdf.set_line_width(0.18)
    pdf.rect(cx, cy, CW, CH, style='FD', round_corners=ALL4, corner_radius=R)

    # ── 좌측 컬러 스트라이프 ──────────────────────────────────────────
    pdf.set_fill_color(r, g, b)
    pdf.set_draw_color(r, g, b)
    pdf.set_line_width(0)
    pdf.rect(cx, cy, SW, CH, style='F', round_corners=LEFT2, corner_radius=R)

    # ── QR (우측, 세로 중앙) ──────────────────────────────────────────
    qr_x = cx + CW - QR_S - 0.8
    qr_y = cy + (CH - QR_S) / 2
    # QR 배경 (연한 틴트)
    RIGHT2 = (Corner.TOP_RIGHT, Corner.BOTTOM_RIGHT)
    pdf.set_fill_color(*pc)
    pdf.set_draw_color(*pc)
    pdf.rect(qr_x - 0.5, cy, QR_S + 1.3, CH, style='F',
             round_corners=RIGHT2, corner_radius=R)
    qr_buf = make_qr(QR_BASE + wd.get('word','').lower().replace(' ','-'),
                     color_hex, 'white')
    pdf.image(qr_buf, x=qr_x, y=qr_y, w=QR_S, h=QR_S)

    # ── 컨텐츠 영역 ───────────────────────────────────────────────────
    cx0 = cx + SW + 1.5
    cw0 = CW - SW - 1.5 - QR_S - 1.3   # ≈ 36mm

    word     = wd.get('word', '')
    phonetic = (wd.get('pronunciation') or wd.get('phonetic') or '').strip()
    pos      = wd.get('pos', '').strip()
    meaning  = wd.get('meaning', '')

    # 카드 색 = 품사 색 (메인에서 이미 결정됨)
    pr2, pg2, pb2 = r, g, b

    # ── 행 1: 단어 (전체 폭, 크게) ───────────────────────────────────
    pdf.set_font('NotoSansBold')
    pdf.set_char_spacing(-0.3)
    wsz = fit_sz(pdf, word, cw0, 11.0, 5.0)
    wlh = wsz * 0.46          # 줄 높이 타이트하게
    pdf.set_font_size(wsz)
    pdf.set_text_color(15, 15, 15)
    pdf.set_xy(cx0, cy + 1.0)
    pdf.cell(cw0, wlh, word, align='L')
    pdf.set_char_spacing(0)

    # ── 행 2: 한글 뜻 (단어 바로 아래) ──────────────────────────────
    mean_y = cy + 1.0 + wlh + 0.3
    pdf.set_font('HanKoBold')
    msz = fit_sz(pdf, meaning, cw0, 7.0, 4.5)
    pdf.set_font_size(msz)
    pdf.set_text_color(35, 35, 35)
    pdf.set_xy(cx0, mean_y)
    pdf.cell(cw0, msz * 0.46, meaning, align='L')

    # ── 행 3: 발음기호 + POS 뱃지 ────────────────────────────────────
    ph_y = mean_y + msz * 0.46 + 0.4
    if ph_y + 2.8 <= cy + CH - 0.2:
        # 발음기호
        pdf.set_font('NotoSansItalic', size=4.0)
        pdf.set_text_color(175, 175, 175)
        ph_str_w = pdf.get_string_width(phonetic)
        pdf.set_xy(cx0, ph_y)
        pdf.cell(ph_str_w + 0.5, 2.8, phonetic, align='L')

        # POS 뱃지 + 동의어 pills (발음기호 오른쪽으로 순서대로)
        pill_x = cx0 + ph_str_w + 1.5
        pill_y = ph_y
        ph_h   = 2.8
        pill_max_x = cx0 + cw0   # 컨텐츠 오른쪽 끝

        def draw_pill(label, filled=False):
            nonlocal pill_x
            pdf.set_font('NotoSansBold', size=3.8)
            pw = pdf.get_string_width(label) + 2.8
            if pill_x + pw > pill_max_x: return
            bg = pastel(pr2, pg2, pb2, 0.28) if filled else (248, 248, 248)
            bc = (pr2, pg2, pb2) if filled else (200, 200, 200)
            tc = (pr2, pg2, pb2) if filled else (140, 140, 140)
            pdf.set_fill_color(*bg)
            pdf.set_draw_color(*bc)
            pdf.set_line_width(0.14)
            pdf.rect(pill_x, pill_y, pw, ph_h, style='FD',
                     round_corners=ALL4, corner_radius=1.2)
            pdf.set_text_color(*tc)
            pdf.set_xy(pill_x, pill_y)
            pdf.cell(pw, ph_h, label, align='C')
            pill_x += pw + 1.2

        if pos:
            draw_pill(pos, filled=True)

        for syn in wd.get('synonyms', [])[:3]:
            draw_pill(syn, filled=False)


# ── 메인 ──────────────────────────────────────────────────────────────
def main():
    with open(DATA_FILE, encoding='utf-8') as f:
        data = json.load(f)
    words = data['words']

    # 테스트: 1페이지분
    words = words[:COLS * ROWS]

    pdf = FPDF(orientation='P', unit='mm', format='A4')
    pdf.set_auto_page_break(False)
    pdf.set_margins(0, 0, 0)
    pdf.add_font('NotoSans',       fname=FONT_EN)
    pdf.add_font('NotoSansBold',   fname=FONT_ENB)
    pdf.add_font('NotoSansItalic', fname=FONT_ENI)
    pdf.add_font('HanKo',          fname=FONT_KO)
    pdf.add_font('HanKoBold',      fname=FONT_KOB)

    PER   = COLS * ROWS
    total = (len(words) + PER - 1) // PER

    for pg in range(total):
        pdf.add_page()
        for i, wd in enumerate(words[pg*PER:(pg+1)*PER]):
            cx = MX + (i % COLS) * CW
            cy = MY + (i // COLS) * CH
            pos_key = wd.get('pos', '').strip()
            card_color = POS_COLORS.get(pos_key, '#607D8B')
            draw_mini_card(pdf, wd, cx, cy, card_color)
        print(f'  {pg+1}/{total} page')

    pdf.output(OUTPUT_PDF)
    print(f'Done: {OUTPUT_PDF}  ({os.path.getsize(OUTPUT_PDF)/1024/1024:.2f} MB)')

if __name__ == '__main__':
    main()
