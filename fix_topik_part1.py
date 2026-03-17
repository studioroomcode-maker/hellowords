import json, os

# Each entry: (level, id, word, pos, synonyms, en_meaning, cn_meaning, vn_meaning, examples)
# examples: list of (situation, ko, en, cn, vn)

REPLACEMENTS = []

# ===== LEVEL 3 =====
REPLACEMENTS += [
  ((3,75), "산책", "명사", ["걷기","보행"], "walk, stroll", "散步，漫步", "đi dạo, tản bộ", [
    ("공원에서 걷는 상황","매일 아침 공원에서 산책을 해요.","I take a walk in the park every morning.","我每天早上在公园散步。","Tôi đi dạo trong công viên mỗi buổi sáng."),
    ("건강을 위해 운동할 때","건강을 위해 저녁마다 30분씩 산책해요.","I walk for 30 minutes every evening for my health.","为了健康，我每晚散步30分钟。","Tôi đi bộ 30 phút mỗi tối để giữ sức khỏe."),
    ("날씨가 좋을 때","날씨가 좋아서 점심시간에 산책을 했어요.","The weather was nice so I took a walk at lunch.","天气很好，我在午休时去散步了。","Thời tiết đẹp nên tôi đi dạo vào giờ nghỉ trưa."),
    ("강아지와 함께 나갈 때","강아지와 함께 산책하면 기분이 좋아요.","Taking a walk with my dog makes me feel good.","和狗狗一起散步心情很好。","Đi dạo cùng chó khiến tôi cảm thấy vui."),
    ("아침 일과를 설명할 때","아침 식사 후 산책하는 것이 저의 일과예요.","Taking a walk after breakfast is part of my daily routine.","饭后散步是我的日常习惯。","Đi dạo sau bữa sáng là thói quen hàng ngày của tôi."),
    ("운동을 추천할 때","특별한 운동이 어렵다면 가벼운 산책부터 시작해 보세요.","If intense exercise is hard, start with a light walk.","如果剧烈运动有困难，可以从轻松散步开始。","Nếu khó tập nặng, hãy bắt đầu với đi bộ nhẹ nhàng."),
    ("동네를 구경할 때","새로 이사한 동네를 산책하며 둘러봤어요.","I explored my new neighborhood by taking a walk.","我散步游览了新搬来的小区。","Tôi khám phá khu phố mới bằng cách đi dạo."),
    ("친구와 함께할 때","친구와 한강 공원에서 산책했어요.","I went for a walk with a friend at Han River Park.","我和朋友在汉江公园散步。","Tôi đi dạo cùng bạn ở công viên sông Hàn."),
    ("비 온 후 상쾌할 때","비가 그친 후 상쾌한 공기를 마시며 산책했어요.","I took a walk breathing fresh air after the rain stopped.","雨停后，我呼吸着清新空气散步。","Tôi đi dạo hít không khí trong lành sau khi mưa tạnh."),
    ("퇴근 후 쉬는 상황","퇴근 후 동네를 산책하면 피로가 풀려요.","Taking a walk through the neighborhood after work relieves fatigue.","下班后在小区散步能消除疲劳。","Đi dạo quanh khu phố sau giờ làm việc giúp giảm mệt mỏi."),
  ]),
  ((3,81), "체험", "명사", ["경험","직접 경험"], "hands-on experience", "体验，亲身经历", "trải nghiệm thực tế", [
    ("현장 학습에서","농장 체험을 통해 채소가 어떻게 자라는지 배웠어요.","Through a farm experience, I learned how vegetables grow.","通过农场体验，我了解了蔬菜的生长过程。","Qua trải nghiệm nông trại, tôi học được rau củ mọc lên như thế nào."),
    ("문화 활동을 소개할 때","도자기 만들기 체험이 생각보다 재미있었어요.","The pottery-making experience was more fun than I expected.","陶艺体验比想象中更有趣。","Trải nghiệm làm gốm thú vị hơn tôi nghĩ."),
    ("여행 중 활동을 설명할 때","여행 중에 현지 요리 체험 프로그램에 참가했어요.","I joined a local cooking experience program during the trip.","旅行中，我参加了当地烹饪体验项目。","Trong chuyến đi, tôi tham gia chương trình trải nghiệm ẩm thực địa phương."),
    ("학교 행사를 설명할 때","학교에서 직업 체험의 날 행사를 열었어요.","The school held a career experience day event.","学校举办了职业体验日活动。","Trường tổ chức ngày trải nghiệm nghề nghiệp."),
    ("어린이 교육에서","아이들이 자연 체험 활동을 통해 환경을 배워요.","Children learn about the environment through nature activities.","孩子们通过自然体验活动了解环境。","Trẻ em học về môi trường qua các hoạt động trải nghiệm thiên nhiên."),
    ("직접 해보는 것을 설명할 때","직접 체험해 보면 더 잘 이해할 수 있어요.","You can understand better if you experience it firsthand.","亲身体验会让理解更深刻。","Bạn sẽ hiểu rõ hơn nếu trực tiếp trải nghiệm."),
    ("문화 축제에서","전통문화 체험 부스가 축제에서 인기가 많았어요.","The traditional culture booth was very popular at the festival.","传统文化体验展台在节日上很受欢迎。","Gian trải nghiệm văn hóa truyền thống rất được yêu thích tại lễ hội."),
    ("회사 연수에서","신입 직원들이 현장 체험 연수를 받았어요.","New employees received on-site experience training.","新员工接受了现场体验培训。","Nhân viên mới được đào tạo trải nghiệm thực tế."),
    ("여행 프로그램을 소개할 때","이 여행사는 다양한 문화 체험 프로그램을 제공해요.","This travel agency offers various cultural experience programs.","这家旅行社提供多种文化体验项目。","Công ty du lịch này cung cấp nhiều chương trình trải nghiệm văn hóa."),
    ("특별한 경험을 이야기할 때","한국 전통 음식 만들기 체험은 잊을 수 없는 추억이 됐어요.","The Korean traditional food-making experience became an unforgettable memory.","制作韩国传统食物的体验成为了难忘的回忆。","Trải nghiệm làm ẩm thực truyền thống Hàn Quốc trở thành ký ức khó quên."),
  ]),
  ((3,112), "동호회", "명사", ["동아리","클럽"], "club, interest group", "兴趣小组，俱乐部", "câu lạc bộ, nhóm sở thích", [
    ("취미 모임을 소개할 때","사진 동호회에 가입해서 매주 함께 사진을 찍어요.","I joined a photography club and we take photos together every week.","我加入了摄影兴趣小组，每周一起拍照。","Tôi tham gia câu lạc bộ nhiếp ảnh và chúng tôi chụp ảnh cùng nhau mỗi tuần."),
    ("사람을 사귀는 방법을 이야기할 때","독서 동호회를 통해 좋은 친구들을 많이 사귀었어요.","I made many good friends through a book club.","通过读书俱乐部结交了很多好朋友。","Tôi kết bạn được nhiều người tốt qua câu lạc bộ đọc sách."),
    ("회사 복지를 설명할 때","회사에서 직원들을 위한 다양한 동호회 활동을 지원해요.","The company supports various club activities for employees.","公司为员工提供多种兴趣小组活动支持。","Công ty hỗ trợ các hoạt động câu lạc bộ đa dạng cho nhân viên."),
    ("모임 날짜를 정할 때","등산 동호회 모임이 이번 주 토요일이에요.","The hiking club meeting is this Saturday.","登山俱乐部聚会在本周六。","Buổi họp của câu lạc bộ leo núi là thứ Bảy tuần này."),
    ("새로운 취미를 시작할 때","요리 동호회에 들어가서 새로운 요리를 배우고 싶어요.","I want to join a cooking club to learn new recipes.","我想加入烹饪兴趣小组学习新菜谱。","Tôi muốn tham gia câu lạc bộ nấu ăn để học món mới."),
    ("동호회 활동을 설명할 때","자전거 동호회에서 주말마다 함께 라이딩을 해요.","In the cycling club, we ride together every weekend.","自行车俱乐部每个周末一起骑行。","Câu lạc bộ xe đạp cùng nhau đạp xe mỗi cuối tuần."),
    ("온라인 모임을 이야기할 때","요즘은 온라인으로도 동호회 활동을 할 수 있어요.","These days you can participate in club activities online too.","现在也可以通过网络参加兴趣小组活动。","Ngày nay bạn cũng có thể tham gia hoạt động câu lạc bộ trực tuyến."),
    ("동호회를 추천할 때","관심 있는 동호회에 가입하면 시간을 즐겁게 보낼 수 있어요.","Joining a club you are interested in is a great way to enjoy your time.","加入感兴趣的俱乐部可以愉快地打发时间。","Tham gia câu lạc bộ bạn yêu thích là cách tuyệt vời để tận hưởng thời gian."),
    ("활동 빈도를 말할 때","봉사 동호회에서 한 달에 두 번 자원봉사를 해요.","In the volunteer club, we volunteer twice a month.","在志愿者兴趣小组每月志愿服务两次。","Trong câu lạc bộ tình nguyện, chúng tôi làm tình nguyện hai lần một tháng."),
    ("모집 공고를 낼 때","우리 회사 영화 동호회에서 새 회원을 모집하고 있어요.","Our company's film club is recruiting new members.","我们公司的电影俱乐部正在招募新成员。","Câu lạc bộ phim của công ty chúng tôi đang tuyển thành viên mới."),
  ]),
  ((3,205), "불편", "명사", ["불쾌","어려움"], "inconvenience, discomfort", "不便，不适", "sự bất tiện, khó chịu", [
    ("사과할 때","이용에 불편을 드려 대단히 죄송합니다.","We sincerely apologize for the inconvenience.","给您带来不便，深感抱歉。","Chúng tôi chân thành xin lỗi vì sự bất tiện đã gây ra."),
    ("서비스 문제를 제기할 때","이 앱은 사용하기 불편한 점이 많아요.","This app has many inconvenient aspects to use.","这个应用有很多使用不便的地方。","Ứng dụng này có nhiều điểm bất tiện khi sử dụng."),
    ("몸이 좋지 않을 때","몸에 불편함을 느끼면 바로 병원에 가는 게 좋아요.","If you feel physical discomfort, it is best to go to the hospital.","如果感到身体不适，最好马上去医院。","Nếu cảm thấy khó chịu trong người, tốt nhất nên đến bệnh viện ngay."),
    ("시설 문제를 이야기할 때","오래된 건물이라 생활이 불편한 부분이 있어요.","Since it is an old building, there are some inconveniences in living here.","由于是旧楼，生活中有些不便的地方。","Vì là tòa nhà cũ nên có một số bất tiện trong sinh hoạt."),
    ("교통 문제를 설명할 때","대중교통이 없어서 이동하기 불편해요.","The lack of public transportation makes getting around inconvenient.","没有公共交通，出行很不方便。","Không có phương tiện công cộng nên việc di chuyển rất bất tiện."),
    ("고객 불만을 접수할 때","불편 사항이 있으시면 고객센터에 연락해 주세요.","If you have any inconveniences, please contact our customer center.","如有不便，请联系客服中心。","Nếu có bất tiện gì, vui lòng liên hệ trung tâm hỗ trợ khách hàng."),
    ("언어 장벽을 이야기할 때","외국어를 못해서 여행 중 불편을 겪었어요.","I experienced inconvenience during travel because I couldn't speak the language.","因为不会外语，旅行中遇到了不少不便。","Tôi gặp bất tiện trong chuyến đi vì không biết ngoại ngữ."),
    ("환경 문제를 제기할 때","소음 때문에 생활에 불편을 겪고 있어요.","I am experiencing inconvenience in daily life due to noise.","因为噪音，生活中感到不便。","Tôi đang gặp bất tiện trong cuộc sống do tiếng ồn."),
    ("개선 의견을 제시할 때","불편 없이 서비스를 이용할 수 있도록 개선할게요.","We will make improvements so you can use the service without inconvenience.","我们将进行改善，让您能无障碍地使用服务。","Chúng tôi sẽ cải thiện để bạn sử dụng dịch vụ không gặp bất tiện."),
    ("접근성 문제를 설명할 때","휠체어 사용자에게 불편한 시설이 아직 많아요.","There are still many facilities that are inconvenient for wheelchair users.","对轮椅使用者不便的设施还很多。","Vẫn còn nhiều cơ sở vật chất bất tiện cho người dùng xe lăn."),
  ]),
  ((3,228), "개선", "명사/동사", ["향상","보완"], "improvement, enhancement", "改善，改进", "cải thiện, cải tiến", [
    ("업무를 논의할 때","업무 효율을 개선하기 위한 회의를 열었어요.","We held a meeting to improve work efficiency.","我们召开了提高工作效率的会议。","Chúng tôi tổ chức cuộc họp để cải thiện hiệu quả công việc."),
    ("서비스 품질을 논의할 때","고객 불만을 바탕으로 서비스를 개선했어요.","We improved the service based on customer feedback.","根据客户反馈改善了服务。","Chúng tôi cải thiện dịch vụ dựa trên phản hồi của khách hàng."),
    ("건강 습관을 이야기할 때","생활 습관을 개선하면 건강이 좋아져요.","Improving your lifestyle habits will make you healthier.","改善生活习惯会让身体更健康。","Cải thiện thói quen sinh hoạt sẽ giúp bạn khỏe mạnh hơn."),
    ("학습 방법을 논의할 때","공부 방법을 개선해서 성적이 올랐어요.","My grades went up after I improved my study methods.","改进了学习方法后，成绩提高了。","Điểm số của tôi tăng lên sau khi cải thiện phương pháp học."),
    ("도시 환경을 이야기할 때","도시 환경 개선을 위해 공원을 새로 만들었어요.","A new park was built to improve the urban environment.","为了改善城市环境，新建了公园。","Một công viên mới được xây dựng để cải thiện môi trường đô thị."),
    ("회사 시스템을 변경할 때","새로운 시스템 도입으로 업무 환경이 크게 개선됐어요.","The new system greatly improved the work environment.","引进新系统后，工作环境大幅改善。","Việc đưa vào hệ thống mới đã cải thiện đáng kể môi trường làm việc."),
    ("의사소통 문제를 해결할 때","팀 내 소통 방식을 개선해서 갈등이 줄었어요.","Improving team communication reduced conflicts.","改善团队内部沟通方式后，矛盾减少了。","Cải thiện cách giao tiếp trong nhóm đã giúp giảm xung đột."),
    ("정책 효과를 평가할 때","이번 정책은 교통 상황을 크게 개선했어요.","This policy significantly improved the traffic situation.","这次政策大幅改善了交通状况。","Chính sách lần này đã cải thiện đáng kể tình trạng giao thông."),
    ("시험 준비를 이야기할 때","약점을 개선하면 시험에서 더 좋은 결과를 낼 수 있어요.","You can get better exam results by improving your weaknesses.","改善弱点可以在考试中取得更好的成绩。","Cải thiện điểm yếu sẽ giúp bạn đạt kết quả tốt hơn trong kỳ thi."),
    ("환경 대책을 논의할 때","공기 질 개선을 위해 공장 배출 기준을 강화했어요.","Factory emission standards were tightened to improve air quality.","为改善空气质量，加强了工厂排放标准。","Tiêu chuẩn thải ra của nhà máy được siết chặt để cải thiện chất lượng không khí."),
  ]),
  ((3,299), "소풍", "명사", ["나들이","야외활동"], "picnic, field trip", "郊游，野餐", "dã ngoại, đi picnic", [
    ("학교 행사를 이야기할 때","봄에 학교 소풍이 있어서 설레요.","I am excited because there is a school field trip in spring.","春天有学校郊游，很期待。","Tôi háo hức vì có chuyến dã ngoại trường học vào mùa xuân."),
    ("가족 나들이를 계획할 때","주말에 가족과 함께 소풍을 가기로 했어요.","We decided to go on a picnic with the family on the weekend.","我们决定周末和家人一起去郊游。","Chúng tôi đã quyết định đi dã ngoại cùng gia đình vào cuối tuần."),
    ("도시락을 준비할 때","소풍을 위해 아침 일찍 도시락을 준비했어요.","I prepared a lunchbox early in the morning for the picnic.","为了郊游，我一大早就准备好了便当。","Tôi chuẩn bị hộp cơm từ sớm cho chuyến dã ngoại."),
    ("날씨 걱정을 이야기할 때","소풍 날 날씨가 맑기를 바라요.","I hope the weather is clear on the picnic day.","希望郊游那天天气晴朗。","Tôi mong trời sẽ trong xanh vào ngày đi dã ngoại."),
    ("자연 속에서 즐기는 상황","봄꽃이 핀 공원에서 소풍을 즐겼어요.","We enjoyed a picnic in the park where spring flowers bloomed.","在春花盛开的公园里享受了郊游。","Chúng tôi tận hưởng buổi dã ngoại ở công viên nơi hoa mùa xuân nở rộ."),
    ("추억을 이야기할 때","어릴 때 소풍 가던 기억이 아직도 생생해요.","The memory of going on field trips as a child is still vivid.","小时候去郊游的记忆至今历历在目。","Ký ức về những chuyến dã ngoại hồi nhỏ vẫn còn rõ ràng."),
    ("음식을 나눠 먹을 때","소풍에서 친구들과 김밥을 나눠 먹었어요.","I shared gimbap with friends during the field trip.","郊游时和朋友们分享了紫菜包饭。","Tôi chia sẻ kimbap với bạn bè trong chuyến dã ngoại."),
    ("단체 행사를 이야기할 때","부서 소풍으로 계곡에 다녀왔어요.","We went to a valley for the department outing.","部门郊游去了山谷。","Chúng tôi đã đi dã ngoại bộ phận ở thung lũng."),
    ("물품 목록을 확인할 때","소풍 갈 때는 돗자리와 물을 꼭 챙겨야 해요.","When going on a picnic, you must pack a mat and water.","去郊游时一定要带垫子和水。","Khi đi dã ngoại nhất định phải mang theo thảm và nước."),
    ("계절과 연결할 때","가을에 단풍 구경을 겸해서 소풍을 가면 좋아요.","It is nice to go on a picnic in autumn to enjoy the autumn leaves.","秋天赏枫叶顺便去郊游很不错。","Đi dã ngoại vào mùa thu kết hợp ngắm lá vàng thật tuyệt."),
  ]),
]

