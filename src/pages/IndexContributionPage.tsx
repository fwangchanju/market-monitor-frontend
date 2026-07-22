import { Link, useSearchParams } from 'react-router-dom'
import { useIndexContribution } from '@/hooks/useIndexContribution'
import DataTable, { type DataTableColumn } from '@/components/DataTable'
import TabSelector from '@/components/TabSelector'
import { MarketSchema, type IndexContributionItem } from '@/types/api'
import { toPctSigned, signClass } from '@/utils/format'

const MARKETS = MarketSchema.options

const columns: DataTableColumn<IndexContributionItem>[] = [
  { header: '#', width: 32, render: item => item.rank },
  {
    header: '종목',
    align: 'left',
    render: item => (
      <>
        <span>{item.stockName}</span>
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

export default function IndexContributionPage() {
  const [params, setParams] = useSearchParams()
  const market = MarketSchema.catch('KOSPI').parse(params.get('market'))

  const { items, isLoading, isError } = useIndexContribution(market)

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
          <h2>지수 기여도 상위</h2>
        </div>
      </header>
      <div className="page">
        <section className="section">
          <div className="section-header">
            <div className="actions">
              <TabSelector options={MARKETS} value={market} onChange={v => set('market', v)} />
            </div>
          </div>

          {!items ? (
            <div className={isError ? 'empty-state' : 'loading'}>
              {isError ? '데이터를 불러오지 못했습니다' : isLoading ? '불러오는 중...' : '데이터가 없습니다'}
            </div>
          ) : items.length === 0 ? (
            <div className="empty-state">{market} 데이터 없음</div>
          ) : (
            <DataTable items={items} columns={columns} rowKey={item => `${item.rank}-${item.stockCode}`} />
          )}
        </section>
      </div>
    </>
  )
}
