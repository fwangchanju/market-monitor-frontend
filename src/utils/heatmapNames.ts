// 지도에서 고를 수 있는 히트맵. 화면에는 한글 이름(내 히트맵)이 보이고, 코드·주소 안의 값은 mymap이다.
export type HeatmapKey = 'krx' | 'nxt' | 'marketry' | 'mymap'

// 서버 지도 요청의 source 값 — NXT는 거래소의 한 모습이라 따로 없다.
export type ClassificationSource = 'krx' | 'marketry' | 'mymap'

export const HEATMAP_NAMES = {
  // 지도 상단 표시(title)는 KRX와 NXT를 합친 거래소 히트맵 하나라 둘 다 같은 이름이다. 설정창의 "한국거래소" 버튼, 그룹 페이지와 같은 이름을 쓴다.
  krx: { tab: 'KRX', title: '한국거래소' },
  nxt: { tab: 'NXT', title: '한국거래소' },
  marketry: { tab: 'MARKETRY', title: 'MARKETRY' },
  mymap: { tab: '내 히트맵', title: '내 히트맵' },
} as const
