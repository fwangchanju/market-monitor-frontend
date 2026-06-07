import { Link } from 'react-router-dom'
import type { IntradayInvestorRankingItem } from '../types/api'
import { toEokSignedFromMln, toVolume, signClass } from '../utils/format'

interface Props {
  items: IntradayInvestorRankingItem[]
}

export default function IntradayRankingSection({ items }: Props) {
  return (
    <section className="section">
      <div className="section-header">
        <h2>장중 투자자별 매매 상위</h2>
        <div className="actions">
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>KOSPI · 외국인 · 순매수</span>
          <Link
            to="/intraday-rankings?market=KOSPI&investor=FOREIGNER&ranking=NET_BUY"
            style={{ fontSize: 12, color: 'var(--text-muted)' }}
          >
            전체 보기 →
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">수집된 데이터가 없습니다</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th className="left" style={{ width: 32 }}>#</th>
              <th className="left">종목</th>
              <th>순매수(억)</th>
              <th>거래량</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={`${item.rank}-${item.stockCode}`}>
                <td className="left" style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                  {item.rank}
                </td>
                <td className="left">
                  <span>{item.stockName}</span>
                  <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                    {item.stockCode}
                  </span>
                </td>
                <td className={signClass(item.netBuyAmount)}>
                  {toEokSignedFromMln(item.netBuyAmount)}
                </td>
                <td style={{ color: 'var(--text-muted)' }}>
                  {toVolume(item.tradedVolume)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
