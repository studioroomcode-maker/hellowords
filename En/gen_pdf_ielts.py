"""Hello Words - IELTS PDF generator."""
import io
import json
import os
import re
import sys
from pathlib import Path

from fpdf import FPDF
from fpdf.enums import Corner
import qrcode


BASE_DIR = Path(__file__).resolve().parent

CONFIGS = {
    "5": {
        "data_file": "ielts_5.json",
        "output_pdf": "HelloWords_IELTS_5.pdf",
        "qr_base": "https://studioroomkr.com/ielts/word.html?band=5&w=",
        "colors": ["#67B97A", "#86C96A", "#4EAD8E", "#79B3D9", "#A0C56A"],
    },
    "6": {
        "data_file": "ielts_6.json",
        "output_pdf": "HelloWords_IELTS_6.pdf",
        "qr_base": "https://studioroomkr.com/ielts/word.html?band=6&w=",
        "colors": ["#4A9EFF", "#6FB8FF", "#64C1B0", "#F2A65A", "#B38BFA"],
    },
    "7": {
        "data_file": "ielts_7.json",
        "output_pdf": "HelloWords_IELTS_7.pdf",
        "qr_base": "https://studioroomkr.com/ielts/word.html?band=7&w=",
        "colors": ["#FF7043", "#F39B62", "#D97EBC", "#7F8CFF", "#4FB6C2"],
    },
}

FONT_EN = "C:/Windows/Fonts/NotoSans-Regular.ttf"
FONT_ENB = "C:/Windows/Fonts/NotoSans-Bold.ttf"
FONT_ENI = "C:/Windows/Fonts/NotoSans-Italic.ttf"
FONT_KO = str(BASE_DIR / "PretendardR.ttf")
FONT_KOB = str(BASE_DIR / "PretendardB.ttf")

PAGE_W, PAGE_H = 210, 297
CW, CH = 51, 76
COLS, ROWS = 4, 3
MX = (PAGE_W - COLS * CW) / 2
MY = (PAGE_H - ROWS * CH) / 2

PX = 2.4
IW = CW - PX * 2
R = 2.8
BAND = 9.0
FOLD = 53.0

ALL4 = (Corner.TOP_LEFT, Corner.TOP_RIGHT, Corner.BOTTOM_LEFT, Corner.BOTTOM_RIGHT)
TOP2 = (Corner.TOP_LEFT, Corner.TOP_RIGHT)
BOT2 = (Corner.BOTTOM_LEFT, Corner.BOTTOM_RIGHT)


def h2r(value):
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def pastel(r, g, b, alpha=0.12):
    return (
        int(r * alpha + 255 * (1 - alpha)),
        int(g * alpha + 255 * (1 - alpha)),
        int(b * alpha + 255 * (1 - alpha)),
    )


def fit_sz(pdf, text, max_w, start, stop=5):
    size = float(start)
    while size >= stop:
        pdf.set_font_size(size)
        if pdf.get_string_width(text) <= max_w:
            return size
        size -= 0.5
    return stop


def slug(word):
    return word.strip().lower().replace(" ", "-")


def make_qr(url, fill_color, back_color="white"):
    qr = qrcode.QRCode(
        version=2,
        box_size=3,
        border=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color=fill_color, back_color=back_color)
    buf = io.BytesIO()
    img.save(buf, "PNG")
    buf.seek(0)
    return buf


def render_hl(pdf, text, target, cx, y, max_w, lh, fsz, hi_rgb, limit_y):
    base = re.escape(target.lower().replace("-", " "))
    pattern = re.compile(r"\b(" + base + r"(?:s|ed|er|ing|ly|tion|ness|ment|ies)?\b)", re.I)
    segments = []
    last = 0
    for match in pattern.finditer(text):
        if match.start() > last:
            segments.append((text[last:match.start()], False))
        segments.append((match.group(), True))
        last = match.end()
    if last < len(text):
        segments.append((text[last:], False))

    words = []
    for seg, highlight in segments:
        for part in re.split(r"(\s+)", seg):
            if part:
                words.append((part, highlight))

    cur_x = cx
    for chunk, highlight in words:
        if not chunk.strip():
            pdf.set_font("NotoSans", size=fsz)
            space_w = pdf.get_string_width(" ")
            if cur_x + space_w > cx + max_w:
                cur_x = cx
                y += lh
            else:
                cur_x += space_w
            if y >= limit_y:
                return limit_y
            continue

        if highlight:
            pdf.set_font("NotoSansBold", size=fsz)
            pdf.set_text_color(*hi_rgb)
        else:
            pdf.set_font("NotoSans", size=fsz)
            pdf.set_text_color(30, 30, 30)

        chunk_w = pdf.get_string_width(chunk)
        if cur_x + chunk_w > cx + max_w and cur_x > cx:
            cur_x = cx
            y += lh
        if y >= limit_y:
            return limit_y

        pdf.set_xy(cur_x, y)
        pdf.cell(chunk_w, lh, chunk)
        cur_x += chunk_w

    return y + lh


