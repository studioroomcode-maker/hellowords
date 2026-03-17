"""Hello Words - TOPIK Japanese PDF generator."""
from __future__ import annotations

import io
import json
import os
import re
import sys
from pathlib import Path
from urllib.parse import quote

from fpdf import FPDF
from fpdf.enums import Corner
import qrcode


BASE_DIR = Path(__file__).resolve().parent

CONFIGS = {
    "1": {
        "data_file": "level_data/topik_jp_lv1.json",
        "output_pdf": "HelloWords_TOPIK_JP_1.pdf",
        "qr_base": "https://studioroomkr.com/topik/word.html?lang=jp&level=1&w=",
        "colors": ["#67B97A", "#86C96A", "#6AC3A3", "#78CBE6", "#A6D96A"],
    },
    "2": {
        "data_file": "level_data/topik_jp_lv2.json",
        "output_pdf": "HelloWords_TOPIK_JP_2.pdf",
        "qr_base": "https://studioroomkr.com/topik/word.html?lang=jp&level=2&w=",
        "colors": ["#67B97A", "#7EC78B", "#5FB2A3", "#82C8F2", "#B9D86B"],
    },
    "3": {
        "data_file": "level_data/topik_jp_lv3.json",
        "output_pdf": "HelloWords_TOPIK_JP_3.pdf",
        "qr_base": "https://studioroomkr.com/topik/word.html?lang=jp&level=3&w=",
        "colors": ["#4A9EFF", "#6FB8FF", "#64C1B0", "#8AB0FF", "#7DC7E6"],
    },
    "4": {
        "data_file": "level_data/topik_jp_lv4.json",
        "output_pdf": "HelloWords_TOPIK_JP_4.pdf",
        "qr_base": "https://studioroomkr.com/topik/word.html?lang=jp&level=4&w=",
        "colors": ["#4A9EFF", "#79B3D9", "#70C5DA", "#8F9CFF", "#7AB6F8"],
    },
    "5": {
        "data_file": "level_data/topik_jp_lv5.json",
        "output_pdf": "HelloWords_TOPIK_JP_5.pdf",
        "qr_base": "https://studioroomkr.com/topik/word.html?lang=jp&level=5&w=",
        "colors": ["#FF7043", "#F39B62", "#D97EBC", "#F2A65A", "#FFB36B"],
    },
    "6": {
        "data_file": "level_data/topik_jp_lv6.json",
        "output_pdf": "HelloWords_TOPIK_JP_6.pdf",
        "qr_base": "https://studioroomkr.com/topik/word.html?lang=jp&level=6&w=",
        "colors": ["#FF7043", "#E8895E", "#C97BC4", "#A688F8", "#4FB6C2"],
    },
}

FONT_EN = "C:/Windows/Fonts/NotoSans-Regular.ttf"
FONT_ENB = "C:/Windows/Fonts/NotoSans-Bold.ttf"
FONT_CJK = str(BASE_DIR / "PretendardR.ttf")
FONT_CJKB = str(BASE_DIR / "PretendardB.ttf")
FONT_JP = "C:/Windows/Fonts/NotoSansJP-Regular.otf"
FONT_JPB = "C:/Windows/Fonts/NotoSansJP-Bold.otf"
DEBUG_FONT = os.getenv("TOPIK_PDF_DEBUG") == "1"
JP_HINT_RE = re.compile(r"[ぁ-んァ-ンー。、々]")
HANGUL_RE = re.compile(r"[가-힣]")

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


