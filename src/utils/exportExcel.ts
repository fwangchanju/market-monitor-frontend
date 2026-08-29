import * as XLSX from 'xlsx'

// 종목코드처럼 "005930"같은 값은 CSV로 내보내면 엑셀이 숫자로 오인해서 앞자리 0을 지워버린다.
// json_to_sheet는 원본 JS 값이 string이면 셀도 문자열(t: 's')로 만들어주지만, 숫자 값(시가총액 등)은
// 여전히 숫자 서식(t: 'n')이라 이후 사용자가 셀을 수정하면 엑셀이 다시 숫자/날짜로 해석할 수 있다.
// 그래서 모든 셀을 값까지 문자열로 바꾸고 서식도 "텍스트"(@)로 강제한다.
export function exportRowsToExcel(filename: string, sheetName: string, rows: Record<string, string | number>[]) {
  const worksheet = XLSX.utils.json_to_sheet(rows)
  const range = XLSX.utils.decode_range(worksheet['!ref'] ?? 'A1')
  for (let row = range.s.r; row <= range.e.r; row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: col })]
      if (!cell) continue
      cell.t = 's'
      cell.v = String(cell.v)
      cell.z = '@'
    }
  }
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  XLSX.writeFile(workbook, filename)
}