def draw_card(pdf, word_data, cx, cy, color_hex, band_label):
    r, g, b = h2r(color_hex)
    pr, pg, pb = pastel(r, g, b, 0.10)

    pdf.set_fill_color(255, 255, 255)
    pdf.set_draw_color(230, 230, 230)
    pdf.set_line_width(0.22)
    pdf.rect(cx, cy, CW, CH, style="FD", round_corners=ALL4, corner_radius=R)

    pdf.set_fill_color(r, g, b)
    pdf.set_draw_color(r, g, b)
    pdf.set_line_width(0)
    pdf.rect(cx, cy, CW, BAND, style="F", round_corners=TOP2, corner_radius=R)

    band_mid = cy + BAND * 0.5
    cell_h = 4.5
    cell_y = band_mid - cell_h / 2

    exam_label = "IELTS"
    pdf.set_font("NotoSansBold", size=4.8)
    badge_w = pdf.get_string_width(exam_label) + 4.0
    pdf.set_fill_color(255, 255, 255)
    pdf.set_draw_color(255, 255, 255)
    pdf.rect(cx + PX, cell_y, badge_w, cell_h, style="F", round_corners=ALL4, corner_radius=2.0)
    pdf.set_text_color(r, g, b)
    pdf.set_xy(cx + PX, cell_y)
    pdf.cell(badge_w, cell_h, exam_label, align="C")

    pdf.set_font("NotoSansBold", size=7.5)
    pdf.set_text_color(255, 255, 255)
    pdf.set_xy(cx + PX + badge_w + 1.8, cell_y)
    pdf.cell(12, cell_h, band_label, align="L")

    qr_buf_top = make_qr(pdf.qr_base + slug(word_data.get("word", "")), "white", color_hex)
    qr_size = 7.5
    qr_x = cx + CW - qr_size - 1.0
    qr_y = cy + (BAND - qr_size) / 2
    pdf.image(qr_buf_top, x=qr_x, y=qr_y, w=qr_size, h=qr_size)

    word = word_data.get("word", "")
    word_y = cy + BAND + 2.2
    pdf.set_text_color(12, 12, 12)
    pdf.set_font("NotoSansBold")
    pdf.set_char_spacing(-0.4)
    word_size = fit_sz(pdf, word, IW, 21, 5)
    word_lh = word_size * 0.50
    pdf.set_font_size(word_size)
    pdf.set_xy(cx + PX, word_y)
    pdf.cell(IW, word_lh, word, align="L")
    pdf.set_char_spacing(0)
    after_word = word_y + word_lh

    phonetic = (word_data.get("pronunciation") or word_data.get("phonetic") or "").strip()
    pos = word_data.get("pos", "").strip()
    ph_y = after_word + 1.2

    pdf.set_font("NotoSansItalic", size=5.5)
    pdf.set_text_color(155, 155, 155)
    pdf.set_xy(cx + PX, ph_y)
    pdf.cell(IW, 3.5, phonetic, align="L")

    if pos:
        pdf.set_font("NotoSansBold", size=5.0)
        pdf.set_text_color(r, g, b)
        pos_w = pdf.get_string_width(pos) + 3.0
        pdf.set_fill_color(*pastel(r, g, b, 0.18))
        pdf.set_draw_color(r, g, b)
        pdf.set_line_width(0.15)
        pos_x = cx + CW - PX - pos_w
        pdf.rect(pos_x, ph_y + 0.3, pos_w, 3.0, style="FD", round_corners=ALL4, corner_radius=1.2)
        pdf.set_xy(pos_x, ph_y + 0.3)
        pdf.cell(pos_w, 3.0, pos, align="C")

    examples = word_data.get("examples", [])
    ex_y = ph_y + 4.5
    ex_lim = cy + FOLD - 1.5

    for idx in range(min(2, len(examples))):
        if ex_y >= ex_lim - 4:
            break
        ex = examples[idx]

        sit = ex.get("situation", "").strip()
        if sit and ex_y < ex_lim - 3:
            sit_str = sit[:30] + ("..." if len(sit) > 30 else "")
            pdf.set_font("HanDotum", size=4.5)
            pdf.set_text_color(r, g, b)
            pdf.set_xy(cx + PX, ex_y)
            pdf.cell(IW, 3.0, "+ " + sit_str, align="L")
            ex_y += 3.0

        if ex_y >= ex_lim:
            break

        en_text = ex.get("en", "")
        ex_y = render_hl(pdf, en_text, word, cx + PX, ex_y, IW, 3.0, 4.8, (r, g, b), ex_lim)
        if ex_y >= ex_lim:
            break

        ko_text = ex.get("ko", "")
        avail = ex_lim - ex_y
        if avail >= 2.5 and ko_text:
            pdf.set_font("HanDotum", size=4.5)
            pdf.set_text_color(140, 140, 140)
            pdf.set_xy(cx + PX, ex_y)
            pdf.multi_cell(IW, 2.8, ko_text, align="L", max_line_height=2.8)
            ex_y = min(pdf.get_y(), ex_lim) + 1.6

    fold_y = cy + FOLD
    pdf.set_draw_color(210, 210, 210)
    pdf.set_line_width(0.15)
    dash = 1.5
    x = cx + 1
    while x < cx + CW - 1:
        pdf.line(x, fold_y, min(x + dash, cx + CW - 1), fold_y)
        x += dash * 2

    bot_y = fold_y + 0.3
    bot_h = CH - FOLD - 0.3
    pdf.set_fill_color(pr, pg, pb)
    pdf.set_draw_color(pr, pg, pb)
    pdf.rect(cx, bot_y, CW, bot_h, style="F", round_corners=BOT2, corner_radius=R)

    meaning = word_data.get("meaning", "")
    meaning_y = bot_y + 2.8
    pdf.set_text_color(12, 12, 12)
    pdf.set_font("HanDotumBold")
    meaning_size = fit_sz(pdf, meaning, IW, 12, 6)
    pdf.set_font_size(meaning_size)
    pdf.set_xy(cx + PX, meaning_y)
    pdf.multi_cell(IW, meaning_size * 0.44, meaning, align="L")
    meaning_end_y = pdf.get_y()

    hello_y = cy + CH - 5.2
    syn_y = meaning_end_y + 1.2
    synonyms = word_data.get("synonyms", [])[:4] if syn_y + 3.6 <= hello_y - 0.8 else []
    syn_x = cx + PX
    pr2, pg2, pb2 = pastel(r, g, b, 0.22)
    pdf.set_font("NotoSans", size=4.3)
    for syn in synonyms:
        syn_w = pdf.get_string_width(syn) + 3.2
        if syn_x + syn_w > cx + CW - PX:
            break
        pdf.set_fill_color(pr2, pg2, pb2)
        pdf.set_draw_color(r, g, b)
        pdf.set_line_width(0.18)
        pdf.rect(syn_x, syn_y, syn_w, 3.6, style="FD", round_corners=ALL4, corner_radius=1.6)
        pdf.set_text_color(r, g, b)
        pdf.set_xy(syn_x, syn_y + 0.1)
        pdf.cell(syn_w, 3.4, syn, align="C")
        syn_x += syn_w + 1.4

    pdf.set_font("NotoSansItalic", size=5.2)
    pdf.set_text_color(r, g, b)
    pdf.set_xy(cx + PX, hello_y)
    pdf.cell(IW, 4, "Hello Words", align="L")


