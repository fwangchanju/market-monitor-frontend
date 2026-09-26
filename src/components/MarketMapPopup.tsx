import { createPortal } from 'react-dom'

export interface MarketMapPopupContent {
  title: string
  rows: string[]
  excludeSector?: { id: number; name: string }
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
      <div className="flex items-center justify-between gap-3 font-bold">
        <span>{popup.title}</span>
        {excludeSector && (
          <button
            type="button"
            aria-label={`${excludeSector.name} 제외`}
            title="섹터 제외"
            className="rounded p-0.5 text-red-500 hover:bg-red-500/10"
            onClick={() => {
              onExcludeSector(excludeSector.id, excludeSector.name)
              onClose()
            }}
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
    </div>,
    document.body,
  )
}
