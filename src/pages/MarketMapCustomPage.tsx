import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import NavBar from '@/components/NavBar'
import SubNavBar from '@/components/SubNavBar'
import MarketMapColorThresholdEditorPanel from '@/components/MarketMapColorThresholdEditorPanel'
import GlobalSettingsSidebar from '@/components/GlobalSettingsSidebar'
import MarketMapShareModal from '@/components/MarketMapShareModal'
import MarketMapTreemap from '@/components/MarketMapTreemap'
import Spinner from '@/components/Spinner'
import NavBarPageActions from '@/components/NavBarPageActions'
import { useMarketMapDrilldown } from '@/hooks/useMarketMapDrilldown'
import { useGlobalSettings } from '@/hooks/useGlobalSettings'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import type { DisplayGroup } from '@/hooks/useMarketMapLayout'
import { TAB_GAP, toMarketMapSnapshotTimeLabel, toIndex, toPctSigned, signClass } from '@/utils/format'
import { useMarketSummary } from '@/hooks/useMarketSummary'
import { captureElementToClipboard } from '@/utils/captureToClipboard'
import { CAPTURE_ID } from '@/utils/captureIds'
import { captureElementToDownload } from '@/utils/captureToDownload'
import type { FilteredMarketMapCategoryNode } from '@/hooks/useFilteredMarketMapTree'
import type { Market, MarketMapCategoryNode, MarketMapItem } from '@/types/api'

const MARKET_LABEL: Record<Market, string> = { KOSPI: 'KOSPI', KOSDAQ: 'KOSDAQ' }

function toDisplayGroup(node: FilteredMarketMapCategoryNode): DisplayGroup {
  return {
    categoryId: node.categoryId,
    categoryName: node.categoryName,
    totalMarketValue: node.totalMarketValue,
    weightedAvgChangeRate: node.weightedAvgChangeRate,
    simpleAvgChangeRate: node.simpleAvgChangeRate,
    items: node.items,
    children: node.children.map(toDisplayGroup),
  }
}

// 등락률 평균/상승·하락·보합 종목수는 개별 종목(changeRate) 기준이라, 지금 화면에 보이는
// 그룹들의 종목을 전부(하위 카테고리 포함) 펼쳐서 모아야 한다.
function collectItems(groups: DisplayGroup[]): MarketMapItem[] {
  const result: MarketMapItem[] = []
  for (const group of groups) {
    result.push(...group.items)
    result.push(...collectItems(group.children))
  }
  return result
}

// 카테고리 제외/시가총액 구간 필터를 적용하기 "전" 원본 트리 기준으로, 지금 보고 있는 뎁스(path)에
// 해당하는 종목을 전부 모은다 — "제외된 개수까지 포함한 전체 리스트 개수"를 보여주기 위한 분모.
function collectRawItems(nodes: MarketMapCategoryNode[]): MarketMapItem[] {
  const result: MarketMapItem[] = []
  for (const node of nodes) {
    result.push(...node.items)
    result.push(...collectRawItems(node.children))
  }
  return result
}

function findRawNodeByPath(nodes: MarketMapCategoryNode[], path: string[]): MarketMapCategoryNode | null {
  let node: MarketMapCategoryNode | null = null
  let siblings = nodes
  for (const name of path) {
    const found = siblings.find(n => n.categoryName === name)
    if (!found) return null
    node = found
    siblings = found.children
  }
  return node
}

type CopyStatus = 'idle' | 'copying' | 'copied' | 'error'
type DownloadStatus = 'idle' | 'downloading' | 'error'

