import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { MarketMapItem } from '@/types/api'
import { toJoEok, toPctSigned, toVolume } from '@/utils/format'

interface Props {
  item: MarketMapItem
  x: number
  y: number
  width: number
  height: number
  tooltipAlignLeft: boolean
  tooltipAlignTop: boolean
}

const MIN_NAME_WIDTH = 16
const MIN_NAME_HEIGHT = 14
const MIN_PERCENT_HEIGHT = 28

// 등락률 크기에 따라 색상을 4단계로 차등(2%/5%/8%p 기준, ±8%p 초과는 최대 단계로 고정).
// 0에 가까울수록 탁하고 짙은 톤, 멀어질수록 쨍하고 선명한 톤으로 — 핀비즈 히트맵과 동일한 방향.
function boxColorClass(changeRate: number): string {
  if (changeRate === 0) return 'bg-gray-600'
  const abs = Math.abs(changeRate)
  if (changeRate > 0) {
    if (abs > 8) return 'bg-red-500'
    if (abs > 5) return 'bg-red-700'
    if (abs > 2) return 'bg-red-900'
    return 'bg-red-950'
  }
  if (abs > 8) return 'bg-blue-500'
  if (abs > 5) return 'bg-blue-700'
  if (abs > 2) return 'bg-blue-900'
  return 'bg-blue-950'
}

function fontSizePx(width: number, height: number): number {
  return Math.max(12, Math.min(22, Math.min(width, height) / 5))
}

export default function MarketMapBox({ item, x, y, width, height, tooltipAlignLeft, tooltipAlignTop }: Props) {
  const [hover, setHover] = useState(false)
  const [tooltipPos, setTooltipPos] = useState<{ left: number; top: number } | null>(null)

  const showName = width >= MIN_NAME_WIDTH && height >= MIN_NAME_HEIGHT
  const showPercent = showName && height >= MIN_PERCENT_HEIGHT
  const fontSize = fontSizePx(width, height)

  const updateTooltipPos = (e: React.MouseEvent) => {
    setTooltipPos({
      left: e.clientX + (tooltipAlignLeft ? -12 : 12),
      top: e.clientY + (tooltipAlignTop ? -8 : 8),
    })
  }

  const handleMouseEnter = (e: React.MouseEvent) => {
    setHover(true)
    updateTooltipPos(e)
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        zIndex: hover ? 20 : undefined,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseMove={updateTooltipPos}
      onMouseLeave={() => setHover(false)}
      className={`flex flex-col items-center justify-center overflow-hidden border text-white ${hover ? 'border-2 border-yellow-600' : 'border border-black/40'} ${boxColorClass(item.changeRate)}`}
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
            style={{
              left: tooltipPos.left,
              top: tooltipPos.top,
              transform: `translate(${tooltipAlignLeft ? '-100%' : '0'}, ${tooltipAlignTop ? '-100%' : '0'})`,
            }}
          >
            <div className="font-bold">{item.stockName}</div>
            <div>등락률: {toPctSigned(item.changeRate)}</div>
            <div>현재가: {toVolume(item.currentPrice)}원</div>
            <div>전일종가: {toVolume(item.lastPrice)}원</div>
            <div>시가총액: {toJoEok(item.totalMarketValue / 100_000_000)}</div>
          </div>,
          document.body,
        )}
    </div>
  )
}
