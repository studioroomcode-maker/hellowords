from __future__ import annotations

import csv
import json
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
SOURCE_PATH = BASE_DIR / "topik_jp_data.json"
JSON_OUT = BASE_DIR / "topik_jp_translation_queue.json"
CSV_OUT = BASE_DIR / "topik_jp_translation_queue.csv"
MD_OUT = BASE_DIR / "topik_jp_translation_queue.md"
HANGUL_RE = re.compile(r"[가-힣]")


def norm(text: str) -> str:
    return unicodedata.normalize("NFC", text or "").strip()


def issue_reason(ko: str, tl: str) -> str | None:
    ko_norm = norm(ko)
    tl_norm = norm(tl)
    if not tl_norm:
        return "empty_translation"
    if tl_norm == ko_norm:
        return "same_as_korean"
    if HANGUL_RE.search(tl_norm):
        return "contains_hangul"
    return None


def collect_rows(data: dict) -> list[dict]:
    rows: list[dict] = []

    for word, item in data.items():
        level = str(item.get("level", ""))
        meaning = item.get("meaning", "")

        top_reason = issue_reason(item.get("example_ko", ""), item.get("example_tl", ""))
        if top_reason:
            rows.append(
                {
                    "word": word,
                    "level": level,
                    "meaning": meaning,
                    "field": "example_tl",
                    "example_index": "",
                    "situation": item.get("situation", ""),
                    "ko": norm(item.get("example_ko", "")),
                    "current_tl": norm(item.get("example_tl", "")),
                    "reason": top_reason,
                }
            )

        for idx, ex in enumerate(item.get("examples", []), start=1):
            reason = issue_reason(ex.get("ko", ""), ex.get("tl", ""))
            if not reason:
                continue
            rows.append(
                {
                    "word": word,
                    "level": level,
                    "meaning": meaning,
                    "field": "examples.tl",
                    "example_index": idx,
                    "situation": ex.get("situation", ""),
                    "ko": norm(ex.get("ko", "")),
                    "current_tl": norm(ex.get("tl", "")),
                    "reason": reason,
                }
            )

    rows.sort(key=lambda row: (int(row["level"]), row["word"], row["field"], str(row["example_index"])))
    return rows


def build_word_groups(rows: list[dict]) -> list[dict]:
    grouped: dict[tuple[str, str], list[dict]] = defaultdict(list)
    meanings: dict[tuple[str, str], str] = {}

    for row in rows:
        key = (row["level"], row["word"])
        grouped[key].append(row)
        meanings[key] = row["meaning"]

    items = []
    for (level, word), issues in sorted(grouped.items(), key=lambda item: (int(item[0][0]), item[0][1])):
        items.append(
            {
                "level": level,
                "word": word,
                "meaning": meanings[(level, word)],
                "issue_count": len(issues),
                "issues": issues,
            }
        )
    return items


def write_json(summary: dict, items: list[dict]) -> None:
    payload = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "source_file": SOURCE_PATH.name,
        "summary": summary,
        "items": items,
    }
    JSON_OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def write_csv(rows: list[dict]) -> None:
    fieldnames = ["word", "level", "meaning", "field", "example_index", "situation", "ko", "current_tl", "reason"]
    with CSV_OUT.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def write_md(summary: dict, items: list[dict]) -> None:
    lines = [
        "# TOPIK JP Translation Queue",
        "",
        f"- Generated: {datetime.now().isoformat(timespec='seconds')}",
        f"- Source: `{SOURCE_PATH.name}`",
        f"- Affected words: {summary['affected_words']}",
        f"- Queue rows: {summary['queue_rows']}",
        "",
        "## Level Summary",
        "",
        "| Level | Affected Words | Queue Rows |",
        "|---|---:|---:|",
    ]

    for level in ["1", "2", "3", "4", "5", "6"]:
        lines.append(
            f"| {level} | {summary['per_level'][level]['affected_words']} | {summary['per_level'][level]['queue_rows']} |"
        )

    lines.extend(
        [
            "",
            "## Reason Summary",
            "",
            "| Reason | Rows |",
            "|---|---:|",
        ]
    )
    for reason, count in summary["reasons"].items():
        lines.append(f"| {reason} | {count} |")

    lines.extend(["", "## Sample Items", ""])
    for item in items[:20]:
        first = item["issues"][0]
        idx_label = f"EX {first['example_index']}" if first["example_index"] else "TOP"
        lines.append(f"- LV {item['level']} `{item['word']}`: {idx_label} / {first['reason']} / {first['ko']}")

    MD_OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    data = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    rows = collect_rows(data)
    items = build_word_groups(rows)

    per_level = {str(i): {"affected_words": 0, "queue_rows": 0} for i in range(1, 7)}
    seen_words = set()
    reasons = Counter(row["reason"] for row in rows)

    for row in rows:
        level = row["level"]
        per_level[level]["queue_rows"] += 1
        word_key = (level, row["word"])
        if word_key not in seen_words:
            per_level[level]["affected_words"] += 1
            seen_words.add(word_key)

    summary = {
        "affected_words": len(items),
        "queue_rows": len(rows),
        "per_level": per_level,
        "reasons": dict(reasons),
    }

    write_json(summary, items)
    write_csv(rows)
    write_md(summary, items)

    print(f"Wrote {JSON_OUT.name}")
    print(f"Wrote {CSV_OUT.name}")
    print(f"Wrote {MD_OUT.name}")
    print(summary)


if __name__ == "__main__":
    main()
