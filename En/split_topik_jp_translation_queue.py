from __future__ import annotations

import csv
import json
from datetime import datetime
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
SOURCE_PATH = BASE_DIR / "topik_jp_translation_queue.json"
OUT_DIR = BASE_DIR / "topik_jp_translation_work"


def load_source() -> dict:
    return json.loads(SOURCE_PATH.read_text(encoding="utf-8"))


def ensure_out_dir() -> None:
    OUT_DIR.mkdir(exist_ok=True)


def build_level_payload(items: list[dict], level: str) -> tuple[list[dict], list[dict]]:
    word_items = []
    row_items = []

    for item in items:
        if item["level"] != level:
            continue

        issues = []
        for issue in item["issues"]:
            issue_copy = dict(issue)
            issue_copy["proposed_tl"] = ""
            issues.append(issue_copy)

            row = dict(issue_copy)
            row["word"] = item["word"]
            row["meaning"] = item["meaning"]
            row["issue_count_for_word"] = item["issue_count"]
            row_items.append(row)

        word_items.append(
            {
                "level": item["level"],
                "word": item["word"],
                "meaning": item["meaning"],
                "issue_count": item["issue_count"],
                "status": "pending",
                "notes": "",
                "issues": issues,
            }
        )

    return word_items, row_items


def write_json(level: str, word_items: list[dict], row_items: list[dict]) -> None:
    payload = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "source_file": SOURCE_PATH.name,
        "level": level,
        "summary": {
            "affected_words": len(word_items),
            "queue_rows": len(row_items),
        },
        "items": word_items,
    }
    out_path = OUT_DIR / f"topik_jp_lv{level}_translation_queue.json"
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def write_csv(level: str, row_items: list[dict]) -> None:
    out_path = OUT_DIR / f"topik_jp_lv{level}_translation_queue.csv"
    fieldnames = [
        "level",
        "word",
        "meaning",
        "field",
        "example_index",
        "situation",
        "ko",
        "current_tl",
        "proposed_tl",
        "reason",
        "issue_count_for_word",
    ]
    with out_path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(row_items)


def write_md(level: str, word_items: list[dict], row_items: list[dict]) -> None:
    out_path = OUT_DIR / f"topik_jp_lv{level}_translation_queue.md"
    lines = [
        f"# TOPIK JP LV{level} Translation Queue",
        "",
        f"- Generated: {datetime.now().isoformat(timespec='seconds')}",
        f"- Affected words: {len(word_items)}",
        f"- Queue rows: {len(row_items)}",
        "",
        "## Sample Words",
        "",
        "| Word | Meaning | Issue Count | First Korean Sentence |",
        "|---|---|---:|---|",
    ]

    for item in word_items[:40]:
        first_issue = item["issues"][0]
        ko = first_issue["ko"].replace("|", "\\|")
        meaning = item["meaning"].replace("|", "\\|")
        lines.append(f"| {item['word']} | {meaning} | {item['issue_count']} | {ko} |")

    lines.extend(
        [
            "",
            "## Files",
            "",
            f"- JSON: `topik_jp_lv{level}_translation_queue.json`",
            f"- CSV: `topik_jp_lv{level}_translation_queue.csv`",
        ]
    )

    out_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_readme(level_summaries: list[dict]) -> None:
    out_path = OUT_DIR / "README.md"
    lines = [
        "# TOPIK JP Translation Work",
        "",
        f"- Generated: {datetime.now().isoformat(timespec='seconds')}",
        f"- Source: `{SOURCE_PATH.name}`",
        "",
        "| Level | Affected Words | Queue Rows | JSON | CSV | MD |",
        "|---|---:|---:|---|---|---|",
    ]

    for summary in level_summaries:
        level = summary["level"]
        lines.append(
            f"| {level} | {summary['affected_words']} | {summary['queue_rows']} | "
            f"`topik_jp_lv{level}_translation_queue.json` | "
            f"`topik_jp_lv{level}_translation_queue.csv` | "
            f"`topik_jp_lv{level}_translation_queue.md` |"
        )

    lines.extend(
        [
            "",
            "## Notes",
            "",
            "- `proposed_tl` column is intentionally left blank for translation work.",
            "- `current_tl` currently matches Korean source for these queued rows.",
            "- Start from LV2 and proceed upward; LV1 has no remaining queue.",
        ]
    )

    out_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    ensure_out_dir()
    source = load_source()
    items = source["items"]

    level_summaries = []
    for level in ["2", "3", "4", "5", "6"]:
        word_items, row_items = build_level_payload(items, level)
        write_json(level, word_items, row_items)
        write_csv(level, row_items)
        write_md(level, word_items, row_items)
        level_summaries.append(
            {
                "level": level,
                "affected_words": len(word_items),
                "queue_rows": len(row_items),
            }
        )

    write_readme(level_summaries)

    for summary in level_summaries:
        print(
            f"LV{summary['level']}: words={summary['affected_words']} rows={summary['queue_rows']}"
        )
    print(f"Wrote {OUT_DIR}")


if __name__ == "__main__":
    main()
