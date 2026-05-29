require('dotenv').config();
const express = require('express');
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// ── 게임 상수 ─────────────────────────────────────────────────
const ROUND_COUNT      = 10;
const ROUND_TIME_LIMIT = 25; // 음악 재생 시작 후 실제 답변 시간 (초)
                              // 클라이언트에서 emit('music_started') 받는 순간부터 카운트

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
app.get('/', (_, res) => res.json({ name: 'Sound Quiz Show Server', version: '1.0.0' }));

// ── 퀴즈 데이터 로드 & 유효성 검사 ──────────────────────────
const { RAW_QUIZ_DATA } = require('./quizData');

const QUIZ_DATA = RAW_QUIZ_DATA.map(q => ({
  ...q,
  youtubeId:    q.youtubeId    || null,
  youtubeStart: Number(q.youtubeStart ?? q.start ?? 0),
  youtubeEnd:   Number(q.youtubeEnd   ?? q.end   ?? 0)
}));

let VALIDATED_QUIZ_DATA = [];

function checkYouTubeValid(youtubeId) {
  return new Promise((resolve) => {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${youtubeId}`;
    https.get(url, (res) => resolve(res.statusCode === 200))
         .on('error', () => resolve(false));
  });
}

async function preCheckQuestions() {
  console.log('🔍 유튜브 링크 유효성 검사 중...');
  const base = QUIZ_DATA.filter(q => q.youtubeId && q.youtubeId.length >= 10);
  const results = await Promise.all(
    base.map(async q => {
      const ok = await checkYouTubeValid(q.youtubeId);
      if (!ok) console.log(`❌ 제외: ${q.youtubeId} (${q.answers[0]})`);
      return ok ? q : null;
    })
  );
  VALIDATED_QUIZ_DATA = results.filter(Boolean);
  console.log(`✅ 유효 문제 ${VALIDATED_QUIZ_DATA.length}개 준비 완료`);
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

function getRandomQuestions(count = 10) {
  return [...VALIDATED_QUIZ_DATA]
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.min(count, VALIDATED_QUIZ_DATA.length));
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

function smartGrade(submitted, answers) {
  const ns = normalise(submitted);
  if (!ns) return false;
  for (const ans of answers) {
    const na = normalise(ans);
    if (ns === na) return true;
    if (na.length >= 3) {
      const dist = levenshtein(ns, na);
      const sim  = 1 - dist / Math.max(na.length, ns.length);
      if (sim >= 0.8 || dist === 1) return true;
    }
  }
  return false;
}

function getRoomState(room) {
  return {
    roomCode:     room.code,
    hostId:       room.hostId,
    players:      room.players.map(p => ({
      id: p.id, nickname: p.nickname, score: p.score,
      isReady: p.isReady, isHost: p.id === room.hostId
    })),
    status:       room.status,
    currentRound: room.currentRound,
    totalRounds:  room.totalRounds,
    targetScore:  room.targetScore
  };
}

// ── 방 타이머 헬퍼 ───────────────────────────────────────────
// 모든 타이머를 room 객체에서 한 곳에서 관리
function clearRoomTimers(room) {
  clearTimeout(room.roundTimer);
  clearTimeout(room.fallbackTimer);
  room.roundTimer   = null;
  room.fallbackTimer = null;
}

// ── 핵심: music_started 받을 때만 라운드 타이머 시작 ─────────
// 이전의 youtube_playing, loadingTimeoutTimer 개념을 통합
function startRoundTimer(room) {
  // 이미 타이머 돌고 있으면 중복 방지
  if (room.roundTimer) return;

  const question = room.questions[room.currentRound - 1];

  room.roundTimer = setTimeout(() => {
    room.roundTimer = null;
    if (room.answeredThisRound) return; // 이미 정답 처리됨
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

  // 타이머 시작을 클라이언트에도 알려서 UI 타이머 동기화
  io.to(room.code).emit('timer_start', { timeLimit: ROUND_TIME_LIMIT });

  console.log(`[타이머 시작] 방 ${room.code} 라운드 ${room.currentRound} — ${ROUND_TIME_LIMIT}초`);
}

// ── Socket 이벤트 ─────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[접속] ${socket.id}`);

  // ── 방 참가/생성 ────────────────────────────────────────
  socket.on('join_room', ({ nickname, roomCode }, cb) => {
    try {
      let room;
      let isNewRoom = false;

      if (roomCode) {
        room = rooms.get(roomCode.toUpperCase());
        if (!room) return cb({ error: '존재하지 않는 방 코드입니다.' });
        if (room.status === 'PLAYING') return cb({ error: '이미 게임이 진행 중입니다.' });
        if (room.players.length >= 8) return cb({ error: '방이 가득 찼습니다. (최대 8명)' });
      } else {
        let code;
        do { code = generateRoomCode(); } while (rooms.has(code));
        room = {
          code,
          hostId:    socket.id,
          players:   [],
          status:    'WAITING',
          currentRound: 0,
          totalRounds:  ROUND_COUNT,
          targetScore:  5,
          questions:    [],
          roundTimer:   null,   // 실제 라운드 타임아웃 (music_started 후 시작)
          fallbackTimer: null,  // 음악 미재생 안전망 타이머
          answeredThisRound: false,
          firstCorrectPlayerId: null,
          musicStartedSockets: new Set() // 이미 music_started 보낸 소켓 (중복 방지)
        };
        rooms.set(code, room);
        isNewRoom = true;
      }

      room.players.push({
        id: socket.id, nickname: nickname || `플레이어${room.players.length + 1}`,
        score: 0, isReady: false
      });

      socket.join(room.code);
      socket.data.roomCode = room.code;
      socket.data.nickname = nickname;

      io.to(room.code).emit('room_update', getRoomState(room));
      cb({ success: true, roomCode: room.code, isHost: isNewRoom });
    } catch (e) {
      console.error(e);
      cb({ error: '서버 오류가 발생했습니다.' });
    }
  });

  // ── 게임 시작 ────────────────────────────────────────────
  socket.on('start_game', ({ targetScore = 5 }, cb) => {
    try {
      const room = rooms.get(socket.data.roomCode);
      if (!room)                         return cb?.({ error: '방을 찾을 수 없습니다.' });
      if (room.hostId !== socket.id)     return cb?.({ error: '방장만 게임을 시작할 수 있습니다.' });
      if (room.status === 'PLAYING')     return cb?.({ error: '이미 게임 중입니다.' });

      const questions = getRandomQuestions(ROUND_COUNT);
      if (questions.length === 0)        return cb?.({ error: '출제 가능한 문제가 없습니다.' });

      room.status       = 'PLAYING';
      room.currentRound = 0;
      room.targetScore  = Number(targetScore) || 5;
      room.questions    = questions;
      room.totalRounds  = questions.length;
      room.players.forEach(p => { p.score = 0; });

      io.to(room.code).emit('room_update', getRoomState(room));
      io.to(room.code).emit('game_started', {
        totalRounds: room.questions.length,
        targetScore: room.targetScore
      });

      cb?.({ success: true });

      // 클라이언트가 오프닝 TTS를 재생할 시간을 줌
      // 실제 타이머는 클라이언트가 music_started를 보낼 때 시작
      setTimeout(() => startRound(room), 1500);

    } catch (e) {
      console.error(e);
      cb?.({ error: '서버 오류가 발생했습니다.' });
    }
  });

  // ── ★ 핵심 이벤트: 클라이언트가 음악 재생을 시작했을 때 ──
  // GameScreen.jsx에서 YouTube onStateChange → PLAYING 시 emit
  socket.on('music_started', () => {
    try {
      const room = rooms.get(socket.data.roomCode);
      if (!room || room.status !== 'PLAYING') return;
      if (room.answeredThisRound) return;

      // 같은 라운드에서 이미 처리했으면 무시 (멀티 플레이어 중복 방지)
      if (room.musicStartedSockets?.has(socket.id)) return;
      room.musicStartedSockets?.add(socket.id);

      // fallback 타이머 해제 (음악이 실제로 재생됐으니 필요 없음)
      clearTimeout(room.fallbackTimer);
      room.fallbackTimer = null;

      // 라운드 타이머 시작 (처음 한 번만)
      startRoundTimer(room);

    } catch (e) {
      console.error('music_started 처리 오류:', e);
    }
  });

  // ── 정답 제출 ────────────────────────────────────────────
  socket.on('submit_answer', ({ answer }) => {
    try {
      const room = rooms.get(socket.data.roomCode);
      if (!room || room.status !== 'PLAYING') return;

      const player = room.players.find(p => p.id === socket.id);
      if (!player || room.answeredThisRound) return;

      const question = room.questions[room.currentRound - 1];
      if (!question) return;

      if (smartGrade(answer, question.answers)) {
        room.answeredThisRound    = true;
        room.firstCorrectPlayerId = socket.id;
        clearRoomTimers(room); // 정답 → 타이머 즉시 중단

        player.score += 1;
        io.to(room.code).emit('room_update', getRoomState(room));
        io.to(room.code).emit('answer_result', {
          correct:       true,
          winnerId:      socket.id,
          winnerNickname: player.nickname,
          answer:        question.answers[0],
          scores:        room.players.map(p => ({ id: p.id, nickname: p.nickname, score: p.score }))
        });

        setTimeout(() => checkEndOrNextRound(room), 2500);
      } else {
        socket.emit('answer_result', {
          correct:  false,
          playerId: socket.id,
          message:  '틀렸습니다! 다시 시도해보세요.'
        });
      }
    } catch (e) {
      console.error(e);
    }
  });

  // ── 스킵 (음원 없음/재생 불가) ───────────────────────────
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

  // ── 연결 해제 ────────────────────────────────────────────
  socket.on('disconnect', () => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    if (!room) return;

    room.players = room.players.filter(p => p.id !== socket.id);
    room.musicStartedSockets?.delete(socket.id);

    if (room.players.length === 0) {
      clearRoomTimers(room);
      rooms.delete(roomCode);
      return;
    }

    if (room.hostId === socket.id) {
      room.hostId = room.players[0].id;
      io.to(roomCode).emit('system_message', {
        text: `${room.players[0].nickname}님이 새로운 방장이 되었습니다.`
      });
    }

    io.to(roomCode).emit('room_update', getRoomState(room));
  });
});

