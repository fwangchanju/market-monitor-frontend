import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import NavBar from '@/components/NavBar'
import SubNavBar from '@/components/SubNavBar'
import MarketMapColorThresholdEditorPanel from '@/components/MarketMapColorThresholdEditorPanel'
import SettingsSidebar, {
  SettingsCustomModeSection,
  SettingsEqualWeightSection,
  SettingsCategoryLevelSection,
  SettingsMarketValueSection,
  SettingsExcludeSection,
  SettingsColorSection,
} from '@/components/SettingsSidebar'
import MarketMapShareModal from '@/components/MarketMapShareModal'
import Spinner from '@/components/Spinner'
import { useCategoryChangeRates } from '@/hooks/useCategoryChangeRates'
import { useGlobalSettings } from '@/hooks/useGlobalSettings'
import { usePersistedState } from '@/hooks/usePersistedState'
import { categoryHeaderFontSize } from '@/hooks/useMarketMapLayout'
import { combineTierBreakdowns } from '@/utils/categoryTierBreakdown'
import { CAPTURE_ID } from '@/utils/captureIds'
import NavBarPageActions from '@/components/NavBarPageActions'
import { FONT_BAR_TITLE, FONT_BAR_TIME, FONT_BAR_MODE_STATUS } from '@/components/FontStyle'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { captureElementToClipboard } from '@/utils/captureToClipboard'
import { captureElementToDownload } from '@/utils/captureToDownload'
import { toMarketMapSnapshotDateLabel, toMarketMapSnapshotTimeOnlyLabel, avgChangeRateLabel } from '@/utils/format'
import {
  resolveMarketMapColor,
  resolveMarketMapExtremeColor,
  MARKET_INDEX_REFERENCE_COLOR,
  type ColorScaleConfig,
} from '@/utils/marketMapColorScale'
import type { CategoryTierBreakdown, Market, MarketQuery } from '@/types/api'
import { marketFromRouteSegment } from '@/utils/marketRoute'

type CopyStatus = 'idle' | 'copying' | 'copied' | 'error'
type DownloadStatus = 'idle' | 'downloading' | 'error'

const BEFORE_MINUTES_PRESETS = [15, 30, 60]

// 지도 페이지(MarketMapCustomPage)와 동일한 마켓 라벨 표기.
const MARKET_LABEL: Record<MarketQuery, string> = { KOSPI: 'KOSPI', KOSDAQ: 'KOSDAQ', ALL_STOCK: 'ALL STOCK' }
// 지수 등락률 참조 막대에 붙는 한글 라벨 — ALL_STOCK은 단일 지수가 없어 대상에서 제외된다.
const MARKET_INDEX_LABEL_KO: Record<Market, string> = { KOSPI: '코스피', KOSDAQ: '코스닥' }
// 실제 카테고리 id(양수)와 겹치지 않는 음수 sentinel — 지수 참조 막대 전용 categoryId(React key로도 씀).
const MARKET_INDEX_CATEGORY_ID = -1
// 지도 페이지에서 최상위 뎁스 카테고리를 노란 글자로 표시하는 것과 같은 "기준" 색상 — 참조 막대도 동일하게 맞춘다.
const MARKET_INDEX_BAR_COLOR = MARKET_INDEX_REFERENCE_COLOR

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
  // 핀비즈처럼 축 눈금이 딱 떨어지게, 0.5%p 단위로 올림한 값을 막대 스케일에 쓴다.
  const axisMax = Math.ceil(rawMaxAbsValue * 2) / 2

  return { rankedItems, axisMax }
}

