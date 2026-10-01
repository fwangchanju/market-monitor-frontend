import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { usePersistedState } from './usePersistedState'
import { useLocalPersistedState } from './useLocalPersistedState'
import { GUEST_DEFAULTS, MEMBER_DEFAULTS, settingDefaultsFor } from '@/utils/settingDefaults'
import type { HeatmapKey } from '@/utils/heatmapNames'
import { usePageSetting } from './usePageSetting'
import { useRouteAwareMarket } from './useRouteAwareMarket'
import { useIsLoggedIn, useSession } from './useSession'
import { useLoginGate } from './useLoginGate'
import { useMarketMap } from './useMarketMap'
import { useMarketMapColorScale } from './useMarketMapColorScale'
import {
  useCreateCustomScaleThreshold as useCreateMarketMapScaleThreshold,
  useUpdateCustomScaleThreshold as useUpdateMarketMapScaleThreshold,
  useDeleteCustomScaleThreshold as useDeleteMarketMapScaleThreshold,
} from './useMarketMapCustom'
import {
  collectSectorsAtDepth,
  useFilteredMarketMapTree,
  type FilteredMarketMapSectorNode,
  type StockChangeFilter,
  type SectorChangeFilter,
} from './useFilteredMarketMapTree'
import { useMarketValueTierRange } from './useMarketValueTierRange'
import { registerExcludedSector, unregisterExcludedSector } from '@/api/marketMap'
import {
  createDefaultColorScale,
  resolveLegendSwatches,
  type ColorScaleConfig,
  type ColorScaleThreshold,
} from '@/utils/marketMapColorScale'
import { withStableSectorIds } from '@/utils/guestSectorIds'
import type { MarketMapSectorNode } from '@/types/api'

// 조회 실패/로딩 중이거나 "색상 커스텀 사용"이 꺼져있을 때 쓰는 폴백 — thresholds가 비어있으면 어차피
// 기본 프리셋으로 귀결된다(resolveMarketMapColor/resolveLegendSwatches 참고).
const EMPTY_COLOR_SCALE: ColorScaleConfig = { thresholds: [] }
const DEFAULT_STRONG_INDUSTRY_COLOR = MEMBER_DEFAULTS.strongIndustryColor
const LEGACY_STRONG_INDUSTRY_COLOR = '#eab308'

export type DepthMetric = 'weightedAvgChangeRate' | 'simpleAvgChangeRate' | 'upDownCount' | 'marketValue'
type StoredDepthMetric = DepthMetric | 'avgChangeRate' | [number, number] | null
const DEPTH_METRICS: DepthMetric[] = ['weightedAvgChangeRate', 'simpleAvgChangeRate', 'upDownCount', 'marketValue']

function resolveDepthMetric(stored: StoredDepthMetric): DepthMetric {
  // 예전에는 박스 크기 옵션과 등락률 평균 방식이 연결돼 있었다. 이전 저장값은
  // 독립 선택으로 전환하면서 동일 가중을 고정 기본값으로 사용해 더 이상 박스 크기를 따르지 않는다.
  if (Array.isArray(stored)) {
    if (stored[0] === 0 && stored[1] === 1) return 'simpleAvgChangeRate'
    return DEPTH_METRICS[stored[0]] ?? 'simpleAvgChangeRate'
  }
  return stored === 'avgChangeRate' || stored === null ? 'simpleAvgChangeRate' : stored
}

// 트리맵 종목 박스에 이름/등락률 중 뭘 보여줄지 — 슬라이더 인덱스로 저장(0~3). off는 둘 다 안 보여준다.
export type StockLabelMode = 'off' | 'nameOnly' | 'rateOnly' | 'both'
const STOCK_LABEL_MODES: StockLabelMode[] = ['off', 'nameOnly', 'rateOnly', 'both']

// sectorId -> "상위 - 하위" 형태의 전체 경로. "이 섹터가 제외 목록에 있는지"만 관리하고,
// 실제로 화면에서 걸러낼지는 별도의 sectorFilterEnabled 마스터 스위치가 결정한다.
function seedExcludedSectorNames(
  nodes: MarketMapSectorNode[],
  ancestors: string[] = [],
  out: Map<number, string> = new Map(),
) {
  for (const node of nodes) {
    const path = [...ancestors, node.sectorName]
    if (node.isExcluded) out.set(node.sectorId, path.join(' > '))
    seedExcludedSectorNames(node.children, path, out)
  }
  return out
}

// 우클릭 제외 시점엔 리프 섹터명만 알고 있으므로, 뎁스가 있으면(최상위가 아니면) 원본 트리에서
// 조상 경로를 다시 찾아 "상위 - 하위" 형태로 만든다. 최상위면 경로 길이가 1이라 그대로 리프명만 나온다.
function findSectorPath(nodes: MarketMapSectorNode[], targetId: number, ancestors: string[] = []): string[] | null {
  for (const node of nodes) {
    const path = [...ancestors, node.sectorName]
    if (node.sectorId === targetId) return path
    const found = findSectorPath(node.children, targetId, path)
    if (found) return found
  }
  return null
}

function topPickAverage(node: FilteredMarketMapSectorNode, metric: DepthMetric): number | null {
  // 강세 업종은 업종 탭 표시 지표를 따른다. 평균이 아닌 지표를 고르면 시총 가중으로 계산한다.
  return metric === 'simpleAvgChangeRate' ? node.simpleAvgChangeRate : node.weightedAvgChangeRate
}

