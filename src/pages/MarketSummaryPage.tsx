import { useEffect, useRef, useState } from 'react'
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
import { ShareIcon, SettingsIcon, MaximizeIcon, MinimizeIcon } from '@/components/icons/MarketMapIcons'
import { useGlobalSettings } from '@/hooks/useGlobalSettings'
import { captureElementToClipboard } from '@/utils/captureToClipboard'
import { captureElementToDownload } from '@/utils/captureToDownload'

type CopyStatus = 'idle' | 'copying' | 'copied' | 'error'
type DownloadStatus = 'idle' | 'downloading' | 'error'

export default function MarketSummaryPage() {
  const { settingsModalProps, colorEditorPanelProps } = useGlobalSettings({ needsTree: false })
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
      <div className="flex min-h-0">
        {colorEditorPanelProps && (
          <div className="w-56 shrink-0 overflow-y-auto bg-[var(--surface)]">
            <MarketMapColorThresholdEditorPanel {...colorEditorPanelProps} />
          </div>
        )}
        {/* 설정 사이드바가 열려있으면 공유 캡처에도 같이 포함되도록, captureRef를 본문+사이드바를
            함께 감싸는 바깥 wrapper로 옮겼다 — 사이드바가 닫혀있으면 본문만 있는 것과 동일하다. */}
        <div ref={captureRef} className="flex min-h-0 flex-1">
          <div className="flex-1 p-4">
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
