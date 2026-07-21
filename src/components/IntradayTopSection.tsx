import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { IntradayTopItem, MarketQuery, IntradayInvestor, IntradayRanking } from '@/types/api'
import { toMlnSigned, signClass, investorLabel, marketLabel, rankingLabel } from '@/utils/format'
import { useIntradayTop } from '@/hooks/useIntradayTop'
import DataTable, { type DataTableColumn } from './DataTable'
import TabSelector from './TabSelector'

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
        <Link to={`/stocks/${item.stockCode}`}>{item.stockName}</Link>
        <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-muted)' }}>
          {item.stockCode}
        </span>
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
  const { items, isLoading, isError } = useIntradayTop(market, investor, ranking, FIXED_AMT_QTY)

  return (
    <section className="section">
      <div className="section-header">
        <h2>장중 투자자별 매매 상위</h2>
        <div className="actions">
          <TabSelector options={MARKETS} value={market} onChange={setMarket} labelFor={marketLabel} />
          <TabSelector options={INVESTORS} value={investor} onChange={setInvestor} labelFor={investorLabel} />
          <TabSelector options={RANKINGS} value={ranking} onChange={setRanking} labelFor={rankingLabel} />
        </div>
      </div>

      {!items ? (
        <div className="empty-state">{isError ? '데이터를 불러오지 못했습니다' : isLoading ? '불러오는 중...' : '데이터가 없습니다'}</div>
      ) : items.length === 0 ? (
        <div className="empty-state">수집된 데이터가 없습니다</div>
      ) : (
        <DataTable items={items} columns={columns} rowKey={item => item.stockCode} />
      )}
    </section>
  )
}
