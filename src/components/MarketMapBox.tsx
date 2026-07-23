import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { MarketMapItem } from '@/types/api'
import { toPctSigned, toVolume } from '@/utils/format'

interface Props {
  item: MarketMapItem
  x: number
  y: number
  width: number
  height: number
  share: number
}

const TEXT_VISIBILITY_THRESHOLD = 0.02

function boxColorClass(changeRate: number): string {
  if (changeRate > 0) return 'bg-red-600'
  if (changeRate < 0) return 'bg-blue-600'
  return 'bg-gray-600'
}

function fontSizePx(width: number, height: number): number {
  return Math.max(12, Math.min(22, Math.min(width, height) / 5))
}

export default function MarketMapBox({ item, x, y, width, height, share }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.stockCode,
    data: { stockCode: item.stockCode },
  })
  const [hover, setHover] = useState(false)

  const showText = share >= TEXT_VISIBILITY_THRESHOLD
  const fontSize = fontSizePx(width, height)

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
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      {...listeners}
      {...attributes}
      className={`flex cursor-grab flex-col items-center justify-center overflow-hidden border border-black/40 text-white ${boxColorClass(item.changeRate)}`}
    >
      {showText && (
        <>
          <span className="w-full truncate px-1 text-center leading-tight" style={{ fontSize }}>
            {item.stockName}
          </span>
          <span className="text-center leading-tight" style={{ fontSize: fontSize * 0.85 }}>
            {toPctSigned(item.changeRate)}
          </span>
        </>
      )}

      {hover && (
        <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-1 w-max -translate-x-1/2 whitespace-nowrap rounded border border-gray-600 bg-[var(--surface)] px-2 py-1 text-left text-xs text-white shadow-lg">
          <div className="font-bold">{item.stockName}</div>
          <div>전일종가: {toVolume(item.lastPrice)}원</div>
          <div>시가총액: {toVolume(Math.round(item.totalMarketValue / 100_000_000))}억</div>
          <div>기준: {item.snapshotTime.slice(0, 16).replace('T', ' ')}</div>
        </div>
      )}
    </div>
  )
}
