import { useEffect, useState } from 'react'
import { captureElementToDataUrl } from '@/utils/captureToPreview'
import { DownloadIcon } from '@/components/icons/MarketMapIcons'
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
  copyLabel,
  downloadLabel,
  isCopying,
  isDownloading,
  captureTarget,
}: Props) {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)

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

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="w-[630px] border border-gray-700 bg-[var(--surface)] p-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-700 pb-3">
          <p className="flex h-6 items-center font-bold leading-none text-white">Share Map</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="nes-btn flex h-6 w-6 items-center justify-center border-gray-600 bg-black p-0 text-xs text-white hover:bg-gray-800"
          >
            ✕
          </button>
        </div>
        <div className="mt-4 flex h-[288px] items-center justify-center overflow-hidden border border-gray-700 bg-black/30">
          {previewSrc ? (
            <img src={previewSrc} alt="마켓맵 미리보기" className="h-full w-full object-contain" />
          ) : (
            <Spinner />
          )}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={onDownload}
            disabled={isDownloading}
            className="nes-btn flex items-center gap-2 border-gray-600 bg-black px-3 py-1.5 text-sm text-white hover:bg-gray-800"
          >
            {isDownloading ? <Spinner className="h-4 w-4" /> : <DownloadIcon className="h-4 w-4" />}
            {downloadLabel}
          </button>
          <button
            type="button"
            onClick={onCopy}
            disabled={isCopying}
            className="nes-btn flex items-center gap-2 border-sky-500 bg-sky-500 px-3 py-1.5 text-sm text-white hover:bg-sky-600"
          >
            {isCopying && <Spinner className="h-4 w-4" />}
            {copyLabel}
          </button>
        </div>
        <div className="mt-4 flex items-center justify-end border-t border-gray-700 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="nes-btn border-gray-600 bg-black px-3 py-1.5 text-sm text-white hover:bg-gray-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
