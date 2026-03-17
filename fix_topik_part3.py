import json

REPLACEMENTS = []

# ---- 나머지 Level 4 ----
L4 = [
  ((4,173),"직업교육","명사",["직업훈련","기술교육"],"vocational education, vocational training","职业教育，职业培训","giáo dục nghề nghiệp, đào tạo nghề",[
    ("진로를 논의할 때","직업교육을 통해 전문 기술을 배울 수 있어요.","You can learn professional skills through vocational education.","通过职业教育可以学习专业技能。","Bạn có thể học kỹ năng chuyên môn qua giáo dục nghề nghiệp."),
    ("취업 준비를 이야기할 때","직업교육 이수 후 취업률이 크게 높아졌어요.","The employment rate increased significantly after completing vocational education.","完成职业教育后，就业率大幅提高。","Tỷ lệ có việc làm tăng đáng kể sau khi hoàn thành giáo dục nghề nghiệp."),
    ("정책을 논의할 때","정부는 직업교육 예산을 대폭 늘렸어요.","The government significantly increased the vocational education budget.","政府大幅增加了职业教育预算。","Chính phủ đã tăng đáng kể ngân sách giáo dục nghề nghiệp."),
    ("현장 실습을 이야기할 때","직업교육은 이론과 실습을 함께 가르쳐요.","Vocational education teaches both theory and practice.","职业教育同时教授理论和实践。","Giáo dục nghề nghiệp dạy cả lý thuyết lẫn thực hành."),
    ("청소년을 이야기할 때","청소년을 위한 직업교육 프로그램이 다양하게 운영돼요.","Various vocational education programs for youth are being operated.","面向青少年的职业教育项目多种多样。","Nhiều chương trình giáo dục nghề nghiệp dành cho thanh thiếu niên đang được vận hành."),
    ("성인 교육을 이야기할 때","직장인도 직업교육을 통해 새로운 기술을 익힐 수 있어요.","Working adults can also acquire new skills through vocational education.","在职人员也可以通过职业教育学习新技能。","Người đi làm cũng có thể học kỹ năng mới qua giáo dục nghề nghiệp."),
    ("디지털 시대를 논의할 때","디지털 전환 시대에 맞는 직업교육이 필요해요.","Vocational education suited to the digital transformation era is needed.","需要适合数字化转型时代的职业教育。","Cần có giáo dục nghề nghiệp phù hợp với thời đại chuyển đổi số."),
    ("글로벌 경쟁력을 논의할 때","직업교육의 질이 국가 산업 경쟁력과 직결돼요.","The quality of vocational education is directly related to national industrial competitiveness.","职业教育的质量与国家产业竞争力直接相关。","Chất lượng giáo dục nghề nghiệp gắn liền trực tiếp với năng lực cạnh tranh công nghiệp quốc gia."),
    ("소외 계층을 이야기할 때","취약 계층을 위한 직업교육 지원 사업이 확대됐어요.","Vocational education support programs for vulnerable groups have expanded.","面向弱势群体的职业教育支持项目得到了扩展。","Chương trình hỗ trợ giáo dục nghề nghiệp cho nhóm dễ bị tổn thương đã được mở rộng."),
    ("산업 수요를 이야기할 때","기업과 연계한 직업교육이 취업과 직접 연결돼요.","Vocational education linked with companies is directly connected to employment.","与企业联动的职业教育直接与就业挂钩。","Giáo dục nghề nghiệp liên kết với doanh nghiệp gắn trực tiếp với việc làm."),
  ]),
  ((4,177),"사회기반시설","명사",["인프라","기간시설"],"infrastructure, social infrastructure","社会基础设施，基础设施","cơ sở hạ tầng xã hội, hạ tầng",[
    ("도시 계획을 논의할 때","충분한 사회기반시설이 갖춰져야 도시가 발전할 수 있어요.","Cities can develop only when sufficient infrastructure is in place.","只有具备充足的社会基础设施，城市才能发展。","Thành phố chỉ có thể phát triển khi có đủ cơ sở hạ tầng xã hội."),
    ("경제 개발을 논의할 때","사회기반시설 투자는 경제 성장의 토대가 돼요.","Infrastructure investment forms the foundation of economic growth.","社会基础设施投资是经济增长的基础。","Đầu tư cơ sở hạ tầng là nền tảng của tăng trưởng kinh tế."),
    ("교통 시스템을 이야기할 때","도로, 철도, 항만 등 교통 사회기반시설이 중요해요.","Transportation infrastructure such as roads, railways, and ports is important.","道路、铁路、港口等交通社会基础设施很重要。","Cơ sở hạ tầng giao thông như đường bộ, đường sắt và cảng biển rất quan trọng."),
    ("개발도상국을 논의할 때","개발도상국은 사회기반시설 부족으로 어려움을 겪어요.","Developing countries face difficulties due to insufficient infrastructure.","发展中国家因社会基础设施不足而面临困难。","Các nước đang phát triển gặp khó khăn do thiếu cơ sở hạ tầng xã hội."),
    ("재난 복구를 이야기할 때","자연재해로 파괴된 사회기반시설 복구가 최우선 과제예요.","Restoring infrastructure destroyed by natural disasters is the top priority.","恢复被自然灾害破坏的社会基础设施是首要任务。","Khôi phục cơ sở hạ tầng bị phá hủy bởi thiên tai là ưu tiên hàng đầu."),
    ("디지털 인프라를 이야기할 때","고속 인터넷망은 현대 사회의 핵심 사회기반시설이에요.","High-speed internet networks are a key infrastructure of modern society.","高速互联网是现代社会核心的社会基础设施。","Mạng internet tốc độ cao là cơ sở hạ tầng cốt lõi của xã h회 현대."),
    ("민간 투자를 논의할 때","사회기반시설 확충을 위해 민관 협력이 필요해요.","Public-private cooperation is needed to expand infrastructure.","扩充社会基础设施需要公私合作。","Cần hợp tác công tư để mở rộng cơ sở hạ tầng."),
    ("환경을 이야기할 때","친환경 사회기반시설이 지속가능한 도시 발전에 기여해요.","Eco-friendly infrastructure contributes to sustainable urban development.","环保社会基础设施有助于可持续城市发展。","Cơ sở hạ tầng thân thiện môi trường góp phần vào phát triển đô thị bền vững."),
    ("노후화를 이야기할 때","노후화된 사회기반시설 교체에 막대한 비용이 들어요.","Replacing aging infrastructure costs an enormous amount.","更换老化的社会基础设施需要巨额费用。","Thay thế cơ sở hạ tầng xuống cấp tốn chi phí khổng lồ."),
    ("스마트 시티를 논의할 때","스마트 사회기반시설이 도시의 효율성을 크게 높여요.","Smart infrastructure greatly increases urban efficiency.","智慧社会基础设施大幅提高了城市效率。","Cơ sở hạ tầng thông minh nâng cao đáng kể hiệu quả đô thị."),
  ]),
  ((4,181),"무역협정","명사",["통상협정","FTA"],"trade agreement, free trade agreement","贸易协定，自由贸易协定","hiệp định thương mại, FTA",[
    ("경제 외교를 논의할 때","두 나라는 자유 무역협정을 체결하기로 합의했어요.","The two countries agreed to conclude a free trade agreement.","两国同意签订自由贸易协定。","Hai nước đồng ý ký kết hiệp định thương mại tự do."),
    ("수출 시장을 이야기할 때","무역협정 체결로 수출 기업들의 관세 부담이 줄었어요.","The tariff burden on export companies decreased after the trade agreement was concluded.","贸易协定签订后，出口企业的关税负担减轻了。","Gánh nặng thuế quan của các công ty xuất khẩu giảm sau khi hiệp định thương mại được ký kết."),
    ("협상 과정을 이야기할 때","무역협정 협상은 수년에 걸쳐 진행됐어요.","Trade agreement negotiations took place over several years.","贸易协定谈判进行了数年。","Đàm phán hiệp định thương mại đã diễn ra trong nhiều năm."),
    ("국내 산업을 논의할 때","무역협정으로 인해 경쟁력 없는 국내 산업이 타격을 받을 수 있어요.","Domestic industries without competitiveness may be hurt by trade agreements.","贸易协定可能使缺乏竞争力的国内产业受到冲击。","Các ngành công nghiệp trong nước thiếu cạnh tranh có thể bị ảnh hưởng bởi hiệp định thương mại."),
    ("소비자를 이야기할 때","무역협정으로 수입품 가격이 낮아져 소비자 혜택이 늘었어요.","Consumers benefited more as imported goods prices fell due to trade agreements.","贸易协定使进口商品价格下降，消费者受益增加。","Người tiêu dùng được hưởng lợi nhiều hơn khi giá hàng nhập khẩu giảm do hiệp định thương mại."),
    ("지역 통합을 논의할 때","역내 무역협정은 지역 경제 통합을 촉진해요.","Regional trade agreements promote regional economic integration.","区域贸易协定促进了地区经济一体化。","Hiệp định thương mại khu vực thúc đẩy hội nhập kinh tế khu vực."),
    ("보호무역을 이야기할 때","보호무역주의 강화로 새로운 무역협정 체결이 어려워졌어요.","The strengthening of protectionism has made it harder to conclude new trade agreements.","随着保护主义的加强，签订新贸易协定变得更加困难。","Sự tăng cường chủ nghĩa bảo hộ thương mại khiến việc ký kết hiệp định thương mại mới trở nên khó khăn hơn."),
    ("서비스 무역을 논의할 때","최근 무역협정은 상품뿐 아니라 서비스 분야도 포함해요.","Recent trade agreements cover not only goods but also services.","近来的贸易协定不仅涵盖商品，还包括服务领域。","Các hiệp định thương mại gần đây bao gồm không chỉ hàng hóa mà còn cả lĩnh vực dịch vụ."),
    ("지식재산권을 이야기할 때","현대 무역협정에는 지식재산권 보호 조항도 포함돼요.","Modern trade agreements also include provisions for intellectual property protection.","现代贸易协定还包含知识产权保护条款。","Các hiệp định thương mại hiện đại cũng bao gồm các điều khoản bảo vệ sở hữu trí tuệ."),
    ("다자 협정을 논의할 때","양자 무역협정 외에도 다자간 무역협정이 중요해요.","Multilateral trade agreements are important in addition to bilateral ones.","除双边贸易协定外，多边贸易协定也很重要。","Hiệp định thương mại đa phương cũng quan trọng ngoài các hiệp định song phương."),
  ]),
  ((4,182),"복지수당","명사",["수당","지원금"],"welfare benefit, allowance","福利补贴，津贴","trợ cấp phúc lợi, phụ cấp",[
    ("사회 보호를 이야기할 때","저소득 가구는 정부로부터 복지수당을 받을 수 있어요.","Low-income households can receive welfare benefits from the government.","低收入家庭可以从政府获得福利补贴。","Hộ gia đình thu nhập thấp có thể nhận trợ cấp phúc lợi từ chính phủ."),
    ("신청 절차를 설명할 때","복지수당을 받으려면 주민센터에 신청서를 제출해야 해요.","To receive welfare benefits, you must submit an application at the community center.","要领取福利补贴，需要向社区中心提交申请书。","Để nhận trợ cấp phúc lợi, bạn phải nộp đơn tại trung tâm cộng đồng."),
    ("수급 자격을 이야기할 때","소득과 재산 기준을 충족해야 복지수당을 받을 수 있어요.","You must meet income and asset standards to receive welfare benefits.","必须满足收入和财产标准才能获得福利补贴。","Bạn phải đáp ứng tiêu chuẩn thu nhập và tài sản để nhận trợ cấp phúc lợi."),
    ("예산을 논의할 때","복지수당 지출이 정부 예산의 상당 부분을 차지해요.","Welfare benefit spending accounts for a significant portion of the government budget.","福利补贴支出占政府预算的相当大一部分。","Chi tiêu trợ cấp phúc lợi chiếm một phần đáng kể trong ngân sách chính phủ."),
    ("아동을 이야기할 때","아동 복지수당이 가정의 양육 부담을 줄여줘요.","Child welfare benefits reduce the childcare burden on families.","儿童福利补贴减轻了家庭的育儿负担。","Trợ cấp phúc lợi trẻ em giảm gánh nặng nuôi con cho gia đình."),
    ("노인을 이야기할 때","노인 복지수당으로 어르신들의 생활이 안정됐어요.","The lives of elderly people have stabilized thanks to elderly welfare benefits.","得益于老年人福利补贴，老人们的生活稳定了。","Cuộc sống của người cao tuổi được ổn định nhờ trợ cấp phúc lợi người cao tuổi."),
    ("부정 수급을 이야기할 때","복지수당 부정 수급 문제를 막기 위한 점검이 필요해요.","Inspections are needed to prevent fraudulent receipt of welfare benefits.","需要检查以防止福利补贴的不当受领。","Cần kiểm tra để ngăn chặn nhận trái phép trợ cấp phúc lợi."),
    ("개혁을 논의할 때","복지수당 제도를 더 효율적으로 운영하기 위한 개혁이 논의됐어요.","Reform to operate the welfare benefit system more efficiently was discussed.","讨论了更高效运营福利补贴制度的改革。","Cải cách để vận hành hệ thống trợ cấp phúc lợi hiệu quả hơn đã được thảo luận."),
    ("장애인을 이야기할 때","장애인 복지수당이 자립 생활을 돕고 있어요.","Disability welfare benefits are helping people with disabilities live independently.","残疾人福利补贴正在帮助他们独立生活。","Trợ cấp phúc lợi người khuyết tật đang giúp họ sống tự lập."),
    ("국제 비교를 할 때","선진국일수록 복지수당 종류와 금액이 다양하고 많아요.","The more developed the country, the more varied and generous the welfare benefits.","越是发达国家，福利补贴的种类和金额越多越丰厚。","Quốc gia càng phát triển thì trợ cấp phúc lợi càng đa dạng và nhiều hơn."),
  ]),
  ((4,183),"공공서비스","명사",["공공 서비스","행정 서비스"],"public service, government service","公共服务，行政服务","dịch vụ công, dịch vụ công cộng",[
    ("행정을 이야기할 때","시민들은 다양한 공공서비스를 주민센터에서 이용할 수 있어요.","Citizens can use various public services at community centers.","市民可以在居民中心享受多种公共服务。","Người dân có thể sử dụng nhiều dịch vụ công tại trung tâm cộng đồng."),
    ("디지털화를 논의할 때","공공서비스 디지털화로 행정 처리가 편리해졌어요.","Administrative processing has become convenient with the digitalization of public services.","公共服务数字化使行政处理更加便利。","Xử lý hành chính trở nên thuận tiện với số hóa dịch vụ công."),
    ("민영화를 논의할 때","일부 공공서비스 민영화가 서비스 질 저하를 가져올 수 있어요.","Privatization of some public services can lead to a decline in service quality.","部分公共服务私有化可能导致服务质量下降。","Tư nhân hóa một số dịch vụ công có thể dẫn đến giảm chất lượng dịch vụ."),
    ("접근성을 이야기할 때","모든 시민이 동등하게 공공서비스를 이용할 수 있어야 해요.","All citizens should be able to use public services equally.","所有市民应该能够平等地享受公共服务。","Tất cả công dân phải có thể sử dụng dịch vụ công một cách bình đẳng."),
    ("예산을 논의할 때","공공서비스 예산 삭감이 서비스 질에 영향을 미쳐요.","Budget cuts for public services affect service quality.","公共服务预算削减影响服务质量。","Cắt giảm ngân sách dịch vụ công ảnh hưởng đến chất lượng dịch vụ."),
    ("교통을 이야기할 때","대중교통은 중요한 공공서비스 중 하나예요.","Public transportation is one of the important public services.","公共交通是重要的公共服务之一。","Giao thông công cộng là một trong những dịch vụ công quan trọng."),
    ("의료를 이야기할 때","의료 공공서비스 강화로 국민 건강이 향상됐어요.","National health improved with the strengthening of public medical services.","医疗公共服务加强后，国民健康得到了改善。","Sức khỏe quốc dân được cải thiện khi dịch vụ y tế công được tăng cường."),
    ("만족도를 이야기할 때","공공서비스 만족도 조사를 통해 서비스 개선점을 찾아요.","We find areas for service improvement through public service satisfaction surveys.","通过公共服务满意度调查寻找服务改进点。","Chúng tôi tìm điểm cải thiện dịch vụ thông qua khảo sát hài lòng với dịch vụ công."),
    ("지방 격차를 논의할 때","농촌 지역 공공서비스 접근성 개선이 필요해요.","Improving access to public services in rural areas is necessary.","需要改善农村地区公共服务的可及性。","Cần cải thiện khả năng tiếp cận dịch vụ công ở vùng nông thôn."),
    ("AI 활용을 논의할 때","인공지능을 활용한 공공서비스가 점점 늘어나고 있어요.","Public services utilizing artificial intelligence are increasingly growing.","利用人工智能的公共服务越来越多。","Dịch vụ công tận dụng trí tuệ nhân tạo ngày càng tăng lên."),
  ]),
  ((4,184),"노동시장","명사",["고용시장","취업시장"],"labor market, job market","劳动市场，就业市场","thị trường lao động, thị trường việc làm",[
    ("취업 현황을 이야기할 때","청년 노동시장 진입이 점점 어려워지고 있어요.","It is becoming increasingly difficult for youth to enter the labor market.","青年进入劳动市场越来越困难。","Việc gia nhập thị trường lao động của thanh niên ngày càng khó khăn hơn."),
    ("임금을 논의할 때","노동시장에서 공급이 수요를 초과하면 임금이 낮아져요.","When supply exceeds demand in the labor market, wages decrease.","劳动市场供过于求时，工资会降低。","Khi cung vượt cầu trong thị trường lao동, lương giảm xuống."),
    ("고용 정책을 이야기할 때","정부가 노동시장 활성화를 위한 정책을 발표했어요.","The government announced policies to invigorate the labor market.","政府宣布了激活劳动市场的政策。","Chính phủ công bố chính sách để kích hoạt thị trường lao động."),
    ("디지털 전환을 논의할 때","자동화로 인해 노동시장 구조가 변화하고 있어요.","The structure of the labor market is changing due to automation.","由于自动化，劳动市场结构正在发生变化。","Cơ cấu thị trường lao động đang thay đổi do tự động hóa."),
    ("외국인 노동자를 이야기할 때","외국인 노동자 유입이 노동시장에 영향을 미쳐요.","The inflow of foreign workers affects the labor market.","外籍劳动者的涌入影响着劳动市场。","Dòng chảy lao động nước ngoài ảnh hưởng đến thị trường lao động."),
    ("유연성을 논의할 때","노동시장 유연성이 기업의 경쟁력에 영향을 줘요.","Labor market flexibility affects corporate competitiveness.","劳动市场灵活性影响企业竞争力。","Tính linh hoạt của thị trường lao động ảnh hưởng đến năng lực cạnh tranh của doanh nghiệp."),
    ("임금 격차를 이야기할 때","성별 임금 격차는 노동시장의 불평등을 보여줘요.","The gender wage gap reveals inequality in the labor market.","性别工资差距显示了劳动市场的不平等。","Khoảng cách lương giới tính cho thấy sự bất bình đẳng trong thị trường lao động."),
    ("고령화를 논의할 때","고령화로 노동시장에서 고령 근로자 비율이 높아지고 있어요.","The proportion of older workers in the labor market is increasing due to aging.","随着老龄化，劳动市场中老年员工比例升高。","Tỷ lệ lao động lớn tuổi trong thị trường lao động tăng lên do già hóa."),
    ("기술 부족을 이야기할 때","IT 분야에서 노동시장의 기술 인력 부족이 심각해요.","The shortage of skilled workers in the IT sector's labor market is serious.","IT领域劳动市场的技术人才短缺问题严重。","Tình trạng thiếu hụt lao động kỹ thuật trong thị trường lao động lĩnh vực IT rất nghiêm trọng."),
    ("경기와 연결할 때","경기 침체기에는 노동시장이 얼어붙어요.","The labor market freezes during a recession.","经济衰退期，劳动市场冻结。","Thị trường lao động đóng băng trong thời kỳ suy thoái kinh tế."),
  ]),
  ((4,185),"인적자원","명사",["인재","인력"],"human resources, human capital","人力资源，人才","nguồn nhân lực, vốn con người",[
    ("기업 경영을 이야기할 때","기업의 가장 중요한 자산은 인적자원이에요.","The most important asset of a company is its human resources.","企业最重要的资产是人力资源。","Tài sản quan trọng nhất của doanh nghiệp là nguồn nhân lực."),
    ("교육 투자를 논의할 때","인적자원 개발을 위한 교육 투자가 필수적이에요.","Educational investment for human resource development is essential.","为开发人力资源进行教育投资是必不可少的。","Đầu tư giáo dục để phát triển nguồn nhân lực là điều cần thiết."),
    ("채용을 이야기할 때","회사는 우수한 인적자원을 확보하기 위해 경쟁하고 있어요.","Companies are competing to secure excellent human resources.","各公司正在竞争以获取优秀的人力资源。","Các công ty đang cạnh tranh để đảm bảo nguồn nhân lực xuất sắc."),
    ("국가 발전을 논의할 때","한 나라의 발전은 인적자원의 질에 달려 있어요.","A country's development depends on the quality of its human resources.","一个国家的发展取决于人力资源的质量。","Sự phát triển của một quốc gia phụ thuộc vào chất lượng nguồn nhân lực."),
    ("HR을 이야기할 때","인적자원 관리는 직원의 역량을 최대화하는 것을 목표로 해요.","Human resource management aims to maximize employee competency.","人力资源管理旨在最大化员工能力。","Quản lý nguồn nhân lực nhằm tối đa hóa năng lực của nhân viên."),
    ("글로벌 경쟁을 이야기할 때","글로벌 기업들이 우수 인적자원 유치를 위해 경쟁해요.","Global companies compete to attract excellent human resources.","全球企业竞相吸引优秀人力资源。","Các công ty toàn cầu cạnh tranh để thu hút nguồn nhân lực xuất sắc."),
    ("다양성을 논의할 때","다양한 인적자원이 조직의 창의성을 높여요.","Diverse human resources enhance organizational creativity.","多元化的人力资源提升了组织的创造力。","Nguồn nhân lực đa dạng nâng cao tính sáng tạo của tổ chức."),
    ("경제를 이야기할 때","인적자원 개발이 경제 발전의 핵심 요소예요.","Human resource development is a key factor in economic development.","人力资源开发是经济发展的核心要素。","Phát triển nguồn nhân lực là yếu tố then chốt trong phát triển kinh tế."),
    ("이민 정책을 이야기할 때","해외 우수 인적자원을 유치하는 이민 정책이 도입됐어요.","Immigration policies to attract excellent overseas human resources were introduced.","引进了吸引海外优秀人力资源的移民政策。","Chính sách nhập cư để thu hút nguồn nhân lực xuất sắc nước ngoài đã được đưa ra."),
    ("은퇴를 논의할 때","숙련된 인적자원의 조기 은퇴는 기업에 큰 손실이에요.","Early retirement of skilled human resources is a great loss to companies.","熟练人力资源的提前退休对企业是巨大损失。","Nghỉ hưu sớm của nguồn nhân lực lành nghề là tổn thất lớn cho doanh nghiệp."),
  ]),
  ((4,198),"기술혁신","명사",["기술 혁명","혁신 기술"],"technological innovation, tech innovation","技术创新，科技革新","đổi mới công nghệ, cách mạng công nghệ",[
    ("산업 변화를 이야기할 때","기술혁신이 산업 구조를 빠르게 변화시키고 있어요.","Technological innovation is rapidly changing the industrial structure.","技术创新正在迅速改变产业结构。","Đổi mới công nghệ đang thay đổi nhanh chóng cơ cấu công nghiệp."),
    ("AI를 이야기할 때","인공지능이 기술혁신의 중심에 서 있어요.","Artificial intelligence is at the center of technological innovation.","人工智能站在技术创新的核心位置。","Trí tuệ nhân tạo đứng ở trung tâm của đổi mới công nghệ."),
    ("기업 경쟁력을 논의할 때","기술혁신이 기업의 경쟁력을 결정하는 핵심 요소가 됐어요.","Technological innovation has become a key factor determining corporate competitiveness.","技术创新已成为决定企业竞争力的核心要素。","Đổi mới công nghệ đã trở thành yếu tố then chốt quyết định năng lực cạnh tranh của doanh nghiệp."),
    ("연구 개발을 이야기할 때","기술혁신을 위해 R&D 투자를 늘려야 해요.","We need to increase R&D investment for technological innovation.","需要增加研发投资以推动技术创新。","Cần tăng đầu tư R&D để đổi mới công nghệ."),
    ("사회 변화를 이야기할 때","기술혁신이 우리의 생활 방식을 크게 바꿔 놓았어요.","Technological innovation has greatly changed our way of life.","技术创新极大地改变了我们的生活方式。","Đổi mới công nghệ đã thay đổi đáng kể cách sống của chúng ta."),
    ("스타트업을 이야기할 때","스타트업이 기술혁신의 주요 동력이 되고 있어요.","Startups are becoming a major driver of technological innovation.","初创企业正在成为技术创新的主要动力。","Startup đang trở thành động lực chính của đổi mới công nghệ."),
    ("일자리를 논의할 때","기술혁신은 일자리를 없애기도 하고 새로 만들기도 해요.","Technological innovation both eliminates and creates jobs.","技术创新既消灭工作岗位，也创造新的工作岗位。","Đổi mới công nghệ vừa xóa bỏ vừa tạo ra việc làm."),
    ("윤리를 이야기할 때","기술혁신과 함께 기술 윤리에 대한 논의가 필요해요.","Discussion of technology ethics is needed along with technological innovation.","随着技术创新，需要讨论技术伦理。","Cần thảo luận về đạo đức công nghệ cùng với đổi mới công nghệ."),
    ("국가 전략을 논의할 때","국가 차원의 기술혁신 전략이 필요한 시대예요.","This is an era when a national-level technological innovation strategy is needed.","这是需要国家层面技术创新战略的时代。","Đây là thời đại cần chiến lược đổi mới công nghệ ở cấp quốc gia."),
    ("미래를 이야기할 때","기술혁신이 미래 사회의 모습을 만들어가고 있어요.","Technological innovation is shaping the future of society.","技术创新正在塑造未来社会的面貌。","Đổi mới công nghệ đang định hình diện mạo xã hội tương lai."),
  ]),
  ((4,205),"스마트시티","명사",["스마트 도시","지능형 도시"],"smart city","智慧城市","thành phố thông minh",[
    ("도시 계획을 이야기할 때","스마트시티는 ICT 기술로 도시 문제를 해결하는 것을 목표로 해요.","Smart cities aim to solve urban problems with ICT technology.","智慧城市以ICT技术解决城市问题为目标。","Thành phố thông minh nhằm giải quyết các vấn đề đô thị bằng công nghệ ICT."),
    ("교통을 이야기할 때","스마트시티에서는 실시간 교통 정보로 혼잡을 줄여요.","In smart cities, congestion is reduced with real-time traffic information.","智慧城市利用实时交通信息减少拥堵。","Trong thành phố thông minh, ùn tắc được giảm bớt bằng thông tin giao thông thời gian thực."),
    ("에너지를 논의할 때","스마트시티는 에너지 사용량을 효율적으로 관리해요.","Smart cities efficiently manage energy consumption.","智慧城市高效管理能源使用量。","Thành phố thông minh quản lý hiệu quả mức tiêu thụ năng lượng."),
    ("공공 안전을 이야기할 때","스마트시티의 CCTV 네트워크가 범죄 예방에 도움이 돼요.","The CCTV network in smart cities helps prevent crime.","智慧城市的CCTV网络有助于犯罪预防。","Mạng lưới CCTV trong thành phố thông minh giúp ngăn ngừa tội phạm."),
    ("환경을 이야기할 때","스마트시티 기술로 도시 환경 오염을 줄일 수 있어요.","Urban environmental pollution can be reduced with smart city technology.","利用智慧城市技术可以减少城市环境污染。","Ô nhiễm môi trường đô thị có thể giảm bằng công nghệ thành phố thông minh."),
    ("시민 서비스를 이야기할 때","스마트시티에서는 모바일 앱으로 다양한 시민 서비스를 이용해요.","In smart cities, various citizen services are used through mobile apps.","在智慧城市中，通过手机应用使用多种市民服务。","Trong thành phố thông minh, nhiều dịch vụ công dân được sử dụng qua ứng dụng di động."),
    ("투자를 논의할 때","스마트시티 구축에 막대한 초기 투자가 필요해요.","A huge initial investment is needed to build a smart city.","建设智慧城市需要巨额初期投资。","Cần đầu tư ban đầu khổng lồ để xây dựng thành phố thông minh."),
    ("개인정보를 논의할 때","스마트시티 데이터 수집과 개인정보 보호 간의 균형이 중요해요.","Balance between data collection in smart cities and personal information protection is important.","智慧城市数据收集与个人信息保护之间的平衡很重要。","Sự cân bằng giữa thu thập dữ liệu trong thành phố thông minh và bảo vệ thông tin cá nhân là quan trọng."),
    ("해외 사례를 이야기할 때","싱가포르는 세계적으로 선도적인 스마트시티 모델이에요.","Singapore is a globally leading smart city model.","新加坡是全球领先的智慧城市模型。","Singapore là mô hình thành phố thông minh dẫn đầu thế giới."),
    ("미래를 이야기할 때","스마트시티가 미래 도시 생활의 표준이 될 것이에요.","Smart cities will become the standard for future urban living.","智慧城市将成为未来城市生活的标准。","Thành phố thông minh sẽ trở thành tiêu chuẩn cho cuộc sống đô thị trong tương lai."),
  ]),
  ((4,208),"데이터보호","명사",["개인정보보호","정보보안"],"data protection, privacy protection","数据保护，个人信息保护","bảo vệ dữ liệu, bảo vệ thông tin cá nhân",[
    ("법률을 이야기할 때","유럽의 GDPR은 강력한 데이터보호 법률이에요.","Europe's GDPR is a strong data protection law.","欧洲的GDPR是强有力的数据保护法律。","GDPR của châu Âu là luật bảo vệ dữ liệu mạnh mẽ."),
    ("기업 의무를 이야기할 때","기업은 고객 데이터보호를 위한 시스템을 갖춰야 해요.","Companies must have systems in place for customer data protection.","企业需要建立客户数据保护系统。","Doanh nghiệp phải có hệ thống bảo vệ dữ liệu khách hàng."),
    ("해킹을 이야기할 때","사이버 공격으로 개인 데이터가 유출될 수 있어서 데이터보호가 중요해요.","Data protection is important because personal data can be leaked through cyberattacks.","由于个人数据可能通过网络攻击泄露，数据保护很重要。","Bảo vệ dữ liệu quan trọng vì dữ liệu cá nhân có thể bị rò rỉ qua tấn công mạng."),
    ("디지털 경제를 이야기할 때","디지털 경제에서 데이터보호는 기본 권리가 됐어요.","Data protection has become a fundamental right in the digital economy.","在数字经济中，数据保护已成为基本权利。","Bảo vệ dữ liệu đã trở thành quyền cơ bản trong nền kinh tế số."),
    ("동의를 이야기할 때","개인정보 수집 전에 반드시 당사자의 동의를 받아야 해요.","Consent from the individual must be obtained before collecting personal information.","收集个人信息前必须获得当事人的同意。","Phải có được sự đồng ý của cá nhân trước khi thu thập thông tin cá nhân."),
    ("AI를 이야기할 때","AI 시대에 데이터보호 이슈가 더욱 중요해지고 있어요.","Data protection issues are becoming more important in the AI era.","人工智能时代，数据保护问题变得更加重要。","Vấn đề bảo vệ dữ liệu ngày càng trở nên quan trọng hơn trong kỷ nguyên AI."),
    ("해외 전송을 이야기할 때","국가 간 데이터 전송 시 데이터보호 규정이 적용돼요.","Data protection regulations apply when transferring data between countries.","数据跨境传输时需遵守数据保护规定。","Quy định bảo vệ dữ liệu được áp dụng khi truyền dữ liệu giữa các quốc gia."),
    ("아동을 이야기할 때","아동의 개인정보는 특별한 데이터보호를 받아야 해요.","Children's personal information must receive special data protection.","儿童个人信息应受到特别的数据保护。","Thông tin cá nhân của trẻ em phải được bảo vệ dữ liệu đặc biệt."),
    ("직장을 이야기할 때","직원의 개인 데이터보호도 사용자의 의무 중 하나예요.","Protecting employees' personal data is also one of the employer's obligations.","保护员工个人数据也是雇主的义务之一。","Bảo vệ dữ liệu cá nhân của nhân viên cũng là một trong những nghĩa vụ của người sử dụng lao động."),
    ("위반을 이야기할 때","데이터보호 위반 시 대규모 과징금이 부과될 수 있어요.","Large fines can be imposed for data protection violations.","违反数据保护规定时，可能会被处以大额罚款。","Có thể bị phạt tiền lớn khi vi phạm bảo vệ dữ liệu."),
  ]),
  ((4,215),"방송매체","명사",["방송","미디어"],"broadcast media, broadcasting media","广播媒体，电视媒体","phương tiện truyền thông phát sóng, truyền thông",[
    ("미디어 환경을 이야기할 때","방송매체가 여론 형성에 큰 영향을 미쳐요.","Broadcast media has a great influence on shaping public opinion.","广播媒体对舆论形成有很大影响。","Phương tiện truyền thông phát sóng có ảnh hưởng lớn đến việc hình thành dư luận."),
    ("TV를 이야기할 때","공중파 방송매체는 여전히 많은 사람들이 이용해요.","Many people still use terrestrial broadcast media.","很多人仍然使用地面广播媒体。","Nhiều người vẫn sử dụng phương tiện truyền thông phát sóng mặt đất."),
    ("규제를 이야기할 때","방송매체는 공정성 원칙을 준수해야 해요.","Broadcast media must adhere to the principle of fairness.","广播媒体必须遵守公平原则。","Phương tiện truyền thông phát sóng phải tuân thủ nguyên tắc công bằng."),
    ("디지털 전환을 논의할 때","방송매체도 디지털 플랫폼으로 전환하고 있어요.","Broadcast media is also transitioning to digital platforms.","广播媒体也在向数字平台转型。","Phương tiện truyền thông phát sóng cũng đang chuyển đổi sang nền tảng số."),
    ("광고를 이야기할 때","방송매체 광고 시장이 디지털 광고에 밀리고 있어요.","The broadcast media advertising market is being pushed out by digital advertising.","广播媒体广告市场正被数字广告挤压。","Thị trường quảng cáo phương tiện truyền thông phát sóng đang bị quảng cáo số lấn át."),
    ("공영 방송을 이야기할 때","공영 방송매체는 공익을 위한 프로그램을 제공해야 해요.","Public broadcast media must provide programs for the public good.","公营广播媒体应该提供公益节目。","Phương tiện truyền thông phát sóng công cộng phải cung cấp chương trình vì lợi ích công."),
    ("미디어 리터러시를 논의할 때","방송매체 정보를 비판적으로 받아들이는 능력이 필요해요.","The ability to critically accept information from broadcast media is needed.","需要批判性接受广播媒体信息的能力。","Cần có khả năng tiếp nhận thông tin từ phương tiện truyền thông phát sóng một cách phê phán."),
    ("언론 자유를 이야기할 때","방송매체의 독립성이 민주주의의 초석이에요.","The independence of broadcast media is a cornerstone of democracy.","广播媒体的独立性是民主主义的基石。","Sự độc lập của phương tiện truyền thông phát sóng là nền tảng của nền dân chủ."),
    ("글로벌 경쟁을 이야기할 때","한류 콘텐츠가 글로벌 방송매체에서 큰 인기를 끌고 있어요.","Korean Wave content is gaining great popularity in global broadcast media.","韩流内容在全球广播媒体上大受欢迎。","Nội dung Hallyu đang rất được yêu thích trên phương tiện truyền thông phát sóng toàn cầu."),
    ("OTT를 이야기할 때","OTT 서비스의 성장으로 전통 방송매체가 위기를 맞고 있어요.","Traditional broadcast media is facing a crisis due to the growth of OTT services.","随着OTT服务的增长，传统广播媒体正面临危机。","Phương tiện truyền thông phát sóng truyền thống đang đối mặt với khủng hoảng do sự phát triển của dịch vụ OTT."),
  ]),
]

for item in L4:
    REPLACEMENTS.append(item)

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
    return {
        "level": level, "id": wid, "word": word, "pos": pos,
        "synonyms": synonyms,
        "meanings": {"en": en_meaning, "cn": cn_meaning, "vn": vn_meaning},
        "examples_by_lang": {
            "en": make_examples("en"),
            "cn": make_examples("cn"),
            "vn": make_examples("vn"),
        }
    }

ENTRIES = [build_entry(*r) for r in REPLACEMENTS]

with open("D:/MakingApps/Apps/Hellowords/replacements_part3.json", "w", encoding="utf-8") as f:
    json.dump(ENTRIES, f, ensure_ascii=False, indent=2)
print(f"Part3 saved: {len(ENTRIES)} entries")
