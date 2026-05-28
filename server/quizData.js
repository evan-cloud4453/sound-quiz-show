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
  }
];

module.exports = { RAW_QUIZ_DATA };
