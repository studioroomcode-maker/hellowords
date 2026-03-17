"""Hello Words — TOEIC 700 PDF"""
import json, io, os, re
from fpdf import FPDF
from fpdf.enums import Corner
import qrcode

# ── 설정 ──────────────────────────────────────────────────────────────
LEVEL      = '700'
DATA_FILE  = f'words_{LEVEL}.json'
OUTPUT_PDF = f'HelloWords_TOEIC_{LEVEL}.pdf'
QR_BASE    = 'https://studioroomkr.com/w/3fAbnF/word.html?w='

COLORS = ['#D06090', '#5098C0', '#50A878', '#D08840', '#7070C8']

FONT_EN   = 'C:/Windows/Fonts/NotoSans-Regular.ttf'
FONT_ENB  = 'C:/Windows/Fonts/NotoSans-Bold.ttf'
FONT_ENI  = 'C:/Windows/Fonts/NotoSans-Italic.ttf'
FONT_KO   = 'PretendardR.ttf'
FONT_KOB  = 'PretendardB.ttf'

PAGE_W, PAGE_H = 210, 297
CW, CH   = 51, 76
COLS, ROWS = 4, 3
MX = (PAGE_W - COLS * CW) / 2
MY = (PAGE_H - ROWS * CH) / 2

PX   = 2.4
IW   = CW - PX*2
R    = 2.8
BAND = 9.0
FOLD = 53.0

ALL4  = (Corner.TOP_LEFT, Corner.TOP_RIGHT, Corner.BOTTOM_LEFT, Corner.BOTTOM_RIGHT)
TOP2  = (Corner.TOP_LEFT, Corner.TOP_RIGHT)
BOT2  = (Corner.BOTTOM_LEFT, Corner.BOTTOM_RIGHT)

