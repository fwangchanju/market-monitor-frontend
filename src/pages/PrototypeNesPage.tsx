import { useEffect, useState } from 'react'
import 'nes.css/css/nes.min.css'
import { getDashboard, getIntradayTop, getShortSellingHistory } from '../api/dashboard'
import type {
  DashboardResponse,
  Exchange,
  IntradayTopItem,
  IntradayInvestorType,
  IntradayRankingType,
  InvestorType,
  MarketType,
  ProgramRankingType,
  ShortSellingHistoryItem,
} from '../types/api'
import {
  toEokSigned, toEokSignedFromMln, toEokFromMln, toEokFromThousand,
  toMlnSigned, toIndex, toPctSigned, toPct, toVolume, toDateLabel, investorLabel,
} from '../utils/format'

const MARKETS: MarketType[] = ['KOSPI', 'KOSDAQ']
const EXCHANGES: Exchange[] = ['KOSPI', 'KOSDAQ', 'ALL']
const INVESTORS: InvestorType[] = [
  'PERSONAL', 'FOREIGNER', 'INSTITUTION',
  'FINANCIAL_INVESTMENT', 'PENSION_FUND', 'FOREIGN_COMPANY',
]
const ID_INVESTORS: IntradayInvestorType[] = [
  'FOREIGN_TOTAL', 'FOREIGNER', 'INSTITUTION', 'PENSION_FUND', 'TRUST',
]

const pos = (v: number): React.CSSProperties => ({
  color: v > 0 ? '#209cee' : v < 0 ? '#e76e55' : undefined,
})

const nesBtn = (active: boolean) =>
  `nes-btn${active ? ' is-primary' : ''}` as string

