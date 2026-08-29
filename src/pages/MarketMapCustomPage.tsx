import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import NavBar from '@/components/NavBar'
import SubNavBar from '@/components/SubNavBar'
import MarketMapColorThresholdEditorPanel from '@/components/MarketMapColorThresholdEditorPanel'
import MarketMapSettingsModal from '@/components/MarketMapSettingsModal'
import MarketMapShareModal from '@/components/MarketMapShareModal'
import MarketMapTreemap from '@/components/MarketMapTreemap'
import Spinner from '@/components/Spinner'
import { ShareIcon, MaximizeIcon, MinimizeIcon } from '@/components/icons/MarketMapIcons'
import { useMarketMap } from '@/hooks/useMarketMap'
import { useMarketMapColorScale } from '@/hooks/useMarketMapColorScale'
import {
  useCreateMarketMapScaleThreshold,
  useUpdateMarketMapScaleThreshold,
  useDeleteMarketMapScaleThreshold,
} from '@/hooks/useMarketMapAdmin'
import { useMarketMapDrilldown } from '@/hooks/useMarketMapDrilldown'
import { useFilteredMarketMapTree } from '@/hooks/useFilteredMarketMapTree'
import { usePersistedState } from '@/hooks/usePersistedState'
import type { DisplayGroup } from '@/hooks/useMarketMapLayout'
import { TAB_GAP, toMarketMapSnapshotTimeLabel, toIndex, toPctSigned, signClass } from '@/utils/format'
import { useMarketSummary } from '@/hooks/useMarketSummary'
import { captureElementToClipboard } from '@/utils/captureToClipboard'
import { CAPTURE_ID } from '@/utils/captureIds'
import { captureElementToDownload } from '@/utils/captureToDownload'
import { registerExcludedCategory, unregisterExcludedCategory } from '@/api/marketMap'
import { useMarketValueTierRange } from '@/hooks/useMarketValueTierRange'
import {
  resolveLegendSwatches,
  UNSET_COLOR_SCALE_THRESHOLD_COLOR,
  type ColorScaleConfig,
  type ColorScaleThreshold,
} from '@/utils/marketMapColorScale'
import type { FilteredMarketMapCategoryNode } from '@/hooks/useFilteredMarketMapTree'
import type { Market, MarketMapCategoryNode, MarketMapItem } from '@/types/api'

const MARKET_LABEL: Record<Market, string> = { KOSPI: 'KOSPI', KOSDAQ: 'KOSDAQ' }

