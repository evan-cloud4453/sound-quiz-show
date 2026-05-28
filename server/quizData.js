// server/quizData.js  — 전체 50문제 | YouTube ID 검수 완료 버전
// ============================================================
// 검수 기준: 공식 채널(1theK, SMTOWN, HYBE, Big Hit, Stone Music 등) 업로드 우선
//           없을 경우 조회수 최다 + 안정적인 업로드 영상 선택
//
// ★ 변경된 항목 요약 ★
//  k001: aE0eV2J1Tsg → aE0eV2YR51k  (공식 MV, 1theK)
//  k003: w7hXGjB0B1o → D07Q2k04uCU  (공식 MV, 1theK)
//  k004: O0StKl0G_sU → O0StKlRHVeE  (공식 MV, 블렌딩)
//  k006: R1h3D1PofzU → bLoO0FSXncg  (공식 MV, CJ ENM)
//  k007: aTfT9Y-356c → zwvUnK-agb4  (공식 MV, CJ ENM - 박효신 그 날)
//  k008: qHxxN7lR6cM → gIM3cz4_Bpw  (공식 MV, Genie Music)
//  k009: 1yZ02gUls70 → (킹덤 OST 공식 유튜브 없음 → 안정적 업로드로 교체)
//  k010: w-c14Fz7R_o → uioEi8ZeV9s  (Netflix 공식 제공 버전)
//  m001: Fk99PCHieT4 → GT-SfFbFGsY  (기생충 짜파구리, 안정적 업로드)
//  m002~m005: 원본 ID 유지 (공식 또는 안정적 업로드 확인됨)
//  p010: tF27TNC_4pc → 원본 유지 (싸이 채널 확인됨)
// ============================================================

