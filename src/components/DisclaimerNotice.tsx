// 면책조항 — 지도·그룹 페이지 왼쪽 아래에 마침표 기준으로 두 줄(줄 높이 28px)로 보여준다.
// 한 줄이 칸보다 길면 줄임표로 자른다(마우스를 올려도 전체 문구를 띄우지 않는다).
const DISCLAIMER_LINES = [
  '본 웹사이트의 정보는 키움 REST API 데이터를 바탕으로 가공된 것으로, 투자 참고사항이며 오류가 발생하거나 지연될 수 있습니다.',
  '제공된 정보에 의한 투자결과에 대해 법적인 책임을 지지 않습니다.',
]

export default function DisclaimerNotice() {
  return (
    <p className="min-w-0 text-left text-xs font-medium text-white/50">
      <span className="min-w-0 leading-[14px]">
        {DISCLAIMER_LINES.map(line => (
          <span key={line} className="block truncate">
            {line}
          </span>
        ))}
      </span>
    </p>
  )
}
