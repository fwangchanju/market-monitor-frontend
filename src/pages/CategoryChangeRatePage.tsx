import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import NavBar from '@/components/NavBar'
import SubNavBar from '@/components/SubNavBar'
import MarketMapColorThresholdEditorPanel from '@/components/MarketMapColorThresholdEditorPanel'
import GlobalSettingsSidebar from '@/components/GlobalSettingsSidebar'
import MarketMapShareModal from '@/components/MarketMapShareModal'
import Spinner from '@/components/Spinner'
import { useMarketMap } from '@/hooks/useMarketMap'
import { useCategoryChangeRates } from '@/hooks/useCategoryChangeRates'
import { useMarketValueTierRange } from '@/hooks/useMarketValueTierRange'
import { useGlobalSettings } from '@/hooks/useGlobalSettings'
import { usePersistedState } from '@/hooks/usePersistedState'
import { combineTierBreakdowns } from '@/utils/categoryTierBreakdown'
import { CAPTURE_ID } from '@/utils/captureIds'
import NavBarPageActions from '@/components/NavBarPageActions'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { captureElementToClipboard } from '@/utils/captureToClipboard'
import { captureElementToDownload } from '@/utils/captureToDownload'
import { toMarketMapSnapshotTimeLabel, toPct, toPctSigned, signClass } from '@/utils/format'
import type { CategoryChangeRateItem, Market, MarketQuery, MarketMapCategoryNode } from '@/types/api'

type CopyStatus = 'idle' | 'copying' | 'copied' | 'error'
type DownloadStatus = 'idle' | 'downloading' | 'error'

const MIN_BEFORE_MINUTES = 5

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
}

interface RankChart {
  rankedItems: RankedItem[]
  axisMax: number
  axisTicks: number[]
}

interface MarketCharts {
  market: Market
  current: RankChart
  delta: RankChart
}

// 카테고리별 (id, 값) 목록을 값 내림차순 랭킹 막대그래프 데이터로 변환한다 — "현재" 그래프/"변화율"
// 그래프 둘 다 이 함수로 각각 독립적으로 정렬·스케일을 만든다(같은 포맷, 정렬 기준값만 다름).
function buildRankChart(entries: { categoryId: number; value: number }[], categoryNameById: Map<number, string>): RankChart {
  const rankedItems: RankedItem[] = entries
    .map(entry => ({ ...entry, categoryName: categoryNameById.get(entry.categoryId) ?? '' }))
    .sort((a, b) => b.value - a.value)

  const rawMaxAbsValue = Math.max(1, ...rankedItems.map(item => Math.abs(item.value)))
  // 핀비즈처럼 축 눈금이 딱 떨어지게, 0.5%p 단위로 올림한 값을 막대 스케일과 축 눈금 양쪽에 같이 쓴다.
  const axisMax = Math.ceil(rawMaxAbsValue * 2) / 2
  const axisTicks = [0, 0.25, 0.5, 0.75, 1].map(ratio => axisMax * ratio)

  return { rankedItems, axisMax, axisTicks }
}

