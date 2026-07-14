// sever/index.js

const BONUS_PROB     = 0.4   // 보너스 퀴즈 발동 확률
const BONUS_MAX      = 2      // 게임당 최대 발동 횟수
const BONUS_MIN_DIFF = 2      // 보너스 대상 최소 난이도

require('dotenv').config();
const express = require('express');
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');
const cors = require('cors');

const app    = express();
const server = http.createServer(app);

const CLIENT_URL       = process.env.CLIENT_URL || 'http://localhost:5173';
const ROUND_COUNT      = 10;
const ROUND_TIME_LIMIT = 15; // music_started 수신 후 정답 입력 시간 (초)
const READY_GRACE_MS   = 4000; // ★ 첫 클라 음악 시작 후, 나머지 클라를 기다리는 최대 시간
const RECONNECT_GRACE_MS = 120000; // ★ 연결 끊김 후 재접속 유예 시간 (2분). 3분 원하면 180000

const io = new Server(server, {
  cors: {
    origin: [CLIENT_URL, /\.vercel\.app$/, /\.netlify\.app$/],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());
app.get('/health', (_, res) => res.json({ status: 'ok', uptime: process.uptime() }));
app.get('/',       (_, res) => res.json({ name: 'Sound Quiz Show Server', version: '1.0.0' }));

// ── 퀴즈 데이터 ───────────────────────────────────────────────
const { RAW_QUIZ_DATA } = require('./quizData');

const QUIZ_DATA = RAW_QUIZ_DATA.map(q => ({
  ...q,
  youtubeId:    q.youtubeId    || null,
  youtubeStart: Number(q.youtubeStart ?? q.start ?? 0),
  youtubeEnd:   Number(q.youtubeEnd   ?? q.end   ?? 0)
}));

let VALIDATED_QUIZ_DATA = [];

// 설정창에서 고를 수 있는 주제 목록 (원본 데이터 기준, 항상 사용 가능)
const ALL_CATEGORIES = [...new Set(QUIZ_DATA.map(q => q.category))];

// oEmbed로 영상 유효성 확인.
//  ★ fail-open: '확실히 없는' 경우(400 잘못된ID / 401 비공개 / 404 삭제)만 제외하고,
//    429/403(레이트리밋)·5xx·타임아웃·네트워크오류 등 일시적 실패는 '유지'한다.
//    (예전엔 200이 아니면 전부 제외 → throttle 걸린 멀쩡한 영상까지 대량 오탈락)
function checkYouTubeValid(youtubeId) {
  return new Promise((resolve) => {
    const url = `https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v=${youtubeId}`;
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      res.resume(); // 응답 본문 폐기(소켓 해제)
      const code = res.statusCode;
      resolve(!(code === 400 || code === 401 || code === 404)); // 확실히 없는 것만 false
    });
    req.on('error', () => resolve(true));                 // 네트워크 오류 → 유지
    req.setTimeout(8000, () => { req.destroy(); resolve(true); }); // 타임아웃 → 유지
  });
}

async function preCheckQuestions() {
  console.log('🔍 유튜브 링크 유효성 검사 중...');
  const base = QUIZ_DATA.filter(q => q.youtubeId && q.youtubeId.length >= 10);

  // ★ 같은 영상은 한 번만 검사(중복 요청 폭주 방지) + 동시 요청 수 제한(배치)
  const uniqueIds = [...new Set(base.map(q => q.youtubeId))];
  const statusMap = new Map();
  const CONCURRENCY = 12;
  for (let i = 0; i < uniqueIds.length; i += CONCURRENCY) {
    const chunk = uniqueIds.slice(i, i + CONCURRENCY);
    const oks = await Promise.all(chunk.map(id => checkYouTubeValid(id)));
    chunk.forEach((id, j) => statusMap.set(id, oks[j]));
  }

  VALIDATED_QUIZ_DATA = base.filter(q => {
    const ok = statusMap.get(q.youtubeId);
    if (!ok) console.log(`❌ 제외: ${q.youtubeId} (${q.answers[0]})`);
    return ok;
  });
  console.log(`✅ 유효 문제 ${VALIDATED_QUIZ_DATA.length}개 준비 완료 (고유 영상 ${uniqueIds.length}개 검사)`);
}

preCheckQuestions();

// ── 유틸 ─────────────────────────────────────────────────────
const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function getRandomQuestions(count = 10, categories = [], seenCounts = null) {
  // 선택한 주제만 필터링. 선택이 없거나 결과가 0개면 전체에서 출제.
  let pool = VALIDATED_QUIZ_DATA;
  if (Array.isArray(categories) && categories.length > 0) {
    const set = new Set(categories);
    const filtered = VALIDATED_QUIZ_DATA.filter(q => set.has(q.category));
    if (filtered.length > 0) pool = filtered;
  }

  // ★ LFU(least-frequently-used) 선택:
  //   방에서 '적게 나온 문제'부터 뽑는다. 같은 횟수끼리는 랜덤.
  //   → 풀 전체를 한 바퀴 돌기 전엔 재등장 없음. 풀이 작아도 절대 고갈되지 않음.
  //   seenCounts 는 방 단위 Map(문제id → 나온 횟수), 방이 사라지면 함께 소멸.
  const seen = seenCounts instanceof Map ? seenCounts : new Map();
  const shuffled = [...pool].sort(() => Math.random() - 0.5);         // 1) 먼저 랜덤 섞기
  shuffled.sort((a, b) => (seen.get(a.id) || 0) - (seen.get(b.id) || 0)); // 2) 안정정렬: 적게 나온 순 (동률은 랜덤 유지)
  return shuffled.slice(0, Math.min(count, pool.length));
}