export default function PrototypeNesPage() {
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [rankP, setRankP] = useState<ProgramRankingType>('NET_BUY')
  const [mktC, setMktC] = useState<MarketType>('KOSPI')

  const [idMarket, setIdMarket] = useState<Exchange>('KOSPI')
  const [idInvestor, setIdInvestor] = useState<IntradayInvestorType>('FOREIGNER')
  const [idRanking, setIdRanking] = useState<IntradayRankingType>('NET_BUY')
  const [idItems, setIdItems] = useState<IntradayTopItem[]>([])
  const [idLoading, setIdLoading] = useState(true)

  const [shortItems, setShortItems] = useState<ShortSellingHistoryItem[]>([])
  const [shortCode, setShortCode] = useState<string | null>(null)
  const [shortLoading, setShortLoading] = useState(false)

  useEffect(() => {
    getDashboard()
      .then(d => {
        setData(d)
        const primary = d.watchStocks.find(s => s.isPrimary) ?? d.watchStocks[0]
        if (primary) {
          setShortCode(primary.stockCode)
          setShortLoading(true)
          getShortSellingHistory(primary.stockCode)
            .then(r => setShortItems(r.items))
            .finally(() => setShortLoading(false))
        }
      })
      .catch(() => setError('데이터를 불러오지 못했습니다'))
  }, [])

  useEffect(() => {
    setIdLoading(true)
    getIntradayTop(idMarket, idInvestor, idRanking)
      .then(r => setIdItems(r.items))
      .finally(() => setIdLoading(false))
  }, [idMarket, idInvestor, idRanking])

  if (error) return <div style={{ padding: 16 }}>{error}</div>
  if (!data) return <div style={{ padding: 16 }}>불러오는 중...</div>

  const programSorted = [...data.programTradingHighlights]
    .filter(i => rankP === 'NET_BUY' ? i.programNetBuyAmount >= 0 : i.programNetBuyAmount < 0)
    .sort((a, b) => rankP === 'NET_BUY'
      ? b.programNetBuyAmount - a.programNetBuyAmount
      : a.programNetBuyAmount - b.programNetBuyAmount)
    .slice(0, 10)

  const contribFiltered = data.indexContributionHighlights
    .filter(i => i.marketType === mktC)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 10)

  const fs = { fontSize: 11 }

  return (
    <div style={{ background: '#fff', minHeight: '100vh', padding: 16 }}>

      <div className="nes-container" style={{ marginBottom: 16 }}>
        <p style={fs}>장 중 모니터링 — {data.snapshotTime?.slice(0, 16).replace('T', ' ')} | {data.marketStatus ?? 'N/A'}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* 시장종합 */}
        <div className="nes-container with-title" style={{ gridColumn: '1 / -1' }}>
          <p className="title">[0200]시장종합</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', ...fs }}>
            <thead><tr>
              <th style={{ textAlign: 'left', padding: '2px 4px' }}>시장</th>
              <th style={{ textAlign: 'right', padding: '2px 4px' }}>지수</th>
              <th style={{ textAlign: 'right', padding: '2px 4px' }}>등락률</th>
              <th style={{ textAlign: 'right', padding: '2px 4px' }}>거래대금(억)</th>
              <th style={{ textAlign: 'right', padding: '2px 4px' }}>상한</th>
              <th style={{ textAlign: 'right', padding: '2px 4px' }}>상승</th>
              <th style={{ textAlign: 'right', padding: '2px 4px' }}>보합</th>
              <th style={{ textAlign: 'right', padding: '2px 4px' }}>하락</th>
              <th style={{ textAlign: 'right', padding: '2px 4px' }}>하한</th>
            </tr></thead>
            <tbody>
              {MARKETS.map(mkt => {
                const item = data.marketOverviews.find(i => i.marketType === mkt)
                if (!item) return null
                return (
                  <tr key={item.marketType} style={{ borderTop: '1px solid #ccc' }}>
                    <td style={{ padding: '3px 4px', fontWeight: 'bold', ...fs }}>{item.marketType}</td>
                    <td style={{ textAlign: 'right', padding: '3px 4px', ...fs, ...pos(item.changeValue) }}>{toIndex(item.indexValue)}</td>
                    <td style={{ textAlign: 'right', padding: '3px 4px', ...fs, ...pos(item.changeValue) }}>{toPctSigned(item.changeRate)}</td>
                    <td style={{ textAlign: 'right', padding: '3px 4px', ...fs, color: '#666' }}>{toEokFromMln(item.tradingValue)}</td>
                    <td style={{ textAlign: 'right', padding: '3px 4px', fontSize: 10, color: '#666' }}>{item.upperLimitCount}</td>
                    <td style={{ textAlign: 'right', padding: '3px 4px', fontSize: 10, color: '#666' }}>{item.advancers}</td>
                    <td style={{ textAlign: 'right', padding: '3px 4px', fontSize: 10, color: '#666' }}>{item.unchangedCount}</td>
                    <td style={{ textAlign: 'right', padding: '3px 4px', fontSize: 10, color: '#666' }}>{item.decliners}</td>
                    <td style={{ textAlign: 'right', padding: '3px 4px', fontSize: 10, color: '#666' }}>{item.lowerLimitCount}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* 투자자별 매매종합 */}
        <div className="nes-container with-title" style={{ gridColumn: '1 / -1' }}>
          <p className="title">[0780]투자자별매매동향-투자자별매매종합</p>
          <p style={{ fontSize: 10, color: '#666', margin: '0 0 6px' }}>순매수 (단위: 억원)</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', ...fs }}>
            <thead><tr>
              <th style={{ textAlign: 'left', padding: '2px 6px' }}>시장</th>
              {INVESTORS.map(inv => (
                <th key={inv} style={{ textAlign: 'right', padding: '2px 6px' }}>{investorLabel(inv)}</th>
              ))}
            </tr></thead>
            <tbody>
              {MARKETS.map(mkt => (
                <tr key={mkt} style={{ borderTop: '1px solid #ccc' }}>
                  <td style={{ padding: '3px 6px', fontWeight: 'bold', ...fs }}>{mkt}</td>
                  {INVESTORS.map(inv => {
                    const d = data.investorTradingSummaries.find(i => i.marketType === mkt && i.investorType === inv)
                    const net = d?.netBuyAmount ?? 0
                    return (
                      <td key={inv} style={{ textAlign: 'right', padding: '3px 6px', ...fs, ...pos(net) }}>
                        {toEokSigned(net)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 장중 투자자별 매매 */}
        <div className="nes-container with-title" style={{ gridColumn: '1 / -1' }}>
          <p className="title">장중 투자자별 매매</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {EXCHANGES.map(m => (
              <button key={m} type="button" className={nesBtn(idMarket === m)} style={{ fontSize: 10, padding: '4px 6px' }} onClick={() => setIdMarket(m)}>{m}</button>
            ))}
            <span style={{ margin: '0 4px' }}>|</span>
            {ID_INVESTORS.map(inv => (
              <button key={inv} type="button" className={nesBtn(idInvestor === inv)} style={{ fontSize: 10, padding: '4px 6px' }} onClick={() => setIdInvestor(inv)}>{investorLabel(inv)}</button>
            ))}
            <span style={{ margin: '0 4px' }}>|</span>
            {(['NET_BUY', 'NET_SELL'] as IntradayRankingType[]).map(r => (
              <button key={r} type="button" className={nesBtn(idRanking === r)} style={{ fontSize: 10, padding: '4px 6px' }} onClick={() => setIdRanking(r)}>{r === 'NET_BUY' ? '순매수' : '순매도'}</button>
            ))}
          </div>
          {idLoading ? <p style={fs}>불러오는 중...</p> : idItems.length === 0 ? <p style={fs}>데이터 없음</p> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', ...fs }}>
              <thead><tr>
                <th style={{ textAlign: 'left', padding: '2px 4px' }}>#</th>
                <th style={{ textAlign: 'left', padding: '2px 4px' }}>종목</th>
                <th style={{ textAlign: 'right', padding: '2px 4px' }}>순매수(백만)</th>
              </tr></thead>
              <tbody>
                {idItems.map((item, idx) => (
                  <tr key={item.stockCode} style={{ borderTop: '1px solid #ccc' }}>
                    <td style={{ padding: '2px 4px', color: '#666', fontSize: 10 }}>{idx + 1}</td>
                    <td style={{ padding: '2px 4px', ...fs }}>{item.stockName} <span style={{ color: '#888', fontSize: 10 }}>{item.stockCode}</span></td>
                    <td style={{ textAlign: 'right', padding: '2px 4px', ...fs, ...pos(item.netBuyAmount) }}>{toMlnSigned(item.netBuyAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 프로그램 매매 상위 */}
        <div className="nes-container with-title">
          <p className="title">프로그램 매매</p>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {(['NET_BUY', 'NET_SELL'] as ProgramRankingType[]).map(r => (
              <button key={r} type="button" className={nesBtn(rankP === r)} style={{ fontSize: 10, padding: '4px 8px' }} onClick={() => setRankP(r)}>{r === 'NET_BUY' ? '순매수' : '순매도'}</button>
            ))}
          </div>
          {programSorted.length === 0 ? <p style={fs}>데이터 없음</p> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', ...fs }}>
              <thead><tr>
                <th style={{ textAlign: 'left', padding: '2px 4px' }}>#</th>
                <th style={{ textAlign: 'left', padding: '2px 4px' }}>종목</th>
                <th style={{ textAlign: 'right', padding: '2px 4px' }}>순매수(억)</th>
                <th style={{ textAlign: 'right', padding: '2px 4px' }}>매수</th>
                <th style={{ textAlign: 'right', padding: '2px 4px' }}>매도</th>
              </tr></thead>
              <tbody>
                {programSorted.map((item, idx) => (
                  <tr key={item.stockCode} style={{ borderTop: '1px solid #ccc' }}>
                    <td style={{ padding: '2px 4px', color: '#666', fontSize: 10 }}>{idx + 1}</td>
                    <td style={{ padding: '2px 4px', ...fs }}>{item.stockName}</td>
                    <td style={{ textAlign: 'right', padding: '2px 4px', ...fs, ...pos(item.programNetBuyAmount) }}>{toEokSignedFromMln(item.programNetBuyAmount)}</td>
                    <td style={{ textAlign: 'right', padding: '2px 4px', fontSize: 10, color: '#666' }}>{toEokFromMln(item.programBuyAmount)}</td>
                    <td style={{ textAlign: 'right', padding: '2px 4px', fontSize: 10, color: '#666' }}>{toEokFromMln(item.programSellAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 지수 기여도 상위 */}
        <div className="nes-container with-title">
          <p className="title">지수 기여도</p>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {MARKETS.map(m => (
              <button key={m} type="button" className={nesBtn(mktC === m)} style={{ fontSize: 10, padding: '4px 8px' }} onClick={() => setMktC(m)}>{m}</button>
            ))}
          </div>
          {contribFiltered.length === 0 ? <p style={fs}>데이터 없음</p> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', ...fs }}>
              <thead><tr>
                <th style={{ textAlign: 'left', padding: '2px 6px' }}>#</th>
                <th style={{ textAlign: 'left', padding: '2px 6px' }}>종목</th>
                <th style={{ textAlign: 'right', padding: '2px 6px' }}>기여도</th>
                <th style={{ textAlign: 'right', padding: '2px 6px' }}>등락률</th>
              </tr></thead>
              <tbody>
                {contribFiltered.map(item => (
                  <tr key={item.rank} style={{ borderTop: '1px solid #ccc' }}>
                    <td style={{ padding: '2px 6px', color: '#666', fontSize: 10 }}>{item.rank}</td>
                    <td style={{ padding: '2px 6px', ...fs }}>{item.stockName}</td>
                    <td style={{ textAlign: 'right', padding: '2px 6px', ...fs, ...pos(item.contributionScore) }}>{item.contributionScore.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', padding: '2px 6px', ...fs, ...pos(item.priceChangeRate) }}>{toPctSigned(item.priceChangeRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 종목별 공매도 추이 */}
        <div className="nes-container with-title" style={{ gridColumn: '1 / -1' }}>
          <p className="title">종목별 공매도 추이{shortCode ? ` — ${shortCode}` : ''}</p>
          {!shortCode ? (
            <p style={fs}>관심종목 없음</p>
          ) : shortLoading ? (
            <p style={fs}>불러오는 중...</p>
          ) : shortItems.length === 0 ? (
            <p style={fs}>데이터 없음</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', ...fs }}>
              <thead><tr>
                <th style={{ textAlign: 'left', padding: '2px 6px' }}>일자</th>
                <th style={{ textAlign: 'right', padding: '2px 6px' }}>종가</th>
                <th style={{ textAlign: 'right', padding: '2px 6px' }}>등락률</th>
                <th style={{ textAlign: 'right', padding: '2px 6px' }}>공매도량</th>
                <th style={{ textAlign: 'right', padding: '2px 6px' }}>비중</th>
                <th style={{ textAlign: 'right', padding: '2px 6px' }}>공매도금액(억)</th>
              </tr></thead>
              <tbody>
                {shortItems.map(item => (
                  <tr key={item.tradeDate} style={{ borderTop: '1px solid #ccc' }}>
                    <td style={{ padding: '2px 6px', color: '#666' }}>{toDateLabel(item.tradeDate)}</td>
                    <td style={{ textAlign: 'right', padding: '2px 6px' }}>{item.closePrice.toLocaleString('ko-KR')}</td>
                    <td style={{ textAlign: 'right', padding: '2px 6px', ...pos(item.priceChange) }}>{toPctSigned(item.changeRate)}</td>
                    <td style={{ textAlign: 'right', padding: '2px 6px', color: '#666' }}>{toVolume(item.shortVolume)}</td>
                    <td style={{ textAlign: 'right', padding: '2px 6px', color: '#666' }}>{toPct(item.shortRatio)}</td>
                    <td style={{ textAlign: 'right', padding: '2px 6px', color: '#666' }}>{toEokFromThousand(item.shortAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  )
}
