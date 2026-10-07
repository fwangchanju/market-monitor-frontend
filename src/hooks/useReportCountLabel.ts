import { useEffect } from 'react'

// 표 위쪽 검색창 옆에 두던 "27/27업종" 같은 개수를 부모(설정창 머리글)로 올려 보낸다. 표가 사라지면 비운다.
export function useReportCountLabel(label: string, onChange: ((label: string | undefined) => void) | undefined) {
  useEffect(() => {
    onChange?.(label)
  }, [label, onChange])
  useEffect(() => () => onChange?.(undefined), [onChange])
}
