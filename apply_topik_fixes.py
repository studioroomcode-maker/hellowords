import json
import os

BASE = "D:/MakingApps/Apps/Hellowords"
LANGS = ["En", "Cn", "Vn"]
LANG_KEYS = {"En": "en", "Cn": "cn", "Vn": "vn"}

# Load all replacements
all_replacements = []
for i in range(1, 8):
    path = os.path.join(BASE, f"replacements_part{i}.json")
    with open(path, encoding="utf-8") as f:
        all_replacements.extend(json.load(f))

print(f"Total replacements loaded: {len(all_replacements)}")

# Index by (level, id)
rep_index = {}
for entry in all_replacements:
    key = (entry["level"], entry["id"])
    rep_index[key] = entry

print(f"Unique (level, id) keys: {len(rep_index)}")

# Apply to each language
for lang_dir in LANGS:
    lang_key = LANG_KEYS[lang_dir]
    for level in range(1, 7):
        filepath = os.path.join(BASE, "Ko", lang_dir, f"topik_{level}.json")
        with open(filepath, encoding="utf-8") as f:
            words = json.load(f)

        changed = 0
        for word_entry in words["words"]:
            wid = word_entry.get("id")
            key = (level, wid)
            if key in rep_index:
                rep = rep_index[key]
                word_entry["word"] = rep["word"]
                word_entry["pos"] = rep["pos"]
                word_entry["synonyms"] = rep["synonyms"]
                word_entry["meaning"] = rep["meanings"][lang_key]
                word_entry["examples"] = rep["examples_by_lang"][lang_key]
                changed += 1

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(words, f, ensure_ascii=False, indent=2)

        print(f"Ko/{lang_dir}/topik_{level}.json: {changed} replaced")

print("\nDone applying fixes.")

# Verify: check for duplicate Korean words across all levels for each lang
print("\n--- Duplicate verification ---")
for lang_dir in LANGS:
    all_words = []
    for level in range(1, 7):
        filepath = os.path.join(BASE, "Ko", lang_dir, f"topik_{level}.json")
        with open(filepath, encoding="utf-8") as f:
            words = json.load(f)
        for w in words["words"]:
            all_words.append((w["word"], level, w["id"]))

    seen = {}
    dups = []
    for word, level, wid in all_words:
        if word in seen:
            dups.append((word, seen[word], (level, wid)))
        else:
            seen[word] = (level, wid)

    if dups:
        print(f"Ko/{lang_dir}: {len(dups)} duplicates REMAINING:")
        for d in dups:
            print(f"  '{d[0]}' at {d[1]} and {d[2]}")
    else:
        print(f"Ko/{lang_dir}: 0 duplicates — CLEAN")
