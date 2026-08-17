import { useDroppable } from '@dnd-kit/core'
import { useWatchStocks } from '@/hooks/useWatchStocks'
import DraggableStockChip from './DraggableStockChip'
import Spinner from './Spinner'

export default function MainStockSection() {
  const { data, isLoading } = useWatchStocks()
  const mainStock = data?.find(s => s.isMain)
  const { setNodeRef, isOver } = useDroppable({ id: 'main-stock-zone' })

  return (
    <div className="nes-container with-title is-dark">
      <p className="title text-sm">대표종목</p>
      <div
        ref={setNodeRef}
        className={`flex h-28 flex-col gap-2 overflow-y-auto ${isOver ? 'bg-gray-700' : ''}`}
      >
        {isLoading ? (
          <div className="flex justify-center p-4">
            <Spinner />
          </div>
        ) : (
          mainStock && <DraggableStockChip source="main" stockCode={mainStock.stockCode} stockName={mainStock.stockName} />
        )}
      </div>
    </div>
  )
}
