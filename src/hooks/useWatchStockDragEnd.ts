import { useQueryClient } from '@tanstack/react-query'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  registerWatchStock,
  registerAsPrimaryWatchStock,
  designateAsPrimaryWatchStock,
  unregisterWatchStock,
  clearPrimaryWatchStock,
} from '@/api/marketSummary'
import { watchStockKeys } from './queryKeys'

type Source = 'main' | 'watch' | 'search'
type Target = 'main-stock-zone' | 'watch-stock-zone'

function resolveAction(source: Source, target: Target | undefined) {
  if (source === 'search') {
    if (target === 'watch-stock-zone') return registerWatchStock
    if (target === 'main-stock-zone') return registerAsPrimaryWatchStock
    return null
  }
  if (source === 'watch') {
    if (target === 'main-stock-zone') return designateAsPrimaryWatchStock
    if (target === undefined) return unregisterWatchStock
    return null
  }
  if (target === 'watch-stock-zone') return clearPrimaryWatchStock
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
