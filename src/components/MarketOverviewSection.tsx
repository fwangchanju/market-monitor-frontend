import { useMarketSummary } from '@/hooks/useMarketSummary'
import { toIndex, toEokFromMln, toPctSigned, signClass, isStale } from '@/utils/format'
import WidgetSection from './WidgetSection'

export default function MarketOverviewSection() {
  const { data, isError } = useMarketSummary()

  if (!data) {
    return (
      <WidgetSection title="시장종합">
        <div className="p-8 text-center text-xs text-gray-500">
          {isError ? '데이터를 불러오지 못했습니다' : '불러오는 중...'}
        </div>
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
          <div key={item.market} className="flex-1 border-r border-gray-600 px-4 py-2 last:border-r-0">
            <div className="text-xs text-gray-500">{item.market}</div>
            <div className={`text-2xl font-bold tabular-nums ${signClass(item.changeValue)}`}>
              {toIndex(item.indexValue)}
            </div>
            <div className={`mt-1 text-sm ${signClass(item.changeValue)}`}>
              {toPctSigned(item.changeRate)} &nbsp; {item.changeValue > 0 ? '+' : ''}{toIndex(item.changeValue)}
            </div>
            <div className="mt-2 flex gap-3 text-xs text-gray-500">
              <span>거래대금 {toEokFromMln(item.tradingValue)}억</span>
              <span className="positive">▲{item.advancers}</span>
              <span className="negative">▼{item.decliners}</span>
              <span>—{item.unchangedCount}</span>
            </div>
          </div>
        ))}
      </div>
    </WidgetSection>
  )
}
