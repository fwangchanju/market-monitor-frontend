import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import NavBar from '@/components/NavBar'
import SubNavBar from '@/components/SubNavBar'
import SettingsSidebar, {
  SettingsSidebarGroup,
  SettingsMarketValueSection,
  SettingsSectorChangeSection,
  SettingsStockChangeSection,
  SettingsSectorLevelSection,
  SettingsExcludeSection,
  SettingsColorSection,
  SettingsStrongIndustryColorSection,
  SettingsStockSizeSelector,
  type SettingsBookmarkId,
  type SettingsSidebarSectionId,
} from '@/components/SettingsSidebar'
import MarketMapShareModal from '@/components/MarketMapShareModal'
import MarketMapTreemap from '@/components/MarketMapTreemap'
import { MarketMapMarketCombobox, MarketMapPeriodCombobox } from '@/components/MarketMapControls'
import Spinner from '@/components/Spinner'
import NavBarPageActions, { PageRefreshButton, SNAPSHOT_REFRESH_HELP } from '@/components/NavBarPageActions'
import { FONT_BAR_MODE_STATUS, FONT_BAR_TIME } from '@/components/FontStyle'
import { useMarketMapDrilldown } from '@/hooks/useMarketMapDrilldown'
import { useGlobalSettings } from '@/hooks/useGlobalSettings'
import { usePageSetting } from '@/hooks/usePageSetting'
import { sanitizeBookmarkIds } from '@/utils/settingsBookmarks'
import { useIsLoggedIn } from '@/hooks/useSession'
import { useLoginGate } from '@/hooks/useLoginGate'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import type { DisplayGroup } from '@/hooks/useMarketMapLayout'
import { toCount, toMarketMapSnapshotDateLabel, toMarketMapSnapshotTimeOnlyLabel } from '@/utils/format'
import { captureElementToClipboard } from '@/utils/captureToClipboard'
import { CAPTURE_ID } from '@/utils/captureIds'
import { HEATMAP_NAMES } from '@/utils/heatmapNames'
import { marketRoute } from '@/utils/marketRoute'
import { captureElementToDownload } from '@/utils/captureToDownload'
import { limitDepth, flattenAllItems, type FilteredMarketMapSectorNode } from '@/hooks/useFilteredMarketMapTree'
import type { MarketQuery, MarketMapSectorNode, MarketMapItem } from '@/types/api'

const MARKET_LABEL: Record<MarketQuery, string> = { KOSPI: 'KOSPI', KOSDAQ: 'KOSDAQ', ALL_STOCK: 'ALL STOCK' }
// 종목·업종 헤더와 같은 방식 — 올리면 흰색 35% 덮개가 씌워진다(index.css의 hover와 같은 불투명도).
const BREADCRUMB_LINK_CLASS = 'flex h-full cursor-pointer items-center gap-1.5 border-0 bg-transparent pl-2 pr-1.5 text-lg leading-none font-bold text-white transition-colors hover:bg-white/35'

// 이름 오른쪽의 되돌아가기 표시 — 이름과 한 버튼이라서 올리면 함께 하이라이트된다.
function BreadcrumbBackIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </svg>
  )
}

// 북마크 탭이 한 화면에 들어가도록 항목 수를 제한한다.
const MAX_SETTINGS_BOOKMARKS = 5
const MAP_SETTINGS_SECTION_ORDER: SettingsSidebarSectionId[] = [
  'industry', 'composition', 'stockDisplay', 'colors', 'favorites',
]

// "업종 단계" 슬라이더가 "끄기"(뎁스 0)일 때만 쓰는 합성 섹터 — 실제 섹터가 아니므로
// sectorId는 실제 값과 겹치지 않는 sentinel을 쓰고, isSelf로 매칭해 헤더 자체를 안 그리게 한다
// (드릴다운으로 들어온 섹터의 헤더를 breadcrumb과 중복되지 않게 숨기는 것과 동일한 메커니즘).
const FLAT_GROUP_SECTOR_ID = -1
const FLAT_GROUP_NAME = '__flat__'

function toFlatDisplayGroup(items: MarketMapItem[]): DisplayGroup {
  return {
    sectorId: FLAT_GROUP_SECTOR_ID,
    sectorName: FLAT_GROUP_NAME,
    totalMarketValue: items.reduce((sum, item) => sum + item.totalMarketValue, 0),
    weightedAvgChangeRate: null,
    simpleAvgChangeRate: null,
    items,
    children: [],
  }
}

