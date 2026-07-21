import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getIntradayRankings } from '../api/marketSummary'
import {
  MarketQuerySchema, IntradayRankingSchema,
  type IntradayInvestorRankingItem, type MarketQuery, type IntradayInvestor, type IntradayRanking,
} from '../types/api'
import { toEokSignedFromMln, toVolume, signClass, toDateTimeLabel, investorLabel, marketLabel } from '../utils/format'

const MARKETS = MarketQuerySchema.options
const INVESTORS: IntradayInvestor[] = [
  'FOREIGN_TOTAL', 'FOREIGNER', 'FOREIGN_COMPANY',
  'INSTITUTION', 'PENSION_FUND', 'TRUST',
]
const RANKINGS = IntradayRankingSchema.options

export default function IntradayRankingPage() {
  const [params, setParams] = useSearchParams()
  const market = (params.get('market') as MarketQuery) || 'KOSPI'
  const investor = (params.get('investor') as IntradayInvestor) || 'FOREIGNER'
  const ranking = (params.get('ranking') as IntradayRanking) || 'NET_BUY'

  const [items, setItems] = useState<IntradayInvestorRankingItem[]>([])
  const [snapshotTime, setSnapshotTime] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getIntradayRankings(market, investor, ranking)
      .then(res => {
        setSnapshotTime(res.snapshotTime)
        setItems(res.items)
      })
      .catch(() => setError('데이터를 불러오지 못했습니다'))
      .finally(() => setLoading(false))
  }, [market, investor, ranking])

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    next.set(key, value)
    setParams(next)
  }

  return (
    <>
      <header className="app-header">
        <div className="page-title-bar">
          <Link to="/" className="back-link">← 대시보드</Link>
          <h2>장중 투자자별 매매 상위</h2>
        </div>
        {snapshotTime && (
          <div className="meta">
            <span>기준: {toDateTimeLabel(snapshotTime)}</span>
          </div>
        )}
      </header>
      <div className="page">
        <section className="section">
          <div className="section-header">
            <div className="actions">
              <div className="tab-bar">
                {MARKETS.map(m => (
                  <button
                    key={m}
                    className={`tab-btn ${market === m ? 'active' : ''}`}
                    onClick={() => set('market', m)}
                  >
                    {marketLabel(m)}
                  </button>
                ))}
              </div>
              <div className="tab-bar">
                {INVESTORS.map(inv => (
                  <button
                    key={inv}
                    className={`tab-btn ${investor === inv ? 'active' : ''}`}
                    onClick={() => set('investor', inv)}
                  >
                    {investorLabel(inv)}
                  </button>
                ))}
              </div>
              <div className="tab-bar">
                {RANKINGS.map(r => (
                  <button
                    key={r}
                    className={`tab-btn ${ranking === r ? 'active' : ''}`}
                    onClick={() => set('ranking', r)}
                  >
                    {r === 'NET_BUY' ? '순매수' : '순매도'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="loading">불러오는 중...</div>
          ) : error ? (
            <div className="empty-state">{error}</div>
          ) : items.length === 0 ? (
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
      </div>
    </>
  )
}
