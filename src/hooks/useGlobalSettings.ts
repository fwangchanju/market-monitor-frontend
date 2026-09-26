import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { usePersistedState } from './usePersistedState'
import { usePageSetting } from './usePageSetting'
import { useRouteAwareMarket } from './useRouteAwareMarket'
import { useIsLoggedIn } from './useSession'
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
} from './useFilteredMarketMapTree'
import { useMarketValueTierRange } from './useMarketValueTierRange'
import { registerExcludedSector, unregisterExcludedSector } from '@/api/marketMap'
import {
  resolveLegendSwatches,
  UNSET_COLOR_SCALE_THRESHOLD_COLOR,
  type ColorScaleConfig,
  type ColorScaleThreshold,
} from '@/utils/marketMapColorScale'
import type { MarketMapSectorNode } from '@/types/api'

// 조회 실패/로딩 중이거나 "색상 커스텀 사용"이 꺼져있을 때 쓰는 폴백 — thresholds가 비어있으면 어차피
// 기본 프리셋으로 귀결된다(resolveMarketMapColor/resolveLegendSwatches 참고).
const EMPTY_COLOR_SCALE: ColorScaleConfig = { thresholds: [] }

export type DepthMetric = 'avgChangeRate' | 'upDownCount' | 'marketValue'

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

