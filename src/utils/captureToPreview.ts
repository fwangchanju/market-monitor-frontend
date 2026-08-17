import { domToPng } from 'modern-screenshot'

export async function captureElementToDataUrl(el: HTMLElement, scale = 0.5): Promise<string> {
  return domToPng(el, { scale, backgroundColor: '#0f1117' })
}
