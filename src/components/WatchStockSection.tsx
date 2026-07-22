import { useDroppable } from '@dnd-kit/core'
import { useWatchStocks } from '@/hooks/useWatchStocks'
import DraggableStockChip from './DraggableStockChip'

export default function WatchStockSection() {
  const { data, isError } = useWatchStocks()
  const items = data?.filter(s => !s.isMain)
  const { setNodeRef, isOver } = useDroppable({ id: 'watch-stock-zone' })

  return (
    <div className="nes-container with-title">
      <p className="title">관심 종목{items ? ` (${items.length})` : ''}</p>
      <div
        ref={setNodeRef}
        className={`flex h-56 flex-col gap-2 overflow-y-auto ${isOver ? 'bg-gray-200' : ''}`}
      >
        {!items ? (
          <p className="nes-text is-disabled text-xs">
            {isError ? '데이터를 불러오지 못했습니다' : '불러오는 중...'}
          </p>
        ) : items.length === 0 ? (
          <p className="nes-text is-disabled text-xs">등록된 관심 종목이 없습니다</p>
        ) : (
          items.map(item => (
            <DraggableStockChip
              key={item.stockCode}
              source="watch"
              stockCode={item.stockCode}
              stockName={item.stockName}
            />
          ))
        )}
      </div>
    </div>
  )
}
