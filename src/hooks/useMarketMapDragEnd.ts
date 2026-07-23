import { useQueryClient } from '@tanstack/react-query'
import type { DragEndEvent } from '@dnd-kit/core'
import { reassignCategory, registerExcludedStock } from '@/api/marketMap'
import { marketMapKeys } from './queryKeys'

export function useMarketMapDragEnd() {
  const queryClient = useQueryClient()

  return async (event: DragEndEvent) => {
    const dragData = event.active.data.current as { stockCode: string } | undefined
    if (!dragData) return

    const targetCategory = event.over?.id as string | undefined

    try {
      if (targetCategory) {
        await reassignCategory(dragData.stockCode, targetCategory)
      } else {
        await registerExcludedStock(dragData.stockCode)
      }
      queryClient.invalidateQueries({ queryKey: marketMapKeys.all })
    } catch (e) {
      console.error('마켓맵 드래그 처리 실패', e)
    }
  }
}
