import { useCallback, useEffect, useRef, useState } from 'react'
import MarketOverviewSection from '@/components/MarketOverviewSection'
import InvestorTradingSection from '@/components/InvestorTradingSection'
import IntradayTopSection from '@/components/IntradayTopSection'
import ProgramTradingSection from '@/components/ProgramTradingSection'
import IndexContributionSection from '@/components/IndexContributionSection'
import ShortSellingHistorySection from '@/components/ShortSellingHistorySection'
import ProgramTradingHistorySection from '@/components/ProgramTradingHistorySection'
import { captureElementToClipboard } from '@/utils/captureToClipboard'

type CopyStatus = 'idle' | 'copying' | 'copied' | 'error'

export default function MarketSummaryCapturePage() {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  const captureRef = useRef<HTMLDivElement>(null)

  const handleCopy = useCallback(async () => {
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
  }, [])

  useEffect(() => {
    const onCopy = (e: ClipboardEvent) => {
      e.preventDefault()
      handleCopy()
    }
    document.addEventListener('copy', onCopy)
    return () => document.removeEventListener('copy', onCopy)
  }, [handleCopy])

  return (
    <div className="min-h-screen p-4">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex justify-end">
          <button
            type="button"
            className="nes-btn border-red-600 bg-red-600 text-white hover:bg-red-700"
            onClick={handleCopy}
            disabled={copyStatus === 'copying'}
          >
            {copyStatus === 'copying' ? 'COPYING...' : copyStatus === 'copied' ? 'COPIED' : copyStatus === 'error' ? 'FAILED' : 'COPY'}
          </button>
        </div>

        <div ref={captureRef} className="mt-4 grid grid-cols-1 gap-4">
          <MarketOverviewSection />
          <InvestorTradingSection />
          <IntradayTopSection />
          <ProgramTradingSection />
          <IndexContributionSection />
          <ShortSellingHistorySection />
          <ProgramTradingHistorySection />
        </div>
      </div>
    </div>
  )
}
