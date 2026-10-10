const KOREAN_COLLATOR = new Intl.Collator('ko')

// 이름 정렬의 1차 기준값(첫 글자) — 숫자 < 한글 < 영어 < 특수문자 순이다. 이름순으로 보여 주는 곳(종목 표, 업종 표, 업종 선택 목록,
// 제외 업종 목록)이 모두 이 규칙을 써서, 어느 화면에서 정렬해도 순서가 같다.
export function charTier(ch: string): number {
  if (/[0-9]/.test(ch)) return 1
  if (/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(ch)) return 2
  if (/[a-zA-Z]/.test(ch)) return 3
  return 4
}

// 이름 정렬 기준 하나 — 첫 글자로 숫자 < 한글 < 영어 < 특수문자 순으로 묶고, 같은 묶음 안에서는 한국어 사전 순서로 비교한다.
export function compareKoreanText(a: string, b: string): number {
  const tierDiff = charTier(a[0] ?? '') - charTier(b[0] ?? '')
  if (tierDiff !== 0) return tierDiff
  return KOREAN_COLLATOR.compare(a, b)
}