// "현재" 그래프는 실제 등락률(%)이지만 "변화율" 그래프는 두 시점의 %끼리 뺀 차이(%p)라 단위가
// 다르다 — 호출부가 unit을 넘겨서 값 표기에만 반영하고, 그 외 포맷(부호/소수점)은 동일하게 맞춘다.
function toChartValueLabel(value: number, unit: string): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}${unit}`
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
  return (
    // min-h-0: flex 아이템 기본값(min-height:auto)을 눌러서 부모가 준 높이보다 작게도 줄어들 수 있게
    // 한다(콘텐츠가 더 크면 그만큼 넘쳐서 조상의 overflow-y-auto가 스크롤 처리) — align-self:stretch
    // (flex 기본값)로 실제 높이는 부모 flex 행 높이를 그대로 받는다. content-between으로 헤더 행은
    // 맨 위에 붙이고 종목 행들 사이 간격만 넓혀서, 카테고리 수가 적어도 컨테이너 높이를 채운다.
    <div
      className="grid h-full min-h-0 w-full flex-1 content-between items-center gap-x-3 gap-y-2 text-[15px] tabular-nums"
      style={{ gridTemplateColumns: 'auto 1fr' }}
    >
      <span />
      {/* "현재"/"변화율" 헤더 둘 다 한 줄이라(라디오 줄 뒤에 "전 대비"만 붙이고 입력 줄은 없앰),
          별도 최소 높이 없이도 두 그래프의 첫 막대 행이 같은 위치에서 시작한다. 지도 페이지
          대분류 카테고리 헤더와 같은 폰트 크기(categoryHeaderFontSize(0) === 15px)·색상
          (MARKET_INDEX_REFERENCE_COLOR)을 그대로 써서 두 페이지의 헤더 텍스트를 맞춘다. */}
      <div
        className="flex items-center whitespace-nowrap"
        style={{ fontSize: categoryHeaderFontSize(0), color: MARKET_INDEX_REFERENCE_COLOR }}
      >
        {header ?? ' '}
      </div>
      {/* before 데이터가 없어 rankedItems가 비어도 위 헤더(15/30/60분 라디오 등)는 계속 조작할 수
          있어야 하므로, 빈 상태는 헤더를 감춘 채로 그리지 않고 막대 자리에만 안내 문구를 넣는다. */}
      {chart.rankedItems.length === 0 && (
        <>
          <span />
          <div className="p-8 text-center text-xs text-gray-500">데이터가 없습니다</div>
        </>
      )}
      {chart.rankedItems.map(item => (
        <Fragment key={item.categoryId}>
          <span
            className={`whitespace-nowrap text-right ${item.isReference ? 'font-bold' : ''}`}
            style={item.isReference ? { color: MARKET_INDEX_REFERENCE_COLOR } : undefined}
          >
            {item.categoryName}
          </span>
          {/* 퍼센트 텍스트를 막대 트랙(flex-1) 안에 막대 끝 위치(left: pct%)로 떠 있게 배치한다 —
              막대가 길어질수록 텍스트도 같이 따라간다. 오른쪽 w-[70px]는 막대가 축 최대치까지 길어져도
              텍스트가 열 밖으로 밀려나지 않도록 미리 비워두는 여백(15px 폰트 기준으로 폭을 넉넉히 잡음)
              — 보이는 내용은 없고 폭만 차지한다. */}
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
                className="absolute top-0 flex h-full items-center pl-1.5 font-bold whitespace-nowrap"
                style={{
                  left: `${(Math.abs(item.value) / chart.axisMax) * 100}%`,
                  color: resolveMarketMapExtremeColor(item.value, colorScale),
                }}
              >
                {toChartValueLabel(item.value, unit)}
              </span>
            </div>
            <span className="w-[70px] shrink-0" />
          </div>
        </Fragment>
      ))}
    </div>
  )
}

export default function CategoryChangeRatePage() {
  const [market, setMarket] = usePersistedState<MarketQuery>('categoryChangeRate.market', 'KOSPI')
  const [beforeMinutes, setBeforeMinutes] = usePersistedState('categoryChangeRate.beforeMinutes', 15)
  const [searchParams, setSearchParams] = useSearchParams()
  const { pathname } = useLocation()
  const routeMarket = marketFromRouteSegment(pathname.split('/')[2])

  const {
    settingsModalProps,
    colorEditorPanelProps,
    avgChangeRateUseSimple,
    onChangeAvgChangeRateUseSimple,
    onChangeSectorFilterEnabled,
    excludedMarketValueTiers,
    excludedCategoryIds,
    colorScale,
  } = useGlobalSettings()

  // 렌더러가 /sector/kosdaq?beforeMinutes=15&avgMode=simple&sectorFilter=true로
  // 캡처 요청할 때 쓰는 진입점 — MarketMapCustomPage와 동일한 패턴(초기 상태 반영 용도일 뿐 주소창엔
  // 남길 필요 없어 반영 직후 지움). 네 파라미터는 서로 독립적으로 판정한다 — 하나가 없거나 잘못됐다고
  // 다른 것까지 무시하면 안 된다. 실제로 소비한(유효했던) 파라미터만 주소에서 지운다.
  useEffect(() => {
    const marketParam = searchParams.get('market')
    const isValidMarket = marketParam === 'KOSPI' || marketParam === 'KOSDAQ' || marketParam === 'ALL_STOCK'
    const nextMarket = isValidMarket ? marketParam : routeMarket
    if (nextMarket && nextMarket !== market) setMarket(nextMarket)

    // 양의 정수가 아니면 무시하고 기존 값을 쓴다. 데이터가 5분 간격으로만 존재해서(수집 주기) 5의
    // 배수가 아닌 값은 애초에 조회가 불가능하다 — 여기서도 같은 조건으로 걸러낸다.
    const beforeMinutesParam = searchParams.get('beforeMinutes')
    const parsedBeforeMinutes = beforeMinutesParam === null ? NaN : Number(beforeMinutesParam)
    const isValidBeforeMinutes = Number.isInteger(parsedBeforeMinutes) && parsedBeforeMinutes > 0 && parsedBeforeMinutes % 5 === 0
    if (isValidBeforeMinutes) setBeforeMinutes(parsedBeforeMinutes)

    // 백엔드가 캡처 URL에 싣는 avgMode=simple|weighted, sectorFilter=true|false 계약에 맞춘다
    // (market-monitor-backend의 instructions-telegram-average-mode.md 결정 6).
    const avgModeParam = searchParams.get('avgMode')
    const isValidAvgMode = avgModeParam === 'simple' || avgModeParam === 'weighted'
    if (isValidAvgMode) onChangeAvgChangeRateUseSimple(avgModeParam === 'simple')

    const sectorFilterParam = searchParams.get('sectorFilter')
    const isValidSectorFilter = sectorFilterParam === 'true' || sectorFilterParam === 'false'
    if (isValidSectorFilter) onChangeSectorFilterEnabled(sectorFilterParam === 'true')

    if (!isValidMarket && !isValidBeforeMinutes && !isValidAvgMode && !isValidSectorFilter) return
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev)
        if (isValidMarket) next.delete('market')
        if (isValidBeforeMinutes) next.delete('beforeMinutes')
        if (isValidAvgMode) next.delete('avgMode')
        if (isValidSectorFilter) next.delete('sectorFilter')
        return next
      },
      { replace: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 파라미터가 있을 때만 반응하면 됨
  }, [market, routeMarket, searchParams])
  // 지도 페이지 상단 바와 동일한 위치/스타일의 커스텀 모드 점등 표시 — 켜짐/꺼짐 상태만 보여준다.
  const modeStatusText = (
    <>
      <span
        className={`mr-1.5 inline-block h-2 w-2 rounded-full ${
          settingsModalProps.isCustom ? 'bg-green-500 shadow-[0_0_4px_1px_rgba(34,197,94,0.7)]' : 'bg-gray-400'
        }`}
      />
      <span className="text-sm text-gray-400">커스텀 모드</span>
    </>
  )

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

  const { data: rankingData, isLoading, isError, isRefetching: isRefetchingRankingData, refetch: refetchRankingData } = useCategoryChangeRates(
    market,
    beforeMinutes,
  )

  // 카테고리 이름을 랭킹 응답에서 직접 얻는다 — 이전에는 useMarketMap으로 트리를 별도 조회해서 얻었지만,
  // 응답에 categoryName이 실리면서 더 이상 필요 없다(depth == 0과 hasNoParent()가 동치라는 근거는
  // 백엔드 work-plan 참고, 별도 확인 절차는 두지 않는다).
  const categoryNameById = useMemo(() => {
    const map = new Map<number, string>()
    for (const marketRanking of rankingData?.items ?? []) {
      for (const item of marketRanking.items) {
        map.set(item.categoryId, item.categoryName)
      }
    }
    return map
  }, [rankingData])

  // 뎁스 구분 없이 전부 나열하면 너무 많아서, 어드민 카테고리 관리 화면처럼 최상위(depth 0) 카테고리만
  // 보여준다. 마지막 줄이 그 필터 — 설정 사이드바의 "제외 설정"(섹터 기준)에 걸린 카테고리는 지도
  // 페이지와 동일하게 여기서 그래프 대상에서도 뺀다.
  const rootCategoryIds = useMemo(() => {
    const ids = new Set<number>()
    for (const marketRanking of rankingData?.items ?? []) {
      for (const item of marketRanking.items) {
        if (item.depth === 0) ids.add(item.categoryId)
      }
    }
    for (const excludedId of excludedCategoryIds) ids.delete(excludedId)
    return ids
  }, [rankingData, excludedCategoryIds])

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

    // rankingData.items는 마켓별 랭킹 하나씩이라, market이 ALL_STOCK이면 어느 항목의 market도 'ALL_STOCK'과
    // 같지 않아 자연히 못 찾는다(지도 페이지가 ALL_STOCK일 때 지수를 안 보여주는 것과 동일한 동작) —
    // index는 랭킹과 정확히 같은 시각 기준이라 스냅샷 시점 어긋남이 없다.
    const indexRanking = rankingData?.items.find(item => item.market === market)
    // categoryName까지 여기서 같이 확정해서 두 호출부가 indexRanking을 직접 참조하지 않게 한다.
    const indexBar =
      indexRanking?.index == null
        ? null
        : { ...indexRanking.index, categoryName: MARKET_INDEX_LABEL_KO[indexRanking.market] }

    const currentEntriesWithIndex =
      indexBar != null
        ? [
            ...currentEntries,
            {
              categoryId: MARKET_INDEX_CATEGORY_ID,
              value: indexBar.now,
              categoryName: indexBar.categoryName,
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

    const deltaEntriesWithIndex =
      indexBar?.before != null
        ? [
            ...deltaEntries,
            {
              categoryId: MARKET_INDEX_CATEGORY_ID,
              value: indexBar.now - indexBar.before,
              categoryName: indexBar.categoryName,
              isReference: true,
            },
          ]
        : deltaEntries

    return {
      current: buildRankChart(currentEntriesWithIndex, categoryNameById),
      delta: buildRankChart(deltaEntriesWithIndex, categoryNameById),
    }
  }, [rankingData, avgChangeRateUseSimple, categoryNameById, rootCategoryIds, excludedMarketValueTiers, market])

  return (
    <div className="flex h-screen select-none flex-col overflow-hidden">
      <NavBar />
      <SubNavBar
        actions={
          <NavBarPageActions
            onRefresh={refetchRankingData}
            isRefreshing={isRefetchingRankingData}
            onToggleSettings={() => settingsModalProps.onOpenChange(!settingsModalProps.isOpen)}
            isSettingsOpen={settingsModalProps.isOpen}
            onOpenShare={() => setIsShareOpen(true)}
            isNativeFullscreen={isNativeFullscreen}
            onToggleFullscreen={handleToggleNativeFullscreen}
            showSnapshotControls={Boolean(rankingData?.snapshotTime)}
          />
        }
      />
      <div className="flex min-h-0 flex-1">
        {colorEditorPanelProps && (
          <div className="w-56 shrink-0 overflow-y-auto bg-[var(--surface)]">
            <MarketMapColorThresholdEditorPanel {...colorEditorPanelProps} />
          </div>
        )}
        {/* 설정 사이드바가 열려있으면 공유 캡처에도 같이 포함되도록, captureRef를 [세 번째 바+본문] 열 +
            사이드바를 감싸는 바깥 wrapper로 둔다 — 지도/요약 페이지와 동일한 구조. 사이드바가 열리면
            세 번째 바(마켓명/커스텀 모드/시간)까지 같이 밀려서 좁아진다(본문만 밀리지 않는다). */}
        <div
          ref={captureRef}
          data-captureid={CAPTURE_ID.CATEGORY_CHANGE_RATE}
          data-capture-ready={!isLoading}
          className="flex min-h-0 flex-1 overflow-hidden bg-black text-white"
        >
          {/* min-w-0: 이 컬럼의 자동 최소 폭을 0으로 눌러서(overflow: visible이면 내부 콘텐츠의
              min-content 폭을 그대로 강제해서 사이드바 쪽을 밀어냄) 창을 좁혀도 사이드바(w-80)가
              항상 같은 폭을 유지하게 한다(지도 페이지와 동일) — 내부 그래프가 넘치면 이 컬럼
              안에서만 처리된다. */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="relative flex h-7 w-full shrink-0 items-center justify-between bg-black/70 pl-1 pr-3 text-sm font-bold text-white">
              <div className="flex items-center whitespace-nowrap">
                <span className={FONT_BAR_TITLE}>{MARKET_LABEL[market]}</span>
              </div>
              {/* 지도 페이지와 동일하게 바 전체 폭 기준 절대 중앙에 고정 — 좌/우 칸 폭에 영향받지 않는다. */}
              <span
                className={`${FONT_BAR_MODE_STATUS} absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-gray-400`}
              >
                {modeStatusText}
              </span>
              {rankingData?.snapshotTime && (
                <span className={`${FONT_BAR_TIME} flex items-center gap-1.5 whitespace-nowrap text-gray-400`}>
                  <span>{toMarketMapSnapshotDateLabel(rankingData.snapshotTime)}</span>
                  <span>{toMarketMapSnapshotTimeOnlyLabel(rankingData.snapshotTime)}</span>
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
                        // "15/30/60분 전 대비"를 한 줄로 — 라디오 버튼들 뒤에 "전 대비" 고정 텍스트만 붙인다.
                        <div className="flex items-center gap-3" role="radiogroup" aria-label="N분 전 대비 바로가기">
                          {BEFORE_MINUTES_PRESETS.map(minutes => (
                            <button
                              key={minutes}
                              type="button"
                              role="radio"
                              aria-checked={beforeMinutes === minutes}
                              onClick={() => setBeforeMinutes(minutes)}
                              // button은 nes.css 리셋에 color: inherit이 없어 부모 색을 상속받지 못하고
                              // 브라우저 기본값(검정)으로 떨어진다 — 명시적으로 다시 지정해야 한다.
                              style={{ color: MARKET_INDEX_REFERENCE_COLOR }}
                              className="inline-flex items-center gap-1 border-0 bg-transparent outline-none hover:brightness-125"
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
                          <span>전 대비</span>
                        </div>
                      }
                    />
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>
          {/* 지도 페이지 옵션 대부분을 그대로 재사용 중 — 실제로 섹터 화면에 유효한 항목만 남기는
              정리는 나중에 검토해서 진행한다. */}
          <SettingsSidebar {...settingsModalProps} pageLabel="섹터">
            <SettingsCustomModeSection {...settingsModalProps} />
            <SettingsEqualWeightSection {...settingsModalProps} />
            <SettingsCategoryLevelSection {...settingsModalProps} showDivider={false} />
            <SettingsMarketValueSection {...settingsModalProps} />
            <SettingsExcludeSection {...settingsModalProps} />
            <SettingsColorSection {...settingsModalProps} />
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
