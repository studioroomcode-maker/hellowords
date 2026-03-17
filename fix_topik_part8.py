import json
import io
import sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE = "D:/MakingApps/Apps/Hellowords"

def build_entry(target, word, pos, synonyms, en_meaning, cn_meaning, vn_meaning, examples):
    level, wid = target
    def make_examples(lang_key):
        result = []
        for sit, ko, en, cn, vn in examples:
            e = {"situation": sit, "ko": ko}
            if lang_key == "en": e["en"] = en
            elif lang_key == "cn": e["cn"] = cn
            elif lang_key == "vn": e["vn"] = vn
            result.append(e)
        return result
    return {"level": level, "id": wid, "word": word, "pos": pos, "synonyms": synonyms,
            "meanings": {"en": en_meaning, "cn": cn_meaning, "vn": vn_meaning},
            "examples_by_lang": {"en": make_examples("en"), "cn": make_examples("cn"), "vn": make_examples("vn")}}

entries = []

# (4, 262): 소셜미디어 → 디지털마케팅
entries.append(build_entry(
    (4, 262), "디지털마케팅", "명사",
    ["온라인광고", "인터넷마케팅"],
    "digital marketing; promotion of products or services using digital channels",
    "数字营销；利用数字渠道推广产品或服务",
    "tiếp thị kỹ thuật số; quảng bá sản phẩm hoặc dịch vụ qua các kênh kỹ thuật số",
    [
        ("business strategy", "우리 회사는 디지털마케팅을 통해 더 많은 고객을 유치하고 있다.", "Our company is attracting more customers through digital marketing.", "我们公司正在通过数字营销吸引更多客户。", "Công ty chúng tôi đang thu hút nhiều khách hàng hơn thông qua tiếp thị kỹ thuật số."),
        ("social media advertising", "디지털마케팅의 핵심은 소비자 데이터를 분석하는 것이다.", "The core of digital marketing is analyzing consumer data.", "数字营销的核心是分析消费者数据。", "Cốt lõi của tiếp thị kỹ thuật số là phân tích dữ liệu người tiêu dùng."),
        ("startup growth", "스타트업들은 저비용 디지털마케팅으로 빠르게 성장할 수 있다.", "Startups can grow quickly with low-cost digital marketing.", "初创公司可以通过低成本的数字营销快速成长。", "Các startup có thể phát triển nhanh chóng với tiếp thị kỹ thuật số chi phí thấp."),
        ("content creation", "좋은 콘텐츠는 디지털마케팅의 성공에 필수적이다.", "Good content is essential to the success of digital marketing.", "好的内容对数字营销的成功至关重要。", "Nội dung tốt là yếu tố thiết yếu cho sự thành công của tiếp thị kỹ thuật số."),
        ("e-commerce", "디지털마케팅 덕분에 소규모 기업도 글로벌 시장에 진출할 수 있다.", "Thanks to digital marketing, small businesses can also enter the global market.", "由于数字营销，小企业也可以进入全球市场。", "Nhờ tiếp thị kỹ thuật số, các doanh nghiệp nhỏ cũng có thể thâm nhập thị trường toàn cầu."),
        ("ROI measurement", "디지털마케팅은 투자 대비 효과를 정확히 측정할 수 있다는 장점이 있다.", "Digital marketing has the advantage of accurately measuring return on investment.", "数字营销的优势在于能够准确衡量投资回报率。", "Tiếp thị kỹ thuật số có ưu điểm là có thể đo lường chính xác lợi tức đầu tư."),
        ("email campaign", "이메일 캠페인은 전통적이지만 효과적인 디지털마케팅 방법이다.", "Email campaigns are a traditional but effective digital marketing method.", "电子邮件营销活动是一种传统但有效的数字营销方法。", "Chiến dịch email là phương pháp tiếp thị kỹ thuật số truyền thống nhưng hiệu quả."),
        ("influencer marketing", "인플루언서와 협력하는 것도 디지털마케팅 전략 중 하나이다.", "Collaborating with influencers is also one of the digital marketing strategies.", "与网红合作也是数字营销策略之一。", "Hợp tác với influencer cũng là một trong những chiến lược tiếp thị kỹ thuật số."),
        ("SEO", "검색엔진최적화는 디지털마케팅에서 매우 중요한 요소이다.", "Search engine optimization is a very important factor in digital marketing.", "搜索引擎优化是数字营销中非常重要的因素。", "Tối ưu hóa công cụ tìm kiếm là yếu tố rất quan trọng trong tiếp thị kỹ thuật số."),
        ("career advice", "디지털마케팅 전문가 수요가 계속 증가하고 있다.", "Demand for digital marketing experts continues to increase.", "对数字营销专家的需求持续增加。", "Nhu cầu về chuyên gia tiếp thị kỹ thuật số tiếp tục tăng."),
    ]
))

result = entries
with open(f"{BASE}/replacements_part8.json", "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print(f"Part8 saved: {len(result)} entries")
