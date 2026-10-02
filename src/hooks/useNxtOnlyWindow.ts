import { useEffect, useState } from 'react'
import { currentNxtOnlyWindow, type NxtOnlyWindow } from '@/utils/tradingWindow'

// 지금 NXT 단독 시간대인지(그렇다면 어느 시간대인지) — 페이지를 열어 둔 채 경계 시각(08:50, 16:00 등)을 지나도 바뀌도록
// 30초마다 다시 본다. 같은 시간대면 같은 객체를 돌려줘서 불필요하게 다시 그리지 않는다.
export function useNxtOnlyWindow(): NxtOnlyWindow | null {
  const [window_, setWindow] = useState(() => currentNxtOnlyWindow(new Date()))
  useEffect(() => {
    const timer = window.setInterval(() => setWindow(currentNxtOnlyWindow(new Date())), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  return window_
}
