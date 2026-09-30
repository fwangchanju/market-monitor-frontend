import { domToPng } from 'modern-screenshot'

// 미리보기는 화면 가득 크게 보여주므로 원래 크기 이상으로 찍어야 선명하다 — 화면 배율(레티나 등)을
// 따라가되 1~2배로 제한한다(3배 화면에서도 2배까지만 — 캡처 시간과 메모리 때문).
function defaultPreviewScale(): number {
  return Math.min(2, Math.max(1, window.devicePixelRatio || 1))
}

export async function captureElementToDataUrl(el: HTMLElement, scale = defaultPreviewScale()): Promise<string> {
  return domToPng(el, { scale, backgroundColor: '#0f1117' })
}
