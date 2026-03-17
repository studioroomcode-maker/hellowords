import copy
import json
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
LEVEL_DATA_DIR = BASE_DIR / "level_data"


BAND6_ADDITIONS = """
adaptation|n.|적응|adjustment|modification
adolescence|n.|청소년기|youth|teenage years
agriculture|n.|농업|farming|cultivation
ambition|n.|열망|aspiration|drive
campaign|n.|캠페인|drive|movement
childcare|n.|육아|child-rearing|caregiving
citizenship|n.|시민권|nationality|civic status
climate|n.|기후|weather pattern|atmosphere
congestion|n.|혼잡|crowding|traffic jam
conservation|n.|보존|protection|preservation
consumption|n.|소비|use|intake
curriculum|n.|교육과정|syllabus|course plan
diagnosis|n.|진단|identification|assessment
diversity|n.|다양성|variety|inclusion
drought|n.|가뭄|dry spell|water shortage
ecosystem|n.|생태계|ecology|habitat system
emission|n.|배출|discharge|release
epidemic|n.|유행병|outbreak|pandemic
ethnicity|n.|민족성|ethnic background|heritage
evidence|n.|증거|proof|data
famine|n.|기근|starvation|food shortage
gender|n.|성별|sex|identity
habitat|n.|서식지|environment|living area
heritage|n.|유산|legacy|tradition
homelessness|n.|노숙|housing insecurity|displacement
immigration|n.|이민|migration|influx
independence|n.|독립|autonomy|self-rule
inequality|n.|불평등|imbalance|disparity
journalism|n.|저널리즘|reporting|news media
labour|n.|노동|workforce|manual work
leisure|n.|여가|free time|recreation
literacy|n.|문해력|reading ability|basic education
migration|n.|이주|movement|relocation
nutrition|n.|영양|nourishment|diet
obesity|n.|비만|overweight|excess weight
outbreak|n.|발병|eruption|spread
parenting|n.|양육|child-rearing|upbringing
poverty|n.|빈곤|deprivation|hardship
privacy|n.|사생활|personal space|confidentiality
recycling|n.|재활용|reuse|reprocessing
sanitation|n.|위생|hygiene|cleanliness
scholarship|n.|장학금|grant|bursary
stereotype|n.|고정관념|cliche|preconception
tourism|n.|관광|travel industry|sightseeing
tradition|n.|전통|custom|heritage
transport|n.|운송|transportation|transit
urbanization|n.|도시화|city growth|urban growth
vegetation|n.|식생|plant life|flora
wellbeing|n.|웰빙|welfare|health
welfare|n.|복지|wellbeing|social support
wilderness|n.|야생지|untouched nature|wild land
youth|n.|청년층|young people|adolescents
contamination|n.|오염|pollution|taint
crowding|n.|과밀|overpopulation|congestion
debt|n.|부채|liability|loan burden
disorder|n.|질환|disturbance|condition
exhaustion|n.|탈진|fatigue|burnout
inclusion|n.|포용|integration|belonging
vaccination|n.|예방접종|immunization|inoculation
volunteerism|n.|자원봉사 정신|service|civic engagement
""".strip().splitlines()


