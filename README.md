# 🎵 Sound Catch (사운드 캐치)
실시간 멀티플레이 사운드 퀴즈쇼 웹 게임

---

## 📁 프로젝트 구조

```
sound-quiz-show/
├── server/          ← Node.js + Socket.io 서버
│   ├── index.js     ← 메인 서버 (게임 로직 전체 포함)
│   ├── package.json
│   └── .env.example
├── client/          ← React + Vite 프론트엔드
│   ├── src/
│   │   ├── App.jsx              ← 라우터
│   │   ├── main.jsx
│   │   ├── styles/global.css    ← 전체 디자인 시스템
│   │   ├── hooks/useSocket.js   ← Socket.io 훅
│   │   ├── utils/GameContext.jsx ← 전역 게임 상태
│   │   ├── pages/
│   │   │   ├── TitleScreen.jsx  ← 메인 화면
│   │   │   ├── LobbyScreen.jsx  ← 대기실
│   │   │   ├── GameScreen.jsx   ← 게임 화면
│   │   │   └── GameOverScreen.jsx ← 결과 화면
│   │   └── components/
│   │       ├── WaveformVisualizer.jsx ← 오디오 시각화
│   │       ├── TimerRing.jsx    ← 타이머 SVG
│   │       ├── Confetti.jsx     ← 폭죽 효과
│   │       └── SystemToast.jsx  ← 알림 토스트
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── package.json     ← 루트 편의 스크립트
```

---

## 🚀 로컬 개발 시작하기

### 1. 저장소 클론
```bash
git clone https://github.com/YOUR_USERNAME/sound-quiz-show.git
cd sound-quiz-show
```

### 2. 패키지 설치
```bash
# 루트에서 한 번에 설치
npm run install:all

# 또는 개별 설치
cd server && npm install
cd ../client && npm install
```

### 3. 환경 변수 설정

**서버 (`server/.env`)**
```
PORT=3001
CLIENT_URL=http://localhost:5173
```

**클라이언트 (`client/.env`)**
```
VITE_SERVER_URL=http://localhost:3001
```

### 4. 개발 서버 실행 (터미널 2개)
```bash
# 터미널 1 - 서버
npm run dev:server

# 터미널 2 - 클라이언트
npm run dev:client
```

브라우저에서 `http://localhost:5173` 접속 ✅

---

## ☁️ 배포 가이드

### 방법 A: Render.com (서버) + Vercel (클라이언트) ← **추천**

#### 서버 → Render.com

