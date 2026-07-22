import { useState } from 'react'
import type { IntradayTopItem, MarketQuery, IntradayInvestor, IntradayRanking } from '@/types/api'
import { toMlnSigned, signClass, investorLabel, marketLabel, rankingLabel, isStale } from '@/utils/format'
import { useIntradayTop } from '@/hooks/useIntradayTop'
import DataTable, { type DataTableColumn } from './DataTable'
import TabSelector from './TabSelector'
import WidgetSection from './WidgetSection'

const MARKETS: MarketQuery[] = ['KOSPI', 'KOSDAQ', 'COMBINED']
const INVESTORS: IntradayInvestor[] = ['FOREIGN_TOTAL', 'FOREIGNER', 'INSTITUTION', 'PENSION_FUND', 'TRUST']
const RANKINGS: IntradayRanking[] = ['NET_BUY', 'NET_SELL']

// 홈 위젯엔 market/investor/ranking 탭만 있고 amtQty 선택 UI가 없어 대시보드 기본값으로 고정.
const FIXED_AMT_QTY = 'AMOUNT' as const

const columns: DataTableColumn<IntradayTopItem>[] = [
  { header: '#', width: 32, render: (_, idx) => idx + 1 },
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
    header: '순매수(백만)',
    render: item => toMlnSigned(item.netBuyAmount),
    cellClassName: item => signClass(item.netBuyAmount),
  },
]

export default function IntradayTopSection() {
  const [market, setMarket] = useState<MarketQuery>('KOSPI')
  const [investor, setInvestor] = useState<IntradayInvestor>('FOREIGNER')
  const [ranking, setRanking] = useState<IntradayRanking>('NET_BUY')
  const { items, snapshotTime, isLoading, isError } = useIntradayTop(market, investor, ranking, FIXED_AMT_QTY)
  const stale = isStale(snapshotTime, items?.[0]?.snapshotTime)

  return (
    <WidgetSection
      title="장중 투자자별 매매 상위"
      stale={stale}
      actions={
        <>
          <TabSelector options={MARKETS} value={market} onChange={setMarket} labelFor={marketLabel} />
          <TabSelector options={INVESTORS} value={investor} onChange={setInvestor} labelFor={investorLabel} />
          <TabSelector options={RANKINGS} value={ranking} onChange={setRanking} labelFor={rankingLabel} />
        </>
      }
    >
      {!items ? (
        <div className="p-8 text-center text-xs text-gray-500">
          {isError ? '데이터를 불러오지 못했습니다' : isLoading ? '불러오는 중...' : '데이터가 없습니다'}
        </div>
      ) : items.length === 0 ? (
        <div className="p-8 text-center text-xs text-gray-500">수집된 데이터가 없습니다</div>
      ) : (
        <DataTable items={items} columns={columns} rowKey={item => item.stockCode} />
      )}
    </WidgetSection>
  )
}
