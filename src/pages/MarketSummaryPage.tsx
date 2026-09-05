import { useRef, useState } from 'react'
import NavBar from '@/components/NavBar'
import SubNavBar from '@/components/SubNavBar'
import MarketMapColorThresholdEditorPanel from '@/components/MarketMapColorThresholdEditorPanel'
import GlobalSettingsSidebar from '@/components/GlobalSettingsSidebar'
import MarketMapShareModal from '@/components/MarketMapShareModal'
import MarketOverviewSection from '@/components/MarketOverviewSection'
import InvestorTradingSection from '@/components/InvestorTradingSection'
import IntradayTopSection from '@/components/IntradayTopSection'
import ProgramTradingSection from '@/components/ProgramTradingSection'
import IndexContributionSection from '@/components/IndexContributionSection'
import ShortSellingHistorySection from '@/components/ShortSellingHistorySection'
import ProgramTradingHistorySection from '@/components/ProgramTradingHistorySection'
import NavBarPageActions from '@/components/NavBarPageActions'
import { FONT_BAR_TIME } from '@/components/FontStyle'
import { useGlobalSettings } from '@/hooks/useGlobalSettings'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { useMarketSummary } from '@/hooks/useMarketSummary'
import { toMarketMapSnapshotTimeLabel } from '@/utils/format'
import { captureElementToClipboard } from '@/utils/captureToClipboard'
import { captureElementToDownload } from '@/utils/captureToDownload'

type CopyStatus = 'idle' | 'copying' | 'copied' | 'error'
type DownloadStatus = 'idle' | 'downloading' | 'error'

export default function MarketSummaryPage() {
  const { settingsModalProps, colorEditorPanelProps } = useGlobalSettings({ needsTree: false })
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>('idle')
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()
  const captureRef = useRef<HTMLDivElement>(null)
  const { data: marketSummaryData } = useMarketSummary()

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
      await captureElementToDownload(captureRef.current, 'market-summary.png')
    } catch {
      setDownloadStatus('error')
    } finally {
      setTimeout(() => setDownloadStatus('idle'), 2000)
    }
  }

  const copyLabel =
    copyStatus === 'copying' ? 'Copying' : copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Failed' : 'Copy'
  const downloadLabel = downloadStatus === 'error' ? 'Failed' : 'Download'

  return (
    <div className="min-h-screen">
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
      <div className="flex min-h-0">
        {colorEditorPanelProps && (
          <div className="w-56 shrink-0 overflow-y-auto bg-[var(--surface)]">
            <MarketMapColorThresholdEditorPanel {...colorEditorPanelProps} />
          </div>
        )}
        {/* 설정 사이드바가 열려있으면 공유 캡처에도 같이 포함되도록, captureRef를 세 번째 바(고정) +
            본문/사이드바(밀리는 영역) 전체를 감싸는 바깥 wrapper로 둔다 — 지도 페이지와 동일한 구조. */}
        <div ref={captureRef} className="flex min-h-0 flex-1 flex-col bg-black">
          <div className="flex h-7 w-full shrink-0 items-center justify-end bg-black/70 pl-1 pr-3 text-sm font-bold text-white">
            {/* 요약 페이지는 아직 이 바에 담을 내용이 없어서, 지도 페이지의 시간 표시 위치(우측 끝)만
                그대로 가져와 시간만 보여준다. */}
            {marketSummaryData?.marketOverviews.snapshotTime && (
              <span className={`${FONT_BAR_TIME} whitespace-nowrap text-white`}>
                {toMarketMapSnapshotTimeLabel(marketSummaryData.marketOverviews.snapshotTime)}
              </span>
            )}
          </div>
          <div className="flex min-h-0 flex-1">
            <div className="flex-1 bg-black">
              <div className="mx-auto max-w-[1400px]">
                <div className="mt-4 grid grid-cols-1 gap-4">
                  <MarketOverviewSection />
                  <IndexContributionSection />
                  <InvestorTradingSection />
                  <ProgramTradingSection />
                  <IntradayTopSection />
                  <ShortSellingHistorySection />
                  <ProgramTradingHistorySection />
                </div>
              </div>
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
