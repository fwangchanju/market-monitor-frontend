import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
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
import { TAB_GAP, toFullDateTimeLabel } from '@/utils/format'
import { captureElementToClipboard } from '@/utils/captureToClipboard'
import { CAPTURE_ID } from '@/utils/captureIds'
import { captureElementToDownload } from '@/utils/captureToDownload'
import { registerExcludedCategory, unregisterExcludedCategory } from '@/api/marketMap'
import { MARKET_VALUE_TIER_ASCENDING, MARKET_VALUE_TIER_SHORT_LABEL } from '@/utils/marketValueTier'
import type { Market, MarketMapCategoryNode, MarketMapItem, MarketValueTier } from '@/types/api'

// 왼쪽 사이드바 필터 버튼 텍스트(MarketMapFilterSidebar의 FILTER_ITEMS)와 동일하게 맞춘다.
const MARKET_LABEL: Record<Market, string> = { KOSPI: 'KOSPI', KOSDAQ: 'KOSDAQ' }

// 종목 박스 색상 로직(MarketMapBox.boxColorClass)과 같은 방향(0에 가까울수록 짙고 탁하게,
// 멀어질수록 쨍하게)의 범례. 박스 쪽은 4단계지만 범례는 -3%~+3% 7칸에 맞춰 3단계로 축약했다.
const CHANGE_RATE_LEGEND = [
  { label: '-10%', className: 'bg-blue-500' },
  { label: '-6%', className: 'bg-blue-600' },
  { label: '-2%', className: 'bg-blue-700' },
  { label: '0%', className: 'bg-gray-600' },
  { label: '+2%', className: 'bg-red-700' },
  { label: '+6%', className: 'bg-red-600' },
  { label: '+10%', className: 'bg-red-500' },
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

// 표시 옵션 슬라이더 인덱스(0=OFF, 1=뎁스0, 2=뎁스1, ...)를 실제 뎁스 범위로 변환한다.
// max가 OFF(0)에 있으면 완전히 꺼짐.
function toDepthRange(minIndex: number, maxIndex: number): [number, number] | null {
  return maxIndex > 0 ? [Math.max(minIndex - 1, 0), maxIndex - 1] : null
}

export default function MarketMapCustomPage() {
  const [market, setMarket] = useState<Market>('KOSPI')
  const [isCustom, setIsCustom] = useState(true)
  // 세 표시 옵션(시가총액 합/등락률 평균/등락 종목수) 모두 슬라이더 인덱스 기준(0=OFF, 1=뎁스0, 2=뎁스1, ...)
  // — 둘 다 0(OFF)이면 꺼짐. 실제 뎁스 범위로 변환한 값은 각각의 DepthRange를 통해서만 하위로 내려보낸다.
  const [marketValueDepthMinIndex, setMarketValueDepthMinIndex] = useState(0)
  const [marketValueDepthMaxIndex, setMarketValueDepthMaxIndex] = useState(0)
  // 기본값: 2차 분류만 켜짐(렌더러가 캡처하는 기본 화면에 등락률이 보이도록).
  const [avgChangeRateDepthMinIndex, setAvgChangeRateDepthMinIndex] = useState(2)
  const [avgChangeRateDepthMaxIndex, setAvgChangeRateDepthMaxIndex] = useState(2)
  const [upDownCountDepthMinIndex, setUpDownCountDepthMinIndex] = useState(0)
  const [upDownCountDepthMaxIndex, setUpDownCountDepthMaxIndex] = useState(0)
  // MARKET_VALUE_TIER_ASCENDING(소→초) 기준 인덱스 — 이 구간(포함) 밖의 등급은 제외된다.
  // 기본값(양끝)이면 아무것도 제외 안 함.
  // 기본값: 중형주~초대형주만(소형주 제외) 표시.
  const [tierRangeMinIndex, setTierRangeMinIndex] = useState(MARKET_VALUE_TIER_ASCENDING.indexOf('MID'))
  const [tierRangeMaxIndex, setTierRangeMaxIndex] = useState(MARKET_VALUE_TIER_ASCENDING.length - 1)
  const [excludedCategoryNames, setExcludedCategoryNames] = useState<Map<number, string>>(new Map())
  // 섹터 제외를 목록별로 켜고 끄는 게 아니라, 제외 적용 자체를 통째로 켜고 끄는 마스터 스위치.
  const [sectorFilterEnabled, setSectorFilterEnabled] = useState(true)
  // null = 제한 없음(전체 뎁스 표시). 슬라이더의 실제 상한(availableMaxDepth)은 트리 계산 후에 나온다.
  // 기본값 2(렌더러 캡처 기준 화면에 맞춤).
  const [maxDepth, setMaxDepth] = useState<number | null>(2)
  const [searchParams, setSearchParams] = useSearchParams()
  const [isFullscreen, setIsFullscreen] = useState(() => searchParams.get('fullscreen') === 'on')
  // 초기 상태 읽는 용도일 뿐, 주소창에 계속 남아있을 필요는 없어서 진입 직후 지운다.
  useEffect(() => {
    if (!searchParams.has('fullscreen')) return
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev)
        next.delete('fullscreen')
        return next
      },
      { replace: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 진입 시 한 번만 지우면 됨
  }, [])
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false)
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>('idle')
  // 브레드크럼에서 지금 hover 중인 구간의 인덱스 — 이 인덱스 이하(자기 자신 포함) 구간을 전부 강조 표시한다.
  const [breadcrumbHoverIndex, setBreadcrumbHoverIndex] = useState<number | null>(null)
  // null이 아니면 MarketMapTreemap이 해당 뎁스로 줄어드는 줌아웃 애니메이션을 재생하고, 끝나면
  // handleZoomOutComplete를 불러서 실제 이동을 한다 — 애니메이션 도중엔 path/groups를 먼저 바꾸지 않는다.
  const [zoomOutRequestDepth, setZoomOutRequestDepth] = useState<number | null>(null)
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

  // 슬라이더의 두 핸들(포함) 밖에 있는 등급만 실제 필터링에 쓰는 Set으로 변환한다.
  // 커스텀 모드가 아니면(기본 분류 트리) 시가총액 구간 필터도 무시한다 — 카테고리 제외와 동일하게 커스텀 트리 전용 기능.
  const excludedMarketValueTiers = useMemo(
    () =>
      isCustom
        ? new Set(
            MARKET_VALUE_TIER_ASCENDING.filter((_, index) => index < tierRangeMinIndex || index > tierRangeMaxIndex),
          )
        : new Set<MarketValueTier>(),
    [tierRangeMinIndex, tierRangeMaxIndex, isCustom],
  )

  // 커스텀 모드가 아니면 뎁스 제한도 무시한다(기본 트리는 어차피 사실상 1뎁스).
  const { filteredRootNodes, availableMaxDepth } = useFilteredMarketMapTree(
    rootNodes,
    excludedCategoryIds,
    excludedMarketValueTiers,
    isCustom ? maxDepth : null,
  )

  // 데이터가 얕아서(예: 기본값 2인데 실제 뎁스가 1까지밖에 없음) 저장된 범위가 availableMaxDepth를
  // 넘어설 수 있다 — 이럴 땐 어중간하게 줄여서 보여주는 대신 아예 OFF로 취급한다("분류 차수 범위"
  // 단일 슬라이더처럼 최대치로 줄여 보여주는 것과는 다른 정책). 실제 뎁스 범위 계산은 물론, 슬라이더에
  // 내려보내는 값도 이 값으로 통일해야 슬라이더 내부 드래그/클릭 판정도 어긋나지 않는다.
  const clampDepthRange = (minIndex: number, maxIndex: number): [number, number] =>
    maxIndex > availableMaxDepth ? [0, 0] : [minIndex, maxIndex]
  const [marketValueClampedMinIndex, marketValueClampedMaxIndex] = clampDepthRange(
    marketValueDepthMinIndex,
    marketValueDepthMaxIndex,
  )
  const [avgChangeRateClampedMinIndex, avgChangeRateClampedMaxIndex] = clampDepthRange(
    avgChangeRateDepthMinIndex,
    avgChangeRateDepthMaxIndex,
  )
  const [upDownCountClampedMinIndex, upDownCountClampedMaxIndex] = clampDepthRange(
    upDownCountDepthMinIndex,
    upDownCountDepthMaxIndex,
  )

  // 슬라이더 인덱스(0=OFF, 1=뎁스0, ...)를 실제 뎁스 범위로 변환 — max가 OFF(0)에 있으면 완전히 꺼짐.
  const marketValueDepthRange = toDepthRange(marketValueClampedMinIndex, marketValueClampedMaxIndex)
  const avgChangeRateDepthRange = toDepthRange(avgChangeRateClampedMinIndex, avgChangeRateClampedMaxIndex)
  const upDownCountDepthRange = toDepthRange(upDownCountClampedMinIndex, upDownCountClampedMaxIndex)

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

  // 상단 바에 지금 켜져있는 모드/시가총액 구간 상태를 한눈에 보여주기 위한 요약 텍스트.
  const isFullTierRange = tierRangeMinIndex === 0 && tierRangeMaxIndex === MARKET_VALUE_TIER_ASCENDING.length - 1
  // 큰 등급 -> 작은 등급 순서로 출력.
  const tierRangeText = `${MARKET_VALUE_TIER_SHORT_LABEL[MARKET_VALUE_TIER_ASCENDING[tierRangeMaxIndex]]}~${MARKET_VALUE_TIER_SHORT_LABEL[MARKET_VALUE_TIER_ASCENDING[tierRangeMinIndex]]}`
  // 상위 - 하위 경로 구분자를 "내"로 바꿔서 이어붙인다: "금융 - 금속" -> "금융 내 금속".
  const excludedSectorNames = Array.from(excludedCategoryNames.values())
    .map(name => name.replace(/ - /g, ' 내 '))
    .join(', ')
  const modeStatusText = isCustom ? (
    <>
      <span className="underline">커스텀 모드</span> 사용 중
      {!isFullTierRange && (
        <>
          {TAB_GAP}
          <span className="underline">{tierRangeText}</span>만 표시
        </>
      )}
      {excludedCategoryIds.size > 0 && (
        <>
          {TAB_GAP}
          <span className="underline">{excludedSectorNames}</span> 제외
        </>
      )}
      {TAB_GAP}
      {visibleItems.length}/{totalItemCount}종목
    </>
  ) : (
    <>
      <span className="underline">커스텀 모드</span> 미사용{TAB_GAP}
      {visibleItems.length}/{totalItemCount}종목
    </>
  )

  const handleMarketChange = (next: Market) => {
    setMarket(next)
    reset()
  }

  const handleToggleCustom = () => {
    setIsCustom(prev => !prev)
    reset()
  }

  const handleChangeTierRange = (minIndex: number, maxIndex: number) => {
    setTierRangeMinIndex(minIndex)
    setTierRangeMaxIndex(maxIndex)
  }

  // breadcrumb에서 상위 뎁스로 갈 때, 바로 이동하지 않고 줌아웃 애니메이션을 먼저 요청한다.
  const handleGoToDepth = (depth: number) => {
    if (depth >= path.length) return
    setZoomOutRequestDepth(depth)
  }
  const handleZoomOutComplete = (depth: number) => {
    goToDepth(depth)
    setZoomOutRequestDepth(null)
  }

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
          marketValueDepthMinIndex={marketValueClampedMinIndex}
          marketValueDepthMaxIndex={marketValueClampedMaxIndex}
          onChangeMarketValueDepthRange={(min, max) => {
            setMarketValueDepthMinIndex(min)
            setMarketValueDepthMaxIndex(max)
          }}
          avgChangeRateDepthMinIndex={avgChangeRateClampedMinIndex}
          avgChangeRateDepthMaxIndex={avgChangeRateClampedMaxIndex}
          onChangeAvgChangeRateDepthRange={(min, max) => {
            setAvgChangeRateDepthMinIndex(min)
            setAvgChangeRateDepthMaxIndex(max)
          }}
          upDownCountDepthMinIndex={upDownCountClampedMinIndex}
          upDownCountDepthMaxIndex={upDownCountClampedMaxIndex}
          onChangeUpDownCountDepthRange={(min, max) => {
            setUpDownCountDepthMinIndex(min)
            setUpDownCountDepthMaxIndex(max)
          }}
          tierRangeMinIndex={tierRangeMinIndex}
          tierRangeMaxIndex={tierRangeMaxIndex}
          onChangeTierRange={handleChangeTierRange}
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
        <div ref={captureRef} data-captureid={CAPTURE_ID.MARKET_MAP} className="flex min-h-0 flex-1 flex-col bg-black">
          <div className="mb-1 grid h-7 w-full shrink-0 grid-cols-[auto_1fr_auto] items-center border-2 border-black bg-black/70 px-1 text-sm font-bold text-white">
            <span className="whitespace-nowrap">{MARKET_LABEL[market]}</span>
            <span className="min-w-0 whitespace-nowrap text-center text-sm font-normal text-gray-400">
              {modeStatusText}
            </span>
            <div className="flex items-center gap-3">
              {data?.snapshotTime && (
                <span className="whitespace-nowrap text-xs font-normal text-white">
                  {toFullDateTimeLabel(data.snapshotTime)}
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
              onClick={() => handleGoToDepth(0)}
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
              canExclude={isCustom}
              zoomOutRequestDepth={zoomOutRequestDepth}
              onZoomOutComplete={handleZoomOutComplete}
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
