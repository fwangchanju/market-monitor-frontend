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
// leading-none: 기본 line-height(1.5)를 쓰면 줄 높이가 폰트 크기보다 훨씬 커져서 items-center로
// 정렬해도 실제 글자 위치가 미묘하게 어긋나 보인다 — 줄 높이를 글자 크기에 딱 맞게 줄여야 바 안의
// 다른 텍스트(지수/모드 상태/시간)와 정확히 같은 기준으로 정렬된다.
export const FONT_BAR_TITLE = 'text-xl leading-none font-bold'

// 세 번째 바 — 지수/등락폭/등락률. 20px(FONT_BAR_TITLE과 동일), medium(500 — Pretendard가
// 500/700만 있어 정확히 매칭됨).
export const FONT_BAR_MARKET_INDEX = 'text-xl leading-none font-medium'

// 세 번째 바 — 모드 상태 텍스트(예: 커스텀 모드). 14px, medium(500).
export const FONT_BAR_MODE_STATUS = 'text-sm leading-none font-medium'

// 세 번째 바 — 시간(스냅샷 시각). 14px(FONT_BAR_MODE_STATUS와 동일), medium(500).
export const FONT_BAR_TIME = 'text-sm leading-none font-medium'

// 세 번째 바 — 범례. 12px, bold.
export const FONT_BAR_LEGEND = 'text-xs font-bold'
