import { useState } from 'react'
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
    <div style={{ background: '#fff', minHeight: '100vh', padding: 16, color: '#000' }}>
      <div style={{ maxWidth: '60%', margin: '0 auto' }}>

        <button type="button" className="nes-btn" onClick={() => setSidebarOpen(true)}>
          관심종목 관리
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginTop: 16 }}>

          <MarketOverviewSection />

          <InvestorTradingSection />

          <IntradayTopSection />

          <ProgramTradingSection />

          <IndexContributionSection />

          <ShortSellingHistorySection />

          <ProgramTradingHistorySection />

        </div>
      </div>

      <WatchStockSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </div>
  )
}
