import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
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
import MarketMapSettingsDropdown from '@/components/MarketMapSettingsDropdown'
import MarketMapShareModal from '@/components/MarketMapShareModal'
import MarketMapTreemap from '@/components/MarketMapTreemap'
import Spinner from '@/components/Spinner'
import { ShareIcon, MaximizeIcon, MinimizeIcon } from '@/components/icons/MarketMapIcons'
import { useMarketMap } from '@/hooks/useMarketMap'
import { useMarketMapDragEnd } from '@/hooks/useMarketMapDragEnd'
import { useMarketMapDrilldown } from '@/hooks/useMarketMapDrilldown'
import type { DisplayGroup } from '@/hooks/useMarketMapLayout'
import { toHourLabel } from '@/utils/format'
import { captureElementToClipboard } from '@/utils/captureToClipboard'
import { CAPTURE_ID } from '@/utils/captureIds'
import { captureElementToDownload } from '@/utils/captureToDownload'
import { halfOverlapCollisionDetection } from '@/utils/dndCollision'
import type { Market, MarketMapCategoryNode } from '@/types/api'

function toDisplayGroup(node: MarketMapCategoryNode): DisplayGroup {
  return {
    categoryName: node.categoryName,
    totalMarketValue: node.totalMarketValue,
    items: node.items,
    children: node.children.map(toDisplayGroup),
  }
}

type CopyStatus = 'idle' | 'copying' | 'copied' | 'error'
type DownloadStatus = 'idle' | 'downloading' | 'error'

export default function MarketMapCustomPage() {
  const [market, setMarket] = useState<Market>('KOSPI')
  const [isExclude, setIsExclude] = useState(true)
  const [isCustom, setIsCustom] = useState(true)
  const [activeItem, setActiveItem] = useState<{ stockCode: string; stockName: string } | null>(null)
  const [isOverMap, setIsOverMap] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>('idle')
  const captureRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, isError } = useMarketMap(market, isExclude, isCustom)
  const handleDragEnd = useMarketMapDragEnd()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const rootNodes = data?.items ?? []
  const { path, currentNode, currentSiblings, enterCategory, goToDepth, reset } = useMarketMapDrilldown(rootNodes)

  const groups: DisplayGroup[] = currentNode ? [toDisplayGroup(currentNode)] : currentSiblings.map(toDisplayGroup)

  const handleMarketChange = (next: Market) => {
    setMarket(next)
    reset()
  }

  const handleToggleCustom = () => {
    setIsCustom(prev => !prev)
    reset()
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

  const handleDownload = async () => {
    if (!captureRef.current) return
    setDownloadStatus('downloading')
    try {
      await captureElementToDownload(captureRef.current, 'market-map.png')
      setDownloadStatus('idle')
    } catch {
      setDownloadStatus('error')
      setTimeout(() => setDownloadStatus('idle'), 2000)
    }
  }

  const copyLabel = copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Failed' : 'Copy'
  const downloadLabel = downloadStatus === 'error' ? 'Failed' : 'Download'

  return (
    <div className="flex min-h-screen flex-col">
      {isFullscreen ? (
        <div className="flex items-center justify-end gap-2 bg-white px-2 py-1 shadow-lg">
          <MarketMapSettingsDropdown
            isExclude={isExclude}
            onToggleExclude={() => setIsExclude(prev => !prev)}
            isCustom={isCustom}
            onToggleCustom={handleToggleCustom}
            compact
          />
          <button
            type="button"
            aria-label="공유"
            className="rounded p-1.5 text-gray-700 hover:bg-gray-100 hover:text-[#4f8fd6]"
            onClick={() => setIsShareOpen(true)}
          >
            <ShareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="전체화면 종료"
            className="rounded p-1.5 text-gray-700 hover:bg-gray-100 hover:text-[#4f8fd6]"
            onClick={() => setIsFullscreen(false)}
          >
            <MinimizeIcon className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <NavBar
          actions={
            <>
              {data?.snapshotTime && (
                <span className="whitespace-nowrap text-xs text-black">기준시간: {toHourLabel(data.snapshotTime).slice(11)}</span>
              )}
              <MarketMapSettingsDropdown
                isExclude={isExclude}
                onToggleExclude={() => setIsExclude(prev => !prev)}
                isCustom={isCustom}
                onToggleCustom={handleToggleCustom}
              />
              <button
                type="button"
                aria-label="공유"
                className="rounded p-1.5 text-gray-700 hover:bg-gray-100 hover:text-[#4f8fd6]"
                onClick={() => setIsShareOpen(true)}
              >
                <ShareIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="전체화면"
                className="rounded p-1.5 text-gray-700 hover:bg-gray-100 hover:text-[#4f8fd6]"
                onClick={() => setIsFullscreen(true)}
              >
                <MaximizeIcon className="h-5 w-5" />
              </button>
              <Link to="/admin/market-map" className="nes-btn ml-6 text-white">
                관리
              </Link>
            </>
          }
        />
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={halfOverlapCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEndAndReset}
        onDragCancel={handleDragCancel}
      >
        <div className="flex flex-1">
          <MarketMapFilterSidebar market={market} onMarketChange={handleMarketChange} compact={isFullscreen} />
          <div ref={captureRef} data-captureid={CAPTURE_ID.MARKET_MAP} className="flex-1 p-4">
            {path.length > 0 && (
              <div
                onClick={() => goToDepth(0)}
                className="mb-2 flex h-7 w-full cursor-pointer items-center gap-1 truncate border-2 border-white bg-black/70 px-1 text-sm font-bold text-white hover:text-yellow-400"
              >
                <span>전체</span>
                {path.map((name, index) => (
                  <span key={index} className="flex items-center gap-1">
                    <span>-</span>
                    {index === path.length - 1 ? (
                      <span>{name}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          goToDepth(index + 1)
                        }}
                        className="border-0 bg-transparent p-0 text-white hover:text-yellow-400"
                      >
                        {name}
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}
            {isLoading ? (
              <div
                className={`flex items-center justify-center ${isFullscreen ? 'h-[calc(100vh-80px)]' : 'h-[calc(100vh-110px)]'}`}
              >
                <Spinner />
              </div>
            ) : isError ? (
              <div className="p-8 text-center text-xs text-gray-500">데이터를 불러오지 못했습니다</div>
            ) : groups.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500">데이터가 없습니다</div>
            ) : (
              <MarketMapTreemap
                groups={groups}
                selfCategoryName={currentNode?.categoryName ?? null}
                onSelectCategory={enterCategory}
                heightClassName={isFullscreen ? 'h-[calc(100vh-80px)]' : 'h-[calc(100vh-110px)]'}
              />
            )}
          </div>
        </div>
      </DndContext>

      {isShareOpen && (
        <MarketMapShareModal
          onClose={() => setIsShareOpen(false)}
          onCopy={handleCopy}
          onDownload={handleDownload}
          copyLabel={copyLabel}
          downloadLabel={downloadLabel}
          isCopying={copyStatus === 'copying'}
          isDownloading={downloadStatus === 'downloading'}
          captureTarget={captureRef.current}
        />
      )}

      {activeItem && !isOverMap && (
        <div className="pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 text-center text-white">
          <div>
            <div className="text-lg font-bold">종목명: {activeItem.stockName}</div>
            <div className="text-lg font-bold">마켓맵에서 제외</div>
          </div>
        </div>
      )}
    </div>
  )
}
