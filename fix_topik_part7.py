import json

def E(sit,ko,en,cn,vn): return (sit,ko,en,cn,vn)

REPLACEMENTS = [
  # ===== LEVEL 6 =====
  ((6,29),"후기자본주의","명사",["후기 자본주의","늦은 자본주의"],"late capitalism, post-capitalism","后期资本主义","chủ nghĩa tư bản muộn, hậu tư bản",[
    E("경제 체제를 논의할 때","후기자본주의는 20세기 후반 이후의 자본주의 체제를 가리켜요.","Late capitalism refers to the capitalist system after the latter half of the 20th century.","后期자본주의指20世기后半以后的资本主义体制。","Chủ nghĩa tư bản muộn chỉ hệ thống tư bản chủ nghĩa sau nửa sau thế kỷ 20."),
    E("소비주의를 분석할 때","후기자본주의 사회에서 소비가 정체성을 형성해요.","In late capitalist society, consumption forms identity.","在后期자본주의社회中，消费形成认同。","Trong xã hội tư bản muộn, tiêu dùng hình thành bản sắc."),
    E("프레드릭 제임슨을 이야기할 때","프레드릭 제임슨이 후기자본주의 문화 논리를 분석했어요.","Fredric Jameson analyzed the cultural logic of late capitalism.","프레드릭제임슨分析了后期자본주의의文화논리。","Fredric Jameson đã phân tích logic văn hóa của chủ nghĩa tư bản muộn."),
    E("금융화를 이야기할 때","후기자본주의의 특징 중 하나는 금융 자본의 지배예요.","One of the characteristics of late capitalism is the dominance of financial capital.","后期자본주의의特征之一是금융자본의支배。","Một trong những đặc điểm của chủ nghĩa tư bản muộn là sự thống trị của vốn tài chính."),
    E("문화를 이야기할 때","후기자본주의 문화는 포스트모더니즘과 긴밀히 연결돼요.","Late capitalist culture is closely connected to postmodernism.","后期자본주의文化与포스트모더니즘紧密相连。","Văn hóa tư bản muộn gắn chặt với chủ nghĩa hậu hiện đại."),
    E("비판을 이야기할 때","마르크스주의자들은 후기자본주의의 모순을 비판해요.","Marxists criticize the contradictions of late capitalism.","马克思主义者批评后期자본주의의矛盾。","Những người theo chủ nghĩa Mác phê phán những mâu thuẫn của chủ ngh의tư bản muộn."),
    E("노동을 이야기할 때","후기자본주의에서 비물질 노동의 비중이 커졌어요.","The proportion of immaterial labor has increased in late capitalism.","在后期자본주의中，非물질노동의비중增大了。","Tỷ trọng lao동 phi vật chất đã tăng lên trong chủ nghĩa tư bản muộn."),
    E("세계화를 이야기할 때","후기자본주의는 경제의 세계화를 심화시켰어요.","Late capitalism has deepened the globalization of the economy.","后期자본주의加深了经济全球화。","Chủ nghĩa tư bản muộn đã làm sâu sắc hơn toàn cầu hóa kinh tế."),
    E("대안을 이야기할 때","후기자본주의의 대안으로 다양한 경제 모델이 제안되고 있어요.","Various economic models are being proposed as alternatives to late capitalism.","作为后期자본주의의대안，多种经济模型正被提议。","Nhiều mô hình kinh tế đang được đề xuất như là những giải pháp thay thế cho chủ nghĩa tư bản muộn."),
    E("위기를 이야기할 때","후기자본주의의 주기적 경제 위기가 불평등을 심화시켜요.","The periodic economic crises of late capitalism deepen inequality.","后期자본주의的周期性经제위기加剧了不平等。","Các cuộc khủng hoảng kinh tế định kỳ của chủ nghĩa tư bản muộn làm sâu sắc hơn sự bất bình đẳng."),
  ]),
  ((6,30),"해체주의","명사",["데리다 이론","탈구축주의"],"deconstruction, deconstructionism","解构主义","chủ nghĩa giải cấu trúc, giải kiến tạo",[
    E("데리다를 이야기할 때","해체주의는 자크 데리다가 발전시킨 철학적 방법론이에요.","Deconstruction is a philosophical methodology developed by Jacques Derrida.","해체주의는雅克·德里达发展의哲学방법론。","Chủ nghĩa giải cấu trúc là phương pháp luận triết học được Jacques Derrida phát triển."),
    E("텍스트를 이야기할 때","해체주의는 텍스트 내의 모순과 불안정성을 드러내요.","Deconstruction reveals the contradictions and instability within texts.","해체주의揭示了文本内의矛盾와不안정성。","Chủ nghĩa giải cấu trúc bộc lộ những mâu thuẫn và bất ổn trong văn bản."),
    E("이분법을 이야기할 때","해체주의는 서양 철학의 이분법적 사고를 해체해요.","Deconstruction dismantles the binary thinking of Western philosophy.","해체주의解构了西洋哲학의二分法的사고。","Chủ nghĩa giải cấu trúc tháo rời tư duy nhị phân của triết học phương Tây."),
    E("의미를 이야기할 때","해체주의에 따르면 텍스트의 의미는 고정되지 않아요.","According to deconstruction, the meaning of a text is not fixed.","根据해체주의，文本의意味不是固定的。","Theo chủ nghĩa giải cấu trúc, ý nghĩa của văn bản không cố định."),
    E("문학비평에 적용할 때","해체주의 문학비평은 작품의 이면을 탐구해요.","Deconstructionist literary criticism explores the hidden aspects of works.","해체주의文학비평探究作品의裏面。","Phê bình văn học giải cấu trúc khám phá những khía cạnh ẩn của tác phẩm."),
    E("법학에 적용할 때","법학에서도 해체주의 방법론이 법률 텍스트 분석에 쓰여요.","Deconstructionist methodology is also used in legal text analysis in law.","在法学中，해체주의방법론Also被用于法律文본분析。","Phương pháp luận giải cấu trúc cũng được sử dụng trong phân tích văn bản pháp lý trong luật học."),
    E("비판을 이야기할 때","해체주의가 허무주의로 흐른다는 비판도 있어요.","There is also criticism that deconstruction leads to nihilism.","也有批评认为해체주의走向虚无主义。","Cũng có phê bình rằng chủ nghĩa giải cấu trúc dẫn đến chủ nghĩa hư vô."),
    E("교육을 이야기할 때","해체주의는 대학에서 비판적 사고 교육에 활용돼요.","Deconstruction is used in critical thinking education at universities.","해체주의在大学批判的사고교육中被活用。","Chủ nghĩa giải cấu trúc được sử dụng trong giáo dục tư duy phê phán ở các trường đại học."),
    E("영향을 이야기할 때","해체주의는 문학, 건축, 예술 등 다양한 분야에 영향을 미쳤어요.","Deconstruction has influenced various fields including literature, architecture, and art.","해체주의影响了文学、建筑、艺术等多种领域。","Chủ nghĩa giải cấu trúc đã ảnh hưởng đến nhiều lĩnh vực bao gồm văn học, kiến trúc và nghệ thuật."),
    E("유산을 이야기할 때","해체주의는 포스트구조주의 사상의 핵심 이론으로 남아있어요.","Deconstruction remains a core theory of post-structuralist thought.","해체주의仍是后구조주의思想의核心理论。","Chủ nghĩa giải cấu trúc vẫn là lý thuyết cốt lõi của tư tưởng hậu cấu trúc."),
  ]),
  ((6,32),"비판이론","명사",["프랑크푸르트학파","비판 이론"],"critical theory","批判理论","lý thuyết phê phán",[
    E("프랑크푸르트를 이야기할 때","비판이론은 프랑크푸르트 학파가 발전시킨 사회 이론이에요.","Critical theory is a social theory developed by the Frankfurt School.","비판이론是프랑크푸르트학파发展의社会理论。","Lý thuyết phê phán là lý thuyết xã hội được trường phái Frankfurt phát triển."),
    E("사회 분석을 이야기할 때","비판이론은 현대 사회의 권력 구조와 이데올로기를 분석해요.","Critical theory analyzes the power structures and ideologies of modern society.","비판이론分析现代社회의권력구조与意识形态。","Lý thuyết phê phán phân tích các cấu trúc quyền lực và hệ tư tưởng của xã hội hiện đại."),
    E("해방을 이야기할 때","비판이론은 억압으로부터의 해방을 지향해요.","Critical theory aims for liberation from oppression.","비판이론指向从压迫中解放。","Lý thuyết phê phán hướng tới sự giải phóng khỏi áp bức."),
    E("마르쿠제를 이야기할 때","헤르베르트 마르쿠제의 비판이론이 1960년대 학생 운동에 영향을 줬어요.","Herbert Marcuse's critical theory influenced the student movements of the 1960s.","赫伯特·马尔库塞의비판이론影响了1960年代학생운동。","Lý thuyết phê phán của Herbert Marcuse đã ảnh hưởng đến các phong trào sinh viên những năm 1960."),
    E("하버마스를 이야기할 때","하버마스는 비판이론을 의사소통 합리성 개념으로 발전시켰어요.","Habermas developed critical theory with the concept of communicative rationality.","哈贝马스将비판이론发展为소통합리성개념。","Habermas đã phát triển lý thuyết phê phán với khái niệm lý tính giao tiếp."),
    E("문화를 이야기할 때","비판이론은 문화 산업이 대중을 어떻게 통제하는지 분석해요.","Critical theory analyzes how the culture industry controls the masses.","비판이론分析了文化产业如何控制大众。","Lý thuyết phê phán phân tích cách ngành công nghiệp văn hóa kiểm soát quần chúng."),
    E("교육을 이야기할 때","비판이론은 교육의 이데올로기적 역할을 밝혀요.","Critical theory reveals the ideological role of education.","비판이론揭示了教育的意识形态性作用。","Lý thuyết phê phán bộc lộ vai trò hệ tư tưởng của giáo dục."),
    E("페미니즘과 연결할 때","비판이론은 페미니즘과 결합하여 젠더 불평등을 분석해요.","Critical theory combines with feminism to analyze gender inequality.","비판이론与女权主义결합분析性别不平等。","Lý thuyết phê phán kết hợp với chủ nghĩa nữ quyền để phân tích bất bình đẳng giới."),
    E("응용을 이야기할 때","비판이론은 법학, 사회학, 문학 등 다양한 분야에 응용돼요.","Critical theory is applied to various fields including law, sociology, and literature.","비판이론应用于法학、社会学、文学等다양한领域。","Lý thuyết phê phán được áp dụng trong nhiều lĩnh vực bao gồm luật học, xã hội học và văn học."),
    E("한계를 이야기할 때","비판이론이 구체적 실천 방안을 제시하지 못한다는 비판도 있어요.","There is also criticism that critical theory fails to present specific practical measures.","也有批评认为비판이론未能提出具体실천방안。","Cũng có phê bình rằng lý thuyết phê phán không đưa ra được các biện pháp thực tiễn cụ thể."),
  ]),
  ((6,83),"신식민주의","명사",["신제국주의","新식민주의"],"neocolonialism","新殖民主义","chủ nghĩa thực dân mới",[
    E("국제 관계를 이야기할 때","신식민주의는 공식적 식민 지배 없이 경제적 지배가 이루어지는 현상이에요.","Neocolonialism is the phenomenon of economic domination occurring without formal colonial rule.","신식민주의是在没有正式殖民统治的情况下实现경제지배的현상。","Chủ nghĩa thực dân mới là hiện tượng thống trị kinh tế xảy ra mà không có cai trị thực dân chính thức."),
    E("콰메 은크루마를 이야기할 때","가나의 지도자 은크루마가 신식민주의 개념을 체계화했어요.","Ghana's leader Nkrumah systematized the concept of neocolonialism.","加纳领导人恩克鲁玛체계화了신식민주의概念。","Nhà lãnh đạo Ghana Nkrumah đã hệ thống hóa khái niệm chủ nghĩa thực dân mới."),
    E("경제를 이야기할 때","신식민주의는 무역 불평등과 부채를 통해 작동해요.","Neocolonialism operates through trade inequality and debt.","신식민주의通过贸易不平等和债务运作。","Chủ nghĩa thực dân mới hoạt động thông qua bất bình đẳng thương mại và nợ nần."),
    E("아프리카를 이야기할 때","많은 아프리카 학자들이 신식민주의 구조를 비판해요.","Many African scholars criticize neocolonialist structures.","많은아프리카학자들批评신식민주의구조。","Nhiều học giả châu Phi phê phán các cấu trúc thực dân mới."),
    E("IMF와 세계은행을 이야기할 때","일부 학자들은 IMF 정책을 신식민주의적이라고 비판해요.","Some scholars criticize IMF policies as neocolonialist.","일부학자들批评IMF政策为신식민주의적。","Một số học giả phê phán các chính sách của IMF là chủ nghĩa thực dân mới."),
    E("문화를 이야기할 때","문화적 신식민주의는 서구 문화의 전 세계적 확산을 분석해요.","Cultural neocolonialism analyzes the global spread of Western culture.","文화적신식민주의分析了西方문화의全球확산。","Chủ nghĩa thực dân mới văn hóa phân tích sự lan rộng toàn cầu của văn hóa phương Tây."),
    E("자원을 이야기할 때","신식민주의는 개발도상국의 천연자원 착취로 나타나요.","Neocolonialism manifests in the exploitation of natural resources in developing countries.","신식민주의表현为开发中国家天然자원의착취。","Chủ nghĩa thực dân mới biểu hiện trong việc khai thác tài nguyên thiên nhiên ở các nước đang phát triển."),
    E("저항을 이야기할 때","탈식민지 운동이 신식민주의에 저항해요.","Post-colonial movements resist neocolonialism.","후식민지运动반항신식민주의。","Các phong trào hậu thuộc địa kháng cự chủ nghĩa thực dân mới."),
    E("현재를 이야기할 때","신식민주의적 관계가 현재도 국제 경제에 존재해요.","Neocolonialist relationships still exist in the international economy today.","신식민주의的관계至今也存在于国际经济中。","Các mối quan hệ thực dân mới vẫn tồn tại trong kinh tế quốc tế ngày nay."),
    E("대안을 이야기할 때","신식민주의 극복을 위한 남남 협력이 확대되고 있어요.","South-South cooperation to overcome neocolonialism is expanding.","克服신식민주의的南南协作正在扩大。","Hợp tác Nam-Nam để khắc phục chủ nghĩa thực dân mới đang được mở rộng."),
  ]),
  ((6,114),"언어행위론","명사",["화행이론","speech act theory"],"speech act theory","言语行为论","lý thuyết hành vi ngôn ngữ",[
    E("오스틴을 이야기할 때","언어행위론은 오스틴이 발전시킨 언어 철학 이론이에요.","Speech act theory is a philosophy of language theory developed by Austin.","언어행위론是奥斯汀发展의语言哲학理论。","Lý thuyết hành vi ngôn ngữ là lý thuyết triết học ngôn ngữ được Austin phát triển."),
    E("발화를 이야기할 때","발화는 단순한 정보 전달 이상의 행위를 수행해요.","An utterance performs more than simple information transmission.","발화发挥单纯信息传달以上的行为。","Phát ngôn thực hiện nhiều hơn là truyền đạt thông tin đơn giản."),
    E("수행적 발화를 이야기할 때","약속, 명령, 선언 같은 수행적 발화는 현실을 변화시켜요.","Performative utterances like promises, commands, and declarations change reality.","약속、命令、선언等수행적발화改变현실。","Các phát ngôn thực hiện như lời hứa, mệnh lệnh, tuyên bố thay đổi thực tại."),
    E("서얼을 이야기할 때","존 서얼이 언어행위론을 더욱 발전시켰어요.","John Searle further developed speech act theory.","约翰·塞尔进一步发展了언어행위론。","John Searle đã phát triển hơn nữa lý thuyết hành vi ngôn ngữ."),
    E("화행 분류를 이야기할 때","언어행위론은 발화를 언표, 발화수반, 발화효과 행위로 분류해요.","Speech act theory classifies utterances into locutionary, illocutionary, and perlocutionary acts.","언어행위론将발화分为언표、发话수반、발화효과행위。","Lý thuyết hành vi ngôn ngữ phân loại phát ngôn thành hành vi ngôn bản, hành vi tại lời và hành vi mượn lời."),
    E("화용론과 연결할 때","언어행위론은 화용론의 핵심 이론 중 하나예요.","Speech act theory is one of the core theories of pragmatics.","언어행위론是语用학의核心理论之一。","Lý thuyết hành vi ngôn ngữ là một trong những lý thuyết cốt lõi của ngữ dụng học."),
    E("법률을 이야기할 때","법률 문서에서 언어행위론은 법적 효력을 가진 발화를 분석해요.","In legal documents, speech act theory analyzes utterances with legal force.","在法律文书中，언어행위론分析具有法律效力의발화。","Trong các văn bản pháp lý, lý thuyết hành vi ngôn ngữ phân tích các phát ngôn có hiệu lực pháp lý."),
    E("의사소통을 이야기할 때","언어행위론이 일상의 의사소통 분석에 활용돼요.","Speech act theory is used in everyday communication analysis.","언어행위론被用于日常意思소통分析。","Lý thuyết hành vi ngôn ngữ được sử dụng trong phân tích giao tiếp hàng ngày."),
    E("AI를 이야기할 때","언어행위론이 자연어 처리 AI 개발에 이론적 기반을 제공해요.","Speech act theory provides a theoretical basis for natural language processing AI development.","언어행위론为自然语언처리AI개발提供理论基础。","Lý thuyết hành vi ngôn ngữ cung cấp nền tảng lý thuyết cho phát triển AI xử lý ngôn ngữ tự nhiên."),
    E("교육을 이야기할 때","외국어 교육에서 언어행위론이 의사소통 능력 향상에 활용돼요.","Speech act theory is used to improve communicative competence in foreign language education.","在外语教育中，언어행위론被用于提升소통능력。","Lý thuyết hành vi ngôn ngữ được sử dụng để cải thiện năng lực giao tiếp trong giáo dục ngoại ngữ."),
  ]),
  ((6,170),"현상학","명사",["phenomenology","후설 철학"],"phenomenology","现象学","hiện tượng học",[
    E("후설을 이야기할 때","현상학은 에드문트 후설이 창시한 철학 방법론이에요.","Phenomenology is a philosophical methodology founded by Edmund Husserl.","현상학是埃德蒙德·胡塞尔创立的哲학방법론。","Hiện tượng học là phương pháp luận triết học do Edmund Husserl sáng lập."),
    E("의식을 이야기할 때","현상학은 의식의 구조와 경험을 직접적으로 탐구해요.","Phenomenology directly explores the structure of consciousness and experience.","현상학直접탐구意识의구조与경험。","Hiện tượng học trực tiếp khám phá cấu trúc của ý thức và trải nghiệm."),
    E("환원을 이야기할 때","현상학적 환원은 선입견을 제거하고 순수한 경험으로 돌아가요.","Phenomenological reduction removes preconceptions and returns to pure experience.","현상학적환원去除成见，回到순수한경험。","Rút gọn hiện tượng học loại bỏ định kiến và trở về kinh nghiệm thuần túy."),
    E("하이데거를 이야기할 때","하이데거가 현상학을 존재론으로 발전시켰어요.","Heidegger developed phenomenology into ontology.","海德格尔将현상학发展为존재론。","Heidegger đã phát triển hiện tượng học thành bản thể luận."),
    E("메를로퐁티를 이야기할 때","메를로퐁티의 현상학은 몸의 경험을 중심에 놓아요.","Merleau-Ponty's phenomenology places bodily experience at the center.","梅洛-庞蒂의현상학将身체경험置于中심。","Hiện tượng học của Merleau-Ponty đặt trải nghiệm thân thể vào trung tâm."),
    E("사회과학에 적용할 때","현상학은 사회과학 연구 방법론에 영향을 미쳤어요.","Phenomenology has influenced research methodologies in social sciences.","현상학影响了社会科학研究방법론。","Hiện tượng học đã ảnh hưởng đến các phương pháp luận nghiên cứu trong khoa học xã hội."),
    E("의미를 이야기할 때","현상학은 일상적 경험 속에서 의미를 찾아요.","Phenomenology seeks meaning within everyday experience.","현상학在日常경험中寻找意味。","Hiện tượng học tìm kiếm ý nghĩa trong trải nghiệm hàng ngày."),
    E("의학을 이야기할 때","현상학적 접근이 의학에서 환자 경험을 이해하는 데 쓰여요.","Phenomenological approaches are used in medicine to understand patient experiences.","현상학적접근In医학에서被用于理解환자경험。","Các tiếp cận hiện tượng học được sử dụng trong y học để hiểu trải nghiệm của bệnh nhân."),
    E("교육을 이야기할 때","현상학은 교육 연구에서 학습 경험을 탐구하는 데 활용돼요.","Phenomenology is used to explore learning experiences in educational research.","현상학在교육연구中被用于탐구학습경험。","Hiện tượng học được sử dụng để khám phá trải nghiệm học tập trong nghiên cứu giáo dục."),
    E("한계를 이야기할 때","현상학의 주관성이 과학적 객관성과 충돌할 수 있어요.","The subjectivity of phenomenology can conflict with scientific objectivity.","현상학의주관성可以与科학적客관성충돌。","Tính chủ quan của hiện tượng học có thể xung đột với tính khách quan khoa học."),
  ]),
  ((6,194),"기호학","명사",["기호론","semiotics"],"semiotics, semiology","符号学","ký hiệu học",[
    E("소쉬르를 이야기할 때","기호학은 소쉬르와 퍼스가 발전시킨 기호 연구 학문이에요.","Semiotics is the study of signs developed by Saussure and Peirce.","기호학是索绪尔和皮尔斯发展의기호연구학문。","Ký hiệu học là khoa học nghiên cứu dấu hiệu được Saussure và Peirce phát triển."),
    E("기호를 이야기할 때","기호학은 기표와 기의의 관계를 분석해요.","Semiotics analyzes the relationship between the signifier and the signified.","기호학分析기표与기의의관계。","Ký hiệu học phân tích mối quan hệ giữa biểu đạt và được biểu đạt."),
    E("문화를 이야기할 때","롤랑 바르트가 기호학으로 대중문화를 분석했어요.","Roland Barthes analyzed popular culture with semiotics.","罗兰·巴特用기호학分析了大众文화。","Roland Barthes đã phân tích văn hóa đại chúng bằng ký hiệu học."),
    E("언어를 이야기할 때","언어는 기호학의 핵심 연구 대상이에요.","Language is the core subject of study in semiotics.","语言是기호학의核心研究对象。","Ngôn ngữ là đối tượng nghiên cứu cốt lõi của ký hiệu학."),
    E("광고를 이야기할 때","기호학이 광고 이미지와 메시지 분석에 활용돼요.","Semiotics is used in analyzing advertising images and messages.","기호학被用于广告图像和消息분析。","Ký hiệu học được sử dụng trong phân tích hình ảnh và thông điệp quảng cáo."),
    E("영화를 이야기할 때","영화 기호학은 영화적 언어를 체계적으로 분석해요.","Film semiotics systematically analyzes cinematic language.","电影기호학系统分析电影语言。","Ký hiệu học điện ảnh phân tích có hệ thống ngôn ngữ điện ảnh."),
    E("의미를 이야기할 때","기호학은 어떻게 의미가 생성되는지 탐구해요.","Semiotics explores how meaning is produced.","기호학탐구意义如何产生。","Ký hiệu học khám phá cách ý nghĩa được tạo ra."),
    E("인지를 이야기할 때","인지 기호학은 의미 처리 과정을 연구해요.","Cognitive semiotics studies the meaning processing process.","认知기호학研究意義处理过程。","Ký hiệu học nhận thức nghiên cứu quá trình xử lý ý nghĩa."),
    E("건축을 이야기할 때","건축 기호학은 건물이 전달하는 의미를 분석해요.","Architectural semiotics analyzes the meanings conveyed by buildings.","建筑기호학분析建筑传达의意味。","Ký hiệu học kiến trúc phân tích ý nghĩa mà các tòa nhà truyền đạt."),
    E("현대를 이야기할 때","디지털 시대에 기호학은 새로운 미디어 분석 도구가 됐어요.","Semiotics has become a new media analysis tool in the digital age.","在数字时代，기호학成为了새로운미디어분석工具。","Ký hiệu học đã trở thành công cụ phân tích truyền thông mới trong kỷ nguyên số."),
  ]),
  ((6,195),"모더니즘","명사",["근대주의","현대주의"],"modernism","现代主义，现代派","chủ nghĩa hiện đại",[
    E("예술을 이야기할 때","모더니즘은 20세기 초 전통을 거부하고 새로운 형식을 추구한 예술 운동이에요.","Modernism is an artistic movement of the early 20th century that rejected tradition and pursued new forms.","모더니즘是20세기初拒绝传统、追求新形式的艺术运동。","Chủ nghĩa hiện đại là phong trào nghệ thuật đầu thế kỷ 20 từ chối truyền thống và theo đuổi hình thức mới."),
    E("문학을 이야기할 때","제임스 조이스와 버지니아 울프가 모더니즘 문학을 대표해요.","James Joyce and Virginia Woolf represent modernist literature.","James Joyce와Virginia Woolf代表모더니즘文学。","James Joyce và Virginia Woolf đại diện cho văn học hiện đại."),
    E("건축을 이야기할 때","모더니즘 건축은 장식을 배제하고 기능성을 강조해요.","Modernist architecture excludes decoration and emphasizes functionality.","모더니즘建筑排除装饰，강조功能性。","Kiến trúc hiện đại loại bỏ trang trí và nhấn mạnh tính chức năng."),
    E("철학을 이야기할 때","철학적 모더니즘은 이성과 진보에 대한 믿음을 특징으로 해요.","Philosophical modernism is characterized by a belief in reason and progress.","哲学의모더니즘以对理性和진보的믿음为特征。","Chủ nghĩa hiện đại triết học được đặc trưng bởi niềm tin vào lý tính và tiến bộ."),
    E("미술을 이야기할 때","입체파와 추상화가 모더니즘 미술의 핵심 흐름이에요.","Cubism and abstraction are the core trends of modernist art.","立体主义和抽象化是모더니즘美术의核心흐름。","Chủ nghĩa lập thể và trừu tượng là những xu hướng cốt lõi của nghệ thuật hiện đại."),
    E("포스트모더니즘과 비교할 때","포스트모더니즘은 모더니즘의 대진보 서사를 해체해요.","Postmodernism deconstructs the grand narratives of modernism.","포스트모더니즘解构了모더니즘의大진보서사。","Chủ nghĩa hậu hiện đại giải cấu trúc các đại tự sự của chủ nghĩa hiện đại."),
    E("음악을 이야기할 때","쇤베르크의 무조 음악이 모더니즘 음악을 대표해요.","Schoenberg's atonal music represents modernist music.","勋伯格의무조음악代表모더니즘음악。","Nhạc vô điệu của Schoenberg đại diện cho âm nhạc hiện đại."),
    E("사회를 이야기할 때","모더니즘은 산업화와 도시화를 배경으로 발생했어요.","Modernism arose against the backdrop of industrialization and urbanization.","모더니즘以工业화와都市화为背景而发生。","Chủ nghĩa hiện đại xuất hiện trên nền tảng công nghiệp hóa và đô thị hóa."),
    E("영향을 이야기할 때","모더니즘은 현대 예술과 문화 전반에 지속적인 영향을 미쳤어요.","Modernism has had a lasting impact on modern art and culture as a whole.","모더니즘对현대艺术와文化全체产生了持续影响。","Chủ nghĩa hiện đại đã có tác động lâu dài đến nghệ thuật và văn hóa hiện đại nói chung."),
    E("한계를 이야기할 때","모더니즘의 엘리트주의가 비판의 대상이 됐어요.","The elitism of modernism became the subject of criticism.","모더니즘의엘리트주의成为批判의对象。","Chủ nghĩa tinh hoa của chủ nghĩa hiện đại đã trở thành đối tượng bị phê phán."),
  ]),
  ((6,197),"생태철학","명사",["생태학적 철학","환경철학"],"ecological philosophy, eco-philosophy","生态哲学","triết học sinh thái",[
    E("자연을 이야기할 때","생태철학은 자연과 인간의 관계를 철학적으로 탐구해요.","Ecological philosophy philosophically explores the relationship between nature and humans.","생태철학哲학적으로탐구自然与人간의관계。","Triết học sinh thái khám phá triết học về mối quan계 giữa tự nhiên và con người."),
    E("환경 위기를 이야기할 때","생태철학이 현대 환경 위기에 대한 철학적 해답을 찾아요.","Ecological philosophy seeks philosophical answers to the modern environmental crisis.","생태철학寻找对现代환경위기的哲学解答。","Triết học sinh thái tìm kiếm câu trả lời triết học cho cuộc khủng hoảng môi trường hiện đại."),
    E("심층생태학을 이야기할 때","아르네 내스가 심층생태학으로서의 생태철학을 발전시켰어요.","Arne Næss developed ecological philosophy as deep ecology.","阿恩·内斯将생태철학作为深层生态学发展。","Arne Næss đã phát triển triết học sinh thái như là sinh thái học sâu."),
    E("인간중심을 비판할 때","생태철학은 인간 중심주의를 비판하고 자연의 내재적 가치를 주장해요.","Ecological philosophy criticizes anthropocentrism and argues for the intrinsic value of nature.","생태철학批判人类중심주의，主장自然의内在적가치。","Triết học sinh thái phê phán chủ nghĩa nhân loại trung tâm và lập luận về giá trị nội tại của tự然."),
    E("윤리를 이야기할 때","생태철학은 비인간 존재들도 도덕적 고려 대상이 됨을 주장해요.","Ecological philosophy argues that non-human beings also deserve moral consideration.","생태철학주장非人间존재들也成为道德고려对象。","Triết học sinh thái lập luận rằng các sinh vật phi con người cũng xứng đáng được xem xét về đạo đức."),
    E("지속가능성과 연결할 때","생태철학은 지속가능한 발전의 철학적 기반을 제공해요.","Ecological philosophy provides the philosophical foundation for sustainable development.","생태철학为可持续발전提供哲학기반。","Triết học sinh thái cung cấp nền tảng triết học cho phát triển bền vững."),
    E("교육을 이야기할 때","생태철학에 기반한 환경 교육이 확산되고 있어요.","Environmental education based on ecological philosophy is spreading.","基于생태철학의환경교육正在扩展。","Giáo dục môi trường dựa trên triết học sinh thái đang lan rộng."),
    E("정치를 이야기할 때","녹색 정치는 생태철학에서 사상적 뿌리를 찾아요.","Green politics finds its ideological roots in ecological philosophy.","绿色政치在생태철학中寻找思想根源。","Chính trị xanh tìm thấy gốc rễ tư tưởng trong triết học sinh thái."),
    E("실천을 이야기할 때","생태철학은 환경 운동의 이론적 토대가 돼요.","Ecological philosophy becomes the theoretical foundation of environmental movements.","생태철학成为환경운동의理论토대。","Triết học sinh thái trở thành nền tảng lý thuyết của các phong trào môi trường."),
    E("현재를 이야기할 때","기후 변화 시대에 생태철학의 의미가 더욱 중요해지고 있어요.","The significance of ecological philosophy is becoming increasingly important in the era of climate change.","在气候変化时代，생태철학의의미변해가고있다。","Ý nghĩa của triết học sinh thái ngày càng trở nên quan trọng hơn trong thời đại biến đổi khí hậu."),
  ]),
  ((6,198),"양명학","명사",["왕양명 철학","심학"],"Wang Yangming philosophy, School of Mind","阳明学","học thuyết Vương Dương Minh",[
    E("왕양명을 이야기할 때","양명학은 명나라 왕양명이 창시한 유교 철학 학파예요.","Wang Yangming philosophy is a Confucian philosophical school founded by Wang Yangming of the Ming Dynasty.","양명학是明朝王阳明创立的儒교哲학학파。","Học thuyết Vương Dương Minh là trường phái triết học Nho giáo do Vương Dương Minh của triều Minh sáng lập."),
    E("지행합일을 이야기할 때","양명학의 핵심 사상은 지식과 행동이 하나라는 지행합일이에요.","The core thought of Wang Yangming philosophy is the unity of knowledge and action.","양명학의核心思想是知识와行동이하나라는지행합일。","Tư tưởng cốt lõi của học thuyết Vương Dương Minh là sự thống nhất của tri thức và hành động."),
    E("양지를 이야기할 때","양명학은 인간 마음 속에 이미 양지(良知)가 있다고 봐요.","Wang Yangming philosophy holds that liangzhi (innate knowledge of good) already exists in the human mind.","양명학认为人心中已有양지(良知)。","Học thuyết Vương Dương Minh cho rằng lương tri đã tồn tại sẵn trong tâm con người."),
    E("주자학과 비교할 때","양명학은 주자학의 격물치지 방법론을 비판했어요.","Wang Yangming philosophy criticized the gewu zhizhi methodology of Zhu Xi philosophy.","양명학批判了朱子学의格物致知방법론。","Học thuyết Vương Dương Minh đã phê phán phương pháp luận cách vật trí tri của học thuyết Chu Hi."),
    E("조선을 이야기할 때","양명학이 조선 후기 일부 사상가들에게 영향을 미쳤어요.","Wang Yangming philosophy influenced some thinkers in the late Joseon period.","양명학影响了조선후기一些思想家。","Học thuyết Vương Dương Minh đã ảnh hưởng đến một số nhà tư tưởng thời Joseon muộn."),
    E("일본을 이야기할 때","일본 근대화에 양명학의 영향이 컸다는 분석이 있어요.","There is analysis that Wang Yangming philosophy had a great influence on Japan's modernization.","有분析认为양명학对日本现대화影响很大。","Có phân tích rằng học thuyết Vương Dương Minh có ảnh hưởng lớn đến hiện đại hóa Nhật Bản."),
    E("마음을 이야기할 때","양명학에서 마음이 곧 이치라는 심즉리 사상이 핵심이에요.","The thought that mind is reason (xin ji li) is the core of Wang Yangming philosophy.","양명학的核심은心即理사상。","Tư tưởng tâm tức lý là cốt lõi của học thuyết Vương Dương Minh."),
    E("실천을 이야기할 때","양명학은 도덕적 지식의 실천을 강조해요.","Wang Yangming philosophy emphasizes the practice of moral knowledge.","양명학强调道德知识의실践。","Học thuyết Vương Dương Minh nhấn mạnh thực hành tri thức đạo đức."),
    E("현대를 이야기할 때","현대 신유학에서 양명학의 재해석이 이루어지고 있어요.","Reinterpretation of Wang Yangming philosophy is occurring in modern neo-Confucianism.","현대新儒学中对양명학의재해석正在进行。","Tái diễn giải học thuyết Vương Dương Minh đang diễn ra trong Tân Nho học hiện đại."),
    E("비교를 이야기할 때","양명학과 서양 철학의 비교 연구가 활발히 이루어지고 있어요.","Comparative research between Wang Yangming philosophy and Western philosophy is actively being conducted.","양명학与西方哲学의비교研究活跃진행中。","Nghiên cứu so sánh giữa học thuyết Vương Dương Minh và triết học phương Tây đang được tiến hành tích cực."),
  ]),
  ((6,209),"사회철학","명사",["사회 철학","사회 이론"],"social philosophy","社会哲学","triết học xã hội",[
    E("학문을 정의할 때","사회철학은 사회의 구조, 제도, 가치를 철학적으로 탐구해요.","Social philosophy philosophically explores the structure, institutions, and values of society.","사회철학哲학적으로탐구社회의구조、制度、价值。","Triết học xã hội khám phá triết học về cấu trúc, thể chế và giá trị của xã hội."),
    E("정의를 이야기할 때","존 롤스의 정의론이 현대 사회철학의 핵심 작품이에요.","John Rawls' Theory of Justice is a core work of modern social philosophy.","约翰·罗尔斯의정의론是현대사회철학의核心작품。","Lý thuyết về công bằng của John Rawls là tác phẩm cốt lõi của triết học xã hội hiện đại."),
    E("자유를 이야기할 때","사회철학은 개인의 자유와 공동체의 조화를 탐구해요.","Social philosophy explores the harmony between individual freedom and community.","사회철학탐구개인의자유与공동체의조화。","Triết học xã hội khám phá sự hài hòa giữa tự do cá nhân và cộng đồng."),
    E("마르크스를 이야기할 때","마르크스의 사회철학은 계급 갈등과 변혁을 중심으로 해요.","Marx's social philosophy centers on class conflict and transformation.","马克思의사회철학以阶级矛盾와변혁为중심。","Triết học xã hội của Marx tập trung vào xung đột giai cấp và biến đổi."),
    E("공동체를 이야기할 때","공동체주의 사회철학은 개인보다 공동체를 중시해요.","Communitarian social philosophy values community over the individual.","共同体주의사회철학比个人더重视공동체。","Triết học xã hội cộng đồng luận đề cao cộng đồng hơn cá nhân."),
    E("자유주의를 이야기할 때","자유주의 사회철학은 개인의 권리와 자유를 최우선으로 해요.","Liberal social philosophy prioritizes individual rights and freedom above all.","自由주의사회철학最优先개인의权利와자유。","Triết học xã hội tự do chủ nghĩa ưu tiên quyền và tự do cá nhân lên hàng đầu."),
    E("불평등을 이야기할 때","사회철학은 사회적 불평등의 원인과 해결책을 분석해요.","Social philosophy analyzes the causes and solutions of social inequality.","사회철학分析社회不平等의원인与해결책。","Triết học xã hội phân tích nguyên nhân và giải pháp cho bất bình đẳng xã hội."),
    E("제도를 이야기할 때","사회철학은 법, 국가, 시장 같은 사회 제도의 정당성을 검토해요.","Social philosophy examines the legitimacy of social institutions like law, the state, and the market.","사회철학检视法律、国家、市场等사회제도의정당성。","Triết học xã hội xem xét tính hợp pháp của các thể chế xã hội như pháp luật, nhà nước và thị trường."),
    E("현재를 이야기할 때","현대 사회철학이 기후 위기와 AI 윤리 문제를 다루고 있어요.","Modern social philosophy is dealing with climate crisis and AI ethics issues.","현대사회철학在처리기후위기와AI윤리문제。","Triết học xã hội hiện đại đang xử lý các vấn đề khủng hoảng khí hậu và đạo đức AI."),
    E("교육을 이야기할 때","사회철학은 민주 시민 교육의 이론적 기반을 제공해요.","Social philosophy provides the theoretical foundation for democratic civic education.","사회철학为민주시민교육提供理论基础。","Triết học xã hội cung cấp nền tảng lý thuyết cho giáo dục công dân dân chủ."),
  ]),
  ((6,211),"미학","명사",["미(美)학","aesthetics"],"aesthetics, philosophy of art","美学","mỹ học, triết học nghệ thuật",[
    E("학문을 정의할 때","미학은 아름다움과 예술의 본질을 탐구하는 철학 분야예요.","Aesthetics is the philosophical field that explores the nature of beauty and art.","미학是探究아름다움与艺术의본질的哲학분야。","Mỹ학은là lĩnh vực triết học khám phá bản chất của cái đẹp và nghệ thuật."),
    E("칸트를 이야기할 때","칸트의 미학은 숭고함과 아름다움을 체계적으로 분석했어요.","Kant's aesthetics systematically analyzed the sublime and the beautiful.","康德의미학系统分析了崇高함与아름다움。","Mỹ học của Kant đã phân tích có hệ thống về sự hùng vĩ và cái đẹp."),
    E("예술을 이야기할 때","미학은 예술 작품의 가치와 의미를 평가하는 기준을 논해요.","Aesthetics discusses the criteria for evaluating the value and meaning of works of art.","미학讨论评价艺术작품가치与意味의기준。","Mỹ학thảo luận về các tiêu chí đánh giá giá trị và ý nghĩa của các tác phẩm nghệ thuật."),
    E("취미를 이야기할 때","미학은 왜 사람마다 아름다움에 대한 취미가 다른지 분석해요.","Aesthetics analyzes why people have different tastes for beauty.","미학分析为什么每个人에 대한아름다움취미가다른지。","Mỹ학phân tích tại sao mỗi người có thị hiếu về cái đẹp khác nhau."),
    E("경험을 이야기할 때","미적 경험은 일상적 경험과 구별되는 특별한 의식 상태예요.","Aesthetic experience is a special state of consciousness distinct from everyday experience.","미적경험是区별于日常경험的특별한意识状態。","Kinh nghiệm thẩm mỹ là trạng thái ý thức đặc biệt khác với kinh nghiệm hàng ngày."),
    E("디지털을 이야기할 때","디지털 시대에 새로운 미학적 질문들이 제기되고 있어요.","New aesthetic questions are being raised in the digital age.","在数字时代，新的미학적질문들正在提出。","Các câu hỏi thẩm mỹ mới đang được đặt ra trong kỷ nguyên số."),
    E("교육을 이야기할 때","예술 교육에서 미학적 감수성 함양이 중요해요.","Cultivating aesthetic sensitivity is important in arts education.","在艺术교육中，培养미학적감수성很重요。","Nuôi dưỡng cảm thụ thẩm mỹ quan trọng trong giáo dục nghệ thuật."),
    E("자연을 이야기할 때","자연 미학은 자연 속에서 아름다움을 어떻게 경험하는지 탐구해요.","Natural aesthetics explores how beauty is experienced in nature.","自然미학탐구在自然中如何경험아름다움。","Mỹ học tự nhiên khám phá cách trải nghiệm cái đẹp trong tự nhiên."),
    E("일상을 이야기할 때","일상미학은 평범한 일상에서 미적 가치를 찾아요.","Everyday aesthetics seeks aesthetic value in ordinary daily life.","日常미학在平凡日常中寻找미적가치。","Mỹ học hàng ngày tìm kiếm giá trị thẩm mỹ trong cuộc sống thường ngày bình thường."),
    E("문화를 이야기할 때","문화에 따라 미적 기준과 이상이 달라요.","Aesthetic standards and ideals differ according to culture.","随文화미적기준与理想각달라。","Tiêu chuẩn và lý tưởng thẩm mỹ khác nhau theo văn hóa."),
  ]),
  ((6,235),"논리학","명사",["논리","logic"],"logic, formal logic","逻辑学，形式逻辑","luận lý học, logic học",[
    E("학문을 정의할 때","논리학은 올바른 추론의 원리와 방법을 연구하는 학문이에요.","Logic is the study of the principles and methods of correct reasoning.","논리학是研究正确推论의원리与方법의학문。","Luận lý học là môn khoa học nghiên cứu các nguyên lý và phương pháp của lập luận đúng đắn."),
    E("아리스토텔레스를 이야기할 때","아리스토텔레스가 논리학의 체계를 처음 정립했어요.","Aristotle first established the system of logic.","亚里士多德최초로정립了논리학의체계。","Aristotle là người đầu tiên thiết lập hệ thống luận lý học."),
    E("연역을 이야기할 때","연역 논리학은 일반 원리에서 특수 결론을 이끌어내요.","Deductive logic derives specific conclusions from general principles.","演绎논리학从一般원리导出特殊결론。","Luận lý học diễn dịch rút ra kết luận cụ thể từ các nguyên lý chung."),
    E("귀납을 이야기할 때","귀납 논리학은 특수 사례에서 일반 원리를 도출해요.","Inductive logic derives general principles from specific cases.","归纳논리학从特殊사례도출一般원리。","Luận lý học귀납rút ra nguyên lý chung từ các trường hợp cụ thể."),
    E("기호를 이야기할 때","기호 논리학은 수학적 기호로 논리적 관계를 표현해요.","Symbolic logic expresses logical relationships with mathematical symbols.","符号논리학用数学기호表현논리적관계。","Luận lý học ký hiệu biểu đạt các mối quan hệ logic bằng các ký hiệu toán học."),
    E("철학을 이야기할 때","논리학은 모든 철학적 탐구의 기본 도구예요.","Logic is the basic tool of all philosophical inquiry.","논리학是所有哲학탐구의기본도구。","Luận lý học là công cụ cơ bản của tất cả các cuộc điều tra triết học."),
    E("AI를 이야기할 때","논리학이 인공지능과 컴퓨터 과학의 이론적 기반이에요.","Logic is the theoretical foundation of artificial intelligence and computer science.","논리학是人工智能와计算机科학의理论기반。","Luận lý học là nền tảng lý thuyết của trí tuệ nhân tạo và khoa học máy tính."),
    E("오류를 이야기할 때","논리학을 통해 다양한 논리적 오류를 식별할 수 있어요.","Various logical fallacies can be identified through logic.","通过논리학可以识别各种논리적오류。","Có thể xác định các lỗi logic khác nhau qua luận lý học."),
    E("교육을 이야기할 때","논리학 교육이 비판적 사고 능력을 향상시켜요.","Logic education improves critical thinking ability.","논리학교육提高了비판적思维능력。","Giáo dục luận lý học cải thiện khả năng tư duy phê phán."),
    E("언어를 이야기할 때","논리학이 언어 분석과 의미론 연구에 기여해요.","Logic contributes to language analysis and semantic research.","논리학贡献于语言분석와의미론연구。","Luận lý học đóng góp vào phân tích ngôn ngữ và nghiên cứu ngữ nghĩa học."),
  ]),
  ((6,277),"포스트휴머니즘","명사",["포스트 휴머니즘","posthumanism"],"posthumanism, post-humanism","后人类主义，超人类主义","chủ nghĩa hậu nhân loại, posthumanism",[
    E("인간을 재정의할 때","포스트휴머니즘은 기술로 인한 인간의 변화를 탐구하는 사상이에요.","Posthumanism is a philosophy that explores human transformation through technology.","포스트휴머니즘是探究由技术引发人간변화의思想。","Chủ nghĩa hậu nhân loại là tư tưởng khám phá sự biến đổi của con người thông qua công nghệ."),
    E("AI를 이야기할 때","포스트휴머니즘은 AI와 인간의 공존을 어떻게 이해할지 탐구해요.","Posthumanism explores how to understand the coexistence of AI and humans.","포스트휴머니즘탐구如何理解AI와人간의공존。","Chủ nghĩa hậu nhân loại khám phá cách hiểu sự cùng tồn tại của AI và con người."),
    E("사이보그를 이야기할 때","해러웨이의 사이보그 선언이 포스트휴머니즘에 큰 영향을 미쳤어요.","Haraway's Cyborg Manifesto had a great influence on posthumanism.","哈拉维의사이보그선언对포스트휴머니즘产生了很大影响。","Tuyên ngôn Cyborg của Haraway đã có ảnh hưởng lớn đến chủ nghĩa hậu nhân loại."),
    E("인간중심을 비판할 때","포스트휴머니즘은 인간중심주의를 넘어서려 해요.","Posthumanism seeks to go beyond anthropocentrism.","포스트휴머니즘试图超越人类중심주의。","Chủ nghĩa hậu nhân loại cố gắng vượt qua chủ nghĩa nhân loại trung tâm."),
    E("바이오기술을 이야기할 때","유전공학과 바이오 기술이 포스트휴머니즘의 논의를 촉발했어요.","Genetic engineering and biotechnology triggered the discussions of posthumanism.","基因工程와생명기술촉발了포스트휴머니즘의토론。","Kỹ thuật di truyền và công nghệ sinh học đã kích thích các cuộc thảo luận về chủ nghĩa hậu nhân loại."),
    E("윤리를 이야기할 때","포스트휴머니즘은 기술 발전에 따른 새로운 윤리 문제를 제기해요.","Posthumanism raises new ethical issues arising from technological development.","포스트휴머니즘提出随기술발전而来的新윤리문제。","Chủ nghĩa hậu nhân loại đặt ra các vấn đề đạo đức mới phát sinh từ sự phát triển công nghệ."),
    E("트랜스휴머니즘과 비교할 때","포스트휴머니즘과 트랜스휴머니즘은 인간 향상을 다르게 봐요.","Posthumanism and transhumanism view human enhancement differently.","포스트휴머니즘与트랜스휴머니즘对人간향상의看法不同。","Chủ nghĩa hậu nhân loại và chủ nghĩa siêu nhân loại nhìn nhận sự tăng cường của con người theo cách khác nhau."),
    E("정체성을 이야기할 때","포스트휴머니즘은 기술 시대의 인간 정체성 문제를 제기해요.","Posthumanism raises questions about human identity in the technological age.","포스트휴머니즘提出기술시대의人간정체성问题。","Chủ nghĩa hậu nhân loại đặt ra câu hỏi về bản sắc con người trong thời đại công nghệ."),
    E("예술을 이야기할 때","포스트휴머니즘 예술은 인간과 기술의 경계를 탐구해요.","Posthumanist art explores the boundary between humans and technology.","포스트휴머니즘艺术탐구人간与기술의경계。","Nghệ thuật hậu nhân loại khám phá ranh giới giữa con người và công nghệ."),
    E("미래를 이야기할 때","포스트휴머니즘은 인류의 미래 진화 방향을 상상해요.","Posthumanism imagines the future direction of human evolution.","포스트휴머니즘想象人类미래진화방향。","Chủ nghĩa hậu nhân loại hình dung hướng tiến hóa tương lai của nhân loại."),
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
with open("D:/MakingApps/Apps/Hellowords/replacements_part7.json", "w", encoding="utf-8") as f:
    json.dump(ENTRIES, f, ensure_ascii=False, indent=2)
print(f"Part7 saved: {len(ENTRIES)} entries")
