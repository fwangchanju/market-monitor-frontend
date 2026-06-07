import { useEffect, useState } from 'react'
import 'nes.css/css/nes.min.css'
import {
  getDashboard, getIntradayTop, getShortSellingHistory,
  getProgramTradingRankings, getIndexContribution,
  getProgramTradingHistory, getStocks,
} from '../api/dashboard'
import type {
  DashboardResponse,
  Exchange,
  IntradayTopItem,
  IntradayInvestorType,
  IntradayRankingType,
  IndexContributionItem,
  InvestorType,
  MarketType,
  ProgramRankingType,
  ProgramTradingHistoryItem,
  ProgramTradingRankingItem,
  ShortSellingHistoryItem,
} from '../types/api'
import {
  toEokSigned, toEokFromMln,
  toMlnSigned, toIndex, toPctSigned, toPct, toVolume, toTimeLabel, toYyMmDd, investorLabel,
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

const RED = '#cc0000'
const BLUE = '#0000aa'
const pos = (v: number) => ({ color: v > 0 ? RED : v < 0 ? BLUE : undefined })

const nesBtn = (active: boolean) =>
  `nes-btn${active ? ' is-primary' : ''}` as string

// nes.css 기본 .title은 font-size: 1rem(=:root font-size 14px)을 따라가고 색상도 지정하지 않아
// 상단 헤더(16px)와 크기가 어긋나고, 배경(#fff)에 밝은 글자색이 상속되어 잘 안 보이므로 명시적으로 지정
const titleStyle = { fontSize: 16, color: '#000' }

export default function PrototypeNesPage() {
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 프로그램 매매 상위
  const [rankP, setRankP] = useState<ProgramRankingType>('NET_BUY')
  const [progItems, setProgItems] = useState<ProgramTradingRankingItem[]>([])
  const [progLoading, setProgLoading] = useState(true)

  // 지수 기여도 상위
  const [mktC, setMktC] = useState<MarketType>('KOSPI')
  const [contribItems, setContribItems] = useState<IndexContributionItem[]>([])
  const [contribLoading, setContribLoading] = useState(true)

  // 장중 투자자별 매매
  const [idMarket, setIdMarket] = useState<Exchange>('KOSPI')
  const [idInvestor, setIdInvestor] = useState<IntradayInvestorType>('FOREIGNER')
  const [idRanking, setIdRanking] = useState<IntradayRankingType>('NET_BUY')
  const [idItems, setIdItems] = useState<IntradayTopItem[]>([])
  const [idLoading, setIdLoading] = useState(true)

  // 공매도 추이 / 프로그램매매 추이 (종목별, 관심종목 기준 종목)
  const [shortItems, setShortItems] = useState<ShortSellingHistoryItem[]>([])
  const [shortCode, setShortCode] = useState<string | null>(null)
  const [shortLoading, setShortLoading] = useState(false)
  const [progHistItems, setProgHistItems] = useState<ProgramTradingHistoryItem[]>([])
  const [progHistLoading, setProgHistLoading] = useState(false)

  // 종목코드 → 종목명 캐시
  const [stockNames, setStockNames] = useState<Record<string, string>>({})

  useEffect(() => {
    getStocks().then(list => {
      setStockNames(Object.fromEntries(list.map(s => [s.stockCode, s.stockName])))
    })
  }, [])

  const stockLabel = (code: string) => stockNames[code] ? `${stockNames[code]}(${code})` : code

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

          const today = new Date().toISOString().slice(0, 10)

          setProgHistLoading(true)
          getProgramTradingHistory(primary.stockCode, `${today}T09:00:00`, `${today}T15:30:00`)
            .then(r => setProgHistItems(r.items))
            .finally(() => setProgHistLoading(false))
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

  useEffect(() => {
    setProgLoading(true)
    getProgramTradingRankings(rankP)
      .then(r => setProgItems(r.items))
      .finally(() => setProgLoading(false))
  }, [rankP])

  useEffect(() => {
    setContribLoading(true)
    getIndexContribution(mktC)
      .then(r => setContribItems(r.items.slice(0, 10)))
      .finally(() => setContribLoading(false))
  }, [mktC])

  if (error) return <div style={{ padding: 16 }}>{error}</div>
  if (!data) return <div style={{ padding: 16 }}>불러오는 중...</div>

  const fs = { fontSize: 14 }

  return (
    <div style={{ background: '#fff', minHeight: '100vh', padding: 16, color: '#000' }}>
      <div style={{ maxWidth: '60%', margin: '0 auto' }}>

        <div className="nes-container" style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 16 }}>장 중 모니터링 — {data.snapshotTime?.slice(0, 16).replace('T', ' ')} | {data.marketStatus ?? 'N/A'}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>

          {/* 시장종합 */}
          <div className="nes-container with-title" style={{ gridColumn: '1 / -1', minWidth: 0 }}>
            <p className="title" style={titleStyle}>[0200]시장종합</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', ...fs }}>
              <thead><tr>
                <th style={{ textAlign: 'left', padding: '2px 4px' }}>시장</th>
                <th style={{ textAlign: 'right', padding: '2px 4px' }}>지수</th>
                <th style={{ textAlign: 'right', padding: '2px 4px' }}>등락</th>
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
                      <td style={{ textAlign: 'right', padding: '3px 4px', ...fs }}>{toIndex(item.indexValue)}</td>
                      <td style={{ textAlign: 'right', padding: '3px 4px', ...fs, ...pos(item.changeValue) }}>{item.changeValue > 0 ? '+' : ''}{toIndex(item.changeValue)}</td>
                      <td style={{ textAlign: 'right', padding: '3px 4px', ...fs, ...pos(item.changeValue) }}>{toPctSigned(item.changeRate)}</td>
                      <td style={{ textAlign: 'right', padding: '3px 4px', ...fs, color: '#444' }}>{toEokFromMln(item.tradingValue)}</td>
                      <td style={{ textAlign: 'right', padding: '3px 4px', ...fs, color: RED }}>{toVolume(item.upperLimitCount)}</td>
                      <td style={{ textAlign: 'right', padding: '3px 4px', ...fs, color: RED }}>{toVolume(item.advancers)}</td>
                      <td style={{ textAlign: 'right', padding: '3px 4px', ...fs, color: '#444' }}>{toVolume(item.unchangedCount)}</td>
                      <td style={{ textAlign: 'right', padding: '3px 4px', ...fs, color: BLUE }}>{toVolume(item.decliners)}</td>
                      <td style={{ textAlign: 'right', padding: '3px 4px', ...fs, color: BLUE }}>{toVolume(item.lowerLimitCount)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* 투자자별 매매종합 */}
          <div className="nes-container with-title" style={{ gridColumn: '1 / -1', minWidth: 0 }}>
            <p className="title" style={titleStyle}>[0780]투자자별매매동향-투자자별매매종합</p>
            <p style={{ fontSize: 13, color: '#444', margin: '0 0 6px' }}>순매수 (단위: 억원)</p>
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
          <div className="nes-container with-title" style={{ gridColumn: '1 / -1', minWidth: 0 }}>
            <p className="title" style={titleStyle}>[1053]장중투자별매매상위</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {EXCHANGES.map(m => (
                <button key={m} type="button" className={nesBtn(idMarket === m)} style={{ fontSize: 13, padding: '4px 6px' }} onClick={() => setIdMarket(m)}>{m}</button>
              ))}
              <span style={{ margin: '0 4px' }}>|</span>
              {ID_INVESTORS.map(inv => (
                <button key={inv} type="button" className={nesBtn(idInvestor === inv)} style={{ fontSize: 13, padding: '4px 6px' }} onClick={() => setIdInvestor(inv)}>{investorLabel(inv)}</button>
              ))}
              <span style={{ margin: '0 4px' }}>|</span>
              {(['NET_BUY', 'NET_SELL'] as IntradayRankingType[]).map(r => (
                <button key={r} type="button" className={nesBtn(idRanking === r)} style={{ fontSize: 13, padding: '4px 6px' }} onClick={() => setIdRanking(r)}>{r === 'NET_BUY' ? '순매수' : '순매도'}</button>
              ))}
            </div>
            {idLoading ? <p style={fs}>불러오는 중...</p> : idItems.length === 0 ? <p style={fs}>데이터 없음</p> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', ...fs, tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '38%' }} />
                  <col style={{ width: '22%' }} />
                  <col style={{ width: '32%' }} />
                </colgroup>
                <thead><tr>
                  <th style={{ textAlign: 'left', padding: '2px 4px' }}>#</th>
                  <th style={{ textAlign: 'left', padding: '2px 4px' }}>종목명</th>
                  <th style={{ textAlign: 'left', padding: '2px 4px' }}>종목코드</th>
                  <th style={{ textAlign: 'right', padding: '2px 4px' }}>순매수(백만)</th>
                </tr></thead>
                <tbody>
                  {idItems.map((item, idx) => {
                    // [1053] API: ranking=NET_SELL일 때 netBuyAmount를 절댓값으로 반환 → 부호 복원
                    const netBuy = idRanking === 'NET_SELL' ? -item.netBuyAmount : item.netBuyAmount
                    return (
                      <tr key={item.stockCode} style={{ borderTop: '1px solid #ccc' }}>
                        <td style={{ padding: '2px 4px', color: '#444', ...fs }}>{idx + 1}</td>
                        <td style={{ padding: '2px 4px', ...fs, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.stockName}</td>
                        <td style={{ padding: '2px 4px', ...fs, color: '#666' }}>{item.stockCode}</td>
                        <td style={{ textAlign: 'right', padding: '2px 4px', ...fs, ...pos(netBuy) }}>{toMlnSigned(netBuy)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* 프로그램 매매 상위 */}
          <div className="nes-container with-title" style={{ minWidth: 0 }}>
            <p className="title" style={titleStyle}>[0766]프로그램매매-프로그램{rankP === 'NET_BUY' ? '순매수' : '순매도'}상위</p>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {(['NET_BUY', 'NET_SELL'] as ProgramRankingType[]).map(r => (
                <button key={r} type="button" className={nesBtn(rankP === r)} style={{ fontSize: 13, padding: '4px 8px' }} onClick={() => setRankP(r)}>{r === 'NET_BUY' ? '순매수' : '순매도'}</button>
              ))}
            </div>
            {progLoading ? <p style={fs}>불러오는 중...</p> : progItems.length === 0 ? <p style={fs}>데이터 없음</p> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', ...fs, tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '6%' }} />
                  <col style={{ width: '24%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '18%' }} />
                </colgroup>
                <thead><tr>
                  <th style={{ textAlign: 'left', padding: '2px 4px' }}>#</th>
                  <th style={{ textAlign: 'left', padding: '2px 4px' }}>종목명</th>
                  <th style={{ textAlign: 'left', padding: '2px 4px' }}>종목코드</th>
                  <th style={{ textAlign: 'right', padding: '2px 4px' }}>순매수(백만)</th>
                  <th style={{ textAlign: 'right', padding: '2px 4px' }}>매수(백만)</th>
                  <th style={{ textAlign: 'right', padding: '2px 4px' }}>매도(백만)</th>
                </tr></thead>
                <tbody>
                  {progItems.map((item, idx) => (
                    <tr key={item.stockCode} style={{ borderTop: '1px solid #ccc' }}>
                      <td style={{ padding: '2px 4px', color: '#444', ...fs }}>{idx + 1}</td>
                      <td style={{ padding: '2px 4px', ...fs, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.stockName}</td>
                      <td style={{ padding: '2px 4px', ...fs, color: '#666' }}>{item.stockCode}</td>
                      <td style={{ textAlign: 'right', padding: '2px 4px', ...fs, ...pos(item.programNetBuyAmount) }}>{toMlnSigned(item.programNetBuyAmount)}</td>
                      <td style={{ textAlign: 'right', padding: '2px 4px', ...fs, color: '#444' }}>{toVolume(item.programBuyAmount)}</td>
                      <td style={{ textAlign: 'right', padding: '2px 4px', ...fs, color: '#444' }}>{toVolume(item.programSellAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* 지수 기여도 상위 */}
          <div className="nes-container with-title" style={{ minWidth: 0 }}>
            <p className="title" style={titleStyle}>[1136]지수기여도상위</p>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {MARKETS.map(m => (
                <button key={m} type="button" className={nesBtn(mktC === m)} style={{ fontSize: 13, padding: '4px 8px' }} onClick={() => setMktC(m)}>{m}</button>
              ))}
            </div>
            {contribLoading ? <p style={fs}>불러오는 중...</p> : contribItems.length === 0 ? <p style={fs}>데이터 없음</p> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', ...fs, tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '33%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '20%' }} />
                </colgroup>
                <thead><tr>
                  <th style={{ textAlign: 'left', padding: '2px 6px' }}>#</th>
                  <th style={{ textAlign: 'left', padding: '2px 6px' }}>종목명</th>
                  <th style={{ textAlign: 'left', padding: '2px 6px' }}>종목코드</th>
                  <th style={{ textAlign: 'right', padding: '2px 6px' }}>기여도</th>
                  <th style={{ textAlign: 'right', padding: '2px 6px' }}>등락률</th>
                </tr></thead>
                <tbody>
                  {contribItems.map(item => (
                    <tr key={item.rank} style={{ borderTop: '1px solid #ccc' }}>
                      <td style={{ padding: '2px 6px', color: '#444', ...fs }}>{item.rank}</td>
                      <td style={{ padding: '2px 6px', ...fs, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.stockName}</td>
                      <td style={{ padding: '2px 6px', ...fs, color: '#666' }}>{item.stockCode}</td>
                      <td style={{ textAlign: 'right', padding: '2px 6px', ...fs, ...pos(item.contributionScore) }}>{item.contributionScore.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', padding: '2px 6px', ...fs, ...pos(item.priceChangeRate) }}>{toPctSigned(item.priceChangeRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* 종목별 공매도 추이 */}
          <div className="nes-container with-title" style={{ gridColumn: '1 / -1', minWidth: 0 }}>
            <p className="title" style={titleStyle}>[0142]종목별공매도추이{shortCode ? ` — ${stockLabel(shortCode)}` : ''}</p>
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
                  <th style={{ textAlign: 'right', padding: '2px 6px' }}>공매도금액(천원)</th>
                </tr></thead>
                <tbody>
                  {shortItems.map(item => (
                    <tr key={item.tradeDate} style={{ borderTop: '1px solid #ccc' }}>
                      <td style={{ padding: '2px 6px', color: '#444', ...fs }}>{toYyMmDd(item.tradeDate)}</td>
                      <td style={{ textAlign: 'right', padding: '2px 6px', ...fs }}>{toVolume(item.closePrice)}</td>
                      <td style={{ textAlign: 'right', padding: '2px 6px', ...fs, ...pos(item.priceChange) }}>{toPctSigned(item.changeRate)}</td>
                      <td style={{ textAlign: 'right', padding: '2px 6px', ...fs, color: '#444' }}>{toVolume(item.shortVolume)}</td>
                      <td style={{ textAlign: 'right', padding: '2px 6px', ...fs, color: '#444' }}>{toPct(item.shortRatio)}</td>
                      <td style={{ textAlign: 'right', padding: '2px 6px', ...fs, color: '#444' }}>{toVolume(item.shortAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* 프로그램매매추이 — 종목별 */}
          <div className="nes-container with-title" style={{ gridColumn: '1 / -1', minWidth: 0 }}>
            <p className="title" style={titleStyle}>[0778]프로그램매매추이-종목별{shortCode ? ` — ${stockLabel(shortCode)}` : ''}</p>
            {!shortCode ? (
              <p style={fs}>관심종목 없음</p>
            ) : progHistLoading ? (
              <p style={fs}>불러오는 중...</p>
            ) : progHistItems.length === 0 ? (
              <p style={fs}>데이터 없음</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', ...fs }}>
                <thead><tr>
                  <th style={{ textAlign: 'left', padding: '2px 6px' }}>시간</th>
                  <th style={{ textAlign: 'right', padding: '2px 6px' }}>순매수(백만)</th>
                  <th style={{ textAlign: 'right', padding: '2px 6px' }}>매수(백만)</th>
                  <th style={{ textAlign: 'right', padding: '2px 6px' }}>매도(백만)</th>
                </tr></thead>
                <tbody>
                  {progHistItems.map(item => (
                    <tr key={item.snapshotTime} style={{ borderTop: '1px solid #ccc' }}>
                      <td style={{ padding: '2px 6px', color: '#444', ...fs }}>{toTimeLabel(item.snapshotTime)}</td>
                      <td style={{ textAlign: 'right', padding: '2px 6px', ...fs, ...pos(item.programNetBuyAmount) }}>{toMlnSigned(item.programNetBuyAmount)}</td>
                      <td style={{ textAlign: 'right', padding: '2px 6px', ...fs, color: '#444' }}>{toVolume(item.programBuyAmount)}</td>
                      <td style={{ textAlign: 'right', padding: '2px 6px', ...fs, color: '#444' }}>{toVolume(item.programSellAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
