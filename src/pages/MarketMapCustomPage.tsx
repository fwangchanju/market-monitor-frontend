import { useEffect, useMemo, useRef, useState } from 'react'
import NavBar from '@/components/NavBar'
import MarketMapFilterSidebar from '@/components/MarketMapFilterSidebar'
import MarketMapSettingsDropdown from '@/components/MarketMapSettingsDropdown'
import MarketMapShareModal from '@/components/MarketMapShareModal'
import MarketMapTreemap from '@/components/MarketMapTreemap'
import Spinner from '@/components/Spinner'
import { ShareIcon, MaximizeIcon, MinimizeIcon } from '@/components/icons/MarketMapIcons'
import { useMarketMap } from '@/hooks/useMarketMap'
import { useMarketMapDrilldown } from '@/hooks/useMarketMapDrilldown'
import { useFilteredMarketMapTree } from '@/hooks/useFilteredMarketMapTree'
import type { DisplayGroup } from '@/hooks/useMarketMapLayout'
import { toFullDateTimeLabel, toJoEokDecimal, toPctSigned } from '@/utils/format'
import { captureElementToClipboard } from '@/utils/captureToClipboard'
import { CAPTURE_ID } from '@/utils/captureIds'
import { captureElementToDownload } from '@/utils/captureToDownload'
import { registerExcludedCategory, unregisterExcludedCategory } from '@/api/marketMap'
import type { Market, MarketMapCategoryNode, MarketMapItem, MarketValueTier } from '@/types/api'

// 왼쪽 사이드바 필터 버튼 텍스트(MarketMapFilterSidebar의 FILTER_ITEMS)와 동일하게 맞춘다.
const MARKET_LABEL: Record<Market, string> = { KOSPI: 'KOSPI', KOSDAQ: 'KOSDAQ' }

// 종목 박스 색상 로직(MarketMapBox.boxColorClass)과 같은 방향(0에 가까울수록 짙고 탁하게,
// 멀어질수록 쨍하게)의 범례. 박스 쪽은 4단계지만 범례는 -3%~+3% 7칸에 맞춰 3단계로 축약했다.
const CHANGE_RATE_LEGEND = [
  { label: '-5%', className: 'bg-blue-500' },
  { label: '-3%', className: 'bg-blue-600' },
  { label: '-1%', className: 'bg-blue-700' },
  { label: '0%', className: 'bg-gray-600' },
  { label: '+1%', className: 'bg-red-700' },
  { label: '+3%', className: 'bg-red-600' },
  { label: '+5%', className: 'bg-red-500' },
] as const

