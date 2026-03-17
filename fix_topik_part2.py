import json

REPLACEMENTS = []

REPLACEMENTS += [
  ((4,86), "파업", "명사", ["총파업","쟁의"], "strike, labor strike", "罢工，劳动争议", "đình công, bãi công", [
    ("노사 갈등을 이야기할 때","임금 협상이 결렬되어 노동자들이 파업에 들어갔어요.","Workers went on strike after wage negotiations broke down.","工资谈判破裂后，工人们开始罢工了。","Người lao động đình công sau khi đàm phán tiền lương đổ vỡ."),
    ("파업 영향을 설명할 때","지하철 파업으로 출근길 시민들이 큰 불편을 겪었어요.","Citizens commuting to work faced great inconvenience due to the subway strike.","地铁罢工使上班的市民遭受了极大不便。","Người dân đi làm gặp nhiều bất tiện do đình công tàu điện ngầm."),
    ("파업 원인을 분석할 때","열악한 근무 환경이 파업의 주요 원인 중 하나예요.","Poor working conditions are one of the main causes of strikes.","恶劣的工作环境是罢工的主要原因之一。","Điều kiện làm việc kém là một trong những nguyên nhân chính của đình công."),
    ("협상을 이야기할 때","파업은 노사 간 협상이 이루어지면서 마무리됐어요.","The strike concluded as negotiations between labor and management were reached.","随着劳资谈判的达成，罢工结束了。","Cuộc đình công kết thúc khi đàm phán giữa lao động và quản lý đạt được thỏa thuận."),
    ("권리 보호를 논의할 때","합법적인 파업은 노동자의 권리를 보호하는 수단이에요.","A legal strike is a means to protect workers' rights.","合法罢工是保护工人权利的手段。","Đình công hợp pháp là phương tiện bảo vệ quyền lợi của người lao động."),
    ("산업 별 파업을 이야기할 때","의료진 파업으로 병원 운영에 차질이 생겼어요.","Hospital operations were disrupted due to a medical staff strike.","由于医护人员罢工，医院运营受到了影响。","Hoạt động bệnh viện bị gián đoạn do đình công của nhân viên y tế."),
    ("경제 피해를 이야기할 때","장기 파업은 기업과 국가 경제에 큰 손실을 가져와요.","A prolonged strike causes great losses to businesses and the national economy.","长期罢工给企业和国家经济带来重大损失。","Đình công kéo dài gây thiệt hại lớn cho doanh nghiệp và nền kinh tế quốc gia."),
    ("역사적 사례를 들 때","역사적으로 파업은 노동권 향상에 기여해 왔어요.","Historically, strikes have contributed to improving labor rights.","从历史上看，罢工为改善劳动权利做出了贡献。","Lịch sử cho thấy đình công đã góp phần cải thiện quyền lao động."),
    ("중재 과정을 이야기할 때","정부가 파업 해결을 위해 중재에 나섰어요.","The government stepped in to mediate the resolution of the strike.","政府介入调停以解决罢工问题。","Chính phủ can thiệp hòa giải để giải quyết cuộc đình công."),
    ("예방을 이야기할 때","사전 대화와 협의를 통해 파업을 예방할 수 있어요.","Strikes can be prevented through prior dialogue and consultation.","通过事先对话和协商可以预防罢工。","Có thể ngăn chặn đình công thông qua đối thoại và tham vấn trước."),
  ]),
  ((4,129), "복지정책", "명사", ["사회정책","복지제도"], "welfare policy, social policy", "福利政策，社会政策", "chính sách phúc lợi, chính sách xã hội", [
    ("정부 역할을 논의할 때","정부는 취약 계층을 위한 다양한 복지정책을 시행하고 있어요.","The government is implementing various welfare policies for vulnerable groups.","政府正在实施各种针对弱势群体的福利政策。","Chính phủ đang thực hiện nhiều chính sách phúc lợi cho các nhóm dễ bị tổn thương."),
    ("예산을 논의할 때","복지정책 확대를 위해 정부 예산이 증가했어요.","The government budget increased to expand welfare policies.","为扩大福利政策，政府预算增加了。","Ngân sách chính phủ tăng lên để mở rộng chính sách phúc lợi."),
    ("고령화 대응을 이야기할 때","고령화 사회에서 노인 복지정책의 중요성이 높아지고 있어요.","The importance of elderly welfare policies is growing in an aging society.","在老龄化社会中，老年人福利政策的重要性日益提升。","Tầm quan trọng của chính sách phúc lợi người cao tuổi ngày càng tăng trong xã hội già hóa."),
    ("복지 혜택을 설명할 때","저소득층은 복지정책을 통해 주거비를 지원받을 수 있어요.","Low-income households can receive housing cost support through welfare policies.","低收入群体可以通过福利政策获得住房费用补贴。","Hộ gia đình thu nhập thấp có thể nhận hỗ trợ chi phí nhà ở qua chính sách phúc lợi."),
    ("복지 재정을 논의할 때","증가하는 복지정책 비용을 어떻게 충당할지가 과제예요.","How to cover the increasing cost of welfare policies is a challenge.","如何弥补不断增加的福利政策费用是一大课题。","Làm thế nào để chi trả chi phí phúc lợi ngày càng tăng là một thách thức."),
    ("복지 사각지대를 논의할 때","복지정책의 혜택을 받지 못하는 사각지대를 없애야 해요.","We must eliminate blind spots that do not benefit from welfare policies.","必须消除享受不到福利政策的盲区。","Cần xóa bỏ những vùng mù không được hưởng lợi từ chính sách phúc lợi."),
    ("복지 모델을 비교할 때","북유럽 국가들의 복지정책이 세계적으로 주목받고 있어요.","Nordic countries' welfare policies are attracting worldwide attention.","北欧国家的福利政策正受到全球关注。","Chính sách phúc lợi của các nước Bắc Âu đang được thế giới chú ý."),
    ("일자리와 연결할 때","복지정책은 실업자가 재취업할 수 있도록 지원해요.","Welfare policies support the unemployed to find re-employment.","福利政策支持失业者重新就业。","Chính sách phúc lợi hỗ trợ người thất nghiệp tìm được việc làm mới."),
    ("교육 복지를 이야기할 때","아동 복지정책은 교육 기회를 균등하게 보장해요.","Child welfare policies ensure equal educational opportunities.","儿童福利政策保障了平等的教育机会。","Chính sách phúc lợi trẻ em đảm bảo cơ hội giáo dục bình đẳng."),
    ("개혁을 논의할 때","복지정책의 효율성을 높이기 위한 개혁이 필요해요.","Reform is needed to improve the efficiency of welfare policies.","需要改革来提高福利政策的效率。","Cần cải cách để nâng cao hiệu quả của các chính sách phúc lợi."),
  ]),
  ((4,135), "지속가능성", "명사", ["지속성","지속발전"], "sustainability", "可持续性，可持续发展", "tính bền vững, phát triển bền vững", [
    ("환경 정책을 논의할 때","환경 지속가능성을 위해 재생에너지 사용을 늘려야 해요.","We need to increase the use of renewable energy for environmental sustainability.","为了环境可持续性，需要增加可再生能源的使用。","Cần tăng cường sử dụng năng lượng tái tạo để đảm bảo tính bền vững môi trường."),
    ("기업 경영을 논의할 때","기업들이 장기적 지속가능성을 위해 ESG 경영을 도입하고 있어요.","Companies are adopting ESG management for long-term sustainability.","企业正在引入ESG管理以实现长期可持续发展。","Các công ty đang áp dụng quản trị ESG để đảm bảo tính bền vững dài hạn."),
    ("농업을 이야기할 때","지속가능성 있는 농업 방식으로 식량 문제를 해결할 수 있어요.","Sustainable farming methods can solve food problems.","可持续农业方式可以解决粮食问题。","Phương pháp canh tác bền vững có thể giải quyết vấn đề lương thực."),
    ("도시 계획을 논의할 때","도시의 지속가능성을 높이기 위해 녹지 공간을 확대하고 있어요.","Green spaces are being expanded to enhance urban sustainability.","为提高城市可持续性，正在扩大绿地空间。","Không gian xanh đang được mở rộng để nâng cao tính bền vững đô thị."),
    ("국제 협약을 이야기할 때","유엔의 지속가능발전목표(SDGs)는 전 세계가 함께 달성해야 할 목표예요.","The UN's Sustainable Development Goals (SDGs) are goals that the whole world must achieve together.","联合国可持续发展目标(SDGs)是全世界需要共同实现的目标。","Các Mục tiêu Phát triển Bền vững (SDGs) của LHQ là mục tiêu cả thế giới phải cùng đạt được."),
    ("소비 패턴을 이야기할 때","지속가능성을 고려한 소비 방식이 점점 더 중요해지고 있어요.","Consumption patterns that consider sustainability are becoming increasingly important.","考虑可持续性的消费方式越来越重要。","Cách tiêu dùng có xem xét tính bền vững ngày càng trở nên quan trọng hơn."),
    ("에너지를 논의할 때","화석연료 의존도를 줄이는 것이 에너지 지속가능성의 핵심이에요.","Reducing dependence on fossil fuels is key to energy sustainability.","减少对化石燃料的依赖是能源可持续性的关键。","Giảm sự phụ thuộc vào nhiên liệu hóa thạch là chìa khóa của tính bền vững năng lượng."),
    ("사회적 지속가능성을 논의할 때","불평등 해소는 사회적 지속가능성을 위해 필수적이에요.","Addressing inequality is essential for social sustainability.","消除不平等对于社会可持续性至关重要。","Giải quyết bất bình đẳng là điều cần thiết cho tính bền vững xã hội."),
    ("기후 변화와 연결할 때","기후 변화 대응은 지구의 지속가능성에 달려 있어요.","Addressing climate change depends on the sustainability of the earth.","应对气候变化取决于地球的可持续性。","Ứng phó với biến đổi khí hậu phụ thuộc vào tính bền vững của Trái Đất."),
    ("미래 세대를 이야기할 때","지속가능성은 미래 세대를 위해 현재 자원을 책임감 있게 사용하는 것이에요.","Sustainability means responsibly using current resources for future generations.","可持续性意味着为未来世代负责任地使用现有资源。","Tính bền vững có nghĩa là sử dụng tài nguyên hiện tại một cách có trách nhiệm cho thế hệ tương lai."),
  ]),
  ((4,137), "재생에너지", "명사", ["신재생에너지","친환경에너지"], "renewable energy, clean energy", "可再生能源，清洁能源", "năng lượng tái tạo, năng lượng sạch", [
    ("에너지 정책을 논의할 때","정부가 재생에너지 비율을 2030년까지 30%로 높이겠다고 발표했어요.","The government announced it would raise the renewable energy ratio to 30% by 2030.","政府宣布将在2030年前将可再生能源比例提高到30%。","Chính phủ thông báo sẽ nâng tỷ lệ năng lượng tái tạo lên 30% vào năm 2030."),
    ("태양광을 이야기할 때","태양광 발전은 대표적인 재생에너지 원 중 하나예요.","Solar power generation is one of the representative renewable energy sources.","太阳能发电是代表性可再生能源之一。","Phát điện năng lượng mặt trời là một trong những nguồn năng lượng tái tạo tiêu biểu."),
    ("투자를 논의할 때","재생에너지 산업에 대한 투자가 급격히 증가하고 있어요.","Investment in the renewable energy industry is increasing rapidly.","对可再生能源产业的投资正在迅速增加。","Đầu tư vào ngành năng lượng tái tạo đang tăng nhanh chóng."),
    ("환경 혜택을 설명할 때","재생에너지는 온실가스 배출을 크게 줄일 수 있어요.","Renewable energy can significantly reduce greenhouse gas emissions.","可再生能源可以大幅减少温室气体排放。","Năng lượng tái tạo có thể giảm đáng kể lượng khí thải nhà kính."),
    ("비용을 이야기할 때","재생에너지 발전 비용이 점점 낮아지고 있어요.","The cost of renewable energy generation is gradually decreasing.","可再生能源发电成本正在逐渐降低。","Chi phí phát điện từ năng lượng tái tạo đang dần giảm xuống."),
    ("풍력을 이야기할 때","해상 풍력 발전은 재생에너지 공급 확대에 기여하고 있어요.","Offshore wind power is contributing to expanding renewable energy supply.","海上风力发电正在为扩大可再生能源供应做出贡献。","Điện gió ngoài khơi đang góp phần mở rộng cung cấp năng lượng tái tạo."),
    ("에너지 안보를 논의할 때","재생에너지 확대는 화석연료 의존도를 낮춰 에너지 안보를 강화해요.","Expanding renewable energy reduces dependence on fossil fuels and strengthens energy security.","扩大可再生能源降低了对化石燃料的依赖，强化了能源安全。","Mở rộng năng lượng tái tạo giảm phụ thuộc vào nhiên liệu hóa thạch và tăng cường an ninh năng lượng."),
    ("일자리를 논의할 때","재생에너지 산업의 성장으로 새로운 일자리가 많이 생겨나고 있어요.","Many new jobs are being created due to the growth of the renewable energy industry.","随着可再生能源产业的增长，正在创造大量新工作岗位。","Nhiều việc làm mới đang được tạo ra nhờ sự phát triển của ngành năng lượng tái tạo."),
    ("개발도상국을 논의할 때","개발도상국에서도 재생에너지 도입이 확산되고 있어요.","The adoption of renewable energy is spreading in developing countries as well.","可再生能源的引进也在发展中国家扩展中。","Việc áp dụng năng lượng tái tạo cũng đang lan rộng ở các nước đang phát triển."),
    ("기술 발전을 이야기할 때","배터리 기술 발전으로 재생에너지 저장이 더 효율적이 됐어요.","Battery technology advances have made renewable energy storage more efficient.","随着电池技术的进步，可再生能源储存变得更加高效。","Tiến bộ công nghệ pin đã giúp lưu trữ năng lượng tái tạo hiệu quả hơn."),
  ]),
  ((4,156), "경제지표", "명사", ["경제통계","지수"], "economic indicator, economic index", "经济指标，经济指数", "chỉ số kinh tế, thước đo kinh tế", [
    ("거시경제를 분석할 때","GDP는 한 나라의 경제력을 나타내는 대표적인 경제지표예요.","GDP is a representative economic indicator that shows a country's economic strength.","GDP是代表一个国家经济实力的典型经济指标。","GDP là chỉ số kinh tế tiêu biểu thể hiện sức mạnh kinh tế của một quốc gia."),
    ("투자 결정을 논의할 때","투자자들은 주요 경제지표를 분석하여 투자 결정을 내려요.","Investors make investment decisions by analyzing key economic indicators.","投资者通过分析主要经济指标来做出投资决策。","Nhà đầu tư đưa ra quyết định đầu tư bằng cách phân tích các chỉ số kinh tế chủ yếu."),
    ("실업률을 논의할 때","실업률은 노동시장 상황을 파악하는 중요한 경제지표예요.","The unemployment rate is an important economic indicator for understanding the labor market situation.","失业率是了解劳动市场状况的重要经济指标。","Tỷ lệ thất nghiệp là chỉ số kinh tế quan trọng để nắm bắt tình hình thị trường lao động."),
    ("물가를 이야기할 때","소비자물가지수는 인플레이션을 측정하는 주요 경제지표예요.","The Consumer Price Index is a key economic indicator for measuring inflation.","消费者价格指数是衡量通货膨胀的主要经济指标。","Chỉ số giá tiêu dùng là chỉ số kinh tế chính để đo lường lạm phát."),
    ("경기 예측을 이야기할 때","선행 경제지표를 통해 경기 흐름을 미리 예측할 수 있어요.","Economic trends can be predicted in advance through leading economic indicators.","通过先行经济指标可以提前预测经济走势。","Có thể dự đoán trước xu hướng kinh tế thông qua các chỉ số kinh tế dẫn trước."),
    ("보고서를 분석할 때","이번 분기 경제지표가 예상보다 좋게 나왔어요.","The economic indicators this quarter came out better than expected.","本季度经济指标表现好于预期。","Các chỉ số kinh tế quý này tốt hơn dự kiến."),
    ("정책 효과를 평가할 때","경제지표의 변화를 통해 정책의 효과를 확인할 수 있어요.","We can confirm the effectiveness of policies through changes in economic indicators.","通过经济指标的变化可以确认政策的效果。","Có thể xác nhận hiệu quả của chính sách thông qua sự thay đổi của các chỉ số kinh tế."),
    ("국가 간 비교를 할 때","경제지표를 통해 각 나라의 경제 상황을 비교할 수 있어요.","We can compare the economic conditions of each country through economic indicators.","通过经济指标可以比较各国的经济状况。","Có thể so sánh tình hình kinh tế của từng quốc gia thông qua các chỉ số kinh tế."),
    ("중앙은행 정책을 논의할 때","중앙은행은 경제지표를 분석해서 금리를 결정해요.","The central bank determines interest rates by analyzing economic indicators.","中央银行通过分析经济指标来决定利率。","Ngân hàng trung ương quyết định lãi suất bằng cách phân tích các chỉ số kinh tế."),
    ("언론 보도를 이야기할 때","경제지표 발표가 주식 시장에 큰 영향을 미쳐요.","The announcement of economic indicators has a great impact on the stock market.","经济指标的发布对股票市场影响巨大。","Việc công bố các chỉ số kinh tế có ảnh hưởng lớn đến thị trường chứng khoán."),
  ]),
  ((4,167), "시민참여", "명사", ["시민 참가","주민 참여"], "civic participation, citizen engagement", "市民参与，公民参与", "sự tham gia của công dân, tham gia công dân", [
    ("민주주의를 논의할 때","활발한 시민참여가 민주주의를 강화해요.","Active civic participation strengthens democracy.","积极的市民参与强化了民主主义。","Sự tham gia tích cực của công dân củng cố nền dân chủ."),
    ("투표를 이야기할 때","선거 투표는 가장 기본적인 시민참여 방식이에요.","Voting in elections is the most basic form of civic participation.","选举投票是最基本的市民参与方式。","Bỏ phiếu trong bầu cử là hình thức tham gia công dân cơ bản nhất."),
    ("지역 사회를 이야기할 때","지역 사회 문제 해결에 시민참여가 중요해요.","Civic participation is important in solving community problems.","市民参与对于解决社区问题很重要。","Sự tham gia của công dân rất quan trọng trong việc giải quyết các vấn đề cộng đồng."),
    ("온라인 참여를 논의할 때","디지털 기술 덕분에 온라인 시민참여가 활발해졌어요.","Online civic participation has become active thanks to digital technology.","由于数字技术，网络市民参与变得活跃了。","Sự tham gia công dân trực tuyến trở nên sôi động nhờ công nghệ số."),
    ("청원을 이야기할 때","시민들이 온라인 청원을 통해 정책에 의견을 반영시켜요.","Citizens reflect their opinions on policies through online petitions.","市民通过网络请愿将意见反映到政策中。","Công dân phản ánh ý kiến vào chính sách thông qua kiến nghị trực tuyến."),
    ("공청회를 이야기할 때","공청회는 시민참여를 통해 정책 결정에 영향을 미치는 장이에요.","Public hearings are a venue for influencing policy decisions through civic participation.","公听会是通过市民参与影响政策决定的场所。","Phiên điều trần công khai là nơi ảnh hưởng đến việc hoạch định chính sách thông qua sự tham gia của công dân."),
    ("자원봉사를 이야기할 때","자원봉사 활동도 적극적인 시민참여의 한 형태예요.","Volunteer activities are also a form of active civic participation.","志愿者活动也是积极市民参与的一种形式。","Hoạt động tình nguyện cũng là một hình thức tham gia công dân tích cực."),
    ("교육을 이야기할 때","학교에서 시민참여의 중요성을 교육하는 것이 필요해요.","It is necessary to educate about the importance of civic participation in schools.","在学校教育市民参与的重要性是必要的。","Cần giáo dục về tầm quan trọng của sự tham gia công dân ở trường học."),
    ("참여 저하를 논의할 때","젊은 세대의 정치 무관심은 시민참여를 약화시켜요.","Political apathy among the younger generation weakens civic participation.","年轻一代的政治冷漠削弱了市民参与。","Sự thờ ơ chính trị của thế hệ trẻ làm yếu đi sự tham gia công dân."),
    ("지방자치를 이야기할 때","지방자치 발전을 위해 주민들의 적극적인 시민참여가 필요해요.","Active civic participation by residents is needed for the development of local autonomy.","地方自治发展需要居民积极的市民参与。","Sự tham gia tích cực của cư dân là cần thiết cho sự phát triển của tự quản địa phương."),
  ]),
  ((4,169), "핵가족", "명사", ["소가족","부부가족"], "nuclear family, small family", "核家庭，小家庭", "gia đình hạt nhân, gia đình nhỏ", [
    ("가족 형태를 설명할 때","현대 사회에서 핵가족이 가장 일반적인 가족 형태가 됐어요.","The nuclear family has become the most common family form in modern society.","在现代社会，核家庭已成为最普遍的家庭形式。","Gia đình hạt nhân đã trở thành hình thức gia đình phổ biến nhất trong xã hội hiện đại."),
    ("사회 변화를 이야기할 때","산업화와 도시화로 핵가족화가 빠르게 진행됐어요.","Nuclearization of the family progressed rapidly due to industrialization and urbanization.","由于工业化和城市化，家庭核家庭化迅速推进。","Sự hạt nhân hóa gia đình tiến triển nhanh chóng do công nghiệp hóa và đô thị hóa."),
    ("육아 문제를 논의할 때","핵가족에서는 육아를 부부가 함께 나눠야 해요.","In a nuclear family, childcare must be shared by the couple.","在核家庭中，育儿需要夫妻共同分担。","Trong gia đình hạt nhân, việc chăm con phải được chia sẻ giữa vợ chồng."),
    ("노인 돌봄을 이야기할 때","핵가족화로 인해 노인 독거 문제가 심각해졌어요.","The problem of elderly people living alone has become serious due to the nuclearization of families.","由于家庭核家庭化，老年人独居问题变得严重了。","Vấn đề người cao tuổi sống một mình trở nên nghiêm trọng do sự hạt nhân hóa gia đình."),
    ("대가족과 비교할 때","대가족에 비해 핵가족은 개인 공간이 보장돼요.","Compared to extended families, nuclear families guarantee personal space.","与大家庭相比，核家庭能保障个人空间。","So với gia đình nhiều thế hệ, gia đình hạt nhân đảm bảo không gian cá nhân."),
    ("경제적 측면을 이야기할 때","핵가족은 생활비 절감을 위해 맞벌이를 선택하는 경우가 많아요.","Nuclear families often choose dual income to reduce living costs.","核家庭经常选择双职工以降低生活成本。","Gia đình hạt nhân thường chọn cả hai vợ chồng đi làm để giảm chi phí sinh hoạt."),
    ("사회 복지를 논의할 때","핵가족 증가로 가족 내 복지 기능이 약화돼 사회적 지원이 필요해요.","Social support is needed as welfare functions within families weaken due to the increase in nuclear families.","随着核家庭增加，家庭内部福利功能弱化，需要社会支持。","Cần hỗ trợ xã hội do chức năng phúc lợi trong gia đình suy yếu khi gia đình hạt nhân tăng lên."),
    ("가족 문화를 이야기할 때","핵가족 문화에서 명절 가족 모임의 의미가 더욱 커졌어요.","The significance of family gatherings during holidays has grown in nuclear family culture.","在核家庭文化中，节假日家庭聚会的意义更加重要了。","Ý nghĩa của các buổi họp gia đình trong ngày lễ càng lớn hơn trong văn hóa gia đình hạt nhân."),
    ("저출산을 이야기할 때","핵가족화와 함께 출산율이 계속 낮아지고 있어요.","Birth rates continue to decline along with the nuclearization of families.","随着家庭核家庭化，出生率持续下降。","Tỷ lệ sinh tiếp tục giảm cùng với sự hạt nhân hóa gia đình."),
    ("교육을 논의할 때","핵가족 환경에서 자란 아이들은 형제자매 간 경험이 부족할 수 있어요.","Children raised in nuclear family environments may lack sibling experiences.","在核家庭环境中长大的孩子可能缺乏兄弟姐妹间的经历。","Trẻ em lớn lên trong môi trường gia đình hạt nhân có thể thiếu kinh nghiệm giữa anh chị em."),
  ]),
  ((4,170), "고령화사회", "명사", ["노령화사회","노인사회"], "aging society, graying society", "老龄化社会", "xã hội già hóa, xã hội lão hóa", [
    ("인구 통계를 이야기할 때","한국은 빠르게 고령화사회로 진입하고 있어요.","South Korea is rapidly entering an aging society.","韩国正在迅速进入老龄化社会。","Hàn Quốc đang nhanh chóng bước vào xã hội già hóa."),
    ("복지 정책을 논의할 때","고령화사회에 대응하기 위한 노인 복지 예산이 증가하고 있어요.","The elderly welfare budget to respond to an aging society is increasing.","应对老龄化社会的老年人福利预算正在增加。","Ngân sách phúc lợi người cao tuổi để ứng phó với xã hội già hóa đang tăng lên."),
    ("노동력 부족을 논의할 때","고령화사회는 생산 가능 인구 감소로 노동력 부족 문제를 초래해요.","An aging society causes labor shortages due to a decrease in the working-age population.","老龄化社会因劳动年龄人口减少而导致劳动力短缺问题。","Xã hội già hóa gây ra vấn đề thiếu hụt lao động do dân số trong độ tuổi lao động giảm."),
    ("의료비를 이야기할 때","고령화사회에서는 의료비 지출이 크게 늘어나요.","Healthcare expenditure increases significantly in an aging society.","在老龄化社会中，医疗费用支出大幅增加。","Chi tiêu y tế tăng đáng kể trong xã hội già hóa."),
    ("연금 문제를 논의할 때","고령화사회에서 국민연금 재정 지속가능성이 위협받고 있어요.","The financial sustainability of the national pension is threatened in an aging society.","在老龄化社会中，国民养老金的财政可持续性受到威胁。","Tính bền vững tài chính của lương hưu quốc dân bị đe dọa trong xã hội già hóa."),
    ("기술 혁신을 이야기할 때","고령화사회 문제를 해결하기 위해 노인 케어 기술이 발전하고 있어요.","Elderly care technology is advancing to solve the problems of an aging society.","为解决老龄化社会问题，老年人护理技术正在发展。","Công nghệ chăm sóc người cao tuổi đang phát triển để giải quyết vấn đề xã hội già hóa."),
    ("가족 변화를 이야기할 때","고령화사회에서 독거노인 비율이 높아지는 것이 우려돼요.","The increasing proportion of elderly people living alone in an aging society is concerning.","老龄化社会中，独居老人比例升高令人担忧。","Tỷ lệ người cao tuổi sống một mình ngày càng tăng trong xã hội già hóa là điều đáng lo ngại."),
    ("경제 성장을 논의할 때","고령화사회는 소비 패턴 변화를 가져와 경제에 영향을 미쳐요.","An aging society brings changes in consumption patterns and affects the economy.","老龄化社会带来消费模式变化，影响经济。","Xã hội già hóa mang lại những thay đổi trong mô hình tiêu dùng và ảnh hưởng đến kinh tế."),
    ("국제 사례를 비교할 때","일본은 이미 초고령화사회를 경험하며 다양한 정책을 시행했어요.","Japan has already experienced a super-aging society and implemented various policies.","日本已经经历了超老龄化社会，实施了多种政策。","Nhật Bản đã trải qua xã hội siêu già hóa và thực hiện nhiều chính sách khác nhau."),
    ("사회 인식을 이야기할 때","고령화사회에서 노인에 대한 긍정적인 사회 인식이 필요해요.","A positive social perception of the elderly is needed in an aging society.","在老龄化社会中，需要对老年人持积极的社会认知。","Cần có nhận thức xã hội tích cực về người cao tuổi trong xã hội già hóa."),
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
    meanings = {"en": en_meaning, "cn": cn_meaning, "vn": vn_meaning}
    return {
        "level": level, "id": wid, "word": word, "pos": pos,
        "synonyms": synonyms, "meanings": meanings,
        "examples_by_lang": {
            "en": make_examples("en"),
            "cn": make_examples("cn"),
            "vn": make_examples("vn"),
        }
    }

ENTRIES = [build_entry(*r) for r in REPLACEMENTS]

with open("D:/MakingApps/Apps/Hellowords/replacements_part2.json", "w", encoding="utf-8") as f:
    json.dump(ENTRIES, f, ensure_ascii=False, indent=2)

print(f"Part2 saved: {len(ENTRIES)} entries")
