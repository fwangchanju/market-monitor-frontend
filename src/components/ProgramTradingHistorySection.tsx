import { useState } from 'react'
import type { ProgramTradingDailyItem, ProgramTradingHistoryItem } from '@/types/api'
import { toMlnSigned, toVolume, toTimeLabel, toDateLabel, signClass, isStale } from '@/utils/format'
import { useProgramTradingHistory } from '@/hooks/useProgramTradingHistory'
import { useProgramTradingDailyHistory } from '@/hooks/useProgramTradingDailyHistory'
import { useWatchStocks } from '@/hooks/useWatchStocks'
import DataTable, { type DataTableColumn } from './DataTable'
import TabSelector from './TabSelector'

type Granularity = 'INTRADAY' | 'DAILY'
const GRANULARITIES: Granularity[] = ['INTRADAY', 'DAILY']
const granularityLabel = (g: Granularity) => (g === 'INTRADAY' ? '장중' : '일별')

const intradayColumns: DataTableColumn<ProgramTradingHistoryItem>[] = [
  { header: '시간', align: 'left', render: item => toTimeLabel(item.snapshotTime) },
  {
    header: '순매수(백만)',
    render: item => toMlnSigned(item.programNetBuyAmount),
    cellClassName: item => signClass(item.programNetBuyAmount),
  },
  { header: '매수(백만)', render: item => toVolume(item.programBuyAmount) },
  { header: '매도(백만)', render: item => toVolume(item.programSellAmount) },
]

const dailyColumns: DataTableColumn<ProgramTradingDailyItem>[] = [
  { header: '일자', align: 'left', render: item => toDateLabel(item.tradeDate) },
  {
    header: '순매수(백만)',
    render: item => toMlnSigned(item.programNetBuyAmount),
    cellClassName: item => signClass(item.programNetBuyAmount),
  },
  { header: '매수(백만)', render: item => toVolume(item.programBuyAmount) },
  { header: '매도(백만)', render: item => toVolume(item.programSellAmount) },
]

export default function ProgramTradingHistorySection() {
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [granularity, setGranularity] = useState<Granularity>('INTRADAY')
  const { data: watchStocks } = useWatchStocks()
  const mainStockCode = watchStocks?.find(s => s.isMain)?.stockCode ?? watchStocks?.[0]?.stockCode ?? null

  // 번들에는 일별 데이터가 없어 일별 + 기본 종목 조합에서도 실제 종목코드로 전용 조회해야 함.
  const intraday = useProgramTradingHistory(granularity === 'INTRADAY' ? selectedCode : null)
  const dailyStockCode = granularity === 'DAILY' ? (selectedCode ?? mainStockCode) : null
  const daily = useProgramTradingDailyHistory(dailyStockCode)

  const { stockCode, items, isLoading, isError } = granularity === 'INTRADAY' ? intraday : daily
  const stale = granularity === 'INTRADAY' && isStale(intraday.snapshotTime, intraday.items?.[0]?.snapshotTime)

  return (
    <section className={`section ${stale ? 'stale' : ''}`}>
      <div className="section-header">
        <h2>프로그램매매 추이 — 종목별</h2>
        <div className="actions">
          <select value={selectedCode ?? ''} onChange={e => setSelectedCode(e.target.value || null)}>
            <option value="">기본 종목</option>
            {watchStocks?.map(s => (
              <option key={s.stockCode} value={s.stockCode}>
                {s.stockName}({s.stockCode})
              </option>
            ))}
          </select>
          <TabSelector options={GRANULARITIES} value={granularity} onChange={setGranularity} labelFor={granularityLabel} />
        </div>
      </div>

      {!items ? (
        <div className="empty-state">
          {isError ? '데이터를 불러오지 못했습니다' : isLoading ? '불러오는 중...' : !stockCode ? '관심종목 없음' : '데이터가 없습니다'}
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">수집된 데이터가 없습니다</div>
      ) : granularity === 'INTRADAY' ? (
        <DataTable items={items as ProgramTradingHistoryItem[]} columns={intradayColumns} rowKey={item => item.snapshotTime} />
      ) : (
        <DataTable items={items as ProgramTradingDailyItem[]} columns={dailyColumns} rowKey={item => item.tradeDate} />
      )}
    </section>
  )
}