1. [render.com](https://render.com) 가입 후 **New → Web Service** 클릭
2. GitHub 저장소 연결
3. 설정:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
   - **Environment**: Node
4. **Environment Variables** 추가:
   ```
   PORT=10000
   CLIENT_URL=https://YOUR_APP.vercel.app
   ```
5. Deploy → 생성된 URL 복사 (예: `https://sound-quiz-xxx.onrender.com`)

> ⚠️ Render 무료 플랜은 15분 비활성 시 슬립 상태가 됩니다.
> 유지하려면 [UptimeRobot](https://uptimerobot.com) 등으로 헬스체크 URL을 5분마다 ping 설정하세요:
> `https://sound-quiz-xxx.onrender.com/health`

#### 클라이언트 → Vercel

1. [vercel.com](https://vercel.com) 가입 후 **New Project** → GitHub 저장소 선택
2. 설정:
   - **Root Directory**: `client`
   - **Framework Preset**: Vite (자동 감지됨)
3. **Environment Variables** 추가:
   ```
   VITE_SERVER_URL=https://sound-quiz-xxx.onrender.com
   ```
4. Deploy → 완료!

---

### 방법 B: Railway (서버 + 클라이언트 통합)

1. [railway.app](https://railway.app) 가입
2. **New Project → Deploy from GitHub repo**
3. 서버와 클라이언트를 별도 서비스로 추가
4. 환경 변수 동일하게 설정

---

### 방법 C: Render.com 하나로 통합 (정적 파일 서빙)

`server/index.js` 하단에 다음 추가:
```js
// 빌드된 클라이언트 정적 파일 서빙
const path = require('path')
app.use(express.static(path.join(__dirname, '../client/dist')))
app.get('*', (_, res) => res.sendFile(path.join(__dirname, '../client/dist/index.html')))
```

Render Build Command:
```bash
npm install --prefix server && npm install --prefix client && npm run build --prefix client
```

---

## 🎵 퀴즈 데이터 추가하기

`server/index.js` 상단의 `QUIZ_DATA` 배열에 추가:

```js
{
  id: 'q011',
  category: '영화',           // 카테고리명
  audioUrl: 'https://...mp3', // 공개 MP3 URL (S3, CDN 등)
  hint: '어벤져스 배경음악',   // 힌트 (옵션)
  answers: ['어벤져스', 'avengers', '아이언맨'],  // 정답 배열
  difficulty: 2              // 1~3
}
```

### 음원 파일 호스팅 방법

**옵션 1: AWS S3 (추천)**
```bash
# AWS CLI로 업로드
aws s3 cp my-sound.mp3 s3://your-bucket/sounds/ --acl public-read
# URL: https://your-bucket.s3.amazonaws.com/sounds/my-sound.mp3
```

**옵션 2: Cloudflare R2 (무료 tier 넉넉)**
- Cloudflare Dashboard → R2 → 버킷 생성 → 파일 업로드 → 공개 URL 복사

**옵션 3: GitHub Releases (소규모)**
- 저장소 → Releases → 드래프트 생성 → 음원 파일 첨부
- URL: `https://github.com/USER/REPO/releases/download/v1.0/sound.mp3`

---

## 🧠 스마트 채점 알고리즘 설명

`server/index.js`의 `smartGrade()` 함수가 담당:

```
1단계: 전처리
  - 공백, 특수문자 제거
  - 소문자 변환
  예) "겨울 왕국!" → "겨울왕국"

2단계: 완전 일치 검사
  - 전처리된 제출 답안 vs 정답 배열 각각 비교

3단계: 유사도 검사 (오타 보정)
  - Levenshtein Distance 알고리즘
  - 3글자 이상 단어에서 유사도 80% 이상이면 정답 인정
  예) "겨울와국" → "겨울왕국" (1글자 오차) → 정답 ✅
```

---

## 🎮 게임 규칙

| 상황 | 점수 |
|------|------|
| 가장 먼저 정답 맞힌 1명 | +1점 |
| 15초 내 아무도 못 맞춤 | 모든 플레이어 +1점 |
| 틀린 답 제출 | 재도전 가능 (제한 시간 내) |

목표 점수(기본 5점)에 먼저 도달한 플레이어가 우승!

---

## 🔧 WebSocket 이벤트 명세

### Client → Server
| 이벤트 | 데이터 | 설명 |
|--------|--------|------|
| `join_room` | `{ nickname, roomCode? }` | 방 생성/참가 |
| `start_game` | `{ targetScore }` | 게임 시작 (방장만) |
| `submit_answer` | `{ answer }` | 정답 제출 |

### Server → Client
| 이벤트 | 데이터 | 설명 |
|--------|--------|------|
| `room_update` | `{ players, hostId, status, ... }` | 방 상태 갱신 |
| `game_started` | `{ totalRounds, targetScore }` | 게임 시작 신호 |
| `round_start` | `{ round, category, hint, audioUrl, timeLimit }` | 라운드 시작 |
| `answer_result` | `{ correct, winnerId, answer, scores, ... }` | 채점 결과 |
| `game_over` | `{ winner, finalScores }` | 게임 종료 |
| `system_message` | `{ text }` | 시스템 알림 |

---

## 🛠️ 커스터마이징

### 게임 설정 변경 (`server/index.js`)
```js
// 라운드당 제한 시간 (초)
timeLimit: 15   // 변경 가능

// 목표 점수 선택지 (클라이언트 LobbyScreen.jsx)
{[3, 5, 7, 10, 15, 20].map(s => ...)}

// 최대 플레이어 수
if (room.players.length >= 8) ...  // 변경 가능
```

### 테마 색상 변경 (`client/src/styles/global.css`)
```css
:root {
  --purple-core: #7c3aed;  /* 메인 보라 */
  --cyan-core:   #06b6d4;  /* 포인트 청록 */
  --pink-core:   #ec4899;  /* 포인트 핑크 */
}
```

---

## 📝 TODO / 확장 아이디어

- [ ] MongoDB Atlas 연동으로 퀴즈 DB 분리
- [ ] 관리자 페이지 (퀴즈 CRUD)
- [ ] 카테고리별 필터링
- [ ] 난이도 선택 기능
- [ ] 플레이어 통계 (총 게임 수, 승률)
- [ ] 특수 라운드 (1대1 대결, 힌트 없음 모드)
- [ ] 모바일 전용 UI 최적화
- [ ] 음성 채팅 (WebRTC)

---

## 🐛 트러블슈팅

**Q: "서버 연결 중..." 에서 멈춰요**
→ 서버가 실행 중인지 확인. `client/.env`의 `VITE_SERVER_URL`이 올바른지 확인.

**Q: Render 배포 후 WebSocket 연결 안 됨**
→ Render 대시보드 → 서비스 설정 → "WebSocket Support" 활성화 확인.

**Q: 오디오가 재생되지 않아요**
→ 브라우저 자동 재생 정책으로 인해 사용자 클릭 후 최초 재생 필요.
→ CORS 허용된 공개 URL인지 확인.

**Q: CORS 오류가 발생해요**
→ `server/index.js`의 `CLIENT_URL` 환경 변수가 프론트엔드 URL과 정확히 일치하는지 확인 (trailing slash 없이).
