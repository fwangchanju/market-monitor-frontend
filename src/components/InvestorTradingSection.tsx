import type { InvestorTradingSummaryItem, MarketType, InvestorType } from '../types/api'
import { toEokSigned, signClass, investorLabel } from '../utils/format'

interface Props {
  items: InvestorTradingSummaryItem[]
}

const MARKETS: MarketType[] = ['KOSPI', 'KOSDAQ']
const INVESTORS: InvestorType[] = [
  'PERSONAL', 'FOREIGNER', 'INSTITUTION',
  'FINANCIAL_INVESTMENT', 'PENSION_FUND', 'FOREIGN_COMPANY',
]

export default function InvestorTradingSection({ items }: Props) {
  const get = (market: MarketType, investor: InvestorType) =>
    items.find(i => i.marketType === market && i.investorType === investor)

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
