// 페이지 전반에서 반복되는 폰트 크기/굵기를 한 곳에 모아둔 값들 — className 문자열로 내보내서
// span/Link/button 등 어떤 태그에든 그대로 붙일 수 있게 한다. 색상/hover 등 상태에 따라 달라지는
// 스타일은 여기서 다루지 않는다(색은 index.css의 CSS 변수/팔레트가 담당, hover는 호출부 책임) —
// 값이 같은 항목이라도 나중에 서로 다르게 바뀔 수 있어 항목별로 따로 관리한다.
//
// Tailwind 폰트 크기 클래스 -> 실제 px (기준값, 참고용):
//   text-xs   = 12px
//   text-sm   = 14px
//   text-base = 16px
//   text-lg   = 18px
//   text-xl   = 20px
//   text-2xl  = 24px

// 네비게이션 바(SubNavBar) 탭 글자. 20px, bold.
export const FONT_NAV_TAB = 'text-xl font-bold'

// 세 번째 바(페이지별 상태/옵션 바) — 제목(마켓명, "Custom Sector" 등 페이지 대표 라벨). 20px, bold.
export const FONT_BAR_TITLE = 'text-xl font-bold'

// 세 번째 바 — 지수/등락폭/등락률. 15px, normal.
export const FONT_BAR_MARKET_INDEX = 'text-[15px] font-normal'

// 세 번째 바 — 모드 상태 텍스트(예: 커스텀 모드). 15px, normal.
export const FONT_BAR_MODE_STATUS = 'text-[15px] font-normal'

// 세 번째 바 — 시간(스냅샷 시각). 15px, normal.
export const FONT_BAR_TIME = 'text-[15px] font-normal'

// 세 번째 바 — 범례. 12px, bold.
export const FONT_BAR_LEGEND = 'text-xs font-bold'
