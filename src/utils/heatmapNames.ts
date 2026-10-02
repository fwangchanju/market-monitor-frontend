// 지도에서 고를 수 있는 히트맵 — 내 히트맵은 아직 지도에서 고를 수 없다.
export type HeatmapKey = 'krx' | 'nxt' | 'marketry'

export const HEATMAP_NAMES = {
  // 지도 상단 표시(title)는 KRX와 NXT를 합친 거래소 히트맵 하나라 둘 다 같은 이름이다. 가운뎃점(·)으로 잇는다.
  krx: { tab: 'KRX', title: 'KRX·NXT' },
  nxt: { tab: 'NXT', title: 'KRX·NXT' },
  marketry: { tab: 'MARKETRY', title: 'MARKETRY' },
  mine: { tab: '내 히트맵', title: '내 히트맵' },
} as const
