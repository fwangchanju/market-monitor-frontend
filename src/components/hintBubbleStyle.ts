// 글자만 담은 알림창(커서 말풍선, ? 도움말, 새로고침·툴바 설명, 호버 설명)의 공통 모양 — 위아래 여백(py-1)과 줄 간격(leading-snug)을
// 한 곳에서 정해서 알림창마다 높이가 달라 보이지 않게 한다. 폭·위치·줄바꿈 방식은 알림창마다 다르니 각자 덧붙인다.
export const HINT_BUBBLE_COLOR_CLASS = 'rounded border border-[#7a6d55] bg-[#fff8e7] text-black shadow-lg'

// 색은 위와 같고 글자 크기·여백이 다른 알림(예: 지도 한가운데 안내창)은 HINT_BUBBLE_COLOR_CLASS만 쓰고 나머지를 직접 정한다.
export const HINT_BUBBLE_CLASS = `${HINT_BUBBLE_COLOR_CLASS} px-2 py-1 text-left text-xs leading-snug`