function normalise(text) {
  return text.toLowerCase().replace(/[\s\-_.,!?'"]/g, '').trim();
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

// ── 한글 음절 → 자모(초·중·종성) 분해 ──────────────────────────
//   음절 단위 편집거리는 오타 1개도 dist=1이라 지나치게 관대함.
//   자모로 풀면 "블랙핑크→블랙핑그"(ㅋ→ㄱ)는 거리 1로 관대하게,
//   음절이 통째로 바뀐 경우는 거리 2~3이 되어 걸러진다.
const HANGUL_CHO  = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const HANGUL_JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
const HANGUL_JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

function decomposeHangul(str) {
  let out = '';
  for (const ch of str) {
    const code = ch.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const s = code - 0xAC00;
      out += HANGUL_CHO[Math.floor(s / 588)]
           + HANGUL_JUNG[Math.floor((s % 588) / 28)]
           + HANGUL_JONG[s % 28];
    } else {
      out += ch;
    }
  }
  return out;
}

function smartGrade(submitted, answers) {
  const ns = normalise(submitted);
  if (!ns) return false;
  const nsJamo = decomposeHangul(ns);

  for (const ans of answers) {
    const na = normalise(ans);
    if (!na) continue;
    if (ns === na) return true;                    // 정규화 후 완전 일치

    const naJamo = decomposeHangul(na);
    if (nsJamo === naJamo) return true;            // 자모까지 동일

    // 자모 길이에 비례한 오타 허용치 (짧은 답일수록 엄격)
    const len = Math.max(naJamo.length, nsJamo.length);
    let allowed;
    if (len <= 4)      allowed = 0;                // 아주 짧은 답 → 정확 일치만
    else if (len <= 8) allowed = 1;                // 중간 길이 → 오타 1개까지
    else               allowed = Math.floor(len * 0.2); // 긴 답 → 20%까지

    if (allowed > 0 && levenshtein(nsJamo, naJamo) <= allowed) return true;
  }
  return false;
}

// ── 방장 식별 ──────────────────────────────────────────────────
//   socket.id 는 재접속할 때마다 바뀌므로 안정적인 pid(영구 토큰)로 소유 방장을 관리한다.
//   ★ '실효 방장(effective host)': 소유 방장이 접속 중이면 그대로,
//      끊겨 있는 동안엔 접속 중인 다른 플레이어가 임시로 방장 역할을 맡는다.
//      → 방장이 잠깐 끊겨도 방에는 늘 방장이 존재하고, 소유 방장이 돌아오면 자동 회복.
function ownerHostPlayer(room) {                       // pid로 지정된 소유 방장(끊겨 있을 수 있음)
  return room.players.find(p => p.pid === room.hostPid) || null;
}
function effectiveHostPlayer(room) {                    // 지금 실제로 방장 권한을 가진 접속자
  const owner = room.players.find(p => p.pid === room.hostPid && !p.disconnected);
  if (owner) return owner;
  return room.players.find(p => !p.disconnected) || null;
}
function isHost(room, socketId) {
  const eff = effectiveHostPlayer(room);
  return !!eff && eff.id === socketId;
}
// 소유 방장이 방에서 완전히 사라졌으면(나감/강퇴/유예만료) 접속자에게 소유권을 넘긴다.
function reassignHostIfNeeded(room) {
  if (!ownerHostPlayer(room)) {
    const next = room.players.find(p => !p.disconnected) || room.players[0];
    if (next) room.hostPid = next.pid;
  }
}
// 이름 호환(기존 호출부 유지용)
function hostPlayer(room) { return effectiveHostPlayer(room); }

function getRoomState(room) {
  const eff = effectiveHostPlayer(room);
  return {
    roomCode:      room.code,
    hostId:        eff ? eff.id : null,   // 현재 실효 방장의 소켓 id (클라 호환용)
    maxPlayers:    room.maxPlayers,     // ★ 방 최대 인원 (방 생성 시 5~15)
    players:       room.players.map(p => ({
      id: p.id, nickname: p.nickname,
      avatar: p.avatar,                // ★ 아바타 전달
      score: p.score, isReady: p.isReady,
      disconnected: !!p.disconnected,  // ★ 연결 끊김(유예중) 표시 → 클라에서 '대기중' 표시
      isHost: !!eff && p.id === eff.id
    })),
    status:        room.status,
    currentRound:  room.currentRound,
    totalRounds:   room.totalRounds,
    targetScore:   room.targetScore,
    roundCount:    room.roundCount,
    selectedCategories: room.selectedCategories || [],
    categories:    ALL_CATEGORIES, // 설정창용 주제 목록
    isTimerRunning: !!room.roundTimer // 💡 프론트엔드 타이머 애니메이션 트리거
  };
}

// ── 타이머 헬퍼 ───────────────────────────────────────────────
function clearRoomTimers(room) {
  clearTimeout(room.roundTimer);
  clearTimeout(room.fallbackTimer);
  clearTimeout(room.graceTimer);
  room.roundTimer    = null;
  room.fallbackTimer = null;
  room.graceTimer    = null;
}

function startRoundTimer(room) {
  if (room.roundTimer) return;

  clearTimeout(room.fallbackTimer);
  room.fallbackTimer = null;
  clearTimeout(room.graceTimer);
  room.graceTimer = null;

  const question = room.questions[room.currentRound - 1];

  room.roundTimer = setTimeout(() => {
    room.roundTimer = null;
    if (room.answeredThisRound) return;
    room.answeredThisRound = true;

    io.to(room.code).emit('answer_result', {
      correct:  false,
      noWinner: true,
      answer:   question?.answers?.[0] || '알 수 없음',
      message:  '시간 초과! 아무도 맞추지 못했습니다.',
      scores:   room.players.map(p => ({ id: p.id, nickname: p.nickname, score: p.score }))
    });

    setTimeout(() => checkEndOrNextRound(room), 2500);
  }, ROUND_TIME_LIMIT * 1000);

  io.to(room.code).emit('timer_start', { timeLimit: ROUND_TIME_LIMIT });
  io.to(room.code).emit('room_update', getRoomState(room)); // 💡 타이머 시작 즉시 상태 갱신
  console.log(`[타이머 시작] 방 ${room.code} 라운드 ${room.currentRound} — ${ROUND_TIME_LIMIT}초`);
}

// ── 소켓 이벤트 ───────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[접속] ${socket.id}`);

  socket.on('join_room', ({ nickname, roomCode, avatar, pid, maxPlayers }, cb) => {
    try {
      let room;
      let isNewRoom = false;

      if (roomCode) {
        room = rooms.get(roomCode.toUpperCase());
        if (!room)                      return cb({ error: '존재하지 않는 방 코드입니다.' });

        // ★ 끊겼다가(또는 '메인으로' 등으로 세션 없이) 같은 방에 다시 들어오는 본인:
        //   중복 추가하지 말고 기존 항목을 재바인딩(재접속 처리)한다. → 방장/인원 꼬임 방지
        const mine = room.players.find(p => p.pid === (pid || socket.id));
        if (mine) {
          const gt = room.disconnectTimers.get(mine.pid);
          if (gt) { clearTimeout(gt); room.disconnectTimers.delete(mine.pid); }
          mine.id = socket.id;
          mine.disconnected = false;
          if (nickname) mine.nickname = nickname;
          if (avatar)   mine.avatar = avatar;
          socket.join(room.code);
          socket.data.roomCode = room.code;
          socket.data.pid = mine.pid;
          socket.data.nickname = mine.nickname;
          reassignHostIfNeeded(room);
          io.to(room.code).emit('room_update', getRoomState(room));
          // 진행 단계에 맞는 화면 복구(진행 중/종료 화면)
          if (room.phase === 'gameover' && room.lastGameOver) socket.emit('game_over', room.lastGameOver);
          else if (room.phase === 'game') socket.emit('game_started', {
            totalRounds: room.questions.length, targetScore: room.targetScore, autoSkipOpening: true
          });
          return cb({ success: true, roomCode: room.code, isHost: isHost(room, socket.id) });
        }

        if (room.status === 'PLAYING')  return cb({ error: '이미 게임이 진행 중입니다.' });
        if (room.players.length >= room.maxPlayers) return cb({ error: `방이 가득 찼습니다. (최대 ${room.maxPlayers}명)` });
      } else {
        let code;
        do { code = generateRoomCode(); } while (rooms.has(code));
        room = {
          code,
          hostPid:              pid || socket.id,   // ★ 방장은 pid로 식별(재접속 안정)
          maxPlayers:           Math.max(5, Math.min(15, Number(maxPlayers) || 5)), // ★ 5~15, 기본 5
          players:              [],
          status:               'WAITING',
          currentRound:         0,
          totalRounds:          ROUND_COUNT,
          targetScore:          5,
          roundCount:           ROUND_COUNT,
          selectedCategories:   [],
          questions:            [],
          roundTimer:           null,
          fallbackTimer:        null,
          answeredThisRound:    false,
          firstCorrectPlayerId: null,
          musicStartedSockets:  new Set(),
          bonusUsed:            0,          // ★ 게임당 보너스 사용 횟수
          currentRoundBonus:    false,      // ★ 이번 라운드 보너스 여부
          phase:                'lobby',    // ★ lobby | game | gameover (재접속 복구용)
          lastGameOver:         null,       // ★ 마지막 game_over 페이로드 (복구 시 재전송)
          disconnectTimers:     new Map(),  // ★ pid → 유예 타이머
          seenCounts:           new Map()   // ★ 문제id → 나온 횟수 (LFU 출제, 방 소멸 시 함께 사라짐)
        };
        rooms.set(code, room);
        isNewRoom = true;
      }

      room.players.push({
        id: socket.id,
        pid: pid || socket.id,            // ★ 재접속 식별용 영구 토큰 (없으면 소켓ID)
        nickname: nickname || `플레이어${room.players.length + 1}`,
        avatar: avatar || null,          // ★ 사용자가 고른 아바타
        score: 0, isReady: false,
        disconnected: false,
        isAudioUnlocked: false
      });

      socket.join(room.code);
      socket.data.roomCode = room.code;
      socket.data.nickname = nickname;
      socket.data.pid = pid || socket.id;

      io.to(room.code).emit('room_update', getRoomState(room));
      if (!isNewRoom) {
        socket.to(room.code).emit('system_message', { text: `${nickname || '플레이어'}님이 입장했습니다.` });
      }
      cb({ success: true, roomCode: room.code, isHost: isNewRoom });
    } catch (e) {
      console.error(e);
      cb({ error: '서버 오류가 발생했습니다.' });
    }
  });

  // ── ★ 재접속 (유예 시간 내) ───────────────────────────────────
  socket.on('rejoin_room', ({ pid, roomCode } = {}, cb) => {
    try {
      if (!pid || !roomCode) return cb?.({ error: 'no-session' });
      const room = rooms.get(roomCode.toUpperCase());
      if (!room) return cb?.({ error: 'room-gone' });           // 방이 사라짐

      const player = room.players.find(p => p.pid === pid);
      if (!player) return cb?.({ error: 'removed' });           // 유예 초과로 이미 제거됨

      // 유예 타이머 취소 + 소켓 재바인딩
      const t = room.disconnectTimers.get(pid);
      if (t) { clearTimeout(t); room.disconnectTimers.delete(pid); }

      player.id = socket.id;            // 새 소켓ID로 갱신
      player.disconnected = false;
      socket.join(room.code);
      socket.data.roomCode = room.code;
      socket.data.pid = pid;
      socket.data.nickname = player.nickname;

      // ★ pid 기반이라 원래 방장이면 재접속만으로 방장이 자동 유지된다.
      //   방장 자리가 비어 있으면(방장이 유예만료로 제거된 경우) 복구.
      const beforePid = room.hostPid;
      reassignHostIfNeeded(room);
      if (room.hostPid !== beforePid && isHost(room, socket.id)) {
        io.to(room.code).emit('system_message', { text: `${player.nickname}님이 방장이 되었습니다.` });
      }

      io.to(room.code).emit('room_update', getRoomState(room));
      socket.to(room.code).emit('system_message', { text: `${player.nickname}님이 다시 연결되었습니다.` });

      cb?.({ success: true, roomCode: room.code, isHost: isHost(room, socket.id) });

      // ★ 현재 단계에 맞는 화면 복구를 이 소켓에만 전송
      if (room.phase === 'gameover' && room.lastGameOver) {
        socket.emit('game_over', room.lastGameOver);
      } else if (room.phase === 'game') {
        socket.emit('game_started', {
          totalRounds: room.questions.length,
          targetScore: room.targetScore,
          autoSkipOpening: true   // 진행 중 복귀이므로 오프닝 생략, 다음 라운드부터 동기화
        });
      }
    } catch (e) {
      console.error('rejoin_room 오류:', e);
      cb?.({ error: 'server-error' });
    }
  });

  socket.on('start_game', ({ targetScore = 5, roundCount = ROUND_COUNT, categories = [], autoSkipOpening = false, fromRematch = false } = {}, cb) => {
    try {
      const room = rooms.get(socket.data.roomCode);
      if (!room)                     return cb?.({ error: '방을 찾을 수 없습니다.' });
      if (!isHost(room, socket.id))  return cb?.({ error: '방장만 게임을 시작할 수 있습니다.' });
      if (room.status === 'PLAYING') return cb?.({ error: '이미 게임 중입니다.' });

      // ★ 대기방 시작 시에만 준비완료 게이트 적용. 재시작(rematch)은 같은 인원으로
      //    바로 다시 하는 것이므로 준비 체크를 건너뛴다. (버그: 재시작 차단 방지)
      if (!fromRematch) {
        // 방장(실효) 본인과 연결이 끊긴(유예중) 플레이어는 준비 체크에서 제외
        const eff = effectiveHostPlayer(room);
        const others = room.players.filter(p => !p.disconnected && p.id !== eff?.id);
        if (!others.every(p => p.isReady)) {
          return cb?.({ error: '아직 준비하지 않은 플레이어가 있습니다.' });
        }
      }

      const count = Math.max(1, Math.min(Number(roundCount) || ROUND_COUNT, 30));
      if (!(room.seenCounts instanceof Map)) room.seenCounts = new Map(); // 안전장치
      const questions = getRandomQuestions(count, categories, room.seenCounts);
      if (questions.length === 0)    return cb?.({ error: '선택한 주제에 출제 가능한 문제가 없습니다.' });
      // ★ 이번에 뽑힌 문제의 '나온 횟수' +1 → 다음 판(다시하기 포함)에서 덜 나오게
      questions.forEach(q => room.seenCounts.set(q.id, (room.seenCounts.get(q.id) || 0) + 1));

      room.status             = 'PLAYING';
      room.currentRound       = 0;
      room.bonusUsed          = 0;        // ★ 보너스 카운터 초기화
      room.currentRoundBonus  = false;
      room.targetScore        = Number(targetScore) || 5;
      room.roundCount         = count;
      room.selectedCategories = Array.isArray(categories) ? categories : [];
      room.questions          = questions;
      room.totalRounds        = questions.length;
      room.players.forEach(p => { 
        p.score = 0; 
        p.isReady = false;         // ★ 다음 대기방을 위해 준비상태 초기화
        p.isAudioUnlocked = false; // ★ 게임 시작 시 터치 상태 초기화
      });

      io.to(room.code).emit('room_update', getRoomState(room));
      room.phase = 'game';                  // ★ 재접속 복구용 단계
      io.to(room.code).emit('game_started', {
        totalRounds: room.questions.length,
        targetScore: room.targetScore,
        autoSkipOpening: !!autoSkipOpening   // ★ 재시작이면 클라이언트가 INTRO 자동 스킵
      });

      cb?.({ success: true });
      
      // ★ 로버스트 로직: 서버 상태를 동기화 대기(SYNCING)로 변경
      room.status = 'SYNCING'; 
      
      // ★ 타임아웃(10초) 설정: 누군가 튕기거나 안 눌러도 10초 뒤 무조건 강제 시작 (무한 대기 방지)
      room.syncTimeout = setTimeout(() => {
        if (room.status === 'SYNCING') {
          console.log(`[강제 시작] 방 ${room.code} 터치 대기 시간 초과`);
          room.status = 'PLAYING';
          startRound(room);
        }
      }, 10000);

      cb?.({ success: true });
      room.waitingForUnlocks = true; // 서버가 플레이어들의 화면 터치를 기다림
    } catch (e) {
      console.error(e);
      cb?.({ error: '서버 오류가 발생했습니다.' });
    }
  });

  socket.on('ready_to_start', () => {
    try {
      const room = rooms.get(socket.data.roomCode);
      if (!room || room.status !== 'SYNCING') return; // SYNCING 상태일 때만 유효

      const player = room.players.find(p => p.id === socket.id);
      if (player) player.isAudioUnlocked = true;

      // 혼자 테스트 중이거나, 모든 인원이 터치를 완료했는지 확인
      const allUnlocked = room.players.every(p => p.isAudioUnlocked);
      
      if (allUnlocked) {
        clearTimeout(room.syncTimeout); // 타임아웃 캔슬
        room.status = 'PLAYING';
        startRound(room); // 서버가 즉시 라운드 시작 신호(round_start)를 모두에게 쏨!
      }
    } catch (e) {
      console.error(e);
    }
  });


  socket.on('music_started', () => {
    try {
      const room = rooms.get(socket.data.roomCode);
      if (!room || room.status !== 'PLAYING') return;
      if (room.answeredThisRound)             return;
      if (room.roundTimer)                    return; // 이미 정답 창이 열려 있음
      if (room.musicStartedSockets.has(socket.id)) return;
      room.musicStartedSockets.add(socket.id);

      // 접속 중(유예중 아님) 플레이어가 모두 음악을 시작했으면 즉시 정답 창 오픈,
      // 아니면 첫 준비 완료 후 READY_GRACE_MS 만 기다렸다가 오픈(느린 클라 보호).
      const needed = room.players.filter(p => !p.disconnected).length;
      if (room.musicStartedSockets.size >= needed) {
        startRoundTimer(room);
      } else if (!room.graceTimer) {
        room.graceTimer = setTimeout(() => {
          room.graceTimer = null;
          startRoundTimer(room);
        }, READY_GRACE_MS);
      }
    } catch (e) {
      console.error('music_started 오류:', e);
    }
  });

  socket.on('submit_answer', ({ answer }) => {
    try {
      const room = rooms.get(socket.data.roomCode);
      if (!room || room.status !== 'PLAYING') return;
      if (!room.roundTimer)                   return; // 아직 정답 접수 전(안내/버퍼링 중)

      const player = room.players.find(p => p.id === socket.id);
      if (!player || room.answeredThisRound)  return;

      const question = room.questions[room.currentRound - 1];
      if (!question) return;

      if (smartGrade(answer, question.answers)) {
        room.answeredThisRound    = true;
        room.firstCorrectPlayerId = socket.id;
        clearRoomTimers(room);

        const gained = room.currentRoundBonus ? 2 : 1;   // ★ 보너스면 2점
        player.score += gained;

        // ★ 정답 말풍선(초록) 먼저 모두에게 표시
        io.to(room.code).emit('player_guess', {
          playerId: socket.id,
          nickname: player.nickname,
          text:     String(answer).slice(0, 40),
          correct:  true
        });

        // ★ 0.8초 뒤 정답 공개 이펙트 (초록 말풍선이 잠깐 보이고 넘어가게)
        setTimeout(() => {
          io.to(room.code).emit('room_update', getRoomState(room));
          io.to(room.code).emit('answer_result', {
            correct:        true,
            winnerId:       socket.id,
            winnerNickname: player.nickname,
            answer:         question.answers[0],
            points:         gained,                          // ★ 획득 점수
            isBonus:        room.currentRoundBonus,           // ★ 보너스 여부
            scores:         room.players.map(p => ({ id: p.id, nickname: p.nickname, score: p.score }))
          });
          setTimeout(() => checkEndOrNextRound(room), 2500);
        }, 800);
      } else {
        // ★ 오답 말풍선(일반색)도 모두에게 표시
        io.to(room.code).emit('player_guess', {
          playerId: socket.id,
          nickname: player.nickname,
          text:     String(answer).slice(0, 40),
          correct:  false
        });
        // 빨간 깜빡임은 본인 화면에만 (기존 유지)
        socket.emit('answer_result', {
          correct:  false,
          playerId: socket.id,
          message:  '틀렸습니다! 다시 시도해보세요.',
          winnerId: null,
          noWinner: false
        });
      }
    } catch (e) {
      console.error(e);
    }
  });

  socket.on('skip_round', () => {
    try {
      const room = rooms.get(socket.data.roomCode);
      if (!room || room.status !== 'PLAYING' || room.answeredThisRound) return;

      room.answeredThisRound = true;
      clearRoomTimers(room);

      const q = room.questions[room.currentRound - 1];
      io.to(room.code).emit('answer_result', {
        correct:  false,
        noWinner: true,
        answer:   q?.answers?.[0] || '알 수 없음',
        message:  '영상을 재생할 수 없어 스킵했습니다.',
        scores:   room.players.map(p => ({ id: p.id, nickname: p.nickname, score: p.score }))
      });

      setTimeout(() => checkEndOrNextRound(room), 2500);
    } catch (e) {
      console.error(e);
    }
  });

  // ── 채팅 ────────────────────────────────────────────────────
  socket.on('chat_message', ({ text } = {}) => {
    try {
      const room = rooms.get(socket.data.roomCode);
      if (!room) return;
      const player = room.players.find(p => p.id === socket.id);
      const clean  = String(text || '').slice(0, 200).trim();
      if (!clean) return;
      io.to(room.code).emit('chat_message', {
        id:       `${socket.id}-${Date.now()}`,
        playerId: socket.id,
        nickname: player?.nickname || '익명',
        text:     clean,
        ts:       Date.now()
      });
    } catch (e) {
      console.error('chat_message 오류:', e);
    }
  });

  // ── 준비완료 토글 (모든 플레이어) ─────────────────────────────
  socket.on('toggle_ready', () => {
    try {
      const room = rooms.get(socket.data.roomCode);
      if (!room || room.status !== 'WAITING') return;
      const player = room.players.find(p => p.id === socket.id);
      if (!player) return;
      player.isReady = !player.isReady;
      io.to(room.code).emit('room_update', getRoomState(room));
    } catch (e) {
      console.error('toggle_ready 오류:', e);
    }
  });

  // ── 방장 위임 (현재 방장만) ───────────────────────────────────
  socket.on('transfer_host', ({ targetId } = {}) => {
    try {
      const room = rooms.get(socket.data.roomCode);
      if (!room || !isHost(room, socket.id)) return; // 현재 방장만
      const target = room.players.find(p => p.id === targetId);
      if (!target || target.disconnected) return;    // 접속 중인 대상에게만 이양
      room.hostPid = target.pid;
      io.to(room.code).emit('room_update', getRoomState(room));
      io.to(room.code).emit('system_message', { text: `${target.nickname}님이 새 방장이 되었습니다.` });
    } catch (e) {
      console.error('transfer_host 오류:', e);
    }
  });

  // ── 방 설정 실시간 공유 (방장만) ──────────────────────────────
  // 방장이 설정창에서 값을 바꾸면 즉시 방 전체에 반영 → 다른 유저도 목표점수/라운드 수 확인 가능
  socket.on('update_settings', ({ targetScore, roundCount, categories, maxPlayers } = {}) => {
    try {
      const room = rooms.get(socket.data.roomCode);
      if (!room || !isHost(room, socket.id) || room.status !== 'WAITING') return;

      let changed = false;
      if (targetScore != null) {
        const v = Number(targetScore) || room.targetScore;
        if (v !== room.targetScore) { room.targetScore = v; changed = true; }
      }
      if (roundCount != null) {
        const v = Math.max(1, Math.min(Number(roundCount) || room.roundCount, 30));
        if (v !== room.roundCount) { room.roundCount = v; changed = true; }
      }
      if (maxPlayers != null) {
        // 5~15 범위 + 현재 인원수보다 낮게는 못 내림
        const floor = Math.max(5, room.players.length);
        const v = Math.max(floor, Math.min(15, Number(maxPlayers) || room.maxPlayers));
        if (v !== room.maxPlayers) { room.maxPlayers = v; changed = true; }
      }
      if (Array.isArray(categories)) {
        const prev = (room.selectedCategories || []).slice().sort().join('|');
        const next = categories.slice().sort().join('|');
        if (prev !== next) { room.selectedCategories = categories; changed = true; }
      }

      io.to(room.code).emit('room_update', getRoomState(room));
      // ★ 실제로 값이 바뀐 경우에만 알림 (그냥 열었다 닫으면 알림 X)
      if (changed) socket.to(room.code).emit('system_message', { text: '방 설정이 변경되었습니다.' });
    } catch (e) {
      console.error('update_settings 오류:', e);
    }
  });

  // ── 오프닝 안내방송 스킵 (방장만) ─────────────────────────────
  socket.on('skip_opening', () => {
    try {
      const room = rooms.get(socket.data.roomCode);
      if (!room || !isHost(room, socket.id)) return; // 방장만 허용
      io.to(room.code).emit('skip_opening'); // 전원 동시 스킵 (요청자 포함)
    } catch (e) {
      console.error('skip_opening 오류:', e);
    }
  });

  // ── 게임 종료 후 대기방으로 복귀 (방장만) ─────────────────────
  socket.on('return_to_lobby', () => {
    try {
      const room = rooms.get(socket.data.roomCode);
      if (!room || !isHost(room, socket.id)) return;

      clearRoomTimers(room);
      room.status              = 'WAITING';
      room.currentRound        = 0;
      room.questions           = [];
      room.answeredThisRound   = false;
      room.firstCorrectPlayerId = null;
      room.musicStartedSockets = new Set();
      room.players.forEach(p => { p.score = 0; p.isReady = false; p.isAudioUnlocked = false; });
      room.phase = 'lobby';          // ★ 복구 단계
      room.lastGameOver = null;

      io.to(room.code).emit('room_update', getRoomState(room));
      io.to(room.code).emit('back_to_lobby'); // 모든 클라이언트를 대기방 화면으로
    } catch (e) {
      console.error('return_to_lobby 오류:', e);
    }
  });

  // ── 강퇴 (방장만) ─────────────────────────────────────────────
  socket.on('kick_player', ({ targetId } = {}) => {
    try {
      const room = rooms.get(socket.data.roomCode);
      if (!room || !isHost(room, socket.id)) return;    // 방장만
      const target = room.players.find(p => p.id === targetId);
      if (!target || target.pid === room.hostPid) return; // 방장(자신) 강퇴 불가

      const gt = room.disconnectTimers.get(target.pid);   // 유예 타이머 있으면 정리
      if (gt) { clearTimeout(gt); room.disconnectTimers.delete(target.pid); }

      room.players = room.players.filter(p => p.id !== targetId);
      room.musicStartedSockets?.delete(targetId);

      // 강퇴 대상에게 알리고 방에서 제거
      io.to(targetId).emit('kicked');
      const targetSocket = io.sockets.sockets.get(targetId);
      if (targetSocket) { targetSocket.leave(room.code); targetSocket.data.roomCode = null; }

      io.to(room.code).emit('system_message', { text: `${target.nickname}님이 강퇴되었습니다.` });
      io.to(room.code).emit('room_update', getRoomState(room));
    } catch (e) {
      console.error('kick_player 오류:', e);
    }
  });

  // ── 방 나가기 (버튼) ──────────────────────────────────────────
  // 소켓 연결은 유지한 채 방에서만 빠져나간다. (나간 뒤에도 알림 받는 버그 방지)
  socket.on('leave_room', () => {
    try {
      const roomCode = socket.data.roomCode;
      if (!roomCode) return;
      const room = rooms.get(roomCode);
      socket.leave(roomCode);
      socket.data.roomCode = null;
      if (!room) return;

      const leaving = room.players.find(p => p.id === socket.id);
      const wasHost = !!leaving && leaving.pid === room.hostPid;
      room.players = room.players.filter(p => p.id !== socket.id);
      room.musicStartedSockets?.delete(socket.id);

      if (room.players.length === 0) { clearRoomTimers(room); rooms.delete(roomCode); return; }

      if (wasHost) {
        reassignHostIfNeeded(room);
        const hp = hostPlayer(room);
        if (hp) io.to(roomCode).emit('system_message', { text: `${hp.nickname}님이 새로운 방장이 되었습니다.` });
      } else if (leaving) {
        io.to(roomCode).emit('system_message', { text: `${leaving.nickname}님이 나갔습니다.` });
      }
      io.to(roomCode).emit('room_update', getRoomState(room));
    } catch (e) {
      console.error('leave_room 오류:', e);
    }
  });

  socket.on('disconnect', () => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;                 // 이미 제거됨(강퇴/나가기 등)

    // ★ 즉시 제거하지 않고 '연결 끊김' 상태로 두고 유예 시간을 준다.
    player.disconnected = true;
    const pid = player.pid;
    const nickname = player.nickname;

    // ★ 방장이 잠깐 끊긴 것뿐일 수 있으므로 여기서는 방장을 넘기지 않는다.
    //   (pid로 관리하므로 재접속하면 방장이 그대로 유지됨. 유예 만료 시에만 재이양)

    io.to(roomCode).emit('system_message', { text: `${nickname}님의 연결이 끊겼습니다. 잠시 기다립니다...` });
    io.to(roomCode).emit('room_update', getRoomState(room));

    // ★ 유예 타이머: 시간 내 재접속이 없으면 그때 완전히 제거
    const prev = room.disconnectTimers.get(pid);
    if (prev) clearTimeout(prev);
    const timer = setTimeout(() => {
      room.disconnectTimers.delete(pid);
      const target = room.players.find(p => p.pid === pid);
      if (!target || !target.disconnected) return;   // 이미 재접속했거나 제거됨

      room.players = room.players.filter(p => p.pid !== pid);
      room.musicStartedSockets?.delete(target.id);

      if (room.players.length === 0) {
        clearRoomTimers(room);
        room.disconnectTimers.forEach(t => clearTimeout(t));
        rooms.delete(roomCode);
        return;
      }

      // 유예 만료로 방장이 완전히 제거됐으면 접속 중인 사람에게 재이양
      if (target.pid === room.hostPid) {
        reassignHostIfNeeded(room);
        const hp = hostPlayer(room);
        if (hp) io.to(roomCode).emit('system_message', { text: `${hp.nickname}님이 새로운 방장이 되었습니다.` });
      }

      io.to(roomCode).emit('system_message', { text: `${nickname}님이 퇴장했습니다.` });
      io.to(roomCode).emit('room_update', getRoomState(room));

      // 게임 중인데 접속자가 한 명도 없으면 종료
      if (room.status === 'PLAYING' && !room.players.some(p => !p.disconnected)) {
        endGame(room);
      }
    }, RECONNECT_GRACE_MS);

    room.disconnectTimers.set(pid, timer);
  });
});

