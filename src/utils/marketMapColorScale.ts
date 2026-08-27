// 마켓맵 종목 박스/범례가 공유하는 등락률 컬러 스케일 계산.
// 박스 색칠(MarketMapBox)과 범례 스와치(MarketMapCustomPage) 양쪽이 반드시 이 모듈만 거치도록 해서,
// 예전처럼 두 곳이 서로 다른 하드코딩 배열을 들고 있다가 실제 값이 어긋나는 문제를 구조적으로 막는다.
// GET /api/market-map/scale 응답(MarketMapScaleResponse)을 그대로 입력(ColorScaleConfig)으로 받는다.
// side는 별도 필드가 아니라 thresholdPercent의 부호로 표현한다(음수=하락, 0=기준, 양수=상승) —
// "side와 부호가 서로 다른 값을 가리키는" 상태 자체를 구조적으로 불가능하게 만든다.
// 서버에서 받은 threshold는 항상 id가 있지만, 어드민이 방금 로컬에서 추가해서 아직 생성 API를
// 안 부른 행은 id가 없다 — 그래서 여기서는 zod 스키마(id 필수)를 그대로 재사용하지 않고 optional로 둔다.
export interface ColorScaleThreshold {
  id?: number
  thresholdPercent: number
  color: string
  colorLabel: string | null
}
export interface ColorScaleConfig {
  thresholds: ColorScaleThreshold[]
}

// 0%일 때 색 — 저장된 threshold가 없으면 이 값(오늘의 bg-gray-600)으로 폴백.
// Tailwind v4 theme.css의 실제 정의(oklch(44.6% 0.03 256.802))를 표준 OKLab→sRGB 변환식으로
// 직접 계산한 hex다(추측치 아님 — node_modules/tailwindcss/theme.css 확인).
export const DEFAULT_ZERO_COLOR = '#4a5565'

// 저장된 threshold가 하나도 없는 side에 쓰는 폴백 프리셋(절댓값 기준). 오늘의 계단식 로직
// (MarketMapBox.boxColorClass, 2/5/8%p 기준)과 최대한 같은 "느낌"을 재현하도록 딱 그 3개
// 임계값에만 threshold를 둔다. 8% 초과는 별도 threshold를 추가하지 않고, 아래 resolveMarketMapColor의
// "최고 threshold 초과 시 clamp" 동작에 맡긴다 — 그래야 8~30%(실제로 흔한 구간) 전체가 오늘처럼
// flat한 red-500/blue-500 그대로 유지된다(중간에 4번째 threshold를 더 두면 8~30% 구간이 다시 서서히
// 옅어지는 그라데이션이 돼버려서 "커스텀이 없으면 오늘과 최대한 비슷하게 보여야 한다"는
// 요구사항에서 벗어난다).
// 색상값 출처: node_modules/tailwindcss/theme.css의 oklch 정의를 동일한 방식으로 변환한 hex.
export const DEFAULT_PLUS_THRESHOLDS: ColorScaleThreshold[] = [
  { thresholdPercent: 2, color: '#460809', colorLabel: 'red' }, // red-950
  { thresholdPercent: 5, color: '#82181a', colorLabel: 'red' }, // red-900
  { thresholdPercent: 8, color: '#fb2c36', colorLabel: 'red' }, // red-500
]
export const DEFAULT_MINUS_THRESHOLDS: ColorScaleThreshold[] = [
  { thresholdPercent: 2, color: '#162456', colorLabel: 'blue' }, // blue-950
  { thresholdPercent: 5, color: '#1c398e', colorLabel: 'blue' }, // blue-900
  { thresholdPercent: 8, color: '#2b7fff', colorLabel: 'blue' }, // blue-500
]

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)]
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

// RGB 공간에서 두 hex 색을 t(0~1) 비율로 선형보간 — HSL/LAB 같은 고급 색공간은 불필요.
function lerpColor(fromHex: string, toHex: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(fromHex)
  const [r2, g2, b2] = hexToRgb(toHex)
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t)
}