BAND7_ADDITIONS = """
abundance|n.|풍부함|plenty|richness
advocacy|n.|옹호|support|promotion
affinity|n.|친밀성|connection|rapport
aggression|n.|공격성|hostility|violence
altruism|n.|이타주의|selflessness|generosity
anthropology|n.|인류학|study of humans|ethnology
authenticity|n.|진정성|genuineness|originality
biodiversity|n.|생물다양성|ecological variety|species richness
bureaucracy|n.|관료제|administration|red tape
cognition|n.|인지|thinking|perception
coherence|n.|일관성|logic|consistency
compassion|n.|연민|sympathy|empathy
conformity|n.|순응|compliance|obedience
contemplation|n.|숙고|reflection|consideration
depletion|n.|고갈|exhaustion|drain
deterioration|n.|악화|decline|worsening
discourse|n.|담론|discussion|narrative
dispersion|n.|분산|spread|distribution
emancipation|n.|해방|liberation|freedom
equilibrium|n.|균형|balance|stability
erosion|n.|침식|wearing away|degradation
exclusion|n.|배제|omission|marginalization
fatigue|n.|피로|tiredness|exhaustion
fragmentation|n.|분열|division|splitting
globalization|n.|세계화|internationalization|global integration
homogeneity|n.|동질성|uniformity|sameness
hypothesis|n.|가설|theory|proposition
ideology|n.|이데올로기|belief system|doctrine
improvisation|n.|즉흥성|spontaneity|adaptation
inclusivity|n.|포괄성|openness|inclusion
inertia|n.|관성|resistance to change|slowness
ingenuity|n.|독창성|inventiveness|creativity
interference|n.|간섭|intervention|intrusion
intuition|n.|직관|instinct|insight
longevity|n.|장수|long life|durability
marginalization|n.|소외|exclusion|disadvantage
mortality|n.|사망률|death rate|fatality
multiculturalism|n.|다문화주의|cultural diversity|pluralism
negligence|n.|태만|carelessness|oversight
objectivity|n.|객관성|neutrality|impartiality
overconsumption|n.|과소비|overuse|excess
polarization|n.|양극화|division|separation
pluralism|n.|다원주의|diversity|multiplicity
pragmatism|n.|실용주의|practicality|realism
preservation|n.|보존|conservation|protection
prevalence|n.|만연|frequency|commonness
reciprocity|n.|상호성|mutual exchange|give-and-take
rehabilitation|n.|재활|recovery|restoration
reluctance|n.|꺼림|hesitation|unwillingness
reproduction|n.|재생산|replication|renewal
scarcity|n.|희소성|shortage|lack
skepticism|n.|회의주의|doubt|suspicion
solidarity|n.|연대|unity|support
spontaneity|n.|자발성|naturalness|impulse
surveillance|n.|감시|monitoring|observation
tenure|n.|재직기간|term|occupancy
trajectory|n.|궤적|path|direction
turbulence|n.|격변|instability|upheaval
validity|n.|타당성|soundness|credibility
variability|n.|변동성|fluctuation|variation
vulnerability|n.|취약성|susceptibility|fragility
coexistence|n.|공존|living together|harmony
contradiction|n.|모순|inconsistency|conflict
dependency|n.|의존성|reliance|dependence
displacement|n.|대체|replacement|relocation
elitism|n.|엘리트주의|exclusiveness|snobbery
foresight|n.|선견지명|vision|anticipation
greed|n.|탐욕|selfishness|avarice
humanitarianism|n.|인도주의|compassion|philanthropy
individualism|n.|개인주의|self-reliance|independence
legitimacy|n.|정당성|validity|lawfulness
mobility|n.|이동성|movement|flexibility
normalization|n.|정상화|stabilization|adjustment
oppression|n.|억압|suppression|persecution
parity|n.|동등성|equality|equivalence
perception|n.|인식|awareness|viewpoint
prosperity|n.|번영|success|wealth
rationality|n.|합리성|reasonableness|logic
resilience|n.|회복탄력성|toughness|adaptability
sensitivity|n.|민감성|responsiveness|awareness
uncertainty|n.|불확실성|doubt|instability
universality|n.|보편성|generality|commonality
viability|n.|생존가능성|feasibility|sustainability
adaptability|n.|적응력|flexibility|versatility
cohesion|n.|결속력|unity|coherence
divergence|n.|분기|difference|separation
""".strip().splitlines()


