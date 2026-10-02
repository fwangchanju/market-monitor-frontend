// 지도 설정 색상 탭 4-1) 강조 색상의 8칸 색 — 설정 화면의 선택지와 상단바 시간대 점이 같은 값을 쓰도록 한 곳에 둔다.
// 맨 왼쪽의 흰색에 가까운 회색은 등락률 색상(4-2)의 회색 자리와 짝이다 — 두 줄이 같은 8칸으로 같은 간격에 놓인다.
export const ACCENT_PALETTE = [
  { label: '연회색', value: '#e5e7eb' },
  { label: '분홍', value: '#fccbcd' },
  { label: '주황', value: '#ffb74d' },
  { label: '연노랑', value: '#fff59d' },
  { label: '형광', value: '#c6ff00' },
  { label: '청록', value: '#4dd0e1' },
  { label: '하늘', value: '#90bff9' },
  { label: '보라', value: '#b39ddb' },
] as const

export type AccentColorLabel = (typeof ACCENT_PALETTE)[number]['label']

export function accentColor(label: AccentColorLabel): string {
  return ACCENT_PALETTE.find(color => color.label === label)!.value
}
