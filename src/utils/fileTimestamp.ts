// 내려받는 파일 이름에 붙는 날짜시간 — 년월일_시분초 (예: 20261011_025351). 이미지·엑셀 파일이 같은 모양을 쓴다.
export function fileTimestamp(now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}
