// 지도에서 고를 수 있는 히트맵 — 내 히트맵은 아직 지도에서 고를 수 없다.
export type HeatmapKey = 'krx' | 'nxt' | 'marketry'

export const HEATMAP_NAMES = {
  // 지도 상단 표시(title)는 KRX와 NXT를 합친 거래소 히트맵 하나라 둘 다 같은 이름이다. 설정창의 "한국거래소" 버튼, 그룹 페이지와 같은 이름을 쓴다.
  krx: { tab: 'KRX', title: '한국거래소' },
  nxt: { tab: 'NXT', title: '한국거래소' },
  marketry: { tab: 'MARKETRY', title: 'MARKETRY' },
  mine: { tab: '내 히트맵', title: '내 히트맵' },
} as const
