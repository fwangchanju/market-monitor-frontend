import { useState } from 'react'
import { MarketSchema, type IndexContributionItem, type Market } from '@/types/api'
import { toPctSigned, signClass, isStale } from '@/utils/format'
import { useIndexContribution } from '@/hooks/useIndexContribution'
import DataTable, { type DataTableColumn } from './DataTable'
import TabSelector from './TabSelector'
import WidgetSection from './WidgetSection'

const MARKETS = MarketSchema.options

const columns: DataTableColumn<IndexContributionItem>[] = [
  { header: '#', width: 32, render: item => item.rank },
  {
    header: '종목',
    align: 'left',
    render: item => (
      <>
        <span>{item.stockName}</span>
        <span className="ml-1.5 text-[11px] text-gray-500">{item.stockCode}</span>
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
  const { items, snapshotTime, isLoading, isError } = useIndexContribution(market)
  const stale = isStale(snapshotTime, items?.[0]?.snapshotTime)

  return (
    <WidgetSection
      title="지수 기여도 상위"
      stale={stale}
      actions={<TabSelector options={MARKETS} value={market} onChange={setMarket} />}
    >
      {!items ? (
        <div className="p-8 text-center text-xs text-gray-500">
          {isError ? '데이터를 불러오지 못했습니다' : isLoading ? '불러오는 중...' : '데이터가 없습니다'}
        </div>
      ) : items.length === 0 ? (
        <div className="p-8 text-center text-xs text-gray-500">{market} 데이터 없음</div>
      ) : (
        <DataTable items={items} columns={columns} rowKey={item => `${item.rank}-${item.stockCode}`} />
      )}
    </WidgetSection>
  )
}
