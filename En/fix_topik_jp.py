from __future__ import annotations

import json
import re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
HANGUL_RE = re.compile(r"[가-힣]")

TRANSLATIONS = {
    "당신은 하루에 몇 시간 잠을 자나요?": "あなたは一日に何時間寝ますか。",
    "한국 음식 중에 무엇이 제일 맛있어요?": "韓国料理の中で何が一番おいしいですか。",
    "두 방법의 차이가 무엇이에요?": "二つの方法の違いは何ですか。",
    "인생에서 무엇이 가장 행복한 순간이었나요?": "人生で最も幸せだった瞬間は何でしたか。",
    "이 문장을 영어로 번역해 주시겠어요?": "この文を英語に訳していただけますか。",
    "처음 만나는 사람에게 이름을 물어도 됩니까?": "初めて会う人に名前を聞いてもいいですか。",
    "미용실에서 커트 비용이 얼마예요?": "美容室でカット料金はいくらですか。",
    "서울에서 뉴욕까지 경유 없이 직항으로 가는 편이 있나요?": "ソウルからニューヨークまで経由なしの直行便はありますか。",
    "경유편과 직항편 중 어느 것이 더 저렴한가요?": "経由便と直行便では、どちらがより安いですか。",
    "공항에서 시내까지 어떤 교통수단을 이용하면 좋을까요?": "空港から市内までは、どの交通手段を利用するのがよいでしょうか。",
    "이 지하철역 막차는 몇 시예요?": "この地下鉄駅の終電は何時ですか。",
    "예약 날짜를 변경하고 싶은데 가능한가요?": "予約日を変更したいのですが、可能ですか。",
    "왕복 항공권과 숙박비를 합치면 얼마나 될까요?": "往復航空券と宿泊費を合わせると、いくらくらいになりますか。",
    "왕복 패키지를 구매하면 할인이 되나요?": "往復パッケージを購入すると割引になりますか。",
    "편도로만 예약하고 돌아올 때 따로 구매하는 게 나을까요?": "片道だけ予約して、帰りは別に購入するほうがよいでしょうか。",
    "환승 티켓은 따로 구매해야 하나요?": "乗り換えチケットは別途購入する必要がありますか。",
    "폭력적 저항과 비폭력적 저항 중 어느 것이 효과적인가?": "暴力的抵抗と非暴力的抵抗のうち、どちらが効果的か。",
    "도덕철학적 관점에서 거짓말은 어떤 상황에서도 허용될 수 없는가?": "道徳哲学的観点から、うそはいかなる状況でも許されないのか。",
    "사회계약에 근거한 시민 불복종은 어느 범위까지 허용될 수 있는가?": "社会契約に基づく市民的不服従は、どの範囲まで許容されうるのか。",
}

FILES = [
    BASE_DIR / "topik_jp_data.json",
    *(BASE_DIR / "level_data" / f"topik_jp_lv{i}.json" for i in range(1, 7)),
]


def patch_file(path: Path) -> int:
    data = json.loads(path.read_text(encoding="utf-8"))
    changed = 0

    for item in data.values():
        example_ko = item.get("example_ko", "")
        example_tl = item.get("example_tl", "")
        if example_ko in TRANSLATIONS and HANGUL_RE.search(example_tl):
            item["example_tl"] = TRANSLATIONS[example_ko]
            changed += 1

        for example in item.get("examples", []):
            ko = example.get("ko", "")
            tl = example.get("tl", "")
            if ko in TRANSLATIONS and HANGUL_RE.search(tl):
                example["tl"] = TRANSLATIONS[ko]
                changed += 1

    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return changed


def main() -> None:
    for file_path in FILES:
        changed = patch_file(file_path)
        print(file_path.name, changed)


if __name__ == "__main__":
    main()
