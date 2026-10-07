import { useEffect, useState } from 'react'
import { currentMarketPhase, shouldShowAfterHoursControls, type MarketPhase } from '@/utils/tradingWindow'

// 지금 시장 시간대(프리장/정규장/애프터/장 마감) — 페이지를 열어 둔 채 경계 시각을 지나도 바뀌도록 30초마다 다시 본다.
export function useMarketPhase(): MarketPhase {
  const [phase, setPhase] = useState(() => currentMarketPhase(new Date()))
  useEffect(() => {
    const timer = window.setInterval(() => setPhase(currentMarketPhase(new Date())), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  return phase
}

export function useAfterHoursControlsVisible(): boolean {
  const [visible, setVisible] = useState(() => shouldShowAfterHoursControls(new Date()))
  useEffect(() => {
    const update = () => setVisible(shouldShowAfterHoursControls(new Date()))
    const timer = window.setInterval(update, 30_000)
    window.addEventListener('focus', update)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', update)
    }
  }, [])
  return visible
}