def main(band=None):
    band = band or (sys.argv[1] if len(sys.argv) > 1 else "")
    if band not in CONFIGS:
        raise SystemExit("Usage: python gen_pdf_ielts.py <5|6|7>")

    config = CONFIGS[band]
    data = json.loads((BASE_DIR / config["data_file"]).read_text(encoding="utf-8"))
    words = data["words"]

    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.qr_base = config["qr_base"]
    pdf.set_auto_page_break(False)
    pdf.set_margins(0, 0, 0)
    pdf.add_font("NotoSans", fname=FONT_EN)
    pdf.add_font("NotoSansBold", fname=FONT_ENB)
    pdf.add_font("NotoSansItalic", fname=FONT_ENI)
    pdf.add_font("HanDotum", fname=FONT_KO)
    pdf.add_font("HanDotumBold", fname=FONT_KOB)

    per_page = COLS * ROWS
    total_pages = (len(words) + per_page - 1) // per_page

    for page_idx in range(total_pages):
        pdf.add_page()
        for i, word_data in enumerate(words[page_idx * per_page:(page_idx + 1) * per_page]):
            cx = MX + (i % COLS) * CW
            cy = MY + (i // COLS) * CH
            color = config["colors"][(page_idx * per_page + i) % len(config["colors"])]
            draw_card(pdf, word_data, cx, cy, color, band)
        print(f"  {page_idx + 1}/{total_pages} page")

    out_path = BASE_DIR / config["output_pdf"]
    pdf.output(str(out_path))
    print(f"Done: {out_path.name} ({os.path.getsize(out_path) / 1024 / 1024:.1f} MB)")


if __name__ == "__main__":
    main()
