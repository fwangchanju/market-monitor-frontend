import { useEffect, useState } from 'react'
import {
  getShortSellingHistory,
  getProgramTradingHistory, getStocks,
} from '../api/marketSummary'
import { useWatchStocks } from '../hooks/useWatchStocks'
import MarketOverviewSection from '../components/MarketOverviewSection'
import InvestorTradingSection from '../components/InvestorTradingSection'
import WatchStockSection from '../components/WatchStockSection'
import IntradayTopSection from '../components/IntradayTopSection'
import ProgramTradingSection from '../components/ProgramTradingSection'
import IndexContributionSection from '../components/IndexContributionSection'
import {
  type ProgramTradingHistoryItem,
  type ShortSellingHistoryItem,
} from '../types/api'
import {
  toMlnSigned, toPctSigned, toPct, toVolume, toTimeLabel, toYyMmDd,
} from '../utils/format'

const RED = '#cc0000'
const BLUE = '#0000aa'
const pos = (v: number) => ({ color: v > 0 ? RED : v < 0 ? BLUE : undefined })

// nes.css 기본 .title은 font-size: 1rem(=:root font-size 14px)을 따라가고 색상도 지정하지 않아
// 상단 헤더(16px)와 크기가 어긋나고, 배경(#fff)에 밝은 글자색이 상속되어 잘 안 보이므로 명시적으로 지정
const titleStyle = { fontSize: 16, color: '#000' }

export default function MarketSummaryPage() {
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

  const fs = { fontSize: 14 }

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
