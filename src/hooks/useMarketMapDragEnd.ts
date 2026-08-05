import { useQueryClient } from '@tanstack/react-query'
import type { DragEndEvent } from '@dnd-kit/core'
import { registerExcludedStock } from '@/api/marketMap'
import { marketMapKeys } from './queryKeys'

export function useMarketMapDragEnd() {
  const queryClient = useQueryClient()

  return async (event: DragEndEvent) => {
    const dragData = event.active.data.current as { stockCode: string } | undefined
    if (!dragData || event.over) return

    try {
      await registerExcludedStock(dragData.stockCode)
      queryClient.invalidateQueries({ queryKey: marketMapKeys.all })
    } catch (e) {
      console.error('마켓맵 드래그 처리 실패', e)
    }
  }
}
