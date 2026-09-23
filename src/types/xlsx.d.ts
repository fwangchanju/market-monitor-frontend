// xlsx는 cdn.sheetjs.com 배포본이라 타입 선언이 없다(@types/xlsx도 없음) — 이 앰비언트 선언이
// 없으면 이 작업과 무관한 exportExcel.ts의 TS7016 에러로 `npm run build`가 항상 실패한다.
declare module 'xlsx'