// ── 라운드 시작 ───────────────────────────────────────────────
function startRound(room) {
  clearRoomTimers(room);

  room.currentRound       += 1;
  room.answeredThisRound   = false;
  room.firstCorrectPlayerId = null;
  room.musicStartedSockets  = new Set(); // 라운드마다 초기화

  const question = room.questions[room.currentRound - 1];
  if (!question) return endGame(room);

  // 라운드 데이터 전송 (타이머는 아직 시작 안 함)
  io.to(room.code).emit('round_start', {
    round:        room.currentRound,
    totalRounds:  room.questions.length,
    category:     question.category,
    hint:         question.hint,
    youtubeId:    question.youtubeId,
    youtubeStart: question.youtubeStart,
    youtubeEnd:   question.youtubeEnd,
    timeLimit:    ROUND_TIME_LIMIT
  });

  io.to(room.code).emit('room_update', getRoomState(room));

  // ── fallback 타이머 ──────────────────────────────────────
  // 클라이언트가 music_started를 일정 시간 내에 보내지 않으면
  // (TTS + 로딩 포함) 서버가 강제로 타이머 시작
  // 1라운드: 오프닝 TTS(~20초) + 주제 TTS(~3초) + 여유(5초) = 28초
  // 2라운드~: 주제 TTS(~3초) + 로딩(3초) + 여유(4초) = 10초
  const fallbackDelay = room.currentRound === 1 ? 28000 : 10000;

  room.fallbackTimer = setTimeout(() => {
    room.fallbackTimer = null;
    if (!room.answeredThisRound && !room.roundTimer) {
      console.log(`[fallback 타이머] 방 ${room.code} — music_started 미수신, 강제 타이머 시작`);
      startRoundTimer(room);
    }
  }, fallbackDelay);

  console.log(`[라운드 ${room.currentRound}] 방 ${room.code} — 문제: ${question.answers[0]}`);
}

// ── 라운드 종료 후 다음 진행 ──────────────────────────────────
function checkEndOrNextRound(room) {
  const winner = room.players.find(p => p.score >= room.targetScore);
  if (winner || room.currentRound >= room.questions.length) {
    endGame(room);
  } else {
    startRound(room);
  }
}

// ── 게임 종료 ─────────────────────────────────────────────────
function endGame(room) {
  clearRoomTimers(room);

  const finalScores = [...room.players].sort((a, b) => b.score - a.score);

  let winner = null;
  if (finalScores.length > 0 && finalScores[0].score > 0) {
    const top = finalScores[0].score;
    const topGroup = finalScores.filter(p => p.score === top);
    if (topGroup.length === 1) winner = topGroup[0];
  }

  room.status       = 'WAITING';
  room.currentRound = 0;
  room.players.forEach(p => { p.score = 0; p.isReady = false; });

  io.to(room.code).emit('game_over', {
    winner,
    finalScores,
    roomCode: room.code
  });

  setTimeout(() => io.to(room.code).emit('room_update', getRoomState(room)), 1000);
}

// ── 서버 시작 ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Sound Quiz Server on port ${PORT} | CLIENT: ${CLIENT_URL}`);
});
