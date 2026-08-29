import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { MarketMapItem } from '@/types/api'
import { toJoEok, toPctSigned, toVolume } from '@/utils/format'
import { resolveMarketMapColor, type ColorScaleConfig } from '@/utils/marketMapColorScale'

interface Props {
  item: MarketMapItem
  x: number
  y: number
  width: number
  height: number
  tooltipAlignLeft: boolean
  tooltipAlignTop: boolean
  // 박스 색칠은 이 설정 하나로만 결정된다(resolveMarketMapColor) — 범례 바(MarketMapCustomPage)도
  // 같은 설정 + 같은 함수를 거치므로 두 화면이 항상 수학적으로 일치한다.
  colorScale: ColorScaleConfig
}

const MIN_NAME_WIDTH = 16
const MIN_NAME_HEIGHT = 14
const MIN_PERCENT_HEIGHT = 28

function fontSizePx(width: number, height: number): number {
  return Math.max(12, Math.min(22, Math.min(width, height) / 5))
}

export default function MarketMapBox({ item, x, y, width, height, tooltipAlignLeft, tooltipAlignTop, colorScale }: Props) {
  const [hover, setHover] = useState(false)
  const [tooltipPos, setTooltipPos] = useState<{ left: number; top: number } | null>(null)

  const showName = width >= MIN_NAME_WIDTH && height >= MIN_NAME_HEIGHT
  const showPercent = showName && height >= MIN_PERCENT_HEIGHT
  const fontSize = fontSizePx(width, height)
  const backgroundColor = resolveMarketMapColor(item.changeRate, colorScale)

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
        backgroundColor,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseMove={updateTooltipPos}
      onMouseLeave={() => setHover(false)}
      className={`flex flex-col items-center justify-center overflow-hidden border text-white ${hover ? 'border-2 border-yellow-600' : 'border border-black/40'}`}
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
