import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MarketSchema, type IndexContributionItem, type Market } from '../types/api'
import { toPctSigned, signClass } from '../utils/format'
import { useIndexContribution } from '../hooks/useIndexContribution'
import DataTable, { type DataTableColumn } from './DataTable'
import TabSelector from './TabSelector'

const MARKETS = MarketSchema.options

const columns: DataTableColumn<IndexContributionItem>[] = [
  { header: '#', width: 32, render: item => item.rank },
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
    header: '기여도',
    render: item => item.contributionScore.toFixed(2),
    cellClassName: item => signClass(item.contributionScore),
  },
  {
    header: '등락률',
    render: item => toPctSigned(item.priceChangeRate),
    cellClassName: item => signClass(item.priceChangeRate),
  },
]

export default function IndexContributionSection() {
  const [market, setMarket] = useState<Market>('KOSPI')
  const { items, isLoading, isError } = useIndexContribution(market)

  return (
    <section className="section">
      <div className="section-header">
        <h2>지수 기여도 상위</h2>
        <div className="actions">
          <TabSelector options={MARKETS} value={market} onChange={setMarket} />
          <Link
            to={`/index-contribution?market=${market}`}
            style={{ fontSize: 12, color: 'var(--text-muted)' }}
          >
            전체 보기 →
          </Link>
        </div>
      </div>

      {!items ? (
        <div className="empty-state">{isError ? '데이터를 불러오지 못했습니다' : isLoading ? '불러오는 중...' : '데이터가 없습니다'}</div>
      ) : items.length === 0 ? (
        <div className="empty-state">{market} 데이터 없음</div>
      ) : (
        <DataTable items={items} columns={columns} rowKey={item => `${item.rank}-${item.stockCode}`} />
      )}
    </section>
  )
}