export default function MarketMapCustomPage() {
  const {
    settingsModalProps,
    colorEditorPanelProps,
    market,
    setMarket,
    isCustom,
    data,
    isLoading,
    isError,
    rootNodes,
    filteredRootNodes,
    marketValueDepthRange,
    avgChangeRateDepthRange,
    upDownCountDepthRange,
    avgChangeRateUseSimple,
    boxLabelMinAreaPercent,
    colorScale,
    legendSwatches,
    handleExcludeCategory,
  } = useGlobalSettings()

  const [searchParams, setSearchParams] = useSearchParams()
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>('idle')
  // 브레드크럼에서 지금 hover 중인 구간의 인덱스 — 이 인덱스 이하(자기 자신 포함) 구간을 전부 강조 표시한다.
  const [breadcrumbHoverIndex, setBreadcrumbHoverIndex] = useState<number | null>(null)
  // null이 아니면 MarketMapTreemap이 해당 뎁스로 줄어드는 줌아웃 애니메이션을 재생하고, 끝나면
  // handleZoomOutComplete를 불러서 실제 이동을 한다 — 애니메이션 도중엔 path/groups를 먼저 바꾸지 않는다.
  const [zoomOutRequestDepth, setZoomOutRequestDepth] = useState<number | null>(null)
  const captureRef = useRef<HTMLDivElement>(null)

  const { data: marketSummaryData } = useMarketSummary()
  const marketOverview = marketSummaryData?.marketOverviews.items.find(item => item.market === market)

  const { path, currentNode, currentSiblings, enterCategory, goToDepth, reset } = useMarketMapDrilldown(filteredRootNodes)
  // path가 바뀌면(어떤 방식의 이동이든) 이전 hover 상태를 무조건 지운다 — 안 그러면 브레드크럼 바가
  // path 없을 때 사라졌다가 다시 나타날 때, 예전에 hover했던 값이 그대로 남아 있다가 새로 그려진
  // 세그먼트에 적용돼버린다(마우스가 실제로 그 위에 있지 않은데도).
  useEffect(() => setBreadcrumbHoverIndex(null), [path])

  const groups: DisplayGroup[] = currentNode ? [toDisplayGroup(currentNode)] : currentSiblings.map(toDisplayGroup)
  const visibleItems = collectItems(groups)
  // 지금 뎁스(path) 기준으로, 카테고리 제외/시가총액 구간 필터를 적용하기 전 원본 트리에 있는 전체 종목 수.
  const rawCurrentNode = findRawNodeByPath(rootNodes, path)
  const totalItemCount = collectRawItems(rawCurrentNode ? [rawCurrentNode] : rootNodes).length

  // 상단 바 표시: 커스텀 모드 on/off를 점등 표시로, 텍스트는 종목 수 하나만 고정 출력.
  const modeStatusText = (
    <>
      <span
        className={`mr-1.5 inline-block h-2 w-2 rounded-full ${
          isCustom ? 'bg-green-500 shadow-[0_0_4px_1px_rgba(34,197,94,0.7)]' : 'bg-gray-600'
        }`}
      />
      <span className={isCustom ? 'text-white' : undefined}>
        커스텀 모드 ({visibleItems.length}/{totalItemCount}종목)
      </span>
    </>
  )

  const handleMarketChange = (next: Market) => {
    setMarket(next)
    reset()
  }

  // SubNavBar의 "지도" 탭 위 마켓 목록에서 KOSPI/KOSDAQ를 고르면 /market-map?market=...로 이동한다.
  // 이미 이 페이지에 있으면(같은 라우트) 리마운트 없이 searchParams만 바뀌므로 여기서 반영하고, 초기
  // 상태 읽는 용도일 뿐 주소창에 남아있을 필요는 없어서 반영 직후 지운다.
  useEffect(() => {
    const param = searchParams.get('market')
    if (param !== 'KOSPI' && param !== 'KOSDAQ') return
    handleMarketChange(param)
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev)
        next.delete('market')
        return next
      },
      { replace: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- market 파라미터가 있을 때만 반응하면 됨
  }, [searchParams])

  // breadcrumb에서 상위 뎁스로 갈 때, 바로 이동하지 않고 줌아웃 애니메이션을 먼저 요청한다.
  const handleGoToDepth = (depth: number) => {
    if (depth >= path.length) return
    setZoomOutRequestDepth(depth)
  }
  const handleZoomOutComplete = (depth: number) => {
    goToDepth(depth)
    setZoomOutRequestDepth(null)
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
    <div className="flex h-screen select-none flex-col overflow-hidden">
      <NavBar />
      <SubNavBar
        actions={
          <NavBarPageActions
            onToggleSettings={() => settingsModalProps.onOpenChange(!settingsModalProps.isOpen)}
            onOpenShare={() => setIsShareOpen(true)}
            isNativeFullscreen={isNativeFullscreen}
            onToggleFullscreen={handleToggleNativeFullscreen}
          />
        }
      />
      <div className="flex min-h-0 flex-1">
        {colorEditorPanelProps && (
          <div className="w-56 shrink-0 overflow-y-auto bg-[var(--surface)]">
            <MarketMapColorThresholdEditorPanel {...colorEditorPanelProps} />
          </div>
        )}
        {/* 설정 사이드바가 열려있으면 공유 캡처에도 같이 포함되도록, captureRef를 지도 본문+사이드바를
            함께 감싸는 바깥 wrapper로 옮겼다 — 사이드바가 닫혀있으면 지도 본문만 있는 것과 동일하다. */}
        <div
          ref={captureRef}
          data-captureid={CAPTURE_ID.MARKET_MAP}
          data-capture-ready={!isLoading}
          className="flex min-h-0 flex-1"
        >
          <div className="flex min-h-0 flex-1 flex-col bg-black">
            <div className="mb-1 grid h-7 w-full shrink-0 grid-cols-[auto_1fr_auto] items-center bg-black/70 pl-1 text-sm font-bold text-white">
              <div className="flex items-center whitespace-nowrap">
                <span
                  onClick={() => handleGoToDepth(0)}
                  className={`text-xl ${path.length > 0 ? 'cursor-pointer hover:text-yellow-400' : ''}`}
                >
                  {MARKET_LABEL[market]}
                </span>
                {marketOverview && (
                  <span className={`text-[15px] font-normal ${signClass(marketOverview.changeRate)}`}>
                    {TAB_GAP}
                    {toIndex(marketOverview.indexValue)}
                    {TAB_GAP}
                    {marketOverview.changeValue > 0 ? '▲' : marketOverview.changeValue < 0 ? '▼' : ''}
                    {toIndex(Math.abs(marketOverview.changeValue))}
                    {TAB_GAP}
                    {toPctSigned(marketOverview.changeRate)}
                  </span>
                )}
              </div>
              <span className="min-w-0 whitespace-nowrap text-center text-[15px] font-normal text-gray-400">
                {modeStatusText}
              </span>
              <div className="flex items-center gap-3 self-stretch">
                {data?.snapshotTime && (
                  <span className="whitespace-nowrap text-[15px] font-normal text-white">
                    {toMarketMapSnapshotTimeLabel(data.snapshotTime)}
                  </span>
                )}
                {/* self-stretch + items-stretch: 이 칸의 실제 높이가 좌측 마켓명(text-2xl) 줄높이 때문에
                    h-7보다 커질 수 있어서, 고정 높이 대신 실제 행 높이에 맞춰 늘어나야 스와치 위아래로
                    검은 배경이 남지 않는다. */}
                <div className="flex items-stretch self-stretch">
                  {legendSwatches.map(({ label, color }) => (
                    <div
                      key={label}
                      style={{ backgroundColor: color }}
                      className="flex w-9 items-center justify-center text-xs"
                    >
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {path.length > 0 && (
              // mouseenter/leave 대신 mousemove로 실시간으로 "지금 커서 아래 요소"를 다시 계산한다.
              // 구간 사이 하이픈/여백처럼 자체 핸들러가 없는 지점을 지나가도 강조가 예전 값에 멈춰있지
              // 않도록(스테일 하이라이트 방지), 그리고 실제 마우스가 움직인 경우에만 값이 바뀌므로
              // 클릭 직후 레이아웃이 바뀌면서 커서 아래에 새 버튼이 나타나 생기는 유령 hover도 막아준다.
              <div
                onClick={() => handleGoToDepth(0)}
                onMouseMove={e => {
                  const target = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-breadcrumb-index]') : null
                  setBreadcrumbHoverIndex(target ? Number(target.dataset.breadcrumbIndex) : 0)
                }}
                onMouseLeave={() => setBreadcrumbHoverIndex(null)}
                className="mb-1 flex h-7 w-full shrink-0 cursor-pointer items-center gap-1 truncate bg-black/70 px-1 text-sm font-bold text-white"
              >
                <span data-breadcrumb-index={0} className={breadcrumbHoverIndex !== null ? 'text-yellow-400' : ''}>
                  {MARKET_LABEL[market]}
                </span>
                {path.map((name, index) => {
                  const segmentIndex = index + 1
                  const isLastPath = index === path.length - 1
                  const isHighlighted = breadcrumbHoverIndex !== null && breadcrumbHoverIndex >= segmentIndex
                  return (
                    <span key={index} data-breadcrumb-index={segmentIndex} className="flex items-center gap-1">
                      <span className={isHighlighted ? 'text-yellow-400' : ''}>-</span>
                      {isLastPath ? (
                        // 지금 보고 있는 카테고리라 클릭해도 아무 동작이 없어야 하므로, 버블링을 막아
                        // 바 전체의 onClick(goToDepth(0))으로 전체 화면으로 빠지지 않게 한다.
                        <span onClick={e => e.stopPropagation()} className={isHighlighted ? 'text-yellow-400' : ''}>
                          {name}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation()
                            handleGoToDepth(segmentIndex)
                          }}
                          style={{ fontFamily: 'inherit' }}
                          className={`border-0 bg-transparent p-0 text-sm font-bold ${isHighlighted ? 'text-yellow-400' : 'text-white'}`}
                        >
                          {name}
                        </button>
                      )}
                    </span>
                  )
                })}
              </div>
            )}
            {isLoading ? (
              <div className="flex flex-1 items-center justify-center">
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
                depth={path.length}
                onSelectCategory={enterCategory}
                onExcludeCategory={handleExcludeCategory}
                heightClassName="min-h-0 flex-1"
                marketValueDepthRange={marketValueDepthRange}
                avgChangeRateDepthRange={avgChangeRateDepthRange}
                upDownCountDepthRange={upDownCountDepthRange}
                avgChangeRateUseSimple={avgChangeRateUseSimple}
                canExclude={isCustom}
                colorScale={colorScale}
                labelMinAreaPercent={boxLabelMinAreaPercent}
                zoomOutRequestDepth={zoomOutRequestDepth}
                onZoomOutComplete={handleZoomOutComplete}
              />
            )}
          </div>
          {/* 지도 페이지에서만 커스텀 모드 토글이 드릴다운 경로도 같이 초기화해야 한다. */}
          <GlobalSettingsSidebar
            {...settingsModalProps}
            onToggleCustom={() => {
              settingsModalProps.onToggleCustom()
              reset()
            }}
          />
        </div>
      </div>

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
    </div>
  )
}
