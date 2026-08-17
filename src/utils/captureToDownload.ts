import { domToPng } from 'modern-screenshot'

export async function captureElementToDownload(el: HTMLElement, filename: string): Promise<void> {
  const dataUrl = await domToPng(el, { scale: 1.5, backgroundColor: '#0f1117' })
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  link.click()
}
