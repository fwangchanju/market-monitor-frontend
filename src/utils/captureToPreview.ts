import { domToPng } from 'modern-screenshot'
import { shareCaptureOptions } from './captureScale'

// 공유 이미지는 긴 변이 1280px이 되게 찍고, 작은 박스의 글자는 뺀다(captureScale.ts 참고).
export async function captureElementToDataUrl(el: HTMLElement): Promise<string> {
  return domToPng(el, shareCaptureOptions(el))
}
