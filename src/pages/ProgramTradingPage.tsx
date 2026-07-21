import { Link, useSearchParams } from 'react-router-dom'
import { useProgramTradingRankings } from '../hooks/useProgramTradingRankings'
import DataTable, { type DataTableColumn } from '../components/DataTable'
import TabSelector from '../components/TabSelector'
import {
  AmtQtySchema, MarketQuerySchema, ProgramRankingSchema,
  type AmtQty, type MarketQuery, type ProgramTradingRankingItem, type ProgramRanking,
} from '../types/api'
import { toEokSignedFromMln, toEokFromMln, signClass } from '../utils/format'

const RANKINGS = ProgramRankingSchema.options
const MARKETS = MarketQuerySchema.options
const AMT_QTYS = AmtQtySchema.options

const rankingLabel = (r: ProgramRanking) => (r === 'NET_BUY' ? '순매수' : '순매도')
const marketLabel = (m: MarketQuery) => (m === 'COMBINED' ? '통합' : m)
const amtQtyLabel = (a: AmtQty) => (a === 'AMOUNT' ? '금액' : '수량')

const columns: DataTableColumn<ProgramTradingRankingItem>[] = [
  { header: '#', width: 32, render: (_, idx) => idx + 1 },
  {
    header: '종목',
    align: 'left',
    render: item => (
      <>
        <Link to={`/stocks/${item.stockCode}`}>{item.stockName}</Link>
        <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-muted)' }}>
          {item.stockCode}
        </span>
      </>
    ),
  },
  {
    header: '프로그램순매수(억)',
    render: item => toEokSignedFromMln(item.programNetBuyAmount),
    cellClassName: item => signClass(item.programNetBuyAmount),
  },
  { header: '매수(억)', render: item => toEokFromMln(item.programBuyAmount) },
  { header: '매도(억)', render: item => toEokFromMln(item.programSellAmount) },
]

export default function ProgramTradingPage() {
  const [params, setParams] = useSearchParams()
  const ranking = ProgramRankingSchema.catch('NET_BUY').parse(params.get('ranking'))
  const market = MarketQuerySchema.catch('KOSPI').parse(params.get('market'))
  const amtQty = AmtQtySchema.catch('AMOUNT').parse(params.get('amtQty'))

  const { items, isLoading, isError } = useProgramTradingRankings(ranking, market, amtQty)

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
          <h2>프로그램 매매 상위</h2>
        </div>
      </header>
      <div className="page">
        <section className="section">
          <div className="section-header">
            <div className="actions">
              <TabSelector options={MARKETS} value={market} onChange={v => set('market', v)} labelFor={marketLabel} />
              <TabSelector options={AMT_QTYS} value={amtQty} onChange={v => set('amtQty', v)} labelFor={amtQtyLabel} />
              <TabSelector options={RANKINGS} value={ranking} onChange={v => set('ranking', v)} labelFor={rankingLabel} />
            </div>
          </div>

          {!items ? (
            <div className={isError ? 'empty-state' : 'loading'}>
              {isError ? '데이터를 불러오지 못했습니다' : isLoading ? '불러오는 중...' : '데이터가 없습니다'}
            </div>
          ) : items.length === 0 ? (
            <div className="empty-state">수집된 데이터가 없습니다</div>
          ) : (
            <DataTable items={items} columns={columns} rowKey={item => item.stockCode} />
          )}
        </section>
      </div>
    </>
  )
}
