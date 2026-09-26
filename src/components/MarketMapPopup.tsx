import { useLayoutEffect, useRef, useState } from 'react'
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

// 우클릭한 박스(섹터 전체 박스 혹은 종목 박스)의 뷰포트 기준 rect. 팝업은 마우스 좌표가 아니라
// 이 rect의 가장자리에 스티커 메모처럼 붙는다 — 실제 정렬(오른쪽/왼쪽, 위/아래) 계산은 팝업 자신의
// 렌더된 크기를 알아야 하므로 아래 PopupBody에서 한다.
export interface MarketMapPopupAnchorRect {
  left: number
  top: number
  right: number
  bottom: number
}

export interface MarketMapPopupState extends MarketMapPopupContent {
  anchorRect: MarketMapPopupAnchorRect
}

interface Props {
  popup: MarketMapPopupState | null
  onExcludeSector: (sectorId: number, sectorName: string) => void
  onClose: () => void
}

export default function MarketMapPopup({ popup, onExcludeSector, onClose }: Props) {
  // popup이 null이면 PopupBody를 트리에서 아예 뺀다 — 이래야 popup이 바뀔 때마다(닫혔다 다시 열릴
  // 때마다) PopupBody가 실제로 언마운트·재마운트되어 confirming/위치 계산 state가 매번 새로 시작한다.
  // MarketMapPopup 자신은 부모가 항상 렌더하는 컴포넌트라 여기 직접 훅을 두면 그 state가 다음 팝업까지
  // 이어져버린다.
  if (!popup) return null
  return createPortal(
    <PopupBody popup={popup} onExcludeSector={onExcludeSector} onClose={onClose} />,
    document.body,
  )
}

const POPUP_GAP = 2
const POPUP_MARGIN = 8

interface PopupBodyProps {
  popup: MarketMapPopupState
  onExcludeSector: (sectorId: number, sectorName: string) => void
  onClose: () => void
}

function PopupBody({ popup, onExcludeSector, onClose }: PopupBodyProps) {
  const [confirming, setConfirming] = useState(false)
  const elRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: 0, top: 0, ready: false })

  // 팝업 크기는 내용(제목/행 목록 vs 삭제 확인 문구+버튼)에 따라 달라서 미리 알 수 없다. 일단
  // 기본 위치(혹은 이전 위치)로 그려보고, 실제 렌더된 크기를 getBoundingClientRect로 잰 뒤
  // 뷰포트를 넘치지 않는 최종 위치를 다시 계산한다 — useLayoutEffect라 이 보정은 브라우저가
  // 화면을 그리기 전에 끝나서 위치가 튀는 게 눈에 보이지 않는다. confirming이 바뀌어 내용/크기가
  // 달라질 때도 다시 재는게 필요해서 의존성에 넣는다.
  useLayoutEffect(() => {
    const el = elRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const { anchorRect } = popup

    // X: 기본은 박스 오른쪽 바깥(2px 간격). 안 들어가면 왼쪽 바깥으로 뒤집고, 그마저 안 들어가면
    // 뷰포트 안쪽으로 붙여 넣는다(이 경우 박스와 겹치는 것은 감수한다).
    let left = anchorRect.right + POPUP_GAP
    if (left + width > window.innerWidth - POPUP_MARGIN) {
      const flippedLeft = anchorRect.left - POPUP_GAP - width
      left = flippedLeft >= POPUP_MARGIN ? flippedLeft : window.innerWidth - POPUP_MARGIN - width
    }
    left = Math.max(POPUP_MARGIN, left)

    // Y: 기본은 박스 위쪽 가장자리에 맞춘다. 화면 아래로 넘치면 박스 아래쪽 가장자리에 맞추고,
    // 그래도 위/아래로 넘치면 뷰포트 안쪽으로 클램프한다.
    let top = anchorRect.top
    if (top + height > window.innerHeight - POPUP_MARGIN) {
      top = anchorRect.bottom - height
    }
    top = Math.min(Math.max(top, POPUP_MARGIN), window.innerHeight - POPUP_MARGIN - height)

    setPosition({ left, top, ready: true })
  }, [popup, confirming])

  const excludeSector = popup.excludeSector

  return (
    <div
      ref={elRef}
      data-market-map-popup
      className="fixed z-[9999] w-max whitespace-nowrap rounded border border-gray-600 bg-[var(--surface)] px-2 py-1 text-left text-base text-white shadow-lg"
      style={{ left: position.left, top: position.top, visibility: position.ready ? 'visible' : 'hidden' }}
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
    </div>
  )
}