// 라벨 열은 내용에 맞춰(auto), 그래프 열은 남는 공간을 다 쓴다 — "현재"/"변화율" 그래프 둘 다 동일한
// 포맷으로 그린다. header는 그래프(막대 트랙)와 같은 열(1fr)에 그려서, 그래프가 시작하는 위치와
// header 텍스트가 시작하는 위치가 라벨 폭과 무관하게 항상 맞도록 한다.
function RankBars({ chart, header }: { chart: RankChart; header?: ReactNode }) {
  if (chart.rankedItems.length === 0) {
    return <div className="p-8 text-center text-xs text-gray-500">데이터가 없습니다</div>
  }
  return (
    <div className="grid w-full items-center gap-x-3 gap-y-1.5 text-xs" style={{ gridTemplateColumns: 'auto 1fr' }}>
      <span />
      <div className="whitespace-nowrap text-gray-400">{header ?? ' '}</div>
      {chart.rankedItems.map(item => (
        <Fragment key={item.categoryId}>
          <span className="whitespace-nowrap text-right">{item.categoryName}</span>
          {/* 퍼센트 텍스트 폭을 고정(w-14)으로 미리 비워두고, 막대는 그 나머지(flex-1) 안에서만
              채운다 — 그래야 막대가 축 최대치에 가깝게 길어져도 텍스트가 열 밖으로 밀려나지 않는다. */}
          <div className="flex h-5 items-center gap-1.5">
            <div className="h-full flex-1">
              <div
                className="h-full rounded-sm"
                style={{
                  width: `${(Math.abs(item.value) / chart.axisMax) * 100}%`,
                  backgroundColor: item.value >= 0 ? 'var(--stock-up)' : 'var(--stock-down)',
                }}
              />
            </div>
            <span className={`w-14 shrink-0 whitespace-nowrap ${signClass(item.value)}`}>{toPctSigned(item.value)}</span>
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
              {toPct(tick)}
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
  const [beforeMinutes, setBeforeMinutes] = usePersistedState('categoryChangeRate.beforeMinutes', 60)
  const [searchParams, setSearchParams] = useSearchParams()

  // 렌더러가 /category-change-rate?market=KOSDAQ로 캡처 요청할 때 쓰는 진입점 — MarketMapCustomPage와
  // 동일한 패턴(초기 상태 반영 용도일 뿐 주소창엔 남길 필요 없어 반영 직후 지움).
  useEffect(() => {
    const param = searchParams.get('market')
    if (param !== 'KOSPI' && param !== 'KOSDAQ' && param !== 'ALL_STOCKS') return
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

  const { settingsModalProps, colorEditorPanelProps, avgChangeRateUseSimple } = useGlobalSettings()
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
  // 마켓맵 화면과 세션스토리지 키를 공유 — 거기서 바꾼 시가총액 구간 필터가 이 랭킹 화면에도 그대로 반영된다.
  const { excludedMarketValueTiers } = useMarketValueTierRange(true)

  const categoryNameById = useMemo(() => collectCategoryNames(treeData?.items ?? []), [treeData])
  // 뎁스 구분 없이 전부 나열하면 너무 많아서, 어드민 카테고리 관리 화면처럼 최상위 카테고리만 보여준다.
  const rootCategoryIds = useMemo(() => new Set((treeData?.items ?? []).map(node => node.categoryId)), [treeData])

  // 요청한 마켓(들) 각각에 대해 "현재" 그래프와 "변화율" 그래프를 독립적으로 계산한다 — 백엔드가 이미
  // 요청한 마켓만 걸러서 주므로(단일 마켓이면 1개, ALL_STOCKS면 KOSPI/KOSDAQ 2개) 여기선 그대로 순회만
  // 한다. 지도의 All Stocks와 다르게 마켓을 하나로 합치지 않고 각각 별도 그래프로 보여준다.
  const marketCharts: MarketCharts[] = useMemo(() => {
    // now/before는 구간별 원시 합계 리스트라, 지금 선택된(제외되지 않은) 구간만 골라 합산한 뒤
    // 마지막에 한 번만 나눈다 — 이미 나뉜 구간별 평균끼리 다시 평균내면 틀리기 때문.
    const resolveAvg = (breakdowns: CategoryChangeRateItem['now']): number | null => {
      const combined = combineTierBreakdowns(breakdowns, excludedMarketValueTiers)
      return avgChangeRateUseSimple ? combined.simpleAvg : combined.weightedAvg
    }

    return (rankingData?.items ?? []).map(marketRanking => {
      const rootItems = marketRanking.items.filter(item => rootCategoryIds.has(item.categoryId))

      const currentEntries = rootItems
        .map(item => {
          const value = resolveAvg(item.now)
          return value === null ? null : { categoryId: item.categoryId, value }
        })
        .filter((entry): entry is { categoryId: number; value: number } => entry !== null)

      const deltaEntries = rootItems
        .map(item => {
          const value = resolveAvg(item.now)
          const beforeValue = item.before ? resolveAvg(item.before) : null
          if (value === null || beforeValue === null) return null
          return { categoryId: item.categoryId, value: value - beforeValue }
        })
        .filter((entry): entry is { categoryId: number; value: number } => entry !== null)

      return {
        market: marketRanking.market,
        current: buildRankChart(currentEntries, categoryNameById),
        delta: buildRankChart(deltaEntries, categoryNameById),
      }
    })
  }, [rankingData, avgChangeRateUseSimple, categoryNameById, rootCategoryIds, excludedMarketValueTiers])

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
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-black p-4 text-white">
          {/* 실제로 공유/캡처할 영역은 이 안쪽(가운데 정렬된 max-w-2xl + 설정 사이드바)만 — 바깥 검은
              배경까지 같이 캡처하면 그래프 양옆에 빈 공간만 많이 찍혀서 정작 그래프가 작아 보인다.
              설정 사이드바가 열려있으면 이 wrapper가 그만큼 넓어지면서 캡처에도 같이 포함된다. */}
          <div
            ref={captureRef}
            data-captureid={CAPTURE_ID.CATEGORY_CHANGE_RATE}
            data-capture-ready={!isLoading && !isTreeLoading}
            className="flex min-h-0 flex-1 justify-center"
          >
            <div className="flex min-h-0 w-full max-w-5xl flex-1 flex-col">
              <div className="mb-3 flex shrink-0 items-center justify-between text-sm font-bold">
                <span>Custom Sector</span>
                {rankingData?.snapshotTime && (
                  <span className="text-xs font-normal text-gray-400">{toMarketMapSnapshotTimeLabel(rankingData.snapshotTime)}</span>
                )}
              </div>
              {isLoading ? (
                <div className="flex flex-1 items-center justify-center">
                  <Spinner />
                </div>
              ) : isError ? (
                <div className="p-8 text-center text-xs text-gray-500">데이터를 불러오지 못했습니다</div>
              ) : marketCharts.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-500">데이터가 없습니다</div>
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {marketCharts.map((chart, chartIndex) => (
                    <div key={chart.market} className={chartIndex > 0 ? 'mt-6' : undefined}>
                      {/* 마켓이 여러 개(ALL_STOCKS)일 때만 마켓명을 붙인다 — 단일 마켓 선택 시엔 위쪽
                          헤더(Custom Sector)가 이미 그 역할을 한다. */}
                      {marketCharts.length > 1 && <div className="mb-1.5 text-sm font-bold text-gray-300">{chart.market}</div>}
                      {/* 현재 그래프(왼쪽)/변화율 그래프(오른쪽)를 나란히 배치. "N분 전 기준" 캡션은
                          delta 쪽 RankBars의 header로 넘겨서, 그래프(막대 트랙) 시작 위치와 캡션 시작
                          위치가 라벨 폭과 무관하게 항상 맞도록 한다. */}
                      <div className="grid grid-cols-2 gap-x-8">
                        <RankBars chart={chart.current} />
                        <RankBars
                          chart={chart.delta}
                          header={
                            <span className="inline-flex items-center gap-1">
                              <input
                                type="number"
                                min={MIN_BEFORE_MINUTES}
                                step={5}
                                value={beforeMinutes}
                                onChange={e =>
                                  setBeforeMinutes(Math.max(MIN_BEFORE_MINUTES, Number(e.target.value) || MIN_BEFORE_MINUTES))
                                }
                                className="w-9 rounded border border-transparent bg-transparent px-0.5 py-0.5 text-right text-gray-400 [appearance:textfield] focus:border-gray-500 focus:bg-white focus:text-black focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              />
                              분 전 기준
                            </span>
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <GlobalSettingsSidebar {...settingsModalProps} />
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
