import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ProgramRankingSchema, type ProgramTradingRankingItem, type ProgramRanking } from '@/types/api'
import { toEokSignedFromMln, toEokFromMln, signClass, isStale } from '@/utils/format'
import { useProgramTradingRankings } from '@/hooks/useProgramTradingRankings'
import DataTable, { type DataTableColumn } from './DataTable'
import TabSelector from './TabSelector'

const RANKINGS = ProgramRankingSchema.options
const rankingLabel = (r: ProgramRanking) => (r === 'NET_BUY' ? '순매수' : '순매도')

const columns: DataTableColumn<ProgramTradingRankingItem>[] = [
  { header: '#', width: 32, render: (_, idx) => idx + 1 },
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
    header: '프로그램순매수(억)',
    render: item => toEokSignedFromMln(item.programNetBuyAmount),
    cellClassName: item => signClass(item.programNetBuyAmount),
  },
  { header: '매수(억)', render: item => toEokFromMln(item.programBuyAmount) },
  { header: '매도(억)', render: item => toEokFromMln(item.programSellAmount) },
]

// 홈 위젯엔 ranking 탭만 있고 market/amtQty 선택 UI가 없어 대시보드 기본값으로 고정.
// (전체보기 페이지에서는 이 두 값도 선택 가능하게 함)
const FIXED_MARKET = 'KOSPI' as const
const FIXED_AMT_QTY = 'AMOUNT' as const

export default function ProgramTradingSection() {
  const [ranking, setRanking] = useState<ProgramRanking>('NET_BUY')
  const { items, snapshotTime, isLoading, isError } = useProgramTradingRankings(ranking, FIXED_MARKET, FIXED_AMT_QTY)
  const stale = isStale(snapshotTime, items?.[0]?.snapshotTime)

  return (
    <section className={`section ${stale ? 'stale' : ''}`}>
      <div className="section-header">
        <h2>프로그램 매매 상위</h2>
        <div className="actions">
          <TabSelector options={RANKINGS} value={ranking} onChange={setRanking} labelFor={rankingLabel} />
          <Link
            to={`/program-trading?ranking=${ranking}`}
            style={{ fontSize: 12, color: 'var(--text-muted)' }}
          >
            전체 보기 →
          </Link>
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