def h2r(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def pastel(r: int, g: int, b: int, alpha: float = 0.12) -> tuple[int, int, int]:
    return (
        int(r * alpha + 255 * (1 - alpha)),
        int(g * alpha + 255 * (1 - alpha)),
        int(b * alpha + 255 * (1 - alpha)),
    )


def fit_sz(pdf: FPDF, text: str, max_w: float, start: float, stop: float = 5) -> float:
    size = float(start)
    while size >= stop:
        pdf.set_font_size(size)
        if pdf.get_string_width(text) <= max_w:
            return size
        size -= 0.5
    return stop


def encode_word(word: str) -> str:
    return quote(word.strip(), safe="")


def make_qr(url: str, fill_color: str, back_color: str = "white") -> io.BytesIO:
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


def resolve_font(base_font: str, char: str) -> str:
    if base_font in {"JP", "JPBold"} and HANGUL_RE.search(char):
        return "CJKBold" if base_font == "JPBold" else "CJK"
    return base_font


def wrap_text(
    pdf: FPDF,
    text: str,
    max_w: float,
    max_lines: int,
    base_font: str,
    font_size: float,
) -> list[list[tuple[str, str]]]:
    text = (text or "").replace("\n", " ").strip()
    if not text:
        return []
    if DEBUG_FONT and JP_HINT_RE.search(text) and base_font in {"CJK", "CJKBold"}:
        raise RuntimeError(f"Japanese text measured with CJK font: {text}")

    lines: list[list[tuple[str, str]]] = []
    current_runs: list[tuple[str, str]] = []
    current_width = 0.0
    current_text = ""
    current_font = ""
    index = 0
    overflow = False

    while index < len(text):
        char = text[index]
        font_name = resolve_font(base_font, char)
        pdf.set_font(font_name, size=font_size)
        char_w = pdf.get_string_width(char)

        if current_runs or current_text:
            if current_width + char_w > max_w:
                if current_text:
                    current_runs.append((current_text, current_font))
                    current_text = ""
                lines.append(current_runs)
                current_runs = []
                current_width = 0.0
                current_font = ""
                if len(lines) == max_lines:
                    overflow = True
                    break

        if font_name != current_font and current_text:
            current_runs.append((current_text, current_font))
            current_text = ""

        current_font = font_name
        current_text += char
        current_width += char_w
        index += 1

    if not overflow and (current_text or current_runs):
        if current_text:
            current_runs.append((current_text, current_font))
        lines.append(current_runs)

    if overflow and lines:
        last_line = lines[-1]
        ellipsis_font = resolve_font(base_font, "…")
        pdf.set_font(ellipsis_font, size=font_size)
        ellipsis_w = pdf.get_string_width("…")
        while last_line:
            line_w = 0.0
            for segment, font_name in last_line:
                pdf.set_font(font_name, size=font_size)
                line_w += pdf.get_string_width(segment)
            if line_w + ellipsis_w <= max_w:
                break
            segment, font_name = last_line[-1]
            if len(segment) == 1:
                last_line.pop()
            else:
                last_line[-1] = (segment[:-1], font_name)
        if last_line and last_line[-1][1] == ellipsis_font:
            last_segment, _ = last_line[-1]
            last_line[-1] = (f"{last_segment}…", ellipsis_font)
        else:
            last_line.append(("…", ellipsis_font))

    return lines[:max_lines]


def draw_lines(
    pdf: FPDF,
    lines: list[list[tuple[str, str]]],
    x: float,
    y: float,
    line_h: float,
    font_size: float,
    color: tuple[int, int, int],
) -> float:
    pdf.set_text_color(*color)
    cur_y = y
    for line in lines:
        cur_x = x
        for segment, font_name in line:
            if not segment:
                continue
            if DEBUG_FONT and font_name in {"CJK", "CJKBold"} and JP_HINT_RE.search(segment):
                raise RuntimeError(f"Japanese text drawn with CJK font: {segment}")
            pdf.set_font(font_name, size=font_size)
            seg_w = pdf.get_string_width(segment)
            pdf.set_xy(cur_x, cur_y)
            pdf.cell(seg_w, line_h, segment, align="L")
            cur_x += seg_w
        cur_y += line_h
    return cur_y


def draw_block(
    pdf: FPDF,
    text: str,
    x: float,
    y: float,
    font_name: str,
    font_size: float,
    color: tuple[int, int, int],
    line_h: float,
    max_lines: int,
) -> float:
    lines = wrap_text(pdf, text, IW, max_lines, font_name, font_size)
    return draw_lines(pdf, lines, x, y, line_h, font_size, color)


def fit_block_size(
    pdf: FPDF,
    text: str,
    font_name: str,
    max_w: float,
    max_lines: int,
    start: float,
    stop: float,
) -> tuple[float, list[str]]:
    size = start
    while size >= stop:
        lines = wrap_text(pdf, text, max_w, max_lines, font_name, size)
        if lines:
            return size, lines
        size -= 0.5
    return stop, wrap_text(pdf, text, max_w, max_lines, font_name, stop)


def draw_card(pdf: FPDF, word_data: dict, cx: float, cy: float, color_hex: str, level_label: str) -> None:
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

    exam_label = "TOPIK"
    pdf.set_font("NotoSansBold", size=4.8)
    badge_w = pdf.get_string_width(exam_label) + 4.0
    pdf.set_fill_color(255, 255, 255)
    pdf.set_draw_color(255, 255, 255)
    pdf.rect(cx + PX, cell_y, badge_w, cell_h, style="F", round_corners=ALL4, corner_radius=2.0)
    pdf.set_text_color(r, g, b)
    pdf.set_xy(cx + PX, cell_y)
    pdf.cell(badge_w, cell_h, exam_label, align="C")

    pdf.set_font("CJKBold", size=7.0)
    pdf.set_text_color(255, 255, 255)
    pdf.set_xy(cx + PX + badge_w + 1.8, cell_y + 0.2)
    pdf.cell(12, cell_h, level_label, align="L")

    qr_buf_top = make_qr(pdf.qr_base + encode_word(word_data.get("word", "")), "white", color_hex)
    qr_size = 7.5
    qr_x = cx + CW - qr_size - 1.0
    qr_y = cy + (BAND - qr_size) / 2
    pdf.image(qr_buf_top, x=qr_x, y=qr_y, w=qr_size, h=qr_size)

    word = word_data.get("word", "")
    word_y = cy + BAND + 2.2
    pdf.set_text_color(12, 12, 12)
    pdf.set_font("CJKBold")
    word_size = fit_sz(pdf, word, IW, 20, 6)
    word_lh = word_size * 0.50
    pdf.set_font_size(word_size)
    pdf.set_xy(cx + PX, word_y)
    pdf.cell(IW, word_lh, word, align="L")
    after_word = word_y + word_lh

    phonetic = (word_data.get("phonetic") or "").strip()
    pos = (word_data.get("pos") or "").strip()
    ph_y = after_word + 1.2

    pdf.set_font("CJK", size=5.0)
    pdf.set_text_color(150, 150, 150)
    pdf.set_xy(cx + PX, ph_y)
    pdf.cell(IW, 3.4, phonetic, align="L")

    if pos:
      pdf.set_font("CJKBold", size=4.5)
      pdf.set_text_color(r, g, b)
      pos_w = pdf.get_string_width(pos) + 3.0
      pdf.set_fill_color(*pastel(r, g, b, 0.18))
      pdf.set_draw_color(r, g, b)
      pdf.set_line_width(0.15)
      pos_x = cx + CW - PX - pos_w
      pdf.rect(pos_x, ph_y + 0.2, pos_w, 2.9, style="FD", round_corners=ALL4, corner_radius=1.2)
      pdf.set_xy(pos_x, ph_y + 0.1)
      pdf.cell(pos_w, 3.0, pos, align="C")

    examples = word_data.get("examples", [])
    ex_y = ph_y + 4.1
    ex_lim = cy + FOLD - 1.5

    for idx, ex in enumerate(examples[:2]):
        if ex_y >= ex_lim - 5:
            break

        sit = (ex.get("situation") or "").strip()
        if sit:
            sit_lines = wrap_text(pdf, sit, IW, 1, "JP", 4.0)
            if sit_lines:
                sit_lines[0].insert(0, ("+ ", "JP"))
                ex_y = draw_lines(pdf, sit_lines, cx + PX, ex_y, 2.8, 4.0, (r, g, b))

        ko_y = draw_block(pdf, ex.get("ko", ""), cx + PX, ex_y, "JP", 4.5, (25, 25, 25), 2.8, 2)
        if ko_y >= ex_lim:
            break
        tl_y = draw_block(pdf, ex.get("tl", ""), cx + PX, ko_y, "JP", 3.8, (125, 125, 125), 2.5, 2)
        ex_y = tl_y + 1.2
        if ex_y >= ex_lim:
            break

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
    meaning_size, meaning_lines = fit_block_size(pdf, meaning, "JPBold", IW, 2, 10.5, 6.5)
    meaning_end_y = draw_lines(
        pdf,
        meaning_lines,
        cx + PX,
        meaning_y,
        meaning_size * 0.52,
        meaning_size,
        (12, 12, 12),
    )

    hello_y = cy + CH - 5.2
    syn_y = meaning_end_y + 1.1
    synonyms = word_data.get("synonyms", [])[:4] if syn_y + 3.6 <= hello_y - 0.8 else []
    syn_x = cx + PX
    pr2, pg2, pb2 = pastel(r, g, b, 0.22)
    for syn in synonyms:
        syn_lines = wrap_text(pdf, syn, IW, 1, "JP", 4.0)
        if not syn_lines:
            continue
        syn_w = 3.2
        for segment, font_name in syn_lines[0]:
            pdf.set_font(font_name, size=4.0)
            syn_w += pdf.get_string_width(segment)
        if syn_x + syn_w > cx + CW - PX:
            break
        pdf.set_fill_color(pr2, pg2, pb2)
        pdf.set_draw_color(r, g, b)
        pdf.set_line_width(0.18)
        pdf.rect(syn_x, syn_y, syn_w, 3.6, style="FD", round_corners=ALL4, corner_radius=1.6)
        pdf.set_text_color(r, g, b)
        draw_lines(pdf, syn_lines, syn_x + 1.6, syn_y + 0.2, 3.2, 4.0, (r, g, b))
        syn_x += syn_w + 1.4

    pdf.set_font("NotoSansBold", size=4.8)
    pdf.set_text_color(r, g, b)
    pdf.set_xy(cx + PX, hello_y)
    pdf.cell(IW, 4, "Hello Words · JP", align="L")


def main(level: str | None = None) -> None:
    level = level or (sys.argv[1] if len(sys.argv) > 1 else "")
    if level not in CONFIGS:
        raise SystemExit("Usage: python gen_pdf_topik_jp.py <1|2|3|4|5|6>")

    config = CONFIGS[level]
    data = json.loads((BASE_DIR / config["data_file"]).read_text(encoding="utf-8"))
    words = [value for _, value in sorted(data.items(), key=lambda item: item[0])]

    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.qr_base = config["qr_base"]
    pdf.set_auto_page_break(False)
    pdf.set_margins(0, 0, 0)
    pdf.add_font("NotoSans", fname=FONT_EN)
    pdf.add_font("NotoSansBold", fname=FONT_ENB)
    pdf.add_font("CJK", fname=FONT_CJK)
    pdf.add_font("CJKBold", fname=FONT_CJKB)
    pdf.add_font("JP", fname=FONT_JP)
    pdf.add_font("JPBold", fname=FONT_JPB)

    per_page = COLS * ROWS
    total_pages = (len(words) + per_page - 1) // per_page
    level_label = f"{level}급"

    for page_idx in range(total_pages):
        pdf.add_page()
        for i, word_data in enumerate(words[page_idx * per_page:(page_idx + 1) * per_page]):
            cx = MX + (i % COLS) * CW
            cy = MY + (i // COLS) * CH
            color = config["colors"][(page_idx * per_page + i) % len(config["colors"])]
            draw_card(pdf, word_data, cx, cy, color, level_label)
        print(f"  {page_idx + 1}/{total_pages} page")

    out_path = BASE_DIR / config["output_pdf"]
    pdf.output(str(out_path))
    print(f"Done: {out_path.name} ({os.path.getsize(out_path) / 1024 / 1024:.1f} MB)")


if __name__ == "__main__":
    main()