function toDisplayGroup(node: MarketMapCategoryNode): DisplayGroup {
  return {
    categoryId: node.categoryId,
    categoryName: node.categoryName,
    totalMarketValue: node.totalMarketValue,
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

// categoryId -> "상위 - 하위" 형태의 전체 경로. "이 섹터가 제외 목록에 있는지"만 관리하고,
// 실제로 화면에서 걸러낼지는 별도의 sectorFilterEnabled 마스터 스위치가 결정한다.
function seedExcludedCategoryNames(
  nodes: MarketMapCategoryNode[],
  ancestors: string[] = [],
  out: Map<number, string> = new Map(),
) {
  for (const node of nodes) {
    const path = [...ancestors, node.categoryName]
    if (node.isExcluded) out.set(node.categoryId, path.join(' - '))
    seedExcludedCategoryNames(node.children, path, out)
  }
  return out
}

// 우클릭 제외 시점엔 리프 카테고리명만 알고 있으므로, 뎁스가 있으면(최상위가 아니면) 원본 트리에서
// 조상 경로를 다시 찾아 "상위 - 하위" 형태로 만든다. 최상위면 경로 길이가 1이라 그대로 리프명만 나온다.
function findCategoryPath(nodes: MarketMapCategoryNode[], targetId: number, ancestors: string[] = []): string[] | null {
  for (const node of nodes) {
    const path = [...ancestors, node.categoryName]
    if (node.categoryId === targetId) return path
    const found = findCategoryPath(node.children, targetId, path)
    if (found) return found
  }
  return null
}

type CopyStatus = 'idle' | 'copying' | 'copied' | 'error'
type DownloadStatus = 'idle' | 'downloading' | 'error'

export default function MarketMapCustomPage() {
  const [market, setMarket] = useState<Market>('KOSPI')
  const [isCustom, setIsCustom] = useState(true)
  const [showMarketValue, setShowMarketValue] = useState(true)
  const [showAvgChangeRate, setShowAvgChangeRate] = useState(false)
  const [showUpDownCount, setShowUpDownCount] = useState(false)
  const [excludedMarketValueTiers, setExcludedMarketValueTiers] = useState<Set<MarketValueTier>>(new Set())
  const [excludedCategoryNames, setExcludedCategoryNames] = useState<Map<number, string>>(new Map())
  // 섹터 제외를 목록별로 켜고 끄는 게 아니라, 제외 적용 자체를 통째로 켜고 끄는 마스터 스위치.
  const [sectorFilterEnabled, setSectorFilterEnabled] = useState(true)
  // null = 제한 없음(전체 뎁스 표시). 슬라이더의 실제 상한(availableMaxDepth)은 트리 계산 후에 나온다.
  const [maxDepth, setMaxDepth] = useState<number | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false)
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>('idle')
  // 브레드크럼에서 지금 hover 중인 구간의 인덱스 — 이 인덱스 이하(자기 자신 포함) 구간을 전부 강조 표시한다.
  const [breadcrumbHoverIndex, setBreadcrumbHoverIndex] = useState<number | null>(null)
  const captureRef = useRef<HTMLDivElement>(null)
  // 새로 받아온 (market, isCustom) 조합의 데이터가 처음 도착했을 때만 서버 isExcluded로 시드하고,
  // 그 뒤 60초 백그라운드 재조회가 로컬에서 방금 토글한 상태를 덮어쓰지 않게 한다(fire-and-forget 저장이라
  // 서버 반영 전에 재조회가 먼저 도착할 수 있음).
  const seededKeyRef = useRef<string | null>(null)

  const { data, isLoading, isError } = useMarketMap(market, isCustom)

  const rootNodes = data?.items ?? []

  useEffect(() => {
    if (!data) return
    const key = `${market}:${isCustom}`
    if (seededKeyRef.current === key) return
    seededKeyRef.current = key
    setExcludedCategoryNames(seedExcludedCategoryNames(data.items, []))
  }, [data, market, isCustom])

  // 커스텀 모드가 아니면(기본 분류 트리) isExcluded 자체를 무시한다 — 카테고리 제외는 커스텀 트리 전용 기능.
  const excludedCategoryIds = useMemo(
    () => (isCustom && sectorFilterEnabled ? new Set(excludedCategoryNames.keys()) : new Set<number>()),
    [excludedCategoryNames, sectorFilterEnabled, isCustom],
  )

  // 커스텀 모드가 아니면 뎁스 제한도 무시한다(기본 트리는 어차피 사실상 1뎁스).
  const { filteredRootNodes, availableMaxDepth } = useFilteredMarketMapTree(
    rootNodes,
    excludedCategoryIds,
    excludedMarketValueTiers,
    isCustom ? maxDepth : null,
  )

  const { path, currentNode, currentSiblings, enterCategory, goToDepth, reset } = useMarketMapDrilldown(filteredRootNodes)
  // path가 바뀌면(어떤 방식의 이동이든) 이전 hover 상태를 무조건 지운다 — 안 그러면 브레드크럼 바가
  // path 없을 때 사라졌다가 다시 나타날 때, 예전에 hover했던 값이 그대로 남아 있다가 새로 그려진
  // 세그먼트에 적용돼버린다(마우스가 실제로 그 위에 있지 않은데도).
  useEffect(() => setBreadcrumbHoverIndex(null), [path])

  const groups: DisplayGroup[] = currentNode ? [toDisplayGroup(currentNode)] : currentSiblings.map(toDisplayGroup)
  // 지금 화면에 나온 그룹들의 시가총액 합 — 드릴다운 깊이에 따라 groups가 바뀌므로 그때그때 다시 계산된다.
  const totalMarketValue = groups.reduce((sum, group) => sum + group.totalMarketValue, 0)
  const visibleItems = collectItems(groups)
  const avgChangeRate =
    visibleItems.length > 0 ? visibleItems.reduce((sum, item) => sum + item.changeRate, 0) / visibleItems.length : 0
  const advancerCount = visibleItems.filter(item => item.changeRate > 0).length
  const declinerCount = visibleItems.filter(item => item.changeRate < 0).length
  const unchangedCount = visibleItems.length - advancerCount - declinerCount

  const handleMarketChange = (next: Market) => {
    setMarket(next)
    reset()
  }

  const handleToggleCustom = () => {
    setIsCustom(prev => !prev)
    reset()
  }

  const handleToggleMarketValueTier = (tier: MarketValueTier) => {
    setExcludedMarketValueTiers(prev => {
      const next = new Set(prev)
      if (next.has(tier)) next.delete(tier)
      else next.add(tier)
      return next
    })
  }

  const handleSelectAllMarketValueTiers = () => setExcludedMarketValueTiers(new Set())

  const handleExcludeCategory = (categoryId: number, categoryName: string) => {
    const path = findCategoryPath(rootNodes, categoryId)
    setExcludedCategoryNames(prev => new Map(prev).set(categoryId, path ? path.join(' - ') : categoryName))
    registerExcludedCategory(categoryId).catch(e => console.error('카테고리 제외 실패', e))
  }

  const handleRemoveExcludedCategory = (categoryId: number) => {
    setExcludedCategoryNames(prev => {
      const next = new Map(prev)
      next.delete(categoryId)
      return next
    })
    unregisterExcludedCategory(categoryId).catch(e => console.error('카테고리 제외 해제 실패', e))
  }

  // 앱 내부 풀스크린(isFullscreen, CSS로 헤더/사이드바만 숨김)과는 별개로, 브라우저 자체의
  // 진짜 Fullscreen API를 토글한다. 사용자가 F11 키나 Esc로 직접 빠져나가는 경우도 있어서
  // fullscreenchange 이벤트로 상태를 동기화한다.
  useEffect(() => {
    const handleFullscreenChange = () => setIsNativeFullscreen(document.fullscreenElement != null)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const handleToggleNativeFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      document.documentElement.requestFullscreen()
    }
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
      {!isFullscreen && <NavBar />}
      {/* 버튼 바 — 전체화면 진입/해제와 무관하게 항상 같은 높이·구성으로 유지된다(예전엔 모드별로
          완전히 다른 JSX 두 벌을 썼는데, 전체화면 시 최상단 NavBar만 숨기는 걸로 바뀌면서 하나로 합쳤다). */}
      <div className="flex h-8 shrink-0 items-center justify-end gap-2 bg-white px-2 shadow-lg">
        <MarketMapSettingsDropdown
          isCustom={isCustom}
          onToggleCustom={handleToggleCustom}
          maxDepth={maxDepth}
          availableMaxDepth={availableMaxDepth}
          onChangeMaxDepth={setMaxDepth}
          showMarketValue={showMarketValue}
          onToggleShowMarketValue={() => setShowMarketValue(prev => !prev)}
          showAvgChangeRate={showAvgChangeRate}
          onToggleShowAvgChangeRate={() => setShowAvgChangeRate(prev => !prev)}
          showUpDownCount={showUpDownCount}
          onToggleShowUpDownCount={() => setShowUpDownCount(prev => !prev)}
          excludedMarketValueTiers={excludedMarketValueTiers}
          onToggleMarketValueTier={handleToggleMarketValueTier}
          onSelectAllMarketValueTiers={handleSelectAllMarketValueTiers}
          sectorFilterEnabled={sectorFilterEnabled}
          onToggleSectorFilter={() => setSectorFilterEnabled(prev => !prev)}
          excludedCategories={Array.from(excludedCategoryNames, ([categoryId, categoryName]) => ({ categoryId, categoryName }))}
          onRemoveExcludedCategory={handleRemoveExcludedCategory}
          compact
        />
        <button
          type="button"
          aria-label="공유"
          className="flex h-7 w-7 items-center justify-center rounded text-gray-700 hover:bg-gray-100 hover:text-[#4f8fd6]"
          onClick={() => setIsShareOpen(true)}
        >
          <ShareIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label={isFullscreen ? '전체화면 종료' : '전체화면'}
          className="flex h-7 w-7 items-center justify-center rounded text-gray-700 hover:bg-gray-100 hover:text-[#4f8fd6]"
          onClick={() => setIsFullscreen(prev => !prev)}
        >
          {isFullscreen ? <MinimizeIcon className="h-4 w-4" /> : <MaximizeIcon className="h-4 w-4" />}
        </button>
        <button
          type="button"
          aria-label="F11"
          className={`flex h-7 w-7 items-center justify-center rounded hover:bg-gray-100 hover:text-[#4f8fd6] ${
            isNativeFullscreen ? 'text-[#4f8fd6]' : 'text-gray-700'
          }`}
          onClick={handleToggleNativeFullscreen}
        >
          <span className="inline-flex h-4 w-4 items-center justify-center text-[8px] font-bold">F11</span>
        </button>
      </div>
      <div className="flex min-h-0 flex-1">
        {!isFullscreen && <MarketMapFilterSidebar market={market} onMarketChange={handleMarketChange} />}
        <div ref={captureRef} data-captureid={CAPTURE_ID.MARKET_MAP} className="flex min-h-0 flex-1 flex-col">
          <div className="mb-1 flex h-7 w-full shrink-0 items-center justify-between border-2 border-black bg-black/70 px-1 text-sm font-bold text-white">
            <span>
              {MARKET_LABEL[market]}
              {showMarketValue && ` (시총: ${toJoEokDecimal(totalMarketValue / 100_000_000)})`}
              {showAvgChangeRate && ` (등락률 평균: ${toPctSigned(avgChangeRate)})`}
              {showUpDownCount && ` (상승: ${advancerCount} / 하락: ${declinerCount} / 보합: ${unchangedCount})`}
            </span>
            <div className="flex items-center gap-2">
              {data?.snapshotTime && (
                <span className="whitespace-nowrap text-xs font-normal text-white">
                  {toFullDateTimeLabel(data.snapshotTime)} 기준
                </span>
              )}
              <div className="flex items-center gap-0.5">
                {CHANGE_RATE_LEGEND.map(({ label, className }) => (
                  <div key={label} className={`flex h-5 w-9 items-center justify-center text-[10px] ${className}`}>
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
              onClick={() => goToDepth(0)}
              onMouseMove={e => {
                const target = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-breadcrumb-index]') : null
                setBreadcrumbHoverIndex(target ? Number(target.dataset.breadcrumbIndex) : 0)
              }}
              onMouseLeave={() => setBreadcrumbHoverIndex(null)}
              className="mb-1 flex h-7 w-full shrink-0 cursor-pointer items-center gap-1 truncate border-2 border-black bg-black/70 px-1 text-sm font-bold text-white"
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
                          goToDepth(segmentIndex)
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
              onSelectCategory={enterCategory}
              onExcludeCategory={handleExcludeCategory}
              heightClassName="min-h-0 flex-1"
              showMarketValue={showMarketValue}
              showAvgChangeRate={showAvgChangeRate}
              showUpDownCount={showUpDownCount}
              canExclude={isCustom}
            />
          )}
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
