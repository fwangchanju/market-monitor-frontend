import { useState } from 'react'
import { createPortal } from 'react-dom'
import { eulReul } from '@/utils/format'

export interface MarketMapPopupContent {
  title: string
  rows: string[]
  excludeSector?: { id: number; name: string }
  // 우클릭한 섹터/종목 박스를 식별하는 키('sector-<id>' | 'stock-<code>') — 팝업이 떠 있는 동안
  // 해당 박스에만 초록 하이라이트를 붙이는 데 쓴다(MarketMapTreemap.highlightedKey).
  targetKey: string
}

export interface MarketMapPopupState extends MarketMapPopupContent {
  left: number
  top: number
  alignLeft: boolean
  alignTop: boolean
}

interface Props {
  popup: MarketMapPopupState | null
  onExcludeSector: (sectorId: number, sectorName: string) => void
  onClose: () => void
}

export default function MarketMapPopup({ popup, onExcludeSector, onClose }: Props) {
  // 팝업이 닫힐 때마다(popup === null) 이 컴포넌트가 통째로 언마운트되므로, 다음에 다시 열릴 때
  // confirming은 항상 false로 초기화된다 — 별도 리셋 로직 없이 훅 하나로 충분하다.
  const [confirming, setConfirming] = useState(false)
  if (!popup) return null
  const excludeSector = popup.excludeSector

  return createPortal(
    <div
      data-market-map-popup
      className="fixed z-[9999] w-max whitespace-nowrap rounded border border-gray-600 bg-[var(--surface)] px-2 py-1 text-left text-base text-white shadow-lg"
      style={{
        left: popup.left,
        top: popup.top,
        transform: `translate(${popup.alignLeft ? '-100%' : '0'}, ${popup.alignTop ? '-100%' : '0'})`,
      }}
    >
      {confirming && excludeSector ? (
        <div className="flex flex-col gap-2">
          <span>
            {excludeSector.name}
            {eulReul(excludeSector.name)} 제외 범위에 포함하시겠습니까?
          </span>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="nes-btn border-red-600 bg-red-600 px-2 py-0.5 text-xs text-white hover:bg-red-700"
              onClick={() => {
                onExcludeSector(excludeSector.id, excludeSector.name)
                onClose()
              }}
            >
              제외
            </button>
            <button
              type="button"
              className="nes-btn border-gray-600 bg-black px-2 py-0.5 text-xs text-white hover:bg-gray-800"
              onClick={() => setConfirming(false)}
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 font-bold">
            <span>{popup.title}</span>
            {excludeSector && (
              <button
                type="button"
                aria-label={`${excludeSector.name} 제외`}
                title="섹터 제외"
                className="rounded p-0.5 text-gray-400 hover:text-[var(--accent)]"
                onClick={() => setConfirming(true)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                  <path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m5 4v7m4-7v7" />
                </svg>
              </button>
            )}
          </div>
          <div className="pl-1">
            {popup.rows.map((row, index) => (
              <div key={index}>{row}</div>
            ))}
          </div>
        </>
      )}
    </div>,
    document.body,
  )
}
