require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const ROUND_COUNT = 10;
const ROUND_TIME_LIMIT = 15;
const HINT_REVEAL_SECONDS = 5;

const io = new Server(server, {
  cors: {
    origin: [CLIENT_URL, /\.vercel\.app$/, /\.netlify\.app$/],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

// ── Health check ──────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', uptime: process.uptime() }));
app.get('/', (_, res) => res.json({ name: 'Sound Quiz Show Server', version: '1.0.0' }));

const { RAW_QUIZ_DATA } = require('./quizData');
// ── In-memory state ───────────────────────────────────────────
// rooms: Map<roomCode, Room>
const rooms = new Map();

// 내장 퀴즈 데이터. start_game은 이 정규화된 배열만 사용한다.
const QUIZ_DATA = RAW_QUIZ_DATA.map(question => ({
  ...question,
  audioUrl: question.audioUrl || null,
  youtubeId: question.youtubeId || null,
  youtubeStart: Number(question.youtubeStart ?? question.start ?? 0),
  youtubeEnd: Number(question.youtubeEnd ?? question.end ?? 0)
}));

console.log(`총 ${QUIZ_DATA.length}개의 퀴즈 데이터를 성공적으로 불러왔습니다.`);
console.log(`[Quiz] YouTube playable questions: ${getPlayableQuestions().length}/${QUIZ_DATA.length}`);

// ── Utility functions ─────────────────────────────────────────

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function getPlayableQuestions() {
  return QUIZ_DATA.filter(question => question.youtubeId || question.audioUrl);
}

function getRandomQuestions(count = 10) {
  const shuffled = [...getPlayableQuestions()].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

// Smart grading: normalise → exact match → similarity
function normalise(text) {
  return text
    .toLowerCase()
    .replace(/[\s\-_.,!?'"]/g, '')
    .trim();
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

function smartGrade(submitted, answers) {
  const normSubmit = normalise(submitted);
  if (!normSubmit) return false;

  for (const ans of answers) {
    const normAns = normalise(ans);

    // Exact match
    if (normSubmit === normAns) return true;

    // Similarity (Levenshtein)
    if (normAns.length >= 3) {
      const dist = levenshtein(normSubmit, normAns);
      const similarity = 1 - dist / Math.max(normAns.length, normSubmit.length);
      if (similarity >= 0.8 || dist === 1) return true;
    }
  }
  return false;
}

function getRoomState(room) {
  return {
    roomCode: room.code,
    hostId: room.hostId,
    players: room.players.map(p => ({
      id: p.id,
      nickname: p.nickname,
      score: p.score,
      isReady: p.isReady,
      isHost: p.id === room.hostId
    })),
    status: room.status,
    currentRound: room.currentRound,
    totalRounds: room.totalRounds,
    targetScore: room.targetScore
  };
}

// ── Socket.io handlers ────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[CONNECT] ${socket.id}`);

  // ── join_room ──────────────────────────────────────────────
  socket.on('join_room', ({ nickname, roomCode }, cb) => {
    try {
      let room;
      let isNewRoom = false;

      if (roomCode) {
        // Join existing
        room = rooms.get(roomCode.toUpperCase());
        if (!room) return cb({ error: '존재하지 않는 방 코드입니다.' });
        if (room.status === 'PLAYING') return cb({ error: '이미 게임이 진행 중인 방입니다.' });
        if (room.players.length >= 8) return cb({ error: '방이 가득 찼습니다. (최대 8명)' });
      } else {
        // Create new room
        let code;
        do { code = generateRoomCode(); } while (rooms.has(code));
        room = {
          code,
          hostId: socket.id,
          players: [],
          status: 'WAITING',
          currentRound: 0,
          totalRounds: ROUND_COUNT,
          targetScore: 5,
          questions: [],
          roundTimer: null,
          hintTimer: null,
          answeredThisRound: false,
          firstCorrectPlayerId: null,
          isStarting: false
        };
        rooms.set(code, room);
        isNewRoom = true;
      }

      // Add player
      room.players.push({
        id: socket.id,
        nickname: nickname || `플레이어${room.players.length + 1}`,
        score: 0,
        isReady: false
      });

      socket.join(room.code);
      socket.data.roomCode = room.code;
      socket.data.nickname = nickname;

      io.to(room.code).emit('room_update', getRoomState(room));
      cb({ success: true, roomCode: room.code, isHost: isNewRoom });
      console.log(`[JOIN] ${nickname} → room ${room.code}`);
    } catch (e) {
      console.error(e);
      cb({ error: '서버 오류가 발생했습니다.' });
    }
  });

  // ── start_game ─────────────────────────────────────────────
  socket.on('start_game', ({ targetScore = 5 }, cb) => {
    let room;
    try {
      room = rooms.get(socket.data.roomCode);
      if (!room) return cb?.({ error: '방을 찾을 수 없습니다.' });
      if (room.hostId !== socket.id) return cb?.({ error: '방장만 게임을 시작할 수 있습니다.' });
      if (room.players.length < 1) return cb?.({ error: '최소 1명 이상 필요합니다.' });
      if (room.isStarting) return cb?.({ error: '게임을 시작하는 중입니다. 잠시만 기다려주세요.' });

      const questions = getRandomQuestions(ROUND_COUNT);
      if (questions.length === 0) {
        return cb?.({
          error: '재생 가능한 문제가 없습니다. quizData.js를 확인해주세요.'
        });
      }

      room.isStarting = true;
      room.status = 'PLAYING';
      room.currentRound = 0;
      room.targetScore = Number(targetScore) || 5;
      room.questions = questions;
      room.totalRounds = questions.length;
      room.players.forEach(p => { p.score = 0; });

      io.to(room.code).emit('room_update', getRoomState(room));
      io.to(room.code).emit('game_started', { totalRounds: room.questions.length, targetScore: room.targetScore });

      cb?.({ success: true });
      setTimeout(() => startRound(room), 1500);
    } catch (e) {
      console.error(e);
      cb?.({ error: '서버 오류가 발생했습니다.' });
    } finally {
      if (room) room.isStarting = false;
    }
  });

  // ── submit_answer ──────────────────────────────────────────
  socket.on('submit_answer', ({ answer }) => {
    try {
      const room = rooms.get(socket.data.roomCode);
      if (!room || room.status !== 'PLAYING') return;

      const player = room.players.find(p => p.id === socket.id);
      if (!player) return;

      // Already someone answered correctly this round
      if (room.answeredThisRound) return;

      const question = room.questions[room.currentRound - 1];
      if (!question) return;

      const isCorrect = smartGrade(answer, question.answers);

      if (isCorrect) {
        room.answeredThisRound = true;
        room.firstCorrectPlayerId = socket.id;

        if (room.roundTimer) {
          clearTimeout(room.roundTimer);
          room.roundTimer = null;
        }
        if (room.hintTimer) {
          clearTimeout(room.hintTimer);
          room.hintTimer = null;
        }

        // Score: correct player +1
        player.score += 1;
        io.to(room.code).emit('room_update', getRoomState(room));

        io.to(room.code).emit('answer_result', {
          correct: true,
          winnerId: socket.id,
          winnerNickname: player.nickname,
          answer: question.answers[0],
          scores: room.players.map(p => ({ id: p.id, nickname: p.nickname, score: p.score }))
        });

        setTimeout(() => checkEndOrNextRound(room), 2500);
      } else {
        // Tell only this player it was wrong (화면 잠금 해제 역할)
        socket.emit('answer_result', {
          correct: false,
          playerId: socket.id,
          message: '틀렸습니다! 다시 시도해보세요.'
        });
      }
    } catch (e) {
      console.error(e);
    }
  });

  // ── skip_round (NEW) ───────────────────────────────────────
  // 클라이언트에서 20초 재생 실패 시 강제 스킵을 요청할 때 처리
  socket.on('skip_round', () => {
    try {
      const room = rooms.get(socket.data.roomCode);
      if (!room || room.status !== 'PLAYING') return;

      if (room.roundTimer) {
        clearTimeout(room.roundTimer);
        room.roundTimer = null;
      }
      if (room.hintTimer) {
        clearTimeout(room.hintTimer);
        room.hintTimer = null;
      }

      room.answeredThisRound = true; // 강제 잠금 처리

      io.to(room.code).emit('answer_result', {
        correct: false,
        noWinner: true,
        answer: room.questions[room.currentRound - 1]?.answers[0] || '알 수 없음',
        message: '음원 재생 지연으로 라운드를 스킵합니다.',
        scores: room.players.map(p => ({ id: p.id, nickname: p.nickname, score: p.score }))
      });

      setTimeout(() => checkEndOrNextRound(room), 2500);
    } catch (e) {
      console.error("Skip Round Error:", e);
    }
  });

  // ── youtube_playing (NEW) ──────────────────────────────────
  // 오디오가 정상적으로 재생되기 시작했을 때 서버 타이머 출발
  socket.on('youtube_playing', () => {
    try {
      const room = rooms.get(socket.data.roomCode);
      
      if (room && room.status === 'PLAYING' && !room.roundTimer) {
        const question = room.questions[room.currentRound - 1];
        
        // 10초 뒤 힌트 공개 타이머
        if (question && question.hint) {
          room.hintTimer = setTimeout(() => {
            if (room.status === 'PLAYING' && !room.answeredThisRound) {
              io.to(room.code).emit('hint_revealed', { hint: question.hint });
            }
          }, (ROUND_TIME_LIMIT - HINT_REVEAL_SECONDS) * 1000); 
        }

        // 15초 라운드 종료 타이머
        room.roundTimer = setTimeout(() => {
          room.hintTimer = null;
          if (!room.answeredThisRound) {
            room.answeredThisRound = true;
            
            // 💡 상식적인 룰 적용: 타임아웃 시 아무도 점수를 얻지 못합니다! (everyone else +1 삭제됨)
            io.to(room.code).emit('answer_result', {
              correct: false,
              noWinner: true,
              answer: question.answers[0],
              message: '시간 초과! 아무도 맞히지 못했습니다.',
              scores: room.players.map(p => ({ id: p.id, nickname: p.nickname, score: p.score }))
            });

            setTimeout(() => checkEndOrNextRound(room), 2500);
          }
        }, ROUND_TIME_LIMIT * 1000);
      }
    } catch (e) {
      console.error("Youtube Playing Error:", e);
    }
  });

  // ── disconnect ─────────────────────────────────────────────
  socket.on('disconnect', () => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;

    const room = rooms.get(roomCode);
    if (!room) return;

    room.players = room.players.filter(p => p.id !== socket.id);
    console.log(`[LEAVE] ${socket.data.nickname} left room ${roomCode}`);

    if (room.players.length === 0) {
      if (room.roundTimer) clearTimeout(room.roundTimer);
      if (room.hintTimer) clearTimeout(room.hintTimer);
      rooms.delete(roomCode);
      console.log(`[DELETE] Room ${roomCode} removed`);
      return;
    }

    // Transfer host if needed
    if (room.hostId === socket.id) {
      room.hostId = room.players[0].id;
      io.to(roomCode).emit('system_message', {
        text: `${room.players[0].nickname}님이 새로운 방장이 되었습니다.`
      });
    }

    io.to(roomCode).emit('room_update', getRoomState(room));

    // If game in progress and only 1 player, end game
    if (room.status === 'PLAYING' && room.players.length < 1) {
      endGame(room);
    }
  });
});

// ── Game flow helpers ─────────────────────────────────────────

function startRound(room) {
  if (room.roundTimer) clearTimeout(room.roundTimer);
  if (room.hintTimer) clearTimeout(room.hintTimer);
  room.roundTimer = null;
  room.hintTimer = null;

  room.currentRound += 1;
  room.answeredThisRound = false;
  room.firstCorrectPlayerId = null;

  const question = room.questions[room.currentRound - 1];
  if (!question) return endGame(room);

  const roundNumber = room.currentRound;

  io.to(room.code).emit('round_start', {
    round: roundNumber,
    totalRounds: room.questions.length,
    category: question.category,
    audioUrl: question.audioUrl,
    youtubeId: question.youtubeId,
    youtubeStart: question.youtubeStart,
    youtubeEnd: question.youtubeEnd,
    timeLimit: ROUND_TIME_LIMIT
  });

  // 🚨 [수정됨] 기존에 무조건 돌아가던 힌트 및 라운드 타이머는 삭제되었습니다.
  // 프론트엔드에서 음원 재생이 확인되어 'youtube_playing' 신호가 오면 그때부터 시작됩니다.
}

function checkEndOrNextRound(room) {
  // Check if anyone reached target score
  const winner = room.players.find(p => p.score >= room.targetScore);
  if (winner || room.currentRound >= room.questions.length) {
    endGame(room);
  } else {
    startRound(room);
  }
}

function endGame(room) {
  if (room.roundTimer) {
    clearTimeout(room.roundTimer);
    room.roundTimer = null;
  }
  if (room.hintTimer) {
    clearTimeout(room.hintTimer);
    room.hintTimer = null;
  }

  // 💡 [수정됨] 0점 초기화 버그 해결을 위해 플레이어 데이터를 완벽하게 복제(Deep Copy)합니다.
  const finalScores = room.players
    .map(p => ({ ...p }))
    .sort((a, b) => b.score - a.score);

  room.status = 'WAITING';
  room.currentRound = 0;
  room.players.forEach(p => { p.score = 0; p.isReady = false; });

  io.to(room.code).emit('game_over', {
    winner: finalScores[0],
    finalScores: finalScores,
    roomCode: room.code
  });

  // Reset room state for rematch
  setTimeout(() => {
    io.to(room.code).emit('room_update', getRoomState(room));
  }, 1000);
}

// ── Boot ──────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Sound Quiz Server running on port ${PORT}`);
  console.log(`   CLIENT_URL: ${CLIENT_URL}`);
});
