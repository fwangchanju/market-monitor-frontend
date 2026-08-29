import { useQueryClient } from '@tanstack/react-query'
import type { DragEndEvent } from '@dnd-kit/core'
import { designateAsPrimaryWatchStock, unregisterWatchStock } from '@/api/marketSummary'
import { watchStockKeys } from './queryKeys'

type Source = 'main' | 'watch' | 'search'
type Target = 'main-stock-zone' | 'watch-stock-zone'

// 관심종목 신규 등록/유지 액션은 진입점 자체를 막음(search→어디든, main→watch-stock-zone) — 승격(watch→main
// 대표지정)과 완전 해제(watch/main→zone 밖)만 남긴다.
function resolveAction(source: Source, target: Target | undefined) {
  if (source === 'search') return null
  if (source === 'watch') {
    if (target === 'main-stock-zone') return designateAsPrimaryWatchStock
    if (target === undefined) return unregisterWatchStock
    return null
  }
  if (target === undefined) return unregisterWatchStock
  return null
}

export function useWatchStockDragEnd() {
  const queryClient = useQueryClient()

  return async (event: DragEndEvent) => {
    const dragData = event.active.data.current as { source: Source; stockCode: string } | undefined
    if (!dragData) return

    const target = event.over?.id as Target | undefined
    const action = resolveAction(dragData.source, target)
    if (!action) return

    try {
      await action(dragData.stockCode)
      queryClient.invalidateQueries({ queryKey: watchStockKeys.all })
    } catch (e) {
      console.error('관심종목 드래그 처리 실패', e)
    }
  }
}
