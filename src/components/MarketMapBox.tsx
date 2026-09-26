import type { CSSProperties } from 'react'
import type { MarketMapPopupContent } from './MarketMapPopup'
import type { MarketMapItem } from '@/types/api'
import { toJoEok, toPctSigned, toVolume } from '@/utils/format'
import { resolveMarketMapColor, type ColorScaleConfig } from '@/utils/marketMapColorScale'
import type { StockLabelMode } from '@/hooks/useGlobalSettings'

interface Props {
  item: MarketMapItem
  x: number
  y: number
  width: number
  height: number
  // 이 박스가 전체 트리맵 컨테이너 넓이에서 차지하는 비중(%) — useMarketMapLayout에서 계산.
  areaPercent: number
  // 이 비중 미만이면 종목명/등락률을 아예 표시하지 않는다(설정 사이드바의 슬라이더로 조절).
  labelMinAreaPercent: number
  // 박스에 종목명만/등락률만/둘 다 보여줄지(설정 사이드바의 "종목 박스 표시 내용" 슬라이더) — 위 넓이
  // 기준을 넘어 실제로 보여줄 때(showLabel=true)만 적용된다. 툴팁 내용에는 영향 없음.
  stockLabelMode: StockLabelMode
  // 등락률(%) 표시 소수점 자릿수(설정 사이드바의 "소수점 아래 표시" 슬라이더).
  decimalPlaces: number
  tooltipAlignLeft: boolean
  tooltipAlignTop: boolean
  // 박스 색칠은 이 설정 하나로만 결정된다(resolveMarketMapColor) — 범례 바(MarketMapCustomPage)도
  // 같은 설정 + 같은 함수를 거치므로 두 화면이 항상 수학적으로 일치한다.
  colorScale: ColorScaleConfig
  onOpenPopup: (content: MarketMapPopupContent, e: React.MouseEvent, alignLeft: boolean, alignTop: boolean) => void
}

function fontSizePx(width: number, height: number): number {
  return Math.max(12, Math.min(22, Math.min(width, height) / 5))
}

export default function MarketMapBox({
  item,
  x,
  y,
  width,
  height,
  areaPercent,
  labelMinAreaPercent,
  stockLabelMode,
  decimalPlaces,
  tooltipAlignLeft,
  tooltipAlignTop,
  colorScale,
  onOpenPopup,
}: Props) {
  const showLabel = stockLabelMode !== 'off' && areaPercent >= labelMinAreaPercent
  const showName = stockLabelMode !== 'rateOnly'
  const showRate = stockLabelMode !== 'nameOnly'
  const fontSize = fontSizePx(width, height)
  const backgroundColor = resolveMarketMapColor(item.changeRate, colorScale)
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        backgroundColor,
        '--market-map-base-color': backgroundColor,
      } as CSSProperties}
      onContextMenu={e => {
        e.preventDefault()
        e.stopPropagation()
        onOpenPopup({
          title: item.stockName,
          rows: [
            `등락률: ${toPctSigned(item.changeRate, decimalPlaces)}`,
            `현재가: ${toVolume(item.currentPrice)}원`,
            `전일종가: ${toVolume(item.lastPrice)}원`,
            `시가총액: ${toJoEok(item.totalMarketValue / 100_000_000)}`,
          ],
        }, e, tooltipAlignLeft, tooltipAlignTop)
      }}
      className="market-map-stock flex flex-col items-center justify-center overflow-hidden border border-black/40 text-white"
    >
      {showLabel && (
        <>
          {showName && (
            <span className="w-full truncate px-1 text-center leading-tight" style={{ fontSize }}>
              {item.alias ?? item.stockName}
            </span>
          )}
          {showRate && (
            <span className="text-center leading-tight" style={{ fontSize: fontSize * 0.85 }}>
              {toPctSigned(item.changeRate, decimalPlaces)}
            </span>
          )}
        </>
      )}

    </div>
  )
}
