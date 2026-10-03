import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import NavBar from '@/components/NavBar'
import SubNavBar from '@/components/SubNavBar'
import { MarketMapMarketCombobox, MarketMapPeriodCombobox } from '@/components/MarketMapControls'
import SettingsSidebar, { SettingsAverageModeSection, SettingsBeforeMinutesSection } from '@/components/SettingsSidebar'
import MarketMapShareModal from '@/components/MarketMapShareModal'
import Spinner from '@/components/Spinner'
import DisclaimerNotice from '@/components/DisclaimerNotice'
import ProfileAvatar from '@/components/ProfileAvatar'
import { useSectorMarketMapPair } from '@/hooks/useSectorMarketMapPair'
import { useGlobalSettings } from '@/hooks/useGlobalSettings'
import { usePersistedState } from '@/hooks/usePersistedState'
import { useSettingsSidebarSide } from '@/hooks/useSettingsSidebarSide'
import { computeSectorAverage } from '@/utils/sectorAverage'
import { CAPTURE_ID } from '@/utils/captureIds'
import NavBarPageActions, { PageRefreshButton, SNAPSHOT_REFRESH_HELP } from '@/components/NavBarPageActions'
import { FONT_BAR_TIME, FONT_BAR_MODE_STATUS } from '@/components/FontStyle'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { captureElementToClipboard } from '@/utils/captureToClipboard'
import { captureElementToDownload } from '@/utils/captureToDownload'
import { toMarketMapSnapshotDateLabel, toMarketMapSnapshotTimeOnlyLabel, avgChangeRateLabel } from '@/utils/format'
import { marketRoute } from '@/utils/marketRoute'
import {
  resolveMarketMapColor,
  resolveMarketMapExtremeColor,
  type ColorScaleConfig,
} from '@/utils/marketMapColorScale'
import type { Market, MarketMapSectorNode } from '@/types/api'

type CopyStatus = 'idle' | 'copying' | 'copied' | 'error'
type DownloadStatus = 'idle' | 'downloading' | 'error'


// 지수 등락률 참조 막대에 붙는 한글 라벨 — ALL_STOCK은 단일 지수가 없어 대상에서 제외된다.
const MARKET_INDEX_LABEL_KO: Record<Market, string> = { KOSPI: '코스피', KOSDAQ: '코스닥' }
// 지수 참조 막대 전용 React key — 섹터 이름(예: '코스피'라는 섹터가 실제로 있을 수 있다)과
// 겹치지 않도록 일반 섹터 key(sectorKey)와 다른 접두사를 쓴다.
const MARKET_INDEX_KEY = 'market-index'
function sectorKey(sectorName: string): string {
  return `sector:${sectorName}`
}

interface RankedItem {
  key: string
  sectorName: string
  value: number
  // 지수 등락률 참조 막대 표시용 — 일반 섹터 막대와 색을 다르게 칠하는 데만 쓴다.
  isReference?: boolean
}

interface RankChart {
  rankedItems: RankedItem[]
  axisMax: number
}

