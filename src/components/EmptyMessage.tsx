// 표에 보여줄 줄이 없을 때의 안내 — 머리글 아래 빈 자리의 한가운데에 크게 보여준다. 부모는 relative여야 한다.
// 한국거래소·MARKETRY·내 히트맵 표가 모두 같은 모양과 같은 문구를 쓴다.
export const EMPTY_DATA_MESSAGE = '표시할 데이터가 없습니다.'
export const EMPTY_SEARCH_MESSAGE = '검색 결과가 없습니다.'

export default function EmptyMessage({ message, topClass = 'top-8' }: { message: string; topClass?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-x-0 bottom-0 ${topClass} flex items-center justify-center whitespace-pre-line px-6 text-center text-xl text-gray-300`}>
      {message}
    </div>
  )
}
