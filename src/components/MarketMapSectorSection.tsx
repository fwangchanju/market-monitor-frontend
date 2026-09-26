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
  onOpenPopup: (content: MarketMapPopupContent, target: HTMLElement) => void
  // 헤더를 좌클릭(주 버튼)으로 누르는 "순간"(pointerdown) 알림 — MarketMapTreemap이 이걸로
  // suppressSectorHoverBorder를 곧장 켜서, 줌인 애니메이션 시작 전에 hover 테두리가 잠깐
  // 반짝였다가 사라지는 걸 막는다. 우클릭(팝업)은 이 콜백을 아예 안 부른다.
  onHeaderPressStart: () => void
  // 지금 팝업이 떠 있는 섹터/종목의 식별 키(sectorPath/stockPath 기반) — 이 섹터의 키와 일치하면
  // 호버 오버레이를 "고정(pinned)"으로 계속 보여준다(index.css의 .is-pinned). 아래 sectorPath 계산 참고.
  highlightedKey: string | null
  // 루트부터 이 섹터의 부모까지 이어붙인 경로(각 마디는 '\u0000'로 구분) — 하이라이트 키를 sectorId나
  // 이름 하나만으로 만들면 충돌한다: 기본(비커스텀) 분류에서는 모든 노드의 sectorId가 0으로 오고,
  // 드릴다운으로 들어간 섹터는 자기 자신과 같은 이름의 "self" 합성 노드로 다시 감싸일 수 있어(isSelf)
  // 이름만으로도 조상/자손이 겹칠 수 있다. 루트에서부터의 전체 경로는 항상 유일하다.
  ancestorPath: string
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
  onHeaderPressStart,
  highlightedKey,
  ancestorPath,
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
  // 이 섹터까지의 전체 경로(루트부터) — 하이라이트 키와 하위로 넘길 ancestorPath에 그대로 쓴다.
  const sectorPath = `${ancestorPath}\u0000${sector.sectorName}`
  const sectorKey = `sector:${sectorPath}`
  // 팝업이 이 섹터를 대상으로 떠 있는 동안 호버 오버레이를 고정해서 보여준다(index.css의 .is-pinned).
  const isPinned = highlightedKey === sectorKey
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
        // 헤더뿐 아니라 아래 hover 오버레이(market-map-sector-hover-overlay)도 이 값을 그대로
        // 상속해서 쓴다 — 오버레이는 헤더의 형제라 헤더에 걸면 안 내려온다(CSS 변수는 자손에게만
        // 상속), 그래서 둘의 공통 조상인 여기(box-content)에 한 번만 건다.
        '--market-map-base-color': headerStyle.baseColor,
      } as CSSProperties}
      className={`market-map-sector-box box-content ${isTopPick ? 'border-2 border-[var(--accent)]' : ''} ${isPinned ? 'is-pinned' : ''}`}
    >
      {/* isSelf(드릴다운으로 들어온 자기 자신)는 헤더 태그를 안 그린다 — breadcrumb에 이미
          "KOSPI > 반도체"처럼 같은 이름이 떠 있어서 중복이기 때문(useMarketMapLayout의 paddingTop도
          이 섹터 몫의 헤더 공간을 아예 안 비워둔다). 그 대신 실제 하위 섹터들이 이 자리를 이어받아
          맨 위(depth 0) 취급을 받는다(아래 subSectors map의 depth 전달 참고). isSelf는 헤더가 아예
          없어 우클릭도 못 받으므로(팝업 대상이 될 수 없음) hover 오버레이도 같이 생략한다. */}
      {!sector.isSelf && (
        <>
          {/* 헤더를 hover(또는 팝업이 뜬 채 고정)했을 때 섹터 박스 전체를 옅게 덮는 오버레이. 표시
              여부는 순수 CSS(:has())로 판정한다(index.css) — 헤더 :hover/:focus-visible 자체를
              트리거로 쓰고, 팝업이 뜬 상태는 위 is-pinned 클래스로 같은 규칙에 얹는다. 하위 섹터의
              헤더를 hover해도 :has(> ...)의 '>'가 직계 자식만 보므로 이 오버레이는 안 뜨고, 그
              하위 섹터 자신의 오버레이만 뜬다(하위 섹터 전체가 이 오버레이에 옅게 덮이는 건 의도대로).
              하위 섹터/종목 박스는 전부 z-index:auto라 그 위에 z-[1]만 얹으면 항상 그것들보다
              위에 그려진다(DOM 순서와 무관 — z-index가 있는 요소는 auto인 형제들보다 항상 나중에
              페인트된다). 톱픽 섹터는 자기 바깥 박스에 z-index:20을 따로 쓰는데(이 컴포넌트 자신,
              위 style 참고) 이 1/2는 그보다 한참 낮게 잡아서 톱픽이 기존처럼 뭐든 위로 튀어나와
              보이는 동작을 그대로 둔다. */}
          <div className="market-map-sector-hover-overlay absolute inset-0 z-[1] pointer-events-none" aria-hidden="true" />
          <button
            type="button"
            onMouseDown={e => {
              // 오른쪽 버튼 mousedown의 "기본 동작"(포커스 이동)만 막는다 — contextmenu는 별개
              // 이벤트라 여기서 preventDefault해도 그대로 뜬다. index.css에 전역 포커스 리셋 규칙
              // (#root :where(button, ...):focus { outline/box-shadow: none !important })이 있어서,
              // 우클릭으로 이 버튼이 포커스를 받으면 그 !important가 hover/고정 모양의 흰 inset
              // box-shadow를 지워버려 테두리 선만 남는 버그가 있었다 — 애초에 포커스를 안 받게 막는다.
              // pointerdown이 아니라 mousedown을 쓴 이유: preventDefault를 pointerdown에 걸어도
              // 브라우저에 따라 포커스 이동을 못 막는 경우가 있다(마우스 전용 mousedown만 확실하다).
              if (e.button === 2) e.preventDefault()
            }}
            onPointerDown={e => {
              // 주 버튼(왼쪽, button === 0)을 눌렀을 때만 — 우클릭(팝업)까지 같이 걸리면 안 된다.
              // CSS :active는 버튼 구분이 안 돼서(왼쪽이든 오른쪽이든 눌려 있는 동안 매치) 우클릭
              // 프레스 중에도 헤더 hover 테두리가 사라지는 버그가 있었다 — 그래서 JS로 왼쪽만 걸러
              // 처리하고, index.css의 :active 규칙은 없앴다.
              if (e.button === 0) onHeaderPressStart()
            }}
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
              }, boxRef.current ?? e.currentTarget)
              // 위 onMouseDown이 오른쪽 버튼의 포커스 이동 자체를 막아주지만, 혹시를 대비한 안전망으로
              // 여기서도 한 번 더 blur — 이미 포커스가 없으면 아무 효과 없는 no-op이라 안전하다.
              e.currentTarget.blur()
            }}
            style={{
              height: sectorHeaderHeight(depth),
              fontSize: sectorHeaderFontSize(depth),
              left: PADDING,
              width: `calc(100% - ${PADDING * 2}px)`,
            } as CSSProperties}
            className={`market-map-sector-header ${isTopPick ? 'market-map-top-pick-header' : ''} absolute top-0 z-[2] flex items-center overflow-hidden truncate px-1 text-left font-bold leading-none ${headerStyle.border} ${headerStyle.text ?? ''} ${headerStyle.background}`}
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
          onHeaderPressStart={onHeaderPressStart}
          highlightedKey={highlightedKey}
          ancestorPath={sectorPath}
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
          colorScale={colorScale}
          onOpenPopup={onOpenPopup}
          highlightedKey={highlightedKey}
          ancestorPath={sectorPath}
        />
      ))}
    </div>
  )
}