MANUAL_NOUN_EXAMPLES = [
    (
        "IELTS 리딩 지문을 분석할 때",
        "In IELTS reading passages, {word} is often discussed as an important social issue.",
        "IELTS 리딩 지문에서는 {subject} 중요한 사회 문제로 자주 다뤄져요.",
    ),
    (
        "강의 내용을 요약할 때",
        "The lecture connects {word} with changes in education, health, and the environment.",
        "그 강의는 {object} 교육, 건강, 환경의 변화와 연결해요.",
    ),
    (
        "도시 문제를 설명할 때",
        "Many candidates mention {word} when they write about life in large cities.",
        "많은 수험생이 대도시 생활에 대해 쓸 때 {object} 언급해요.",
    ),
    (
        "그래프를 해석할 때",
        "The graph suggests that {word} has changed significantly over the last decade.",
        "그 그래프는 지난 10년 동안 {subject} 크게 변했음을 보여 줘요.",
    ),
    (
        "에세이 주장을 전개할 때",
        "A strong essay can explain how {word} affects individuals and communities.",
        "좋은 에세이는 {subject} 개인과 공동체에 어떤 영향을 주는지 설명할 수 있어요.",
    ),
    (
        "정부 정책을 논의할 때",
        "The writer argues that government policy should address {word} more carefully.",
        "필자는 정부 정책이 {object} 더 신중하게 다뤄야 한다고 주장해요.",
    ),
    (
        "장단점을 비교할 때",
        "During the discussion, the students compared the benefits and risks of {word}.",
        "토론 중 학생들은 {core}의 장점과 위험을 비교했어요.",
    ),
    (
        "사회 변화를 설명할 때",
        "Researchers are paying closer attention to {word} as society becomes more complex.",
        "사회가 더 복잡해지면서 연구자들은 {object} 더 주목하고 있어요.",
    ),
    (
        "스피킹 답변을 준비할 때",
        "A clear understanding of {word} helps candidates give more precise speaking answers.",
        "{object} 분명히 이해하면 수험생이 더 정확한 스피킹 답변을 할 수 있어요.",
    ),
    (
        "라이팅 표현을 확장할 때",
        "Using the word {word} naturally can make an IELTS writing response sound more mature.",
        "{word}라는 단어를 자연스럽게 쓰면 IELTS 라이팅 답안이 더 성숙하게 들릴 수 있어요.",
    ),
]


IELTS_NOUN_EXAMPLES = [
    (
        "IELTS 리딩 지문을 읽을 때",
        "In many IELTS reading passages, {word} appears in discussions about education, health, or the environment.",
        "많은 IELTS 리딩 지문에서 {subject} 교육, 건강, 환경 논의 속에 등장해요.",
    ),
    (
        "사회 변화를 설명할 때",
        "Researchers often describe {word} as a key factor in social change.",
        "연구자들은 {object} 사회 변화의 핵심 요인으로 설명하곤 해요.",
    ),
    (
        "그래프를 분석할 때",
        "The chart suggests that {word} has become more important over the last decade.",
        "그 도표는 지난 10년 동안 {subject} 더 중요해졌음을 보여 줘요.",
    ),
    (
        "공공정책을 논의할 때",
        "Governments need better policies to address {word} effectively.",
        "정부는 {object} 효과적으로 다루기 위한 더 나은 정책이 필요해요.",
    ),
    (
        "라이팅 Task 2를 쓸 때",
        "A strong essay can explain the causes and effects of {word} in modern society.",
        "좋은 에세이는 현대 사회에서 {core}의 원인과 결과를 설명할 수 있어요.",
    ),
    (
        "스피킹 Part 3에서",
        "Public debate about {word} is likely to continue in the future.",
        "{core}에 대한 공적 논의는 앞으로도 계속될 가능성이 높아요.",
    ),
    (
        "강의 내용을 정리할 때",
        "The lecture linked {word} to long-term economic and cultural development.",
        "그 강의는 {object} 장기적인 경제 및 문화 발전과 연결했어요.",
    ),
    (
        "설문 결과를 설명할 때",
        "Survey results showed that attitudes toward {word} varied by age and region.",
        "설문 결과는 {core}에 대한 태도가 연령과 지역에 따라 달랐음을 보여 줬어요.",
    ),
    (
        "답변 정확도를 높일 때",
        "Understanding {word} helps candidates give more precise IELTS answers.",
        "{object} 이해하면 수험생이 더 정확한 IELTS 답변을 할 수 있어요.",
    ),
    (
        "장단점을 평가할 때",
        "A well-developed response can evaluate both the benefits and drawbacks of {word}.",
        "잘 전개된 답변은 {core}의 장점과 단점을 모두 평가할 수 있어요.",
    ),
]


