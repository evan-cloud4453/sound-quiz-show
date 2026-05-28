require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

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

// ── In-memory state ───────────────────────────────────────────
// rooms: Map<roomCode, Room>
const rooms = new Map();

// 내장 퀴즈 데이터 (음원 없이 유튜브 임베드 또는 MP3 URL로 교체 가능)
const QUIZ_DATA = [
  {
    id: 'q001', category: '애니메이션',
    audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3',
    hint: '인기 겨울 애니메이션 주제가',
    answers: ['겨울왕국', '겨울 왕국', 'frozen', '렛잇고'],
    difficulty: 1
  },
  {
    id: 'q002', category: '동물',
    audioUrl: 'https://www.soundjay.com/nature/sounds/cat-meow-1.mp3',
    hint: '집에서 키우는 반려동물',
    answers: ['고양이', 'cat'],
    difficulty: 1
  },
  {
    id: 'q003', category: '자연',
    audioUrl: 'https://www.soundjay.com/nature/sounds/rain-03.mp3',
    hint: '하늘에서 내리는 것',
    answers: ['비', '빗소리', 'rain'],
    difficulty: 1
  },
  {
    id: 'q004', category: '동물',
    audioUrl: 'https://www.soundjay.com/nature/sounds/dog-barking-1.mp3',
    hint: '충성스러운 반려동물',
    answers: ['개', '강아지', '개 짖는 소리', 'dog'],
    difficulty: 1
  },
  {
    id: 'q005', category: '자연',
    audioUrl: 'https://www.soundjay.com/nature/sounds/thunder-1.mp3',
    hint: '비가 올 때 번개와 함께',
    answers: ['천둥', '번개', 'thunder'],
    difficulty: 2
  },
  {
    id: 'q006', category: '생활',
    audioUrl: 'https://www.soundjay.com/misc/sounds/phone-ringing-1.mp3',
    hint: '연락 수단',
    answers: ['전화', '전화벨', '핸드폰', 'phone'],
    difficulty: 1
  },
  {
    id: 'q007', category: '탈것',
    audioUrl: 'https://www.soundjay.com/transportation/sounds/train-2.mp3',
    hint: '철로 위를 달리는 것',
    answers: ['기차', '열차', 'train'],
    difficulty: 1
  },
  {
    id: 'q008', category: '자연',
    audioUrl: 'https://www.soundjay.com/nature/sounds/ocean-wave-1.mp3',
    hint: '바닷가에서 들리는 소리',
    answers: ['파도', '바다', '파도 소리', 'ocean', 'wave'],
    difficulty: 1
  },
  {
    id: 'q009', category: '생활',
    audioUrl: 'https://www.soundjay.com/misc/sounds/clock-ticking-2.mp3',
    hint: '시간을 알려주는 것',
    answers: ['시계', '시계 소리', 'clock'],
    difficulty: 1
  },
  {
    id: 'q010', category: '동물',
    audioUrl: 'https://www.soundjay.com/nature/sounds/rooster-1.mp3',
    hint: '새벽을 알리는 농장 동물',
    answers: ['닭', '수탉', '닭 울음', 'rooster', '꼬끼오'],
    difficulty: 2
  }
];

// ── Utility functions ─────────────────────────────────────────

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function getRandomQuestions(count = 10) {
  const shuffled = [...QUIZ_DATA].sort(() => Math.random() - 0.5);
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
          totalRounds: 10,
          targetScore: 5,
          questions: [],
          roundTimer: null,
          answeredThisRound: false,
          firstCorrectPlayerId: null
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
    try {
      const room = rooms.get(socket.data.roomCode);
      if (!room) return cb?.({ error: '방을 찾을 수 없습니다.' });
      if (room.hostId !== socket.id) return cb?.({ error: '방장만 게임을 시작할 수 있습니다.' });
      if (room.players.length < 1) return cb?.({ error: '최소 1명 이상 필요합니다.' });

      room.status = 'PLAYING';
      room.currentRound = 0;
      room.targetScore = targetScore;
      room.questions = getRandomQuestions(10);
      room.players.forEach(p => { p.score = 0; });

      io.to(room.code).emit('room_update', getRoomState(room));
      io.to(room.code).emit('game_started', { totalRounds: room.questions.length, targetScore });

      cb?.({ success: true });
      setTimeout(() => startRound(room), 1500);
    } catch (e) {
      console.error(e);
      cb?.({ error: '서버 오류가 발생했습니다.' });
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

        // Score: correct player +1
        player.score += 1;

        io.to(room.code).emit('answer_result', {
          correct: true,
          winnerId: socket.id,
          winnerNickname: player.nickname,
          answer: question.answers[0],
          scores: room.players.map(p => ({ id: p.id, nickname: p.nickname, score: p.score }))
        });

        setTimeout(() => checkEndOrNextRound(room), 2500);
      } else {
        // Tell only this player it was wrong
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
  room.currentRound += 1;
  room.answeredThisRound = false;
  room.firstCorrectPlayerId = null;

  const question = room.questions[room.currentRound - 1];
  if (!question) return endGame(room);

  io.to(room.code).emit('round_start', {
    round: room.currentRound,
    totalRounds: room.questions.length,
    category: question.category,
    hint: question.hint,
    audioUrl: question.audioUrl,
    timeLimit: 15
  });

  // Round timer: 15 seconds
  room.roundTimer = setTimeout(() => {
    if (!room.answeredThisRound) {
      // No correct answer → everyone else gets +1 (original board game rule)
      room.players.forEach(p => { p.score += 1; });

      io.to(room.code).emit('answer_result', {
        correct: false,
        noWinner: true,
        answer: question.answers[0],
        message: '시간 초과! 모두에게 1점이 주어집니다.',
        scores: room.players.map(p => ({ id: p.id, nickname: p.nickname, score: p.score }))
      });

      setTimeout(() => checkEndOrNextRound(room), 2500);
    }
  }, 15000);
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

  const sorted = [...room.players].sort((a, b) => b.score - a.score);
  room.status = 'WAITING';
  room.currentRound = 0;
  room.players.forEach(p => { p.score = 0; p.isReady = false; });

  io.to(room.code).emit('game_over', {
    winner: sorted[0],
    finalScores: sorted,
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
