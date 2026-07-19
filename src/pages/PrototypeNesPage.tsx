import { useEffect, useState } from 'react'
import {
  getIntradayTop, getShortSellingHistory,
  getProgramTradingHistory, getStocks,
} from '../api/dashboard'
import { useWatchStocks } from '../hooks/useWatchStocks'
import MarketOverviewSection from '../components/MarketOverviewSection'
import InvestorTradingSection from '../components/InvestorTradingSection'
import WatchStockSection from '../components/WatchStockSection'
import ProgramTradingSection from '../components/ProgramTradingSection'
import IndexContributionSection from '../components/IndexContributionSection'
import type {
  MarketQuery,
  IntradayTopItem,
  IntradayInvestor,
  IntradayRanking,
  ProgramTradingHistoryItem,
  ShortSellingHistoryItem,
} from '../types/api'
import {
  toMlnSigned, toPctSigned, toPct, toVolume, toTimeLabel, toYyMmDd, investorLabel,
} from '../utils/format'

const EXCHANGES: MarketQuery[] = ['KOSPI', 'KOSDAQ', 'ALL']
const ID_INVESTORS: IntradayInvestor[] = [
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
  // 장중 투자자별 매매
  const [idMarket, setIdMarket] = useState<MarketQuery>('KOSPI')
  const [idInvestor, setIdInvestor] = useState<IntradayInvestor>('FOREIGNER')
  const [idRanking, setIdRanking] = useState<IntradayRanking>('NET_BUY')
  const [idItems, setIdItems] = useState<IntradayTopItem[]>([])
  const [idLoading, setIdLoading] = useState(true)

  // 공매도 추이 / 프로그램매매 추이 (종목별, 관심종목 기준 종목)
  const [shortItems, setShortItems] = useState<ShortSellingHistoryItem[]>([])
  const [shortLoading, setShortLoading] = useState(false)
  const [progHistItems, setProgHistItems] = useState<ProgramTradingHistoryItem[]>([])
  const [progHistLoading, setProgHistLoading] = useState(false)

  // 종목코드 → 종목명 캐시
  const [stockNames, setStockNames] = useState<Record<string, string>>({})

  const { data: watchStocks } = useWatchStocks()
  const primary = watchStocks?.find(s => s.isMain) ?? watchStocks?.[0]
  const shortCode = primary?.stockCode ?? null

  useEffect(() => {
    getStocks().then(list => {
      setStockNames(Object.fromEntries(list.map(s => [s.stockCode, s.stockName])))
    })
  }, [])

  const stockLabel = (code: string) => stockNames[code] ? `${stockNames[code]}(${code})` : code

  useEffect(() => {
    if (!shortCode) return

    setShortLoading(true)
    getShortSellingHistory(shortCode)
      .then(r => setShortItems(r.items))
      .finally(() => setShortLoading(false))

    const today = new Date().toISOString().slice(0, 10)

    setProgHistLoading(true)
    getProgramTradingHistory(shortCode, `${today}T09:00:00`, `${today}T15:30:00`)
      .then(r => setProgHistItems(r.items))
      .finally(() => setProgHistLoading(false))
  }, [shortCode])

  useEffect(() => {
    setIdLoading(true)
    getIntradayTop(idMarket, idInvestor, idRanking)
      .then(r => setIdItems(r.items))
      .finally(() => setIdLoading(false))
  }, [idMarket, idInvestor, idRanking])

  const fs = { fontSize: 14 }

  return (
    <div style={{ background: '#fff', minHeight: '100vh', padding: 16, color: '#000' }}>
      <div style={{ maxWidth: '60%', margin: '0 auto' }}>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>

          <MarketOverviewSection />

          <InvestorTradingSection />

          <WatchStockSection />

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
              {(['NET_BUY', 'NET_SELL'] as IntradayRanking[]).map(r => (
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

          <ProgramTradingSection />

          <IndexContributionSection />

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
