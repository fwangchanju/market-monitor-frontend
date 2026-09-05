import { domToPng } from 'modern-screenshot'
import { waitForNextPaint } from './captureToClipboard'

export async function captureElementToDownload(el: HTMLElement, filename: string): Promise<void> {
  await waitForNextPaint()
  const dataUrl = await domToPng(el, { scale: 1.5, backgroundColor: '#0f1117' })
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  link.click()
}
