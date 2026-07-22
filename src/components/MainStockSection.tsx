import { useDroppable } from '@dnd-kit/core'
import { useWatchStocks } from '@/hooks/useWatchStocks'
import DraggableStockChip from './DraggableStockChip'

export default function MainStockSection() {
  const { data } = useWatchStocks()
  const mainStock = data?.find(s => s.isMain)
  const { setNodeRef, isOver } = useDroppable({ id: 'main-stock-zone' })

  return (
    <div className="nes-container with-title">
      <p className="title">대표 종목</p>
      <div
        ref={setNodeRef}
        className={`flex h-56 items-center justify-center ${isOver ? 'bg-gray-200' : ''}`}
      >
        {mainStock ? (
          <DraggableStockChip source="main" stockCode={mainStock.stockCode} stockName={mainStock.stockName} />
        ) : (
          <p className="nes-text is-disabled text-xs">드래그해서 대표종목으로 지정하세요</p>
        )}
      </div>
    </div>
  )
}
