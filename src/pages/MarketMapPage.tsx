import { useState } from 'react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import NavBar from '@/components/NavBar'
import TabSelector from '@/components/TabSelector'
import MarketMapTreemap from '@/components/MarketMapTreemap'
import MarketMapManageSidebar from '@/components/MarketMapManageSidebar'
import { useMarketMap } from '@/hooks/useMarketMap'
import { useMarketMapDragEnd } from '@/hooks/useMarketMapDragEnd'
import { toHourLabel } from '@/utils/format'
import { MarketSchema, type Market } from '@/types/api'

const MARKETS = MarketSchema.options

export default function MarketMapPage() {
  const [market, setMarket] = useState<Market>('KOSPI')
  const [isExclude, setIsExclude] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeItem, setActiveItem] = useState<{ stockCode: string; stockName: string } | null>(null)
  const [isOverMap, setIsOverMap] = useState(true)

  const { data, isLoading, isError } = useMarketMap(market, isExclude)
  const handleDragEnd = useMarketMapDragEnd()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const allGroups = data?.items ?? []
  const groups = selectedCategory ? allGroups.filter(g => g.categoryName === selectedCategory) : allGroups

  const handleMarketChange = (next: Market) => {
    setMarket(next)
    setSelectedCategory(null)
  }

  const handleSelectCategory = (categoryName: string) => {
    setSelectedCategory(prev => (prev === categoryName ? null : categoryName))
  }

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as { stockCode: string; stockName: string } | undefined
    setActiveItem(data ?? null)
    setIsOverMap(true)
  }

  const handleDragOver = (event: DragOverEvent) => {
    setIsOverMap(event.over != null)
  }

  const handleDragEndAndReset = (event: DragEndEvent) => {
    setActiveItem(null)
    handleDragEnd(event)
  }

  const handleDragCancel = () => {
    setActiveItem(null)
  }

  return (
    <div className="min-h-screen">
      <NavBar />
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEndAndReset}
        onDragCancel={handleDragCancel}
      >
        <div className="p-4">
          <div className="mx-auto max-w-[1400px]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <TabSelector options={MARKETS} value={market} onChange={handleMarketChange} />
                <button
                  type="button"
                  className={`nes-btn ml-6 text-base ${isExclude ? 'is-primary' : ''}`}
                  onClick={() => setIsExclude(prev => !prev)}
                >
                  대형주 제외
                </button>
              </div>
              <div className="flex items-center gap-2">
                {data?.snapshotTime && (
                  <span className="text-xs text-gray-500">기준: {toHourLabel(data.snapshotTime)}</span>
                )}
                <button type="button" className="nes-btn text-base text-white" onClick={() => setSidebarOpen(true)}>
                  종목관리
                </button>
              </div>
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-xs text-gray-500">불러오는 중...</div>
            ) : isError ? (
              <div className="p-8 text-center text-xs text-gray-500">데이터를 불러오지 못했습니다</div>
            ) : groups.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500">데이터가 없습니다</div>
            ) : (
              <MarketMapTreemap groups={groups} onSelectCategory={handleSelectCategory} />
            )}
          </div>
        </div>
      </DndContext>

      {activeItem && !isOverMap && (
        <div className="pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 text-center text-white">
          <div>
            <div className="text-lg font-bold">종목명: {activeItem.stockName}</div>
            <div className="text-lg font-bold">마켓맵에서 제외</div>
          </div>
        </div>
      )}

      <MarketMapManageSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </div>
  )
}
