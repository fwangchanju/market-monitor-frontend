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

// 팝업 본체와 우클릭한 박스 사이의 간격 — 예전 스티커 메모 방식과 동일하게 다시 2px로 붙인다.
// 꼬리는 이 틈이 아니라 대상 박스 "안쪽"으로 파고드는 모양이라 GAP 자체는 좁아도 된다.
const POPUP_GAP = 2
const POPUP_MARGIN = 8
// 꼬리 끝(뾰족한 점)이 대상 박스 모서리에서 안쪽으로 파고드는 거리 — 대상 박스가 이보다 좁으면
// 반대쪽 가장자리를 넘지 않도록 clamp한다(아래 computeTail 참고).
const TAIL_INSET = 12
// 꼬리가 팝업 본체 가장자리를 따라 뻗는 길이(팝업 쪽 변의 길이).
const TAIL_ALONG = 12
// 팝업 본체 쪽으로 1px 더 들어가서, 둥근 모서리 없는 사각형 테두리와 이어질 때 안티앨리어싱으로
// 인한 실선 사이 미세한 틈(seam)이 안 보이게 팝업 배경 밑으로 살짝 깔리게 한다.
const TAIL_OVERLAP = 1

interface TailGeometry {
  left: number
  top: number
  width: number
  height: number
  points: string
}

// 꼬리는 이제 팝업 쪽에서 뻗어나와 대상 박스 "안쪽"을 가리킨다 — 뾰족한 끝(tip)은 대상 박스의
// 위/아래 가장자리 위, 그 가장자리에서 TAIL_INSET만큼 안쪽 지점에 찍힌다(대상 박스가 그보다 좁으면
// 반대쪽 가장자리를 넘지 않게 clamp). tip과 같은 y(위/아래 가장자리)에서 팝업 본체의 그쪽 모서리까지
// 수평으로 이어지는 변이 팝업 테두리선의 연장처럼 보이고, 거기서 팝업 본체 가장자리를 따라
// TAIL_ALONG만큼 더 간 점까지의 대각선 변이 실제로 보이는 "꼬리" 모양이다.
// xMode: 팝업이 대상 박스 오른쪽(right)/왼쪽(left) 중 어디 붙었는지. yMode: 위(top)/아래(bottom)
// 가장자리 중 어디 정렬됐는지. bodyLeft/bodyWidth는 이미 계산된 팝업 본체의 최종 위치/크기.
function computeTail(
  anchorRect: MarketMapPopupAnchorRect,
  xMode: 'right' | 'left',
  yMode: 'top' | 'bottom',
  bodyLeft: number,
  bodyWidth: number,
): TailGeometry {
  const tipX =
    xMode === 'right'
      ? Math.max(anchorRect.left + POPUP_GAP, anchorRect.right - TAIL_INSET)
      : Math.min(anchorRect.right - POPUP_GAP, anchorRect.left + TAIL_INSET)
  const tipY = yMode === 'top' ? anchorRect.top : anchorRect.bottom

  // elbow = 팝업 본체와 맞닿는 모서리(예: 기본 배치면 팝업의 top-left) — tip과 같은 y, x는 팝업의
  // 그쪽 가장자리(+겹침 보정). third = 거기서 팝업 가장자리를 따라 TAIL_ALONG만큼 더 간 점.
  const elbowX = xMode === 'right' ? bodyLeft + TAIL_OVERLAP : bodyLeft + bodyWidth - TAIL_OVERLAP
  const thirdY = yMode === 'top' ? tipY + TAIL_ALONG : tipY - TAIL_ALONG

  const left = Math.min(tipX, elbowX)
  const top = Math.min(tipY, thirdY)
  const width = Math.abs(elbowX - tipX)
  const height = Math.abs(thirdY - tipY)
  const points = [
    `${tipX - left},${tipY - top}`,
    `${elbowX - left},${tipY - top}`,
    `${elbowX - left},${thirdY - top}`,
  ].join(' ')
  return { left, top, width, height, points }
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
    // 뷰포트 클램프로 타협한 상태면 꼬리 끝이 대상 박스 가장자리를 정확히 못 가리키니 아예 숨긴다).
    const tail =
      xMode !== 'clamped' && yMode !== 'clamped' ? computeTail(anchorRect, xMode, yMode, left, width) : null

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
