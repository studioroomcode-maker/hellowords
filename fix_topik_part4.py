import json

def E(sit,ko,en,cn,vn): return (sit,ko,en,cn,vn)

REPLACEMENTS = [
  ((4,226),"평생학습","명사",["지속학습","성인교육"],"lifelong learning","终身学习","học tập suốt đời",[
    E("교육 철학을 이야기할 때","배움에는 나이가 없다는 평생학습의 정신이 중요해요.","The spirit of lifelong learning that there is no age limit to learning is important.","学习无年龄限制的终身学习精神很重要。","Tinh thần học tập suốt đời rằng không có giới hạn tuổi tác cho việc học là quan trọng."),
    E("성인 교육을 이야기할 때","직장인들이 평생학습 센터에서 새 기술을 배워요.","Working adults learn new skills at lifelong learning centers.","在职人员在终身学习中心学习新技能。","Người đi làm học kỹ năng mới tại trung tâm học tập suốt đời."),
    E("정부 지원을 이야기할 때","정부는 평생학습 지원을 위한 바우처 제도를 운영해요.","The government operates a voucher system to support lifelong learning.","政府运营支持终身学习的补贴券制度。","Chính phủ vận hành hệ thống phiếu học tập để hỗ trợ học tập suốt đời."),
    E("기술 변화를 논의할 때","빠른 기술 변화 시대에 평생학습이 더욱 중요해졌어요.","Lifelong learning has become more important in the era of rapid technological change.","在技术快速变化的时代，终身学习变得更加重要。","Học tập suốt đời trở nên quan trọng hơn trong thời đại thay đổi công nghệ nhanh chóng."),
    E("자기 계발을 이야기할 때","평생학습을 통해 자신의 역량을 꾸준히 개발해요.","You can continuously develop your competencies through lifelong learning.","通过终身学习持续开发自身能力。","Bạn có thể liên tục phát triển năng lực của mình qua học tập suốt đời."),
    E("온라인 교육을 이야기할 때","온라인 강좌 덕분에 평생학습이 더 쉬워졌어요.","Online courses have made lifelong learning easier.","由于在线课程，终身学习变得更加容易。","Các khóa học trực tuyến đã giúp học tập suốt đời dễ dàng hơn."),
    E("은퇴 후를 이야기할 때","은퇴 후에도 평생학습으로 활발한 삶을 유지할 수 있어요.","You can maintain an active life through lifelong learning even after retirement.","退休后也可以通过终身学习保持活跃的生活。","Bạn có thể duy trì cuộc sống năng động qua học tập suốt đời ngay cả sau khi nghỉ hưu."),
    E("교육 기관을 소개할 때","지역 주민센터에서 다양한 평생학습 강좌를 제공해요.","Various lifelong learning courses are offered at local community centers.","地方居民中心提供多种终身学习课程。","Các khóa học tập suốt đời đa dạng được cung cấp tại trung tâm cộng đồng địa phương."),
    E("직업 전환을 이야기할 때","평생학습으로 새로운 직업에 도전하는 사람이 늘었어요.","More people are challenging new careers through lifelong learning.","通过终身学习挑战新职业的人增加了。","Ngày càng nhiều người thách thức nghề nghiệp mới qua học tập suốt đời."),
    E("사회 발전을 이야기할 때","평생학습 사회는 구성원 모두가 성장하는 사회예요.","A lifelong learning society is a society where all members grow.","终身学习社会是所有成员都能成长的社会。","Xã hội học tập suốt đời là xã hội mà tất cả thành viên đều phát triển."),
  ]),
  ((4,232),"지식재산권","명사",["지적재산권","IP"],"intellectual property rights","知识产权","quyền sở hữu trí tuệ",[
    E("법률을 이야기할 때","발명품을 보호하기 위해 지식재산권 등록이 필요해요.","Intellectual property rights registration is needed to protect inventions.","需要注册知识产权来保护发明。","Cần đăng ký quyền sở hữu trí tuệ để bảo vệ phát minh."),
    E("특허를 이야기할 때","특허는 발명자의 지식재산권을 보호하는 제도예요.","A patent is a system that protects the intellectual property rights of inventors.","专利是保护发明者知识产权的制度。","Bằng sáng chế là hệ thống bảo vệ quyền sở hữu trí tuệ của nhà phát minh."),
    E("저작권을 이야기할 때","저작권도 중요한 지식재산권 중 하나예요.","Copyright is also one of the important intellectual property rights.","版权也是重要的知识产权之一。","Bản quyền cũng là một trong những quyền sở hữu trí tuệ quan trọng."),
    E("침해를 이야기할 때","지식재산권 침해는 법적 제재를 받을 수 있어요.","Intellectual property rights infringement can be subject to legal sanctions.","侵犯知识产权可能受到法律制裁。","Vi phạm quyền sở hữu trí tuệ có thể bị chế tài pháp lý."),
    E("글로벌 무역을 이야기할 때","국제 무역에서 지식재산권 보호가 핵심 이슈예요.","Intellectual property rights protection is a key issue in international trade.","在国际贸易中，知识产权保护是核心议题。","Bảo vệ quyền sở hữu trí tuệ là vấn đề cốt lõi trong thương mại quốc tế."),
    E("기업 경쟁력을 이야기할 때","기업의 지식재산권은 중요한 무형 자산이에요.","A company's intellectual property rights are important intangible assets.","企业的知识产权是重要的无形资产。","Quyền sở hữu trí tuệ của doanh nghiệp là tài sản vô hình quan trọng."),
    E("콘텐츠 창작을 이야기할 때","창작자의 지식재산권 보호가 창작 활동을 장려해요.","Protecting creators' intellectual property rights encourages creative activities.","保护创作者的知识产权能鼓励创作活动。","Bảo vệ quyền sở hữu trí tuệ của người sáng tạo khuyến khích các hoạt động sáng tạo."),
    E("디지털 환경을 논의할 때","인터넷에서 지식재산권 침해가 빈번하게 발생해요.","Intellectual property rights infringement occurs frequently on the internet.","知识产权侵犯在互联网上频繁发生。","Vi phạm quyền sở hữu trí tuệ xảy ra thường xuyên trên internet."),
    E("교육을 이야기할 때","지식재산권에 대한 교육이 학교에서 필요해요.","Education about intellectual property rights is needed in schools.","在学校需要进行知识产权教育。","Cần giáo dục về quyền sở hữu trí tuệ ở trường học."),
    E("혁신을 이야기할 때","지식재산권 보호가 기술 혁신을 촉진해요.","Intellectual property rights protection promotes technological innovation.","知识产权保护促进技术创新。","Bảo vệ quyền sở hữu trí tuệ thúc đẩy đổi mới công nghệ."),
  ]),
  ((4,234),"원격교육","명사",["비대면교육","온라인교육"],"remote education, distance learning","远程教育，在线教育","giáo dục từ xa, học trực tuyến",[
    E("코로나를 이야기할 때","팬데믹으로 원격교육이 급격히 확산됐어요.","Remote education expanded rapidly due to the pandemic.","由于疫情，远程教育迅速扩展。","Giáo dục từ xa mở rộng nhanh chóng do đại dịch."),
    E("플랫폼을 이야기할 때","다양한 원격교육 플랫폼이 학생들에게 제공돼요.","Various remote education platforms are provided to students.","多种远程教育平台向学生提供。","Nhiều nền tảng giáo dục từ xa được cung cấp cho học sinh."),
    E("장점을 이야기할 때","원격교육은 시간과 장소에 구애받지 않는 장점이 있어요.","Remote education has the advantage of not being restricted by time and place.","远程教育有不受时间和地点限制的优点。","Giáo dục từ xa có ưu điểm là không bị hạn chế bởi thời gian và địa điểm."),
    E("단점을 이야기할 때","원격교육은 직접 교류의 부족이 단점으로 꼽혀요.","Lack of direct interaction is cited as a drawback of remote education.","缺乏直接交流被认为是远程教育的缺点。","Thiếu tương tác trực tiếp được coi là nhược điểm của giáo dục từ xa."),
    E("지방을 이야기할 때","원격교육은 지방 학생들의 교육 기회를 넓혀요.","Remote education expands educational opportunities for students in rural areas.","远程教育拓宽了农村学生的教育机会。","Giáo dục từ xa mở rộng cơ hội giáo dục cho học sinh ở vùng nông thôn."),
    E("기업 교육을 이야기할 때","기업들이 원격교육으로 직원 역량 개발을 해요.","Companies develop employee competencies through remote education.","企业通过远程教育开发员工能力。","Các công ty phát triển năng lực nhân viên qua giáo dục từ xa."),
    E("기술을 이야기할 때","VR 기술이 원격교육의 질을 높이고 있어요.","VR technology is improving the quality of remote education.","VR技术正在提高远程教育的质量。","Công nghệ VR đang cải thiện chất lượng giáo dục từ xa."),
    E("접근성을 이야기할 때","원격교육은 장애인의 교육 접근성을 높여요.","Remote education improves educational accessibility for people with disabilities.","远程教育提高了残障人士的教育可及性。","Giáo dục từ xa cải thiện khả năng tiếp cận giáo dục cho người khuyết tật."),
    E("교사 역할을 이야기할 때","원격교육에서도 교사의 역할이 매우 중요해요.","The role of teachers is very important even in remote education.","即使在远程教育中，教师的作用也非常重要。","Vai trò của giáo viên rất quan trọng ngay cả trong giáo dục từ xa."),
    E("미래를 이야기할 때","원격교육과 대면교육의 혼합 방식이 미래 교육의 표준이 될 거예요.","A blended approach of remote and in-person education will become the standard for future education.","远程教育与面对面教育的混合方式将成为未来教育的标准。","Phương thức kết hợp giáo dục từ xa và trực tiếp sẽ trở thành tiêu chuẩn giáo dục tương lai."),
  ]),
  ((4,236),"역량평가","명사",["능력평가","역량 측정"],"competency assessment, competency evaluation","能力评估，素质评价","đánh giá năng lực, đánh giá kỹ năng",[
    E("인사를 이야기할 때","역량평가를 통해 직원의 강점과 약점을 파악해요.","Employee strengths and weaknesses are identified through competency assessment.","通过能力评估了解员工的优势和弱点。","Điểm mạnh và yếu của nhân viên được xác định qua đánh giá năng lực."),
    E("채용을 이야기할 때","많은 기업이 채용 시 역량평가를 실시해요.","Many companies conduct competency assessments during recruitment.","很多企业在招聘时进行能力评估。","Nhiều công ty tiến hành đánh giá năng lực trong quá trình tuyển dụng."),
    E("승진을 이야기할 때","역량평가 결과가 승진 결정에 영향을 미쳐요.","Competency assessment results influence promotion decisions.","能力评估结果影响晋升决定。","Kết quả đánh giá năng lực ảnh hưởng đến quyết định thăng chức."),
    E("교육을 이야기할 때","역량평가 결과에 따라 맞춤형 교육이 제공돼요.","Customized training is provided based on competency assessment results.","根据能力评估结果提供定制化培训。","Đào tạo tùy chỉnh được cung cấp dựa trên kết quả đánh giá năng lực."),
    E("학교 교육을 이야기할 때","학교에서도 학생 역량평가를 통해 개별 지도가 이뤄져요.","Individual guidance is also provided through student competency assessment in schools.","在学校也通过学生能力评估进行个别指导。","Hướng dẫn cá nhân cũng được thực hiện qua đánh giá năng lực học sinh ở trường."),
    E("공정성을 논의할 때","역량평가는 객관적이고 공정해야 해요.","Competency assessment must be objective and fair.","能力评估必须客观公正。","Đánh giá năng lực phải khách quan và công bằng."),
    E("360도 평가를 이야기할 때","360도 역량평가는 다양한 관점에서 역량을 측정해요.","360-degree competency assessment measures competencies from various perspectives.","360度能力评估从多角度衡量能力。","Đánh giá năng lực 360 độ đo lường năng lực từ nhiều góc độ khác nhau."),
    E("미래 역량을 이야기할 때","미래 사회에 필요한 역량을 평가하는 도구가 중요해요.","Tools for assessing competencies needed for future society are important.","评估未来社会所需能力的工具很重要。","Công cụ đánh giá năng lực cần thiết cho xã hội tương lai rất quan trọng."),
    E("자기 평가를 이야기할 때","자기 역량평가를 통해 스스로 성장 방향을 찾아요.","You can find your own direction of growth through self-competency assessment.","通过自我能力评估找到自身成长方向。","Bạn có thể tìm hướng phát triển bản thân qua tự đánh giá năng lực."),
    E("HR 시스템을 이야기할 때","디지털 역량평가 시스템 도입으로 평가가 효율화됐어요.","Assessment became more efficient with the introduction of digital competency assessment systems.","通过引进数字能力评估系统，评估效率提高了。","Đánh giá trở nên hiệu quả hơn với việc giới thiệu hệ thống đánh giá năng lực số."),
  ]),
  ((4,237),"협동학습","명사",["협력학습","그룹학습"],"cooperative learning, collaborative learning","协作学习，合作学习","học tập hợp tác, học nhóm",[
    E("교육 방법을 소개할 때","협동학습은 학생들이 함께 목표를 달성하는 교육 방법이에요.","Cooperative learning is an educational method where students achieve goals together.","协作学习是学生共同实现目标的教育方法。","Học tập hợp tác là phương pháp giáo dục mà học sinh cùng nhau đạt mục tiêu."),
    E("장점을 이야기할 때","협동학습은 의사소통 능력과 팀워크를 키워줘요.","Cooperative learning develops communication skills and teamwork.","协作学习培养沟通能力和团队合作精神。","Học tập hợp tác phát triển kỹ năng giao tiếp và tinh thần đồng đội."),
    E("그룹 활동을 이야기할 때","협동학습에서 각 구성원이 역할을 나눠 맡아요.","In cooperative learning, each member takes on different roles.","在协作学习中，每位成员分担不同角色。","Trong học tập hợp tác, mỗi thành viên đảm nhận các vai trò khác nhau."),
    E("경쟁과 비교할 때","협동학습은 경쟁보다 협력을 강조하는 교육 방식이에요.","Cooperative learning is an educational approach that emphasizes cooperation over competition.","协作学习是强调合作而非竞争的教育方式。","Học tập hợp tác là phương pháp giáo dục nhấn mạnh hợp tác hơn cạnh tranh."),
    E("사회성을 이야기할 때","협동학습을 통해 사회성이 발달해요.","Social skills develop through cooperative learning.","通过协作学习，社会性得到发展。","Kỹ năng xã hội phát triển qua học tập hợp tác."),
    E("교실 환경을 이야기할 때","협동학습이 가능한 교실 환경 조성이 중요해요.","Creating a classroom environment that enables cooperative learning is important.","创造能够开展协作学习的教室环境很重要。","Tạo môi trường lớp học cho phép học tập hợp tác là quan trọng."),
    E("효과를 이야기할 때","연구에 따르면 협동학습이 학업 성취도를 높인다고 해요.","Research suggests that cooperative learning improves academic achievement.","研究表明，协作学习能提高学业成绩。","Nghiên cứu cho thấy học tập hợp tác cải thiện thành tích học tập."),
    E("온라인 환경을 이야기할 때","온라인 수업에서도 협동학습을 적용할 수 있어요.","Cooperative learning can also be applied in online classes.","在线课程也可以应用协作学习。","Học tập hợp tác cũng có thể được áp dụng trong các lớp học trực tuyến."),
    E("다양성을 이야기할 때","다양한 배경의 학생들이 협동학습을 통해 서로 배워요.","Students with diverse backgrounds learn from each other through cooperative learning.","来自不同背景的学生通过协作学习相互学习。","Học sinh có nền tảng đa dạng học hỏi lẫn nhau qua học tập hợp tác."),
    E("교사 역할을 이야기할 때","협동학습에서 교사는 조력자 역할을 해요.","Teachers play a facilitator role in cooperative learning.","在协作学习中，教师起到助手的作用。","Giáo viên đóng vai trò người hỗ trợ trong học tập hợp tác."),
  ]),
  ((4,241),"학업성취","명사",["학습성과","학업 달성"],"academic achievement, academic performance","学业成就，学习成绩","thành tích học tập, kết quả học tập",[
    E("성적을 이야기할 때","학업성취가 높은 학생은 좋은 성적을 유지해요.","Students with high academic achievement maintain good grades.","学业成就高的学生保持良好成绩。","Học sinh có thành tích học tập cao duy trì điểm số tốt."),
    E("요인을 분석할 때","가정 환경이 학업성취에 큰 영향을 미쳐요.","The home environment has a great influence on academic achievement.","家庭环境对学业成就有很大影响。","Môi trường gia đình có ảnh hưởng lớn đến thành tích học tập."),
    E("정책을 이야기할 때","교육 당국이 학업성취 격차 해소를 위한 정책을 마련했어요.","The education authority prepared policies to close the academic achievement gap.","教育当局制定了弥合学业成就差距的政策。","Cơ quan giáo dục đã chuẩn bị chính sách thu hẹp khoảng cách thành tích học tập."),
    E("동기를 이야기할 때","학습 동기가 높을수록 학업성취가 높아요.","The higher the learning motivation, the higher the academic achievement.","学习动机越高，学业成就越高。","Động lực học tập càng cao, thành tích học tập càng cao."),
    E("평가를 이야기할 때","시험만으로 학업성취를 평가하는 것은 한계가 있어요.","Evaluating academic achievement only through exams has limitations.","仅通过考试评估学业成就有其局限性。","Chỉ đánh giá thành tích học tập qua kỳ thi có những hạn chế."),
    E("교사 역할을 이야기할 때","훌륭한 교사는 학생의 학업성취를 크게 향상시킬 수 있어요.","A great teacher can greatly improve a student's academic achievement.","出色的老师可以大大提升学生的学业成就。","Giáo viên tuyệt vời có thể cải thiện đáng kể thành tích học tập của học sinh."),
    E("또래 영향을 이야기할 때","친구들의 영향이 학업성취에 긍정적으로 작용할 수 있어요.","The influence of friends can positively affect academic achievement.","朋友的影响可以对学业成就产生积极作用。","Ảnh hưởng của bạn bè có thể tác động tích cực đến thành tích học tập."),
    E("격차를 이야기할 때","소득 수준에 따른 학업성취 격차가 심화되고 있어요.","The academic achievement gap according to income level is deepening.","根据收入水平的学业成就差距正在加深。","Khoảng cách thành tích học tập theo mức thu nhập đang sâu sắc hơn."),
    E("비인지적 요소를 이야기할 때","자기 효능감이 높은 학생이 학업성취도 높아요.","Students with high self-efficacy also have higher academic achievement.","自我效能感高的学生，学业成就也高。","Học sinh có cảm giác tự hiệu quả cao cũng có thành tích học tập cao hơn."),
    E("지원을 이야기할 때","방과 후 프로그램이 학업성취 향상에 도움이 돼요.","After-school programs help improve academic achievement.","课后项目有助于提高学业成就。","Các chương trình sau giờ học giúp cải thiện thành tích học tập."),
  ]),
  ((4,242),"저널리즘","명사",["언론","보도"],"journalism, news reporting","新闻学，新闻报道","báo chí, nghề báo",[
    E("언론을 이야기할 때","저널리즘은 민주주의 사회의 핵심 기능을 담당해요.","Journalism plays a key function in a democratic society.","新闻学承担着民主社会的核心功能。","Báo chí đảm nhận chức năng cốt lõi của xã hội dân chủ."),
    E("사실 확인을 이야기할 때","저널리즘의 기본은 사실에 근거한 정확한 보도예요.","The foundation of journalism is accurate reporting based on facts.","新闻学的基础是基于事实的准确报道。","Nền tảng của báo chí là đưa tin chính xác dựa trên sự thật."),
    E("디지털 변화를 이야기할 때","디지털 시대에 저널리즘의 형태가 크게 변화하고 있어요.","The form of journalism is changing greatly in the digital era.","数字时代，新闻学的形式正在发生巨大变化。","Hình thức báo chí đang thay đổi đáng kể trong kỷ nguyên số."),
    E("가짜 뉴스를 이야기할 때","가짜 뉴스 시대에 전문적인 저널리즘의 중요성이 커졌어요.","The importance of professional journalism has grown in the era of fake news.","在假新闻时代，专业新闻学的重要性增加了。","Tầm quan trọng của báo chí chuyên nghiệp đã tăng lên trong thời đại tin giả."),
    E("시민 저널리즘을 이야기할 때","SNS 발달로 시민 저널리즘이 활발해졌어요.","Citizen journalism has become active with the development of SNS.","随着SNS的发展，公民新闻学变得活跃。","Báo chí công dân trở nên sôi động với sự phát triển của SNS."),
    E("윤리를 이야기할 때","저널리즘 윤리는 공정성과 독립성을 요구해요.","Journalism ethics requires fairness and independence.","新闻学伦理要求公正性和独立性。","Đạo đức báo chí đòi hỏi tính công bằng và độc lập."),
    E("취재를 이야기할 때","심층 취재를 통한 탐사 저널리즘이 사회 문제를 드러내요.","Investigative journalism through in-depth reporting reveals social problems.","通过深度报道的调查新闻学揭露社会问题。","Báo chí điều tra qua phỏng vấn sâu vạch ra các vấn đề xã hội."),
    E("교육을 이야기할 때","저널리즘 전공 학생들이 현장 실습을 통해 경험을 쌓아요.","Journalism students gain experience through field training.","新闻学专业学生通过现场实习积累经验。","Sinh viên báo chí tích lũy kinh nghiệm qua thực tập thực địa."),
    E("수익 모델을 이야기할 때","디지털 광고 수익 감소로 저널리즘 산업이 어려움을 겪어요.","The journalism industry faces difficulties due to declining digital advertising revenue.","由于数字广告收入减少，新闻学行业面临困难。","Ngành báo chí gặp khó khăn do doanh thu quảng cáo số giảm sút."),
    E("미래를 이야기할 때","AI가 저널리즘에 미치는 영향에 대한 논의가 활발해요.","Discussion about the impact of AI on journalism is active.","关于人工智能对新闻学影响的讨论很活跃。","Thảo luận về tác động của AI đến báo chí rất sôi nổi."),
  ]),
  ((4,243),"사이버보안","명사",["정보보안","네트워크보안"],"cybersecurity, information security","网络安全，信息安全","an ninh mạng, bảo mật thông tin",[
    E("디지털 위협을 이야기할 때","사이버보안 위협이 갈수록 정교해지고 있어요.","Cybersecurity threats are becoming increasingly sophisticated.","网络安全威胁越来越复杂精密。","Các mối đe dọa an ninh mạng ngày càng trở nên tinh vi hơn."),
    E("기업을 이야기할 때","기업들이 사이버보안에 막대한 비용을 투자하고 있어요.","Companies are investing enormous costs in cybersecurity.","企业正在网络安全上投入大量资金。","Các công ty đang đầu tư chi phí khổng lồ vào an ninh mạng."),
    E("정부를 이야기할 때","국가 기반 시설에 대한 사이버보안이 중요한 국가 안보 문제예요.","Cybersecurity of national infrastructure is an important national security issue.","国家基础设施的网络安全是重要的国家安全问题。","An ninh mạng của cơ sở hạ tầng quốc gia là vấn đề an ninh quốc gia quan trọng."),
    E("해킹을 이야기할 때","강력한 사이버보안 시스템이 해킹 피해를 예방해요.","A strong cybersecurity system prevents hacking damage.","强大的网络安全系统可以预防黑客攻击损失。","Hệ thống an ninh mạng mạnh mẽ ngăn chặn thiệt hại từ hacking."),
    E("개인을 이야기할 때","개인도 사이버보안 의식을 높여야 해요.","Individuals also need to raise their cybersecurity awareness.","个人也需要提高网络安全意识。","Cá nhân cũng cần nâng cao ý thức về an ninh mạng."),
    E("금융을 이야기할 때","금융 분야의 사이버보안 강화가 시급해요.","Strengthening cybersecurity in the financial sector is urgent.","加强金融领域的网络安全迫在眉睫。","Tăng cường an ninh mạng trong lĩnh vực tài chính là cấp bách."),
    E("인재를 이야기할 때","사이버보안 전문 인력 부족이 심각한 문제예요.","The shortage of cybersecurity professionals is a serious problem.","网络安全专业人才短缺是严重问题。","Thiếu hụt chuyên gia an ninh mạng là vấn đề nghiêm trọng."),
    E("법률을 이야기할 때","사이버보안 관련 법률과 규정이 지속적으로 강화되고 있어요.","Cybersecurity-related laws and regulations are continuously being strengthened.","网络安全相关法律法规持续加强。","Luật và quy định liên quan đến an ninh mạng liên tục được tăng cường."),
    E("교육을 이야기할 때","사이버보안 교육이 학교에서도 이루어져야 해요.","Cybersecurity education should also take place in schools.","网络安全教育也应该在学校进行。","Giáo dục an ninh mạng cũng nên được thực hiện ở trường học."),
    E("협력을 이야기할 때","사이버 위협에 대응하기 위한 국제 협력이 필요해요.","International cooperation is needed to respond to cyber threats.","需要国际合作来应对网络威胁。","Cần hợp tác quốc tế để ứng phó với các mối đe dọa mạng."),
  ]),
  ((4,244),"온라인예절","명사",["디지털예절","네티켓"],"online etiquette, netiquette","网络礼仪，网络礼节","nghi thức trực tuyến, quy tắc ứng xử mạng",[
    E("인터넷 사용을 이야기할 때","온라인예절을 지켜야 건강한 인터넷 문화가 만들어져요.","Healthy internet culture is created when online etiquette is followed.","遵守网络礼仪才能形成健康的互联网文化。","Văn hóa internet lành mạnh được tạo ra khi tuân thủ nghi thức trực tuyến."),
    E("악플을 이야기할 때","악의적인 댓글은 온라인예절을 심각하게 위반하는 행위예요.","Malicious comments are a serious violation of online etiquette.","恶意评论是严重违反网络礼仪的行为。","Bình luận ác ý là hành vi vi phạm nghiêm trọng nghi thức trực tuyến."),
    E("SNS를 이야기할 때","SNS에서도 온라인예절이 중요해요.","Online etiquette is also important on SNS.","在SNS上，网络礼仪也很重要。","Nghi thức trực tuyến cũng quan trọng trên SNS."),
    E("개인정보를 이야기할 때","동의 없이 타인의 사진을 공유하는 것은 온라인예절 위반이에요.","Sharing someone else's photos without consent is a violation of online etiquette.","在没有同意的情况下分享他人照片是违反网络礼仪的行为。","Chia sẻ ảnh của người khác mà không có sự đồng ý là vi phạm nghi thức trực tuyến."),
    E("회의를 이야기할 때","화상 회의에서도 기본적인 온라인예절이 필요해요.","Basic online etiquette is also needed in video conferences.","视频会议中也需要基本的网络礼仪。","Nghi thức trực tuyến cơ bản cũng cần thiết trong hội nghị video."),
    E("교육을 이야기할 때","아이들에게 어릴 때부터 온라인예절 교육이 필요해요.","Children need to be educated about online etiquette from an early age.","从小就需要对孩子进行网络礼仪教育。","Trẻ em cần được giáo dục về nghi thức trực tuyến từ nhỏ."),
    E("게임을 이야기할 때","온라인 게임에서도 상대방을 존중하는 온라인예절이 중요해요.","Online etiquette that respects others is also important in online games.","在网络游戏中，尊重对方的网络礼仪也很重要。","Nghi thức trực tuyến tôn trọng người khác cũng quan trọng trong game trực tuyến."),
    E("언어 사용을 이야기할 때","온라인에서 상스러운 언어 사용은 온라인예절에 어긋나요.","Using vulgar language online goes against online etiquette.","在网络上使用粗俗语言违反网络礼仪。","Sử dụng ngôn ngữ thô tục trực tuyến trái với nghi thức trực tuyến."),
    E("직장에서","업무용 이메일에서는 공식적인 온라인예절을 지켜야 해요.","You must follow formal online etiquette in work emails.","在工作邮件中需要遵守正式的网络礼仪。","Phải tuân thủ nghi thức trực tuyến chính thức trong email công việc."),
    E("문화 차이를 이야기할 때","나라마다 온라인예절의 기준이 다를 수 있어요.","Standards of online etiquette may differ from country to country.","各国网络礼仪的标准可能有所不同。","Tiêu chuẩn nghi thức trực tuyến có thể khác nhau tùy từng quốc gia."),
  ]),
  ((4,246),"소비자권리","명사",["소비자 권리","소비자 보호권"],"consumer rights, consumer protection","消费者权利，消费者保护","quyền người tiêu dùng, bảo vệ người tiêu dùng",[
    E("법률을 이야기할 때","소비자기본법은 소비자권리를 보호하는 기본 법률이에요.","The Framework Act on Consumers is the basic law protecting consumer rights.","消费者基本法是保护消费者权利的基本法律。","Luật cơ bản về người tiêu dùng là luật cơ bản bảo vệ quyền người tiêu dùng."),
    E("환불을 이야기할 때","불량품에 대한 환불을 요구하는 것은 소비자권리예요.","Demanding a refund for defective products is a consumer right.","要求对缺陷产品退款是消费者权利。","Yêu cầu hoàn tiền cho sản phẩm lỗi là quyền của người tiêu dùng."),
    E("정보를 이야기할 때","소비자는 제품에 대한 정확한 정보를 받을 권리가 있어요.","Consumers have the right to receive accurate information about products.","消费者有权获得关于产品的准确信息。","Người tiêu dùng có quyền nhận được thông tin chính xác về sản phẩm."),
    E("안전을 이야기할 때","안전하지 않은 제품으로부터 보호받는 것이 소비자권리예요.","Being protected from unsafe products is a consumer right.","免受不安全产品伤害是消费者权利。","Được bảo vệ khỏi các sản phẩm không an toàn là quyền của người tiêu dùng."),
    E("피해 구제를 이야기할 때","소비자권리 침해 시 피해 구제를 받을 수 있어요.","You can receive damage relief when consumer rights are violated.","消费者权利受到侵犯时可以获得损害救济。","Bạn có thể nhận bồi thường khi quyền người tiêu dùng bị vi phạm."),
    E("단체를 이야기할 때","소비자 단체가 소비자권리 보호를 위해 활동해요.","Consumer organizations work to protect consumer rights.","消费者团体为保护消费者权利而活动。","Các tổ chức người tiêu dùng hoạt động để bảo vệ quyền người tiêu dùng."),
    E("디지털 시대를 이야기할 때","온라인 쇼핑 시대에 디지털 소비자권리 보호가 중요해요.","Digital consumer rights protection is important in the online shopping era.","在网购时代，数字消费者权利保护很重要。","Bảo vệ quyền người tiêu dùng số quan trọng trong thời đại mua sắm trực tuyến."),
    E("계약을 이야기할 때","불공정 계약으로부터 소비자를 보호하는 것이 소비자권리의 핵심이에요.","Protecting consumers from unfair contracts is the core of consumer rights.","保护消费者免受不公平合同侵害是消费者权利的核心。","Bảo vệ người tiêu dùng khỏi các hợp đồng không công bằng là cốt lõi của quyền người tiêu dùng."),
    E("국제 비교를 할 때","각 나라마다 소비자권리 보호 수준이 달라요.","The level of consumer rights protection differs in each country.","各国消费者权利保护水平不同。","Mức độ bảo vệ quyền người tiêu dùng khác nhau ở mỗi quốc gia."),
    E("교육을 이야기할 때","소비자권리 교육을 통해 합리적인 소비를 할 수 있어요.","You can make rational consumption through consumer rights education.","通过消费者权利教育可以进行合理消费。","Bạn có thể tiêu dùng hợp lý qua giáo dục về quyền người tiêu dùng."),
  ]),
  ((4,247),"브랜드전략","명사",["브랜드 전략","마케팅 전략"],"brand strategy, branding strategy","品牌战略，品牌策略","chiến lược thương hiệu, chiến lược xây dựng thương hiệu",[
    E("마케팅을 이야기할 때","강력한 브랜드전략이 기업의 시장 경쟁력을 높여요.","A strong brand strategy enhances a company's market competitiveness.","强大的品牌战略能提升企业的市场竞争力。","Chiến lược thương hiệu mạnh mẽ nâng cao năng lực cạnh tranh thị trường của doanh nghiệp."),
    E("브랜드 이미지를 이야기할 때","브랜드전략은 소비자 인식을 형성하는 데 중요해요.","Brand strategy is important in shaping consumer perception.","品牌战略在塑造消费者认知方面很重要。","Chiến lược thương hiệu quan trọng trong việc định hình nhận thức của người tiêu dùng."),
    E("글로벌 브랜드를 이야기할 때","성공적인 브랜드전략으로 글로벌 시장에 진출했어요.","They entered the global market with a successful brand strategy.","凭借成功的品牌战略进入了全球市场。","Họ gia nhập thị trường toàn cầu với chiến lược thương hiệu thành công."),
    E("리브랜딩을 이야기할 때","회사가 이미지 쇄신을 위해 브랜드전략을 새로 수립했어요.","The company established a new brand strategy to refresh its image.","公司为了形象更新重新制定了品牌战略。","Công ty xây dựng lại chiến lược thương hiệu để làm mới hình ảnh."),
    E("SNS를 이야기할 때","SNS 마케팅이 현대 브랜드전략의 핵심이 됐어요.","SNS marketing has become the core of modern brand strategy.","SNS营销已成为现代品牌战略的核心。","Marketing SNS đã trở thành cốt lõi của chiến lược thương hiệu hiện đại."),
    E("차별화를 이야기할 때","독특한 브랜드전략으로 경쟁사와 차별화를 이루었어요.","They differentiated from competitors with a unique brand strategy.","通过独特的品牌战略与竞争对手形成差异化。","Họ tạo ra sự khác biệt so với đối thủ cạnh tranh bằng chiến lược thương hiệu độc đáo."),
    E("스타트업을 이야기할 때","신생 기업일수록 명확한 브랜드전략이 중요해요.","A clear brand strategy is more important the newer the company.","越是新创企业，明确的品牌战略越重要。","Chiến lược thương hiệu rõ ràng càng quan trọng hơn với công ty mới thành lập."),
    E("고객 충성도를 이야기할 때","훌륭한 브랜드전략은 고객 충성도를 높여요.","A great brand strategy increases customer loyalty.","出色的品牌战略能提高客户忠诚度。","Chiến lược thương hiệu xuất sắc nâng cao lòng trung thành của khách hàng."),
    E("위기 관리를 이야기할 때","브랜드전략에는 위기 상황에 대한 대응 방안도 포함돼요.","Brand strategy also includes responses to crisis situations.","品牌战略也包含对危机情况的应对方案。","Chiến lược thương hiệu cũng bao gồm các biện pháp ứng phó với tình huống khủng hoảng."),
    E("B2B를 이야기할 때","B2B 기업도 강력한 브랜드전략이 필요해요.","B2B companies also need a strong brand strategy.","B2B企业也需要强大的品牌战略。","Doanh nghiệp B2B cũng cần chiến lược thương hiệu mạnh mẽ."),
  ]),
  ((4,254),"언론자유","명사",["언론의 자유","표현의 자유"],"freedom of the press, press freedom","新闻自由，言论自由","tự do báo chí, tự do ngôn luận",[
    E("민주주의를 이야기할 때","언론자유는 민주주의 사회의 핵심 가치예요.","Freedom of the press is a core value of a democratic society.","新闻自由是民主社会的核心价值。","Tự do báo chí là giá trị cốt lõi của xã hội dân chủ."),
    E("검열을 이야기할 때","언론자유를 억압하는 검열은 민주주의를 위협해요.","Censorship that suppresses press freedom threatens democracy.","压制新闻自由的审查制度威胁民主主义。","Kiểm duyệt trấn áp tự do báo chí đe dọa nền dân chủ."),
    E("국제 순위를 이야기할 때","언론자유 지수로 각 나라의 언론자유 수준을 비교해요.","The press freedom index compares the level of press freedom in each country.","用新闻自由指数比较各国的新闻自由水平。","Chỉ số tự do báo chí so sánh mức độ tự do báo chí của mỗi quốc gia."),
    E("언론인 보호를 이야기할 때","언론자유 보장을 위해 취재 기자를 보호해야 해요.","Reporters must be protected to guarantee press freedom.","为保障新闻自由，需要保护采访记者。","Cần bảo vệ phóng viên để đảm bảo tự do báo chí."),
    E("한계를 이야기할 때","언론자유도 타인의 명예를 훼손하는 경우엔 제한돼요.","Press freedom is also limited when it damages others' reputation.","新闻自由在损害他人名誉时也会受到限制。","Tự do báo chí cũng bị hạn chế khi xâm phạm danh dự của người khác."),
    E("정부 비판을 이야기할 때","언론자유는 정부의 잘못을 비판할 수 있는 권리를 포함해요.","Press freedom includes the right to criticize government wrongdoings.","新闻自由包括批评政府错误的权利。","Tự do báo chí bao gồm quyền phê bình những sai lầm của chính phủ."),
    E("디지털 환경을 이야기할 때","온라인 공간에서도 언론자유와 표현의 자유가 보장돼야 해요.","Freedom of the press and expression should be guaranteed in online spaces as well.","在网络空间也应该保障新闻自由和表达自由。","Tự do báo chí và tự do biểu đạt cũng phải được đảm bảo trong không gian trực tuyến."),
    E("독립 언론을 이야기할 때","독립 언론이 강할수록 언론자유도 높아요.","The stronger the independent press, the higher the press freedom.","独立新闻越强大，新闻自由越高。","Báo chí độc lập càng mạnh, tự do báo chí càng cao."),
    E("자기 검열을 이야기할 때","언론자유를 위협하는 자기 검열 현상이 우려돼요.","The phenomenon of self-censorship that threatens press freedom is concerning.","威胁新闻自由的自我审查现象令人担忧。","Hiện tượng tự kiểm duyệt đe dọa tự do báo chí là điều đáng lo ngại."),
    E("국제 기준을 이야기할 때","국제 인권법은 언론자유를 기본권으로 보장해요.","International human rights law guarantees press freedom as a fundamental right.","国际人权法将新闻自由作为基本权利予以保障。","Luật nhân quyền quốc tế đảm bảo tự do báo chí là quyền cơ bản."),
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
with open("D:/MakingApps/Apps/Hellowords/replacements_part4.json", "w", encoding="utf-8") as f:
    json.dump(ENTRIES, f, ensure_ascii=False, indent=2)
print(f"Part4 saved: {len(ENTRIES)} entries")
