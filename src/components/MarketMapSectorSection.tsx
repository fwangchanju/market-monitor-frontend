import { useRef, type CSSProperties } from 'react'
import MarketMapBox from './MarketMapBox'
import type { MarketMapPopupContent } from './MarketMapPopup'
import { sectorHeaderFontSize, sectorHeaderHeight, PADDING, type LaidOutSector } from '@/hooks/useMarketMapLayout'
import { TAB_GAP, avgChangeRateLabel, toJoEokDecimal, toPctSigned } from '@/utils/format'
import type { MarketMapItem } from '@/types/api'
import type { ColorScaleConfig } from '@/utils/marketMapColorScale'
import type { StockLabelMode } from '@/hooks/useGlobalSettings'

interface Props {
  sector: LaidOutSector
  // rect는 이 섹터 박스 전체의 화면상 위치 — 줌인 애니메이션이 어디서부터 확대되는지 계산하는 데 쓴다.
  onSelectSector: (sectorName: string, rect: DOMRect) => void
  onOpenPopup: (content: MarketMapPopupContent, target: HTMLElement, alignLeft: boolean, alignTop: boolean) => void
  // 지금 팝업이 떠 있는 섹터/종목의 식별 키('sector-<id>' | 'stock-<code>') — 이 섹터의 키와 일치하면
  // 박스 전체에 초록 하이라이트를 붙인다(MarketMapTreemap.highlightedKey).
  highlightedKey: string | null
  // 셋 다 null = 전부 꺼짐. [min, max]면 그 뎁스 범위(현재 화면 기준 상대 뎁스)에서만 표시.
  marketValueDepthRange: [number, number] | null
  avgChangeRateDepthRange: [number, number] | null
  upDownCountDepthRange: [number, number] | null
  // true면 가중평균 대신 산술평균을 표시(태그/툴팁).
  avgChangeRateUseSimple: boolean
  // 커스텀 모드가 아닐 때는(기본 분류 트리) 섹터 제외 액션 자체를 제공하지 않는다.
  canExclude: boolean
  // 하위 MarketMapBox까지 그대로 관통해서 전달 — 박스 색칠 설정의 단일 출처.
  colorScale: ColorScaleConfig
  // 하위 MarketMapBox까지 그대로 관통해서 전달 — 종목명/등락률 표시 여부를 가르는 넓이 비중(%) 기준.
  labelMinAreaPercent: number
  // 하위 MarketMapBox까지 그대로 관통해서 전달 — 종목명만/등락률만/둘 다 보여줄지.
  stockLabelMode: StockLabelMode
  // 하위 MarketMapBox까지 그대로 관통해서 전달 — 등락률(%) 표시 소수점 자릿수.
  decimalPlaces: number
  topPickSectorIds: Set<number>
  // 현재 화면의 상대 depth 0이 트리에서 몇 번째 단계인지 나타내는 절대 depth 오프셋.
  depthOffset?: number
  depth?: number
}

// 이 섹터 태그에 등락률 평균/상승·하락·보합을 보여주려면, 하위 섹터까지 포함한
// 모든 종목이 필요하다(sector.boxes는 이 뎁스 바로 아래 종목만 담고 있음).
function collectSectorItems(sector: LaidOutSector): MarketMapItem[] {
  const items = sector.boxes.map(box => box.item)
  for (const sub of sector.subSectors) items.push(...collectSectorItems(sub))
  return items
}

function isInDepthRange(range: [number, number] | null, depth: number): boolean {
  return range !== null && depth >= range[0] && depth <= range[1]
}

// 절대 depth(트리 기준 실제 단계) → 배경/글자색. 배열 끝을 넘으면 마지막 값을 반복한다.
const SECTOR_HEADER_STYLES = [
  { background: 'bg-black', baseColor: '#000000', text: 'text-[var(--accent)]', border: 'border-2 border-transparent' },
  { background: 'bg-[#333333]', baseColor: '#333333', text: 'text-white', border: 'border-2 border-transparent' },
  { background: 'bg-[#4d4d4d]', baseColor: '#4d4d4d', text: 'text-white', border: 'border-2 border-transparent' },
  { background: 'bg-[#666666]', baseColor: '#666666', text: 'text-white', border: 'border-2 border-transparent' },
]

