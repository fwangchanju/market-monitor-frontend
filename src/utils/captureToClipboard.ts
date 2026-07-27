import { domToBlob } from 'modern-screenshot'

export async function captureElementToClipboard(el: HTMLElement): Promise<void> {
  const blob = await domToBlob(el, { scale: 2, backgroundColor: '#0f1117' })
  if (!blob) throw new Error('캡처에 실패했습니다')
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
}