IELTS_ADJ_EXAMPLES = [
    (
        "정책 방향을 설명할 때",
        "It is {word} for governments to consider both short-term needs and long-term consequences.",
        "정부가 단기적 필요와 장기적 결과를 함께 고려하는 것은 {core} 태도로 볼 수 있어요.",
    ),
    (
        "교육 문제를 논의할 때",
        "Many teachers believe that {word} support can improve student performance.",
        "많은 교사들은 {core} 지원이 학생 성과를 높일 수 있다고 봐요.",
    ),
    (
        "도시 문제를 해결할 때",
        "The report suggests that a {word} response is needed to deal with urban problems.",
        "그 보고서는 도시 문제를 다루기 위해 {core} 대응이 필요하다고 말해요.",
    ),
    (
        "라이팅에서 주장할 때",
        "In IELTS essays, candidates often argue that public services should be more {word}.",
        "IELTS 에세이에서 수험생들은 공공 서비스가 더 {core}해야 한다고 자주 주장해요.",
    ),
    (
        "자원 문제를 설명할 때",
        "The speaker explained why a {word} supply of clean water remains essential.",
        "화자는 왜 {core} 깨끗한 물 공급이 여전히 중요한지 설명했어요.",
    ),
    (
        "정책의 실효성을 평가할 때",
        "Some researchers question whether current policies are {word} for future challenges.",
        "일부 연구자들은 현재 정책이 미래의 도전에 대해 충분히 {core}지 의문을 제기해요.",
    ),
    (
        "복잡한 주제를 설명할 때",
        "A {word} explanation can make a complex argument easier to understand.",
        "{core} 설명은 복잡한 주장을 더 쉽게 이해하게 만들 수 있어요.",
    ),
    (
        "영향을 분석할 때",
        "The data suggest that even small changes can have a {word} impact on society.",
        "그 데이터는 작은 변화도 사회에 {core} 영향을 줄 수 있음을 시사해요.",
    ),
    (
        "스피킹 답변을 다듬을 때",
        "In speaking tasks, examples sound stronger when they are relevant and {word}.",
        "스피킹 과제에서는 예시가 적절하고 {core}일수록 더 설득력 있게 들려요.",
    ),
    (
        "지역 계획을 논의할 때",
        "The article described how {word} planning can reduce pressure on local communities.",
        "그 글은 {core} 계획이 지역 공동체의 부담을 줄일 수 있다고 설명했어요.",
    ),
]


def parse_manual_entries(lines):
    entries = []
    for line in lines:
        word, pos, meaning, syn1, syn2 = [part.strip() for part in line.split("|")]
        entries.append(
            {
                "word": word,
                "pos": pos,
                "meaning": meaning,
                "synonyms": [syn1, syn2],
            }
        )
    return entries


def first_gloss(meaning):
    for separator in [",", ";"]:
        if separator in meaning:
            return meaning.split(separator, 1)[0].strip()
    return meaning.strip()


def attach_particle(text, consonant_particle, vowel_particle):
    if not text:
        return text
    last = text[-1]
    code = ord(last)
    if 0xAC00 <= code <= 0xD7A3:
        has_batchim = (code - 0xAC00) % 28 != 0
        particle = consonant_particle if has_batchim else vowel_particle
    else:
        particle = vowel_particle
    return f"{text}{particle}"


def build_manual_entry(raw, level, idx):
    core = first_gloss(raw["meaning"])
    subject = attach_particle(core, "이", "가")
    obj = attach_particle(core, "을", "를")
    examples = []
    for situation, en_tpl, ko_tpl in MANUAL_NOUN_EXAMPLES:
        examples.append(
            {
                "situation": situation,
                "en": en_tpl.format(word=raw["word"]),
                "ko": ko_tpl.format(word=raw["word"], core=core, subject=subject, object=obj),
            }
        )

    return {
        "id": idx,
        "word": raw["word"],
        "pronunciation": "",
        "pos": raw["pos"],
        "meaning": raw["meaning"],
        "synonyms": raw["synonyms"],
        "examples": examples,
        "level": str(level),
    }


def pos_category(pos):
    lower = pos.lower()
    if lower.startswith("adj") or lower.startswith("adjective"):
        return "adjective"
    if lower.startswith("v") or lower.startswith("verb"):
        return "verb"
    return "noun"


