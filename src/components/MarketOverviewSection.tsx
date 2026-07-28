import { useMarketSummary } from '@/hooks/useMarketSummary'
import { toIndex, toEokFromMln, toPctSigned, signClass, isStale } from '@/utils/format'
import WidgetSection from './WidgetSection'

export default function MarketOverviewSection() {
  const { data, isError } = useMarketSummary()

  if (!data) {
    return (
      <WidgetSection title="시장종합">
        {isError && <div className="p-8 text-center text-xs text-gray-500">데이터를 불러오지 못했습니다</div>}
      </WidgetSection>
    )
  }

  const items = data.marketOverviews.items

  if (items.length === 0) {
    return (
      <WidgetSection title="시장종합">
        <div className="p-8 text-center text-xs text-gray-500">수집된 데이터가 없습니다</div>
      </WidgetSection>
    )
  }

  const stale = isStale(data.marketOverviews.snapshotTime, items[0]?.snapshotTime)

  return (
    <WidgetSection title="시장종합" stale={stale}>
      <div className="flex flex-wrap">
        {items.map(item => (
          <div
            key={item.market}
            className="w-full border-b border-gray-600 px-4 py-2 last:border-b-0 sm:w-auto sm:flex-1 sm:border-b-0 sm:border-r sm:last:border-r-0"
          >
            <div className="text-xs text-gray-500">{item.market}</div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className={`text-2xl font-bold tabular-nums ${signClass(item.changeValue)}`}>
                  {toIndex(item.indexValue)}
                </div>
                <div className={`mt-1 text-sm ${signClass(item.changeValue)}`}>
                  {toPctSigned(item.changeRate)} &nbsp; {item.changeValue > 0 ? '+' : ''}{toIndex(item.changeValue)}
                </div>
                <div className="mt-2 whitespace-nowrap text-xs text-gray-500">거래대금 {toEokFromMln(item.tradingValue)}억</div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 whitespace-nowrap text-xs text-gray-400">
                <div>상승 : <span className="positive">{item.advancers}</span></div>
                <div>상한 : <span className="positive">{item.upperLimitCount}</span></div>
                <div>하락 : <span className="negative">{item.decliners}</span></div>
                <div>하한 : <span className="negative">{item.lowerLimitCount}</span></div>
                <div>보합 : {item.unchangedCount}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </WidgetSection>
  )
}
