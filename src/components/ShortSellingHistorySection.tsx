import { useState } from 'react'
import type { ShortSellingHistoryItem } from '@/types/api'
import { toYyMmDd, toVolume, toPct, toPctSigned, signClass } from '@/utils/format'
import { useShortSellingHistory } from '@/hooks/useShortSellingHistory'
import { useWatchStocks } from '@/hooks/useWatchStocks'
import DataTable, { type DataTableColumn } from './DataTable'
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
  { header: '공매도금액(천원)', render: item => toVolume(item.shortAmount) },
]

export default function ShortSellingHistorySection() {
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const { data: watchStocks } = useWatchStocks()
  const { stockCode, items, isLoading, isError } = useShortSellingHistory(selectedCode)

  return (
    <WidgetSection
      title="종목별 공매도 추이"
      actions={
        <div className="nes-select is-dark w-40">
          <select value={selectedCode ?? ''} onChange={e => setSelectedCode(e.target.value || null)}>
            <option value="">기본 종목</option>
            {watchStocks?.map(s => (
              <option key={s.stockCode} value={s.stockCode}>
                {s.stockName}({s.stockCode})
              </option>
            ))}
          </select>
        </div>
      }
    >
      {!items ? (
        <div className="p-8 text-center text-xs text-gray-500">
          {isError ? '데이터를 불러오지 못했습니다' : isLoading ? '불러오는 중...' : !stockCode ? '관심종목 없음' : '데이터가 없습니다'}
        </div>
      ) : items.length === 0 ? (
        <div className="p-8 text-center text-xs text-gray-500">수집된 데이터가 없습니다</div>
      ) : (
        <DataTable items={items} columns={columns} rowKey={item => item.tradeDate} />
      )}
    </WidgetSection>
  )
}