def build_ielts_examples(raw):
    core = first_gloss(raw["meaning"])
    subject = attach_particle(core, "이", "가")
    obj = attach_particle(core, "을", "를")
    category = pos_category(raw["pos"])
    templates = IELTS_ADJ_EXAMPLES if category == "adjective" else IELTS_NOUN_EXAMPLES

    examples = []
    for situation, en_tpl, ko_tpl in templates:
        examples.append(
            {
                "situation": situation,
                "en": en_tpl.format(word=raw["word"]),
                "ko": ko_tpl.format(word=raw["word"], core=core, subject=subject, object=obj),
            }
        )
    return examples


def build_reused_entry(raw, level, idx, rewrite_examples=False):
    item = copy.deepcopy(raw)
    item["id"] = idx
    item["level"] = str(level)
    if rewrite_examples and pos_category(item["pos"]) != "verb":
        item["examples"] = build_ielts_examples(item)
    return item


def load_base_words(source_name, excluded=None):
    excluded = excluded or set()
    source = json.loads((BASE_DIR / source_name).read_text(encoding="utf-8"))
    words = []
    for item in source["words"]:
        word = item["word"]
        if " " in word or "-" in word or word in excluded:
            continue
        words.append(copy.deepcopy(item))
    return words


def build_level_file(level, base_words, manual_words, rewrite_examples=False):
    words = []
    for raw in base_words:
        words.append(build_reused_entry(raw, level, len(words) + 1, rewrite_examples))

    for raw in manual_words:
        words.append(build_manual_entry(raw, level, len(words) + 1))

    if len(words) != 300:
        raise ValueError(f"Band {level} must contain 300 words, found {len(words)}")

    return {"level": str(level), "total": 300, "words": words}


def flatten_level(level_payload):
    flat = {}
    for item in level_payload["words"]:
        key = item["word"]
        if key in flat:
            raise ValueError(f"Duplicate word in level payload: {key}")
        examples = item["examples"]
        flat[key] = {
            "word": item["word"],
            "phonetic": item.get("pronunciation", ""),
            "pos": item["pos"],
            "meaning": item["meaning"],
            "synonyms": item["synonyms"],
            "situation": examples[0]["situation"],
            "example_en": examples[0]["en"],
            "example_ko": examples[0]["ko"],
            "level": str(level_payload["level"]),
            "examples": examples,
        }
    return flat


def write_json(path, payload):
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def main():
    manual_band6 = parse_manual_entries(BAND6_ADDITIONS)
    manual_band7 = parse_manual_entries(BAND7_ADDITIONS)

    if len(manual_band6) != 60:
        raise ValueError(f"Band 6 additions must be 60, found {len(manual_band6)}")
    if len(manual_band7) != 86:
        raise ValueError(f"Band 7 additions must be 86, found {len(manual_band7)}")

    level5 = build_level_file("5", load_base_words("words_600.json"), [])
    level6 = build_level_file("6", load_base_words("words_700.json", {"KPI"}), manual_band6, rewrite_examples=True)
    level7 = build_level_file("7", load_base_words("words_800.json"), manual_band7, rewrite_examples=True)

    for payload, name in [
        (level5, "ielts_5.json"),
        (level6, "ielts_6.json"),
        (level7, "ielts_7.json"),
    ]:
        write_json(BASE_DIR / name, payload)

    flat5 = flatten_level(level5)
    flat6 = flatten_level(level6)
    flat7 = flatten_level(level7)

    merged = {}
    for chunk in [flat5, flat6, flat7]:
        overlap = set(merged) & set(chunk)
        if overlap:
            raise ValueError(f"Duplicate words across IELTS bands: {sorted(overlap)[:10]}")
        merged.update(chunk)

    write_json(LEVEL_DATA_DIR / "ielts_5.json", flat5)
    write_json(LEVEL_DATA_DIR / "ielts_6.json", flat6)
    write_json(LEVEL_DATA_DIR / "ielts_7.json", flat7)
    write_json(BASE_DIR / "ielts_words_data.json", merged)

    print("Created:")
    print(" - En/ielts_5.json")
    print(" - En/ielts_6.json")
    print(" - En/ielts_7.json")
    print(" - En/level_data/ielts_5.json")
    print(" - En/level_data/ielts_6.json")
    print(" - En/level_data/ielts_7.json")
    print(" - En/ielts_words_data.json")


if __name__ == "__main__":
    main()
