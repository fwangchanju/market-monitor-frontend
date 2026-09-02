import { useEffect, useRef, useState } from 'react'
import { usePersistedState } from './usePersistedState'
import { useMarketMap } from './useMarketMap'
import { useMarketMapColorScale } from './useMarketMapColorScale'
import { useCreateMarketMapScaleThreshold, useUpdateMarketMapScaleThreshold, useDeleteMarketMapScaleThreshold } from './useMarketMapAdmin'
import { useFilteredMarketMapTree } from './useFilteredMarketMapTree'
import { useMarketValueTierRange } from './useMarketValueTierRange'
import { registerExcludedCategory, unregisterExcludedCategory } from '@/api/marketMap'
import {
  resolveLegendSwatches,
  UNSET_COLOR_SCALE_THRESHOLD_COLOR,
  type ColorScaleConfig,
  type ColorScaleThreshold,
} from '@/utils/marketMapColorScale'
import type { Market, MarketMapCategoryNode } from '@/types/api'

// 조회 실패/로딩 중이거나 "색상 커스텀 사용"이 꺼져있을 때 쓰는 폴백 — thresholds가 비어있으면 어차피
// 기본 프리셋으로 귀결된다(resolveMarketMapColor/resolveLegendSwatches 참고).
const EMPTY_COLOR_SCALE: ColorScaleConfig = { thresholds: [] }

