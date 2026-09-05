import { useEffect, useRef, useState } from 'react'
import { captureElementToDataUrl } from '@/utils/captureToPreview'
import { DownloadIcon, RefreshIcon } from '@/components/icons/MarketMapIcons'
import Spinner from '@/components/Spinner'

interface Props {
  onClose: () => void
  onCopy: () => void
  onDownload: () => void
  copyLabel: string
  downloadLabel: string
  isCopying: boolean
  isDownloading: boolean
  captureTarget: HTMLElement | null
}

export default function MarketMapShareModal({
  onClose,
  onCopy,
  onDownload,
  downloadLabel,
  isDownloading,
  copyLabel,
  isCopying,
  captureTarget,
}: Props) {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [showCopiedNotice, setShowCopiedNotice] = useState(false)
  const [prevCopyLabel, setPrevCopyLabel] = useState(copyLabel)
  const hasAutoCopiedRef = useRef(false)

  // copyLabel이 막 'Copied'로 바뀐 시점을 렌더 중에 감지해서 알림을 켠다(React가 권장하는 "prop 변화에
  // 맞춰 상태 조정" 패턴 — effect 안에서 무조건 setState부터 부르는 것보다 이쪽이 더 안전하다).
  if (copyLabel !== prevCopyLabel) {
    setPrevCopyLabel(copyLabel)
    if (copyLabel === 'Copied') setShowCopiedNotice(true)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    if (!captureTarget) return
    // 캡처 작업이 무거워서 같은 프레임에서 바로 시작하면 모달이 뜨는 페인트 자체가 밀린다.
    // 두 번의 requestAnimationFrame으로 모달(+스피너)이 먼저 그려진 뒤에 캡처를 시작한다.
    let cancelled = false
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return
        captureElementToDataUrl(captureTarget)
          .then(dataUrl => {
            if (!cancelled) setPreviewSrc(dataUrl)
          })
          .catch(() => {
            if (!cancelled) setPreviewSrc(null)
          })
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(raf1)
    }
  }, [captureTarget])

  // 미리보기 캡처(스피너)가 끝나자마자 버튼 없이 곧바로 클립보드로 복사한다 — 세션당 한 번만.
  useEffect(() => {
    if (!previewSrc || hasAutoCopiedRef.current) return
    hasAutoCopiedRef.current = true
    onCopy()
  }, [previewSrc, onCopy])

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70" onClick={onClose}>
      {/* 팝업 자체를 지도 실 표시 영역 기준 고정 크기로 유지한다 — 캡처 이미지의 세로 비율이 얼마든
          팝업 크기는 항상 그대로고, 이미지가 넘치면 미리보기 영역 안에서만 스크롤된다(가로로 넘치는
          경우는 당장 없다고 가정). 지도/섹터/어드민처럼 캡처 비율이 뷰포트에 가까운 페이지는 폭 대비
          높이가 딱 맞아떨어져서 1px 남짓 차이로 스크롤이 생기던 문제가 있어, 높이는 그대로 두고 폭을
          좀 더 좁혀서(2/3 -> 3/5) 여유를 뒀다. */}
      <div
        className="flex h-2/3 w-3/5 flex-col border border-gray-700 bg-[var(--surface)] p-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="min-h-0 flex-1 overflow-y-auto border border-gray-700 bg-black/30">
          {previewSrc ? (
            <img src={previewSrc} alt="마켓맵 미리보기" className="h-auto w-full" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Spinner />
            </div>
          )}
        </div>
        {/* Download/Close 글자 길이가 서로 달라서 flex justify-between으로는 가운데 칸(복사 상태
            표시)이 컨테이너 정중앙에 오지 않는다 — 3칸 그리드로 나눠 각 칸 안에서만 정렬하면
            가운데 칸은 항상 정중앙, 양끝 버튼은 항상 컨테이너 가장자리에 붙는다. 가운데 칸(복사 상태
            표시)은 조건부로 아예 렌더링 안 될 때가 있는데, 그때 grid auto-placement에 맡기면 실제
            존재하는 자식 수만큼만 순서대로 칸을 채워서 Close가 3번 칸이 아니라 2번(가운데) 칸으로
            당겨져 버린다 — 그래서 각 버튼에 col-start를 명시해 항상 고정된 칸에 놓이게 한다. */}
        <div className="mt-4 grid shrink-0 grid-cols-3 items-center gap-4">
          <button
            type="button"
            onClick={onDownload}
            disabled={isDownloading}
            className="nes-btn col-start-1 flex items-center justify-self-start gap-2 border-gray-600 bg-black px-3 py-1.5 text-sm text-white hover:bg-gray-800"
          >
            {isDownloading ? <Spinner className="h-4 w-4" /> : <DownloadIcon className="h-4 w-4" />}
            {downloadLabel}
          </button>
          {isCopying ? (
            <p className="nes-btn col-start-2 flex items-center justify-self-center gap-2 border-gray-600 bg-black px-3 py-1.5 text-sm text-white shadow-lg">
              <Spinner className="h-4 w-4" />
              클립보드에 복사 중...
            </p>
          ) : (
            showCopiedNotice && (
              <button
                type="button"
                onClick={onCopy}
                className="nes-btn col-start-2 flex items-center justify-self-center gap-2 border-sky-500 bg-sky-500 px-3 py-1.5 text-sm text-white shadow-lg hover:bg-sky-600"
              >
                <RefreshIcon className="h-4 w-4" />
                클립보드에 복사되었습니다
              </button>
            )
          )}
          <button
            type="button"
            onClick={onClose}
            className="nes-btn col-start-3 flex items-center justify-self-end gap-2 border-gray-600 bg-black px-3 py-1.5 text-sm text-white hover:bg-gray-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
