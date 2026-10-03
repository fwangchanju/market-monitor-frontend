import { domToPng } from 'modern-screenshot'
import { shareCaptureOptions } from './captureScale'
import { waitForNextPaint } from './captureToClipboard'

// 공유창 미리보기로 이미 찍어 둔 이미지를 그대로 내려받는다 — 같은 영역을 다시 찍지 않는다.
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  link.click()
}

export async function captureElementToDownload(el: HTMLElement, filename: string): Promise<void> {
  await waitForNextPaint()
  const dataUrl = await domToPng(el, shareCaptureOptions(el))
  downloadDataUrl(dataUrl, filename)
}
