import { Link } from 'react-router-dom'
import { useWatchStocks } from '@/hooks/useWatchStocks'

export default function WatchStockSection() {
  const { data, isError } = useWatchStocks()

  if (!data) {
    return (
      <section className="section">
        <div className="section-header"><h2>관심 종목</h2></div>
        <div className="empty-state">{isError ? '데이터를 불러오지 못했습니다' : '불러오는 중...'}</div>
      </section>
    )
  }

  return (
    <section className="section">
      <div className="section-header">
        <h2>관심 종목</h2>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{data.length}개</span>
      </div>
      {data.length === 0 ? (
        <div className="empty-state">등록된 관심 종목이 없습니다</div>
      ) : (
        <div className="watch-stock-list">
          {data.map(item => (
            <Link
              key={item.stockCode}
              to={`/stocks/${item.stockCode}`}
              className="watch-stock-chip"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <span>{item.stockName}</span>
              <span className="code">{item.stockCode}</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{item.market}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
