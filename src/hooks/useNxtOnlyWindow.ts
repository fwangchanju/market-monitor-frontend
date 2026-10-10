import { currentNxtOnlyWindow, type NxtOnlyWindow } from '@/utils/tradingWindow'
import { useMarketTradingSchedule } from './useMarketTradingSchedule'

// 종가·과거 날짜를 조회할 때도 기존처럼 현재 시간대의 자동 필터를 유지한다.
export function useNxtOnlyWindow(): NxtOnlyWindow | null {
  const { now, schedule } = useMarketTradingSchedule()
  return currentNxtOnlyWindow(now, schedule)
}
