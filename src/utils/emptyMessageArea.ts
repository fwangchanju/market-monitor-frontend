import { createContext } from 'react'

// 표 페이지(커스텀)는 표 머리글·검색줄 때문에 표 안쪽이 페이지의 본문 영역보다 낮다. 그대로 가운데에 두면 그룹·지도 페이지보다
// 안내 문구가 아래에 놓이므로, 본문 영역(relative) 요소를 이 값으로 내려주면 문구를 그 영역 전체의 한가운데에 그린다(EmptyMessage).
export const EmptyMessageAreaContext = createContext<HTMLElement | null>(null)
