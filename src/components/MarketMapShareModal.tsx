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
  // 상태가 바뀌어도 위치·크기·타이포는 그대로 두고 내용과 색상만 교체한다.
  const copyStatusClassName = 'nes-btn col-span-2 col-start-1 row-start-1 m-0 flex h-9 w-48 items-center justify-center justify-self-center gap-2 whitespace-nowrap border-gray-600 px-3 py-1.5 text-sm font-normal leading-5 shadow-lg sm:col-span-1 sm:col-start-2'

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
      {/* 이미지 비율에 따라 높이가 정해지고, 화면보다 긴 캡처만 미리보기 안에서 스크롤된다. */}
      <div
        className="flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] flex-col border border-gray-700 bg-[var(--surface)] p-4 sm:w-3/5 sm:min-w-[30rem]"
        onClick={e => e.stopPropagation()}
      >
        <div className="min-h-0 overflow-y-auto border border-gray-700 bg-black/30">
          {previewSrc ? (
            <img src={previewSrc} alt="마켓맵 미리보기" className="block h-auto w-full" />
          ) : (
            <div className="flex h-48 w-full items-center justify-center">
              <Spinner />
            </div>
          )}
        </div>
        {/* 양끝 칸의 폭을 같게 유지해 문구 길이와 무관하게 복사 상태를 정중앙에 둔다.
            좁은 화면에서는 복사 상태 아래로 양끝 버튼을 내려 겹치지 않게 한다. */}
        <div className="mt-4 grid shrink-0 grid-cols-2 items-center gap-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <button
            type="button"
            onClick={onDownload}
            disabled={isDownloading}
            className="nes-btn col-start-1 row-start-2 flex items-center justify-self-start gap-2 border-gray-600 bg-black px-3 py-1.5 text-sm text-white hover:bg-gray-800 sm:row-start-1"
          >
            {isDownloading ? <Spinner className="h-4 w-4" /> : <DownloadIcon className="h-4 w-4" />}
            {downloadLabel}
          </button>
          {isCopying ? (
            <p role="status" className={`${copyStatusClassName} bg-black text-white`}>
              <Spinner className="h-4 w-4" />
              클립보드 복사 중..
            </p>
          ) : (
            showCopiedNotice && (
              <button
                type="button"
                onClick={onCopy}
                className={`${copyStatusClassName} bg-[var(--accent)] text-black hover:bg-[var(--accent-hover)] hover:text-black`}
              >
                <RefreshIcon className="h-4 w-4" />
                클립보드 복사 완료
              </button>
            )
          )}
          <button
            type="button"
            onClick={onClose}
            className="nes-btn col-start-2 row-start-2 flex items-center justify-self-end gap-2 border-gray-600 bg-black px-3 py-1.5 text-sm text-white hover:bg-gray-800 sm:col-start-3 sm:row-start-1"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