# ===== LEVEL 4 part 1 =====
REPLACEMENTS += [
  ((4,6), "경제성장", "명사", ["경제발전","성장"], "economic growth", "经济增长", "tăng trưởng kinh tế", [
    ("GDP를 논의할 때","올해 경제성장률이 3%를 기록했어요.","This year's economic growth rate recorded 3%.","今年经济增长率达到了3%。","Tốc độ tăng trưởng kinh tế năm nay đạt 3%."),
    ("발전 전략을 이야기할 때","지속적인 경제성장을 위해 기술 혁신이 필요해요.","Technological innovation is needed for continuous economic growth.","持续经济增长需要技术创新。","Cần đổi mới công nghệ để tăng trưởng kinh tế bền vững."),
    ("정부 정책을 논의할 때","정부는 경제성장을 위한 다양한 정책을 발표했어요.","The government announced various policies for economic growth.","政府宣布了多项促进经济增长的政策。","Chính phủ công bố nhiều chính sách thúc đẩy tăng trưởng kinh tế."),
    ("고용과 연결할 때","경제성장이 이루어지면 일자리도 늘어나요.","When economic growth occurs, job opportunities also increase.","经济增长时，就业机会也会增加。","Khi tăng trưởng kinh tế xảy ra, cơ hội việc làm cũng tăng."),
    ("경제 보고서를 분석할 때","지난 10년간 이 나라의 경제성장은 눈부셨어요.","The economic growth of this country over the past 10 years has been remarkable.","过去10年，这个国家的经济增长令人瞩目。","Sự tăng trưởng kinh tế trong 10 năm qua thật đáng chú ý."),
    ("불평등 문제를 이야기할 때","경제성장이 모든 국민에게 혜택이 되어야 해요.","Economic growth should benefit all citizens.","经济增长应该惠及全体国民。","Tăng trưởng kinh tế cần mang lại lợi ích cho tất cả người dân."),
    ("국제 비교를 할 때","개발도상국의 경제성장 속도가 선진국보다 빨라요.","Developing countries grow faster than developed countries.","发展中国家的经济增长速度比发达国家更快。","Các nước đang phát triển tăng trưởng nhanh hơn các nước phát triển."),
    ("환경 문제와 연결할 때","무분별한 경제성장은 환경 파괴를 가져올 수 있어요.","Indiscriminate economic growth can lead to environmental destruction.","盲目的经济增长可能导致环境破坏。","Tăng trưởng kinh tế thiếu kiểm soát có thể phá hoại môi trường."),
    ("미래를 예측할 때","전문가들은 내년에도 경제성장이 이어질 것으로 예상해요.","Experts expect economic growth to continue next year.","专家们预计明年经济增长将持续。","Các chuyên gia dự đoán tăng trưởng kinh tế sẽ tiếp tục vào năm tới."),
    ("투자 환경을 이야기할 때","안정적인 경제성장은 외국인 투자를 끌어들여요.","Stable economic growth attracts foreign investment.","稳定的经济增长能吸引外国投资。","Tăng trưởng kinh tế ổn định thu hút đầu tư nước ngoài."),
  ]),
  ((4,12), "구조조정", "명사", ["감원","조직개편"], "corporate restructuring, downsizing", "企业重组，裁员", "tái cơ cấu doanh nghiệp", [
    ("기업 위기를 이야기할 때","회사가 적자를 면하기 위해 구조조정을 단행했어요.","The company carried out restructuring to avoid losses.","公司为避免亏损进行了结构调整。","Công ty tiến hành tái cơ cấu để tránh thua lỗ."),
    ("인력 감축을 설명할 때","구조조정으로 인해 직원 수가 크게 줄었어요.","Due to restructuring, the number of employees decreased significantly.","由于结构调整，员工人数大幅减少。","Do tái cơ cấu, số lượng nhân viên giảm đáng kể."),
    ("노사 갈등을 논의할 때","노동조합이 구조조정에 반대하여 파업을 선언했어요.","The labor union declared a strike in opposition to the restructuring.","工会反对结构调整，宣布罢工。","Công đoàn tuyên bố đình công để phản đối tái cơ cấu."),
    ("산업 변화를 분석할 때","디지털 전환으로 많은 산업에서 구조조정이 일어나고 있어요.","Restructuring is occurring in many industries due to digital transformation.","由于数字化转型，许多行业正在进行结构调整。","Tái cơ cấu đang xảy ra trong nhiều ngành do chuyển đổi số."),
    ("경영 전략을 이야기할 때","비핵심 사업을 정리하는 구조조정을 통해 수익성이 높아졌어요.","Profitability improved through restructuring that streamlined non-core businesses.","通过剥离非核心业务的结构调整，盈利能力提高了。","Khả năng sinh lời được cải thiện qua tái cơ cấu loại bỏ các mảng phi cốt lõi."),
    ("실업 문제를 논의할 때","대규모 구조조정으로 실업자가 급증했어요.","Mass restructuring led to a rapid increase in unemployment.","大规模结构调整导致失业人数急剧增加。","Tái cơ cấu quy mô lớn dẫn đến số người thất nghiệp tăng vọt."),
    ("정부 지원을 이야기할 때","정부는 구조조정 피해 근로자를 지원하는 정책을 마련했어요.","The government prepared policies to support workers affected by restructuring.","政府制定了支持受结构调整影响的工人的政策。","Chính phủ chuẩn bị chính sách hỗ trợ người lao động bị ảnh hưởng bởi tái cơ cấu."),
    ("기업 회생을 이야기할 때","성공적인 구조조정 덕분에 회사가 다시 흑자로 돌아섰어요.","Thanks to successful restructuring, the company returned to profitability.","得益于成功的结构调整，公司重新盈利。","Nhờ tái cơ cấu thành công, công ty đã trở lại có lãi."),
    ("변화 관리를 논의할 때","구조조정 과정에서 직원들의 심리적 지원이 중요해요.","Psychological support for employees is important during the restructuring process.","在结构调整过程中，对员工的心理支持很重要。","Hỗ trợ tâm lý cho nhân viên rất quan trọng trong quá trình tái cơ cấu."),
    ("미래 전망을 이야기할 때","구조조정을 통해 회사가 더 경쟁력 있는 조직이 될 것이에요.","Through restructuring, the company will become a more competitive organization.","通过结构调整，公司将成为更具竞争力的组织。","Qua tái cơ cấu, công ty sẽ trở thành tổ chức cạnh tranh hơn."),
  ]),
  ((4,14), "규제완화", "명사", ["규제축소","자율화"], "deregulation, regulatory relaxation", "放松管制，规制缓和", "nới lỏng quy định, bãi bỏ quy định", [
    ("경제 정책을 논의할 때","정부가 기업 활성화를 위해 규제완화 정책을 시행했어요.","The government implemented a deregulation policy to revitalize businesses.","政府实施了放松管制政策以激活企业。","Chính phủ thực hiện chính sách nới lỏng quy định để kích hoạt doanh nghiệp."),
    ("창업 환경을 이야기할 때","규제완화 덕분에 스타트업 창업이 더 쉬워졌어요.","Thanks to deregulation, starting up a startup has become easier.","由于放松管制，创办初创企业变得更容易了。","Nhờ nới lỏng quy định, việc khởi nghiệp startup trở nên dễ dàng hơn."),
    ("산업 발전을 논의할 때","금융 규제완화로 새로운 금융 서비스가 등장했어요.","New financial services emerged due to financial deregulation.","金融放松管制带来了新的金融服务。","Dịch vụ tài chính mới xuất hiện nhờ nới lỏng quy định tài chính."),
    ("찬반 논쟁을 할 때","규제완화가 경제 성장에 도움이 된다는 주장이 있어요.","There is an argument that deregulation helps economic growth.","有观点认为放松管制有助于经济增长。","Có lập luận rằng nới lỏng quy định giúp tăng trưởng kinh tế."),
    ("소비자 보호를 이야기할 때","과도한 규제완화는 소비자 보호를 약화시킬 수 있어요.","Excessive deregulation can weaken consumer protection.","过度放松管制可能削弱消费者保护。","Nới lỏng quy định quá mức có thể làm yếu đi bảo vệ người tiêu dùng."),
    ("환경 규제를 논의할 때","환경 규제완화는 기업엔 유리하지만 생태계에는 위협이 될 수 있어요.","Environmental deregulation is favorable for businesses but can threaten ecosystems.","环境放松管制对企业有利，但可能威胁生态系统。","Nới lỏng quy định môi trường có lợi cho doanh nghiệp nhưng có thể đe dọa hệ sinh thái."),
    ("노동시장을 이야기할 때","노동시장 규제완화로 비정규직이 늘어났어요.","Labor market deregulation led to an increase in irregular employment.","劳动市场放松管制导致非正规就业增加。","Nới lỏng quy định thị trường lao động dẫn đến tăng lao động phi chính thức."),
    ("국제 경쟁력을 논의할 때","규제완화로 해외 기업의 국내 진출이 용이해졌어요.","Deregulation made it easier for foreign companies to enter the domestic market.","放松管制使外国企业更容易进入国内市场。","Nới lỏng quy định giúp các công ty nước ngoài dễ dàng gia nhập thị trường trong nước hơn."),
    ("정치적 논쟁에서","규제완화 정책은 진보와 보수 간의 주요 쟁점이에요.","Deregulation policy is a major issue between progressives and conservatives.","放松管制政策是进步派和保守派之间的主要争议点。","Chính sách nới lỏng quy định là vấn đề lớn giữa phái tiến bộ và bảo thủ."),
    ("의료 분야를 이야기할 때","의료 규제완화로 민간 의료 서비스가 다양해졌어요.","Medical deregulation has diversified private healthcare services.","医疗放松管制使民营医疗服务多样化。","Nới lỏng quy định y tế đã đa dạng hóa dịch vụ chăm sóc sức khỏe tư nhân."),
  ]),
  ((4,32), "민주화", "명사", ["민주주의화","자유화"], "democratization", "民主化", "dân chủ hóa", [
    ("역사를 이야기할 때","1980년대 한국의 민주화 운동은 큰 의미가 있어요.","The democratization movement in Korea in the 1980s has great significance.","1980年代韩国的民主化运动具有重大意义。","Phong trào dân chủ hóa ở Hàn Quốc vào những năm 1980 có ý nghĩa lớn."),
    ("정치 체제를 논의할 때","민주화 이후 국민이 직접 대통령을 선출하게 됐어요.","After democratization, citizens were able to directly elect the president.","民主化后，国民可以直接选举总统了。","Sau dân chủ hóa, người dân có thể trực tiếp bầu tổng thống."),
    ("시민운동을 이야기할 때","민주화를 위해 많은 시민들이 거리로 나섰어요.","Many citizens took to the streets for democratization.","为了民主化，许多市民走上了街头。","Nhiều công dân xuống đường đấu tranh cho dân chủ hóa."),
    ("개발도상국을 논의할 때","민주화가 경제 발전을 이끄는지에 대한 논쟁이 있어요.","There is debate over whether democratization leads to economic development.","关于民主化是否能推动经济发展存在争议。","Có tranh luận về việc dân chủ hóa có dẫn đến phát triển kinh tế hay không."),
    ("언론 자유를 이야기할 때","민주화와 함께 언론의 자유도 크게 신장됐어요.","Freedom of the press also greatly expanded along with democratization.","随着民主化，新闻自由也大幅提升。","Tự do báo chí cũng được mở rộng đáng kể cùng với dân chủ hóa."),
    ("교육과 연결할 때","민주화 교육을 통해 시민의식이 높아지고 있어요.","Civic awareness is growing through democratization education.","通过民主化教育，公民意识不断提高。","Ý thức công dân đang tăng lên qua giáo dục về dân chủ hóa."),
    ("국제 사회를 논의할 때","국제 사회는 권위주의 국가의 민주화를 지지해요.","The international community supports the democratization of authoritarian states.","国际社会支持威权国家的民主化。","Cộng đồng quốc tế ủng hộ dân chủ hóa ở các quốc gia độc tài."),
    ("인권을 이야기할 때","민주화는 기본적인 인권 보장과 밀접하게 연결돼 있어요.","Democratization is closely linked to the guarantee of basic human rights.","民主化与保障基本人权密切相关。","Dân chủ hóa gắn chặt với việc bảo đảm quyền con người cơ bản."),
    ("사회 변화를 분석할 때","민주화 이후 시민 사회가 더욱 활성화됐어요.","Civil society became more active after democratization.","民主化后，公民社会更加活跃。","Xã hội dân sự trở nên sôi động hơn sau dân chủ hóa."),
    ("현재 과제를 논의할 때","형식적 민주화를 넘어 실질적 민주주의가 필요해요.","We need substantive democracy beyond formal democratization.","我们需要超越形式民主化的实质性民主。","Chúng ta cần nền dân chủ thực chất vượt ra ngoài dân chủ hóa hình thức."),
  ]),
  ((4,63), "빈부격차", "명사", ["소득불평등","양극화"], "wealth gap, income inequality", "贫富差距，收入不平等", "khoảng cách giàu nghèo, bất bình đẳng thu nhập", [
    ("사회 문제를 논의할 때","빈부격차 확대가 심각한 사회 문제가 되고 있어요.","The widening wealth gap is becoming a serious social problem.","贫富差距扩大正成为严重的社会问题。","Khoảng cách giàu nghèo ngày càng nới rộng đang trở thành vấn đề xã hội nghiêm trọng."),
    ("교육 기회를 이야기할 때","빈부격차로 인해 교육 기회의 불평등이 심해지고 있어요.","Educational inequality is worsening due to the wealth gap.","由于贫富差距，教育机会的不平等日益加剧。","Bất bình đẳng về cơ hội giáo dục đang trầm trọng hơn do khoảng cách giàu nghèo."),
    ("정책 대안을 이야기할 때","빈부격차를 줄이기 위한 재분배 정책이 필요해요.","Redistribution policies are needed to reduce the wealth gap.","需要再分配政策来缩小贫富差距。","Cần có chính sách phân phối lại để giảm khoảng cách giàu nghèo."),
    ("경제 통계를 분석할 때","지니계수로 한 나라의 빈부격차 수준을 측정할 수 있어요.","The Gini coefficient can measure the level of wealth gap in a country.","可以用基尼系数来衡量一个国家的贫富差距程度。","Hệ số Gini có thể đo mức độ khoảng cách giàu nghèo của một quốc gia."),
    ("세대 간 문제를 논의할 때","부모의 경제력이 자녀의 미래를 결정하는 빈부격차가 심화되고 있어요.","The wealth gap where parents' financial power determines their children's future is deepening.","父母的经济实力决定子女未来的贫富差距正在加剧。","Khoảng cách giàu nghèo mà năng lực kinh tế của cha mẹ quyết định tương lai con cái đang sâu sắc hơn."),
    ("도시와 농촌을 이야기할 때","도시와 농촌 간 빈부격차가 여전히 크게 나타나요.","The wealth gap between urban and rural areas is still significant.","城市与农村之间的贫富差距依然很大。","Khoảng cách giàu nghèo giữa thành thị và nông thôn vẫn còn lớn."),
    ("글로벌 문제를 논의할 때","전 세계적으로 빈부격차가 더욱 심각해지고 있어요.","The wealth gap is becoming more serious worldwide.","全球范围内的贫富差距正变得更加严重。","Khoảng cách giàu nghèo đang trở nên nghiêm trọng hơn trên toàn thế giới."),
    ("복지 제도를 이야기할 때","복지 제도 강화가 빈부격차 해소에 도움이 돼요.","Strengthening the welfare system helps address the wealth gap.","强化福利制度有助于解决贫富差距。","Tăng cường hệ thống phúc lợi giúp giải quyết khoảng cách giàu nghèo."),
    ("미래 세대를 이야기할 때","빈부격차가 고착되면 사회 이동성이 떨어져요.","When the wealth gap becomes entrenched, social mobility decreases.","贫富差距固化后，社会流动性会下降。","Khi khoảng cách giàu nghèo cố định, tính di động xã hội giảm sút."),
    ("경제 성장과 연결할 때","빈부격차 해소 없이는 지속적인 경제 성장이 어려워요.","Sustainable economic growth is difficult without resolving the wealth gap.","不解决贫富差距，可持续经济增长就很难实现。","Tăng trưởng kinh tế bền vững khó đạt được nếu không giải quyết khoảng cách giàu nghèo."),
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

# Save partial data
with open("D:/MakingApps/Apps/Hellowords/replacements_part1.json", "w", encoding="utf-8") as f:
    json.dump(ENTRIES, f, ensure_ascii=False, indent=2)

print(f"Part1 saved: {len(ENTRIES)} entries")
