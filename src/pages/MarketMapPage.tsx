import { useRef, useState } from 'react'
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
import MarketMapFilterSidebar from '@/components/MarketMapFilterSidebar'
import MarketMapTreemap from '@/components/MarketMapTreemap'
import MarketMapManageSidebar from '@/components/MarketMapManageSidebar'
import { useMarketMap } from '@/hooks/useMarketMap'
import { useMarketMapDragEnd } from '@/hooks/useMarketMapDragEnd'
import { toHourLabel } from '@/utils/format'
import { captureElementToClipboard } from '@/utils/captureToClipboard'
import type { Market } from '@/types/api'

type CopyStatus = 'idle' | 'copying' | 'copied' | 'error'

export default function MarketMapPage() {
  const [market, setMarket] = useState<Market>('KOSPI')
  const [isExclude, setIsExclude] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeItem, setActiveItem] = useState<{ stockCode: string; stockName: string } | null>(null)
  const [isOverMap, setIsOverMap] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  const captureRef = useRef<HTMLDivElement>(null)

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

  const handleCopy = async () => {
    if (!captureRef.current) return
    setCopyStatus('copying')
    try {
      await captureElementToClipboard(captureRef.current)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('error')
    } finally {
      setTimeout(() => setCopyStatus('idle'), 2000)
    }
  }

  const copyLabel =
    copyStatus === 'copying' ? 'COPYING..' : copyStatus === 'copied' ? 'COPIED' : copyStatus === 'error' ? 'FAILED' : 'COPY'

  return (
    <div className="flex min-h-screen flex-col">
      {isFullscreen ? (
        <div className="flex items-center justify-end gap-2 bg-white px-2 py-1 shadow-lg">
          <button
            type="button"
            className="nes-btn px-2 py-0.5 text-xs border-red-600 bg-red-600 text-white hover:bg-red-700"
            onClick={() => setIsFullscreen(false)}
          >
            FULL
          </button>
          <button
            type="button"
            className="nes-btn px-2 py-0.5 text-xs border-red-600 bg-red-600 text-white hover:bg-red-700"
            onClick={handleCopy}
          >
            {copyLabel}
          </button>
        </div>
      ) : (
        <NavBar
          actions={
            <>
              {data?.snapshotTime && (
                <span className="whitespace-nowrap text-xs text-black">{toHourLabel(data.snapshotTime)}</span>
              )}
              <button
                type="button"
                className="nes-btn ml-6 border-red-600 bg-red-600 text-white hover:bg-red-700"
                onClick={() => setIsFullscreen(true)}
              >
                FULL
              </button>
              <button
                type="button"
                className="nes-btn ml-6 border-red-600 bg-red-600 text-white hover:bg-red-700"
                onClick={handleCopy}
              >
                {copyLabel}
              </button>
              <button type="button" className="nes-btn ml-6 text-white" onClick={() => setSidebarOpen(true)}>
                종목관리
              </button>
            </>
          }
        />
      )}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEndAndReset}
        onDragCancel={handleDragCancel}
      >
        <div className="flex flex-1">
          <MarketMapFilterSidebar
            market={market}
            onMarketChange={handleMarketChange}
            isExclude={isExclude}
            onToggleExclude={() => setIsExclude(prev => !prev)}
            compact={isFullscreen}
          />
          <div ref={captureRef} className="flex-1 p-4">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-gray-500">불러오는 중...</div>
            ) : isError ? (
              <div className="p-8 text-center text-xs text-gray-500">데이터를 불러오지 못했습니다</div>
            ) : groups.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500">데이터가 없습니다</div>
            ) : (
              <MarketMapTreemap
                groups={groups}
                onSelectCategory={handleSelectCategory}
                heightClassName={isFullscreen ? 'h-[calc(100vh-30px)]' : 'h-[70vh]'}
              />
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
