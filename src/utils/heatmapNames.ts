// 지도에서 고를 수 있는 히트맵 — 내 히트맵은 아직 지도에서 고를 수 없다.
export type HeatmapKey = 'krx' | 'nxt' | 'marketry'

export const HEATMAP_NAMES = {
  krx: { tab: 'KRX', title: 'KRX' },
  nxt: { tab: 'NXT', title: 'NXT' },
  marketry: { tab: 'MARKETRY', title: 'MARKETRY' },
  mine: { tab: '내 히트맵', title: '내 히트맵' },
} as const
