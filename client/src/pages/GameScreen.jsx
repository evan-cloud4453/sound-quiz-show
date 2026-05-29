// client/src/pages/GameScreen.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useGame } from '../utils/GameContext'
import { useSocket } from '../hooks/useSocket' 

import WaveformVisualizer from '../components/WaveformVisualizer'
import TimerRing from '../components/TimerRing'
import './GameScreen.css'

const YOUTUBE_PLAYER_STATE = {
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2
}

let youtubeApiPromise = null

function loadYouTubeApi() {
  if (typeof window === 'undefined') return Promise.reject(new Error('YouTube API requires a browser'))
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (youtubeApiPromise) return youtubeApiPromise

  youtubeApiPromise = new Promise((resolve, reject) => {
    const previousCallback = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.()
      resolve(window.YT)
    }

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      script.onerror = () => reject(new Error('Failed to load YouTube IFrame API'))
      document.head.appendChild(script)
    }
  })

  return youtubeApiPromise
}

function getClipEnd(start, end) {
  return end > start ? end : start + 10
}

const AVATARS = ['🚀', '⭐', '🌙', '💫', '🪐', '☄️', '🌟', '🎵', '👾', '🛸', '🌌', '🔭']
function getAvatar(id) {
  return AVATARS[(id?.charCodeAt(id.length - 1) || 0) % AVATARS.length]
}

