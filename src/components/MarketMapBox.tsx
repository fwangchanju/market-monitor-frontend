import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useDraggable } from '@dnd-kit/core'
import type { MarketMapItem } from '@/types/api'
import { toPctSigned, toVolume } from '@/utils/format'

interface Props {
  item: MarketMapItem
  x: number
  y: number
  width: number
  height: number
  categoryName: string
}

const MIN_NAME_WIDTH = 16
const MIN_NAME_HEIGHT = 14
const MIN_PERCENT_HEIGHT = 28

function boxColorClass(changeRate: number): string {
  if (changeRate > 0) return 'bg-red-600'
  if (changeRate < 0) return 'bg-blue-600'
  return 'bg-gray-600'
}

function fontSizePx(width: number, height: number): number {
  return Math.max(12, Math.min(22, Math.min(width, height) / 5))
}

export default function MarketMapBox({ item, x, y, width, height, categoryName }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.stockCode,
    data: { stockCode: item.stockCode, stockName: item.stockName, categoryName },
  })
  const [hover, setHover] = useState(false)
  const [tooltipPos, setTooltipPos] = useState<{ left: number; top: number } | null>(null)

  const showName = width >= MIN_NAME_WIDTH && height >= MIN_NAME_HEIGHT
  const showPercent = showName && height >= MIN_PERCENT_HEIGHT
  const fontSize = fontSizePx(width, height)

  const handleMouseEnter = (e: React.MouseEvent) => {
    setHover(true)
    setTooltipPos({ left: e.clientX + 12, top: e.clientY - 8 })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    setTooltipPos({ left: e.clientX + 12, top: e.clientY - 8 })
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        zIndex: isDragging || hover ? 20 : undefined,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHover(false)}
      {...listeners}
      {...attributes}
      className={`flex cursor-grab flex-col items-center justify-center overflow-hidden border text-white ${hover ? 'border-2 border-white brightness-125' : 'border border-black/40'} ${boxColorClass(item.changeRate)}`}
    >
      {showName && (
        <span className="w-full truncate px-1 text-center leading-tight" style={{ fontSize }}>
          {item.stockName}
        </span>
      )}
      {showPercent && (
        <span className="text-center leading-tight" style={{ fontSize: fontSize * 0.85 }}>
          {toPctSigned(item.changeRate)}
        </span>
      )}

      {hover &&
        tooltipPos &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[9999] w-max whitespace-nowrap rounded border border-gray-600 bg-[var(--surface)] px-2 py-1 text-left text-xs text-white shadow-lg"
            style={{ left: tooltipPos.left, top: tooltipPos.top }}
          >
            <div className="font-bold">{item.stockName}</div>
            <div>전일종가: {toVolume(item.lastPrice)}원</div>
            <div>시가총액: {toVolume(Math.round(item.totalMarketValue / 100_000_000))}억</div>
            <div>기준: {item.snapshotTime.slice(0, 16).replace('T', ' ')}</div>
          </div>,
          document.body,
        )}
    </div>
  )
}