// "설정" 사이드바(SettingsSidebar) + 색상 구간 편집 패널이 필요로 하는 상태/로직 전부를
// 여기 한 곳에 모아둔다 — 세션스토리지 키를 그대로 공유해서 어느 페이지에서 열어도 같은 값을 보고
// 편집한다(지도/섹터 페이지뿐 아니라 아직 이 옵션이 실제로 영향 안 주는 페이지에서 열어도 동일).
// 페이지별로 서로 다른 옵션을 보여줘야 할 필요가 생기면 그때 이 훅을 쪼개면 된다.
//
// needsTree: 이 페이지가 실제로 트리 데이터(useMarketMap)를 화면에 그리는 데 쓰는지. 지도/섹터처럼
// 트리를 직접 렌더링하는 페이지는 true(기본값)로 항상 조회하고, 어드민/요약처럼 설정 사이드바를 통해서만
// 간접적으로 필요한 페이지는 false를 넘겨서 사이드바를 열기 전까지 조회 자체를 미룬다 — 그래도 설정을
// 열면 그 순간부터는 조회하므로(그리고 지도/섹터를 먼저 봤다면 react-query 캐시로 즉시 뜨므로) 설정
// 내용 자체는 어느 페이지에서 열든 동일하게 보인다.
export function useGlobalSettings(options?: { needsTree?: boolean }) {
  const needsTree = options?.needsTree ?? true
  const { pathname } = useLocation()
  const isLoggedIn = useIsLoggedIn()
  // 설정 기본값은 utils/settingDefaults.ts에 모아 두었다(비로그인과 회원이 다르다). 사용자가 값을 바꾸면 저장값이 우선한다.
  const defaults = settingDefaultsFor(isLoggedIn)
  const { requireLogin } = useLoginGate()
  // 트리 조회 마켓은 경로를 따른다 — /map, /sector 둘 다 경로 세그먼트가 곧 마켓이라 여기서 바로
  // 우선순위(쿼리 > 경로 > 저장값 > 기본값)를 적용하면, 이 훅을 그대로 쓰는 지도 페이지는 물론
  // 트리 조회만 공유하는 섹터 페이지도 같은 마켓으로 트리를 받는다(docs/instructions-route-market-first-render.md 결정 2).
  const [market] = useRouteAwareMarket('marketMap.market', 'ALL_STOCK')
  // 저장값은 로그인 사용자에 한해 서버(user_preference)에 남는다. 이 값은 분류 체계를 고르며,
  // 비로그인은 저장값이 true여도 거래소 분류(false)로 고정한다 — MARKETRY 분류는 로그인이 필요하다.
  const [storedIsCustom, setStoredIsCustom] = usePageSetting('marketMap.isCustom', defaults.isCustom)
  const isCustom = isLoggedIn ? storedIsCustom : false
  // NXT 종목만 보기 — 거래소 분류에서는 NXT 히트맵 선택이 이 값을 켜고, MARKETRY(내 분류)에서는 설정의 "NXT 종목만 보기"
  // 스위치로 켠다. 두 경우 모두 분류는 그대로 두고 NXT 거래 종목만 남긴다.
  const [storedNxtOnly, setStoredNxtOnly] = usePageSetting('marketMap.nxtOnly', false)
  const nxtOnly = storedNxtOnly
  const heatmap: HeatmapKey = isCustom ? 'marketry' : nxtOnly ? 'nxt' : 'krx'
  // 섹터 랭킹/강세 업종 계산에 쓰는 평균 방식은 박스 크기 비율과 별도로 저장한다.
  const [avgChangeRateUseSimple, setAvgChangeRateUseSimple] = usePageSetting('marketMap.avgChangeRateUseSimple', defaults.avgChangeRateUseSimple)
  // 0은 동일 크기, 100은 시가총액 비례이며 중간값은 시가총액 차이를 거듭제곱으로 압축한다.
  const [storedBoxSizeMarketCapRatio, setBoxSizeMarketCapRatio] = usePageSetting('marketMap.boxSizeMarketCapRatio', defaults.boxSizeMarketCapRatio)
  const [storedStrongIndustryColor, setStrongIndustryColor] = usePageSetting(
    'marketMap.strongIndustryColor',
    defaults.strongIndustryColor,
  )
  const isLegacyStrongIndustryColor = storedStrongIndustryColor.toLowerCase() === LEGACY_STRONG_INDUSTRY_COLOR
  const strongIndustryColor = isLegacyStrongIndustryColor
    ? DEFAULT_STRONG_INDUSTRY_COLOR
    : storedStrongIndustryColor

  // 캡처 렌더러와 로그인 사용자 설정은 저장된 색을 사용한다. 예전 기본 금색 값이 남아 있으면
  // 첫 화면부터 청록색으로 표시하고, sessionStorage 또는 서버 설정에도 새 값을 저장한다.
  useEffect(() => {
    if (isLegacyStrongIndustryColor) setStrongIndustryColor(DEFAULT_STRONG_INDUSTRY_COLOR)
  }, [isLegacyStrongIndustryColor, setStrongIndustryColor])
  const boxSizeMarketCapRatio = Math.max(0, Math.min(100, Math.round(storedBoxSizeMarketCapRatio)))
  const [storedDepthMetric, setStoredDepthMetric] = usePageSetting<StoredDepthMetric>(
    'marketMap.activeDepthMetric',
    defaults.depthMetric,
  )
  const selectedDepthMetric = resolveDepthMetric(storedDepthMetric)
  const [depthMetricEnabled, setDepthMetricEnabled] = usePageSetting(
    'marketMap.depthMetricEnabled',
    storedDepthMetric !== null,
  )
  // 분류별 데이터 깊이에 맞춰 화면에 적용하되, 사용자가 고른 범위는 전환해도 보존한다.
  // 기본값: 대분류~중분류(index 0~1) — 렌더러가 캡처하는 기본 화면에 등락률이 보이도록.
  const [depthMetricMinIndex, setDepthMetricMinIndex] = usePageSetting('marketMap.depthMetricMinIndex', defaults.depthMetricMinIndex)
  const [depthMetricMaxIndex, setDepthMetricMaxIndex] = usePageSetting('marketMap.depthMetricMaxIndex', defaults.depthMetricMaxIndex)
  // avgChangeRateUseSimple은 섹터 랭킹에 사용한다. 강세 업종은 업종 탭 표시 지표를 따른다.
  // 종목 박스가 전체 트리맵 넓이에서 이 비중(%) 미만이면 종목명/등락률을 표시하지 않는다(섹터 헤더와는 무관).
  const [boxLabelMinAreaPercent, setBoxLabelMinAreaPercent] = usePageSetting('marketMap.boxLabelMinAreaPercent', defaults.boxLabelMinAreaPercent)
  // 종목 박스에 이름만/등락률만/둘 다/끄기 중 뭘 보여줄지 — 기본은 둘 다(기존 동작 유지, 배열 앞에
  // "끄기"가 추가되면서 both의 인덱스가 2에서 3으로 밀림).
  const [stockLabelModeIndex, setStockLabelModeIndex] = usePageSetting('marketMap.stockLabelModeIndex', defaults.stockLabelModeIndex)
  // 기존 저장값 0(끄기)도 유지하며, 켜고 끄는 동안 선택한 표기 방식은 보존한다.
  const [stockLabelEnabled, setStockLabelEnabled] = usePageSetting('marketMap.stockLabelEnabled', stockLabelModeIndex !== 0)
  const selectedStockLabelModeIndex = stockLabelModeIndex || 3
  const stockLabelMode = stockLabelEnabled ? STOCK_LABEL_MODES[selectedStockLabelModeIndex] : 'off'
  // 지도 페이지에 표시되는 모든 등락률(%)의 소수점 자릿수 — 인덱스가 그대로 자릿수(0=정수, 1=소수
  // 1자리, 2=소수 2자리). 기본값 1(소수 1자리).
  const [decimalPlacesIndex, setDecimalPlacesIndex] = usePageSetting('marketMap.decimalPlacesIndex', defaults.decimalPlacesIndex)
  // 종목 박스 설명 팝업을 여는 방식 — false=우클릭(기존 동작), true=커서를 박스 위로 옮길 때. 섹터(대/중/소분류)
  // 팝업은 이 설정과 무관하게 항상 우클릭이다.
  const [stockPopupOnHover, setStockPopupOnHover] = usePageSetting('marketMap.stockPopupOnHover', defaults.stockPopupOnHover)
  const decimalPlaces = decimalPlacesIndex
  // 시가총액 구간 범위 필터 — 마켓맵/섹터 랭킹 화면이 세션스토리지 키를 공유한다(useMarketValueTierRange 참고).
  // 시가총액 구간 필터는 분류 체계와 무관한 표시 설정이라 두 분류 모두에서 적용한다.
  const {
    tiers: valueTiers,
    minIndex: tierRangeMinIndex,
    maxIndex: tierRangeMaxIndex,
    setMinIndex: setTierRangeMinIndex,
    setMaxIndex: setTierRangeMaxIndex,
    excludedMarketValueTiers,
    isTierRangeReady: isMarketValueTierRangeReady,
  } = useMarketValueTierRange(true)
  const [excludedSectorNames, setExcludedSectorNames] = usePersistedState<Map<number, string>>(
    'marketMap.excludedSectorNames',
    new Map(),
    {
      serialize: map => [...map.entries()],
      deserialize: raw => new Map(raw as [number, string][]),
    },
  )
  // 섹터 제외를 목록별로 켜고 끄는 게 아니라, 제외 적용 자체를 통째로 켜고 끄는 마스터 스위치.
  const [sectorFilterEnabled, setSectorFilterEnabled] = usePageSetting('marketMap.sectorFilterEnabled', defaults.sectorFilterEnabled)
  const [stockChangeFilter, setStockChangeFilter] = usePageSetting<StockChangeFilter>('marketMap.stockChangeFilter', defaults.stockChangeFilter)
  const [sectorChangeFilter, setSectorChangeFilter] = usePageSetting<SectorChangeFilter>('marketMap.sectorChangeFilter', defaults.sectorChangeFilter)
  const [sectorChangeDepth, setSectorChangeDepth] = usePageSetting('marketMap.sectorChangeDepth', defaults.sectorChangeDepth)
  // null = 제한 없음(전체 뎁스 표시). 슬라이더의 실제 상한(availableMaxDepth)은 트리 계산 후에 나온다.
  // 기본값 2(렌더러 캡처 기준 화면에 맞춤).
  const [selectedMaxDepth, setMaxDepth] = usePageSetting<number | null>('marketMap.selectedMaxDepth', defaults.maxDepth)
  const [sectorLevelEnabled, setSectorLevelEnabled] = usePageSetting('marketMap.sectorLevelEnabled', defaults.sectorLevelEnabled)
  const maxDepth = sectorLevelEnabled ? selectedMaxDepth : 0
  // 선호 업종 — 선택한 절대 depth에서 등락률 상위 N개 섹터를 지도 전체에 강조한다.
  const [topPickDepth, setTopPickDepth] = usePageSetting('marketMap.topPickDepth', defaults.topPickDepth)
  const [topPickCount, setTopPickCount] = usePageSetting('marketMap.topPickCount', defaults.topPickCount)
  const [topPickEnabled, setTopPickEnabled] = usePageSetting('marketMap.topPickEnabled', topPickCount !== 0)
  const selectedTopPickCount = topPickCount || 2
  // 핀 — 켜 두면(기본) 설정창을 지도 옆에 고정해서(지도를 밀어냄) 계속 열어 두고, 끄면 지도 위에 띄워서 밖을 누를 때 닫는다.
  // 로그인 사용자는 핀 선택을 이 브라우저에 기억하고, 페이지에 들어올 때 설정창을 열지 닫을지도 이 값을 따른다(고정=열림, 해제=닫힘).
  // 비로그인 사용자는 기억하지 않는다 — 항상 "열림 + 핀 켜짐"으로 시작하고, 핀을 꺼도 이번 화면에서만 적용된다.
  const { isLoading: isSessionLoading } = useSession()
  const [storedSettingsPinned, setStoredSettingsPinned] = useLocalPersistedState('settings.sidebarPinned', MEMBER_DEFAULTS.sidebarPinned)
  const [guestSettingsPinned, setGuestSettingsPinned] = useState(GUEST_DEFAULTS.sidebarPinned)
  const isSettingsPinned = isLoggedIn ? storedSettingsPinned : guestSettingsPinned
  const [isSettingsOpen, setIsSettingsOpen] = useState(isSettingsPinned)
  const previousPathnameRef = useRef(pathname)
  const isSettingsPinnedRef = useRef(isSettingsPinned)
  useEffect(() => {
    isSettingsPinnedRef.current = isSettingsPinned
  })

  // 세션 조회가 끝나기 전에는 비로그인으로 보여서 일단 열린 채로 시작한다. 조회가 끝나 로그인 사용자로 확인되면
  // 그때 한 번 저장된 핀 선택(해제였다면 닫힘)을 반영한다.
  const sessionSettledRef = useRef(!isSessionLoading)
  useEffect(() => {
    if (sessionSettledRef.current || isSessionLoading) return
    sessionSettledRef.current = true
    setIsSettingsOpen(isSettingsPinnedRef.current)
  }, [isSessionLoading])

  useEffect(() => {
    if (previousPathnameRef.current === pathname) return
    previousPathnameRef.current = pathname
    setIsSettingsOpen(isSettingsPinnedRef.current)
  }, [pathname])

  // 핀이 꺼져(떠 있는 상태) 있을 때 설정창 밖을 누르면 닫는다. 위쪽 설정 버튼은 제외한다 — 그 버튼 자체가 열고 닫는 토글이라서
  // 포함하면 닫혔다가 바로 다시 열린다. pointerdown을 캡처 단계에서 받아 지도 박스 등이 이벤트를 막아도 닫힌다.
  useEffect(() => {
    if (!isSettingsOpen || isSettingsPinned) return
    const closeOnOutsidePress = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('[data-settings-sidebar], [data-settings-toggle]')) return
      setIsSettingsOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePress, true)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePress, true)
  }, [isSettingsOpen, isSettingsPinned])
  // 새로 받아온 (market, isCustom) 조합의 데이터가 처음 도착했을 때만 서버 isExcluded로 시드하고,
  // 그 뒤 60초 백그라운드 재조회가 로컬에서 방금 토글한 상태를 덮어쓰지 않게 한다(fire-and-forget 저장이라
  // 서버 반영 전에 재조회가 먼저 도착할 수 있음).
  const seededKeyRef = useRef<string | null>(null)

  const {
    data,
    isLoading,
    isError,
    isSuccess: isMarketMapSuccess,
    isRefetching: isRefetchingMarketMap,
    refetch: refetchMarketMap,
  } = useMarketMap(market, isCustom, nxtOnly, {
    enabled: needsTree,
  })
  const rawRootNodes = data?.items
  // 비로그인의 거래소 분류는 업종 id가 모두 0이라, 제외 기능이 동작하도록 이름 기반 고유 id를 붙인다.
  const rootNodes = useMemo(
    () => (isLoggedIn ? (rawRootNodes ?? []) : withStableSectorIds(rawRootNodes ?? [])),
    [isLoggedIn, rawRootNodes],
  )

  useEffect(() => {
    if (!data) return
    // 비로그인의 제외 목록은 서버 값이 아니라 이 탭에서 직접 고른 것이라 서버 값으로 다시 채우지 않는다.
    if (!isLoggedIn) return
    const key = `${market}:${isCustom}:${nxtOnly}`
    if (seededKeyRef.current === key) return
    seededKeyRef.current = key
    setExcludedSectorNames(seedExcludedSectorNames(data.items, []))
  }, [data, market, isCustom, nxtOnly, isLoggedIn, setExcludedSectorNames])

  // 로그인 사용자의 거래소 분류 트리는 사용자 정의 섹터를 쓰지 않으므로 isExcluded와 제외 목록을 적용하지 않는다.
  // 비로그인은 거래소 분류만 쓰지만 직접 고른 제외 목록을 이 탭에서 적용한다(새로고침하면 초기화).
  const excludedSectorIds = useMemo(
    () => (isCustom || !isLoggedIn) && sectorFilterEnabled ? new Set(excludedSectorNames.keys()) : new Set<number>(),
    [isCustom, isLoggedIn, sectorFilterEnabled, excludedSectorNames],
  )

  const directionFilters = useMemo(() => ({
    stockChangeFilter: pathname.startsWith('/map/') ? stockChangeFilter : 'all' as StockChangeFilter,
    sectorChangeFilter: pathname.startsWith('/map/') ? sectorChangeFilter : 'all' as SectorChangeFilter,
    sectorChangeDepth,
    sectorUseSimpleAverage: selectedDepthMetric === 'simpleAvgChangeRate',
  }), [pathname, stockChangeFilter, sectorChangeFilter, sectorChangeDepth, selectedDepthMetric])

  const { filteredRootNodes, availableMaxDepth } = useFilteredMarketMapTree(
    rootNodes,
    excludedSectorIds,
    excludedMarketValueTiers,
    directionFilters,
  )

  // KRX 트리는 대분류까지만 있을 수 있으므로, 선택 범위 중 실제 존재하는 단계만 표시한다.
  // MARKETRY는 기존처럼 선택 범위의 끝이 트리보다 깊으면 지표를 표시하지 않는다.
  const depthMetricClampedMinIndex = Math.min(depthMetricMinIndex, depthMetricMaxIndex)
  const depthMetricClampedMaxIndex = depthMetricMaxIndex
  const visibleDepthMetricMaxIndex = isCustom
    ? depthMetricClampedMaxIndex
    : Math.min(depthMetricClampedMaxIndex, availableMaxDepth - 1)
  const isDepthMetricRangeValid = isCustom
    ? depthMetricClampedMaxIndex < availableMaxDepth
    : depthMetricClampedMinIndex < availableMaxDepth

  const activeDepthRange: [number, number] | null =
    depthMetricEnabled && isDepthMetricRangeValid
      ? [depthMetricClampedMinIndex, visibleDepthMetricMaxIndex]
      : null

  const weightedAvgDepthRange = selectedDepthMetric === 'weightedAvgChangeRate' ? activeDepthRange : null
  const simpleAvgDepthRange = selectedDepthMetric === 'simpleAvgChangeRate' ? activeDepthRange : null
  const upDownCountDepthRange = selectedDepthMetric === 'upDownCount' ? activeDepthRange : null
  const marketValueDepthRange = selectedDepthMetric === 'marketValue' ? activeDepthRange : null

  // 선호 업종 라디오의 활성 상한은 업종 단계 설정을 따른다. 대/중/소분류 설정은 데이터가 얕아도
  // 미리 선택할 수 있게 두고, 현재 데이터에 해당 섹터가 없으면 강조 대상만 빈 Set으로 둔다.
  const topPickMaxSelectableDepth = maxDepth === null ? Math.max(3, availableMaxDepth) : maxDepth
  const topPickSectorKeys = useMemo(() => {
    if (!topPickEnabled || topPickDepth < 0 || topPickDepth >= topPickMaxSelectableDepth) {
      return new Set<string>()
    }

    const candidates = collectSectorsAtDepth(filteredRootNodes, topPickDepth)
      .map((node, index) => ({ node, index, average: topPickAverage(node, selectedDepthMetric) }))
      .filter((candidate): candidate is { node: FilteredMarketMapSectorNode; index: number; average: number } => {
        return candidate.average !== null
      })
      .sort((a, b) => b.average - a.average || b.node.totalMarketValue - a.node.totalMarketValue || a.index - b.index)

    // KRX 업종은 모두 sectorId=0이므로 이름까지 포함해 구별한다.
    return new Set(candidates.slice(0, selectedTopPickCount).map(candidate =>
      JSON.stringify([candidate.node.sectorId, candidate.node.sectorName]),
    ))
  }, [
    selectedDepthMetric,
    filteredRootNodes,
    topPickEnabled,
    selectedTopPickCount,
    topPickDepth,
    topPickMaxSelectableDepth,
  ])

  // 등락률 컬러 스케일 draft — 서버 값(useMarketMapColorScale)이 도착하면 딱 한 번만 시드하고,
  // 이후로는 어드민이 설정 팝업에서 편집하는 draft를 그대로 트리맵/범례에 흘려보낸다. 그래서 "저장"
  // 전에도 실제로 보여주는 지도 색이 곧바로 바뀐다 — 별도의 미리보기 트리맵이 필요 없다.
  const [colorEditIndices, setColorEditIndices] = useState<number[]>([])
  // 세션 시작 시점의 draft 스냅샷 — 취소 복구와 편집 전 비어 있던 부호의 fallback 표시를 위해 보관한다.
  const colorEditSnapshotRef = useRef<ColorScaleConfig | null>(null)
  const { data: colorScaleServerData, refetch: refetchColorScale } = useMarketMapColorScale()
  const [colorScaleDraft, setColorScaleDraft] = useState<ColorScaleConfig | null>(null)
  // 비로그인은 서버에 저장할 수 없으므로, 이 탭에서 바꾼 색상 설정은 세션(sessionStorage)에만 남긴다 — 다른
  // 화면 설정(usePageSetting의 비로그인 동작)과 같다. 로그인 사용자는 서버 저장이라 이 값을 쓰지 않는다.
  const [localColorScale, setLocalColorScale] = usePersistedState<ColorScaleConfig | null>('marketMap.localColorScale', null)
  // draft가 어느 로그인 상태의 값으로 시드됐는지 — 로그인/로그아웃으로 바뀌면 새 서버 값으로 다시 시드한다.
  const [colorScaleDraftOwner, setColorScaleDraftOwner] = useState<boolean | null>(null)
  const [colorEditError, setColorEditError] = useState<string | null>(null)
  // 편집 대상이 바뀔 때마다 올려서 편집 영역의 입력칸/슬라이더 로컬 상태를 새로 시작하게 한다.
  const [colorEditSessionKey, setColorEditSessionKey] = useState(0)
  // 편집 영역이 항상 열려 있으므로, 적용/취소 뒤에 같은 칸을 다시 편집 대상으로 잡기 위해 기억해 둔다.
  const selectedColorPercentRef = useRef<number | null>(null)
  // 편집을 시작할 때의 값 — 지금 값과 다르면 "적용하지 않은 수정"이 있는 것이라 적용/취소 버튼을 보여준다.
  const [colorEditOriginal, setColorEditOriginal] = useState<{ thresholdPercent: number; color: string } | null>(null)
  if (colorScaleServerData && (colorScaleDraft === null || colorScaleDraftOwner !== isLoggedIn)) {
    setColorScaleDraftOwner(isLoggedIn)
    // 이전 계정에서 열려 있던 편집 세션은 인덱스가 의미를 잃으므로 함께 닫는다.
    setColorEditIndices([])
    setColorEditError(null)
    colorEditSnapshotRef.current = null
    // 방어적 복사 — react-query 캐시가 들고 있는 참조를 그대로 draft로 물고 있지 않도록.
    const seededThresholds = (!isLoggedIn && localColorScale ? localColorScale : colorScaleServerData).thresholds.map(threshold => ({ ...threshold }))
    // 저장된 구간이 하나도 없으면(비로그인 첫 접속, 초기화 직후) 기본 7칸을 실제 구간으로 채워서 시작한다.
    setColorScaleDraft(seededThresholds.length > 0 ? { thresholds: seededThresholds } : createDefaultColorScale())
  }
  // "색상 커스텀 사용" 토글 — 순수 로컬(세션스토리지) 상태. draft(=저장 대상)와는 완전히 분리돼 있어서
  // 꺼도 draft에 저장해둔 값은 건드리지 않고, 그냥 실제 지도에 넘기는 값만 빈 스케일(=기본 프리셋)로 바꿔치기한다.
  const [colorCustomOn, setColorCustomOn] = usePageSetting('marketMap.colorCustomOn', defaults.colorCustomOn)
  // 같은 부호/퍼센트에 편집 중인 행이 이미 있는 임계값과 겹치면 편집 중인 값을 우선한다.
  // resolver는 같은 thresholdPercent 중 마지막 값을 유효점으로 삼으므로, 저장 draft의 배열 순서를
  // 바꾸지 않고 렌더링 입력에서만 편집 행을 뒤로 보낸다.
  const editingColorIndexSet = new Set(colorEditIndices)
  const colorScaleDraftForRendering = colorScaleDraft
    ? {
        thresholds: [
          ...colorScaleDraft.thresholds.filter((_, index) => !editingColorIndexSet.has(index)),
          ...colorEditIndices.map(index => colorScaleDraft.thresholds[index]).filter((threshold): threshold is ColorScaleThreshold => threshold !== undefined),
        ],
      }
    : EMPTY_COLOR_SCALE
  const colorScale = colorCustomOn ? colorScaleDraftForRendering : EMPTY_COLOR_SCALE
  const legendSwatches = resolveLegendSwatches(colorScale, {
    // 편집을 시작하기 전부터 비어 있던 부호는 기본 2/5/8 슬롯을 유지한다. 이번 편집으로 처음
    // 비어진 부호만 숨겨 fallback 슬롯이 새로 늘어나는 것을 막는다.
    // 색상 범위 커스텀을 끈 동안에는 지도가 기본 색을 쓰므로 범례도 기본 7칸을 모두 보여준다(흐리게 표시) — 이때는 숨기지 않는다.
    includeFallbacksForEmptySides: !colorCustomOn || colorEditIndices.length === 0 || !colorEditSnapshotRef.current
      ? true
      : {
          negative: !colorEditSnapshotRef.current.thresholds.some(threshold => threshold.thresholdPercent < 0),
          positive: !colorEditSnapshotRef.current.thresholds.some(threshold => threshold.thresholdPercent > 0),
        },
  })

  // 설정 사이드바에서 편집 중인 threshold들 — colorScaleDraft.thresholds의 인덱스 목록.
  // edit 모드는 항상 원소 1개, add 모드는 "+"로 여러 개가 될 수 있다. 빈 배열이면 세션 없음.
  const createThresholdMutation = useCreateMarketMapScaleThreshold()
  const updateThresholdMutation = useUpdateMarketMapScaleThreshold()
  const deleteThresholdMutation = useDeleteMarketMapScaleThreshold()
  // "적용"이 세션 안의 여러 행을 순회하며 create/update를 여러 번 호출하는 비동기 작업이라,
  // 개별 뮤테이션 훅의 isPending 하나만으로는 전체 진행 상태를 못 나타내서 별도로 든다.
  const [isApplyingColorEdit, setIsApplyingColorEdit] = useState(false)

  // 범례 칸을 눌러 그 구간을 편집한다 — 편집 영역은 항상 열려 있고, 칸을 누르면 편집 대상만 바뀐다.
  // 적용하지 않은 이전 칸의 수정은 되돌린다. 저장된 색이 없는 기본 칸은 그 칸의 기본 값으로
  // 구간을 만들어 편집한다(범례 칸 수는 고정이라 새 칸을 만드는 기능은 없다).
  const handleSelectColorSwatch = (percent: number, color: string) => {
    if (!colorScaleDraft || isApplyingColorEdit) return
    const base = colorEditSnapshotRef.current ?? colorScaleDraft
    colorEditSnapshotRef.current = base
    selectedColorPercentRef.current = percent
    setColorEditError(null)
    setColorEditSessionKey(key => key + 1)
    const existingIndex = base.thresholds.findIndex(threshold => threshold.thresholdPercent === percent)
    if (existingIndex >= 0) {
      const existing = base.thresholds[existingIndex]
      setColorEditOriginal({ thresholdPercent: existing.thresholdPercent, color: existing.color })
      setColorScaleDraft(base)
      setColorEditIndices([existingIndex])
      return
    }
    setColorEditOriginal({ thresholdPercent: percent, color })
    const nextThresholds = [...base.thresholds, { thresholdPercent: percent, color, colorLabel: null }]
    setColorScaleDraft({ ...base, thresholds: nextThresholds })
    setColorEditIndices([nextThresholds.length - 1])
  }
  const handleChangeColorEditThreshold = (rowIndex: number, percent: number) => {
    const targetIndex = colorEditIndices[rowIndex]
    if (targetIndex === undefined) return
    setColorEditError(null)
    selectedColorPercentRef.current = percent
    // 같은 임계값을 다시 지정하는 건 그 threshold를 갱신(update)하는 것으로 취급 — "적용" 시점에 정리한다.
    setColorScaleDraft(prev =>
      prev
        ? { ...prev, thresholds: prev.thresholds.map((t, i) => (i === targetIndex ? { ...t, thresholdPercent: percent } : t)) }
        : prev,
    )
  }
  const handleChangeColorEditColor = (rowIndex: number, color: string, colorLabel: string | null) => {
    const targetIndex = colorEditIndices[rowIndex]
    if (targetIndex === undefined) return
    setColorEditError(null)
    setColorScaleDraft(prev =>
      prev ? { ...prev, thresholds: prev.thresholds.map((t, i) => (i === targetIndex ? { ...t, color, colorLabel } : t)) } : prev,
    )
  }
  const handleApplyColorEdit = async () => {
    if (!colorScaleDraft || colorEditIndices.length === 0) {
      colorEditSnapshotRef.current = null
      setColorEditIndices([])
      return
    }
    setColorEditError(null)
    setIsApplyingColorEdit(true)
    try {
      // 같은 signed percentage가 편집 행과 나머지 draft에 모두 있으면, 사용자가 방금 편집한 값을
      // 남기고 기존 행은 제거한다. 그 외에도 이미 중복된 draft 값은 한 지점으로 정리한다.
      const sessionIndexSet = new Set(colorEditIndices)
      const candidatesByThreshold = new Map<number, { entry: ColorScaleThreshold; edited: boolean }[]>()
      colorScaleDraft.thresholds.forEach((entry, index) => {
        const candidates = candidatesByThreshold.get(entry.thresholdPercent) ?? []
        candidates.push({ entry, edited: sessionIndexSet.has(index) })
        candidatesByThreshold.set(entry.thresholdPercent, candidates)
      })

      const resolvedGroups = Array.from(candidatesByThreshold, ([thresholdPercent, candidates]) => {
        const editedCandidates = candidates.filter(candidate => candidate.edited)
        const winner = editedCandidates.at(-1) ?? candidates.at(-1)!
        // 새 draft 행이 기존 값과 겹치면 기존 id를 재사용해 update한다. 사용자가 수정한 기존 행의
        // id가 있으면 그 id를 유지하고, 겹친 나머지 id는 삭제 대상으로 모은다.
        const savedId = winner.entry.id ?? candidates.find(candidate => candidate.entry.id !== undefined)?.entry.id
        const losingIds = candidates
          .map(candidate => candidate.entry.id)
          .filter((id): id is number => id !== undefined && id !== savedId)
        return {
          entry: { ...winner.entry, id: savedId },
          edited: editedCandidates.length > 0,
          thresholdPercent,
          losingIds,
        }
      })
      const idsToDelete = Array.from(new Set(resolvedGroups.flatMap(group => group.losingIds)))
      const entriesToSave = resolvedGroups.filter(group => group.edited).map(group => group.entry)

      // 비로그인은 서버에 저장하지 않는다 — 정리된 결과를 화면 설정과 이 탭의 세션에만 반영한다.
      if (!isLoggedIn) {
        const nextDraft = { thresholds: resolvedGroups.map(group => group.entry) }
        setColorScaleDraft(nextDraft)
        setLocalColorScale(nextDraft)
        colorEditSnapshotRef.current = null
        setColorEditIndices([])
        return
      }

      // 같은 thresholdPercent는 백엔드에서 중복 불가이므로, 충돌 행 삭제를 완료한 다음에 저장한다.
      await Promise.all(idsToDelete.map(id => deleteThresholdMutation.mutateAsync(id)))
      const savedEntries = await Promise.all(
        entriesToSave.map(entry => {
          const payload = { thresholdPercent: entry.thresholdPercent, color: entry.color, colorLabel: entry.colorLabel }
          return entry.id !== undefined
            ? updateThresholdMutation.mutateAsync({ id: entry.id, payload })
            : createThresholdMutation.mutateAsync(payload)
        }),
      )

      const savedByThreshold = new Map(savedEntries.map(entry => [entry.thresholdPercent, entry]))
      setColorScaleDraft({
        thresholds: resolvedGroups.map(group => group.edited ? savedByThreshold.get(group.thresholdPercent)! : group.entry),
      })
      colorEditSnapshotRef.current = null
      setColorEditIndices([])
    } catch {
      // 저장이 실패하면 편집 세션을 닫지 않는다 — 입력한 값을 그대로 둔 채 다시 시도하거나 취소할 수 있다.
      setColorEditError('색상을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsApplyingColorEdit(false)
    }
  }
  const handleCancelColorEdit = () => {
    const hadSaveError = colorEditError !== null
    if (colorEditSnapshotRef.current) setColorScaleDraft(colorEditSnapshotRef.current)
    colorEditSnapshotRef.current = null
    setColorEditError(null)
    setColorEditIndices([])
    // 저장 실패 뒤에는 서버에 일부만 반영됐을 수 있어서, 취소할 때 서버 값으로 다시 맞춘다.
    if (hadSaveError && isLoggedIn) {
      void refetchColorScale().then(result => {
        if (!result.data) return
        colorEditSnapshotRef.current = null
        setColorEditIndices([])
        setColorScaleDraft({ thresholds: result.data.thresholds.map(threshold => ({ ...threshold })) })
      })
    }
  }
  const colorEditThresholds = colorScaleDraft
    ? colorEditIndices.map(i => colorScaleDraft.thresholds[i]).filter((t): t is ColorScaleThreshold => t !== undefined)
    : []
  // 편집 영역을 항상 열어두기 위해, 편집 중인 칸이 없으면(처음, 적용/취소 직후) 마지막으로 보던 칸을 다시 연다.
  useEffect(() => {
    if (!colorCustomOn || !colorScaleDraft || colorEditIndices.length > 0 || isApplyingColorEdit) return
    // 처음에는 +8%(가장 큰 상승 칸)를 편집 대상으로 연다.
    const swatch = legendSwatches.find(item => Number.parseFloat(item.label) === selectedColorPercentRef.current)
      ?? legendSwatches.find(item => item.label === '+8%')
      ?? legendSwatches[0]
    if (swatch) handleSelectColorSwatch(Number.parseFloat(swatch.label), swatch.color)
  })
  // 저장해 둔 색상 구간을 모두 지워 기본 색상으로 되돌린다. 로그인 사용자는 서버에 저장된 구간도 삭제한다.
  const handleResetColorScale = async () => {
    if (!colorScaleDraft || isApplyingColorEdit) return
    setIsApplyingColorEdit(true)
    setColorEditError(null)
    try {
      const idsToDelete = (colorEditSnapshotRef.current ?? colorScaleDraft).thresholds
        .map(threshold => threshold.id)
        .filter((id): id is number => id !== undefined)
      if (isLoggedIn) await Promise.all(idsToDelete.map(id => deleteThresholdMutation.mutateAsync(id)))
      setColorScaleDraft(createDefaultColorScale())
      // 비로그인의 저장값은 비워 둔다 — 다음 접속 때 같은 기본 7칸으로 다시 채워진다.
      if (!isLoggedIn) setLocalColorScale({ thresholds: [] })
      colorEditSnapshotRef.current = null
      setColorEditIndices([])
    } catch {
      setColorEditError('색상을 초기화하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsApplyingColorEdit(false)
    }
  }
  // 커스텀을 끄면 편집 영역도 닫는다 — 적용하지 않은 수정은 되돌린다.
  // 끄더라도 편집 중인 작업은 취소하지 않는다 — 편집 영역이 흐려진 채로 남았다가 다시 켜면 이어서 할 수 있다.
  const handleChangeColorCustomOn = (on: boolean) => {
    setColorCustomOn(on)
  }

  // 비로그인이 MARKETRY 분류를 선택하려 하면 로그인 팝업을 띄운다 — 로그인 성공 후 지금 페이지로
  // 돌아온다(가입/로그인 전환 지시서 4). 이미 로그인 상태면 저장한 분류 선택을 토글한다.
  const handleToggleCustom = () => {
    if (!isLoggedIn) {
      requireLogin(pathname)
      return
    }
    setStoredIsCustom(prev => !prev)
  }

  const handleToggleNxtOnly = () => setStoredNxtOnly(prev => !prev)

  // 히트맵 선택(KRX / NXT / MARKETRY). MARKETRY는 로그인이 필요하고, KRX와 NXT는 거래소 분류를 같이 쓰며 NXT만 종목을 거른다.
  const handleSelectHeatmap = (next: HeatmapKey) => {
    if (next === 'marketry' && !isLoggedIn) {
      requireLogin(pathname)
      return
    }
    setStoredIsCustom(next === 'marketry')
    setStoredNxtOnly(next === 'nxt')
  }

  const handleChangeActiveDepthMetric = (metric: DepthMetric) => setStoredDepthMetric(metric)

  const handleToggleDepthMetric = () => setDepthMetricEnabled(prev => !prev)

  const handleChangeMaxDepth = (nextMaxDepth: number) => {
    setMaxDepth(nextMaxDepth)
    // 지표 범위는 그대로 보존한다. 표시 가능한 상한을 넘는 부분은 설정 UI에서만 잠시 비활성화하고,
    // 업종 단계을 다시 높이면 원래 선택 범위가 그대로 돌아온다.
  }

  const handleChangeDepthMetricRange = (min: number, max: number) => {
    setDepthMetricMinIndex(min)
    setDepthMetricMaxIndex(max)
  }

  const handleExcludeSector = (sectorId: number, sectorName: string) => {
    const path = findSectorPath(rootNodes, sectorId)
    setExcludedSectorNames(prev => new Map(prev).set(sectorId, path ? path.join(' > ') : sectorName))
    // 서버에는 로그인 사용자만 저장한다. 비로그인은 이 탭에만 남는다.
    if (isLoggedIn) registerExcludedSector(sectorId).catch(e => console.error('섹터 제외 실패', e))
  }

  const handleRemoveExcludedSector = (sectorId: number) => {
    setExcludedSectorNames(prev => {
      const next = new Map(prev)
      next.delete(sectorId)
      return next
    })
    if (isLoggedIn) unregisterExcludedSector(sectorId).catch(e => console.error('섹터 제외 해제 실패', e))
  }

  const settingsModalProps = {
    isCustom,
    onToggleCustom: handleToggleCustom,
    heatmap,
    onSelectHeatmap: handleSelectHeatmap,
    nxtOnly,
    onToggleNxtOnly: handleToggleNxtOnly,
    maxDepth: selectedMaxDepth,
    sectorLevelEnabled,
    onToggleSectorLevel: () => setSectorLevelEnabled(prev => !prev),
    availableMaxDepth,
    onChangeMaxDepth: handleChangeMaxDepth,
    activeDepthMetric: selectedDepthMetric,
    onChangeActiveDepthMetric: handleChangeActiveDepthMetric,
    depthMetricEnabled,
    onToggleDepthMetric: handleToggleDepthMetric,
    depthMetricMinIndex: depthMetricClampedMinIndex,
    depthMetricMaxIndex: depthMetricClampedMaxIndex,
    onChangeDepthMetricRange: handleChangeDepthMetricRange,
    topPickDepth,
    topPickCount: selectedTopPickCount,
    topPickEnabled,
    onToggleTopPick: () => setTopPickEnabled(prev => !prev),
    topPickMaxSelectableDepth,
    onChangeTopPickDepth: setTopPickDepth,
    onChangeTopPickCount: setTopPickCount,
    avgChangeRateUseSimple,
    onToggleAvgChangeRateUseSimple: () => setAvgChangeRateUseSimple(prev => !prev),
    boxLabelMinAreaPercent,
    onChangeBoxLabelMinAreaPercent: setBoxLabelMinAreaPercent,
    stockLabelModeIndex: selectedStockLabelModeIndex,
    stockLabelEnabled,
    onToggleStockLabel: () => setStockLabelEnabled(prev => !prev),
    onChangeStockLabelModeIndex: setStockLabelModeIndex,
    decimalPlacesIndex,
    onChangeDecimalPlacesIndex: setDecimalPlacesIndex,
    stockPopupOnHover,
    onChangeStockPopupOnHover: setStockPopupOnHover,
    tiers: valueTiers,
    tierRangeMinIndex: tierRangeMinIndex === -1 ? 0 : tierRangeMinIndex,
    tierRangeMaxIndex: tierRangeMaxIndex === -1 ? Math.max(valueTiers.length - 1, 0) : tierRangeMaxIndex,
    onChangeTierRange: (min: number, max: number) => {
      setTierRangeMinIndex(min)
      setTierRangeMaxIndex(max)
    },
    sectorFilterEnabled,
    onToggleSectorFilter: () => setSectorFilterEnabled(prev => !prev),
    excludedSectors: Array.from(excludedSectorNames, ([sectorId, sectorName]) => ({ sectorId, sectorName })),
    onRemoveExcludedSector: handleRemoveExcludedSector,
    colorScaleDraft,
    colorCustomOn,
    onChangeColorCustomOn: handleChangeColorCustomOn,
    onSelectColorSwatch: handleSelectColorSwatch,
    onResetColorScale: handleResetColorScale,
    isResettingColorScale: isApplyingColorEdit,
    legendSwatches,
    isOpen: isSettingsOpen,
    onOpenChange: setIsSettingsOpen,
    isPinned: isSettingsPinned,
    onTogglePinned: () => (isLoggedIn ? setStoredSettingsPinned : setGuestSettingsPinned)(prev => !prev),
  }

  const colorEditorPanelProps =
    colorEditThresholds.length > 0
      ? {
          sessionKey: colorEditSessionKey,
          hasChanges: colorEditOriginal !== null
            && colorEditThresholds[0] !== undefined
            && (colorEditThresholds[0].thresholdPercent !== colorEditOriginal.thresholdPercent
              || colorEditThresholds[0].color.toLowerCase() !== colorEditOriginal.color.toLowerCase()),
          thresholds: colorEditThresholds,
          onChangeThreshold: handleChangeColorEditThreshold,
          onChangeColor: handleChangeColorEditColor,
          onApply: handleApplyColorEdit,
          onCancel: handleCancelColorEdit,
          isSaving: isApplyingColorEdit,
          errorMessage: colorEditError,
        }
      : null

  return {
    settingsModalProps,
    colorEditorPanelProps,
    // 지도 페이지가 트리맵을 실제로 그리는 데 직접 필요한 값들.
    market,
    isCustom,
    nxtOnly,
    heatmap,
    data,
    refetchMarketMap,
    isRefetchingMarketMap,
    isLoading,
    isError,
    isMarketMapSuccess,
    isMarketValueTierRangeReady,
    rootNodes,
    filteredRootNodes,
    stockChangeFilter,
    onChangeStockChangeFilter: setStockChangeFilter,
    sectorChangeFilter,
    onChangeSectorChangeFilter: setSectorChangeFilter,
    sectorChangeDepth,
    onChangeSectorChangeDepth: setSectorChangeDepth,
    availableMaxDepth,
    // 선택한 업종 단계는 KRX와 MARKETRY 히트맵에 동일하게 적용한다.
    maxDepth,
    marketValueDepthRange,
    weightedAvgDepthRange,
    simpleAvgDepthRange,
    upDownCountDepthRange,
    avgChangeRateUseSimple,
    boxSizeMarketCapRatio,
    strongIndustryColor,
    onChangeStrongIndustryColor: setStrongIndustryColor,
    onChangeBoxSizeMarketCapRatio: (value: number) => setBoxSizeMarketCapRatio(Math.max(0, Math.min(100, Math.round(value)))),
    topPickSectorKeys,
    // URL 쿼리(avgMode/sectorFilter)로 값을 직접 세팅해야 하는 페이지용 — 토글(prev => !prev)과 달리
    // 원하는 값을 그대로 넘겨 세팅한다.
    onChangeAvgChangeRateUseSimple: setAvgChangeRateUseSimple,
    excludedMarketValueTiers,
    boxLabelMinAreaPercent,
    stockLabelMode,
    decimalPlaces,
    stockPopupOnHover,
    colorScale,
    excludedSectorNames,
    onChangeSectorFilterEnabled: setSectorFilterEnabled,
    // MARKETRY 분류+섹터 기준 스위치가 둘 다 켜져있을 때만 실제로 적용되는 최종 제외 대상 ID 집합
    // (filteredRootNodes를 만들 때 쓰는 것과 동일한 값) — 트리를 직접 그리지 않고 섹터 ID
    // 기준으로만 걸러내면 되는 페이지(섹터 랭킹 등)를 위해 내보낸다.
    excludedSectorIds,
    handleExcludeSector,
    handleRemoveExcludedSector,
  }
}
