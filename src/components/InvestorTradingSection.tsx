import { useMarketSummary } from '../hooks/useMarketSummary'
import type { Market, Investor } from '../types/api'
import { toEokSigned, signClass, investorLabel } from '../utils/format'

const MARKETS: Market[] = ['KOSPI', 'KOSDAQ']
const INVESTORS: Investor[] = [
  'PERSONAL', 'FOREIGNER', 'INSTITUTION',
  'FINANCIAL_INVESTMENT', 'PENSION_FUND', 'FOREIGN_COMPANY',
]

export default function InvestorTradingSection() {
  const { data, isError } = useMarketSummary()

  if (!data) {
    return (
      <section className="section">
        <div className="section-header"><h2>투자자별 매매종합</h2></div>
        <div className="empty-state">{isError ? '데이터를 불러오지 못했습니다' : '불러오는 중...'}</div>
      </section>
    )
  }

  const items = data.investorTradingSummaries.items
  const get = (market: Market, investor: Investor) =>
    items.find(i => i.market === market && i.investor === investor)

  if (items.length === 0) {
    return (
      <section className="section">
        <div className="section-header"><h2>투자자별 매매종합</h2></div>
        <div className="empty-state">수집된 데이터가 없습니다</div>
      </section>
    )
  }

  return (
    <section className="section">
      <div className="section-header">
        <h2>투자자별 매매종합</h2>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>단위: 억원 · 순매수</span>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th className="left">시장</th>
            {INVESTORS.map(inv => (
              <th key={inv}>{investorLabel(inv)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MARKETS.map(market => (
            <tr key={market}>
              <td className="left">{market}</td>
              {INVESTORS.map(investor => {
                const d = get(market, investor)
                const net = d?.netBuyAmount ?? 0
                return (
                  <td key={investor} className={signClass(net)}>
                    {toEokSigned(net)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