// (key, 값) 목록을 값 내림차순 랭킹 막대그래프 데이터로 변환한다 — "현재" 그래프/"변화율" 그래프 둘
// 다 이 함수로 각각 독립적으로 정렬·스케일을 만든다(같은 포맷, 정렬 기준값만 다름).
function buildRankChart(entries: RankedItem[]): RankChart {
  const rankedItems = [...entries].sort((a, b) => b.value - a.value)

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
  highlightColor,
  unit = '%',
  colorScale,
}: {
  chart: RankChart
  // 헤더 글자/기준 업종 이름·막대에 쓰는 강조 색 — 지도 설정의 "강조 색상"(strongIndustryColor) 그대로.
  highlightColor: string
  unit?: string
  // 지도 페이지 트리맵 박스와 동일한 등락률 컬러 스케일(설정 사이드바의 "색상 설정") — 막대 색도
  // 고정된 상승/하락 2색 대신 이 스케일로 칠한다.
  colorScale: ColorScaleConfig
}) {
  return (
    // min-h-0: flex 아이템 기본값(min-height:auto)을 눌러서 부모가 준 높이보다 작게도 줄어들 수 있게
    // 한다(콘텐츠가 더 크면 그만큼 넘쳐서 조상의 overflow-y-auto가 스크롤 처리) — align-self:stretch
    // (flex 기본값)로 실제 높이는 부모 flex 행 높이를 그대로 받는다. content-between으로 헤더 행은
    // 맨 위에 붙이고 종목 행들 사이 간격만 넓혀서, 섹터 수가 적어도 컨테이너 높이를 채운다.
    <div
      className="grid h-full min-h-0 w-full flex-1 content-between items-center gap-x-3 gap-y-2 text-[18px]"
      style={{ gridTemplateColumns: 'auto 1fr' }}
    >
      {/* 데이터가 비어도 헤더(페이지의 별도 헤더 줄)는 그대로 보이므로, 막대 자리에만 안내 문구를 넣는다. */}
      {chart.rankedItems.length === 0 && (
        <>
          <span />
          <div className="p-8 text-center text-xs text-gray-500">데이터가 없습니다</div>
        </>
      )}
      {chart.rankedItems.map(item => (
        <Fragment key={item.key}>
          <span
            className="whitespace-nowrap text-right font-bold"
            style={item.isReference ? { color: highlightColor } : undefined}
          >
            {item.sectorName}
          </span>
          {/* 퍼센트 텍스트를 막대 트랙(flex-1) 안에 막대 끝 위치(left: pct%)로 떠 있게 배치한다 —
              막대가 길어질수록 텍스트도 같이 따라간다. 오른쪽 w-[84px]는 막대가 축 최대치까지 길어져도
              텍스트가 열 밖으로 밀려나지 않도록 미리 비워두는 여백(18px 폰트 기준으로 폭을 넉넉히 잡음)
              — 보이는 내용은 없고 폭만 차지한다. */}
          <div className="flex h-[25px] items-center gap-1.5">
            <div className="relative h-full flex-1">
              <div
                className="h-full rounded-sm"
                style={{
                  width: `${(Math.abs(item.value) / chart.axisMax) * 100}%`,
                  backgroundColor: item.isReference ? highlightColor : resolveMarketMapColor(item.value, colorScale),
                }}
              />
              <span
                className="absolute top-0 flex h-full items-center pl-1.5 whitespace-nowrap"
                style={{
                  left: `${(Math.abs(item.value) / chart.axisMax) * 100}%`,
                  color: resolveMarketMapExtremeColor(item.value, colorScale),
                }}
              >
                {toChartValueLabel(item.value, unit)}
              </span>
            </div>
            <span className="w-[84px] shrink-0" />
          </div>
        </Fragment>
      ))}
    </div>
  )
}

