// client/src/utils/avatars.js
// 선택 가능한 아바타(이모지) 공용 목록 — Title/Lobby/Game/GameOver 화면이 함께 사용.
// 기존 12개에서 18개로 확장(우주·판타지 테마 유지).
export const AVATARS = [
  '🚀', '⭐', '🌙', '💫', '🪐', '☄️', '🌟', '🎵', '👾', '🛸', '🌌', '🔭',
  '🌍', '👽', '🌠', '⚡', '🌈', '🔥'
]

// 아바타를 직접 고르지 않은 플레이어를 위한 결정적 fallback (id 기반).
export function getAvatar(id) {
  return AVATARS[(id?.charCodeAt(id.length - 1) || 0) % AVATARS.length]
}