// 슬라이더 인덱스(0=OFF, 1=뎁스0, 2=뎁스1, ...)를 실제 뎁스 범위로 변환한다. max가 OFF(0)에 있으면 완전히 꺼짐.
function toDepthRange(minIndex: number, maxIndex: number): [number, number] | null {
  return maxIndex > 0 ? [Math.max(minIndex - 1, 0), maxIndex - 1] : null
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

// "설정" 사이드바(GlobalSettingsSidebar) + 색상 구간 편집 패널이 필요로 하는 상태/로직 전부를
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
  const [market, setMarket] = usePersistedState<Market>('marketMap.market', 'KOSPI')
  const [isCustom, setIsCustom] = usePersistedState('marketMap.isCustom', true)
  // 세 표시 옵션(시가총액 합/등락률 평균/등락 종목수) 모두 슬라이더 인덱스 기준(0=OFF, 1=뎁스0, 2=뎁스1, ...)
  // — 둘 다 0(OFF)이면 꺼짐. 실제 뎁스 범위로 변환한 값은 각각의 DepthRange를 통해서만 하위로 내려보낸다.
  const [marketValueDepthMinIndex, setMarketValueDepthMinIndex] = usePersistedState('marketMap.marketValueDepthMinIndex', 0)
  const [marketValueDepthMaxIndex, setMarketValueDepthMaxIndex] = usePersistedState('marketMap.marketValueDepthMaxIndex', 0)
  // 기본값: 대분류만 켜짐(렌더러가 캡처하는 기본 화면에 등락률이 보이도록).
  const [avgChangeRateDepthMinIndex, setAvgChangeRateDepthMinIndex] = usePersistedState('marketMap.avgChangeRateDepthMinIndex', 1)
  const [avgChangeRateDepthMaxIndex, setAvgChangeRateDepthMaxIndex] = usePersistedState('marketMap.avgChangeRateDepthMaxIndex', 1)
  const [upDownCountDepthMinIndex, setUpDownCountDepthMinIndex] = usePersistedState('marketMap.upDownCountDepthMinIndex', 0)
  const [upDownCountDepthMaxIndex, setUpDownCountDepthMaxIndex] = usePersistedState('marketMap.upDownCountDepthMaxIndex', 0)
  // 등락률 태그/툴팁에 가중평균 대신 산술평균을 보여줄지 — 기본은 가중평균(기존 동작과 동일).
  const [avgChangeRateUseSimple, setAvgChangeRateUseSimple] = usePersistedState('marketMap.avgChangeRateUseSimple', false)
  // 종목 박스가 전체 트리맵 넓이에서 이 비중(%) 미만이면 종목명/등락률을 표시하지 않는다(카테고리 헤더와는 무관).
  const [boxLabelMinAreaPercent, setBoxLabelMinAreaPercent] = usePersistedState('marketMap.boxLabelMinAreaPercent', 0.1)
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
  // 설정 팝업 열림 상태 — 색상 추가/수정 세션이 시작되면(아래) 잠깐 닫혔다가, 세션이 끝나면(적용/취소) 다시 열린다.
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  // 새로 받아온 (market, isCustom) 조합의 데이터가 처음 도착했을 때만 서버 isExcluded로 시드하고,
  // 그 뒤 60초 백그라운드 재조회가 로컬에서 방금 토글한 상태를 덮어쓰지 않게 한다(fire-and-forget 저장이라
  // 서버 반영 전에 재조회가 먼저 도착할 수 있음).
  const seededKeyRef = useRef<string | null>(null)

  const { data, isLoading, isError } = useMarketMap(market, isCustom, { enabled: needsTree || isSettingsOpen })
  const rootNodes = data?.items ?? []

  useEffect(() => {
    if (!data) return
    const key = `${market}:${isCustom}`
    if (seededKeyRef.current === key) return
    seededKeyRef.current = key
    setExcludedCategoryNames(seedExcludedCategoryNames(data.items, []))
  }, [data, market, isCustom, setExcludedCategoryNames])

  // 커스텀 모드가 아니면(기본 분류 트리) isExcluded 자체를 무시한다 — 카테고리 제외는 커스텀 트리 전용 기능.
  const excludedCategoryIds =
    isCustom && sectorFilterEnabled ? new Set(excludedCategoryNames.keys()) : new Set<number>()

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

  const marketValueDepthRange = toDepthRange(marketValueClampedMinIndex, marketValueClampedMaxIndex)
  const avgChangeRateDepthRange = toDepthRange(avgChangeRateClampedMinIndex, avgChangeRateClampedMaxIndex)
  const upDownCountDepthRange = toDepthRange(upDownCountClampedMinIndex, upDownCountClampedMaxIndex)

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
  const [colorCustomOn, setColorCustomOn] = usePersistedState('marketMapColorCustomOn', true)
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

  const handleToggleCustom = () => setIsCustom(prev => !prev)

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

  const settingsModalProps = {
    isCustom,
    onToggleCustom: handleToggleCustom,
    maxDepth,
    availableMaxDepth,
    onChangeMaxDepth: setMaxDepth,
    marketValueDepthMinIndex: marketValueClampedMinIndex,
    marketValueDepthMaxIndex: marketValueClampedMaxIndex,
    onChangeMarketValueDepthRange: (min: number, max: number) => {
      setMarketValueDepthMinIndex(min)
      setMarketValueDepthMaxIndex(max)
    },
    avgChangeRateDepthMinIndex: avgChangeRateClampedMinIndex,
    avgChangeRateDepthMaxIndex: avgChangeRateClampedMaxIndex,
    onChangeAvgChangeRateDepthRange: (min: number, max: number) => {
      setAvgChangeRateDepthMinIndex(min)
      setAvgChangeRateDepthMaxIndex(max)
    },
    upDownCountDepthMinIndex: upDownCountClampedMinIndex,
    upDownCountDepthMaxIndex: upDownCountClampedMaxIndex,
    onChangeUpDownCountDepthRange: (min: number, max: number) => {
      setUpDownCountDepthMinIndex(min)
      setUpDownCountDepthMaxIndex(max)
    },
    avgChangeRateUseSimple,
    onToggleAvgChangeRateUseSimple: () => setAvgChangeRateUseSimple(prev => !prev),
    boxLabelMinAreaPercent,
    onChangeBoxLabelMinAreaPercent: setBoxLabelMinAreaPercent,
    tiers: valueTiers,
    tierRangeMinIndex: tierRangeMinIndex === -1 ? 0 : tierRangeMinIndex,
    tierRangeMaxIndex: tierRangeMaxIndex === -1 ? Math.max(valueTiers.length - 1, 0) : tierRangeMaxIndex,
    onChangeTierRange: (min: number, max: number) => {
      setTierRangeMinIndex(min)
      setTierRangeMaxIndex(max)
    },
    sectorFilterEnabled,
    onToggleSectorFilter: () => setSectorFilterEnabled(prev => !prev),
    excludedCategories: Array.from(excludedCategoryNames, ([categoryId, categoryName]) => ({ categoryId, categoryName })),
    onRemoveExcludedCategory: handleRemoveExcludedCategory,
    colorScaleDraft,
    colorCustomOn,
    onChangeColorCustomOn: setColorCustomOn,
    onAddColorThreshold: handleAddColorThreshold,
    onEditColorThreshold: handleEditColorThreshold,
    onDeleteColorThreshold: handleDeleteColorThreshold,
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
    setMarket,
    isCustom,
    data,
    isLoading,
    isError,
    rootNodes,
    filteredRootNodes,
    availableMaxDepth,
    marketValueDepthRange,
    avgChangeRateDepthRange,
    upDownCountDepthRange,
    avgChangeRateUseSimple,
    boxLabelMinAreaPercent,
    colorScale,
    legendSwatches,
    excludedCategoryNames,
    handleExcludeCategory,
    handleRemoveExcludedCategory,
  }
}
