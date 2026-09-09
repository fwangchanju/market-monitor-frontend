import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import NavBar from '@/components/NavBar'
import SubNavBar from '@/components/SubNavBar'
import MarketMapColorThresholdEditorPanel from '@/components/MarketMapColorThresholdEditorPanel'
import SettingsSidebar, {
  SettingsCustomModeSection,
  SettingsEqualWeightSection,
  SettingsDisplayRangeSection,
  SettingsExcludeSection,
  SettingsColorSection,
} from '@/components/SettingsSidebar'
import MarketMapShareModal from '@/components/MarketMapShareModal'
import Spinner from '@/components/Spinner'
import NumberStepperInput from '@/components/NumberStepperInput'
import { useMarketMap } from '@/hooks/useMarketMap'
import { useCategoryChangeRates } from '@/hooks/useCategoryChangeRates'
import { useGlobalSettings } from '@/hooks/useGlobalSettings'
import { usePersistedState } from '@/hooks/usePersistedState'
import { combineTierBreakdowns } from '@/utils/categoryTierBreakdown'
import { CAPTURE_ID } from '@/utils/captureIds'
import NavBarPageActions from '@/components/NavBarPageActions'
import { FONT_BAR_TITLE, FONT_BAR_TIME } from '@/components/FontStyle'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { captureElementToClipboard } from '@/utils/captureToClipboard'
import { captureElementToDownload } from '@/utils/captureToDownload'
import { toMarketMapSnapshotTimeLabel, signClass, avgChangeRateLabel } from '@/utils/format'
import { resolveMarketMapColor, type ColorScaleConfig } from '@/utils/marketMapColorScale'
import type { CategoryTierBreakdown, Market, MarketQuery, MarketMapCategoryNode } from '@/types/api'

type CopyStatus = 'idle' | 'copying' | 'copied' | 'error'
type DownloadStatus = 'idle' | 'downloading' | 'error'

const MIN_BEFORE_MINUTES = 5
const BEFORE_MINUTES_PRESETS = [15, 30, 60]

// 지도 페이지(MarketMapCustomPage)와 동일한 마켓 라벨 표기.
const MARKET_LABEL: Record<MarketQuery, string> = { KOSPI: 'KOSPI', KOSDAQ: 'KOSDAQ', ALL_STOCK: 'ALL STOCK' }
// 지수 등락률 참조 막대에 붙는 한글 라벨 — ALL_STOCK은 단일 지수가 없어 대상에서 제외된다.
const MARKET_INDEX_LABEL_KO: Record<Market, string> = { KOSPI: '코스피', KOSDAQ: '코스닥' }
// 실제 카테고리 id(양수)와 겹치지 않는 음수 sentinel — 지수 참조 막대 전용 categoryId(React key로도 씀).
const MARKET_INDEX_CATEGORY_ID = -1
// 지도 페이지에서 최상위 뎁스 카테고리를 노란 글자로 표시하는 것과 같은 "기준" 색상 — 참조 막대도 동일하게 맞춘다.
const MARKET_INDEX_BAR_COLOR = '#eab308'

function collectCategoryNames(nodes: MarketMapCategoryNode[], out: Map<number, string> = new Map()): Map<number, string> {
  for (const node of nodes) {
    out.set(node.categoryId, node.categoryName)
    collectCategoryNames(node.children, out)
  }
  return out
}

interface RankedItem {
  categoryId: number
  categoryName: string
  value: number
  // 지수 등락률 참조 막대 표시용 — 일반 카테고리 막대와 색을 다르게 칠하는 데만 쓴다.
  isReference?: boolean
}

interface RankChart {
  rankedItems: RankedItem[]
  axisMax: number
  axisTicks: number[]
}

