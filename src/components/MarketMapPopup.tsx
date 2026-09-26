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

// 팝업 본체와 우클릭한 박스 사이의 간격 — 이 틈 전체를 꼬리(말풍선 삼각형)가 채운다.
const POPUP_GAP = 12
const POPUP_MARGIN = 8
// 꼬리가 팝업 가장자리를 따라 뻗는 길이(대각선 변의 "밑변" 길이) — GAP과 같은 값을 써서 대략
// 45도에 가까운 삼각형이 되게 한다. OVERLAP은 팝업 본체 쪽으로 1px 더 들어가서, 둥근 모서리 없이
// 딱 맞붙는 사각형 팝업 테두리와 이어질 때 안티앨리어싱으로 인한 실선 사이 미세한 틈(seam)이
// 안 보이게 팝업 배경 밑으로 살짝 깔리게 한다.
const TAIL_ALONG = 12
const TAIL_OVERLAP = 1

type TailCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

interface TailGeometry {
  left: number
  top: number
  width: number
  height: number
  points: string
}

// corner는 "꼬리가 팝업의 어느 모서리에서 나오는지"를 뜻한다 — X가 오른쪽 배치면 팝업 왼쪽에서,
// 왼쪽 배치(뒤집힘)면 팝업 오른쪽에서 나오고, Y가 위쪽 정렬이면 팝업 위쪽에서, 아래쪽 정렬(뒤집힘)이면
// 팝업 아래쪽에서 나온다. 꼭짓점(뾰족한 끝, points의 (0,0) 혹은 그 대응점)은 항상 정확히 앵커 박스의
// 그 대각 모서리를 가리키고, 나머지 두 점은 팝업 쪽 밑변(anchorRect 반대편, TAIL_OVERLAP만큼 더 들어감)이다.
function computeTailGeometry(corner: TailCorner, anchorRect: MarketMapPopupAnchorRect): TailGeometry {
  const w = TAIL_ALONG + TAIL_OVERLAP
  const h = TAIL_ALONG
  switch (corner) {
    case 'top-left':
      return { left: anchorRect.right, top: anchorRect.top, width: w, height: h, points: `0,0 ${w},0 ${w},${h}` }
    case 'top-right':
      return { left: anchorRect.left - w, top: anchorRect.top, width: w, height: h, points: `${w},0 0,0 0,${h}` }
    case 'bottom-left':
      return { left: anchorRect.right, top: anchorRect.bottom - h, width: w, height: h, points: `0,${h} ${w},${h} ${w},0` }
    case 'bottom-right':
      return { left: anchorRect.left - w, top: anchorRect.bottom - h, width: w, height: h, points: `${w},${h} 0,${h} 0,0` }
  }
}

interface PopupBodyProps {
  popup: MarketMapPopupState
  onExcludeSector: (sectorId: number, sectorName: string) => void
  onClose: () => void
}

function PopupBody({ popup, onExcludeSector, onClose }: PopupBodyProps) {
  const [confirming, setConfirming] = useState(false)
  const elRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{
    left: number
    top: number
    ready: boolean
    tail: TailGeometry | null
    tailStroke: string
  }>({ left: 0, top: 0, ready: false, tail: null, tailStroke: '' })

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

    // X: 기본은 박스 오른쪽 바깥(GAP만큼). 안 들어가면 왼쪽 바깥으로 뒤집고, 그마저 안 들어가면
    // 뷰포트 안쪽으로 클램프한다(이 경우 박스와 겹치는 것은 감수하고, 꼬리도 숨긴다 — 아래 참고).
    const rightCandidate = anchorRect.right + POPUP_GAP
    const leftCandidate = anchorRect.left - POPUP_GAP - width
    let left: number
    let xMode: 'right' | 'left' | 'clamped'
    if (rightCandidate + width <= window.innerWidth - POPUP_MARGIN) {
      left = rightCandidate
      xMode = 'right'
    } else if (leftCandidate >= POPUP_MARGIN) {
      left = leftCandidate
      xMode = 'left'
    } else {
      left = Math.min(Math.max(rightCandidate, POPUP_MARGIN), window.innerWidth - POPUP_MARGIN - width)
      xMode = 'clamped'
    }

    // Y: 기본은 박스 위쪽 가장자리에 맞춘다(간격 없음). 화면 아래로 넘치면 박스 아래쪽 가장자리에
    // 맞추고, 그마저 안 들어가면 뷰포트 안쪽으로 클램프한다(꼬리 숨김).
    const topCandidate = anchorRect.top
    const bottomCandidate = anchorRect.bottom - height
    let top: number
    let yMode: 'top' | 'bottom' | 'clamped'
    if (topCandidate + height <= window.innerHeight - POPUP_MARGIN && topCandidate >= POPUP_MARGIN) {
      top = topCandidate
      yMode = 'top'
    } else if (bottomCandidate >= POPUP_MARGIN && bottomCandidate + height <= window.innerHeight - POPUP_MARGIN) {
      top = bottomCandidate
      yMode = 'bottom'
    } else {
      top = Math.min(Math.max(topCandidate, POPUP_MARGIN), window.innerHeight - POPUP_MARGIN - height)
      yMode = 'clamped'
    }

    // 말풍선 꼬리 — 오른쪽/왼쪽, 위/아래가 각각 "깔끔하게" 정해졌을 때만 그린다(둘 중 하나라도
    // 뷰포트 클램프로 타협한 상태면 꼬리 끝이 앵커 모서리를 정확히 못 가리키니 아예 숨긴다).
    const tail =
      xMode !== 'clamped' && yMode !== 'clamped'
        ? computeTailGeometry(`${yMode === 'top' ? 'top' : 'bottom'}-${xMode === 'right' ? 'left' : 'right'}`, anchorRect)
        : null

    setPosition({ left, top, ready: true, tail, tailStroke: getComputedStyle(el).borderColor })
  }, [popup, confirming])

  const excludeSector = popup.excludeSector

  return (
    <>
      {position.tail && (
        <svg
          aria-hidden="true"
          className="fixed z-[9999] pointer-events-none"
          style={{ left: position.tail.left, top: position.tail.top }}
          width={position.tail.width}
          height={position.tail.height}
          viewBox={`0 0 ${position.tail.width} ${position.tail.height}`}
        >
          <polygon points={position.tail.points} fill="var(--surface)" stroke={position.tailStroke} strokeWidth={1} />
        </svg>
      )}
      <div
        ref={elRef}
        data-market-map-popup
        className="fixed z-[9999] w-max whitespace-nowrap border border-gray-600 bg-[var(--surface)] px-2 py-1 text-left text-base text-white shadow-lg"
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
    </>
  )
}