export default function SectorChangeRatePage() {
  const navigate = useNavigate()
  const [beforeMinutes, setBeforeMinutes] = usePersistedState('sectorChangeRate.beforeMinutes', 15)
  const [searchParams, setSearchParams] = useSearchParams()

  const {
    settingsModalProps,
    strongIndustryColor,
    avgChangeRateUseSimple,
    onChangeAvgChangeRateUseSimple,
    market,
    isCustom,
    nxtOnly,
    data,
    isLoading,
    isError,
    isMarketMapSuccess,
    isMarketValueTierRangeReady,
    isRefetchingMarketMap,
    refetchMarketMap,
    onChangeSectorFilterEnabled,
    excludedMarketValueTiers,
    excludedSectorIds,
    colorScale,
  } = useGlobalSettings()

  // now는 여기서 따로 조회하지 않는다 — useGlobalSettings()가 이미 부르는 useMarketMap(market, isCustom)
  // 결과(data)를 그대로 쓴다. before는 그 now.snapshotTime에서 계산한 시각을 쌍으로 묶어 조회한다
  // (market-monitor-backend 지시서 결정 4) — 이렇게 해야 재조회로 now가 새 tick으로 바뀌는 순간에도
  // 화면이 새 now·옛 before를 잠깐이라도 섞어 그리지 않는다.
  const pairQuery = useSectorMarketMapPair(market, isCustom, nxtOnly, beforeMinutes, data)
  // 쌍 쿼리가 에러(재시도 1회 뒤)면 "before 없음"으로 보고 now 쿼리의 현재 data로 그린다. 그 외에는
  // 화면에 그리는 now가 항상 "쌍 안의 now"다 — placeholder 기간에도 그 쌍이 만들어질 때의 now·before가
  // 함께 유지되어, 상단 바 시각과 그래프가 서로 어긋나지 않는다.
  const displayNow = pairQuery.data?.now ?? (pairQuery.isError ? data : undefined)
  const displayBefore = pairQuery.data?.before ?? null
  const isPairSettled = pairQuery.isSuccess || pairQuery.isError
  // data-capture-ready(결정 4) — now가 성공했고 비어 있으면(그 시각 데이터가 아예 없음) 그대로
  // "데이터가 없습니다" 화면을 캡처한다. 그 외에는 쌍 쿼리까지 끝나 있고(성공 또는 에러), placeholder가
  // 아니고, 시가총액 구간 설정이 준비된 뒤에야 캡처를 허용한다 — now 에러는 항상 false다.
  const isDataCaptureReady =
    isMarketMapSuccess &&
    (data?.snapshotTime == null ||
      (isPairSettled && !pairQuery.isPlaceholderData && isMarketValueTierRangeReady))
  const isRefreshing = isRefetchingMarketMap || pairQuery.isFetching

  // 렌더러가 /sector/kosdaq?beforeMinutes=15&avgMode=simple&sectorFilter=true로
  // 캡처 요청할 때 쓰는 진입점 — MarketMapCustomPage와 동일한 패턴(초기 상태 반영 용도일 뿐 주소창엔
  // 남길 필요 없어 반영 직후 지움). market은 useGlobalSettings()가 내부에서 이미 우선 반영했으므로
  // 여기서는 나머지 세 파라미터만 다룬다. 셋은 서로 독립적으로 판정한다 — 하나가 없거나 잘못됐다고
  // 다른 것까지 무시하면 안 된다. 실제로 소비한(유효했던) 파라미터만 주소에서 지운다.
  useEffect(() => {
    // 양의 정수가 아니면 무시하고 기존 값을 쓴다. 데이터가 5분 간격으로만 존재해서(수집 주기) 5의
    // 배수가 아닌 값은 애초에 조회가 불가능하다 — 여기서도 같은 조건으로 걸러낸다.
    const beforeMinutesParam = searchParams.get('beforeMinutes')
    const parsedBeforeMinutes = beforeMinutesParam === null ? NaN : Number(beforeMinutesParam)
    const isValidBeforeMinutes = Number.isInteger(parsedBeforeMinutes) && parsedBeforeMinutes > 0 && parsedBeforeMinutes % 5 === 0
    if (isValidBeforeMinutes) setBeforeMinutes(parsedBeforeMinutes)

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
  }, [searchParams])
  // 지도 페이지 상단 바와 동일하게 점 대신 프로필 사진을 둔다. 24px 모서리가 둥근 사각형이다.
  const modeStatusText = (
    <span className="flex items-center">
      <ProfileAvatar className="mr-[7px] size-6 shrink-0 object-cover" />
      <span className="text-gray-400">{settingsModalProps.isCustom ? (nxtOnly ? 'MARKETRY · NXT' : 'MARKETRY') : nxtOnly ? 'NXT' : '거래소'}</span>
    </span>
  )

  const { isOnLeft: isSettingsOnLeft, toggleSide: toggleSettingsSide } = useSettingsSidebarSide()
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
      await captureElementToDownload(captureRef.current, 'sector-change-rate.png')
    } catch {
      setDownloadStatus('error')
    } finally {
      setTimeout(() => setDownloadStatus('idle'), 2000)
    }
  }

  const copyLabel =
    copyStatus === 'copying' ? 'Copying' : copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Failed' : 'Copy'
  const downloadLabel = downloadStatus === 'error' ? '다운로드 실패' : '다운로드'

  // 대상 섹터는 트리의 최상위 노드(response.items)다. 설정 사이드바의 "제외 설정"(섹터 기준)에
  // 걸린 섹터는 지도 페이지와 동일하게 여기서도 뺀다. now/before 짝은 sectorId가 아니라
  // sectorName으로 맞춘다 — 기본 모드 노드는 sectorId가 전부 0(NO_SECTOR_ID)이라 id로는 짝을
  // 맞출 수 없다(market-monitor-backend 지시서 결정 5). ALL_STOCK은 응답 하나가 이미 두 마켓을 합친
  // 트리라 마켓별로 따로 합칠 필요가 없다.
  const charts = useMemo(() => {
    if (!displayNow) return { current: buildRankChart([]), delta: buildRankChart([]) }

    const beforeByName = new Map<string, MarketMapSectorNode>(
      (displayBefore?.items ?? []).map(node => [node.sectorName, node]),
    )

    const currentEntries: RankedItem[] = []
    const deltaEntries: RankedItem[] = []

    for (const node of displayNow.items) {
      if (excludedSectorIds.has(node.sectorId)) continue

      const nowAverage = computeSectorAverage(node, excludedMarketValueTiers)
      const nowValue = avgChangeRateUseSimple ? nowAverage.simpleAvg : nowAverage.weightedAvg
      // 새 트리는 종목이 하나도 없는 최상위 섹터도 노드로 준다 — 그런 섹터는 평균이 null이라
      // 두 그래프 모두에서 뺀다(옛 /api/sector는 애초에 그런 섹터를 안 내려줬다).
      if (nowValue === null) continue
      currentEntries.push({ key: sectorKey(node.sectorName), sectorName: node.sectorName, value: nowValue })

      const beforeNode = beforeByName.get(node.sectorName)
      if (!beforeNode) continue
      const beforeAverage = computeSectorAverage(beforeNode, excludedMarketValueTiers)
      const beforeValue = avgChangeRateUseSimple ? beforeAverage.simpleAvg : beforeAverage.weightedAvg
      if (beforeValue === null) continue
      deltaEntries.push({
        key: sectorKey(node.sectorName),
        sectorName: node.sectorName,
        value: nowValue - beforeValue,
      })
    }

    // marketOverview는 단일 마켓 조회에만 온다(ALL_STOCK이면 단일 지수값이 없어 null) — 지도 페이지와
    // 동일하게 ALL_STOCK이면 지수 막대를 아예 안 보여준다.
    const nowOverview = displayNow.marketOverview
    if (nowOverview) {
      currentEntries.push({
        key: MARKET_INDEX_KEY,
        sectorName: MARKET_INDEX_LABEL_KO[nowOverview.market],
        value: nowOverview.changeRate,
        isReference: true,
      })
      const beforeOverview = displayBefore?.marketOverview ?? null
      if (beforeOverview) {
        deltaEntries.push({
          key: MARKET_INDEX_KEY,
          sectorName: MARKET_INDEX_LABEL_KO[nowOverview.market],
          value: nowOverview.changeRate - beforeOverview.changeRate,
          isReference: true,
        })
      }
    }

    return { current: buildRankChart(currentEntries), delta: buildRankChart(deltaEntries) }
  }, [displayNow, displayBefore, excludedSectorIds, excludedMarketValueTiers, avgChangeRateUseSimple])

  return (
    <div className="flex h-screen select-none flex-col overflow-hidden bg-black">
      <NavBar />
      <SubNavBar
        actions={
          <NavBarPageActions
            onRefresh={refetchMarketMap}
            isRefreshing={isRefreshing}
            onToggleSettings={() => settingsModalProps.onOpenChange(!settingsModalProps.isOpen)}
            isSettingsOpen={settingsModalProps.isOpen}
            onOpenShare={() => setIsShareOpen(true)}
            isNativeFullscreen={isNativeFullscreen}
            onToggleFullscreen={handleToggleNativeFullscreen}
            showSnapshotControls={Boolean(displayNow?.snapshotTime)}
            showRefresh={false}
          />
        }
      />
      <div className="flex min-h-0 flex-1">
        {/* 공유 캡처(captureRef)는 [세 번째 바+본문] 열만 찍는다 — 설정 사이드바는 캡처에 넣지 않는다.
            data-captureid는 백엔드 렌더러가 잡는 셀렉터라 바깥 wrapper에 그대로 둔다. */}
        <div
          data-captureid={CAPTURE_ID.SECTOR}
          data-capture-ready={isDataCaptureReady}
          className="relative z-10 -mt-[10.5px] flex min-h-0 flex-1 overflow-hidden bg-black text-white"
        >
          {/* min-w-0: 이 컬럼의 자동 최소 폭을 0으로 눌러서(overflow: visible이면 내부 콘텐츠의
              min-content 폭을 그대로 강제해서 사이드바 쪽을 밀어냄) 창을 좁혀도 사이드바(w-80)가
              항상 같은 폭을 유지하게 한다(지도 페이지와 동일) — 내부 그래프가 넘치면 이 컬럼
              안에서만 처리된다. */}
          <div ref={captureRef} className="flex min-h-0 min-w-0 flex-1 flex-col bg-black text-white">
            <div className="relative mt-[5.25px] mb-[5.25px] flex h-7 w-full shrink-0 items-center justify-between bg-black/70 pl-[7px] pr-3 text-sm font-bold text-white">
              <div className="flex items-center gap-2 whitespace-nowrap">
                <MarketMapMarketCombobox
                  market={market}
                  onSelect={selectedMarket => {
                    if (selectedMarket !== market) navigate(marketRoute('/group', selectedMarket))
                  }}
                />
                <MarketMapPeriodCombobox />
                {displayNow?.snapshotTime && (
                  <span className={`${FONT_BAR_TIME} flex items-center gap-1.5 whitespace-nowrap text-gray-400`}>
                    <span>{toMarketMapSnapshotDateLabel(displayNow.snapshotTime)}</span>
                    <span>{toMarketMapSnapshotTimeOnlyLabel(displayNow.snapshotTime)}</span>
                  </span>
                )}
                <PageRefreshButton onRefresh={refetchMarketMap} isRefreshing={isRefreshing} className="-ml-[10px]" helpText={SNAPSHOT_REFRESH_HELP} />
              </div>
              {/* 지도 페이지와 동일하게 바 전체 폭 기준 절대 중앙에 고정 — 좌/우 칸 폭에 영향받지 않는다. */}
              <span
                className={`${FONT_BAR_MODE_STATUS} absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-gray-400`}
              >
                {modeStatusText}
              </span>
            </div>
            {/* 지도/어드민 페이지와 동일하게 본문이 화면을 꽉 채우는 형태 — 가운데 정렬/폭 제한을 없애서
                설정 사이드바가 열려도 본문이 밀리는 게 자연스럽게 느껴지도록 한다(밀림 자체는 다른
                페이지와 동일한 flex 구조이고, 콘텐츠가 항상 남는 공간을 꽉 채우기만 하면 된다). */}
            <div className="flex min-h-0 flex-1">
              <div className="flex min-h-0 w-full flex-1 flex-col px-[7px] py-4">
              {isLoading ? (
                <div className="flex flex-1 items-center justify-center">
                  <Spinner showElapsed />
                </div>
              ) : isError ? (
                <div className="p-8 text-center text-xs text-gray-500">데이터를 불러오지 못했습니다</div>
              ) : data?.snapshotTime == null ? (
                // now가 성공했지만 그 시각 데이터 자체가 없다 — 쌍 쿼리가 비활성이라(결정 4)
                // displayNow도 계속 undefined이므로, 아래 !displayNow 분기보다 먼저 걸러야
                // 스피너가 영원히 돌지 않는다.
                <div className="p-8 text-center text-xs text-gray-500">데이터가 없습니다</div>
              ) : !displayNow ? (
                // now는 성공했지만(비어 있지 않음) 쌍 쿼리가 아직 첫 결과를 내지 못한 순간 — 짝이 안
                // 맞는 반쪽짜리 화면을 그리지 않고 기다린다(결정 4).
                <div className="flex flex-1 items-center justify-center">
                  <Spinner showElapsed />
                </div>
              ) : charts.current.rankedItems.length === 0 && charts.delta.rankedItems.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-500">데이터가 없습니다</div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                  {/* 현재 그래프(왼쪽)/변화율 그래프(오른쪽)를 나란히 배치. "시가총액 가중/동일 가중 등락률"·
                      "N분 전 대비" 캡션은 각각 RankBars의 header로 넘겨서, 그래프(막대 트랙) 시작 위치와
                      캡션 시작 위치가 라벨 폭과 무관하게 항상 맞도록 한다. 바깥을 flex-col + min-h-0로
                      만들어 RankBars(그리드)가 실제 남는 높이를 그대로 받게 하고, RankBars 안에서
                      content-between으로 행 사이 여백을 균등 분배해 컨테이너 높이를 꽉 채운다(섹터
                      수가 많아 다 못 채우면 자연스럽게 스크롤). px-[10%]로 좌우 바깥쪽에 폭 기준 10%씩
                      여백을 둬서 막대가 화면 양 끝까지 닿지 않게 한다. */}
                  {/* 헤더는 그래프가 아니라 본문 전체 폭을 2:1로 나눈 구간의 가운데에 놓는다(좌 2/3, 우 1/3).
                      오른쪽은 설정창 슬라이더로 고른 비교 시점 하나만 보여준다. */}
                  <div
                    className="mb-2 flex w-full shrink-0 items-center font-bold whitespace-nowrap"
                    style={{ fontSize: 20, color: strongIndustryColor }}
                  >
                    <div className="flex flex-[2] justify-center">{avgChangeRateLabel(avgChangeRateUseSimple)}</div>
                    <div className="flex flex-[1] justify-center">
                      <span>{beforeMinutes}분 전 대비</span>
                    </div>
                  </div>
                  <div className="flex min-h-0 flex-1 gap-x-8 px-[10%]">
                    {/* 좌(현재) 2 : 우(변화율) 1 비율 — 변화율 쪽은 막대가 항상 더 짧아서 면적을 덜 준다. */}
                    <div className="flex min-h-0 min-w-0 flex-[2]">
                      <RankBars
                        chart={charts.current}
                        highlightColor={strongIndustryColor}
                        colorScale={colorScale}
                      />
                    </div>
                    <div className="flex min-h-0 min-w-0 flex-[1]">
                      <RankBars
                        chart={charts.delta}
                        highlightColor={strongIndustryColor}
                        unit="%p"
                        colorScale={colorScale}
                      />
                    </div>
                  </div>
                </div>
              )}
              </div>
            </div>
            {/* 면책조항 줄 — 지도 페이지 색상 바 줄과 같은 높이(28px)로 왼쪽 아래에 둔다. */}
            <div className="flex h-7 shrink-0 items-center px-[7px]">
              <DisclaimerNotice />
            </div>
          </div>
          {/* 설정창 윗선을 지도 페이지와 같은 높이로 맞춘다 — 지도 페이지에서 실제로 맞춘 모양(설정창 윗선이 위쪽 바 윗선보다 3px 아래)을 따른다. 이 칸은 바보다 5.25px 위에서 시작하므로 5.25 + 3 - 1(눈으로 맞춘 보정) = 7.25px을 띄운다. 아래는 붙인다. */}
          <div className={`flex shrink-0 pt-[7.25px] ${isSettingsOnLeft ? 'order-first' : ''}`}>
            <SettingsSidebar
              {...settingsModalProps}
              isOnLeft={isSettingsOnLeft}
              onToggleSide={toggleSettingsSide}
              pageLabel="GROUP"
              plainContent={
                <>
                  <SettingsAverageModeSection
                    avgChangeRateUseSimple={avgChangeRateUseSimple}
                    onChange={onChangeAvgChangeRateUseSimple}
                  />
                  <SettingsBeforeMinutesSection beforeMinutes={beforeMinutes} onChange={setBeforeMinutes} />
                </>
              }
            />
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