function startRound(room) {
  clearRoomTimers(room);

  room.currentRound         += 1;
  room.answeredThisRound    = false;
  room.firstCorrectPlayerId = null;
  room.musicStartedSockets  = new Set();

  const question = room.questions[room.currentRound - 1];
  if (!question) return endGame(room);

  // ★ 보너스 퀴즈: 난이도 2+ 문제 한정, 게임당 최대 2회, 15% 확률
  const diff = Number(question.difficulty) || 1;
  const isBonus = room.bonusUsed < BONUS_MAX && diff >= BONUS_MIN_DIFF && Math.random() < BONUS_PROB;
  room.currentRoundBonus = isBonus;
  if (isBonus) room.bonusUsed += 1;

  io.to(room.code).emit('round_start', {
    round:        room.currentRound,
    totalRounds:  room.questions.length,
    category:     question.category,
    hint:         question.hint,
    youtubeId:    question.youtubeId,
    youtubeStart: question.youtubeStart,
    youtubeEnd:   question.youtubeEnd,
    timeLimit:    ROUND_TIME_LIMIT,
    isBonus,                              // ★ 보너스 여부
    pointValue:   isBonus ? 2 : 1         // ★ 배점
  });

  io.to(room.code).emit('room_update', getRoomState(room));

  const fallbackDelay = room.currentRound === 1 ? 40000 : 15000;

  room.fallbackTimer = setTimeout(() => {
    room.fallbackTimer = null;
    if (!room.answeredThisRound && !room.roundTimer) {
      console.log(`[fallback] 방 ${room.code} 라운드 ${room.currentRound} — music_started 미수신, 강제 시작`);
      startRoundTimer(room);
    }
  }, fallbackDelay);
}

