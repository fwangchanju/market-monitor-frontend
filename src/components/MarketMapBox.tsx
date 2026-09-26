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
  // 박스 색칠은 이 설정 하나로만 결정된다(resolveMarketMapColor) — 범례 바(MarketMapCustomPage)도
  // 같은 설정 + 같은 함수를 거치므로 두 화면이 항상 수학적으로 일치한다.
  colorScale: ColorScaleConfig
  onOpenPopup: (content: MarketMapPopupContent, target: HTMLElement) => void
  // 지금 팝업이 떠 있는 섹터/종목의 식별 키(sectorPath/stockPath 기반) — 이 종목의 키와 일치하면
  // 박스에 초록 하이라이트를 붙인다(MarketMapTreemap.highlightedKey).
  highlightedKey: string | null
  // 이 박스를 담고 있는 섹터의 전체 경로(MarketMapSectorSection.sectorPath) — stockCode만으로는
  // 같은 종목이 트리 여러 자리에 나타날 가능성을 배제할 수 없어, 종목 키도 경로로 유일하게 만든다.
  ancestorPath: string
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
  colorScale,
  onOpenPopup,
  highlightedKey,
  ancestorPath,
}: Props) {
  const showLabel = stockLabelMode !== 'off' && areaPercent >= labelMinAreaPercent
  const showName = stockLabelMode !== 'rateOnly'
  const showRate = stockLabelMode !== 'nameOnly'
  const fontSize = fontSizePx(width, height)
  const backgroundColor = resolveMarketMapColor(item.changeRate, colorScale)
  const stockKey = `stock:${ancestorPath}\u0000${item.stockCode}`
  const isHighlighted = highlightedKey === stockKey
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
          targetKey: stockKey,
        }, e.currentTarget)
      }}
      className={`market-map-stock flex flex-col items-center justify-center overflow-hidden border border-black/40 text-white ${isHighlighted ? 'outline outline-2 outline-[#22c55e] shadow-[0_0_4px_1px_rgba(34,197,94,0.7)]' : ''}`}
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
