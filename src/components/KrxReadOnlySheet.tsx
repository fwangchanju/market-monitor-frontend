import { useMemo, useState } from 'react'
import Spinner from '@/components/Spinner'
import type { MarketMapResponse } from '@/types/api'
import { toCount, toJoEok } from '@/utils/format'
import { charTier } from '@/utils/koreanSort'

const KOREAN_COLLATOR = new Intl.Collator('ko')

function compareName(a: string, b: string): number {
  const tierA = charTier(a[0] ?? '')
  const tierB = charTier(b[0] ?? '')
  if (tierA !== tierB) return tierA - tierB
  return KOREAN_COLLATOR.compare(a, b)
}

// 지도 응답의 시가총액은 원 단위 — 표에는 '조/억'으로 보여준다.
const toMarketValueLabel = (won: number): string => toJoEok(won / 100_000_000)

const HEADER_CELL = 'sticky top-0 z-10 bg-[var(--accent)] px-3 py-1 text-center text-sm font-bold text-black'
const BODY_CELL = 'border-b border-gray-800 px-3 py-1 text-sm'

interface Props {
  mode: 'category' | 'stock'
  data: MarketMapResponse | undefined
  isLoading: boolean
  // NXT 거래 가능 종목코드 — 지도 응답에는 이 정보가 없어서 커스텀 종목 목록(/custom/stock-sectors)에서 받아온다.
  nxtStockCodes: ReadonlySet<string>
}

// KRX 시트 — 거래소 업종 분류를 읽기만 하는 화면이다. 편집 기능(추가·이동·배정)은 없고, 지도의 KRX 히트맵이
// 보여주는 분류(/map?isCustom=false)를 그대로 표로 보여준다. 시세가 있는 종목만 내려오므로 거래정지 종목 등은
// 빠질 수 있다.
export default function KrxReadOnlySheet({ mode, data, isLoading, nxtStockCodes }: Props) {
  if (isLoading) {
    return (
      <div className="flex justify-center p-16">
        <Spinner />
      </div>
    )
  }
  if (!data || data.items.length === 0) {
    return <p className="p-8 text-center text-sm text-gray-400">표시할 KRX 분류가 없습니다.</p>
  }
  return mode === 'stock' ? <KrxStockTable data={data} nxtStockCodes={nxtStockCodes} /> : <KrxCategoryTable data={data} />
}

function KrxCategoryTable({ data }: { data: MarketMapResponse }) {
  const rows = useMemo(
    () =>
      data.items
        .map(node => ({ id: node.sectorId, name: node.sectorName, stockCount: node.items.length, marketValue: node.totalMarketValue }))
        .sort((a, b) => compareName(a.name, b.name)),
    [data],
  )
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <table className="w-full border-separate border-spacing-0 text-white">
        <thead>
          <tr>
            <th className={HEADER_CELL}>업종</th>
            <th className={HEADER_CELL}>종목 수</th>
            <th className={HEADER_CELL}>시가총액</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.name}>
              <td className={BODY_CELL}>{row.name}</td>
              <td className={`${BODY_CELL} text-right`}>{toCount(row.stockCount)}</td>
              <td className={`${BODY_CELL} text-right`}>{toMarketValueLabel(row.marketValue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function KrxStockTable({ data, nxtStockCodes }: { data: MarketMapResponse; nxtStockCodes: ReadonlySet<string> }) {
  const [query, setQuery] = useState('')
  const [nxtOnly, setNxtOnly] = useState(false)
  const rows = useMemo(
    () =>
      data.items
        .flatMap(node => node.items.map(item => ({ ...item, sectorName: node.sectorName })))
        .sort((a, b) => b.totalMarketValue - a.totalMarketValue),
    [data],
  )
  const trimmed = query.trim()
  const visibleRows = rows.filter(
    row =>
      (!nxtOnly || nxtStockCodes.has(row.stockCode)) &&
      (!trimmed || row.stockName.includes(trimmed) || row.stockCode.includes(trimmed) || row.sectorName.includes(trimmed)),
  )
  return (
    <div className="flex min-h-0 flex-1 flex-col text-white">
      <div className="flex shrink-0 items-center gap-3 px-3 pb-2">
        <input
          type="text"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="종목명·코드·업종 검색"
          aria-label="KRX 종목 검색"
          className="nes-input is-dark h-8 w-64 text-sm"
        />
        <label className="flex cursor-pointer items-center gap-1.5 text-sm">
          <input type="checkbox" checked={nxtOnly} onChange={event => setNxtOnly(event.target.checked)} />
          NXT만 보기
        </label>
        <span className="text-sm text-gray-400">{toCount(visibleRows.length)}/{toCount(rows.length)}종목</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th className={HEADER_CELL}>종목코드</th>
              <th className={HEADER_CELL}>종목명</th>
              <th className={HEADER_CELL}>업종</th>
              <th className={HEADER_CELL}>NXT</th>
              <th className={HEADER_CELL}>시가총액</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map(row => (
              <tr key={row.stockCode}>
                <td className={`${BODY_CELL} text-gray-400`}>{row.stockCode}</td>
                <td className={BODY_CELL}>{row.stockName}</td>
                <td className={BODY_CELL}>{row.sectorName}</td>
                <td className={`${BODY_CELL} text-center ${nxtStockCodes.has(row.stockCode) ? 'text-[var(--accent)]' : 'text-gray-500'}`}>
                  {nxtStockCodes.has(row.stockCode) ? 'O' : '-'}
                </td>
                <td className={`${BODY_CELL} text-right`}>{toMarketValueLabel(row.totalMarketValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