function sectorHeaderStyle(depth: number) {
  return SECTOR_HEADER_STYLES[Math.min(depth, SECTOR_HEADER_STYLES.length - 1)]
}

export default function MarketMapSectorSection({
  sector,
  onSelectSector,
  onOpenPopup,
  highlightedKey,
  marketValueDepthRange,
  avgChangeRateDepthRange,
  upDownCountDepthRange,
  avgChangeRateUseSimple,
  canExclude,
  colorScale,
  labelMinAreaPercent,
  stockLabelMode,
  decimalPlaces,
  topPickSectorIds,
  depthOffset = 0,
  depth = 0,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const sectorKey = `sector-${sector.sectorId}`
  const isHighlighted = highlightedKey === sectorKey
  const items = collectSectorItems(sector)
  // useFilteredMarketMapTree가 필터 전 원본 노드로 미리 계산해둔 값이다. null이면 지금 선택된 구간에
  // 해당하는 종목이 하나도 없다는 뜻 — 그 섹터는 등락률 칸을 비운다.
  const avgChangeRate = avgChangeRateUseSimple ? sector.simpleAvgChangeRate : sector.weightedAvgChangeRate
  const isTopPick = topPickSectorIds.has(sector.sectorId) && !sector.isSelf
  const advancerCount = items.filter(item => item.changeRate > 0).length
  const declinerCount = items.filter(item => item.changeRate < 0).length
  const unchangedCount = items.length - advancerCount - declinerCount
  // 태그는 공간이 좁아서 라벨 없이 값만 나열한다 — 표시되는 항목들 사이는 TAB_GAP으로 구분,
  // 등락 종목수 안의 상승/하락/보합 사이는 스페이스 1칸. 순서는 등락률 → 등락 종목수 → 시총(표시 설정 순서와 동일).
  const headerParts = [
    isInDepthRange(avgChangeRateDepthRange, depth) && avgChangeRate !== null
      ? toPctSigned(avgChangeRate, decimalPlaces)
      : null,
    isInDepthRange(upDownCountDepthRange, depth)
      ? `▲${advancerCount} ▼${declinerCount} ■${unchangedCount}`
      : null,
    isInDepthRange(marketValueDepthRange, depth) ? toJoEokDecimal(sector.totalMarketValue / 100_000_000) : null,
  ].filter((part): part is string => part !== null)
  const headerSuffix = headerParts.length > 0 ? `${TAB_GAP}${headerParts.join(TAB_GAP)}` : ''
  const absoluteDepth = depthOffset + depth
  const displaySectorName = absoluteDepth === 2
    ? `└ ${sector.sectorName}`
    : absoluteDepth === 1
      ? `· ${sector.sectorName}`
      : sector.sectorName
  const headerStyle = isTopPick
    ? {
        background: 'bg-[var(--accent)]',
        baseColor: 'var(--accent)',
        text: 'text-black',
        border: 'border-0 border-transparent',
      }
    : sectorHeaderStyle(absoluteDepth)

  return (
    <div
      ref={boxRef}
      style={{
        position: 'absolute',
        left: sector.x,
        top: sector.y,
        width: sector.width,
        height: sector.height,
        zIndex: isTopPick ? 20 : undefined,
      }}
      className={`box-content ${isTopPick ? 'border-2 border-[var(--accent)]' : ''} ${isHighlighted ? 'outline outline-2 outline-[#22c55e] shadow-[0_0_4px_1px_rgba(34,197,94,0.7)]' : ''}`}
    >
      {/* isSelf(드릴다운으로 들어온 자기 자신)는 헤더 태그를 안 그린다 — breadcrumb에 이미
          "KOSPI > 반도체"처럼 같은 이름이 떠 있어서 중복이기 때문(useMarketMapLayout의 paddingTop도
          이 섹터 몫의 헤더 공간을 아예 안 비워둔다). 그 대신 실제 하위 섹터들이 이 자리를 이어받아
          맨 위(depth 0) 취급을 받는다(아래 subSectors map의 depth 전달 참고). */}
      {!sector.isSelf && (
        <>
          <button
            type="button"
            onClick={e => {
              const rect = boxRef.current?.getBoundingClientRect()
              onSelectSector(sector.sectorName, rect ?? e.currentTarget.getBoundingClientRect())
              // 클릭 후에도 이 버튼에 포커스가 남아서 브라우저 기본 포커스 링이 계속 보이는 걸 방지.
              e.currentTarget.blur()
            }}
            onContextMenu={e => {
              e.preventDefault()
              e.stopPropagation()
              // 팝업 위치/하이라이트는 헤더가 아니라 섹터 박스 전체(boxRef) 기준이어야 한다.
              onOpenPopup({
                title: sector.sectorName,
                rows: [
                  ...(avgChangeRate !== null
                    ? [`${avgChangeRateLabel(avgChangeRateUseSimple)}: ${toPctSigned(avgChangeRate, decimalPlaces)}`]
                    : []),
                  `상승 ${advancerCount} 하락 ${declinerCount} 보합 ${unchangedCount}`,
                  `시가총액 합: ${toJoEokDecimal(sector.totalMarketValue / 100_000_000)}`,
                ],
                excludeSector: canExclude ? { id: sector.sectorId, name: sector.sectorName } : undefined,
                targetKey: sectorKey,
              }, boxRef.current ?? e.currentTarget, sector.tooltipAlignLeft, sector.tooltipAlignTop)
              // 우클릭도 좌클릭(위 onClick)과 마찬가지로 버튼에 포커스를 남기는데, 이 헤더는
              // :focus-visible에서 hover와 같은 강조 테두리를 보여주는 CSS 규칙이 있어(index.css)
              // blur 없이 두면 팝업이 뜬 뒤에도 그 테두리가 계속 남아 있었다. 새 초록 하이라이트만
              // 보이도록 여기서도 blur로 지워준다.
              e.currentTarget.blur()
            }}
            style={{
              height: sectorHeaderHeight(depth),
              fontSize: sectorHeaderFontSize(depth),
              left: PADDING,
              width: `calc(100% - ${PADDING * 2}px)`,
              '--market-map-base-color': headerStyle.baseColor,
            } as CSSProperties}
            className={`market-map-sector-header ${isTopPick ? 'market-map-top-pick-header' : ''} absolute top-0 flex items-center overflow-hidden truncate px-1 text-left font-bold leading-none ${headerStyle.border} ${headerStyle.text ?? ''} ${headerStyle.background}`}
          >
            {displaySectorName}
            {headerSuffix && <span className="font-normal">{headerSuffix}</span>}
          </button>
        </>
      )}
      {sector.subSectors.map(sub => (
        <MarketMapSectorSection
          key={sub.sectorName}
          sector={sub}
          onSelectSector={onSelectSector}
          onOpenPopup={onOpenPopup}
          highlightedKey={highlightedKey}
          marketValueDepthRange={marketValueDepthRange}
          avgChangeRateDepthRange={avgChangeRateDepthRange}
          upDownCountDepthRange={upDownCountDepthRange}
          avgChangeRateUseSimple={avgChangeRateUseSimple}
          canExclude={canExclude}
          colorScale={colorScale}
          labelMinAreaPercent={labelMinAreaPercent}
          stockLabelMode={stockLabelMode}
          decimalPlaces={decimalPlaces}
          topPickSectorIds={topPickSectorIds}
          depthOffset={depthOffset}
          depth={sector.isSelf ? depth : depth + 1}
        />
      ))}
      {sector.boxes.map(box => (
        <MarketMapBox
          key={box.item.stockCode}
          item={box.item}
          x={box.x}
          y={box.y}
          width={box.width}
          height={box.height}
          areaPercent={box.areaPercent}
          labelMinAreaPercent={labelMinAreaPercent}
          stockLabelMode={stockLabelMode}
          decimalPlaces={decimalPlaces}
          tooltipAlignLeft={box.tooltipAlignLeft}
          tooltipAlignTop={box.tooltipAlignTop}
          colorScale={colorScale}
          onOpenPopup={onOpenPopup}
          highlightedKey={highlightedKey}
        />
      ))}
    </div>
  )
}
