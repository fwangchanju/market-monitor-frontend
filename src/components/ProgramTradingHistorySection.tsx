import { useState } from 'react'
import type { ProgramTradingDailyItem, ProgramTradingHistoryItem } from '@/types/api'
import { toMlnSigned, toVolume, toDateTimeLabel, toDateLabel, signClass, isStale } from '@/utils/format'
import { useProgramTradingHistory } from '@/hooks/useProgramTradingHistory'
import { useProgramTradingDailyHistory } from '@/hooks/useProgramTradingDailyHistory'
import { useWatchStocks } from '@/hooks/useWatchStocks'
import DataTable, { type DataTableColumn } from './DataTable'
import TabSelector from './TabSelector'
import WidgetSection from './WidgetSection'

type Granularity = 'INTRADAY' | 'DAILY'
const GRANULARITIES: Granularity[] = ['INTRADAY', 'DAILY']
const granularityLabel = (g: Granularity) => (g === 'INTRADAY' ? '장중' : '일별')

const intradayColumns: DataTableColumn<ProgramTradingHistoryItem>[] = [
  { header: '일시', align: 'left', render: item => toDateTimeLabel(item.snapshotTime) },
  {
    header: '순매수',
    render: item => toMlnSigned(item.programNetBuyAmount),
    cellClassName: item => signClass(item.programNetBuyAmount),
  },
  { header: '매수', render: item => toVolume(item.programBuyAmount) },
  { header: '매도', render: item => toVolume(item.programSellAmount) },
]

const dailyColumns: DataTableColumn<ProgramTradingDailyItem>[] = [
  { header: '일자', align: 'left', render: item => toDateLabel(item.tradeDate) },
  {
    header: '순매수',
    render: item => toMlnSigned(item.programNetBuyAmount),
    cellClassName: item => signClass(item.programNetBuyAmount),
  },
  { header: '매수', render: item => toVolume(item.programBuyAmount) },
  { header: '매도', render: item => toVolume(item.programSellAmount) },
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
  const defaultStockName = watchStocks?.find(s => s.stockCode === stockCode)?.stockName

  return (
    <WidgetSection
      title="프로그램매매 추이 — 종목별"
      unit={
        <div className="flex items-center gap-4">
          <span className="text-xs text-white">단위: 백만</span>
          <div className="nes-select is-dark w-40 text-xs">
            <select value={selectedCode ?? ''} onChange={e => setSelectedCode(e.target.value || null)}>
              <option value="">{defaultStockName ?? '종목선택'}</option>
              {watchStocks?.map(s => (
                <option key={s.stockCode} value={s.stockCode}>
                  {s.stockName}({s.stockCode})
                </option>
              ))}
            </select>
          </div>
        </div>
      }
      stale={stale}
      actions={<TabSelector options={GRANULARITIES} value={granularity} onChange={setGranularity} labelFor={granularityLabel} />}
    >
      {isLoading ? null : isError ? (
        <div className="p-8 text-center text-xs text-gray-500">데이터를 불러오지 못했습니다</div>
      ) : !items || items.length === 0 ? (
        <div className="p-8 text-center text-xs text-gray-500">데이터가 없습니다</div>
      ) : granularity === 'INTRADAY' ? (
        <DataTable items={(items as ProgramTradingHistoryItem[]).slice(0, 10)} columns={intradayColumns} rowKey={item => item.snapshotTime} />
      ) : (
        <DataTable items={(items as ProgramTradingDailyItem[]).slice(0, 10)} columns={dailyColumns} rowKey={item => item.tradeDate} />
      )}
    </WidgetSection>
  )
}
