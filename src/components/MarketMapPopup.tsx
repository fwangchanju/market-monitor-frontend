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
  mapBounds: { left: number; right: number }
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

// 팝업 본체와 우클릭한 박스 사이의 간격.
const POPUP_GAP = 2
const POPUP_MARGIN = 8
const POPUP_BACKGROUND = '#fff8e7'

interface PopupBodyProps {
  popup: MarketMapPopupState
  onExcludeSector: (sectorId: number, sectorName: string) => void
  onClose: () => void
}

function PopupBody({ popup, onExcludeSector, onClose }: PopupBodyProps) {
  const [confirming, setConfirming] = useState(false)
  const elRef = useRef<HTMLDivElement>(null)
  const minLeft = Math.max(POPUP_MARGIN, popup.mapBounds.left + POPUP_MARGIN)
  const maxRight = Math.min(window.innerWidth - POPUP_MARGIN, popup.mapBounds.right - POPUP_MARGIN)
  const maxWidth = Math.max(1, maxRight - minLeft)
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

    // X: 지도 영역 안에서 박스 오른쪽 바깥(GAP만큼)에 둔다. 안 들어가면 왼쪽으로 뒤집고,
    // 그마저 안 들어가면 지도 경계 안으로 클램프한다.
    const rightCandidate = anchorRect.right + POPUP_GAP
    const leftCandidate = anchorRect.left - POPUP_GAP - width
    let left: number
    if (rightCandidate + width <= maxRight) {
      left = rightCandidate
    } else if (leftCandidate >= minLeft) {
      left = leftCandidate
    } else {
      left = Math.min(Math.max(rightCandidate, minLeft), maxRight - width)
    }

    // Y: 기본은 박스 위쪽 가장자리에 맞춘다(간격 없음). 화면 아래로 넘치면 박스 아래쪽 가장자리에
    // 맞추고, 그마저 안 들어가면 뷰포트 안쪽으로 클램프한다.
    const topCandidate = anchorRect.top
    const bottomCandidate = anchorRect.bottom - height
    let top: number
    if (topCandidate + height <= window.innerHeight - POPUP_MARGIN && topCandidate >= POPUP_MARGIN) {
      top = topCandidate
    } else if (bottomCandidate >= POPUP_MARGIN && bottomCandidate + height <= window.innerHeight - POPUP_MARGIN) {
      top = bottomCandidate
    } else {
      top = Math.min(Math.max(topCandidate, POPUP_MARGIN), window.innerHeight - POPUP_MARGIN - height)
    }

    el.style.left = `${left}px`
    el.style.top = `${top}px`
    el.style.visibility = 'visible'
  }, [popup, confirming, minLeft, maxRight])

  const excludeSector = popup.excludeSector

  return (
    <>
      <div
        ref={elRef}
        data-market-map-popup
        className="invisible fixed z-[9999] w-max break-words border border-[#7a6d55] px-2 py-1 text-left text-base text-black shadow-lg"
        style={{ maxWidth, backgroundColor: POPUP_BACKGROUND }}
      >
        {confirming && excludeSector ? (
          <div className="flex flex-col gap-2">
            <span>
              {excludeSector.name}
              {eulReul(excludeSector.name)} 히트맵에서 제외하시겠습니까?
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
                  className="flex h-5 w-5 items-center justify-center border-0 bg-transparent p-0 outline-none text-gray-700 hover:text-black"
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
    </>
  )
}
