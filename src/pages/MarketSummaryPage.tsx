import { useState } from 'react'
import NavBar from '@/components/NavBar'
import MarketOverviewSection from '@/components/MarketOverviewSection'
import InvestorTradingSection from '@/components/InvestorTradingSection'
import IntradayTopSection from '@/components/IntradayTopSection'
import ProgramTradingSection from '@/components/ProgramTradingSection'
import IndexContributionSection from '@/components/IndexContributionSection'
import ShortSellingHistorySection from '@/components/ShortSellingHistorySection'
import ProgramTradingHistorySection from '@/components/ProgramTradingHistorySection'
import WatchStockSidebar from '@/components/WatchStockSidebar'

export default function MarketSummaryPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen">
      <NavBar
        actions={
          <>
            <button
              type="button"
              className="nes-btn border-red-600 bg-red-600 text-white hover:bg-red-700"
              onClick={() => window.open('/market-summary/capture', '_blank')}
            >
              COPY
            </button>
            <button type="button" className="nes-btn text-white" onClick={() => setSidebarOpen(true)}>
              관심종목관리
            </button>
          </>
        }
      />
      <div className="p-4">
        <div className="mx-auto max-w-[1400px]">
          <div className="mt-4 grid grid-cols-1 gap-4">
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

      <WatchStockSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </div>
  )
}
