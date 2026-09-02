import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
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
import { ShareIcon, SettingsIcon, MaximizeIcon, MinimizeIcon } from '@/components/icons/MarketMapIcons'
import { captureElementToClipboard } from '@/utils/captureToClipboard'
import { captureElementToDownload } from '@/utils/captureToDownload'
import { toMarketMapSnapshotTimeLabel, toPct, toPctSigned, signClass } from '@/utils/format'
import type { CategoryChangeRateItem, Market, MarketMapCategoryNode } from '@/types/api'

type CopyStatus = 'idle' | 'copying' | 'copied' | 'error'
type DownloadStatus = 'idle' | 'downloading' | 'error'

const MARKET_LABEL: Record<Market, string> = { KOSPI: 'KOSPI', KOSDAQ: 'KOSDAQ' }
const MIN_BEFORE_MINUTES = 5

function collectCategoryNames(nodes: MarketMapCategoryNode[], out: Map<number, string> = new Map()): Map<number, string> {
  for (const node of nodes) {
    out.set(node.categoryId, node.categoryName)
    collectCategoryNames(node.children, out)
  }
  return out
}

// 백엔드는 now(snapshotTime)만 내려주고 before 시각 자체는 안 내려준다 — before는 항상
// "now.snapshotTime - beforeMinutes"로 정해지므로, 알림 문구에 쓸 그 시각도 프론트에서 직접 계산한다.
function toBeforeMissingLabel(nowIso: string, beforeMinutes: number): string {
  const beforeDate = new Date(new Date(nowIso).getTime() - beforeMinutes * 60_000)
  const mm = String(beforeDate.getMonth() + 1).padStart(2, '0')
  const dd = String(beforeDate.getDate()).padStart(2, '0')
  const hh = String(beforeDate.getHours()).padStart(2, '0')
  const mi = String(beforeDate.getMinutes()).padStart(2, '0')
  return `${mm}-${dd} ${hh}:${mi}`
}

