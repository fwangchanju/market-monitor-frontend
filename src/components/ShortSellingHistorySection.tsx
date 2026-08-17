import { useState } from 'react'
import type { ShortSellingHistoryItem } from '@/types/api'
import { toYyMmDd, toVolume, toPct, toPctSigned, signClass } from '@/utils/format'
import { useShortSellingHistory } from '@/hooks/useShortSellingHistory'
import { useWatchStocks } from '@/hooks/useWatchStocks'
import DataTable, { type DataTableColumn } from './DataTable'
import Spinner from './Spinner'
import WidgetSection from './WidgetSection'

const columns: DataTableColumn<ShortSellingHistoryItem>[] = [
  { header: '일자', align: 'left', render: item => toYyMmDd(item.tradeDate) },
  { header: '종가', render: item => toVolume(item.closePrice) },
  {
    header: '등락률',
    render: item => toPctSigned(item.changeRate),
    cellClassName: item => signClass(item.priceChange),
  },
  { header: '공매도량', render: item => toVolume(item.shortVolume) },
  { header: '비중', render: item => toPct(item.shortRatio) },
  { header: '공매도금액', render: item => toVolume(item.shortAmount) },
]

export default function ShortSellingHistorySection() {
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const { data: watchStocks } = useWatchStocks()
  const { stockCode, items, isLoading, isError } = useShortSellingHistory(selectedCode)
  const defaultStockName = watchStocks?.find(s => s.stockCode === stockCode)?.stockName

  return (
    <WidgetSection
      title="종목별 공매도 추이"
      unit={
        <div className="flex items-center gap-4">
          <span className="text-xs text-white">단위: 천원</span>
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
    >
      {isLoading ? (
        <div className="flex justify-center p-8">
          <Spinner />
        </div>
      ) : isError ? (
        <div className="p-8 text-center text-xs text-gray-500">데이터를 불러오지 못했습니다</div>
      ) : !items || items.length === 0 ? (
        <div className="p-8 text-center text-xs text-gray-500">데이터가 없습니다</div>
      ) : (
        <DataTable items={items.slice(0, 10)} columns={columns} rowKey={item => item.tradeDate} />
      )}
    </WidgetSection>
  )
}