export default function GameScreen() {
  const { state, submitAnswer } = useGame()
  const { emit } = useSocket()
  const {
    players, myId, nickname,
    currentRound, totalRounds, category, hint,
    youtubeId, youtubeStart, youtubeEnd,
    roundActive, lastResult, targetScore,
    isTimerRunning
  } = state

  const [soundUnlocked, setSoundUnlocked] = useState(false)
  const isUnlockingRef = useRef(false)
  const isPlayingRef = useRef(false)
  const hasPlayedIntroRef = useRef(false)

  const [answer, setAnswer] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [timerActive, setTimerActive] = useState(false)
  const [mediaLoaded, setMediaLoaded] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [flashWrong, setFlashWrong] = useState(false)
  const [phaseLabel, setPhaseLabel] = useState('시스템 접속 대기 중...')
  const [showResult, setShowResult] = useState(false)
  const [playbackBlocked, setPlaybackBlocked] = useState(false)
  const [playbackError, setPlaybackError] = useState(false)

  const inputRef = useRef(null)
  const playerRef = useRef(null)
  const playerHostIdRef = useRef(`Youtubeer-${Math.random().toString(36).slice(2)}`)
  const roundTokenRef = useRef(0)

  // 🚨 말썽을 일으키던 failSafeTimerRef를 영원히 삭제했습니다! 
  const audioStopTimerRef = useRef(null)
  const tickIntervalRef = useRef(null)
  const utteranceRef = useRef(null) 
  const stateChangeHandlerRef = useRef()

  // 💡 프리미엄 한국어 음성 렌더링 유지
  const getBestKoreanVoice = useCallback(() => {
    const voices = window.speechSynthesis.getVoices();
    const koreanVoices = voices.filter(v => v.lang.includes('ko'));
    const bestVoice = koreanVoices.find(v => 
      v.name.includes('Natural') || v.name.includes('Premium') || 
      v.name.includes('Google') || v.name.includes('Siri') || v.name.includes('Yuna')
    );
    return bestVoice || koreanVoices[0]; 
  }, []);

  const playTickSound = useCallback(() => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (!AudioContext) return
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(850, ctx.currentTime)
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.05)
    } catch (e) {}
  }, [])

  const clearTickTimers = useCallback(() => {
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    tickIntervalRef.current = null;
  }, [])

  useEffect(() => {
    let cancelled = false;
    loadYouTubeApi().then(YT => {
      if (cancelled) return;
      playerRef.current = new YT.Player(playerHostIdRef.current, {
        width: 220, height: 200, videoId: 'jNQXAC9IVRw', 
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, playsinline: 1, rel: 0 },
        events: {
          onReady: () => setMediaLoaded(true),
          onStateChange: (event) => stateChangeHandlerRef.current?.(event),
          onError: () => {
            if (isUnlockingRef.current) return; 
            clearTickTimers();
            setIsPlaying(false);
            // 에러가 나도 클라이언트가 멋대로 넘기지 않게 스킵 신호 발송 제거 (서버가 알아서 25초 대기 후 넘김)
            setPlaybackError(true);
          }
        }
      });
    });
    window.speechSynthesis.onvoiceschanged = getBestKoreanVoice;
    return () => { cancelled = true; playerRef.current?.destroy?.(); }
  }, [clearTickTimers, getBestKoreanVoice]);

  const handleUnlock = () => {
    setSoundUnlocked(true);
    isUnlockingRef.current = true;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      try {
        const ctx = new AudioContext();
        // 💡 아이폰에서 소리가 안 들리던 현상 수정 (볼륨 UP & 0.05초 여유 부여)
        const t = ctx.currentTime + 0.05; 
        const playNote = (freq, offset) => {
          const osc = ctx.createOscillator(); 
          const gain = ctx.createGain();
          osc.type = 'sine'; 
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.3, t + offset); 
          gain.gain.exponentialRampToValueAtTime(0.01, t + offset + 0.15);
          osc.connect(gain); 
          gain.connect(ctx.destination);
          osc.start(t + offset); 
          osc.stop(t + offset + 0.2);
        };
        playNote(523.25, 0);   
        playNote(659.25, 0.1); 
        playNote(783.99, 0.2); 
        playNote(1046.50, 0.3); 
      } catch(e) {}
    }
    if (playerRef.current && typeof playerRef.current.playVideo === 'function') playerRef.current.playVideo();
  };

  stateChangeHandlerRef.current = (event) => {
    if (isUnlockingRef.current && event.data === YOUTUBE_PLAYER_STATE.PLAYING) {
      try { playerRef.current?.pauseVideo?.(); } catch(e){}
      isUnlockingRef.current = false;
      return;
    }

    if (event.data === YOUTUBE_PLAYER_STATE.PLAYING) {
      setIsPlaying(true);
      setTimerActive(true);
      setPlaybackBlocked(false);
      setPlaybackError(false);
      setPhaseLabel('소리를 들어보세요!');

      if (!isPlayingRef.current) {
        isPlayingRef.current = true;
        emit('youtube_playing');
      }

      clearTimeout(audioStopTimerRef.current);
      // 💡 정확히 10초간 음악 재생 후 멈춤 -> 틱틱 소리 5번 작동 로직 (절대 스킵 아님!)
      audioStopTimerRef.current = setTimeout(() => {
        try { playerRef.current?.pauseVideo?.(); } catch (e) {}
        setIsPlaying(false);
        
        clearTickTimers();
        let tickCount = 0;
        tickIntervalRef.current = setInterval(() => {
          if (tickCount >= 5) {
            clearInterval(tickIntervalRef.current);
            return;
          }
          playTickSound();
          tickCount++;
        }, 1000);
      }, 10000);
    }

    if (event.data === YOUTUBE_PLAYER_STATE.PAUSED || event.data === YOUTUBE_PLAYER_STATE.ENDED) {
      if (!isUnlockingRef.current) setIsPlaying(false);
    }
  };

  useEffect(() => {
    if (!roundActive || !soundUnlocked) return;

    const roundToken = roundTokenRef.current + 1;
    roundTokenRef.current = roundToken;

    setAnswer(''); setSubmitted(false); setFlashWrong(false);
    setIsPlaying(false); isPlayingRef.current = false; isUnlockingRef.current = false; 
    setTimerActive(false); setShowResult(false); setPlaybackBlocked(false); setPlaybackError(false);
    setPhaseLabel('오디오 세팅 중...');

    clearTimeout(audioStopTimerRef.current);
    clearTickTimers();

    if (!youtubeId) { emit('skip_round'); return; }

    const startSeconds = Number(youtubeStart) || 0;
    const endSeconds = getClipEnd(startSeconds, Number(youtubeEnd) || 0);

    const executeVideoPlay = () => {
      if (roundTokenRef.current !== roundToken) return;
      if (playerRef.current?.loadVideoById) {
        playerRef.current.loadVideoById({ videoId: youtubeId, startSeconds, endSeconds });
        setTimeout(() => {
          if (roundTokenRef.current === roundToken) {
            try { playerRef.current?.playVideo(); } catch(e){}
          }
        }, 150);
      }
    };

    const playTopicAndVideo = () => {
      if (category && roundTokenRef.current === roundToken) {
        window.speechSynthesis.cancel();
        utteranceRef.current = new SpeechSynthesisUtterance(category);
        utteranceRef.current.lang = 'ko-KR';
        utteranceRef.current.voice = getBestKoreanVoice();
        utteranceRef.current.rate = 1.0; 
        
        let isExecuted = false;

        // 💡 주제 멘트 완료(onend) 후 정확히 1초 대기 후 노래 시작
        utteranceRef.current.onend = () => {
          if (!isExecuted && roundTokenRef.current === roundToken) {
            isExecuted = true;
            setTimeout(() => executeVideoPlay(), 1000); 
          }
        };

        // iOS 브라우저 묵음 버그 방어막: 4초 뒤 무조건 강제 실행
        setTimeout(() => {
          if (!isExecuted && roundTokenRef.current === roundToken) {
            isExecuted = true;
            executeVideoPlay();
          }
        }, 4000);

        window.speechSynthesis.speak(utteranceRef.current);
      } else {
        executeVideoPlay();
      }
    };

    if (currentRound === 1 && !hasPlayedIntroRef.current) {
      hasPlayedIntroRef.current = true;
      window.speechSynthesis.cancel();
      utteranceRef.current = new SpeechSynthesisUtterance(
        `여러분 안녕하세요. 소리를 듣고 정답을 최대한 빨리 맞춰주세요. 답이 무엇인지 알 것 같다면, 정답을 입력해주세요. 입력한 답이 맞다면 1점을 얻습니다. 10 라운드 내에 가장 먼저 ${targetScore}점을 달성한 사람이 승리합니다. 자, 이제 시작해볼까요?`
      );
      utteranceRef.current.lang = 'ko-KR';
      utteranceRef.current.voice = getBestKoreanVoice();
      utteranceRef.current.rate = 1.0; 
      
      let isExecuted = false;

      // 💡 오프닝 멘트 완료(onend) 후 정확히 2초 대기 후 주제 안내
      utteranceRef.current.onend = () => {
        if (!isExecuted && roundTokenRef.current === roundToken) {
          isExecuted = true;
          setTimeout(() => playTopicAndVideo(), 2000); 
        }
      };

      // 긴 멘트 방어막: 18초 뒤 강제 실행
      setTimeout(() => {
        if (!isExecuted && roundTokenRef.current === roundToken) {
          isExecuted = true;
          playTopicAndVideo();
        }
      }, 18000);

      setPhaseLabel('🎙️ 오프닝 안내 방송 중...');
      window.speechSynthesis.speak(utteranceRef.current);
    } else if (currentRound > 0) {
      playTopicAndVideo();
    }

  }, [roundActive, youtubeId, youtubeStart, youtubeEnd, soundUnlocked, emit, clearTickTimers, category, currentRound, targetScore, getBestKoreanVoice]);

  useEffect(() => {
    if (roundActive && soundUnlocked && inputRef.current) setTimeout(() => inputRef.current?.focus(), 300);
  }, [roundActive, soundUnlocked])

  useEffect(() => {
    if (!roundActive) {
      setTimerActive(false); clearTimeout(audioStopTimerRef.current); clearTickTimers();
    }
  }, [roundActive, clearTickTimers])

  useEffect(() => {
    if (lastResult) {
      const isRoundResult = lastResult.correct || lastResult.noWinner || lastResult.winnerId;
      if (!isRoundResult) return undefined;

      try { playerRef.current?.pauseVideo?.(); } catch (error) {}
      setIsPlaying(false); clearTickTimers(); 

      setShowResult(true);
      setPhaseLabel(lastResult.correct ? '🎉 정답!' : '⏰ 라운드 종료!');
      const t = setTimeout(() => setShowResult(false), 2500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [lastResult, clearTickTimers])

  const handleSubmit = useCallback(() => {
    if (!answer.trim() || submitted || !roundActive) return;
    setSubmitted(true); submitAnswer(answer.trim());
  }, [answer, submitted, roundActive, submitAnswer])

  const handleKey = (e) => { if (e.key === 'Enter') handleSubmit() }

  useEffect(() => {
    if (lastResult && !lastResult.correct && !lastResult.noWinner && !lastResult.winnerId) {
      setSubmitted(false); setAnswer(''); setFlashWrong(true);
      setTimeout(() => setFlashWrong(false), 600); inputRef.current?.focus();
    }
  }, [lastResult])

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score)
  const progressPct = totalRounds > 0 ? ((currentRound - 1) / totalRounds) * 100 : 0

  return (
    <div className={`game-screen ${flashWrong ? 'flash-wrong' : ''}`}>
      {!soundUnlocked && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(9, 9, 11, 0.95)', zIndex: 99999,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          color: '#fff', cursor: 'pointer', backdropFilter: 'blur(15px)'
        }} onClick={handleUnlock}>
          <div style={{ fontSize: '5rem', marginBottom: '20px', animation: 'bounce 1s infinite' }}>👆</div>
          <h2 style={{ fontSize: '2rem', color: '#06b6d4', textShadow: '0 0 15px rgba(6,182,212,0.6)', textAlign: 'center', wordBreak: 'keep-all', padding: '0 20px' }}>
            화면을 터치해서 접속하세요
          </h2>
          <p style={{ marginTop: '15px', color: '#94a3b8', fontSize: '1.1rem', textAlign: 'center' }}>
            모바일 기기 정책으로 인해 터치 후 오디오 시스템이 연결됩니다.
          </p>
        </div>
      )}

      {showResult && lastResult && (
        <div className={`result-overlay ${lastResult.correct || lastResult.noWinner ? 'show' : ''}`}>
          {lastResult.winnerId && (
            <div className="result-banner correct animate-scaleIn">
              <div className="result-icon">🎯</div>
              <div className="result-text">
                <span className="result-winner">{lastResult.winnerNickname}</span>
                <span>정답!</span>
              </div>
              <div className="result-answer">정답: {lastResult.answer}</div>
            </div>
          )}
          {lastResult.noWinner && (
            <div className="result-banner timeout animate-scaleIn">
              <div className="result-icon">⏰</div>
              <div className="result-text">시간 초과!</div>
              <div className="result-answer">정답: {lastResult.answer}</div>
              <div className="result-sub">{lastResult.message || '아무도 점수를 얻지 못했습니다 (0점)'}</div>
            </div>
          )}
        </div>
      )}

      <div className="game-layout">
        <div className="scoreboard-panel glass-panel">
          <div className="scoreboard-title">🏆 스코어보드</div>
          <div className="score-list">
            {sortedPlayers.map((p, i) => {
              const isMe = p.id === myId || p.nickname === nickname
              const isWinner = lastResult?.winnerId === p.id
              return (
                <div key={p.id} className={`score-row ${isMe ? 'me' : ''} ${isWinner ? 'just-won' : ''}`}>
                  <span className="rank-num">{i + 1}</span>
                  <span className="player-ava">{getAvatar(p.id)}</span>
                  <span className="score-name">
                    {p.nickname}
                    {isMe && <span className="me-badge">나</span>}
                  </span>
                  <div className="score-bar-wrap">
                    <div className="score-bar" style={{ width: `${Math.min((p.score / targetScore) * 100, 100)}%` }} />
                  </div>
                  <span className="score-num">{p.score}</span>
                  <span className="score-target">/{targetScore}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="game-center">
          <div className="round-progress">
            <div className="round-info">
              <span className="glow-cyan">라운드 {currentRound === 0 ? 1 : currentRound}</span>
              <span className="text-secondary"> / {totalRounds}</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          {category && (
            <div className="category-row animate-fadeIn">
              <div className="category-badge">🎵 {category}</div>
              {hint && <span className="hint-text">힌트: {hint}</span>}
            </div>
          )}

          <div className="audio-area glass-panel">
            <div className="audio-inner youtube-audio-inner">
              <div className="youtube-player-shell">
                <div id={playerHostIdRef.current} />
              </div>

              <div className="youtube-sound-panel">
                {mediaLoaded ? (
                  <WaveformVisualizer isPlaying={isPlaying} />
                ) : (
                  <div className="audio-loading">
                    <div className="loading-spinner" />
                    <span>사운드 로딩 중...</span>
                  </div>
                )}
                {playbackError && (
                  <div className="audio-error">영상을 재생할 수 없습니다.</div>
                )}
                <div className="phase-label">{phaseLabel}</div>
              </div>
            </div>
          </div>

          <div className={`answer-area glass-panel ${roundActive ? 'active' : ''}`}>
            {roundActive ? (
              <>
                <div className="answer-row">
                  <input
                    ref={inputRef}
                    className={`input answer-input ${flashWrong ? 'wrong' : ''}`}
                    placeholder="정답을 입력하세요..."
                    value={answer}
                    onChange={e => setAnswer(e.target.value)}
                    onKeyDown={handleKey}
                    disabled={submitted && !flashWrong}
                    maxLength={40}
                    autoComplete="off"
                    autoCapitalize="none"
                  />
                  <button
                    className="btn btn-primary submit-btn"
                    onClick={handleSubmit}
                    disabled={!answer.trim() || (submitted && !flashWrong)}
                  >
                    제출 ↵
                  </button>
                </div>
                {submitted && !flashWrong && (
                  <p className="submitted-hint">⏳ 판정 중... 다른 플레이어를 기다리세요</p>
                )}
                {flashWrong && (
                  <p className="wrong-hint">❌ 틀렸습니다! 다시 시도해보세요.</p>
                )}
              </>
            ) : (
              <p className="waiting-next">⏳ {currentRound === 1 && !hasPlayedIntroRef.current ? '오프닝 안내 방송 중...' : '다음 라운드 준비 중...'}</p>
            )}
          </div>
        </div>

        <div className="timer-panel glass-panel">
          <div className="timer-label">남은 시간</div>
          <TimerRing
            timeLimit={state.timeLimit || 15}
            active={isTimerRunning || timerActive} 
          />
          <div className="timer-hint">빠를수록 유리!</div>
        </div>
      </div>
    </div>
  )
}