# ── 유틸 ──────────────────────────────────────────────────────────────
def h2r(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def pastel(r, g, b, a=0.12):
    return (int(r*a+255*(1-a)), int(g*a+255*(1-a)), int(b*a+255*(1-a)))

def fit_sz(pdf, text, max_w, start, stop=5):
    s = float(start)
    while s >= stop:
        pdf.set_font_size(s)
        if pdf.get_string_width(text) <= max_w:
            return s
        s -= 0.5
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

# ── 예문 하이라이트 렌더 ──────────────────────────────────────────────
def render_hl(pdf, text, target, cx, y, max_w, lh, fsz, hi_rgb, limit_y):
    base = re.escape(target.lower().replace('-', ' '))
    pat  = re.compile(r'\b(' + base + r'(?:s|ed|er|ing|ly|tion|ness|ment|ies)?\b)', re.I)
    segs = []
    last = 0
    for m in pat.finditer(text):
        if m.start() > last: segs.append((text[last:m.start()], False))
        segs.append((m.group(), True))
        last = m.end()
    if last < len(text): segs.append((text[last:], False))

    words = []
    for seg, hl in segs:
        for p in re.split(r'(\s+)', seg):
            if p: words.append((p, hl))

    cur_x = cx
    for w_str, hl in words:
        if not w_str.strip():
            pdf.set_font('NotoSans', size=fsz)
            sp = pdf.get_string_width(' ')
            if cur_x + sp > cx + max_w: cur_x = cx; y += lh
            else: cur_x += sp
            if y >= limit_y: return limit_y
            continue
        if hl:
            pdf.set_font('NotoSansBold', size=fsz)
            pdf.set_text_color(*hi_rgb)
        else:
            pdf.set_font('NotoSans', size=fsz)
            pdf.set_text_color(30, 30, 30)
        ww = pdf.get_string_width(w_str)
        if cur_x + ww > cx + max_w and cur_x > cx:
            cur_x = cx; y += lh
        if y >= limit_y: return limit_y
        pdf.set_xy(cur_x, y)
        pdf.cell(ww, lh, w_str)
        cur_x += ww
    return y + lh

# ── 카드 1장 ──────────────────────────────────────────────────────────
def draw_card(pdf, wd, cx, cy, color_hex):
    r, g, b = h2r(color_hex)
    pr, pg, pb = pastel(r, g, b, 0.10)

    # 카드 외곽
    pdf.set_fill_color(255, 255, 255)
    pdf.set_draw_color(230, 230, 230)
    pdf.set_line_width(0.22)
    pdf.rect(cx, cy, CW, CH, style='FD', round_corners=ALL4, corner_radius=R)

    # 상단 컬러 밴드
    pdf.set_fill_color(r, g, b)
    pdf.set_draw_color(r, g, b)
    pdf.set_line_width(0)
    pdf.rect(cx, cy, CW, BAND, style='F', round_corners=TOP2, corner_radius=R)

    bm     = cy + BAND * 0.5
    cell_h = 4.5
    cell_y = bm - cell_h / 2   # 밴드 세로 중앙 기준, EN·600 공통 y

    # EN 뱃지 (흰 pill)
    bw = 7.5
    pdf.set_fill_color(255, 255, 255)
    pdf.set_draw_color(255, 255, 255)
    pdf.rect(cx + PX, cell_y, bw, cell_h, style='F', round_corners=ALL4, corner_radius=2.0)
    pdf.set_font('NotoSansBold', size=5.5)
    pdf.set_text_color(r, g, b)
    pdf.set_xy(cx + PX, cell_y)
    pdf.cell(bw, cell_h, 'EN', align='C')

    # "600" 레벨 (같은 cell_y → 줄 정렬)
    pdf.set_font('NotoSansBold', size=7.5)
    pdf.set_text_color(255, 255, 255)
    pdf.set_xy(cx + PX + bw + 2.0, cell_y)
    pdf.cell(14, cell_h, LEVEL, align='L')

    # 상단 우측 QR (흰색, 밴드 색상 배경)
    QR_BAND = 7.5
    qr_buf_top = make_qr(QR_BASE + wd.get('word','').lower().replace(' ','-'),
                         'white', color_hex)
    qr_bx = cx + CW - QR_BAND - 1.0
    qr_by = cy + (BAND - QR_BAND) / 2
    pdf.image(qr_buf_top, x=qr_bx, y=qr_by, w=QR_BAND, h=QR_BAND)

    # ── 단어 (한줄 고정, 폰트 자동 축소) ──────────────────────────────
    word = wd.get('word', '')
    wy   = cy + BAND + 2.2
    pdf.set_text_color(12, 12, 12)
    pdf.set_font('NotoSansBold')
    pdf.set_char_spacing(-0.4)            # 자간 살짝 좁힘
    wsz  = fit_sz(pdf, word, IW, 21, 5)
    wlh  = wsz * 0.50
    pdf.set_font_size(wsz)
    pdf.set_xy(cx + PX, wy)
    pdf.cell(IW, wlh, word, align='L')
    pdf.set_char_spacing(0)               # 자간 리셋
    after_word = wy + wlh

    # ── 발음기호 + 품사 ─────────────────────────────────────────────────
    phonetic = (wd.get('pronunciation') or wd.get('phonetic') or '').strip()
    pos      = wd.get('pos', '').strip()
    ph_y     = after_word + 1.2

    # 발음기호 (이탤릭 회색)
    pdf.set_font('NotoSansItalic', size=5.5)
    pdf.set_text_color(155, 155, 155)
    pdf.set_xy(cx + PX, ph_y)
    pdf.cell(IW, 3.5, phonetic, align='L')

    # 품사 뱃지 (우측 정렬, 컬러)
    if pos:
        pdf.set_font('NotoSansBold', size=5.0)
        pdf.set_text_color(r, g, b)
        pw = pdf.get_string_width(pos) + 3.0
        pdf.set_fill_color(*pastel(r, g, b, 0.18))
        pdf.set_draw_color(r, g, b)
        pdf.set_line_width(0.15)
        px_ = cx + CW - PX - pw
        pdf.rect(px_, ph_y + 0.3, pw, 3.0, style='FD', round_corners=ALL4, corner_radius=1.2)
        pdf.set_xy(px_, ph_y + 0.3)
        pdf.cell(pw, 3.0, pos, align='C')

    # ── 예문 2개 (각 예문 앞에 상황 라벨) ─────────────────────────────
    examples = wd.get('examples', [])
    ex_y     = ph_y + 4.5
    ex_lim   = cy + FOLD - 1.5

    for idx in range(min(2, len(examples))):
        if ex_y >= ex_lim - 4: break
        ex = examples[idx]

        # 상황 라벨 (있을 때만)
        sit = ex.get('situation', '').strip()
        if sit and ex_y < ex_lim - 3:
            sit_str = sit[:30] + ('...' if len(sit) > 30 else '')
            pdf.set_font('HanDotum', size=4.5)
            pdf.set_text_color(r, g, b)
            pdf.set_xy(cx + PX, ex_y)
            pdf.cell(IW, 3.0, '+ ' + sit_str, align='L')
            ex_y += 3.0

        if ex_y >= ex_lim: break

        # 영어 예문 (단어 하이라이트)
        en_text = ex.get('en', '')
        ex_y = render_hl(pdf, en_text, word, cx + PX, ex_y,
                         IW, 3.0, 4.8, (r, g, b), ex_lim)
        if ex_y >= ex_lim: break

        # 한국어 예문
        ko_text = ex.get('ko', '')
        avail = ex_lim - ex_y
        if avail >= 2.5 and ko_text:
            pdf.set_font('HanDotum', size=4.5)
            pdf.set_text_color(140, 140, 140)
            pdf.set_xy(cx + PX, ex_y)
            pdf.multi_cell(IW, 2.8, ko_text, align='L', max_line_height=2.8)
            ex_y = min(pdf.get_y(), ex_lim) + 1.6

    # ── 접기선 ─────────────────────────────────────────────────────────
    fold_y = cy + FOLD
    pdf.set_draw_color(210, 210, 210)
    pdf.set_line_width(0.15)
    d = 1.5
    x = cx + 1
    while x < cx + CW - 1:
        pdf.line(x, fold_y, min(x+d, cx+CW-1), fold_y)
        x += d * 2


# ── 하단 배경 ──────────────────────────────────────────────────────
    bot_y = fold_y + 0.3
    bot_h = CH - FOLD - 0.3
    pdf.set_fill_color(pr, pg, pb)
    pdf.set_draw_color(pr, pg, pb)
    pdf.rect(cx, bot_y, CW, bot_h, style='F', round_corners=BOT2, corner_radius=R)

    # ── 뜻 (대형 한국어 bold, 전체 너비) ─────────────────────────────
    meaning = wd.get('meaning', '')
    m_y     = bot_y + 2.8

    pdf.set_text_color(12, 12, 12)
    pdf.set_font('HanDotumBold')
    msz = fit_sz(pdf, meaning, IW, 12, 6)
    pdf.set_font_size(msz)
    pdf.set_xy(cx + PX, m_y)
    pdf.multi_cell(IW, msz * 0.44, meaning, align='L')
    meaning_end_y = pdf.get_y()

    # ── 동의어 pills (뜻 끝 기준, 공간 없으면 생략) ───────────────────
    hw_y  = cy + CH - 5.2
    syn_y = meaning_end_y + 1.2
    synonyms = wd.get('synonyms', [])[:4] if syn_y + 3.6 <= hw_y - 0.8 else []
    sx    = cx + PX
    pr2, pg2, pb2 = pastel(r, g, b, 0.22)
    pdf.set_font('NotoSans', size=4.3)
    for syn in synonyms:
        sw = pdf.get_string_width(syn) + 3.2
        if sx + sw > cx + CW - PX: break
        pdf.set_fill_color(pr2, pg2, pb2)
        pdf.set_draw_color(r, g, b)
        pdf.set_line_width(0.18)
        pdf.rect(sx, syn_y, sw, 3.6, style='FD', round_corners=ALL4, corner_radius=1.6)
        pdf.set_text_color(r, g, b)
        pdf.set_xy(sx, syn_y + 0.1)
        pdf.cell(sw, 3.4, syn, align='C')
        sx += sw + 1.4

    # ── "Hello Words" (이탤릭, 컬러) ─────────────────────────────────
    pdf.set_font('NotoSansItalic', size=5.2)
    pdf.set_text_color(r, g, b)
    pdf.set_xy(cx + PX, hw_y)
    pdf.cell(IW, 4, 'Hello Words', align='L')


# ── 메인 ──────────────────────────────────────────────────────────────
def main():
    with open(DATA_FILE, encoding='utf-8') as f:
        data = json.load(f)
    words = data['words']


    pdf = FPDF(orientation='P', unit='mm', format='A4')
    pdf.set_auto_page_break(False)
    pdf.set_margins(0, 0, 0)
    pdf.add_font('NotoSans',        fname=FONT_EN)
    pdf.add_font('NotoSansBold',    fname=FONT_ENB)
    pdf.add_font('NotoSansItalic',  fname=FONT_ENI)
    pdf.add_font('HanDotum',      fname=FONT_KO)
    pdf.add_font('HanDotumBold',  fname=FONT_KOB)

    PER   = COLS * ROWS
    total = (len(words) + PER - 1) // PER

    for pg in range(total):
        pdf.add_page()
        for i, wd in enumerate(words[pg*PER:(pg+1)*PER]):
            cx = MX + (i % COLS) * CW
            cy = MY + (i // COLS) * CH
            draw_card(pdf, wd, cx, cy, COLORS[(pg*PER+i) % len(COLORS)])
        print(f'  {pg+1}/{total} page')

    pdf.output(OUTPUT_PDF)
    print(f'Done: {OUTPUT_PDF}  ({os.path.getsize(OUTPUT_PDF)/1024/1024:.1f} MB)')

if __name__ == '__main__':
    main()
