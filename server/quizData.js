// ============================================================
// server/quizData.js  — 50문제 정의 (Spotify Track ID 기반)
// ============================================================
// preview_url은 서버 시작 시 Spotify API로 자동 조회됩니다.
// Track ID는 Spotify 곡 링크의 마지막 부분:
//   https://open.spotify.com/track/[TRACK_ID]
 
const RAW_QUIZ_DATA = [
 
  // ── 한국 드라마 OST ─────────────────────────────────────
  {
    id: 'k001', category: '한국 드라마 OST',
    trackId: '4MzJMcHqBl9UQoqmiZct0i', // 태양의 후예 - Always (Yoon Mi Rae)
    hint: '2016년 대히트 군인 드라마',
    answers: ['태양의 후예', '태양의후예', 'descendants of the sun'],
    difficulty: 1
  },
  {
    id: 'k002', category: '한국 드라마 OST',
    trackId: '0gRqaEXOPwKJNPCmqEtFSh', // 도깨비 - Stay With Me (Chanyeol, Punch)
    hint: '불멸의 존재가 주인공인 판타지 드라마',
    answers: ['도깨비', 'goblin'],
    difficulty: 1
  },
  {
    id: 'k003', category: '한국 드라마 OST',
    trackId: '1aWcGCHBFRGcDLdRMfSRZ2', // 별에서 온 그대 - My Destiny
    hint: '외계인과 사람의 사랑 이야기',
    answers: ['별에서 온 그대', '별에서온그대', 'you who came from the stars', 'my love from the star'],
    difficulty: 2
  },
  {
    id: 'k004', category: '한국 드라마 OST',
    trackId: '5XRNmPMPBJCNGMhFLTRMZX', // 이태원 클라쓰
    hint: '작은 포차에서 시작하는 복수극',
    answers: ['이태원 클라쓰', '이태원클라쓰', 'itaewon class'],
    difficulty: 2
  },
  {
    id: 'k005', category: '한국 드라마 OST',
    trackId: '3Ofmpyhv5UAQ70mENzB6wL', // 사랑의 불시착
    hint: '북한에 불시착한 재벌 여자와 군인의 사랑',
    answers: ['사랑의 불시착', '사랑의불시착', 'crash landing on you'],
    difficulty: 1
  },
  {
    id: 'k006', category: '한국 드라마 OST',
    trackId: '2grjqo0Frpf2okIBiifQKs', // 응답하라 1988
    hint: '쌍문동 골목 친구들의 청춘 이야기',
    answers: ['응답하라 1988', '응답하라1988', 'reply 1988'],
    difficulty: 2
  },
  {
    id: 'k007', category: '한국 드라마 OST',
    trackId: '1Ck2DaFJpFLreivPpBMFkk', // 미스터 션샤인
    hint: '구한말 시대 배경의 역사 드라마',
    answers: ['미스터 션샤인', '미스터션샤인', 'mr sunshine'],
    difficulty: 2
  },
  {
    id: 'k008', category: '한국 드라마 OST',
    trackId: '5nCi3BB41mBaMqGrjpGpqj', // 스물다섯 스물하나
    hint: '1998년 IMF 시절 두 남녀의 성장 이야기',
    answers: ['스물다섯 스물하나', '스물다섯스물하나', '25 21'],
    difficulty: 2
  },
  {
    id: 'k009', category: '한국 드라마 OST',
    trackId: '45gMPpxJD3eSKAZrJdBZaU', // 킹덤
    hint: '조선시대 좀비 드라마',
    answers: ['킹덤', 'kingdom'],
    difficulty: 3
  },
  {
    id: 'k010', category: '한국 드라마 OST',
    trackId: '4PCdDMUTws5g8llRtBiUiE', // 오징어 게임
    hint: '넷플릭스 세계적 히트 서바이벌 드라마',
    answers: ['오징어 게임', '오징어게임', 'squid game'],
    difficulty: 1
  },
 
  // ── 한국 인기가요 ────────────────────────────────────────
  {
    id: 'p001', category: '한국 인기가요',
    trackId: '6naxalmIoLFWR0siv8dnQQ', // BTS - Dynamite
    hint: 'BTS의 영어 곡, 전 세계 1위',
    answers: ['다이너마이트', 'dynamite', 'bts'],
    difficulty: 1
  },
  {
    id: 'p002', category: '한국 인기가요',
    trackId: '0yLdNVWF3Srea0uzk55zFn', // 아이유 - 좋은 날
    hint: '아이유의 3단 고음으로 유명한 노래',
    answers: ['좋은 날', '좋은날', 'good day', '아이유'],
    difficulty: 1
  },
  {
    id: 'p003', category: '한국 인기가요',
    trackId: '3DYVWvPh3kGzFmFZFEzjKi', // BLACKPINK - DDU-DU DDU-DU
    hint: '블랙핑크의 대표곡',
    answers: ['뚜두뚜두', 'ddu-du ddu-du', '블랙핑크', 'blackpink'],
    difficulty: 1
  },
  {
    id: 'p004', category: '한국 인기가요',
    trackId: '1bDbXMyjaUIooNwFE9wn0N', // PSY - 강남스타일
    hint: '전 세계를 강타한 말춤 노래',
    answers: ['강남스타일', 'gangnam style', '싸이', 'psy'],
    difficulty: 1
  },
  {
    id: 'p005', category: '한국 인기가요',
    trackId: '7qiZfU4dY1lWllzX7mPBI3', // EXO - 으르렁
    hint: 'EXO의 으르렁거리는 노래',
    answers: ['으르렁', 'growl', '엑소', 'exo'],
    difficulty: 2
  },
  {
    id: 'p006', category: '한국 인기가요',
    trackId: '4habFh9zMsGxGKJB5GaGFd', // NewJeans - Hype Boy
    hint: '뉴진스의 데뷔곡',
    answers: ['하입보이', 'hype boy', '뉴진스', 'newjeans'],
    difficulty: 1
  },
  {
    id: 'p007', category: '한국 인기가요',
    trackId: '2KslE17cAJNHTsI2MI0jb2', // TWICE - CHEER UP
    hint: '트와이스의 샤샤샤 노래',
    answers: ['치얼업', 'cheer up', '트와이스', 'twice'],
    difficulty: 1
  },
  {
    id: 'p008', category: '한국 인기가요',
    trackId: '2MBXsNt8kbFISIuqsZRUbP', // 방탄소년단 - DNA
    hint: 'BTS의 DNA',
    answers: ['dna', '디엔에이', 'bts', '방탄소년단'],
    difficulty: 2
  },
  {
    id: 'p009', category: '한국 인기가요',
    trackId: '5AvwZVawapvyhJUIx71pdJ', // aespa - Next Level
    hint: '에스파의 넥스트 레벨',
    answers: ['넥스트 레벨', 'next level', '에스파', 'aespa'],
    difficulty: 2
  },
  {
    id: 'p010', category: '한국 인기가요',
    trackId: '3Kkjo3cT83cw98myxMoBHv', // 싸이 - 나팔바지
    hint: '싸이의 흠뻑쇼 대표곡',
    answers: ['나팔바지', '싸이', 'psy'],
    difficulty: 3
  },
  {
    id: 'p011', category: '한국 인기가요',
    trackId: '0V3wPSX9ygBnCm8psDIegu', // 빅뱅 - 판타스틱 베이비
    hint: '빅뱅의 WOW FANTASTIC BABY',
    answers: ['판타스틱 베이비', 'fantastic baby', '빅뱅', 'bigbang'],
    difficulty: 1
  },
  {
    id: 'p012', category: '한국 인기가요',
    trackId: '6UelLqGlWMcVH1E5c4H7lY', // 방탄소년단 - Boy With Luv
    hint: 'BTS X 할시 컬래버레이션',
    answers: ['작은 것들을 위한 시', 'boy with luv', 'bts'],
    difficulty: 2
  },
  {
    id: 'p013', category: '한국 인기가요',
    trackId: '2dpaYNEQHiRxtZbfNsse99', // 아이유 - Eight
    hint: '아이유 X 슈가 콜라보',
    answers: ['에잇', 'eight', '아이유', 'iu'],
    difficulty: 2
  },
  {
    id: 'p014', category: '한국 인기가요',
    trackId: '6MWoGeGdVL3mBbS7rHHGBL', // Stray Kids - MIROH
    hint: '스트레이 키즈의 마이로',
    answers: ['미로', 'miroh', '스트레이 키즈', 'stray kids'],
    difficulty: 3
  },
  {
    id: 'p015', category: '한국 인기가요',
    trackId: '0pqnGHJpmpxLKifKRmU6WP', // SEVENTEEN - VERY NICE
    hint: '세븐틴의 아주 Nice',
    answers: ['아주 나이스', 'very nice', '세븐틴', 'seventeen'],
    difficulty: 3
  },
 
  // ── 해외 팝송 ────────────────────────────────────────────
  {
    id: 'w001', category: '해외 팝송',
    trackId: '4cOdK2wGLETKBW3PvgPWqT', // Ed Sheeran - Shape of You
    hint: 'Ed Sheeran의 전 세계 1위 곡',
    answers: ['shape of you', '에드 시런', 'ed sheeran'],
    difficulty: 1
  },
  {
    id: 'w002', category: '해외 팝송',
    trackId: '3n3Ppam7vgaVa1iaRUIOKE', // The Weeknd - Blinding Lights
    hint: '80년대 신스팝 느낌의 더 위켄드 곡',
    answers: ['blinding lights', '블라인딩 라이츠', 'the weeknd'],
    difficulty: 1
  },
  {
    id: 'w003', category: '해외 팝송',
    trackId: '0VjIjW4GlUZAMYd2vXMi3b', // The Weeknd - Starboy
    hint: '다프트 펑크와 함께한 더 위켄드 곡',
    answers: ['starboy', '스타보이', 'the weeknd'],
    difficulty: 2
  },
  {
    id: 'w004', category: '해외 팝송',
    trackId: '7MXVkk9YMctZqd1Srtv4MB', // Sia - Cheap Thrills
    hint: 'Sia의 돈 없어도 즐거운 노래',
    answers: ['cheap thrills', '칩 스릴스', 'sia'],
    difficulty: 1
  },
  {
    id: 'w005', category: '해외 팝송',
    trackId: '2dLLR6qlu5UJ5gk0dKIFcJ', // Harry Styles - As It Was
    hint: '해리 스타일스의 솔로 대표곡',
    answers: ['as it was', '해리 스타일스', 'harry styles'],
    difficulty: 1
  },
  {
    id: 'w006', category: '해외 팝송',
    trackId: '6Qyc6fS4DsZjB2mRW9DsQs', // Olivia Rodrigo - drivers license
    hint: '올리비아 로드리고의 데뷔 싱글',
    answers: ['drivers license', '드라이버스 라이센스', 'olivia rodrigo'],
    difficulty: 2
  },
  {
    id: 'w007', category: '해외 팝송',
    trackId: '5HCyWlXZPP0y6Gqq8TgA20', // Adele - Rolling in the Deep
    hint: '아델의 복수심 가득한 노래',
    answers: ['rolling in the deep', '롤링 인 더 딥', 'adele', '아델'],
    difficulty: 1
  },
  {
    id: 'w008', category: '해외 팝송',
    trackId: '1dGr1c8CrMLDpV6mPbImSI', // Ariana Grande - Thank U, Next
    hint: '전 남자친구들에게 감사하는 노래',
    answers: ['thank u next', 'thank you next', '아리아나 그란데', 'ariana grande'],
    difficulty: 1
  },
  {
    id: 'w009', category: '해외 팝송',
    trackId: '2takcwOaAZWiXQijPHIx7B', // Taylor Swift - Anti-Hero
    hint: '테일러 스위프트의 It\'s me, hi',
    answers: ['anti hero', 'anti-hero', '테일러 스위프트', 'taylor swift'],
    difficulty: 1
  },
  {
    id: 'w010', category: '해외 팝송',
    trackId: '6I9VzXrHxO9rA9A5euc8Ak', // Billie Eilish - bad guy
    hint: '빌리 아일리시의 duh~',
    answers: ['bad guy', '배드 가이', '빌리 아일리시', 'billie eilish'],
    difficulty: 1
  },
  {
    id: 'w011', category: '해외 팝송',
    trackId: '7qEHsqek33rTcFNT9PFqLf', // Shawn Mendes - Stitches
    hint: '숀 멘데스의 상처 노래',
    answers: ['stitches', '스티치스', 'shawn mendes'],
    difficulty: 2
  },
  {
    id: 'w012', category: '해외 팝송',
    trackId: '2iuZJX9X9P7GJ9mNTcA5Bl', // Justin Bieber - Sorry
    hint: '저스틴 비버의 미안하다는 노래',
    answers: ['sorry', '저스틴 비버', 'justin bieber'],
    difficulty: 1
  },
  {
    id: 'w013', category: '해외 팝송',
    trackId: '6K4t31amVTZDgR3sKmwUJJ', // The Chainsmokers - Closer
    hint: '체인스모커스 X 홀지',
    answers: ['closer', '클로저', 'the chainsmokers', 'chainsmokers'],
    difficulty: 2
  },
  {
    id: 'w014', category: '해외 팝송',
    trackId: '6habFh9zMsGxGKJB5GaGFd', // Dua Lipa - Levitating
    hint: '두아 리파의 우주적인 노래',
    answers: ['levitating', '레비테이팅', 'dua lipa', '두아 리파'],
    difficulty: 1
  },
  {
    id: 'w015', category: '해외 팝송',
    trackId: '32OlwWuMpZ6b0aN2RZOeMS', // Uptown Funk - Bruno Mars
    hint: '브루노 마스의 업타운 펑크',
    answers: ['uptown funk', '업타운 펑크', 'bruno mars', '브루노 마스'],
    difficulty: 1
  },
 
  // ── 한국 영화 OST ────────────────────────────────────────
  {
    id: 'm001', category: '한국 영화 OST',
    trackId: '1BkfxLRHPfPvvAYs1JKFLB', // 기생충 OST
    hint: '2019 칸 영화제 황금종려상 수상 영화',
    answers: ['기생충', 'parasite'],
    difficulty: 2
  },
  {
    id: 'm002', category: '한국 영화 OST',
    trackId: '6ADCWpKRRFkwKzdiZMpqOz', // 건축학개론
    hint: '첫사랑을 다룬 로맨스 영화',
    answers: ['건축학개론', 'architecture 101'],
    difficulty: 3
  },
  {
    id: 'm003', category: '한국 영화 OST',
    trackId: '0sf12qNH5Si5YsBjCNHnJp', // 써니
    hint: '80년대 여고생들의 우정 이야기',
    answers: ['써니', 'sunny'],
    difficulty: 2
  },
  {
    id: 'm004', category: '한국 영화 OST',
    trackId: '4xkOaSrkexMciUUogZKVTS', // 신과함께
    hint: '저승 삼차사와 함께하는 심판 이야기',
    answers: ['신과 함께', '신과함께', 'along with the gods'],
    difficulty: 2
  },
  {
    id: 'm005', category: '한국 영화 OST',
    trackId: '3FABhkpnGcRFBZiZWAinc0', // 극한직업
    hint: '치킨집을 운영하는 마약반 형사들',
    answers: ['극한직업', 'extreme job'],
    difficulty: 3
  },
 
  // ── 해외 영화/애니 OST ───────────────────────────────────
  {
    id: 'a001', category: '영화/애니 OST',
    trackId: '7FIWs6a8yOEL9BW7HKYZBS', // 겨울왕국 - Let It Go
    hint: '눈의 여왕이 부르는 노래',
    answers: ['렛잇고', 'let it go', '겨울왕국', 'frozen'],
    difficulty: 1
  },
  {
    id: 'a002', category: '영화/애니 OST',
    trackId: '6M14BiCN00nOsba4JaYsHW', // 라이온킹 - Circle of Life
    hint: '아프리카 초원의 왕 이야기',
    answers: ['라이온킹', 'lion king', 'circle of life'],
    difficulty: 1
  },
  {
    id: 'a003', category: '영화/애니 OST',
    trackId: '1E2WTcYLP1dFe1tiGDwRmT', // 인터스텔라 OST
    hint: '크리스토퍼 놀란 감독의 우주 영화',
    answers: ['인터스텔라', 'interstellar'],
    difficulty: 2
  },
  {
    id: 'a004', category: '영화/애니 OST',
    trackId: '3skn2lauGk7Zdgo4WsDNGn', // 토이스토리 - You've Got a Friend in Me
    hint: '장난감들의 우정 이야기',
    answers: ['토이스토리', 'toy story', "you've got a friend in me"],
    difficulty: 1
  },
  {
    id: 'a005', category: '영화/애니 OST',
    trackId: '4u7EnebtmKWzUH433cf5Qv', // 해리포터 OST
    hint: '마법사 학교 호그와트 이야기',
    answers: ['해리포터', 'harry potter', 'hedwigs theme'],
    difficulty: 1
  },
  {
    id: 'a006', category: '영화/애니 OST',
    trackId: '0qcr5FMsEO85NAQjrlDRKo', // 보헤미안 랩소디 - We Will Rock You
    hint: '퀸의 전기 영화',
    answers: ['보헤미안 랩소디', 'bohemian rhapsody', '퀸', 'queen'],
    difficulty: 1
  },
  {
    id: 'a007', category: '영화/애니 OST',
    trackId: '6EcFDrRCUgTFuJiQVQQIAg', // 어벤져스
    hint: '마블 히어로들의 집합',
    answers: ['어벤져스', 'avengers'],
    difficulty: 1
  },
  {
    id: 'a008', category: '영화/애니 OST',
    trackId: '3CLSHJv5aUROAN2vfOyCOh', // 라라랜드 - City of Stars
    hint: '재즈 피아니스트와 배우 지망생의 사랑',
    answers: ['라라랜드', 'la la land', 'city of stars'],
    difficulty: 2
  },
  {
    id: 'a009', category: '영화/애니 OST',
    trackId: '1BkfxLRHPfPvvAYs1JKFLB', // 스파이더맨
    hint: '거미줄을 타는 히어로',
    answers: ['스파이더맨', 'spider-man', 'spiderman'],
    difficulty: 1
  },
  {
    id: 'a010', category: '영화/애니 OST',
    trackId: '1rfofaqEpACxVEHIZBJe6W', // 탑건 매버릭
    hint: '전투기 파일럿의 이야기, 2022년 속편',
    answers: ['탑건', 'top gun', '탑건 매버릭', 'top gun maverick'],
    difficulty: 2
  }
];
 
module.exports = { RAW_QUIZ_DATA };
