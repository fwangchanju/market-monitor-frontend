import { domToPng } from 'modern-screenshot'
import { shareCaptureOptions } from './captureScale'
import { waitForNextPaint } from './captureToClipboard'

// 캡처 내려받기 파일 이름 — MARKETRY_화면이름_날짜시간.png (예: MARKETRY_MAP_20261008004512.png).
export function captureFileName(page: 'MAP' | 'GROUP' | 'CUSTOM', now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return `MARKETRY_${page}_${timestamp}.png`
}

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