// 조회 실패/로딩 중이거나 "색상 커스텀 사용"이 꺼져있을 때 쓰는 폴백 — thresholds가 비어있으면 어차피
// 기본 프리셋으로 귀결된다(resolveMarketMapColor/resolveLegendSwatches 참고).
const EMPTY_COLOR_SCALE: ColorScaleConfig = { thresholds: [] }

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
  const [market, setMarket] = usePersistedState<Market>('marketMap.market', 'KOSPI')
  const [isCustom, setIsCustom] = usePersistedState('marketMap.isCustom', true)
  // 세 표시 옵션(시가총액 합/등락률 평균/등락 종목수) 모두 슬라이더 인덱스 기준(0=OFF, 1=뎁스0, 2=뎁스1, ...)
  // — 둘 다 0(OFF)이면 꺼짐. 실제 뎁스 범위로 변환한 값은 각각의 DepthRange를 통해서만 하위로 내려보낸다.
  const [marketValueDepthMinIndex, setMarketValueDepthMinIndex] = usePersistedState('marketMap.marketValueDepthMinIndex', 0)
  const [marketValueDepthMaxIndex, setMarketValueDepthMaxIndex] = usePersistedState('marketMap.marketValueDepthMaxIndex', 0)
  // 기본값: 2차 분류만 켜짐(렌더러가 캡처하는 기본 화면에 등락률이 보이도록).
  const [avgChangeRateDepthMinIndex, setAvgChangeRateDepthMinIndex] = usePersistedState('marketMap.avgChangeRateDepthMinIndex', 2)
  const [avgChangeRateDepthMaxIndex, setAvgChangeRateDepthMaxIndex] = usePersistedState('marketMap.avgChangeRateDepthMaxIndex', 2)
  const [upDownCountDepthMinIndex, setUpDownCountDepthMinIndex] = usePersistedState('marketMap.upDownCountDepthMinIndex', 0)
  const [upDownCountDepthMaxIndex, setUpDownCountDepthMaxIndex] = usePersistedState('marketMap.upDownCountDepthMaxIndex', 0)
  // 등락률 태그/툴팁에 가중평균 대신 산술평균을 보여줄지 — 기본은 가중평균(기존 동작과 동일).
  const [avgChangeRateUseSimple, setAvgChangeRateUseSimple] = usePersistedState('marketMap.avgChangeRateUseSimple', false)
  // 시가총액 구간 범위 필터 — 마켓맵/카테고리 랭킹 화면이 세션스토리지 키를 공유한다(useMarketValueTierRange 참고).
  const {
    tiers: valueTiers,
    minIndex: tierRangeMinIndex,
    maxIndex: tierRangeMaxIndex,
    setMinIndex: setTierRangeMinIndex,
    setMaxIndex: setTierRangeMaxIndex,
    excludedMarketValueTiers,
  } = useMarketValueTierRange(isCustom)
  const [excludedCategoryNames, setExcludedCategoryNames] = usePersistedState<Map<number, string>>(
    'marketMap.excludedCategoryNames',
    new Map(),
    {
      serialize: map => [...map.entries()],
      deserialize: raw => new Map(raw as [number, string][]),
    },
  )
  // 섹터 제외를 목록별로 켜고 끄는 게 아니라, 제외 적용 자체를 통째로 켜고 끄는 마스터 스위치.
  const [sectorFilterEnabled, setSectorFilterEnabled] = usePersistedState('marketMap.sectorFilterEnabled', true)
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

  // 등락률 컬러 스케일 draft — 서버 값(useMarketMapColorScale)이 도착하면 딱 한 번만 시드하고,
  // 이후로는 어드민이 설정 드롭다운(MarketMapColorScaleSettings)에서 편집하는 draft를 그대로
  // 트리맵/범례에 흘려보낸다. 그래서 "저장" 전에도 이 페이지가 실제로 보여주는 지도 색이 곧바로
  // 바뀐다 — 별도의 미리보기 트리맵이 필요 없다.
  const { data: colorScaleServerData } = useMarketMapColorScale()
  const [colorScaleDraft, setColorScaleDraft] = useState<ColorScaleConfig | null>(null)
  if (colorScaleServerData && colorScaleDraft === null) {
    // 방어적 복사 — react-query 캐시가 들고 있는 참조를 그대로 draft로 물고 있지 않도록.
    setColorScaleDraft({ thresholds: colorScaleServerData.thresholds.map(threshold => ({ ...threshold })) })
  }
  // "색상 커스텀 사용" 토글 — 순수 로컬(세션스토리지) 상태. draft(=저장 대상)와는 완전히 분리돼 있어서
  // 꺼도 draft에 저장해둔 값은 건드리지 않고, 그냥 실제 지도에 넘기는 값만 빈 스케일(=기본 프리셋)로
  // 바꿔치기한다.
  const [colorCustomOn, setColorCustomOn] = usePersistedState('marketMapColorCustomOn', true)
  const colorScale = colorCustomOn ? (colorScaleDraft ?? EMPTY_COLOR_SCALE) : EMPTY_COLOR_SCALE
  // 설정 팝업 열림 상태 — 색상 추가/수정 세션이 시작되면(아래) 이 페이지가 잠깐 닫았다가, 세션이
  // 끝나면(적용/취소) 다시 열어준다. 그래서 팝업 자체가 아니라 여기서 열림 상태를 들고 있어야 한다.
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  // 지금 좌측 사이드바 하단 패널에서 편집 중인 threshold들 — colorScaleDraft.thresholds의 인덱스 목록.
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

  const { data: marketSummaryData } = useMarketSummary()
  const marketOverview = marketSummaryData?.marketOverviews.items.find(item => item.market === market)

  const rootNodes = data?.items ?? []

  useEffect(() => {
    if (!data) return
    const key = `${market}:${isCustom}`
    if (seededKeyRef.current === key) return
    seededKeyRef.current = key
    setExcludedCategoryNames(seedExcludedCategoryNames(data.items, []))
  }, [data, market, isCustom, setExcludedCategoryNames])

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
      {/* 탭+옵션 버튼 바 — 전체화면 진입/해제와 무관하게 항상 같은 높이·구성으로 유지된다(예전엔 모드별로
          완전히 다른 JSX 두 벌을 썼는데, 전체화면 시 최상단 바만 숨기는 걸로 바뀌면서 하나로 합쳤다). */}
      <SubNavBar
        actions={
          <>
            <MarketMapSettingsModal
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
              avgChangeRateUseSimple={avgChangeRateUseSimple}
              onToggleAvgChangeRateUseSimple={() => setAvgChangeRateUseSimple(prev => !prev)}
              tiers={valueTiers}
              tierRangeMinIndex={tierRangeMinIndex === -1 ? 0 : tierRangeMinIndex}
              tierRangeMaxIndex={tierRangeMaxIndex === -1 ? Math.max(valueTiers.length - 1, 0) : tierRangeMaxIndex}
              onChangeTierRange={handleChangeTierRange}
              sectorFilterEnabled={sectorFilterEnabled}
              onToggleSectorFilter={() => setSectorFilterEnabled(prev => !prev)}
              excludedCategories={Array.from(excludedCategoryNames, ([categoryId, categoryName]) => ({ categoryId, categoryName }))}
              onRemoveExcludedCategory={handleRemoveExcludedCategory}
              colorScaleDraft={colorScaleDraft}
              colorCustomOn={colorCustomOn}
              onChangeColorCustomOn={setColorCustomOn}
              onAddColorThreshold={handleAddColorThreshold}
              onEditColorThreshold={handleEditColorThreshold}
              onDeleteColorThreshold={handleDeleteColorThreshold}
              isOpen={isSettingsOpen}
              onOpenChange={setIsSettingsOpen}
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
          </>
        }
      />
      <div className="flex min-h-0 flex-1">
        {!isFullscreen && colorEditThresholds.length > 0 && (
          <div className="w-56 shrink-0 overflow-y-auto bg-[var(--surface)]">
            <MarketMapColorThresholdEditorPanel
              mode={colorEditMode}
              thresholds={colorEditThresholds}
              onChangeThreshold={handleChangeColorEditThreshold}
              onChangeColor={handleChangeColorEditColor}
              onAddRow={handleAddColorThresholdRow}
              onApply={handleApplyColorEdit}
              onCancel={handleCancelColorEdit}
              isSaving={isApplyingColorEdit}
            />
          </div>
        )}
        <div ref={captureRef} data-captureid={CAPTURE_ID.MARKET_MAP} className="flex min-h-0 flex-1 flex-col bg-black">
          <div className="mb-1 grid h-7 w-full shrink-0 grid-cols-[auto_1fr_auto] items-center border-2 border-black bg-black/70 px-1 text-sm font-bold text-white">
            <div className="flex items-center whitespace-nowrap">
              <span className="text-2xl">{MARKET_LABEL[market]}</span>
              {marketOverview && (
                <span className={`text-base font-normal ${signClass(marketOverview.changeRate)}`}>
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
            <span className="min-w-0 whitespace-nowrap text-center text-base font-normal text-gray-400">
              {modeStatusText}
            </span>
            <div className="flex items-center gap-3">
              {data?.snapshotTime && (
                <span className="whitespace-nowrap text-base font-normal text-white">
                  {toMarketMapSnapshotTimeLabel(data.snapshotTime)}
                </span>
              )}
              <div className="flex items-center gap-0.5">
                {resolveLegendSwatches(colorScale).map(({ label, color }) => (
                  <div
                    key={label}
                    style={{ backgroundColor: color }}
                    className="flex h-5 w-9 items-center justify-center text-[10px]"
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
              avgChangeRateUseSimple={avgChangeRateUseSimple}
              canExclude={isCustom}
              colorScale={colorScale}
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
