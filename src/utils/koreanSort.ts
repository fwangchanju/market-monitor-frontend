// 특수문자 < 숫자 < 영어 < 한글 순으로 묶어서 정렬할 때 쓰는 1차 기준값 — AdminSectorTable(섹터
// 트리)과 AdminStockTable(종목명 검색 결과)이 공유한다. 그룹 내 정렬은 각자 Intl.Collator/localeCompare로 이어서 한다.
export function charTier(ch: string): number {
  if (/[0-9]/.test(ch)) return 1
  if (/[a-zA-Z]/.test(ch)) return 2
  if (/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(ch)) return 3
  return 0
}
