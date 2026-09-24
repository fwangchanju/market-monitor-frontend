// 백엔드가 보내는 snapshotTime은 '2026-09-22T10:05:00' 모양의 타임존 없는 KST 로컬 시각 문자열이다.
// new Date(문자열)로 파싱하면 브라우저(또는 렌더러 컨테이너) 타임존으로 해석되어, UTC 환경에서는
// 9시간 어긋난 시각을 요청하게 된다(market-monitor-backend 지시서 결정 4, 5-4). 그래서 연·월·일·시·
// 분·초를 문자열에서 직접 잘라 Date.UTC로 계산한 뒤, 같은 모양의 문자열로 되돌린다 — 어느 타임존에서
// 실행되든 값이 같다.
export function subtractMinutesFromSnapshotTime(snapshotTime: string, minutes: number): string {
  const [datePart, timePart] = snapshotTime.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute, second] = timePart.split(':').map(Number)
  const utcMillis = Date.UTC(year, month - 1, day, hour, minute, second) - minutes * 60_000
  return new Date(utcMillis).toISOString().slice(0, 19)
}
