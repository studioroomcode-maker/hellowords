import json

def E(sit,ko,en,cn,vn): return (sit,ko,en,cn,vn)

REPLACEMENTS = [
  # ===== LEVEL 5 =====
  ((5,8),"통화스왑","명사",["외환스왑","FX스왑"],"currency swap, foreign exchange swap","货币互换，外汇互换","hoán đổi tiền tệ, swap ngoại hối",[
    E("금융 정책을 이야기할 때","통화스왑은 두 나라가 서로의 통화를 교환하는 협정이에요.","A currency swap is an agreement between two countries to exchange each other's currencies.","货币互换은两国相互交换货币的协议。","Hoán đổi tiền tệ là thỏa thuận giữa hai quốc gia trao đổi tiền tệ của nhau."),
    E("외환 위기를 이야기할 때","통화스왑 협정이 외환 위기 시 안전망 역할을 해요.","Currency swap agreements serve as a safety net during foreign exchange crises.","货币互换协议在外汇危机时起到安全网的作用。","Hiệp định hoán đổi tiền tệ đóng vai trò mạng lưới an toàn trong khủng hoảng ngoại hối."),
    E("한미를 이야기할 때","한국과 미국은 통화스왑 협정을 체결했어요.","South Korea and the United States concluded a currency swap agreement.","韩国与美国签订了货币互换协议。","Hàn Quốc và Hoa Kỳ đã ký kết hiệp định hoán đổi tiền tệ."),
    E("중앙은행을 이야기할 때","중앙은행 간 통화스왑이 금융 안정에 기여해요.","Currency swaps between central banks contribute to financial stability.","央行间的货币互换有助于금융안정。","Hoán đổi tiền tệ giữa các ngân hàng trung ương góp phần vào ổn định tài chính."),
    E("규모를 이야기할 때","통화스왑 한도를 확대하면 외환 보유고가 늘어나는 효과가 있어요.","Expanding the currency swap limit has the effect of increasing foreign exchange reserves.","扩大货币互换限额具有增加外汇储备的效果。","Mở rộng hạn mức hoán đổi tiền tệ có tác dụng tăng dự trữ ngoại hối."),
    E("신뢰를 이야기할 때","통화스왑 협정은 두 나라 간 경제적 신뢰의 표시예요.","A currency swap agreement is a sign of economic trust between two countries.","货币互换협정은두나라간경제신뢰的표시。","Hiệp định hoán đổi tiền tệ là dấu hiệu tin tưởng kinh tế giữa hai quốc gia."),
    E("비상시를 이야기할 때","비상시 통화스왑을 활성화하면 유동성을 확보할 수 있어요.","Activating currency swaps in emergencies can secure liquidity.","紧急时激活货币互换可以确保流动性。","Kích hoạt hoán đổi tiền tệ trong tình huống khẩn cấp có thể đảm bảo thanh khoản."),
    E("글로벌을 이야기할 때","글로벌 금융 위기 때 통화스왑이 활발하게 이루어졌어요.","Currency swaps were actively conducted during the global financial crisis.","全球金융위기时货币互换活跃진행。","Hoán đổi tiền tệ được thực hiện tích cực trong cuộc khủng hoảng tài chính toàn cầu."),
    E("이자를 이야기할 때","통화스왑에는 이자 지급 조건이 포함돼요.","Currency swaps include interest payment conditions.","货币互换包含利息支付条件。","Hoán đổi tiền tệ bao gồm điều kiện thanh toán lãi suất."),
    E("만기를 이야기할 때","통화스왑 계약의 만기가 도래하면 원래의 통화를 반환해요.","When a currency swap contract matures, the original currency is returned.","货币互换합약만기到来时归还原货币。","Khi hợp đồng hoán đổi tiền tệ đáo hạn, tiền tệ gốc được hoàn trả."),
  ]),
  ((5,48),"기본권","명사",["기본적 권리","헌법적 권리"],"fundamental rights, basic rights","基本权利，基本权","quyền cơ bản, quyền hiến định",[
    E("헌법을 이야기할 때","기본권은 헌법이 보장하는 국민의 근본적인 권리예요.","Fundamental rights are the basic rights of citizens guaranteed by the Constitution.","基本权利은宪法保障的国民根本性권리。","Quyền cơ bản là quyền căn bản của công dân được Hiến pháp đảm bảo."),
    E("자유권을 이야기할 때","표현의 자유는 기본권 중에서도 핵심적인 권리예요.","Freedom of expression is a core right among fundamental rights.","表达自由是基本权利中的核心권리。","Tự do biểu đạt là quyền cốt lõi trong số các quyền cơ bản."),
    E("평등을 이야기할 때","모든 시민은 기본권에 있어서 평등해야 해요.","All citizens must be equal in fundamental rights.","所有公民在基本权利上应该平等。","Tất cả công dân phải bình đẳng về các quyền cơ bản."),
    E("제한을 이야기할 때","기본권도 공공의 이익을 위해 법률에 의해 제한될 수 있어요.","Fundamental rights can also be restricted by law for the public interest.","基本권리也可以为了公共利益依法受到限制。","Quyền cơ bản cũng có thể bị hạn chế bởi pháp luật vì lợi ích công cộng."),
    E("사회권을 이야기할 때","교육권과 노동권도 중요한 사회적 기본권이에요.","The right to education and the right to work are also important social fundamental rights.","受教育权和劳动权也是重要的社회적기본권。","Quyền giáo dục và quyền lao động cũng là các quyền cơ bản xã hội quan trọng."),
    E("국가 의무를 이야기할 때","국가는 기본권 보장을 위한 의무를 져요.","The state has an obligation to guarantee fundamental rights.","国家负有保障基本권리의무。","Nhà nước có nghĩa vụ đảm bảo các quyền cơ bản."),
    E("침해를 이야기할 때","기본권 침해 시 헌법재판소에 소원을 제기할 수 있어요.","You can file a petition to the Constitutional Court when fundamental rights are violated.","基本권리受到侵犯时可以向宪法法院提出申诉。","Bạn có thể đệ đơn lên Tòa án Hiến pháp khi các quyền cơ bản bị vi phạm."),
    E("인권을 이야기할 때","기본권은 인간의 존엄성을 보장하는 핵심 제도예요.","Fundamental rights are a core institution that guarantees human dignity.","基본권利是保障人的尊严的核心制度。","Quyền cơ bản là thể chế cốt lõi đảm bảo phẩm giá con người."),
    E("외국인을 이야기할 때","외국인도 일부 기본권의 주체가 될 수 있어요.","Foreigners can also be subjects of some fundamental rights.","外国人也可以成为部分基本권리的主体。","Người nước ngoài cũng có thể là chủ thể của một số quyền cơ bản."),
    E("역사를 이야기할 때","기본권의 역사는 오랜 투쟁의 결과예요.","The history of fundamental rights is the result of a long struggle.","基本권利的历史是长期斗争的结果。","Lịch sử của các quyền cơ bản là kết quả của một cuộc đấu tranh lâu dài."),
  ]),
  ((5,51),"법치주의","명사",["법치","법의 지배"],"rule of law, constitutional state","法治主义，法治","nhà nước pháp quyền, pháp trị",[
    E("민주주의를 이야기할 때","법치주의는 민주주의의 근본 원칙 중 하나예요.","The rule of law is one of the fundamental principles of democracy.","法治主义是民主主义의근본원칙之一。","Nhà nước pháp quyền là một trong những nguyên tắc cơ bản của dân chủ."),
    E("국가 권력을 이야기할 때","법치주의는 국가 권력도 법에 의해 제한됨을 의미해요.","The rule of law means that state power is also limited by law.","法治主义意味着国家权력也受到法律的限制。","Nhà nước pháp quyền có nghĩa là quyền lực nhà nước cũng bị hạn chế bởi pháp luật."),
    E("평등을 이야기할 때","법치주의에서는 모든 사람이 법 앞에 평등해요.","Under the rule of law, everyone is equal before the law.","在法治主义下，所有人在法律面前都是平等的。","Trong nhà nước pháp quyền, mọi người bình đẳng trước pháp luật."),
    E("부패를 이야기할 때","법치주의 약화가 부패와 권력 남용을 초래해요.","Weakening of the rule of law leads to corruption and abuse of power.","法治主义弱화导致腐败和滥用권력。","Sự suy yếu của nhà nước pháp quyền dẫn đến tham nhũng và lạm dụng quyền lực."),
    E("사법부를 이야기할 때","독립적인 사법부가 법치주의의 핵심이에요.","An independent judiciary is the core of the rule of law.","独立的司法机构是法治주의의核心。","Tư pháp độc lập là cốt lõi của nhà nước pháp quyền."),
    E("인권을 이야기할 때","법치주의는 인권 보호와 밀접하게 연결돼 있어요.","The rule of law is closely connected with the protection of human rights.","法治주의与人权保护密切相关。","Nhà nước pháp quyền gắn chặt với bảo vệ quyền con người."),
    E("국제 기준을 이야기할 때","법치주의는 국제 사회가 요구하는 기본 거버넌스 원칙이에요.","The rule of law is a basic governance principle required by the international community.","法治주义는국제사회가要求하는기본거버넌스原则。","Nhà nước pháp quyền là nguyên tắc quản trị cơ bản mà cộng đồng quốc tế yêu cầu."),
    E("법률 제정을 이야기할 때","법치주의는 절차에 따른 합법적인 입법을 요구해요.","The rule of law requires lawful legislation following proper procedures.","法治主义요구依程序进行的합법적인立法。","Nhà nước pháp quyền đòi hỏi lập pháp hợp pháp theo đúng thủ tục."),
    E("경제를 이야기할 때","법치주의가 잘 갖춰진 나라에 외국 투자가 몰려요.","Foreign investment concentrates in countries with well-established rule of law.","외국투资集中在法治주의完善的国家。","Đầu tư nước ngoài tập trung vào các quốc gia có nhà nước pháp quyền được xây dựng tốt."),
    E("위기를 이야기할 때","위기 상황에서도 법치주의 원칙이 지켜져야 해요.","The principles of the rule of law must be upheld even in crisis situations.","即使在危机情况下，也需要坚守法治주의원칙。","Nguyên tắc nhà nước pháp quyền phải được duy trì ngay cả trong tình huống khủng hoảng."),
  ]),
  ((5,59),"삼권분립","명사",["권력분립","3권분립"],"separation of powers","三权分立","tam quyền phân lập",[
    E("헌법을 이야기할 때","삼권분립은 입법, 행정, 사법 권력을 분리하는 원칙이에요.","Separation of powers is the principle of separating legislative, executive, and judicial powers.","三权분립은分离立法、行政、司法权力的원칙。","Tam quyền phân lập là nguyên tắc tách biệt quyền lập pháp, hành pháp và tư pháp."),
    E("견제를 이야기할 때","삼권분립은 서로 권력을 견제하고 균형을 맞춰요.","Separation of powers checks and balances each other's power.","三权分립은互相制衡권력。","Tam quyền phân lập kiểm soát và cân bằng quyền lực lẫn nhau."),
    E("독재를 예방할 때","삼권분립이 독재를 예방하는 제도적 장치예요.","Separation of powers is an institutional mechanism to prevent dictatorship.","三权分立是防止独裁的制도적装置。","Tam quyền phân lập là cơ chế thể chế để ngăn chặn độc tài."),
    E("입법부를 이야기할 때","입법부인 국회가 법률을 제정하는 역할을 해요.","The legislature, the National Assembly, plays the role of enacting laws.","立법부인국회起到制定法律的作用。","Cơ quan lập pháp, tức Quốc hội, đóng vai trò ban hành luật pháp."),
    E("행정부를 이야기할 때","행정부인 정부가 법률을 집행하는 역할을 해요.","The executive, the government, plays the role of enforcing laws.","행정부인정부起到执行法律的作用。","Cơ quan hành pháp, tức chính phủ, đóng vai trò thi hành pháp luật."),
    E("사법부를 이야기할 때","사법부인 법원이 법률을 해석하고 판결하는 역할을 해요.","The judiciary, the courts, plays the role of interpreting laws and making judgments.","사법부인法院起到解释法律和作出裁决的作用。","Cơ quan tư pháp, tức tòa án, đóng vai trò diễn giải pháp luật và ra phán quyết."),
    E("역사를 이야기할 때","몽테스키외가 삼권분립 이론을 체계화했어요.","Montesquieu systematized the theory of separation of powers.","孟德斯鸠체계화了三权分립이론。","Montesquieu đã hệ thống hóa lý thuyết tam quyền phân lập."),
    E("현실을 이야기할 때","현실에서 삼권분립이 완전히 이루어지기는 어려워요.","It is difficult for separation of powers to be completely achieved in reality.","在现실中，三권分立完全实현很难。","Trên thực tế, tam quyền phân lập khó có thể đạt được hoàn toàn."),
    E("위기를 이야기할 때","삼권분립의 균형이 깨지면 민주주의가 위협받아요.","When the balance of separation of powers is broken, democracy is threatened.","三권分立的균형被打破时，民主主义受到威胁。","Khi sự cân bằng của tam quyền phân lập bị phá vỡ, nền dân chủ bị đe dọa."),
    E("중요성을 이야기할 때","삼권분립은 국민의 자유와 권리를 보장하는 핵심 원리예요.","Separation of powers is the core principle that guarantees the freedom and rights of citizens.","三权分立是保障국民자유与권리的核心원리。","Tam quyền phân lập là nguyên lý cốt lõi đảm bảo tự do và quyền lợi của nhân dân."),
  ]),
  ((5,73),"건강불평등","명사",["의료 불평등","건강 격차"],"health inequality, health disparity","健康不平等，医疗差距","bất bình đẳng sức khỏe, chênh lệch y tế",[
    E("사회 문제를 이야기할 때","소득에 따른 건강불평등이 심각한 사회 문제예요.","Health inequality based on income is a serious social problem.","基于收入的健康불평등是严重的社회문제。","Bất bình đẳng sức khỏe dựa trên thu nhập là vấn đề xã hội nghiêm trọng."),
    E("의료 접근성을 이야기할 때","저소득층이 의료 서비스에 접근하기 어려워 건강불평등이 심화돼요.","Health inequality deepens as low-income groups have difficulty accessing medical services.","低收入群체접근医疗서비스困难，건강불평등加深。","Bất bình đẳng sức khỏe sâu sắc hơn khi nhóm thu nhập thấp khó tiếp cận dịch vụ y tế."),
    E("지역을 이야기할 때","도시와 농촌 간 의료 인프라 차이가 건강불평등을 유발해요.","Differences in medical infrastructure between urban and rural areas cause health inequality.","城乡医疗基础设施差距导致건강불평등。","Sự khác biệt về cơ sở hạ tầng y tế giữa thành thị và nông thôn gây ra bất bình đẳng sức khỏe."),
    E("교육과 연결할 때","교육 수준이 높을수록 건강 관리 능력이 좋아요.","The higher the education level, the better the health management ability.","教육수준越高，健康管理能力越好。","Mức độ giáo dục càng cao, khả năng quản lý sức khỏe càng tốt."),
    E("정책을 이야기할 때","건강불평등 해소를 위한 공공 의료 강화가 필요해요.","Strengthening public healthcare is needed to address health inequality.","需要加强公共医疗以消除건강불평등。","Cần tăng cường y tế công cộng để giải quyết bất bình đẳng sức khỏe."),
    E("코로나를 이야기할 때","팬데믹이 기존의 건강불평등을 더욱 심화시켰어요.","The pandemic further deepened existing health inequality.","疫情进一步加深了现有的건강불평등。","Đại dịch đã làm sâu sắc thêm bất bình đẳng sức khỏe hiện có."),
    E("글로벌을 이야기할 때","선진국과 개발도상국 간의 건강불평등이 커요.","Health inequality between developed and developing countries is large.","发达国家与发展中国家之간건강불평等程度大。","Bất bình đẳng sức khỏe giữa các nước phát triển và đang phát triển rất lớn."),
    E("해결을 이야기할 때","건강보험 보장 범위 확대가 건강불평등 감소에 효과적이에요.","Expanding health insurance coverage is effective in reducing health inequality.","扩大医疗保险保障范围对减少건강불평등有效。","Mở rộng phạm vi bảo hiểm y tế hiệu quả trong việc giảm bất bình đẳng sức khỏe."),
    E("예방을 이야기할 때","예방 중심의 의료 제도가 건강불평등을 줄여요.","Prevention-centered medical systems reduce health inequality.","以预防为中心的医疗制度减少건강불평등。","Hệ thống y tế tập trung vào phòng ngừa giảm bất bình đẳng sức khỏe."),
    E("연구를 이야기할 때","건강불평등 연구가 더 공정한 의료 제도 설계에 기여해요.","Health inequality research contributes to designing fairer medical systems.","건강불평등연구有助于设计더공정한医疗制度。","Nghiên cứu bất bình đẳng sức khỏe góp phần thiết kế hệ thống y tế công bằng hơn."),
  ]),
  ((5,122),"젠트리피케이션","명사",["도시고급화","지역고급화"],"gentrification","中产阶级化，高档化","sự quý tộc hóa đô thị, gentrification",[
    E("도시 변화를 이야기할 때","젠트리피케이션은 낙후 지역이 고급화되는 현상이에요.","Gentrification is the phenomenon of run-down areas becoming upscale.","젠트리피케이션는낡은지역高档化的现상。","Gentrification là hiện tượng các khu vực xuống cấp được nâng cấp thành cao cấp."),
    E("원주민 문제를 이야기할 때","젠트리피케이션으로 원래 거주민이 높은 임대료로 쫓겨나요.","Original residents are driven out by high rents due to gentrification.","由于젠트리피케이션，原居民因高房租被迫离开。","Do gentrification, cư dân gốc bị đẩy đi bởi tiền thuê cao."),
    E("상권을 이야기할 때","상권이 변화하면서 젠트리피케이션이 가속화돼요.","Gentrification accelerates as commercial areas change.","随着商业区的变화，젠트리피케이션加速。","Gentrification tăng tốc khi các khu thương mại thay đổi."),
    E("예술가를 이야기할 때","예술가들이 이주하면서 지역이 활성화되고 젠트리피케이션이 시작돼요.","Gentrification begins as the area is revitalized by artists moving in.","随着艺术家的移入，地区活跃起来，젠트리피케이션开始。","Gentrification bắt đầu khi khu vực được hồi sinh bởi các nghệ sĩ chuyển đến."),
    E("부동산을 이야기할 때","젠트리피케이션으로 부동산 가격이 급등해요.","Real estate prices soar due to gentrification.","由于젠트리피케이션，房地产价格暴涨。","Giá bất động sản tăng vọt do gentrification."),
    E("문화를 이야기할 때","젠트리피케이션은 지역의 문화적 다양성을 감소시킬 수 있어요.","Gentrification can reduce the cultural diversity of an area.","젠트리피케이션可能减少地区文화다양성。","Gentrification có thể giảm sự đa dạng văn hóa của một khu vực."),
    E("정책을 이야기할 때","젠트리피케이션에 대응하기 위한 세입자 보호 정책이 필요해요.","Tenant protection policies are needed to respond to gentrification.","需要租客保护政策来应对젠트리피케이션。","Cần chính sách bảo vệ người thuê nhà để ứng phó với gentrification."),
    E("서울을 이야기할 때","서울의 여러 지역에서 젠트리피케이션 현상이 나타나고 있어요.","Gentrification phenomena are appearing in various areas of Seoul.","首尔多个地区出현젠트리피케이션현상。","Hiện tượng gentrification đang xuất hiện ở nhiều khu vực Seoul."),
    E("혜택과 피해를 이야기할 때","젠트리피케이션의 수혜자와 피해자가 명확하게 나뉘어요.","Beneficiaries and victims of gentrification are clearly divided.","젠트리피케이션的受益者和受害者분명히갈린다。","Người hưởng lợi và nạn nhân của gentrification được phân chia rõ ràng."),
    E("연구를 이야기할 때","도시 계획 연구에서 젠트리피케이션 문제가 중요하게 다뤄져요.","Gentrification issues are dealt with importantly in urban planning research.","城市规划研究中重요하게다뤄지는젠트리피케이션问题。","Vấn đề gentrification được xử lý quan trọng trong nghiên cứu quy hoạch đô thị."),
  ]),
  ((5,123),"사회적자본","명사",["사회 자본","신뢰 자본"],"social capital","社会资本","vốn xã hội",[
    E("신뢰를 이야기할 때","사회적자본은 공동체 내의 신뢰와 협력을 나타내는 개념이에요.","Social capital is a concept that represents trust and cooperation within a community.","사회적자본은代表共同体내부信任与合作的概念。","Vốn xã hội là khái niệm đại diện cho sự tin tưởng và hợp tác trong cộng đồng."),
    E("네트워크를 이야기할 때","강한 사회적자본은 사람들 간의 네트워크를 형성해요.","Strong social capital forms networks between people.","강한사회적자본形成人们之간的网络。","Vốn xã hội mạnh hình thành mạng lưới giữa mọi người."),
    E("경제를 이야기할 때","사회적자본이 높은 나라는 경제 발전에도 유리해요.","Countries with high social capital are also advantageous for economic development.","사회적자본높은나라在경제발전上也유리。","Các quốc gia có vốn xã hội cao cũng có lợi thế trong phát triển kinh tế."),
    E("거버넌스를 이야기할 때","사회적자본이 풍부하면 좋은 거버넌스가 만들어져요.","When social capital is abundant, good governance is created.","사회적자본풍부하면可以创造好的治理。","Khi vốn xã hội dồi dào, quản trị tốt được tạo ra."),
    E("재난 회복을 이야기할 때","사회적자본이 강한 지역은 재난 후 빠르게 회복해요.","Areas with strong social capital recover quickly after disasters.","사회적자본强的地区在灾难후快速恢복。","Khu vực có vốn xã hội mạnh phục hồi nhanh chóng sau thảm họa."),
    E("Putnam을 이야기할 때","로버트 퍼트남이 사회적자본 개념을 발전시켰어요.","Robert Putnam developed the concept of social capital.","罗伯特·普特南发展了사회적자본概念。","Robert Putnam đã phát triển khái niệm vốn xã hội."),
    E("약화를 이야기할 때","개인주의 확산으로 사회적자본이 약화되고 있어요.","Social capital is weakening due to the spread of individualism.","由于个人主义的扩散，사회적자본正在弱화。","Vốn xã hội đang suy yếu do sự lan rộng của chủ nghĩa cá nhân."),
    E("교육을 이야기할 때","사회적자본 형성에 교육의 역할이 중요해요.","The role of education is important in forming social capital.","教육在사회적자본형성上的作用很重要。","Vai trò của giáo dục quan trọng trong việc hình thành vốn xã hội."),
    E("지역 공동체를 이야기할 때","지역 공동체 활동이 사회적자본을 쌓는 데 기여해요.","Local community activities contribute to building social capital.","地区共同体活动有助于积累사회적자본。","Các hoạt động cộng đồng địa phương góp phần tích lũy vốn xã hội."),
    E("다양성을 이야기할 때","다양성이 높은 사회에서 사회적자본을 쌓기가 더 어려울 수 있어요.","Building social capital can be more difficult in highly diverse societies.","在多样性高的社회中积累사회적자본可能更困难。","Tích lũy vốn xã hội có thể khó khăn hơn trong các xã hội có tính đa dạng cao."),
  ]),
  ((5,176),"알고리즘편향","명사",["AI 편향","알고리즘 차별"],"algorithmic bias, AI bias","算法偏见，AI偏见","thành kiến thuật toán, sai lệch AI",[
    E("AI를 이야기할 때","알고리즘편향은 AI 시스템이 특정 집단에 불공정한 결과를 내는 문제예요.","Algorithmic bias is the problem of AI systems producing unfair results for certain groups.","알고리즘편향是AI系统对特定群체产生不공정결果的问题。","Thành kiến thuật toán là vấn đề hệ thống AI tạo ra kết quả không công bằng cho các nhóm cụ thể."),
    E("데이터를 이야기할 때","편향된 훈련 데이터가 알고리즘편향을 유발해요.","Biased training data causes algorithmic bias.","편향된훈련데이터导致알고리즘편향。","Dữ liệu huấn luyện bị sai lệch gây ra thành kiến thuật toán."),
    E("채용을 이야기할 때","채용 알고리즘의 알고리즘편향이 차별을 강화할 수 있어요.","Algorithmic bias in recruitment algorithms can reinforce discrimination.","招聘알고리즘의알고리즘편향可以강화歧视。","Thành kiến thuật toán trong các thuật toán tuyển dụng có thể củng cố phân biệt đối xử."),
    E("얼굴 인식을 이야기할 때","얼굴 인식 기술의 알고리즘편향이 특정 인종에 불리해요.","Algorithmic bias in facial recognition technology is disadvantageous for certain races.","人脸识别技术의알고리즘편향对某些种族不利。","Thành kiến thuật toán trong công nghệ nhận dạng khuôn mặt bất lợi cho một số chủng tộc nhất định."),
    E("형사사법을 이야기할 때","형사사법 시스템의 알고리즘편향이 공정성을 해칠 수 있어요.","Algorithmic bias in criminal justice systems can harm fairness.","刑사사법시스템의알고리즘편향可以损害公正性。","Thành kiến thuật toán trong hệ thống tư pháp hình sự có thể gây hại cho sự công bằng."),
    E("해결을 이야기할 때","알고리즘편향을 해결하기 위한 다양한 기술적 방법이 연구되고 있어요.","Various technical methods to address algorithmic bias are being researched.","解决알고리즘편향的다양한技术方法正在研究中。","Nhiều phương pháp kỹ thuật để giải quyết thành kiến thuật toán đang được nghiên cứu."),
    E("투명성을 이야기할 때","알고리즘의 투명성을 높여 알고리즘편향을 줄일 수 있어요.","Algorithmic bias can be reduced by increasing the transparency of algorithms.","通过提高算法의투명성可以减少알고리즘편향。","Có thể giảm thành kiến thuật toán bằng cách tăng tính minh bạch của thuật toán."),
    E("규제를 이야기할 때","알고리즘편향 방지를 위한 AI 규제 법안이 논의되고 있어요.","AI regulatory bills to prevent algorithmic bias are being discussed.","防止알고리즘편향的AI规制法案正在讨论中。","Dự luật quy định AI để ngăn chặn thành kiến thuật toán đang được thảo luận."),
    E("다양성을 이야기할 때","AI 개발팀의 다양성이 알고리즘편향 감소에 도움이 돼요.","Diversity in AI development teams helps reduce algorithmic bias.","AI개발팀의多样性有助于减少알고리즘편향。","Sự đa dạng trong các nhóm phát triển AI giúp giảm thành kiến thuật toán."),
    E("윤리를 이야기할 때","알고리즘편향 문제가 AI 윤리의 핵심 이슈예요.","The issue of algorithmic bias is a core issue of AI ethics.","알고리즘편향问题是AI윤리的核心议题。","Vấn đề thành kiến thuật toán là vấn đề cốt lõi của đạo đức AI."),
  ]),
  ((5,195),"정서지능","명사",["감성지능","EQ"],"emotional intelligence, EQ","情绪智力，情商","trí tuệ cảm xúc, EQ",[
    E("심리를 이야기할 때","정서지능은 자신과 타인의 감정을 인식하고 관리하는 능력이에요.","Emotional intelligence is the ability to recognize and manage one's own and others' emotions.","정서지능은识별和管理自己与他人情感的能力。","Trí tuệ cảm xúc là khả năng nhận biết và quản lý cảm xúc của bản thân và người khác."),
    E("리더십을 이야기할 때","높은 정서지능이 효과적인 리더십의 핵심이에요.","High emotional intelligence is the core of effective leadership.","높은정서지능是有效领导力의核心。","Trí tuệ cảm xúc cao là cốt lõi của lãnh đạo hiệu quả."),
    E("IQ와 비교할 때","IQ만큼 정서지능도 성공에 중요한 역할을 해요.","Emotional intelligence plays as important a role in success as IQ.","정서지능像IQ一样在成功中扮演重要角色。","Trí tuệ cảm xúc đóng vai trò quan trọng trong thành công ngang với IQ."),
    E("대인관계를 이야기할 때","정서지능이 높은 사람은 대인관계가 원만해요.","People with high emotional intelligence have smooth interpersonal relationships.","정서지능높은사람的人际关系融洽。","Người có trí tuệ cảm xúc cao có mối quan hệ con người hài hòa."),
    E("직장을 이야기할 때","직장에서 정서지능이 업무 성과에 영향을 미쳐요.","Emotional intelligence affects work performance in the workplace.","在职场中，정서지능影响工作表현。","Trí tuệ cảm xúc ảnh hưởng đến hiệu suất làm việc tại nơi làm việc."),
    E("갈등을 이야기할 때","정서지능이 높으면 갈등을 효과적으로 해결할 수 있어요.","High emotional intelligence allows you to effectively resolve conflicts.","정서지능高的话可以有효적으로解决矛盾。","Trí tuệ cảm xúc cao cho phép bạn giải quyết xung đột hiệu quả."),
    E("교육을 이야기할 때","학교에서 정서지능 교육의 중요성이 강조되고 있어요.","The importance of emotional intelligence education is being emphasized in schools.","在学校，정서지능교육의重要性正被강조。","Tầm quan trọng của giáo dục trí tuệ cảm xúc đang được nhấn mạnh ở trường học."),
    E("개발을 이야기할 때","정서지능은 훈련과 경험을 통해 개발될 수 있어요.","Emotional intelligence can be developed through training and experience.","정서지능可以通过训练和经验得到发展。","Trí tuệ cảm xúc có thể được phát triển qua đào tạo và kinh nghiệm."),
    E("Goleman을 이야기할 때","대니얼 골먼이 정서지능 개념을 대중화했어요.","Daniel Goleman popularized the concept of emotional intelligence.","丹尼尔·戈尔曼대중화了정서지능概念。","Daniel Goleman đã phổ biến hóa khái niệm trí tuệ cảm xúc."),
    E("부모를 이야기할 때","부모의 정서지능이 자녀 발달에 영향을 미쳐요.","Parents' emotional intelligence affects children's development.","父母의정서지능影响子女의발달。","Trí tuệ cảm xúc của cha mẹ ảnh hưởng đến sự phát triển của trẻ."),
  ]),
  ((5,200),"거버넌스","명사",["통치구조","지배구조"],"governance, system of governance","治理结构，公司治理","quản trị, cơ cấu quản lý",[
    E("공공 행정을 이야기할 때","좋은 거버넌스는 효율적이고 투명한 정부 운영을 의미해요.","Good governance means efficient and transparent government operation.","좋은거버넌스意味着高效透明的政府운영。","Quản trị tốt có nghĩa là vận hành chính phủ hiệu quả và minh bạch."),
    E("기업을 이야기할 때","기업 거버넌스 강화로 투명한 경영이 이루어져요.","Transparent management is achieved through strengthening corporate governance.","通过강화기업거버넌스实现透明경영。","Quản lý minh bạch được thực hiện qua việc tăng cường quản trị doanh nghiệp."),
    E("UN을 이야기할 때","글로벌 거버넌스는 국제 문제를 공동으로 해결하는 체계예요.","Global governance is a system for collectively solving international problems.","全球거버넌스是共同解决国际问题的체계。","Quản trị toàn cầu là hệ thống giải quyết chung các vấn đề quốc tế."),
    E("시민 참여를 이야기할 때","거버넌스에 시민 참여를 높이는 것이 중요해요.","Increasing citizen participation in governance is important.","在거버넌스中提高市民参与度很重要。","Tăng cường sự tham gia của công dân trong quản trị là quan trọng."),
    E("부패를 이야기할 때","거버넌스 개혁으로 부패를 줄일 수 있어요.","Corruption can be reduced through governance reform.","通过거버넌스개혁可以减少腐败。","Có thể giảm tham nhũng qua cải cách quản trị."),
    E("지방을 이야기할 때","지방 거버넌스 강화가 분권화를 촉진해요.","Strengthening local governance promotes decentralization.","강화지방거버넌스促进分권화。","Tăng cường quản trị địa phương thúc đẩy phân quyền."),
    E("디지털을 이야기할 때","디지털 거버넌스가 공공 서비스 효율성을 높여요.","Digital governance improves the efficiency of public services.","数字거버넌스提高공공서비스효율。","Quản trị số nâng cao hiệu quả dịch vụ công."),
    E("위기를 이야기할 때","위기 상황에서 거버넌스 역량이 중요하게 드러나요.","Governance capacity becomes important in crisis situations.","在危机情况下，거버넌스역량变得重요。","Năng lực quản trị trở nên quan trọng trong các tình huống khủng hoảng."),
    E("평가를 이야기할 때","세계은행이 각국의 거버넌스 수준을 평가해요.","The World Bank evaluates the governance level of each country.","世界银행평가각국거버넌스수준。","Ngân hàng Thế giới đánh giá mức độ quản trị của từng quốc gia."),
    E("다층적을 이야기할 때","현대 거버넌스는 다양한 주체가 협력하는 다층적 구조를 가져요.","Modern governance has a multi-layered structure where various actors cooperate.","现代거버넌스具有多种主体협력的多층적구조。","Quản trị hiện đại có cấu trúc đa tầng mà nhiều chủ thể hợp tác với nhau."),
  ]),
  ((5,253),"다자주의","명사",["다자주의","다자협력"],"multilateralism","多边主义","chủ nghĩa đa phương",[
    E("국제 관계를 이야기할 때","다자주의는 여러 나라가 공동으로 문제를 해결하는 접근법이에요.","Multilateralism is an approach where multiple countries jointly solve problems.","다자주의는多国共同解决问题的접근법。","Chủ nghĩa đa phương là cách tiếp cận mà nhiều quốc gia cùng giải quyết vấn đề."),
    E("UN을 이야기할 때","유엔은 다자주의의 대표적인 국제 기구예요.","The United Nations is a representative international organization of multilateralism.","联合国是다자주의的代表性国际机构。","Liên Hợp Quốc là tổ chức quốc tế tiêu biểu của chủ nghĩa đa phương."),
    E("무역을 이야기할 때","WTO를 통한 다자주의 무역 체계가 국제 무역을 촉진해요.","The multilateral trade system through the WTO promotes international trade.","通过WTO的다자주의贸易体系促进国际贸易。","Hệ thống thương mại đa phương thông qua WTO thúc đẩy thương mại quốc tế."),
    E("기후를 이야기할 때","기후 변화 대응은 다자주의 협력이 필수적이에요.","Multilateral cooperation is essential in responding to climate change.","应对气候变化需要다자주의협력。","Hợp tác đa phương là thiết yếu trong ứng phó với biến đổi khí hậu."),
    E("보호무역과 대비할 때","보호무역주의 확산이 다자주의를 위협하고 있어요.","The spread of protectionism is threatening multilateralism.","保护主义의확산正威胁다자주의。","Sự lan rộng của chủ nghĩa bảo hộ thương mại đang đe dọa chủ nghĩa đa phương."),
    E("핵을 이야기할 때","핵 비확산을 위한 다자주의 체제가 필요해요.","A multilateral regime for nuclear non-proliferation is needed.","需要다자주의체제应对核불확산。","Cần có chế độ đa phương cho không phổ biến vũ khí hạt nhân."),
    E("안보를 이야기할 때","지역 안보는 다자주의 협력으로 더 효과적으로 유지돼요.","Regional security is more effectively maintained through multilateral cooperation.","区域안보通过다자주의협력更有效维持。","An ninh khu vực được duy trì hiệu quả hơn qua hợp tác đa phương."),
    E("COVID를 이야기할 때","팬데믹 대응에서 다자주의의 중요성이 부각됐어요.","The importance of multilateralism was highlighted in the pandemic response.","在疫情应对中，다자주의的重要性得到了凸显。","Tầm quan trọng của chủ nghĩa đa phương được làm nổi bật trong ứng phó đại dịch."),
    E("한계를 이야기할 때","다자주의 의사 결정은 시간이 오래 걸리는 단점이 있어요.","Multilateral decision-making has the disadvantage of taking a long time.","다자주의意思决定有耗时长的缺点。","Ra quyết định đa phương có nhược điểm là mất nhiều thời gian."),
    E("미래를 이야기할 때","다자주의 강화가 글로벌 문제 해결의 열쇠예요.","Strengthening multilateralism is the key to solving global problems.","강화다자주의是解决全球问题的关键。","Tăng cường chủ nghĩa đa phương là chìa khóa giải quyết các vấn đề toàn cầu."),
  ]),
  ((5,286),"안보전략","명사",["국가안보전략","방위전략"],"security strategy, national security strategy","安全战略，国家安全战略","chiến lược an ninh, chiến lược quốc phòng",[
    E("국방을 이야기할 때","국가 안보전략은 국가의 안전을 보장하기 위한 종합 계획이에요.","National security strategy is a comprehensive plan to ensure national security.","国家안보전략是确保国家安전的综합计划。","Chiến lược an ninh quốc gia là kế hoạch toàn diện để đảm bảo an ninh quốc gia."),
    E("동맹을 이야기할 때","한미 동맹은 한국 안보전략의 핵심 축이에요.","The Korea-US alliance is the core axis of South Korea's security strategy.","한미동맹是韩国안보전략的核心轴。","Liên minh Hàn-Mỹ là trục cốt lõi của chiến lược an ninh Hàn Quốc."),
    E("사이버를 이야기할 때","현대 안보전략에서 사이버 보안이 중요한 요소가 됐어요.","Cybersecurity has become an important element of modern security strategy.","网络安全已成为현대안보전략의重要요소。","An ninh mạng đã trở thành yếu tố quan trọng trong chiến lược an ninh hiện đại."),
    E("외교를 이야기할 때","안보전략은 군사력뿐 아니라 외교력도 포함해요.","Security strategy includes not only military power but also diplomatic power.","안보전략不仅包含军事력，还包含外交력。","Chiến lược an ninh bao gồm không chỉ sức mạnh quân sự mà còn sức mạnh ngoại giao."),
    E("억지를 이야기할 때","핵 억지력이 일부 국가들의 안보전략 핵심이에요.","Nuclear deterrence is the core of some countries' security strategies.","핵 억지력是一些国家안보전략的核심。","Răn đe hạt nhân là cốt lõi của chiến lược an ninh của một số quốc gia."),
    E("비전통 안보를 이야기할 때","기후변화, 전염병도 현대 안보전략에 포함돼요.","Climate change and infectious diseases are also included in modern security strategies.","气候变화, 传染病也包含在현대안보전략中。","Biến đổi khí hậu và dịch bệnh cũng được bao gồm trong chiến lược an ninh hiện đại."),
    E("예산을 이야기할 때","안보전략 실행을 위해 국방 예산이 증가하고 있어요.","Defense budgets are increasing to implement security strategies.","为实施안보전략，국방예산正在增加。","Ngân sách quốc phòng đang tăng lên để thực hiện chiến략an ninh."),
    E("지역을 이야기할 때","동북아시아 안보전략은 복잡한 외교 관계를 반영해요.","Northeast Asian security strategies reflect complex diplomatic relationships.","东北아시아안보전략反映了复杂의외교관계。","Chiến lược an ninh Đông Bắc Á phản ánh các mối quan hệ ngoại giao phức tạp."),
    E("공세적/방어적을 이야기할 때","공세적 안보전략과 방어적 안보전략의 균형이 필요해요.","Balance between offensive and defensive security strategies is needed.","需要공세적안보전략与방어적안보전략의균형。","Cần cân bằng giữa chiến lược an ninh tấn công và phòng thủ."),
    E("평가를 이야기할 때","주기적인 안보전략 평가로 변화하는 위협에 대응해요.","We respond to changing threats through periodic security strategy assessments.","通过定期안보전략평가应对변화하는威胁。","Chúng ta ứng phó với các mối đe dọa thay đổi qua đánh giá chiến lược an ninh định kỳ."),
  ]),
]

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

ENTRIES = [build_entry(*r) for r in REPLACEMENTS]
with open("D:/MakingApps/Apps/Hellowords/replacements_part6.json", "w", encoding="utf-8") as f:
    json.dump(ENTRIES, f, ensure_ascii=False, indent=2)
print(f"Part6 saved: {len(ENTRIES)} entries")
