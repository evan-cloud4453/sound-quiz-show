// sever/index.js

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

function checkYouTubeValid(youtubeId) {
  return new Promise((resolve) => {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${youtubeId}`;
    https.get(url, (res) => resolve(res.statusCode === 200))
         .on('error', () => resolve(false));
  });
}

async function preCheckQuestions() {
  console.log('🔍 유튜브 링크 유효성 검사 중...');
  const base    = QUIZ_DATA.filter(q => q.youtubeId && q.youtubeId.length >= 10);
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
    roomCode:      room.code,
    hostId:        room.hostId,
    players:       room.players.map(p => ({
      id: p.id, nickname: p.nickname,
      score: p.score, isReady: p.isReady,
      isHost: p.id === room.hostId
    })),
    status:        room.status,
    currentRound:  room.currentRound,
    totalRounds:   room.totalRounds,
    targetScore:   room.targetScore,
    isTimerRunning: !!room.roundTimer // 💡 프론트엔드 타이머 애니메이션 트리거
  };
}

// ── 타이머 헬퍼 ───────────────────────────────────────────────
function clearRoomTimers(room) {
  clearTimeout(room.roundTimer);
  clearTimeout(room.fallbackTimer);
  room.roundTimer    = null;
  room.fallbackTimer = null;
}

function startRoundTimer(room) {
  if (room.roundTimer) return;

  clearTimeout(room.fallbackTimer);
  room.fallbackTimer = null;

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

  socket.on('join_room', ({ nickname, roomCode }, cb) => {
    try {
      let room;
      let isNewRoom = false;

      if (roomCode) {
        room = rooms.get(roomCode.toUpperCase());
        if (!room)                      return cb({ error: '존재하지 않는 방 코드입니다.' });
        if (room.status === 'PLAYING')  return cb({ error: '이미 게임이 진행 중입니다.' });
        if (room.players.length >= 8)   return cb({ error: '방이 가득 찼습니다. (최대 8명)' });
      } else {
        let code;
        do { code = generateRoomCode(); } while (rooms.has(code));
        room = {
          code,
          hostId:               socket.id,
          players:              [],
          status:               'WAITING',
          currentRound:         0,
          totalRounds:          ROUND_COUNT,
          targetScore:          5,
          questions:            [],
          roundTimer:           null,
          fallbackTimer:        null,
          answeredThisRound:    false,
          firstCorrectPlayerId: null,
          musicStartedSockets:  new Set()
        };
        rooms.set(code, room);
        isNewRoom = true;
      }

      room.players.push({
        id: socket.id,
        nickname: nickname || `플레이어${room.players.length + 1}`,
        score: 0, isReady: false
        isAudioUnlocked: false
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

  socket.on('start_game', ({ targetScore = 5 }, cb) => {
    try {
      const room = rooms.get(socket.data.roomCode);
      if (!room)                     return cb?.({ error: '방을 찾을 수 없습니다.' });
      if (room.hostId !== socket.id) return cb?.({ error: '방장만 게임을 시작할 수 있습니다.' });
      if (room.status === 'PLAYING') return cb?.({ error: '이미 게임 중입니다.' });

      const questions = getRandomQuestions(ROUND_COUNT);
      if (questions.length === 0)    return cb?.({ error: '출제 가능한 문제가 없습니다.' });

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
      room.waitingForUnlocks = true; // 서버가 플레이어들의 화면 터치를 기다림
    } catch (e) {
      console.error(e);
      cb?.({ error: '서버 오류가 발생했습니다.' });
    }
  });

  socket.on('ready_to_start', () => {
    try {
      const room = rooms.get(socket.data.roomCode);
      if (!room) return;

      const player = room.players.find(p => p.id === socket.id);
      if (player) player.isAudioUnlocked = true;

      // 게임이 시작되었고(waitingForUnlocks), 모든 유저가 터치를 완료했는지 확인
      if (room.waitingForUnlocks) {
        const allUnlocked = room.players.every(p => p.isAudioUnlocked);
        if (allUnlocked) {
          room.waitingForUnlocks = false;
          // 전원 완료 시 드디어 1라운드 시작
          setTimeout(() => startRound(room), 1000); 
        }
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
      if (room.musicStartedSockets.has(socket.id)) return;
      room.musicStartedSockets.add(socket.id);

      startRoundTimer(room); 
    } catch (e) {
      console.error('music_started 오류:', e);
    }
  });

  socket.on('submit_answer', ({ answer }) => {
    try {
      const room = rooms.get(socket.data.roomCode);
      if (!room || room.status !== 'PLAYING') return;

      const player = room.players.find(p => p.id === socket.id);
      if (!player || room.answeredThisRound)  return;

      const question = room.questions[room.currentRound - 1];
      if (!question) return;

      if (smartGrade(answer, question.answers)) {
        room.answeredThisRound    = true;
        room.firstCorrectPlayerId = socket.id;
        clearRoomTimers(room);

        player.score += 1;
        io.to(room.code).emit('room_update', getRoomState(room));
        io.to(room.code).emit('answer_result', {
          correct:        true,
          winnerId:       socket.id,
          winnerNickname: player.nickname,
          answer:         question.answers[0],
          scores:         room.players.map(p => ({ id: p.id, nickname: p.nickname, score: p.score }))
        });

        setTimeout(() => checkEndOrNextRound(room), 2500);
      } else {
        socket.emit('answer_result', {
          correct:  false,
          playerId: socket.id,
          message:  '틀렸습니다! 다시 시도해보세요.'
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
    if (room.status === 'PLAYING' && room.players.length < 1) endGame(room);
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
    .map(p => ({ id: p.id, nickname: p.nickname, score: p.score }))

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
  io.to(room.code).emit('game_over', {
    winner,
    isDraw,
    drawPlayers: isDraw ? finalScores.filter(p => p.score === finalScores[0].score) : [],
    finalScores,
    roomCode: room.code
  })

  // ④ 1.5초 후 방 상태 초기화 (game_over 수신 후에 초기화)
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
