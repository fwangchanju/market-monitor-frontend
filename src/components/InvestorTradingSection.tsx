import { useMarketSummary } from '@/hooks/useMarketSummary'
import { MarketSchema, type Market, type Investor } from '@/types/api'
import { toEokSigned, signClass, investorLabel, isStale } from '@/utils/format'
import WidgetSection from './WidgetSection'

const MARKETS = MarketSchema.options
const INVESTORS: Investor[] = [
  'PERSONAL', 'FOREIGNER', 'INSTITUTION',
  'FINANCIAL_INVESTMENT', 'PENSION_FUND', 'FOREIGN_COMPANY',
]

export default function InvestorTradingSection() {
  const { data, isError } = useMarketSummary()

  if (!data) {
    return (
      <WidgetSection title="투자자별 매매종합">
        <div className="p-8 text-center text-xs text-gray-500">
          {isError ? '데이터를 불러오지 못했습니다' : '불러오는 중...'}
        </div>
      </WidgetSection>
    )
  }

  const items = data.investorTradingSummaries.items
  const get = (market: Market, investor: Investor) =>
    items.find(i => i.market === market && i.investor === investor)

  if (items.length === 0) {
    return (
      <WidgetSection title="투자자별 매매종합">
        <div className="p-8 text-center text-xs text-gray-500">수집된 데이터가 없습니다</div>
      </WidgetSection>
    )
  }

  const stale = isStale(data.investorTradingSummaries.snapshotTime, items[0]?.snapshotTime)

  return (
    <WidgetSection
      title="투자자별 매매종합"
      stale={stale}
      actions={<span className="text-xs text-gray-500">단위: 억원 · 순매수</span>}
    >
      <div className="overflow-x-auto">
        <table className="nes-table is-dark is-bordered w-full text-xs">
          <thead>
            <tr>
              <th className="whitespace-nowrap text-left">시장</th>
              {INVESTORS.map(inv => (
                <th key={inv} className="whitespace-nowrap">{investorLabel(inv)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MARKETS.map(market => (
              <tr key={market}>
                <td className="whitespace-nowrap text-left">{market}</td>
                {INVESTORS.map(investor => {
                  const d = get(market, investor)
                  const net = d?.netBuyAmount ?? 0
                  return (
                    <td key={investor} className={`whitespace-nowrap ${signClass(net)}`}>
                      {toEokSigned(net)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </WidgetSection>
  )
}