// 카테고리별 (id, 값) 목록을 값 내림차순 랭킹 막대그래프 데이터로 변환한다 — "현재" 그래프/"변화율"
// 그래프 둘 다 이 함수로 각각 독립적으로 정렬·스케일을 만든다(같은 포맷, 정렬 기준값만 다름).
function buildRankChart(
  entries: { categoryId: number; value: number; categoryName?: string; isReference?: boolean }[],
  categoryNameById: Map<number, string>,
): RankChart {
  const rankedItems: RankedItem[] = entries
    .map(entry => ({ ...entry, categoryName: entry.categoryName ?? categoryNameById.get(entry.categoryId) ?? '' }))
    .sort((a, b) => b.value - a.value)

  const rawMaxAbsValue = Math.max(1, ...rankedItems.map(item => Math.abs(item.value)))
  // 핀비즈처럼 축 눈금이 딱 떨어지게, 0.5%p 단위로 올림한 값을 막대 스케일과 축 눈금 양쪽에 같이 쓴다.
  const axisMax = Math.ceil(rawMaxAbsValue * 2) / 2
  const axisTicks = [0, 0.25, 0.5, 0.75, 1].map(ratio => axisMax * ratio)

  return { rankedItems, axisMax, axisTicks }
}

// "현재" 그래프는 실제 등락률(%)이지만 "변화율" 그래프는 두 시점의 %끼리 뺀 차이(%p)라 단위가
// 다르다 — 호출부가 unit을 넘겨서 값 표기에만 반영하고, 그 외 포맷(부호/소수점)은 동일하게 맞춘다.
function toChartValueLabel(value: number, unit: string): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}${unit}`
}
function toChartTickLabel(value: number, unit: string): string {
  return `${value.toFixed(2)}${unit}`
}

// 라벨 열은 내용에 맞춰(auto), 그래프 열은 남는 공간을 다 쓴다 — "현재"/"변화율" 그래프 둘 다 동일한
// 포맷으로 그린다. header는 그래프(막대 트랙)와 같은 열(1fr)에 그려서, 그래프가 시작하는 위치와
// header 텍스트가 시작하는 위치가 라벨 폭과 무관하게 항상 맞도록 한다.
function RankBars({
  chart,
  header,
  unit = '%',
  colorScale,
}: {
  chart: RankChart
  header?: ReactNode
  unit?: string
  // 지도 페이지 트리맵 박스와 동일한 등락률 컬러 스케일(설정 사이드바의 "색상 설정") — 막대 색도
  // 고정된 상승/하락 2색 대신 이 스케일로 칠한다.
  colorScale: ColorScaleConfig
}) {
  if (chart.rankedItems.length === 0) {
    return <div className="p-8 text-center text-xs text-gray-500">데이터가 없습니다</div>
  }
  return (
    // min-h-0: flex 아이템 기본값(min-height:auto)을 눌러서 부모가 준 높이보다 작게도 줄어들 수 있게
    // 한다(콘텐츠가 더 크면 그만큼 넘쳐서 조상의 overflow-y-auto가 스크롤 처리) — align-self:stretch
    // (flex 기본값)로 실제 높이는 부모 flex 행 높이를 그대로 받는다. content-between으로 헤더/눈금
    // 행은 위아래 끝에 붙이고 종목 행들 사이 간격만 넓혀서, 카테고리 수가 적어도 컨테이너 높이를 채운다.
    <div
      className="grid h-full min-h-0 w-full flex-1 content-between items-center gap-x-3 gap-y-2 text-[15px]"
      style={{ gridTemplateColumns: 'auto 1fr' }}
    >
      <span />
      <div className="whitespace-nowrap text-gray-400">{header ?? ' '}</div>
      {chart.rankedItems.map(item => (
        <Fragment key={item.categoryId}>
          <span className={`whitespace-nowrap text-right ${item.isReference ? 'font-bold text-yellow-500' : ''}`}>
            {item.categoryName}
          </span>
          {/* 퍼센트 텍스트를 막대 트랙(flex-1) 안에 막대 끝 위치(left: pct%)로 떠 있게 배치한다 —
              막대가 길어질수록 텍스트도 같이 따라간다. 오른쪽 w-[70px]는 막대가 축 최대치까지 길어져도
              텍스트가 열 밖으로 밀려나지 않도록 미리 비워두는 여백(눈금 행의 w-[70px]와 동일한 목적,
              15px 폰트 기준으로 폭을 넉넉히 잡음) — 보이는 내용은 없고 폭만 차지한다. */}
          <div className="flex h-[25px] items-center gap-1.5">
            <div className="relative h-full flex-1">
              <div
                className="h-full rounded-sm"
                style={{
                  width: `${(Math.abs(item.value) / chart.axisMax) * 100}%`,
                  backgroundColor: item.isReference ? MARKET_INDEX_BAR_COLOR : resolveMarketMapColor(item.value, colorScale),
                }}
              />
              <span
                className={`absolute top-0 flex h-full items-center pl-1.5 font-bold whitespace-nowrap ${signClass(item.value)}`}
                style={{ left: `${(Math.abs(item.value) / chart.axisMax) * 100}%` }}
              >
                {toChartValueLabel(item.value, unit)}
              </span>
            </div>
            <span className="w-[70px] shrink-0" />
          </div>
        </Fragment>
      ))}
      {/* 핀비즈처럼 하단에 이 그래프가 몇 퍼센트 구간인지 눈금으로 표시 — 막대 트랙(flex-1)과 같은
          폭이어야 눈금 위치가 막대 길이와 정확히 맞는다. */}
      <span />
      <div className="flex h-4 items-center gap-1.5">
        <div className="relative h-full flex-1 text-[10px] text-gray-500">
          {chart.axisTicks.map((tick, tickIndex) => (
            <span
              key={tick}
              className="absolute whitespace-nowrap"
              style={{
                left: `${(tick / chart.axisMax) * 100}%`,
                transform:
                  tickIndex === 0 ? 'none' : tickIndex === chart.axisTicks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
              }}
            >
              {toChartTickLabel(tick, unit)}
            </span>
          ))}
        </div>
        <span className="w-14 shrink-0" />
      </div>
    </div>
  )
}

export default function CategoryChangeRatePage() {
  const [market, setMarket] = usePersistedState<MarketQuery>('categoryChangeRate.market', 'KOSPI')
  const [beforeMinutes, setBeforeMinutes] = usePersistedState('categoryChangeRate.beforeMinutes', 30)
  const [searchParams, setSearchParams] = useSearchParams()

  // 렌더러가 /category-change-rate?market=KOSDAQ로 캡처 요청할 때 쓰는 진입점 — MarketMapCustomPage와
  // 동일한 패턴(초기 상태 반영 용도일 뿐 주소창엔 남길 필요 없어 반영 직후 지움).
  useEffect(() => {
    const param = searchParams.get('market')
    if (param !== 'KOSPI' && param !== 'KOSDAQ' && param !== 'ALL_STOCK') return
    setMarket(param)
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

  const {
    settingsModalProps,
    colorEditorPanelProps,
    avgChangeRateUseSimple,
    excludedMarketValueTiers,
    excludedCategoryIds,
    colorScale,
  } = useGlobalSettings()
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>('idle')
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()
  const captureRef = useRef<HTMLDivElement>(null)

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
      await captureElementToDownload(captureRef.current, 'category-change-rate.png')
    } catch {
      setDownloadStatus('error')
    } finally {
      setTimeout(() => setDownloadStatus('idle'), 2000)
    }
  }

  const copyLabel =
    copyStatus === 'copying' ? 'Copying' : copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Failed' : 'Copy'
  const downloadLabel = downloadStatus === 'error' ? 'Failed' : 'Download'

  const { data: rankingData, isLoading, isError } = useCategoryChangeRates(market, beforeMinutes)
  const { data: treeData, isLoading: isTreeLoading } = useMarketMap(market, true)

  const categoryNameById = useMemo(() => collectCategoryNames(treeData?.items ?? []), [treeData])
  // 뎁스 구분 없이 전부 나열하면 너무 많아서, 어드민 카테고리 관리 화면처럼 최상위 카테고리만 보여준다.
  // 설정 사이드바의 "제외 설정"(섹터 기준)에 걸린 카테고리는 지도 페이지와 동일하게 그래프에서도 뺀다.
  const rootCategoryIds = useMemo(
    () => new Set((treeData?.items ?? []).map(node => node.categoryId).filter(id => !excludedCategoryIds.has(id))),
    [treeData, excludedCategoryIds],
  )

  // 마켓별로 따로 그래프를 그리지 않고, 지도 페이지의 ALL STOCK와 동일하게 KOSPI/KOSDAQ을 하나로
  // 합쳐서 "현재"/"변화율" 그래프 각각 하나씩만 계산한다. KOSPI 종목과 KOSDAQ 종목은 겹치지 않으므로,
  // 같은 categoryId의 tierBreakdown(구간별 원시 합계) 배열을 마켓 간에 그냥 이어붙이면(concat) 그
  // 자체로 정확한 통합 합계가 된다 — 단일 마켓 조회는 기여자가 1개뿐이라 결과가 기존과 동일하다.
  const charts = useMemo(() => {
    // now/before는 구간별 원시 합계 리스트라, 지금 선택된(제외되지 않은) 구간만 골라 합산한 뒤
    // 마지막에 한 번만 나눈다 — 이미 나뉜 구간별 평균끼리 다시 평균내면 틀리기 때문.
    const resolveAvg = (breakdowns: CategoryTierBreakdown[]): number | null => {
      const combined = combineTierBreakdowns(breakdowns, excludedMarketValueTiers)
      return avgChangeRateUseSimple ? combined.simpleAvg : combined.weightedAvg
    }

    // beforeAvailable: 병합 대상 마켓 중 하나라도 before가 없으면(장 시작 직후 등) 그 카테고리는
    // "현재" 값만 있는 걸로 취급한다 — 반쪽짜리 before로 델타를 계산하면 실제보다 작아 보이는 값이
    // 나오므로, 있는 마켓만이라도 합치는 대신 델타 자체를 숨긴다(아래 deltaEntries의 null 필터에 걸림).
    const mergedByCategoryId = new Map<
      number,
      { categoryId: number; now: CategoryTierBreakdown[]; before: CategoryTierBreakdown[]; beforeAvailable: boolean }
    >()
    for (const marketRanking of rankingData?.items ?? []) {
      for (const item of marketRanking.items) {
        if (!rootCategoryIds.has(item.categoryId)) continue
        const entry =
          mergedByCategoryId.get(item.categoryId) ?? { categoryId: item.categoryId, now: [], before: [], beforeAvailable: true }
        entry.now.push(...item.now)
        if (item.before) entry.before.push(...item.before)
        else entry.beforeAvailable = false
        mergedByCategoryId.set(item.categoryId, entry)
      }
    }
    const rootItems = [...mergedByCategoryId.values()].map(entry => ({
      categoryId: entry.categoryId,
      now: entry.now,
      before: entry.beforeAvailable ? entry.before : null,
    }))

    const currentEntries = rootItems
      .map(item => {
        const value = resolveAvg(item.now)
        return value === null ? null : { categoryId: item.categoryId, value }
      })
      .filter((entry): entry is { categoryId: number; value: number } => entry !== null)

    // 지수 등락률은 "현재"(절대 등락률, %) 그래프에만 의미가 있다 — "변화율"(%p) 그래프는 N분 전
    // 대비 차이라 지수 쪽도 같은 기준의 과거값이 필요한데 지금은 그 값을 안 갖고 있어서 뺀다.
    // rankingData.items는 마켓별 랭킹 하나씩이라, market이 ALL_STOCK이면 어느 항목의 market도 'ALL_STOCK'과
    // 같지 않아 자연히 못 찾는다(지도 페이지가 ALL_STOCK일 때 지수를 안 보여주는 것과 동일한 동작) —
    // indexChangeRate는 랭킹과 정확히 같은 시각 기준이라 스냅샷 시점 어긋남이 없다.
    const indexRanking = rankingData?.items.find(item => item.market === market)
    const currentEntriesWithIndex =
      indexRanking?.indexChangeRate != null
        ? [
            ...currentEntries,
            {
              categoryId: MARKET_INDEX_CATEGORY_ID,
              value: indexRanking.indexChangeRate,
              categoryName: MARKET_INDEX_LABEL_KO[indexRanking.market],
              isReference: true,
            },
          ]
        : currentEntries

    const deltaEntries = rootItems
      .map(item => {
        const value = resolveAvg(item.now)
        const beforeValue = item.before ? resolveAvg(item.before) : null
        if (value === null || beforeValue === null) return null
        return { categoryId: item.categoryId, value: value - beforeValue }
      })
      .filter((entry): entry is { categoryId: number; value: number } => entry !== null)

    return {
      current: buildRankChart(currentEntriesWithIndex, categoryNameById),
      delta: buildRankChart(deltaEntries, categoryNameById),
    }
  }, [rankingData, avgChangeRateUseSimple, categoryNameById, rootCategoryIds, excludedMarketValueTiers, market])

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
        {/* 설정 사이드바가 열려있으면 공유 캡처에도 같이 포함되도록, captureRef를 세 번째 바(고정) +
            본문/사이드바(밀리는 영역) 전체를 감싸는 바깥 wrapper로 둔다 — 지도/요약 페이지와 동일한 구조.
            바(bar3)는 다른 페이지처럼 여백 없이 붙어야 해서, p-4는 바 바깥이 아니라 아래 실제 차트
            콘텐츠에만 준다(사이드바는 그대로 가장자리에 붙게). */}
        <div
          ref={captureRef}
          data-captureid={CAPTURE_ID.CATEGORY_CHANGE_RATE}
          data-capture-ready={!isLoading && !isTreeLoading}
          className="flex min-h-0 flex-1 flex-col overflow-hidden bg-black text-white"
        >
          <div className="flex h-7 w-full shrink-0 items-center justify-between bg-black/70 pl-1 pr-3 text-sm font-bold text-white">
            <div className="flex items-center whitespace-nowrap">
              <span className={FONT_BAR_TITLE}>{MARKET_LABEL[market]} Sector</span>
            </div>
            {rankingData?.snapshotTime && (
              <span className={`${FONT_BAR_TIME} whitespace-nowrap text-gray-400`}>
                {toMarketMapSnapshotTimeLabel(rankingData.snapshotTime)}
              </span>
            )}
          </div>
          {/* 지도/어드민 페이지와 동일하게 본문이 화면을 꽉 채우는 형태 — 가운데 정렬/폭 제한을 없애서
              설정 사이드바가 열려도 본문이 밀리는 게 자연스럽게 느껴지도록 한다(밀림 자체는 다른
              페이지와 동일한 flex 구조이고, 콘텐츠가 항상 남는 공간을 꽉 채우기만 하면 된다). */}
          <div className="flex min-h-0 flex-1">
            <div className="flex min-h-0 w-full flex-1 flex-col p-4">
              {isLoading ? (
                <div className="flex flex-1 items-center justify-center">
                  <Spinner />
                </div>
              ) : isError ? (
                <div className="p-8 text-center text-xs text-gray-500">데이터를 불러오지 못했습니다</div>
              ) : charts.current.rankedItems.length === 0 && charts.delta.rankedItems.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-500">데이터가 없습니다</div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                  {/* 현재 그래프(왼쪽)/변화율 그래프(오른쪽)를 나란히 배치. "시가총액 가중/동일 가중 등락률"·
                      "N분 전 대비" 캡션은 각각 RankBars의 header로 넘겨서, 그래프(막대 트랙) 시작 위치와
                      캡션 시작 위치가 라벨 폭과 무관하게 항상 맞도록 한다. 바깥을 flex-col + min-h-0로
                      만들어 RankBars(그리드)가 실제 남는 높이를 그대로 받게 하고, RankBars 안에서
                      content-between으로 행 사이 여백을 균등 분배해 컨테이너 높이를 꽉 채운다(카테고리
                      수가 많아 다 못 채우면 자연스럽게 스크롤). px-[10%]로 좌우 바깥쪽에 폭 기준 10%씩
                      여백을 둬서 막대가 화면 양 끝까지 닿지 않게 한다. */}
                  <div className="flex min-h-0 flex-1 gap-x-8 px-[10%]">
                    <RankBars
                      chart={charts.current}
                      colorScale={colorScale}
                      header={avgChangeRateLabel(avgChangeRateUseSimple)}
                    />
                    <RankBars
                      chart={charts.delta}
                      unit="%p"
                      colorScale={colorScale}
                      header={
                        // "N분 전 대비" 바로가기(15/30/60분)를 그 줄 바로 위, 같은 왼쪽 기준선에 두려고
                        // flex-col + items-start로 감싼다 — 별도 줄로 빼서 좌표를 따로 맞추는 대신, 같은
                        // 열(header 셀) 안에 쌓으면 왼쪽 정렬이 항상 자동으로 맞는다.
                        <div className="flex flex-col items-start gap-1">
                          <div className="flex items-center gap-3" role="radiogroup" aria-label="N분 전 대비 바로가기">
                            {BEFORE_MINUTES_PRESETS.map(minutes => (
                              <button
                                key={minutes}
                                type="button"
                                role="radio"
                                aria-checked={beforeMinutes === minutes}
                                onClick={() => setBeforeMinutes(minutes)}
                                className="inline-flex items-center gap-1 border-0 bg-transparent text-[11px] text-gray-400 outline-none hover:text-white"
                              >
                                {/* 커스텀 모드 점등 표시(SubNavBar)와 동일한 초록 발광 스타일 — 선택 상태를
                                    "불이 들어온다"는 느낌으로 통일한다. */}
                                <span
                                  className={`h-2.5 w-2.5 rounded-full border ${
                                    beforeMinutes === minutes
                                      ? 'border-green-500 bg-green-500 shadow-[0_0_4px_1px_rgba(34,197,94,0.7)]'
                                      : 'border-gray-500'
                                  }`}
                                />
                                {minutes}분
                              </button>
                            ))}
                          </div>
                          <span className="inline-flex items-center gap-1">
                            {/* 데이터가 5분 간격으로만 존재해서(CollectionScheduler) 5의 배수가 아닌 값은
                                애초에 조회가 불가능하다 — validate로 커밋 자체를 막아서 화면에서 미리 걸러낸다. */}
                            <NumberStepperInput
                              value={beforeMinutes}
                              onCommit={setBeforeMinutes}
                              min={MIN_BEFORE_MINUTES}
                              step={5}
                              validate={v => (v % 5 === 0 ? v : null)}
                              className="w-9 rounded border border-transparent bg-transparent px-0.5 py-0.5 text-right text-gray-400 focus:border-gray-500 focus:bg-white focus:text-black focus:outline-none"
                            />
                            분 전 대비
                          </span>
                        </div>
                      }
                    />
                  </div>
                </div>
              )}
            </div>
            {/* 지도 페이지 옵션 대부분을 그대로 재사용 중 — 실제로 섹터 화면에 유효한 항목만 남기는
                정리는 나중에 검토해서 진행한다. */}
            <SettingsSidebar {...settingsModalProps} pageLabel="섹터">
              <SettingsCustomModeSection {...settingsModalProps} />
              <SettingsEqualWeightSection {...settingsModalProps} />
              <SettingsDisplayRangeSection {...settingsModalProps} />
              <SettingsExcludeSection {...settingsModalProps} />
              <SettingsColorSection {...settingsModalProps} />
            </SettingsSidebar>
          </div>
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
