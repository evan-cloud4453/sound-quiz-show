// client/src/components/Copyright.jsx
// 전 화면 공통 저작권 표시.
//   - PC(768px 초과): 우하단 고정
//   - 모바일(768px 이하): 하단 중앙 고정 (safe-area 반영)
// pointer-events:none 이라 게임 조작을 절대 가로막지 않는다.
import React from 'react'

export const COPYRIGHT_TEXT = '© 2026 Gio Kim. All Rights Reserved.'

export default function Copyright() {
  return (
    <div className="copyright-badge" role="contentinfo" aria-label="저작권 표시">
      {COPYRIGHT_TEXT}
    </div>
  )
}
