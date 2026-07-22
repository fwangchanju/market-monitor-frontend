import { useMarketSummary } from '@/hooks/useMarketSummary'
import { toIndex, toEokFromMln, toPctSigned, signClass, isStale } from '@/utils/format'

export default function MarketOverviewSection() {
  const { data, isError } = useMarketSummary()

  if (!data) {
    return (
      <section className="section">
        <div className="section-header"><h2>시장종합</h2></div>
        <div className="empty-state">{isError ? '데이터를 불러오지 못했습니다' : '불러오는 중...'}</div>
      </section>
    )
  }

  const items = data.marketOverviews.items

  if (items.length === 0) {
    return (
      <section className="section">
        <div className="section-header"><h2>시장종합</h2></div>
        <div className="empty-state">수집된 데이터가 없습니다</div>
      </section>
    )
  }

  const stale = isStale(data.marketOverviews.snapshotTime, items[0]?.snapshotTime)

  return (
    <section className={`section ${stale ? 'stale' : ''}`}>
      <div className="section-header">
        <h2>시장종합</h2>
      </div>
      <div className="market-cards">
        {items.map(item => (
          <div key={item.market} className="market-card">
            <div className="label">{item.market}</div>
            <div className={`index-value ${signClass(item.changeValue)}`}>
              {toIndex(item.indexValue)}
            </div>
            <div className={`change-row ${signClass(item.changeValue)}`}>
              {toPctSigned(item.changeRate)} &nbsp; {item.changeValue > 0 ? '+' : ''}{toIndex(item.changeValue)}
            </div>
            <div className="stats-row">
              <span>거래대금 {toEokFromMln(item.tradingValue)}억</span>
              <span className="positive">▲{item.advancers}</span>
              <span className="negative">▼{item.decliners}</span>
              <span>—{item.unchangedCount}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
