import MarketOverviewSection from '@/components/MarketOverviewSection'
import InvestorTradingSection from '@/components/InvestorTradingSection'
import WatchStockSection from '@/components/WatchStockSection'
import IntradayTopSection from '@/components/IntradayTopSection'
import ProgramTradingSection from '@/components/ProgramTradingSection'
import IndexContributionSection from '@/components/IndexContributionSection'
import ShortSellingHistorySection from '@/components/ShortSellingHistorySection'
import ProgramTradingHistorySection from '@/components/ProgramTradingHistorySection'

export default function MarketSummaryPage() {
  return (
    <div style={{ background: '#fff', minHeight: '100vh', padding: 16, color: '#000' }}>
      <div style={{ maxWidth: '60%', margin: '0 auto' }}>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>

          <MarketOverviewSection />

          <InvestorTradingSection />

          <WatchStockSection />

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