function toDisplayGroup(node: FilteredMarketMapSectorNode): DisplayGroup {
  return {
    sectorId: node.sectorId,
    sectorName: node.sectorName,
    totalMarketValue: node.totalMarketValue,
    weightedAvgChangeRate: node.weightedAvgChangeRate,
    simpleAvgChangeRate: node.simpleAvgChangeRate,
    items: node.items,
    children: node.children.map(toDisplayGroup),
  }
}

// 등락률 평균/상승·하락·보합 종목수는 개별 종목(changeRate) 기준이라, 지금 화면에 보이는
// 그룹들의 종목을 전부(하위 섹터 포함) 펼쳐서 모아야 한다.
function collectItems(groups: DisplayGroup[]): MarketMapItem[] {
  const result: MarketMapItem[] = []
  for (const group of groups) {
    result.push(...group.items)
    result.push(...collectItems(group.children))
  }
  return result
}

// 섹터 제외/시가총액 구간 필터를 적용하기 "전" 원본 트리 기준으로, 지금 보고 있는 뎁스(path)에
// 해당하는 종목을 전부 모은다 — "제외된 개수까지 포함한 전체 리스트 개수"를 보여주기 위한 분모.
function collectRawItems(nodes: MarketMapSectorNode[]): MarketMapItem[] {
  const result: MarketMapItem[] = []
  for (const node of nodes) {
    result.push(...node.items)
    result.push(...collectRawItems(node.children))
  }
  return result
}

function findRawNodeByPath(nodes: MarketMapSectorNode[], path: string[]): MarketMapSectorNode | null {
  let node: MarketMapSectorNode | null = null
  let siblings = nodes
  for (const name of path) {
    const found = siblings.find(n => n.sectorName === name)
    if (!found) return null
    node = found
    siblings = found.children
  }
  return node
}

type CopyStatus = 'idle' | 'copying' | 'copied' | 'error'
type DownloadStatus = 'idle' | 'downloading' | 'error'