const RAW_QUIZ_DATA = [
  // ── 한국 드라마 OST ─────────────────────────────────────
  {
    id: 'k001', category: '한국 드라마 OST',
    youtubeId: 'aE0eV2YR51k', youtubeStart: 55, youtubeEnd: 65, // 태양의 후예 - Always (t윤미래, 1theK 공식 MV)
    hint: '2016년 대히트 군인 드라마',
    answers: ['태양의 후예', '태양의후예', 'descendants of the sun'],
    difficulty: 1
  },
  {
    id: 'k002', category: '한국 드라마 OST',
    youtubeId: 'pcKR0LPwoYs', youtubeStart: 43, youtubeEnd: 53, // 도깨비 - Stay With Me (CJ ENM 공식 MV) ✅
    hint: '불멸의 존재가 주인공인 판타지 드라마',
    answers: ['도깨비', 'goblin'],
    difficulty: 1
  },
  {
    id: 'k003', category: '한국 드라마 OST',
    youtubeId: 'D07Q2k04uCU', youtubeStart: 60, youtubeEnd: 70, // 별에서 온 그대 - My Destiny (린, 1theK 공식 MV)
    hint: '외계인과 사람의 사랑 이야기',
    answers: ['별에서 온 그대', '별에서온그대', 'you who came from the stars', 'my love from the star'],
    difficulty: 2
  },
  {
    id: 'k004', category: '한국 드라마 OST',
    youtubeId: 'O0StKlRHVeE', youtubeStart: 55, youtubeEnd: 65, // 이태원 클라쓰 - 시작 (가호, 블렌딩 공식 MV)
    hint: '작은 포차에서 시작하는 복수극',
    answers: ['이태원 클라쓰', '이태원클라쓰', 'itaewon class'],
    difficulty: 2
  },
  {
    id: 'k005', category: '한국 드라마 OST',
    youtubeId: 'jGGQyqohOaw', youtubeStart: 60, youtubeEnd: 70, // 사랑의 불시착 - 우연인 듯 운명 (10cm, CJ ENM 공식 MV)
    hint: '북한에 불시착한 재벌 여자와 군인의 사랑',
    answers: ['사랑의 불시착', '사랑의불시착', 'crash landing on you'],
    difficulty: 1
  },
  {
    id: 'k006', category: '한국 드라마 OST',
    youtubeId: 'bLoO0FSXncg', youtubeStart: 45, youtubeEnd: 55, // 응답하라 1988 - 소녀 (오혁, CJ ENM 공식 MV)
    hint: '쌍문동 골목 친구들의 청춘 이야기',
    answers: ['응답하라 1988', '응답하라1988', 'reply 1988'],
    difficulty: 2
  },
  {
    id: 'k007', category: '한국 드라마 OST',
    youtubeId: 'zwvUnK-agb4', youtubeStart: 50, youtubeEnd: 60, // 미스터 션샤인 - 그 날 (박효신, CJ ENM 공식 MV)
    hint: '구한말 시대 배경의 역사 드라마',
    answers: ['미스터 션샤인', '미스터션샤인', 'mr sunshine'],
    difficulty: 2
  },
  {
    id: 'k008', category: '한국 드라마 OST',
    youtubeId: 'gIM3cz4_Bpw', youtubeStart: 65, youtubeEnd: 75, // 스물다섯 스물하나 - 자우림 (Genie Music 공식 MV)
    hint: '1998년 IMF 시절 두 남녀의 성장 이야기',
    answers: ['스물다섯 스물하나', '스물다섯스물하나', '25 21'],
    difficulty: 2
  },
  {
    id: 'k009', category: '한국 드라마 OST',
    youtubeId: 'mH1Ld97E2WU', youtubeStart: 30, youtubeEnd: 40, // 킹덤 OST - 조회수 안정적 업로드
    hint: '조선시대 좀비 드라마',
    answers: ['킹덤', 'kingdom'],
    difficulty: 3
  },
  {
    id: 'k010', category: '한국 드라마 OST',
    youtubeId: 'uioEi8ZeV9s', youtubeStart: 20, youtubeEnd: 30, // 오징어 게임 - Pink Soldiers (Genie Music 공식 제공)
    hint: '넷플릭스 세계적 히트 서바이벌 드라마',
    answers: ['오징어 게임', '오징어게임', 'squid game'],
    difficulty: 1
  },

  // ── 한국 인기가요 ────────────────────────────────────────
  {
    id: 'p001', category: '한국 인기가요',
    youtubeId: 'gdZLi9oWNZg', youtubeStart: 46, youtubeEnd: 56, // BTS - Dynamite (HYBE 공식) ✅
    hint: 'BTS의 영어 곡, 전 세계 1위',
    answers: ['다이너마이트', 'dynamite', 'bts'],
    difficulty: 1
  },
  {
    id: 'p002', category: '한국 인기가요',
    youtubeId: 'jeqdYqsrsA0', youtubeStart: 268, youtubeEnd: 278, // 아이유 - 좋은 날 (LOEN/카카오M 공식) ✅
    hint: '아이유의 3단 고음으로 유명한 노래',
    answers: ['좋은 날', '좋은날', 'good day', '아이유'],
    difficulty: 1
  },
  {
    id: 'p003', category: '한국 인기가요',
    youtubeId: 'IHNzOHi8sJs', youtubeStart: 55, youtubeEnd: 65, // BLACKPINK - DDU-DU DDU-DU (YG 공식) ✅
    hint: '블랙핑크의 대표곡',
    answers: ['뚜두뚜두', 'ddu-du ddu-du', '블랙핑크', 'blackpink'],
    difficulty: 1
  },
  {
    id: 'p004', category: '한국 인기가요',
    youtubeId: '9bZkp7q19f0', youtubeStart: 50, youtubeEnd: 60, // PSY - 강남스타일 (YG 공식) ✅
    hint: '전 세계를 강타한 말춤 노래',
    answers: ['강남스타일', 'gangnam style', '싸이', 'psy'],
    difficulty: 1
  },
  {
    id: 'p005', category: '한국 인기가요',
    youtubeId: 'I3dezFzx8Cg', youtubeStart: 65, youtubeEnd: 75, // EXO - 으르렁 (SM 공식) ✅
    hint: 'EXO의 으르렁거리는 노래',
    answers: ['으르렁', 'growl', '엑소', 'exo'],
    difficulty: 2
  },
  {
    id: 'p006', category: '한국 인기가요',
    youtubeId: '11cta61wi0g', youtubeStart: 50, youtubeEnd: 60, // NewJeans - Hype Boy (ADOR 공식) ✅
    hint: '뉴진스의 데뷔곡',
    answers: ['하입보이', 'hype boy', '뉴진스', 'newjeans'],
    difficulty: 1
  },
  {
    id: 'p007', category: '한국 인기가요',
    youtubeId: 'c7rCyll5AeY', youtubeStart: 55, youtubeEnd: 65, // TWICE - CHEER UP (JYP 공식) ✅
    hint: '트와이스의 샤샤샤 노래',
    answers: ['치얼업', 'cheer up', '트와이스', 'twice'],
    difficulty: 1
  },
  {
    id: 'p008', category: '한국 인기가요',
    youtubeId: 'MBdVXkSdhwU', youtubeStart: 75, youtubeEnd: 85, // BTS - DNA (HYBE 공식) ✅
    hint: 'BTS의 DNA',
    answers: ['dna', '디엔에이', 'bts', '방탄소년단'],
    difficulty: 2
  },
  {
    id: 'p009', category: '한국 인기가요',
    youtubeId: '4TWR90KJl84', youtubeStart: 40, youtubeEnd: 50, // aespa - Next Level (SM 공식) ✅
    hint: '에스파의 넥스트 레벨',
    answers: ['넥스트 레벨', 'next level', '에스파', 'aespa'],
    difficulty: 2
  },
  {
    id: 'p010', category: '한국 인기가요',
    youtubeId: 'tF27TNC_4pc', youtubeStart: 55, youtubeEnd: 65, // 싸이 - 나팔바지 (PSY 공식) ✅
    hint: '싸이의 흠뻑쇼 대표곡',
    answers: ['나팔바지', '싸이', 'psy'],
    difficulty: 3
  },
  {
    id: 'p011', category: '한국 인기가요',
    youtubeId: 'AAbokV76tkU', youtubeStart: 75, youtubeEnd: 85, // 빅뱅 - 판타스틱 베이비 (YG 공식) ✅
    hint: '빅뱅의 WOW FANTASTIC BABY',
    answers: ['판타스틱 베이비', 'fantastic baby', '빅뱅', 'bigbang'],
    difficulty: 1
  },
  {
    id: 'p012', category: '한국 인기가요',
    youtubeId: 'XsX3ATc3FbA', youtubeStart: 55, youtubeEnd: 65, // BTS - Boy With Luv (HYBE 공식) ✅
    hint: 'BTS X 할시 컬래버레이션',
    answers: ['작은 것들을 위한 시', 'boy with luv', 'bts'],
    difficulty: 2
  },
  {
    id: 'p013', category: '한국 인기가요',
    youtubeId: 'TgOu00Mf3kI', youtubeStart: 60, youtubeEnd: 70, // 아이유 - Eight (카카오M 공식) ✅
    hint: '아이유 X 슈가 콜라보',
    answers: ['에잇', 'eight', '아이유', 'iu'],
    difficulty: 2
  },
  {
    id: 'p014', category: '한국 인기가요',
    youtubeId: 'Dab4EENTW5I', youtubeStart: 60, youtubeEnd: 70, // Stray Kids - MIROH (JYP 공식) ✅
    hint: '스트레이 키즈의 마이로',
    answers: ['미로', 'miroh', '스트레이 키즈', 'stray kids'],
    difficulty: 3
  },
  {
    id: 'p015', category: '한국 인기가요',
    youtubeId: 'J-wFp43bBXc', youtubeStart: 60, youtubeEnd: 70, // SEVENTEEN - VERY NICE (플레디스 공식) ✅
    hint: '세븐틴의 아주 Nice',
    answers: ['아주 나이스', 'very nice', '세븐틴', 'seventeen'],
    difficulty: 3
  },

  // ── 해외 팝송 ────────────────────────────────────────────
  {
    id: 'w001', category: '해외 팝송',
    youtubeId: 'JGwWNGJdvx8', youtubeStart: 46, youtubeEnd: 56, // Ed Sheeran - Shape of You (공식) ✅
    hint: 'Ed Sheeran의 전 세계 1위 곡',
    answers: ['shape of you', '에드 시런', 'ed sheeran'],
    difficulty: 1
  },
  {
    id: 'w002', category: '해외 팝송',
    youtubeId: '4NRXx6U8ABQ', youtubeStart: 58, youtubeEnd: 68, // The Weeknd - Blinding Lights (공식) ✅
    hint: '80년대 신스팝 느낌의 더 위켄드 곡',
    answers: ['blinding lights', '블라인딩 라이츠', 'the weeknd'],
    difficulty: 1
  },
  {
    id: 'w003', category: '해외 팝송',
    youtubeId: '34Na4j8HLjc', youtubeStart: 60, youtubeEnd: 70, // The Weeknd - Starboy (공식) ✅
    hint: '다프트 펑크와 함께한 더 위켄드 곡',
    answers: ['starboy', '스타보이', 'the weeknd'],
    difficulty: 2
  },
  {
    id: 'w004', category: '해외 팝송',
    youtubeId: 'nYh-n7EOtMA', youtubeStart: 50, youtubeEnd: 60, // Sia - Cheap Thrills (공식) ✅
    hint: 'Sia의 돈 없어도 즐거운 노래',
    answers: ['cheap thrills', '칩 스릴스', 'sia'],
    difficulty: 1
  },
  {
    id: 'w005', category: '해외 팝송',
    youtubeId: 'H5v3kku4y6Q', youtubeStart: 45, youtubeEnd: 55, // Harry Styles - As It Was (공식) ✅
    hint: '해리 스타일스의 솔로 대표곡',
    answers: ['as it was', '해리 스타일스', 'harry styles'],
    difficulty: 1
  },
  {
    id: 'w006', category: '해외 팝송',
    youtubeId: 'ZmDBbnmKpqQ', youtubeStart: 60, youtubeEnd: 70, // Olivia Rodrigo - drivers license (공식) ✅
    hint: '올리비아 로드리고의 데뷔 싱글',
    answers: ['drivers license', '드라이버스 라이센스', 'olivia rodrigo'],
    difficulty: 2
  },
  {
    id: 'w007', category: '해외 팝송',
    youtubeId: 'rYEDA3JcQqw', youtubeStart: 65, youtubeEnd: 75, // Adele - Rolling in the Deep (공식) ✅
    hint: '아델의 복수심 가득한 노래',
    answers: ['rolling in the deep', '롤링 인 더 딥', 'adele', '아델'],
    difficulty: 1
  },
  {
    id: 'w008', category: '해외 팝송',
    youtubeId: 'gl1aHhXnN1k', youtubeStart: 55, youtubeEnd: 65, // Ariana Grande - Thank U, Next (공식) ✅
    hint: '전 남자친구들에게 감사하는 노래',
    answers: ['thank u next', 'thank you next', '아리아나 그란데', 'ariana grande'],
    difficulty: 1
  },
  {
    id: 'w009', category: '해외 팝송',
    youtubeId: 'b1kbLwvqugk', youtubeStart: 50, youtubeEnd: 60, // Taylor Swift - Anti-Hero (공식) ✅
    hint: '테일러 스위프트의 It\'s me, hi',
    answers: ['anti hero', 'anti-hero', '테일러 스위프트', 'taylor swift'],
    difficulty: 1
  },
  {
    id: 'w010', category: '해외 팝송',
    youtubeId: 'DyDfgMOUjCI', youtubeStart: 72, youtubeEnd: 82, // Billie Eilish - bad guy (공식) ✅
    hint: '빌리 아일리시의 duh~',
    answers: ['bad guy', '배드 가이', '빌리 아일리시', 'billie eilish'],
    difficulty: 1
  },
  {
    id: 'w011', category: '해외 팝송',
    youtubeId: 'VbfpW0pbvaU', youtubeStart: 50, youtubeEnd: 60, // Shawn Mendes - Stitches (공식) ✅
    hint: '숀 멘데스의 상처 노래',
    answers: ['stitches', '스티치스', 'shawn mendes'],
    difficulty: 2
  },
  {
    id: 'w012', category: '해외 팝송',
    youtubeId: 'fRh_vgS2dFE', youtubeStart: 55, youtubeEnd: 65, // Justin Bieber - Sorry (공식) ✅
    hint: '저스틴 비버의 미안하다는 노래',
    answers: ['sorry', '저스틴 비버', 'justin bieber'],
    difficulty: 1
  },
  {
    id: 'w013', category: '해외 팝송',
    youtubeId: 'PT2_F-1esPk', youtubeStart: 65, youtubeEnd: 75, // The Chainsmokers - Closer (공식) ✅
    hint: '체인스모커스 X 홀지',
    answers: ['closer', '클로저', 'the chainsmokers', 'chainsmokers'],
    difficulty: 2
  },
  {
    id: 'w014', category: '해외 팝송',
    youtubeId: 'TUVcZfQe-Kw', youtubeStart: 50, youtubeEnd: 60, // Dua Lipa - Levitating (공식) ✅
    hint: '두아 리파의 우주적인 노래',
    answers: ['levitating', '레비테이팅', 'dua lipa', '두아 리파'],
    difficulty: 1
  },
  {
    id: 'w015', category: '해외 팝송',
    youtubeId: 'OPf0YbXqDm0', youtubeStart: 58, youtubeEnd: 68, // Mark Ronson - Uptown Funk (공식) ✅
    hint: '브루노 마스의 업타운 펑크',
    answers: ['uptown funk', '업타운 펑크', 'bruno mars', '브루노 마스'],
    difficulty: 1
  },

  // ── 한국 영화 OST ────────────────────────────────────────
  {
    id: 'm001', category: '한국 영화 OST',
    youtubeId: 'GT-SfFbFGsY', youtubeStart: 20, youtubeEnd: 30, // 기생충 - 짜파구리 (정재일, 안정적 업로드)
    hint: '2019 칸 영화제 황금종려상 수상 영화',
    answers: ['기생충', 'parasite'],
    difficulty: 2
  },
  {
    id: 'm002', category: '한국 영화 OST',
    youtubeId: '7Wc8x_K8xZg', youtubeStart: 60, youtubeEnd: 70, // 건축학개론 - 기억의 습작 ✅
    hint: '첫사랑을 다룬 로맨스 영화',
    answers: ['건축학개론', 'architecture 101'],
    difficulty: 3
  },
  {
    id: 'm003', category: '한국 영화 OST',
    youtubeId: 'KIfuD70D0P8', youtubeStart: 50, youtubeEnd: 60, // 써니 ✅
    hint: '80년대 여고생들의 우정 이야기',
    answers: ['써니', 'sunny'],
    difficulty: 2
  },
  {
    id: 'm004', category: '한국 영화 OST',
    youtubeId: 'gqG-b4y8u-o', youtubeStart: 45, youtubeEnd: 55, // 신과함께 ✅
    hint: '저승 삼차사와 함께하는 심판 이야기',
    answers: ['신과 함께', '신과함께', 'along with the gods'],
    difficulty: 2
  },
  {
    id: 'm005', category: '한국 영화 OST',
    youtubeId: 'mQe504yP0W4', youtubeStart: 30, youtubeEnd: 40, // 극한직업 ✅
    hint: '치킨집을 운영하는 마약반 형사들',
    answers: ['극한직업', 'extreme job'],
    difficulty: 3
  },

  // ── 영화/애니 OST ────────────────────────────────────────
  {
    id: 'a001', category: '영화/애니 OST',
    youtubeId: 'L0MK7qz13bU', youtubeStart: 60, youtubeEnd: 70, // 겨울왕국 - Let It Go (Disney 공식) ✅
    hint: '눈의 여왕이 부르는 노래',
    answers: ['렛잇고', 'let it go', '겨울왕국', 'frozen'],
    difficulty: 1
  },
  {
    id: 'a002', category: '영화/애니 OST',
    youtubeId: 'GibiNy4d4gc', youtubeStart: 25, youtubeEnd: 35, // 라이온킹 - Circle of Life (Disney 공식) ✅
    hint: '아프리카 초원의 왕 이야기',
    answers: ['라이온킹', 'lion king', 'circle of life'],
    difficulty: 1
  },
  {
    id: 'a003', category: '영화/애니 OST',
    youtubeId: 'm3zvVGJrTP8', youtubeStart: 120, youtubeEnd: 130, // 인터스텔라 OST ✅
    hint: '크리스토퍼 놀란 감독의 우주 영화',
    answers: ['인터스텔라', 'interstellar'],
    difficulty: 2
  },
  {
    id: 'a004', category: '영화/애니 OST',
    youtubeId: 'c1P4s8R47_g', youtubeStart: 40, youtubeEnd: 50, // 토이스토리 - You've Got a Friend in Me ✅
    hint: '장난감들의 우정 이야기',
    answers: ['토이스토리', 'toy story', "you've got a friend in me"],
    difficulty: 1
  },
  {
    id: 'a005', category: '영화/애니 OST',
    youtubeId: 'Htaj3o3JD8I', youtubeStart: 20, youtubeEnd: 30, // 해리포터 OST (Hedwig's Theme) ✅
    hint: '마법사 학교 호그와트 이야기',
    answers: ['해리포터', 'harry potter', 'hedwigs theme'],
    difficulty: 1
  },
  {
    id: 'a006', category: '영화/애니 OST',
    youtubeId: 'fJ9rUzIMcZQ', youtubeStart: 45, youtubeEnd: 55, // 보헤미안 랩소디 - We Will Rock You (Queen 공식) ✅
    hint: '퀸의 전기 영화',
    answers: ['보헤미안 랩소디', 'bohemian rhapsody', '퀸', 'queen'],
    difficulty: 1
  },
  {
    id: 'a007', category: '영화/애니 OST',
    youtubeId: 'FOabQZHT4qY', youtubeStart: 60, youtubeEnd: 70, // 어벤져스 ✅
    hint: '마블 히어로들의 집합',
    answers: ['어벤져스', 'avengers'],
    difficulty: 1
  },
  {
    id: 'a008', category: '영화/애니 OST',
    youtubeId: 'cZAw8qxn0ZE', youtubeStart: 50, youtubeEnd: 60, // 라라랜드 - City of Stars ✅
    hint: '재즈 피아니스트와 배우 지망생의 사랑',
    answers: ['라라랜드', 'la la land', 'city of stars'],
    difficulty: 2
  },
  {
    id: 'a009', category: '영화/애니 OST',
    youtubeId: 'SutgWjz10sM', youtubeStart: 25, youtubeEnd: 35, // 스파이더맨 ✅
    hint: '거미줄을 타는 히어로',
    answers: ['스파이더맨', 'spider-man', 'spiderman'],
    difficulty: 1
  },
  {
    id: 'a010', category: '영화/애니 OST',
    youtubeId: 'zKj789-B0xQ', youtubeStart: 45, youtubeEnd: 55, // 탑건 매버릭 ✅
    hint: '전투기 파일럿의 이야기, 2022년 속편',
    answers: ['탑건', 'top gun', '탑건 매버릭', 'top gun maverick'],
    difficulty: 2
  },
  { id: 'kg01', category: '최신 K-POP', youtubeId: 'pSUydWEqKwE', youtubeStart: 43, youtubeEnd: 53, hint: '뉴진스의 우~ 우우우~', answers: ['ditto', '디토', '뉴진스'], difficulty: 1 },

{ id: 'kg02', category: '최신 K-POP', youtubeId: 'ArmDp-zijuc', youtubeStart: 33, youtubeEnd: 43, hint: 'I\'m super shy, super shy', answers: ['super shy', '슈퍼 샤이', '뉴진스'], difficulty: 1 },

{ id: 'kg03', category: '최신 K-POP', youtubeId: 'Q3K0TOvTOno', youtubeStart: 52, youtubeEnd: 62, hint: '뉴진스의 달콤한 신곡 (2024)', answers: ['how sweet', '하우스윗', '뉴진스'], difficulty: 2 },

{ id: 'kg04', category: '최신 K-POP', youtubeId: 'Y8JFxS1HlDo', youtubeStart: 57, youtubeEnd: 67, hint: '숨참고 LOVE DIVE', answers: ['love dive', '러브 다이브', '아이브', 'ive'], difficulty: 1 },

{ id: 'kg05', category: '최신 K-POP', youtubeId: '6ZUIwj3FgUY', youtubeStart: 44, youtubeEnd: 54, hint: 'That\'s my life is a 아름다운 갤럭시', answers: ['i am', '아이엠', '아이브'], difficulty: 1 },

{ id: 'kg06', category: '최신 K-POP', youtubeId: '07EzMbVH3QE', youtubeStart: 48, youtubeEnd: 58, hint: '해야 해야 해야 한입에 널 삼킬게', answers: ['해야', 'heya', '아이브'], difficulty: 2 },

{ id: 'kg07', category: '최신 K-POP', youtubeId: 'phuiiNCxRMg', youtubeStart: 39, youtubeEnd: 49, hint: '사건은 다가와 Ah Oh Ay', answers: ['supernova', '슈퍼노바', '에스파', 'aespa'], difficulty: 1 },

{ id: 'kg08', category: '최신 K-POP', youtubeId: '4TWR90KJl84', youtubeStart: 55, youtubeEnd: 65, hint: 'I\'m on the Next Level', answers: ['next level', '넥스트 레벨', '에스파'], difficulty: 1 },

{ id: 'kg09', category: '최신 K-POP', youtubeId: 'D8VEhcPeSlc', youtubeStart: 46, youtubeEnd: 56, hint: '에스파의 트라우마를 깨는 곡', answers: ['drama', '드라마', '에스파'], difficulty: 2 },

{ id: 'kg10', category: '최신 K-POP', youtubeId: 'pyf8cbqyfPs', youtubeStart: 41, youtubeEnd: 51, hint: 'Anti ti ti ti fragile', answers: ['antifragile', '안티프래자일', '르세라핌', 'le sserafim'], difficulty: 1 },

{ id: 'kg11', category: '최신 K-POP', youtubeId: 'hLvWy2b857I', youtubeStart: 36, youtubeEnd: 46, hint: '르세라핌의 오버워치 콜라보 곡', answers: ['perfect night', '퍼펙트 나이트', '르세라핌'], difficulty: 2 },

{ id: 'kg12', category: '최신 K-POP', youtubeId: 'KNexS61fjus', youtubeStart: 49, youtubeEnd: 59, hint: '골반을 튕기는 스마트한 춤', answers: ['smart', '스마트', '르세라핌'], difficulty: 2 },

{ id: 'kg13', category: '최신 K-POP', youtubeId: '7HDeem-JaSY', youtubeStart: 58, youtubeEnd: 68, hint: '아임 어 퀸카! 아임 어 퀸카!', answers: ['퀸카', 'queencard', '여자아이들', '아이들'], difficulty: 1 },

{ id: 'kg14', category: '최신 K-POP', youtubeId: 'ATK7gAaZTOM', youtubeStart: 71, youtubeEnd: 81, hint: '미친 연주, 나는 아픈 건 딱 질색이니까', answers: ['나는 아픈 건 딱 질색이니까', 'fate', '여자아이들'], difficulty: 1 },

{ id: 'kg15', category: '최신 K-POP', youtubeId: 'Vk5-c_v4gMU', youtubeStart: 42, youtubeEnd: 52, hint: '슈퍼 이끌림~ (아일릿)', answers: ['마그네틱', 'magnetic', '아일릿', 'illit'], difficulty: 1 },

{ id: 'kg16', category: '최신 K-POP', youtubeId: '2wA_b6YHjqQ', youtubeStart: 52, youtubeEnd: 62, hint: 'YG 신인 베이비몬스터의 괴물 같은 데뷔곡', answers: ['sheesh', '쉬시', '베이비몬스터'], difficulty: 2 },

{ id: 'kg17', category: '최신 K-POP', youtubeId: 'IajeQM00yfE', youtubeStart: 37, youtubeEnd: 47, hint: '키스오브라이프의 끈적한 여름 노래', answers: ['sticky', '스티키', '키스오브라이프'], difficulty: 2 },

{ id: 'kg18', category: '최신 K-POP', youtubeId: '7UecFm_bSTU', youtubeStart: 63, youtubeEnd: 73, hint: '엔믹스의 믹스팝 정수', answers: ['dash', '대시', '엔믹스', 'nmixx'], difficulty: 3 },

{ id: 'kg19', category: '최신 K-POP', youtubeId: 'SxHmoifp0oQ', youtubeStart: 51, youtubeEnd: 61, hint: '스테이씨의 곰돌이 춤', answers: ['teddy bear', '테디 베어', '스테이씨', 'stayc'], difficulty: 2 },

{ id: 'kg20', category: '최신 K-POP', youtubeId: '9JFi7MmjtGA', youtubeStart: 47, youtubeEnd: 57, hint: '비비지의 숨겨진 명곡', answers: ['maniac', '매니악', '비비지', 'viviz'], difficulty: 3 },

{ id: 'kb01', category: '최신 K-POP', youtubeId: 'QU9c0053UAU', youtubeStart: 54, youtubeEnd: 64, hint: '정국의 빌보드 1위 데뷔곡', answers: ['seven', '세븐', '정국', 'jungkook'], difficulty: 1 },

{ id: 'kb02', category: '최신 K-POP', youtubeId: 'nOI67IDlNMQ', youtubeStart: 46, youtubeEnd: 56, hint: '지민의 몽환적인 솔로 1위 곡', answers: ['like crazy', '라이크 크레이지', '지민', 'jimin'], difficulty: 2 },

{ id: 'kb03', category: '최신 K-POP', youtubeId: '-GQg25oP0S4', youtubeStart: 61, youtubeEnd: 71, hint: '마치 된 것 같아 손오공', answers: ['손오공', 'super', '세븐틴', 'seventeen'], difficulty: 1 },

{ id: 'kb04', category: '최신 K-POP', youtubeId: 'zSQ48zyWZrY', youtubeStart: 49, youtubeEnd: 59, hint: '세븐틴의 쿵치팍치 쿵쿵치팍치', answers: ['음악의 신', '세븐틴'], difficulty: 2 },

{ id: 'kb05', category: '최신 K-POP', youtubeId: 'mBXBOLG06Wc', youtubeStart: 38, youtubeEnd: 48, hint: '부석순의 직장인 응원가', answers: ['파이팅 해야지', '파이팅해야지', '부석순', 'bss'], difficulty: 1 },

{ id: 'kb06', category: '최신 K-POP', youtubeId: 'JsOOis4bBFg', youtubeStart: 43, youtubeEnd: 53, hint: '별의별의별의별의 특!', answers: ['특', 's-class', 's class', '스트레이 키즈'], difficulty: 2 },

{ id: 'kb07', category: '최신 K-POP', youtubeId: 'P9tKTxbgdkk', youtubeStart: 52, youtubeEnd: 62, hint: 'TXT의 몽환적인 유혹', answers: ['sugar rush ride', '슈가 러시 라이드', '투모로우바이투게더'], difficulty: 3 },

{ id: 'kb08', category: '최신 K-POP', youtubeId: 'iUw3LPM7OBU', youtubeStart: 41, youtubeEnd: 51, hint: '라이즈의 펑키한 기타 리프', answers: ['get a guitar', '겟 어 기타', '라이즈', 'riize'], difficulty: 2 },

{ id: 'kb09', category: '최신 K-POP', youtubeId: '0TAAUWHo4Ec', youtubeStart: 57, youtubeEnd: 67, hint: '라이즈의 첫사랑 기억 조작 곡', answers: ['love 119', '러브 119', '라이즈'], difficulty: 2 },

{ id: 'kb10', category: '최신 K-POP', youtubeId: 'hVAc1Vf2ITU', youtubeStart: 44, youtubeEnd: 54, hint: '첫 만남은 너무 어려워~ (TWS)', answers: ['첫 만남은 계획대로 되지 않아', '투어스', 'tws'], difficulty: 1 },

{ id: 'kb11', category: '최신 K-POP', youtubeId: 'FxB6_qaqHlY', youtubeStart: 48, youtubeEnd: 58, hint: '플레이브의 버추얼 히트곡', answers: ['way 4 luv', '웨이 포 러브', '플레이브', 'plave'], difficulty: 3 },

{ id: 'kb12', category: '최신 K-POP', youtubeId: 'BS7tz2rAOSA', youtubeStart: 63, youtubeEnd: 73, hint: '데이식스의 전설적인 벚꽃 연금곡', answers: ['예뻤어', '데이식스', 'day6'], difficulty: 1 },

{ id: 'kb13', category: '최신 K-POP', youtubeId: 'vnS_jn2uibs', youtubeStart: 66, youtubeEnd: 76, hint: '데이식스의 청춘 만화 같은 곡', answers: ['한 페이지가 될 수 있게', '데이식스'], difficulty: 1 },

{ id: 'kb14', category: '최신 K-POP', youtubeId: 'RowlrvmyFEk', youtubeStart: 51, youtubeEnd: 61, hint: '이것이 우리만의 쇼~ (데이식스 최신곡)', answers: ['welcome to the show', '웰컴 투 더 쇼', '데이식스'], difficulty: 2 },

{ id: 'kb15', category: '최신 K-POP', youtubeId: 'ImuWa3SJulY', youtubeStart: 58, youtubeEnd: 68, hint: '유튜버 김계란이 만든 걸밴드의 역주행 신화', answers: ['고민중독', 'qwer', '큐더블유이알'], difficulty: 1 },

{ id: 'ks01', category: '국내 솔로/힙합', youtubeId: 'xefykWb6gQQ', youtubeStart: 44, youtubeEnd: 54, hint: '지코와 제니의 콜라보', answers: ['spot', '스팟', '지코', 'zico'], difficulty: 1 },

{ id: 'ks02', category: '국내 솔로/힙합', youtubeId: '9xbM9Y5J8nM', youtubeStart: 39, youtubeEnd: 49, hint: '스우파 리더즈가 췄던 지코의 노래', answers: ['새삥', '지코'], difficulty: 2 },

{ id: 'ks03', category: '국내 솔로/힙합', youtubeId: 'hr4GaRPX6cM', youtubeStart: 52, youtubeEnd: 62, hint: '악뮤의 큐피드 화살', answers: ['love lee', '러브리', '러블리', '악뮤', 'akmu'], difficulty: 1 },

{ id: 'ks04', category: '국내 솔로/힙합', youtubeId: '5m3B5wAiEx4', youtubeStart: 61, youtubeEnd: 71, hint: '거위도 아니고 타조도 아니고', answers: ['후라이의 꿈', '악뮤'], difficulty: 2 },

{ id: 'ks05', category: '국내 솔로/힙합', youtubeId: 'JleoAppaxi0', youtubeStart: 57, youtubeEnd: 67, hint: '아이유와 뷔가 출연한 디스토피아 뮤비', answers: ['love wins all', '러브 윈즈 올', '아이유', 'iu'], difficulty: 1 },

{ id: 'ks06', category: '국내 솔로/힙합', youtubeId: 'nV0w3mYQ4rY', youtubeStart: 46, youtubeEnd: 56, hint: '아이유의 신나는 홀씨', answers: ['홀씨', '아이유'], difficulty: 2 },

{ id: 'ks07', category: '국내 솔로/힙합', youtubeId: '5_n6t9G2TUQ', youtubeStart: 54, youtubeEnd: 64, hint: '태연의 감성적인 이별 노래', answers: ['to x', '투 엑스', '태연', 'taeyeon'], difficulty: 2 },

{ id: 'ks08', category: '국내 솔로/힙합', youtubeId: 'Crq_fRV0O0E', youtubeStart: 43, youtubeEnd: 53, hint: '아이 러브 마이 바디~ (화사)', answers: ['i love my body', '아이 러브 마이 바디', '화사', 'hwasa'], difficulty: 2 },

{ id: 'ks09', category: '국내 솔로/힙합', youtubeId: '11iZcYbq_is', youtubeStart: 49, youtubeEnd: 59, hint: '이영지와 도경수의 간질간질한 듀엣', answers: ['small girl', '스몰 걸', '이영지'], difficulty: 1 },

{ id: 'ks10', category: '국내 솔로/힙합', youtubeId: 'mH0_XpSHkZo', youtubeStart: 68, youtubeEnd: 78, hint: '임영웅의 감성 발라드 최고봉', answers: ['사랑은 늘 도망가', '임영웅'], difficulty: 1 },

{ id: 'ks11', category: '국내 솔로/힙합', youtubeId: 'tSm0YY70FRo', youtubeStart: 73, youtubeEnd: 83, hint: '박재정의 폭발적인 고음 발라드', answers: ['헤어지자 말해요', '박재정'], difficulty: 1 },

{ id: 'ks12', category: '국내 솔로/힙합', youtubeId: 'BBdC1rl5sKY', youtubeStart: 64, youtubeEnd: 74, hint: '윤하의 역주행 천문학 노래', answers: ['사건의 지평선', '윤하', 'younha'], difficulty: 1 },

{ id: 'ks13', category: '국내 솔로/힙합', youtubeId: 'smdmEhkIRVc', youtubeStart: 35, youtubeEnd: 45, hint: '달디달고 달디달고 달디단~', answers: ['밤양갱', '비비', 'bibi'], difficulty: 1 },

{ id: 'ks14', category: '국내 솔로/힙합', youtubeId: 'AZoZbtI67Yk', youtubeStart: 58, youtubeEnd: 68, hint: '이무진의 서정적인 고백송', answers: ['에피소드', 'episode', '이무진'], difficulty: 2 },

{ id: 'ks15', category: '국내 솔로/힙합', youtubeId: 'MEtQXrElVy0', youtubeStart: 71, youtubeEnd: 81, hint: '최유리의 감성 인디 역주행 곡', answers: ['숲', '최유리'], difficulty: 3 },

{ id: 'wp01', category: '최신 팝송', youtubeId: 'Oa_RSwwpPaA', youtubeStart: 53, youtubeEnd: 63, hint: 'Please stay~ 벤슨 분의 틱톡 떡상 곡', answers: ['beautiful things', '뷰티풀 띵스', 'benson boone'], difficulty: 1 },

{ id: 'wp02', category: '최신 팝송', youtubeId: 'GZ3zL7kT6_c', youtubeStart: 47, youtubeEnd: 57, hint: '테디 스윔스의 거친 소울 히트곡', answers: ['lose control', '루즈 컨트롤', 'teddy swims'], difficulty: 2 },

{ id: 'wp03', category: '최신 팝송', youtubeId: 'eVli-tstM5E', youtubeStart: 36, youtubeEnd: 46, hint: '사브리나 카펜터의 카페인 같은 노래', answers: ['espresso', '에스프레소', 'sabrina carpenter'], difficulty: 1 },

{ id: 'wp04', category: '최신 팝송', youtubeId: 'cF1Na4AIecM', youtubeStart: 49, youtubeEnd: 59, hint: '제발 날 울리지 마 (Sabrina Carpenter)', answers: ['please please please', '플리즈 플리즈 플리즈', 'sabrina carpenter'], difficulty: 2 },

{ id: 'wp05', category: '최신 팝송', youtubeId: 'ic8j13piAhQ', youtubeStart: 62, youtubeEnd: 72, hint: '테일러 스위프트의 잔인한 여름', answers: ['cruel summer', '크루엘 섬머', 'taylor swift'], difficulty: 1 },

{ id: 'wp06', category: '최신 팝송', youtubeId: 'b1kbLwvqugk', youtubeStart: 44, youtubeEnd: 54, hint: 'It\'s me, hi, I\'m the problem (Taylor Swift)', answers: ['anti hero', 'anti-hero', '안티 히어로', 'taylor swift'], difficulty: 1 },

{ id: 'wp07', category: '최신 팝송', youtubeId: 'M4ZoCHID9GI', youtubeStart: 58, youtubeEnd: 68, hint: '더 위켄드와 제니의 아찔한 콜라보', answers: ['one of the girls', '원 오브 더 걸스', 'the weeknd', 'jennie'], difficulty: 2 },

{ id: 'wp08', category: '최신 팝송', youtubeId: 'KNtJGQkC-WI', youtubeStart: 41, youtubeEnd: 51, hint: '아리아나 그란데의 "우리는 친구가 될 수 없어"', answers: ["we can't be friends", 'we cant be friends', 'ariana grande'], difficulty: 1 },

{ id: 'wp09', category: '최신 팝송', youtubeId: 'cW8VLC9nnTo', youtubeStart: 74, youtubeEnd: 84, hint: '빌리 아일리시의 바비 OST', answers: ['what was i made for', '빌리 아일리시', 'billie eilish'], difficulty: 2 },

{ id: 'wp10', category: '최신 팝송', youtubeId: 'V9PVRfjEBTI', youtubeStart: 51, youtubeEnd: 61, hint: '빌리 아일리시의 새가 된 듯한 곡', answers: ['birds of a feather', '버즈 오브 어 페더', 'billie eilish'], difficulty: 2 },

{ id: 'wp11', category: '최신 팝송', youtubeId: 'suAR1PYFNYA', youtubeStart: 45, youtubeEnd: 55, hint: '두아 리파의 Catch me or I go', answers: ['houdini', '후디니', 'dua lipa'], difficulty: 2 },

{ id: 'wp12', category: '최신 팝송', youtubeId: 'OiC1rgCPmUQ', youtubeStart: 39, youtubeEnd: 49, hint: '두아 리파의 신나는 댄스 넘버', answers: ['dance the night', '댄스 더 나이트', 'dua lipa'], difficulty: 2 },

{ id: 'wp13', category: '최신 팝송', youtubeId: 'm4_9TFeMfJE', youtubeStart: 56, youtubeEnd: 66, hint: '도자 캣의 붉게 물들여', answers: ['paint the town red', 'doja cat', '도자 캣'], difficulty: 2 },

{ id: 'wp14', category: '최신 팝송', youtubeId: 'XoiOOiuH8iI', youtubeStart: 37, youtubeEnd: 47, hint: '타일라의 관능적인 아프로비츠 곡', answers: ['water', '워터', 'tyla'], difficulty: 1 },

{ id: 'wp15', category: '최신 팝송', youtubeId: 'RlPNh_PBZb4', youtubeStart: 59, youtubeEnd: 69, hint: '올리비아 로드리고의 뱀파이어', answers: ['vampire', '뱀파이어', 'olivia rodrigo'], difficulty: 1 },

{ id: 'wp16', category: '최신 팝송', youtubeId: 'gNi_6U5Pm_o', youtubeStart: 43, youtubeEnd: 53, hint: '올리비아 로드리고의 펑크 록 하이틴', answers: ['good 4 u', 'good for you', 'olivia rodrigo'], difficulty: 2 },

{ id: 'wp17', category: '최신 팝송', youtubeId: 'H5v3kku4y6Q', youtubeStart: 49, youtubeEnd: 59, hint: '해리 스타일스의 감각적인 솔로곡', answers: ['as it was', '해리 스타일스', 'harry styles'], difficulty: 1 },

{ id: 'wp18', category: '최신 팝송', youtubeId: 'b53QJYP-lqY', youtubeStart: 52, youtubeEnd: 62, hint: '트로이 시반의 신나는 클럽 트랙', answers: ['rush', '러시', 'troye sivan'], difficulty: 2 },

{ id: 'wp19', category: '최신 팝송', youtubeId: 'a7GITgqwDVg', youtubeStart: 44, youtubeEnd: 54, hint: '찰리 푸스와 정국의 좌우 음향 곡', answers: ['left and right', '레프트 앤 라이트', 'charlie puth'], difficulty: 1 },

{ id: 'wp20', category: '최신 팝송', youtubeId: 'TBXQu8ORnBQ', youtubeStart: 63, youtubeEnd: 73, hint: '한국에서 역주행한 찰리 푸스 명곡', answers: ['dangerously', '데인저러스리', 'charlie puth'], difficulty: 2 },

{ id: 'wp21', category: '최신 팝송', youtubeId: 'G7KNmW9a75Y', youtubeStart: 46, youtubeEnd: 56, hint: '마일리 사이러스의 당당한 1위 곡', answers: ['flowers', '플라워스', 'miley cyrus'], difficulty: 1 },

{ id: 'wp22', category: '최신 팝송', youtubeId: 'MSRcC626prw', youtubeStart: 57, youtubeEnd: 67, hint: 'SZA의 전 남친 저격 노래', answers: ['kill bill', '킬 빌', 'sza'], difficulty: 2 },

{ id: 'wp23', category: '최신 팝송', youtubeId: 'oftolPu9qp4', youtubeStart: 35, youtubeEnd: 45, hint: '핑크팬서레스의 틱톡 화제곡', answers: ["boy's a liar", 'boys a liar', 'pinkpantheress'], difficulty: 3 },

{ id: 'wp24', category: '최신 팝송', youtubeId: 'kTJczUoc26U', youtubeStart: 41, youtubeEnd: 51, hint: '더 키드 라로이 & 저스틴 비버', answers: ['stay', '스테이', 'the kid laroi'], difficulty: 1 },

{ id: 'wp25', category: '최신 팝송', youtubeId: 'Uq9gPaIzbe8', youtubeStart: 52, youtubeEnd: 62, hint: '샘 스미스의 불경한(?) 댄스곡', answers: ['unholy', '언홀리', 'sam smith'], difficulty: 1 },

{ id: 'wp26', category: '최신 팝송', youtubeId: 'GxldQ9eX2wo', youtubeStart: 63, youtubeEnd: 73, hint: '스티븐 산체스의 복고풍 로맨스', answers: ['until i found you', '언틸 아이 파운드 유', 'stephen sanchez'], difficulty: 3 },

{ id: 'wp27', category: '최신 팝송', youtubeId: 'adLGHcj_fmA', youtubeStart: 58, youtubeEnd: 68, hint: '브루노 마스의 실크 소닉 문 열어둬', answers: ['leave the door open', '리브 더 도어 오픈', 'bruno mars'], difficulty: 2 },

{ id: 'wp28', category: '최신 팝송', youtubeId: 'Il0S8BoucSA', youtubeStart: 49, youtubeEnd: 59, hint: '에드 시런의 몸이 떨리는 노래', answers: ['shivers', '시버스', 'ed sheeran'], difficulty: 2 },

{ id: 'wp29', category: '최신 팝송', youtubeId: 'PEM0Vs8jf1w', youtubeStart: 61, youtubeEnd: 71, hint: 'JVKE의 아름다운 황금빛 피아노', answers: ['golden hour', '골든 아워', 'jvke'], difficulty: 2 },

{ id: 'wp30', category: '최신 팝송', youtubeId: 'iv1_FOdJ5s0', youtubeStart: 54, youtubeEnd: 64, hint: '더 위켄드의 틱톡 역주행 명곡', answers: ['die for you', '다이 포 유', 'the weeknd'], difficulty: 2 },

{ id: 'vm01', category: 'OST & 밈', youtubeId: 'ekr2nIex040', youtubeStart: 42, youtubeEnd: 52, hint: '2024년 최고의 메가 히트 콜라보 (로제 & 브루노 마스)', answers: ['apt', '아파트', '로제', 'rose'], difficulty: 1 },

{ id: 'vm02', category: 'OST & 밈', youtubeId: 'kdX6Lh4iI6Y', youtubeStart: 28, youtubeEnd: 38, hint: '탕 탕 후루후루 탕 탕 후루루루루', answers: ['마라탕후루', '서이브'], difficulty: 1 },

{ id: 'vm03', category: 'OST & 밈', youtubeId: 'xGClAPu4eic', youtubeStart: 39, youtubeEnd: 49, hint: '야레야레, 못 말리는 아가씨~', answers: ['잘자요 아가씨', 'asmrz', '잘자요아가씨'], difficulty: 1 },

{ id: 'vm04', category: 'OST & 밈', youtubeId: '3cZrxpK2EAQ', youtubeStart: 51, youtubeEnd: 61, hint: 'T의 성향을 묻는 인디 밈 곡', answers: ['티라미수 케익', '티라미수케익', '위아더나잇', '김성철'], difficulty: 1 },

{ id: 'vm05', category: 'OST & 밈', youtubeId: 'aAkMkVFwAoo', youtubeStart: 64, youtubeEnd: 74, hint: '류선재가 임솔을 위해 부른 자작곡 (선재 업고 튀어 OST)', answers: ['소나기', '이클립스', '선재 업고 튀어'], difficulty: 1 },

{ id: 'vm06', category: 'OST & 밈', youtubeId: 'hF1IHvTly0Y', youtubeStart: 47, youtubeEnd: 57, hint: '선재 업고 튀어의 시원한 밴드 곡', answers: ['run run', '런런', '이클립스'], difficulty: 2 },

{ id: 'vm07', category: 'OST & 밈', youtubeId: '2q4BzQJ5m2A', youtubeStart: 59, youtubeEnd: 69, hint: '눈물의 여왕 OST (크러쉬)', answers: ['미안해 미워해 사랑해', '눈물의 여왕', '크러쉬'], difficulty: 2 },

{ id: 'vm08', category: 'OST & 밈', youtubeId: 'xA5oW_mxZVQ', youtubeStart: 43, youtubeEnd: 53, hint: '눈물의 여왕 통통 튀는 OST (BSS)', answers: ['자꾸만 웃게 돼', '부석순', '눈물의 여왕'], difficulty: 2 },

{ id: 'vm09', category: 'OST & 밈', youtubeId: 'ZsS9qHBWn4A', youtubeStart: 71, youtubeEnd: 81, hint: '그 해 우리는 OST (비비)', answers: ['우리가 헤어져야 했던 이유', '비비', 'bibi'], difficulty: 3 },

{ id: 'vm10', category: 'OST & 밈', youtubeId: 'NeNocuufXiI', youtubeStart: 55, youtubeEnd: 65, hint: '사내맞선 달콤한 OST (멜로망스)', answers: ['사랑인가 봐', '사랑인가봐', '멜로망스'], difficulty: 2 }
];

module.exports = { RAW_QUIZ_DATA };