function checkEndOrNextRound(room) {
  const winner = room.players.find(p => p.score >= room.targetScore);
  if (winner || room.currentRound >= room.questions.length) {
    endGame(room);
  } else {
    startRound(room);
  }
}

function endGame(room) {
  clearRoomTimers(room)

  // ① 점수 초기화 전에 finalScores 캡처
  const finalScores = [...room.players]
    .sort((a, b) => b.score - a.score)
    .map(p => ({ id: p.id, nickname: p.nickname, avatar: p.avatar, score: p.score }))

  // ② 승리/무승부 판정
  let winner = null
  let isDraw = false

  if (finalScores.length > 0 && finalScores[0].score > 0) {
    const topScore = finalScores[0].score
    const topGroup = finalScores.filter(p => p.score === topScore)
    if (topGroup.length === 1) {
      winner = topGroup[0]
    } else {
      isDraw = true // 동점자 2명 이상
    }
  }

  // ③ game_over 먼저 emit (점수 초기화 전!)
  const gameOverPayload = {
    winner,
    isDraw,
    drawPlayers: isDraw ? finalScores.filter(p => p.score === finalScores[0].score) : [],
    finalScores,
    roomCode: room.code
  }
  room.phase = 'gameover'          // ★ 복구 단계: 이후 재접속자는 결과 화면으로
  room.lastGameOver = gameOverPayload
  io.to(room.code).emit('game_over', gameOverPayload)

  // ④ 1.5초 후 방 상태 초기화 (game_over 수신 후에 초기화) — phase는 gameover 유지
  setTimeout(() => {
    room.status = 'WAITING'
    room.currentRound = 0
    room.players.forEach(p => { p.score = 0; p.isReady = false })
    io.to(room.code).emit('room_update', getRoomState(room))
  }, 1500)
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Sound Quiz Server on port ${PORT} | CLIENT: ${CLIENT_URL}`);
});