export default function MarketMapCustomPage() {
  const navigate = useNavigate()
  const { pathname, search, hash } = useLocation()
  const isLoggedIn = useIsLoggedIn()
  const { requireLogin } = useLoginGate()
  // 북마크는 로그인 사용자의 서버 설정에만 저장한다. 비로그인이 누르면 저장하지 않고 로그인을 안내한다.
  const [storedSettingsBookmarks, setSettingsBookmarks] = usePageSetting<string[]>('marketMap.settingsBookmarks', [])
  // 없어진 항목의 id가 저장돼 있어도 개수 제한(5개)에 잡히지 않도록 알려진 id만 쓴다.
  const settingsBookmarks = sanitizeBookmarkIds(storedSettingsBookmarks)
  const toggleSettingsBookmark = (id: SettingsBookmarkId) => {
    if (!isLoggedIn) {
      requireLogin(`${pathname}${search}${hash}`)
      return
    }
    if (settingsBookmarks.includes(id)) {
      setSettingsBookmarks(settingsBookmarks.filter(item => item !== id))
    } else if (settingsBookmarks.length >= MAX_SETTINGS_BOOKMARKS) {
      window.alert(`북마크는 최대 ${MAX_SETTINGS_BOOKMARKS}개까지 설정할 수 있습니다.`)
    } else {
      setSettingsBookmarks([...settingsBookmarks, id])
    }
  }
  const {
    settingsModalProps,
    colorEditorPanelProps,
    market,
    isCustom,
    data,
    refetchMarketMap,
    isRefetchingMarketMap,
    isLoading,
    isError,
    rootNodes,
    filteredRootNodes,
    sectorChangeFilter,
    onChangeSectorChangeFilter,
    sectorChangeDepth,
    onChangeSectorChangeDepth,
    stockChangeFilter,
    onChangeStockChangeFilter,
    maxDepth,
    marketValueDepthRange,
    weightedAvgDepthRange,
    simpleAvgDepthRange,
    upDownCountDepthRange,
    boxSizeMarketCapRatio,
    onChangeBoxSizeMarketCapRatio,
    topPickSectorKeys,
    strongIndustryColor,
    onChangeStrongIndustryColor,
    onChangeAvgChangeRateUseSimple,
    onChangeSectorFilterEnabled,
    boxLabelMinAreaPercent,
    stockLabelMode,
    stockPopupOnHover,
    decimalPlaces,
    colorScale,
    handleExcludeSector,
  } = useGlobalSettings()

  const [searchParams, setSearchParams] = useSearchParams()
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>('idle')
  // null이 아니면 MarketMapTreemap이 해당 뎁스로 줄어드는 줌아웃 애니메이션을 재생하고, 끝나면
  // handleZoomOutComplete를 불러서 실제 이동을 한다 — 애니메이션 도중엔 path/groups를 먼저 바꾸지 않는다.
  const [zoomOutRequestDepth, setZoomOutRequestDepth] = useState<number | null>(null)
  const captureRef = useRef<HTMLDivElement>(null)

  const { path, setPath, currentNode, currentSiblings, enterSector, goToDepth, reset } = useMarketMapDrilldown(filteredRootNodes)

  // "업종 단계" 뎁스 제한을 "지금 보고 있는 위치"(currentNode, 없으면 최상위) 기준으로 매번 새로
  // 적용한다 — 진짜 루트 기준 절대값이 아니라, 어디로 드릴다운하든 거기서부터 다시 N단계가 보이는
  // 상대값이어야 한다(그래야 뎁스 제한 때문에 드릴다운 경로가 끊기거나 더 깊이 진입해도 항상 똑같이
  // 얕게만 보이는 문제가 없다). 드릴다운 상태에서는 헤더를 그리지 않는 자기 자신은 단계로 세지
  // 않고 그 자식부터 1단계로 센다. 거래소 분류는 useGlobalSettings가 대분류(1단계)로 제한한다.
  const effectiveMaxDepth = maxDepth
  // 뎁스 0("끄기")은 limitDepth로 표현할 수 없다(그 함수는 항상 최소 1뎁스 = 대분류 박스 하나는
  // 남긴다) — 완전 평탄화는 별도로 처리한다: 지금 보이는 위치 아래 종목을 전부 하나로 모아
  // isSelf 처리되는 합성 섹터 하나로 만들어서, 대분류 헤더까지 포함해 아무 섹터 박스도
  // 안 보이게 한다.
  const isFullyFlattened = effectiveMaxDepth === 0
  const displaySiblings =
    effectiveMaxDepth != null && !isFullyFlattened ? limitDepth(currentSiblings, effectiveMaxDepth) : currentSiblings
  const displayNode =
    currentNode && effectiveMaxDepth != null && !isFullyFlattened
      ? { ...currentNode, children: limitDepth(currentNode.children, effectiveMaxDepth) }
      : currentNode
  const groups: DisplayGroup[] = isFullyFlattened
    ? [toFlatDisplayGroup(flattenAllItems(currentNode ? [currentNode] : currentSiblings))]
    : displayNode
      ? [toDisplayGroup(displayNode)]
      : displaySiblings.map(toDisplayGroup)
  const visibleItems = collectItems(groups)
  // 지금 뎁스(path) 기준으로, 섹터 제외/시가총액 구간 필터를 적용하기 전 원본 트리에 있는 전체 종목 수.
  const rawCurrentNode = findRawNodeByPath(rootNodes, path)
  const totalItemCount = collectRawItems(rawCurrentNode ? [rawCurrentNode] : rootNodes).length

  // 상단 바는 현재 히트맵을 점등 표시로 보여준다. 종목 수는 설정 사이드바에 표시한다.
  const modeStatusText = (
    <>
      <span
        className={`mr-1.5 inline-block h-2 w-2 rounded-full ${
          isCustom ? 'bg-[#c6ff00] shadow-[0_0_5px_1px_rgba(198,255,0,0.8)]' : 'bg-gray-400'
        }`}
      />
      <span className="text-gray-400">{HEATMAP_NAMES[isCustom ? 'marketry' : 'krx'].title}</span>
    </>
  )

  // market은 이제 useGlobalSettings(useRouteAwareMarket)가 경로/쿼리를 반영해서 매 렌더 계산해준다 —
  // 여기서는 그 값이 바뀔 때(SubNavBar에서 마켓을 고르는 등) 드릴다운만 초기화한다. 첫 렌더는 초기화할
  // 드릴다운이 없으므로 ref로 이전 값과 비교해서 실제로 바뀐 경우에만 반응한다.
  const previousMarketRef = useRef(market)
  useEffect(() => {
    if (previousMarketRef.current === market) return
    previousMarketRef.current = market
    reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- market이 바뀔 때만 반응하면 됨(reset은 매 렌더 새 함수)
  }, [market])

  // 렌더러가 옛 캡처 URL(?market=...)로 요청할 때도 마켓 자체는 useGlobalSettings가 이미 우선 반영했으니,
  // 여기서는 avgMode/sectorFilter를 반영하고 소비한 쿼리 파라미터만 주소에서 지운다.
  useEffect(() => {
    const marketParam = searchParams.get('market')
    const isValidMarket = marketParam === 'KOSPI' || marketParam === 'KOSDAQ' || marketParam === 'ALL_STOCK'

    // 백엔드가 캡처 URL에 싣는 avgMode=simple|weighted, sectorFilter=true|false 계약에 맞춘다
    // (market-monitor-backend의 instructions-telegram-average-mode.md 결정 6).
    const avgModeParam = searchParams.get('avgMode')
    const isValidAvgMode = avgModeParam === 'simple' || avgModeParam === 'weighted'
    if (isValidAvgMode) onChangeAvgChangeRateUseSimple(avgModeParam === 'simple')

    const sectorFilterParam = searchParams.get('sectorFilter')
    const isValidSectorFilter = sectorFilterParam === 'true' || sectorFilterParam === 'false'
    if (isValidSectorFilter) onChangeSectorFilterEnabled(sectorFilterParam === 'true')

    if (!isValidMarket && !isValidAvgMode && !isValidSectorFilter) return
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev)
        if (isValidMarket) next.delete('market')
        if (isValidAvgMode) next.delete('avgMode')
        if (isValidSectorFilter) next.delete('sectorFilter')
        return next
      },
      { replace: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 파라미터가 있을 때만 반응하면 됨
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

  // 들어간 단계 = 브라우저 기록 한 칸. 분류에 한 단계 들어갈 때마다 기록에 한 칸씩 쌓아서(직접 깊은 단계로
  // 들어가면 그 단계 수만큼), 브라우저 뒤로가기(⌘[, 트랙패드 스와이프, 마우스 뒤로가기 버튼)를 연달아
  // 눌러도 칸이 있는 만큼 계속 한 단계씩 올라간다. 전체 화면에서 더 누르면 원래대로 사이트 이전 페이지로
  // 나간다. 앞으로가기(⌘])는 들어갔던 단계로 다시 내려간다. 각 칸은 그 시점의 경로(marketMapPath)를 가진다.
  const historyDepthRef = useRef(0) // 지금 브라우저 기록 위치가 가리키는 깊이
  const historyConsumingRef = useRef(false) // 코드가 일으킨 history.go()의 popstate는 무시한다
  const historyPathnameRef = useRef('') // 기록 칸을 쌓은 주소 — 다른 주소로 이동했으면 go()로 정리하지 않는다
  const prevPathLengthRef = useRef(0)
  const pendingUpDepthRef = useRef<number | null>(null)

  // 위로 가는 요청 — 줌아웃 애니메이션 중이면 가장 위쪽 목표 깊이만 기억해 뒀다가 끝나면 이어서 처리한다.
  const requestDepth = (target: number) => {
    if (zoomOutRequestDepth !== null) {
      pendingUpDepthRef.current = pendingUpDepthRef.current === null ? target : Math.min(pendingUpDepthRef.current, target)
      return
    }
    handleGoToDepth(target)
  }
  useEffect(() => {
    if (zoomOutRequestDepth !== null || pendingUpDepthRef.current === null) return
    const target = pendingUpDepthRef.current
    pendingUpDepthRef.current = null
    if (target < path.length) handleGoToDepth(target)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleGoToDepth는 매 렌더 새 함수
  }, [zoomOutRequestDepth, path.length])

  // 경로 길이가 바뀔 때 기록을 맞춘다 — 들어갈 때는 칸을 쌓고, 버튼/백스페이스/시장 전환 등으로 올라올 때는
  // 남은 칸을 history.go()로 정리한다(뒤로가기로 올라온 경우는 이미 칸이 소모돼 있어 할 일이 없다).
  useEffect(() => {
    const depth = path.length
    const previous = prevPathLengthRef.current
    prevPathLengthRef.current = depth
    if (depth > previous) {
      if (depth > historyDepthRef.current) {
        for (let k = historyDepthRef.current + 1; k <= depth; k++) {
          window.history.pushState({ ...(window.history.state ?? {}), marketMapPath: path.slice(0, k) }, '')
        }
        historyDepthRef.current = depth
        historyPathnameRef.current = window.location.pathname
      }
    } else if (depth < previous && depth < historyDepthRef.current) {
      const stale = historyDepthRef.current - depth
      historyDepthRef.current = depth
      if (window.location.pathname === historyPathnameRef.current) {
        historyConsumingRef.current = true
        window.history.go(-stale)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 길이가 바뀔 때만 반응하면 된다(path 내용은 그때의 값을 쓴다)
  }, [path.length])
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (historyConsumingRef.current) {
        historyConsumingRef.current = false
        return
      }
      // 이 지도 화면 안에서의 이동만 다룬다 — 다른 페이지로 나가는 뒤로가기는 그대로 둔다.
      if (!window.location.pathname.startsWith('/map')) return
      const target: string[] = Array.isArray(e.state?.marketMapPath) ? e.state.marketMapPath : []
      historyDepthRef.current = target.length
      if (target.length < path.length) requestDepth(target.length)
      else if (target.length > path.length) setPath(target)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- requestDepth/handleGoToDepth는 매 렌더 새 함수이고 path/zoomOutRequestDepth로 충분히 갱신된다
  }, [path, zoomOutRequestDepth])

  // 백스페이스 = 브라우저 뒤로가기와 같다(한 단계 위로). 돌아가는 버튼이 눈에 잘 안 띄어서 백스페이스를 누르는
  // 경우가 많다. 글자를 입력하는 중(입력창/편집 영역)이거나 수정키가 같이 눌렸거나 공유 팝업이 떠 있거나
  // 이미 전체 화면이면 동작하지 않고, 키를 계속 누르고 있어도(자동 반복) 한 번만 동작한다.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Backspace' || e.repeat) return
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      const target = e.target
      if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return
      if (isShareOpen || historyDepthRef.current <= 0) return
      e.preventDefault()
      window.history.back()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isShareOpen])

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
  const downloadLabel = downloadStatus === 'error' ? '다운로드 실패' : '다운로드'

  return (
    <div className="flex h-screen select-none flex-col overflow-hidden bg-black">
      <NavBar />
      <SubNavBar
        actions={
          <NavBarPageActions
            onRefresh={refetchMarketMap}
            isRefreshing={isRefetchingMarketMap}
            onToggleSettings={() => settingsModalProps.onOpenChange(!settingsModalProps.isOpen)}
            isSettingsOpen={settingsModalProps.isOpen}
            onOpenShare={() => setIsShareOpen(true)}
            isNativeFullscreen={isNativeFullscreen}
            onToggleFullscreen={handleToggleNativeFullscreen}
            showSnapshotControls={Boolean(data?.snapshotTime)}
            showRefresh={false}
          />
        }
      />
      <div className="flex min-h-0 flex-1">
        {/* 공유 캡처(captureRef)는 [세 번째 바+본문] 열만 찍는다 — 설정 사이드바는 캡처에 넣지 않는다.
            data-captureid는 백엔드 렌더러가 잡는 셀렉터라 바깥 wrapper에 그대로 둔다. */}
        <div
          data-captureid={CAPTURE_ID.MAP}
          data-capture-ready={!isLoading}
          className="relative z-10 -mt-[10.5px] flex min-h-0 flex-1 bg-black"
        >
          {/* min-w-0: 이 컬럼의 자동 최소 폭을 0으로 눌러서(overflow: visible이면 내부 콘텐츠의
              min-content 폭을 그대로 강제해서 사이드바 쪽을 밀어냄) 창을 좁혀도 사이드바(w-80)가
              항상 같은 폭을 유지하게 한다 — 내부 콘텐츠(트리맵)가 넘치면 이 컬럼 안에서만 처리된다. */}
          <div ref={captureRef} className="flex min-h-0 min-w-0 flex-1 flex-col bg-black">
            {/* relative + absolute 중앙 배치: 커스텀 모드 표시를 grid 가운데 열로 두면 좌/우 칸의
                콘텐츠 폭(마켓명·지수, 시간)이 달라질 때마다 가운데 열 자체의 중심이 바뀌어서 바
                전체 기준으로는 중앙이 아니게 된다 — 바 전체 폭 기준 절대 중앙에 고정한다. */}
            <div className="relative mt-[5.25px] mb-[5.25px] flex h-7 w-full shrink-0 items-center justify-between bg-black/70 pl-2 pr-3 text-sm font-bold text-white">
              <div className="flex items-center gap-2 whitespace-nowrap">
                <MarketMapMarketCombobox
                  market={market}
                  onSelect={selectedMarket => {
                    if (selectedMarket === market) handleGoToDepth(0)
                    else navigate(marketRoute('/map', selectedMarket))
                  }}
                />
                <MarketMapPeriodCombobox />
                {data?.snapshotTime && (
                  <span className={`${FONT_BAR_TIME} ml-1 flex items-center gap-1.5 whitespace-nowrap text-gray-400`}>
                    <span>{toMarketMapSnapshotDateLabel(data.snapshotTime)}</span>
                    <span>{toMarketMapSnapshotTimeOnlyLabel(data.snapshotTime)}</span>
                  </span>
                )}
                <PageRefreshButton onRefresh={refetchMarketMap} isRefreshing={isRefetchingMarketMap} className="-ml-[10px]" helpText={SNAPSHOT_REFRESH_HELP} />
              </div>
              <span
                className={`${FONT_BAR_MODE_STATUS} absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-gray-400`}
              >
                {modeStatusText}
              </span>
            </div>
            <div className="flex min-h-0 flex-1">
              <div className="flex min-h-0 flex-1 flex-col bg-black">
              {path.length > 0 && (
                // 이름마다 "그 단계로만" 이동하는 링크다 — 줄 전체를 눌러 전체로 가던 동작은 없앴다. 지금 보고 있는
                // 마지막 이름은 링크가 아니라 현재 위치 표시(흰색)다.
                <nav
                  aria-label="업종 이동 경로"
                  className="flex h-7 w-full shrink-0 items-center truncate bg-black/70 text-lg leading-none font-bold"
                >
                  <button
                    type="button"
                    title="전체로 되돌아가기"
                    onClick={() => handleGoToDepth(0)}
                    style={{ fontFamily: 'inherit' }}
                    className={BREADCRUMB_LINK_CLASS}
                  >
                    {MARKET_LABEL[market]}
                    <BreadcrumbBackIcon />
                  </button>
                  {path.map((name, index) => {
                    const isLastPath = index === path.length - 1
                    return isLastPath ? (
                      <span key={index} aria-current="page" className="px-2 text-[var(--accent)]">{name}</span>
                    ) : (
                      <button
                        key={index}
                        type="button"
                        title={`${name} 단계로 되돌아가기`}
                        onClick={() => handleGoToDepth(index + 1)}
                        style={{ fontFamily: 'inherit' }}
                        className={BREADCRUMB_LINK_CLASS}
                      >
                        {name}
                        <BreadcrumbBackIcon />
                      </button>
                    )
                  })}
                </nav>
              )}
              {isLoading ? (
                <div className="flex flex-1 items-center justify-center">
                  <Spinner />
                </div>
              ) : isError ? (
                <div className="p-8 text-center text-xs text-gray-500">데이터를 불러오지 못했습니다</div>
              ) : visibleItems.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-500">
                  {stockChangeFilter === 'all' && sectorChangeFilter === 'all' ? '데이터가 없습니다' : '선택한 방향 조건에 해당하는 종목이 없습니다'}
                </div>
              ) : (
                <MarketMapTreemap
                  groups={groups}
                  selfSectorName={isFullyFlattened ? FLAT_GROUP_NAME : (currentNode?.sectorName ?? null)}
                  depth={path.length}
                  onSelectSector={enterSector}
                  onExcludeSector={handleExcludeSector}
                  heightClassName="min-h-0 flex-1"
                  marketValueDepthRange={marketValueDepthRange}
                  weightedAvgDepthRange={weightedAvgDepthRange}
                  simpleAvgDepthRange={simpleAvgDepthRange}
                  upDownCountDepthRange={upDownCountDepthRange}
                  boxSizeMarketCapRatio={boxSizeMarketCapRatio}
                  canExclude={isCustom || !isLoggedIn}
                  colorScale={colorScale}
                  labelMinAreaPercent={boxLabelMinAreaPercent}
                  stockLabelMode={stockLabelMode}
                  stockPopupOnHover={stockPopupOnHover}
                  decimalPlaces={decimalPlaces}
                  topPickSectorKeys={topPickSectorKeys}
                  strongIndustryColor={strongIndustryColor}
                  zoomOutRequestDepth={zoomOutRequestDepth}
                  onZoomOutComplete={handleZoomOutComplete}
                />
              )}
              </div>
            </div>
          </div>
          <SettingsSidebar
            {...settingsModalProps}
            boxSizeMarketCapRatio={boxSizeMarketCapRatio}
            onChangeBoxSizeMarketCapRatio={onChangeBoxSizeMarketCapRatio}
            pageLabel="지도"
            sectionOrder={MAP_SETTINGS_SECTION_ORDER}
            classificationAtBottom
            stockCountLabel={`${toCount(visibleItems.length)}/${toCount(totalItemCount)}종목`}
            bookmarks={settingsBookmarks}
            onToggleBookmark={toggleSettingsBookmark}
            bookmarkLoginRequired={!isLoggedIn}
            onRequestLogin={() => requireLogin(`${pathname}${search}${hash}`)}
            onToggleCustom={() => {
              settingsModalProps.onToggleCustom()
              reset()
            }}
          >
            <SettingsSidebarGroup section="composition">
              <SettingsMarketValueSection {...settingsModalProps} showDivider={false} />
              <SettingsSectorChangeSection
                value={sectorChangeFilter}
                onChange={value => {
                  onChangeSectorChangeFilter(value)
                  reset()
                }}
                depth={sectorChangeDepth}
                onChangeDepth={depth => {
                  onChangeSectorChangeDepth(depth)
                  reset()
                }}
                maxSelectableDepth={Math.max(1, settingsModalProps.topPickMaxSelectableDepth)}
              />
              <SettingsStockChangeSection
                value={stockChangeFilter}
                onChange={value => {
                  onChangeStockChangeFilter(value)
                  reset()
                }}
              />
              <SettingsExcludeSection {...settingsModalProps} afterStockChange />
            </SettingsSidebarGroup>
            <SettingsSidebarGroup section="industry">
              <SettingsSectorLevelSection {...settingsModalProps} showTopPick showStockDisplay={false} />
            </SettingsSidebarGroup>
            <SettingsSidebarGroup section="stockDisplay">
              <SettingsSectorLevelSection {...settingsModalProps} showClassification={false} showDecimalPlaces />
            </SettingsSidebarGroup>
            {/* 북마크 탭 — 원래 탭의 항목을 같은 순서로 다시 그리고, 북마크한 항목만 보인다. */}
            <SettingsSidebarGroup section="favorites">
              <SettingsSectorLevelSection {...settingsModalProps} showTopPick showStockDisplay={false} />
              <SettingsMarketValueSection {...settingsModalProps} showDivider={false} />
              <SettingsSectorChangeSection
                value={sectorChangeFilter}
                onChange={value => {
                  onChangeSectorChangeFilter(value)
                  reset()
                }}
                depth={sectorChangeDepth}
                onChangeDepth={depth => {
                  onChangeSectorChangeDepth(depth)
                  reset()
                }}
                maxSelectableDepth={Math.max(1, settingsModalProps.topPickMaxSelectableDepth)}
              />
              <SettingsStockChangeSection
                value={stockChangeFilter}
                onChange={value => {
                  onChangeStockChangeFilter(value)
                  reset()
                }}
              />
              <SettingsStockSizeSelector marketCapRatio={boxSizeMarketCapRatio} onChangeMarketCapRatio={onChangeBoxSizeMarketCapRatio} />
              <SettingsSectorLevelSection {...settingsModalProps} showClassification={false} showDecimalPlaces />
              {strongIndustryColor && onChangeStrongIndustryColor && (
                <SettingsStrongIndustryColorSection color={strongIndustryColor} onChange={onChangeStrongIndustryColor} />
              )}
            </SettingsSidebarGroup>
            <SettingsSidebarGroup section="colors">
              {strongIndustryColor && onChangeStrongIndustryColor && (
                <SettingsStrongIndustryColorSection color={strongIndustryColor} onChange={onChangeStrongIndustryColor} />
              )}
              <SettingsColorSection {...settingsModalProps} colorEditorProps={colorEditorPanelProps} />
            </SettingsSidebarGroup>
          </SettingsSidebar>
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