function topPickAverage(node: FilteredMarketMapSectorNode, useSimple: boolean): number | null {
  return useSimple ? node.simpleAvgChangeRate : node.weightedAvgChangeRate
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
  const { requireLogin } = useLoginGate()
  // 트리 조회 마켓은 경로를 따른다 — /map, /sector 둘 다 경로 세그먼트가 곧 마켓이라 여기서 바로
  // 우선순위(쿼리 > 경로 > 저장값 > 기본값)를 적용하면, 이 훅을 그대로 쓰는 지도 페이지는 물론
  // 트리 조회만 공유하는 섹터 페이지도 같은 마켓으로 트리를 받는다(docs/instructions-route-market-first-render.md 결정 2).
  const [market] = useRouteAwareMarket('marketMap.market', 'ALL_STOCK')
  // 저장값은 로그인 사용자에 한해 서버(user_preference)에 남는다. 비로그인은 저장값이 true여도
  // 항상 false로 강제한다 — 비로그인은 커스텀 모드 자체를 쓸 수 없다(가입/로그인 전환 지시서 4).
  const [storedIsCustom, setStoredIsCustom] = usePageSetting('marketMap.isCustom', true)
  const isCustom = isLoggedIn ? storedIsCustom : false
  // 시가총액 합/등락률 평균/등락 종목수 태그를 셋 다 동시에 켤 수 있었는데, 한꺼번에 여러 개가 뜨면
  // 섹터 헤더가 너무 정신없어서 라디오처럼 하나만 고르게 했다 — 뎁스 범위 슬라이더도 셋의
  // 내용(스텝/라벨)이 완전히 같으니 하나만 두고, 그 슬라이더가 지금 어느 지표에 적용되는지만
  // activeDepthMetric으로 고른다. 기능 전체의 표시 여부는 별도 토글(depthMetricEnabled)이 담당한다.
  const [activeDepthMetric, setActiveDepthMetric] = usePageSetting<DepthMetric | null>(
    'marketMap.activeDepthMetric',
    'avgChangeRate',
  )
  // 업종 표시 지표 토글을 다시 켤 때 직전에 고른 라디오 지표를 복원한다.
  const lastActiveDepthMetricRef = useRef<DepthMetric>(activeDepthMetric ?? 'avgChangeRate')
  const [depthMetricEnabled, setDepthMetricEnabled] = usePageSetting(
    'marketMap.depthMetricEnabled',
    activeDepthMetric !== null,
  )
  // 예전 세션스토리지에 activeDepthMetric=null만 남아 있어도 토글을 다시 켜면 등락률을 복원한다.
  const selectedDepthMetric = activeDepthMetric ?? lastActiveDepthMetricRef.current
  // 기본값: 대분류~중분류(index 0~1) — 렌더러가 캡처하는 기본 화면에 등락률이 보이도록.
  const [depthMetricMinIndex, setDepthMetricMinIndex] = usePageSetting('marketMap.depthMetricMinIndex', 0)
  const [depthMetricMaxIndex, setDepthMetricMaxIndex] = usePageSetting('marketMap.depthMetricMaxIndex', 1)
  // 등락률 태그/툴팁에 가중평균 대신 산술평균을 보여줄지 — 마켓맵 커스텀 페이지의 "동일 가중" 토글
  // 기본값을 On으로 하기 위해 기본을 true로 변경(랭킹 페이지의 기본 정렬 기준도 산술평균으로 같이 바뀜 — 두
  // 페이지가 이 값을 공유하는 구조라 의도적으로 함께 적용).
  const [avgChangeRateUseSimple, setAvgChangeRateUseSimple] = usePageSetting('marketMap.avgChangeRateUseSimple', true)
  // 종목 박스가 전체 트리맵 넓이에서 이 비중(%) 미만이면 종목명/등락률을 표시하지 않는다(섹터 헤더와는 무관).
  const [boxLabelMinAreaPercent, setBoxLabelMinAreaPercent] = usePageSetting('marketMap.boxLabelMinAreaPercent', 0.1)
  // 종목 박스에 이름만/등락률만/둘 다/끄기 중 뭘 보여줄지 — 기본은 둘 다(기존 동작 유지, 배열 앞에
  // "끄기"가 추가되면서 both의 인덱스가 2에서 3으로 밀림).
  const [stockLabelModeIndex, setStockLabelModeIndex] = usePageSetting('marketMap.stockLabelModeIndex', 3)
  // 기존 저장값 0(끄기)도 유지하며, 켜고 끄는 동안 선택한 표기 방식은 보존한다.
  const [stockLabelEnabled, setStockLabelEnabled] = usePageSetting('marketMap.stockLabelEnabled', stockLabelModeIndex !== 0)
  const selectedStockLabelModeIndex = stockLabelModeIndex || 3
  const stockLabelMode = stockLabelEnabled ? STOCK_LABEL_MODES[selectedStockLabelModeIndex] : 'off'
  // 지도 페이지에 표시되는 모든 등락률(%)의 소수점 자릿수 — 인덱스가 그대로 자릿수(0=정수, 1=소수
  // 1자리, 2=소수 2자리). 기본값 1(소수 1자리).
  const [decimalPlacesIndex, setDecimalPlacesIndex] = usePageSetting('marketMap.decimalPlacesIndex', 1)
  const decimalPlaces = decimalPlacesIndex
  // 시가총액 구간 범위 필터 — 마켓맵/섹터 랭킹 화면이 세션스토리지 키를 공유한다(useMarketValueTierRange 참고).
  const {
    tiers: valueTiers,
    minIndex: tierRangeMinIndex,
    maxIndex: tierRangeMaxIndex,
    setMinIndex: setTierRangeMinIndex,
    setMaxIndex: setTierRangeMaxIndex,
    excludedMarketValueTiers,
    isTierRangeReady: isMarketValueTierRangeReady,
  } = useMarketValueTierRange(isCustom)
  const [excludedSectorNames, setExcludedSectorNames] = usePersistedState<Map<number, string>>(
    'marketMap.excludedSectorNames',
    new Map(),
    {
      serialize: map => [...map.entries()],
      deserialize: raw => new Map(raw as [number, string][]),
    },
  )
  // 섹터 제외를 목록별로 켜고 끄는 게 아니라, 제외 적용 자체를 통째로 켜고 끄는 마스터 스위치.
  const [sectorFilterEnabled, setSectorFilterEnabled] = usePageSetting('marketMap.sectorFilterEnabled', true)
  // null = 제한 없음(전체 뎁스 표시). 슬라이더의 실제 상한(availableMaxDepth)은 트리 계산 후에 나온다.
  // 기본값 2(렌더러 캡처 기준 화면에 맞춤).
  const [selectedMaxDepth, setMaxDepth] = useState<number | null>(2)
  const [sectorLevelEnabled, setSectorLevelEnabled] = useState(true)
  const maxDepth = sectorLevelEnabled ? selectedMaxDepth : 0
  // 선호 업종 — 선택한 절대 depth에서 등락률 상위 N개 섹터를 지도 전체에 강조한다.
  const [topPickDepth, setTopPickDepth] = usePageSetting('marketMap.topPickDepth', 1)
  const [topPickCount, setTopPickCount] = usePageSetting('marketMap.topPickCount', 2)
  const [topPickEnabled, setTopPickEnabled] = usePageSetting('marketMap.topPickEnabled', topPickCount !== 0)
  const selectedTopPickCount = topPickCount || 2
  // 설정 팝업 열림 상태 — 색상 추가/수정 세션이 시작되면(아래) 잠깐 닫혔다가, 세션이 끝나면(적용/취소) 다시 열린다.
  // 페이지 컴포넌트가 새로 마운트될 때마다 설정창을 기본적으로 연다.
  // 닫힘 상태는 현재 페이지에 머무는 동안만 유지하고, 라우트 이동 시 초기화한다.
  const [isSettingsOpen, setIsSettingsOpen] = useState(true)
  const previousPathnameRef = useRef(pathname)

  useEffect(() => {
    if (previousPathnameRef.current === pathname) return
    previousPathnameRef.current = pathname
    setIsSettingsOpen(true)
  }, [pathname])
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
  } = useMarketMap(market, isCustom, {
    enabled: needsTree,
  })
  const rootNodes = data?.items ?? []

  useEffect(() => {
    if (!data) return
    const key = `${market}:${isCustom}`
    if (seededKeyRef.current === key) return
    seededKeyRef.current = key
    setExcludedSectorNames(seedExcludedSectorNames(data.items, []))
  }, [data, market, isCustom, setExcludedSectorNames])

  // 커스텀 모드가 아니면(기본 분류 트리) isExcluded 자체를 무시한다 — 섹터 제외는 커스텀 트리 전용 기능.
  const excludedSectorIds =
    isCustom && sectorFilterEnabled ? new Set(excludedSectorNames.keys()) : new Set<number>()

  const { filteredRootNodes, availableMaxDepth } = useFilteredMarketMapTree(
    rootNodes,
    excludedSectorIds,
    excludedMarketValueTiers,
  )

  // 데이터가 얕아서(예: 기본값 중분류인데 실제 뎁스가 대분류까지밖에 없음) 저장된 범위가
  // availableMaxDepth를 넘어설 수 있다 — 이럴 땐 어중간하게 줄여서 보여주는 대신 아예 꺼진 것으로
  // 취급한다. 슬라이더에 내려보내는 값도 이 값으로 통일해야 슬라이더 내부 드래그/클릭 판정도
  // 어긋나지 않는다.
  const depthMetricClampedMinIndex = Math.min(depthMetricMinIndex, depthMetricMaxIndex)
  const depthMetricClampedMaxIndex = depthMetricMaxIndex
  const isDepthMetricRangeValid = depthMetricClampedMaxIndex < availableMaxDepth

  const activeDepthRange: [number, number] | null =
    depthMetricEnabled && isDepthMetricRangeValid
      ? [depthMetricClampedMinIndex, depthMetricClampedMaxIndex]
      : null

  const marketValueDepthRange = selectedDepthMetric === 'marketValue' ? activeDepthRange : null
  const avgChangeRateDepthRange = selectedDepthMetric === 'avgChangeRate' ? activeDepthRange : null
  const upDownCountDepthRange = selectedDepthMetric === 'upDownCount' ? activeDepthRange : null

  // 선호 업종 라디오의 활성 상한은 업종 분류 레벨 설정을 따른다. 대/중/소분류 설정은 데이터가 얕아도
  // 미리 선택할 수 있게 두고, 현재 데이터에 해당 섹터가 없으면 강조 대상만 빈 Set으로 둔다.
  const topPickMaxSelectableDepth = maxDepth === null ? Math.max(3, availableMaxDepth) : maxDepth
  const topPickSectorIds = useMemo(() => {
    if (!isCustom || !topPickEnabled || topPickDepth < 0 || topPickDepth >= topPickMaxSelectableDepth) {
      return new Set<number>()
    }

    const candidates = collectSectorsAtDepth(filteredRootNodes, topPickDepth)
      .map((node, index) => ({ node, index, average: topPickAverage(node, avgChangeRateUseSimple) }))
      .filter((candidate): candidate is { node: FilteredMarketMapSectorNode; index: number; average: number } => {
        return candidate.average !== null
      })
      .sort((a, b) => b.average - a.average || b.node.totalMarketValue - a.node.totalMarketValue || a.index - b.index)

    return new Set(candidates.slice(0, selectedTopPickCount).map(candidate => candidate.node.sectorId))
  }, [
    avgChangeRateUseSimple,
    filteredRootNodes,
    isCustom,
    topPickEnabled,
    selectedTopPickCount,
    topPickDepth,
    topPickMaxSelectableDepth,
  ])

  // 등락률 컬러 스케일 draft — 서버 값(useMarketMapColorScale)이 도착하면 딱 한 번만 시드하고,
  // 이후로는 어드민이 설정 팝업에서 편집하는 draft를 그대로 트리맵/범례에 흘려보낸다. 그래서 "저장"
  // 전에도 실제로 보여주는 지도 색이 곧바로 바뀐다 — 별도의 미리보기 트리맵이 필요 없다.
  const { data: colorScaleServerData } = useMarketMapColorScale()
  const [colorScaleDraft, setColorScaleDraft] = useState<ColorScaleConfig | null>(null)
  if (colorScaleServerData && colorScaleDraft === null) {
    // 방어적 복사 — react-query 캐시가 들고 있는 참조를 그대로 draft로 물고 있지 않도록.
    setColorScaleDraft({ thresholds: colorScaleServerData.thresholds.map(threshold => ({ ...threshold })) })
  }
  // "색상 커스텀 사용" 토글 — 순수 로컬(세션스토리지) 상태. draft(=저장 대상)와는 완전히 분리돼 있어서
  // 꺼도 draft에 저장해둔 값은 건드리지 않고, 그냥 실제 지도에 넘기는 값만 빈 스케일(=기본 프리셋)로 바꿔치기한다.
  const [colorCustomOn, setColorCustomOn] = usePageSetting('marketMap.colorCustomOn', true)
  const colorScale = colorCustomOn ? (colorScaleDraft ?? EMPTY_COLOR_SCALE) : EMPTY_COLOR_SCALE
  const legendSwatches = resolveLegendSwatches(colorScale)

  // 지금 좌측 편집 패널에서 편집 중인 threshold들 — colorScaleDraft.thresholds의 인덱스 목록.
  // edit 모드는 항상 원소 1개, add 모드는 "+"로 여러 개가 될 수 있다. 빈 배열이면 세션 없음.
  const [colorEditIndices, setColorEditIndices] = useState<number[]>([])
  const [colorEditMode, setColorEditMode] = useState<'add' | 'edit'>('add')
  // 세션 시작 시점의 draft 스냅샷 — "취소"를 누르면 이걸로 되돌린다.
  const colorEditSnapshotRef = useRef<ColorScaleConfig | null>(null)
  const createThresholdMutation = useCreateMarketMapScaleThreshold()
  const updateThresholdMutation = useUpdateMarketMapScaleThreshold()
  const deleteThresholdMutation = useDeleteMarketMapScaleThreshold()
  // "적용"이 세션 안의 여러 행을 순회하며 create/update를 여러 번 호출하는 비동기 작업이라,
  // 개별 뮤테이션 훅의 isPending 하나만으로는 전체 진행 상태를 못 나타내서 별도로 든다.
  const [isApplyingColorEdit, setIsApplyingColorEdit] = useState(false)

  // 새로 추가되는 행은 값을 미리 채워주지 않는다 — 입력칸도, 색도 "아직 안 정한" 상태로 시작해서
  // 사용자가 직접 임계값을 입력하고 톤을 골라야 한다.
  const createBlankColorThreshold = (): ColorScaleThreshold => ({
    thresholdPercent: 0,
    color: UNSET_COLOR_SCALE_THRESHOLD_COLOR,
    colorLabel: null,
  })

  const handleAddColorThreshold = () => {
    if (!colorScaleDraft) return
    colorEditSnapshotRef.current = colorScaleDraft
    const nextThresholds = [...colorScaleDraft.thresholds, createBlankColorThreshold()]
    setColorScaleDraft({ ...colorScaleDraft, thresholds: nextThresholds })
    setColorEditMode('add')
    setColorEditIndices([nextThresholds.length - 1])
    setIsSettingsOpen(false)
  }
  const handleEditColorThreshold = (index: number) => {
    if (!colorScaleDraft) return
    colorEditSnapshotRef.current = colorScaleDraft
    setColorEditMode('edit')
    setColorEditIndices([index])
    setIsSettingsOpen(false)
  }
  // add 모드 전용 — 값이 비어있는 새 행을 draft 끝에 추가하고, 그 인덱스를 세션에 편입시킨다.
  const handleAddColorThresholdRow = () => {
    if (!colorScaleDraft || colorEditIndices.length === 0) return
    const nextThresholds = [...colorScaleDraft.thresholds, createBlankColorThreshold()]
    setColorScaleDraft({ ...colorScaleDraft, thresholds: nextThresholds })
    setColorEditIndices(prev => [...prev, nextThresholds.length - 1])
  }
  const handleChangeColorEditThreshold = (rowIndex: number, percent: number) => {
    const targetIndex = colorEditIndices[rowIndex]
    if (targetIndex === undefined) return
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
    setColorScaleDraft(prev =>
      prev ? { ...prev, thresholds: prev.thresholds.map((t, i) => (i === targetIndex ? { ...t, color, colorLabel } : t)) } : prev,
    )
  }
  const handleApplyColorEdit = async () => {
    if (!colorScaleDraft || colorEditIndices.length === 0) {
      colorEditSnapshotRef.current = null
      setColorEditIndices([])
      setIsSettingsOpen(true)
      return
    }
    setIsApplyingColorEdit(true)
    try {
      // 세션에서 편집한 행들 중 임계값이 같은 게 여럿이면 나중 값으로 덮어쓴다(마지막 값이 이김) —
      // "수정"도 결국 update와 같은 개념이라, 세션 중에 동일 임계값이 여러 번 나와도 막지 않고 여기서
      // 한 번에 정리한다. 이때 버려지는 쪽이 이미 서버에 저장된 행(id 있음)이면, 살아남는 행이 그
      // id를 대신 물려받아 update로 처리되게 하고 — 서로 다른 두 기존 행이 겹친 드문 경우에만 버려지는
      // 쪽을 별도로 삭제한다(id가 있는데 다른 id로 덮어써진 경우).
      const byThreshold = new Map<number, ColorScaleThreshold>()
      const idsToDelete: number[] = []
      for (const index of colorEditIndices) {
        const entry = colorScaleDraft.thresholds[index]
        if (!entry) continue
        const existing = byThreshold.get(entry.thresholdPercent)
        if (existing?.id !== undefined && entry.id !== undefined && existing.id !== entry.id) {
          idsToDelete.push(existing.id)
        }
        byThreshold.set(entry.thresholdPercent, { ...entry, id: entry.id ?? existing?.id })
      }
      const resolvedEntries = Array.from(byThreshold.values())

      const [savedEntries] = await Promise.all([
        Promise.all(
          resolvedEntries.map(entry => {
            const payload = { thresholdPercent: entry.thresholdPercent, color: entry.color, colorLabel: entry.colorLabel }
            return entry.id !== undefined
              ? updateThresholdMutation.mutateAsync({ id: entry.id, payload })
              : createThresholdMutation.mutateAsync(payload)
          }),
        ),
        Promise.all(idsToDelete.map(id => deleteThresholdMutation.mutateAsync(id))),
      ])

      setColorScaleDraft(prev => {
        if (!prev) return prev
        const sessionIndexSet = new Set(colorEditIndices)
        const untouched = prev.thresholds.filter((_, i) => !sessionIndexSet.has(i))
        return { ...prev, thresholds: [...untouched, ...savedEntries] }
      })
    } finally {
      setIsApplyingColorEdit(false)
      colorEditSnapshotRef.current = null
      setColorEditIndices([])
      setIsSettingsOpen(true)
    }
  }
  const handleCancelColorEdit = () => {
    if (colorEditSnapshotRef.current) setColorScaleDraft(colorEditSnapshotRef.current)
    colorEditSnapshotRef.current = null
    setColorEditIndices([])
    setIsSettingsOpen(true)
  }
  const handleDeleteColorThreshold = (index: number) => {
    if (!colorScaleDraft) return
    const target = colorScaleDraft.thresholds[index]
    if (!target) return
    if (!window.confirm('정말 삭제하시겠습니까?')) return
    const next = { ...colorScaleDraft, thresholds: colorScaleDraft.thresholds.filter((_, i) => i !== index) }
    setColorScaleDraft(next)
    if (target.id !== undefined) deleteThresholdMutation.mutate(target.id)
  }
  const colorEditThresholds = colorScaleDraft
    ? colorEditIndices.map(i => colorScaleDraft.thresholds[i]).filter((t): t is ColorScaleThreshold => t !== undefined)
    : []

  // 비로그인이 커스텀 모드를 켜려 하면 토글 대신 로그인 팝업을 띄운다 — 로그인 성공 후 지금 페이지로
  // 돌아온다(가입/로그인 전환 지시서 4). 이미 로그인 상태면 평소처럼 저장값을 토글한다.
  const handleToggleCustom = () => {
    if (!isLoggedIn) {
      requireLogin(pathname)
      return
    }
    setStoredIsCustom(prev => !prev)
  }

  const handleChangeActiveDepthMetric = (metric: DepthMetric) => {
    lastActiveDepthMetricRef.current = metric
    setActiveDepthMetric(metric)
  }

  const handleToggleDepthMetric = () => {
    if (!depthMetricEnabled) setActiveDepthMetric(lastActiveDepthMetricRef.current)
    setDepthMetricEnabled(prev => !prev)
  }

  const handleChangeMaxDepth = (nextMaxDepth: number) => {
    setMaxDepth(nextMaxDepth)
    // 지표 범위는 그대로 보존한다. 표시 가능한 상한을 넘는 부분은 설정 UI에서만 잠시 비활성화하고,
    // 업종 분류 레벨을 다시 높이면 원래 선택 범위가 그대로 돌아온다.
  }

  const handleChangeDepthMetricRange = (min: number, max: number) => {
    setDepthMetricMinIndex(min)
    setDepthMetricMaxIndex(max)
  }

  const handleExcludeSector = (sectorId: number, sectorName: string) => {
    const path = findSectorPath(rootNodes, sectorId)
    setExcludedSectorNames(prev => new Map(prev).set(sectorId, path ? path.join(' > ') : sectorName))
    registerExcludedSector(sectorId).catch(e => console.error('섹터 제외 실패', e))
  }

  const handleRemoveExcludedSector = (sectorId: number) => {
    setExcludedSectorNames(prev => {
      const next = new Map(prev)
      next.delete(sectorId)
      return next
    })
    unregisterExcludedSector(sectorId).catch(e => console.error('섹터 제외 해제 실패', e))
  }

  const settingsModalProps = {
    isCustom,
    onToggleCustom: handleToggleCustom,
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
    onChangeColorCustomOn: setColorCustomOn,
    onAddColorThreshold: handleAddColorThreshold,
    onEditColorThreshold: handleEditColorThreshold,
    onDeleteColorThreshold: handleDeleteColorThreshold,
    legendSwatches,
    isOpen: isSettingsOpen,
    onOpenChange: setIsSettingsOpen,
  }

  const colorEditorPanelProps =
    colorEditThresholds.length > 0
      ? {
          mode: colorEditMode,
          thresholds: colorEditThresholds,
          onChangeThreshold: handleChangeColorEditThreshold,
          onChangeColor: handleChangeColorEditColor,
          onAddRow: handleAddColorThresholdRow,
          onApply: handleApplyColorEdit,
          onCancel: handleCancelColorEdit,
          isSaving: isApplyingColorEdit,
        }
      : null

  return {
    settingsModalProps,
    colorEditorPanelProps,
    // 지도 페이지가 트리맵을 실제로 그리는 데 직접 필요한 값들.
    market,
    isCustom,
    data,
    refetchMarketMap,
    isRefetchingMarketMap,
    isLoading,
    isError,
    isMarketMapSuccess,
    isMarketValueTierRangeReady,
    rootNodes,
    filteredRootNodes,
    availableMaxDepth,
    // 뎁스 제한을 "지금 보고 있는 위치" 기준으로 다시 적용하는 건 페이지(MarketMapCustomPage)의
    // 몫이라 원본 설정값을 그대로 내보낸다 — isCustom이 아닐 때 무시하는 것도 페이지에서 처리한다.
    maxDepth,
    marketValueDepthRange,
    avgChangeRateDepthRange,
    upDownCountDepthRange,
    avgChangeRateUseSimple,
    topPickSectorIds,
    // URL 쿼리(avgMode/sectorFilter)로 값을 직접 세팅해야 하는 페이지용 — 토글(prev => !prev)과 달리
    // 원하는 값을 그대로 넘겨 세팅한다.
    onChangeAvgChangeRateUseSimple: setAvgChangeRateUseSimple,
    excludedMarketValueTiers,
    boxLabelMinAreaPercent,
    stockLabelMode,
    decimalPlaces,
    colorScale,
    excludedSectorNames,
    onChangeSectorFilterEnabled: setSectorFilterEnabled,
    // 커스텀 모드+섹터 기준 스위치가 둘 다 켜져있을 때만 실제로 적용되는 최종 제외 대상 ID 집합
    // (filteredRootNodes를 만들 때 쓰는 것과 동일한 값) — 트리를 직접 그리지 않고 섹터 ID
    // 기준으로만 걸러내면 되는 페이지(섹터 랭킹 등)를 위해 내보낸다.
    excludedSectorIds,
    handleExcludeSector,
    handleRemoveExcludedSector,
  }
}