// 저장된 threshold가 하나도 없는 side는 기본 프리셋으로 대체(저장된 데이터를 건드리는 게 아니라
// 순수 조회/렌더 시점 폴백). thresholdPercent 절댓값 오름차순 정렬.
function thresholdsForSign(config: ColorScaleConfig, positive: boolean): ColorScaleThreshold[] {
  const own = config.thresholds.filter(t => (positive ? t.thresholdPercent > 0 : t.thresholdPercent < 0))
  if (own.length > 0) return [...own].sort((a, b) => Math.abs(a.thresholdPercent) - Math.abs(b.thresholdPercent))
  return positive ? DEFAULT_PLUS_THRESHOLDS : DEFAULT_MINUS_THRESHOLDS
}

function resolveZeroColor(config: ColorScaleConfig): string {
  return config.thresholds.find(t => t.thresholdPercent === 0)?.color ?? DEFAULT_ZERO_COLOR
}

// changeRate(부호 있는 등락률, %) → 실제 렌더링에 쓸 hex 색.
export function resolveMarketMapColor(changeRate: number, config: ColorScaleConfig): string {
  const zeroColor = resolveZeroColor(config)
  if (changeRate === 0) return zeroColor

  const thresholds = thresholdsForSign(config, changeRate > 0)

  const abs = Math.abs(changeRate)
  const first = thresholds[0]
  const firstAbs = Math.abs(first.thresholdPercent)
  if (abs <= firstAbs) {
    const t = firstAbs === 0 ? 1 : abs / firstAbs
    return lerpColor(zeroColor, first.color, t)
  }

  for (let i = 0; i < thresholds.length - 1; i++) {
    const lower = thresholds[i]
    const upper = thresholds[i + 1]
    const lowerAbs = Math.abs(lower.thresholdPercent)
    const upperAbs = Math.abs(upper.thresholdPercent)
    if (abs <= upperAbs) {
      const span = upperAbs - lowerAbs
      const t = span === 0 ? 1 : (abs - lowerAbs) / span
      return lerpColor(lower.color, upper.color, t)
    }
  }

  // 가장 큰 threshold보다도 크면 그 이후는 추정하지 않고 그대로 clamp(CSS 그라데이션/D3 스케일과 동일).
  return thresholds[thresholds.length - 1].color
}

export interface LegendSwatch {
  label: string
  color: string
}

// 범례 바 — 실제 threshold들(및 0)을 그대로 샘플링해서 스와치를 만든다. resolveMarketMapColor와
// 동일한 함수를 거치므로 박스 색칠과 항상 수학적으로 일치한다.
export function resolveLegendSwatches(config: ColorScaleConfig): LegendSwatch[] {
  const minusThresholds = thresholdsForSign(config, false)
  const plusThresholds = thresholdsForSign(config, true)
  const zeroColor = resolveZeroColor(config)

  const minusSwatches = [...minusThresholds]
    .sort((a, b) => Math.abs(b.thresholdPercent) - Math.abs(a.thresholdPercent))
    .map(threshold => {
      const abs = Math.abs(threshold.thresholdPercent)
      return { label: `-${abs}%`, color: resolveMarketMapColor(-abs, config) }
    })
  const plusSwatches = plusThresholds.map(threshold => {
    const abs = Math.abs(threshold.thresholdPercent)
    return { label: `+${abs}%`, color: resolveMarketMapColor(abs, config) }
  })

  return [...minusSwatches, { label: '0%', color: zeroColor }, ...plusSwatches]
}

// ── 어드민 톤 피커 전용 색 변환 유틸 (hue/lightness 슬라이더 ↔ 최종 저장용 hex) ──────────────

// 어드민이 색상 추가 세션에서 새 행을 만들었지만 아직 톤을 고르지 않은 상태의 내부 색값 —
// 무채색(회색) 프리셋과 동일한 값을 써서, 실제로 "회색"을 고른 것과는 표시(점선 vs 실선)로만 구분한다.
export const UNSET_COLOR_SCALE_THRESHOLD_COLOR = hslToHex(0, 0, 50)

export function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100
  const lNorm = l / 100
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = lNorm - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

// 저장된 임의의 hex(기본 프리셋 포함)를 피커에 처음 띄울 때 hue/lightness 초기 위치를 역산하는 용도.
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const [r8, g8, b8] = hexToRgb(hex)
  const r = r8 / 255
  const g = g8 / 255
  const b = b8 / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
  }
  return { h, s: s * 100, l: l * 100 }
}