interface RankedItem {
  categoryId: number
  categoryName: string
  value: number
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="flex overflow-hidden rounded border border-gray-300">
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`px-2 py-0.5 text-xs ${
            value === option.value ? 'bg-[#4f8fd6] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export default function CategoryChangeRatePage() {
  const [market, setMarket] = usePersistedState<Market>('categoryChangeRate.market', 'KOSPI')
  const [beforeMinutes, setBeforeMinutes] = usePersistedState('categoryChangeRate.beforeMinutes', 60)
  const [useSimpleAvg, setUseSimpleAvg] = usePersistedState('categoryChangeRate.useSimpleAvg', false)
  const [rankByDelta, setRankByDelta] = usePersistedState('categoryChangeRate.rankByDelta', false)
  const [searchParams, setSearchParams] = useSearchParams()

  // 렌더러가 /category-change-rate?market=KOSDAQ로 캡처 요청할 때 쓰는 진입점 — MarketMapCustomPage와
  // 동일한 패턴(초기 상태 반영 용도일 뿐 주소창엔 남길 필요 없어 반영 직후 지움).
  useEffect(() => {
    const param = searchParams.get('market')
    if (param !== 'KOSPI' && param !== 'KOSDAQ') return
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

  const { settingsModalProps, colorEditorPanelProps } = useGlobalSettings()
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>('idle')
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false)
  const captureRef = useRef<HTMLDivElement>(null)

  // 사용자가 F11 키나 Esc로 직접 빠져나가는 경우도 있어서 fullscreenchange 이벤트로 상태를 동기화한다.
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

  // 변화율 토글 상태인데 이 now 시각 기준 before 스냅샷이 통째로 없으면(하루 중 최초 발송 직후처럼
  // 구조적으로 확정 발생) 조용히 등락률로 대체하지 않고 알린 뒤 토글 상태 자체를 되돌린다.
  useEffect(() => {
    if (!rankByDelta || !rankingData?.snapshotTime) return
    const hasAnyBefore = rankingData.items.some(item => item.before !== null)
    if (hasAnyBefore) return
    window.alert(`${toBeforeMissingLabel(rankingData.snapshotTime, beforeMinutes)} 데이터가 없습니다`)
    setRankByDelta(false)
  }, [rankByDelta, rankingData, beforeMinutes, setRankByDelta])

  const rankedItems: RankedItem[] = useMemo(() => {
    // now/before는 구간별 원시 합계 리스트라, 지금 선택된(제외되지 않은) 구간만 골라 합산한 뒤
    // 마지막에 한 번만 나눈다 — 이미 나뉜 구간별 평균끼리 다시 평균내면 틀리기 때문.
    const resolveValue = (item: CategoryChangeRateItem): number | null => {
      const now = combineTierBreakdowns(item.now, excludedMarketValueTiers)
      const nowValue = useSimpleAvg ? now.simpleAvg : now.weightedAvg
      if (nowValue === null) return null
      if (!rankByDelta) return nowValue
      if (!item.before) return null
      const before = combineTierBreakdowns(item.before, excludedMarketValueTiers)
      const beforeValue = useSimpleAvg ? before.simpleAvg : before.weightedAvg
      if (beforeValue === null) return null
      return nowValue - beforeValue
    }
    return (rankingData?.items ?? [])
      .filter(item => rootCategoryIds.has(item.categoryId))
      .map(item => ({ categoryId: item.categoryId, value: resolveValue(item) }))
      .filter((item): item is { categoryId: number; value: number } => item.value !== null)
      .map(item => ({ ...item, categoryName: categoryNameById.get(item.categoryId) ?? '' }))
      .sort((a, b) => b.value - a.value)
  }, [rankingData, useSimpleAvg, rankByDelta, categoryNameById, rootCategoryIds, excludedMarketValueTiers])

  const rawMaxAbsValue = Math.max(1, ...rankedItems.map(item => Math.abs(item.value)))
  // 핀비즈처럼 축 눈금이 딱 떨어지게, 0.5%p 단위로 올림한 값을 막대 스케일과 축 눈금 양쪽에 같이 쓴다.
  const axisMax = Math.ceil(rawMaxAbsValue * 2) / 2
  const axisTicks = [0, 0.25, 0.5, 0.75, 1].map(ratio => axisMax * ratio)

  return (
    <div className="flex h-screen select-none flex-col overflow-hidden">
      <NavBar />
      <SubNavBar
        actions={
          <>
            <button
              type="button"
              aria-label="설정"
              className="flex h-7 w-7 items-center justify-center rounded text-gray-700 hover:bg-gray-100 hover:text-[#4f8fd6]"
              onClick={() => settingsModalProps.onOpenChange(!settingsModalProps.isOpen)}
            >
              <SettingsIcon className="h-4 w-4" />
            </button>
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
              aria-label="F11"
              className={`flex h-7 w-7 items-center justify-center rounded hover:bg-gray-100 hover:text-[#4f8fd6] ${
                isNativeFullscreen ? 'text-[#4f8fd6]' : 'text-gray-700'
              }`}
              onClick={handleToggleNativeFullscreen}
            >
              {isNativeFullscreen ? <MinimizeIcon className="h-4 w-4" /> : <MaximizeIcon className="h-4 w-4" />}
            </button>
          </>
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
            className="mx-auto flex min-h-0 flex-1"
          >
            <div className="flex min-h-0 w-full max-w-2xl flex-1 flex-col">
              <div className="mb-3 flex shrink-0 items-center justify-between text-sm font-bold">
                <span>CUSTOM {MARKET_LABEL[market]} INDUSTRY</span>
                {rankingData?.snapshotTime && (
                  <span className="text-xs font-normal text-gray-400">{toMarketMapSnapshotTimeLabel(rankingData.snapshotTime)}</span>
                )}
              </div>
              {/* 서브바에서 옮겨온 컨트롤 — 위치는 나중에 다시 정리하기로 하고 일단 여기 둔다. */}
              <div className="mb-3 flex shrink-0 flex-wrap items-center gap-3 text-xs text-white">
                <Segmented
                  value={market}
                  onChange={setMarket}
                  options={[
                    { value: 'KOSPI', label: 'KOSPI' },
                    { value: 'KOSDAQ', label: 'KOSDAQ' },
                  ]}
                />
                <Segmented
                  value={useSimpleAvg ? 'simple' : 'weighted'}
                  onChange={v => setUseSimpleAvg(v === 'simple')}
                  options={[
                    { value: 'weighted', label: '가중평균' },
                    { value: 'simple', label: '산술평균' },
                  ]}
                />
                <Segmented
                  value={rankByDelta ? 'delta' : 'current'}
                  onChange={v => setRankByDelta(v === 'delta')}
                  options={[
                    { value: 'current', label: '현재' },
                    { value: 'delta', label: '변화율' },
                  ]}
                />
                <label className="flex items-center gap-1 text-gray-300">
                  비교 시점
                  <input
                    type="number"
                    min={MIN_BEFORE_MINUTES}
                    step={5}
                    value={beforeMinutes}
                    onChange={e => setBeforeMinutes(Math.max(MIN_BEFORE_MINUTES, Number(e.target.value) || MIN_BEFORE_MINUTES))}
                    className="w-14 rounded border border-gray-300 px-1 py-0.5 text-right text-black"
                  />
                  분 전
                </label>
              </div>
              {isLoading ? (
                <div className="flex flex-1 items-center justify-center">
                  <Spinner />
                </div>
              ) : isError ? (
                <div className="p-8 text-center text-xs text-gray-500">데이터를 불러오지 못했습니다</div>
              ) : rankedItems.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-500">데이터가 없습니다</div>
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {/* 라벨 열은 내용에 맞춰(auto), 그래프 열은 그 옆 남는 공간을 다 쓴다. */}
                  <div
                    className="grid w-full items-center gap-x-3 gap-y-1.5 text-xs"
                    style={{ gridTemplateColumns: 'auto 1fr' }}
                  >
                  {rankedItems.map(item => (
                    <Fragment key={item.categoryId}>
                      <span className="whitespace-nowrap text-right">{item.categoryName}</span>
                      <div className="flex h-5 items-center gap-1.5">
                        <div
                          className="h-full shrink-0 rounded-sm"
                          style={{
                            width: `${(Math.abs(item.value) / axisMax) * 100}%`,
                            backgroundColor: item.value >= 0 ? 'var(--stock-up)' : 'var(--stock-down)',
                          }}
                        />
                        <span className={`shrink-0 whitespace-nowrap ${signClass(item.value)}`}>{toPctSigned(item.value)}</span>
                      </div>
                    </Fragment>
                  ))}
                  {/* 핀비즈처럼 하단에 이 그래프가 몇 퍼센트 구간인지 눈금으로 표시. */}
                  <span />
                  <div className="relative h-4 text-[10px] text-gray-500">
                    {axisTicks.map((tick, index) => (
                      <span
                        key={tick}
                        className="absolute whitespace-nowrap"
                        style={{
                          left: `${(tick / axisMax) * 100}%`,
                          transform: index === 0 ? 'none' : index === axisTicks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
                        }}
                      >
                        {toPct(tick)}
                      </span>
                    ))}
                  </div>
                </div>
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
