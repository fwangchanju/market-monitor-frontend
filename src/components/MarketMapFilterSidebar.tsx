import { useState } from 'react'
import type { Market } from '@/types/api'
import { ChevronLeftIcon } from './icons/MarketMapIcons'
import MarketMapColorThresholdEditorPanel from './MarketMapColorThresholdEditorPanel'
import type { ColorScaleThreshold } from '@/utils/marketMapColorScale'

const FILTER_ITEMS: { label: string; market?: Market }[] = [
  { label: 'KOSPI', market: 'KOSPI' },
  { label: 'KOSDAQ', market: 'KOSDAQ' },
  { label: 'All Stocks' },
]

interface Props {
  market: Market
  onMarketChange: (market: Market) => void
  // 색상 추가/수정 세션 — 빈 배열이면 패널 자체가 안 보인다. 지도를 가리는 설정 팝업과 달리 이
  // 사이드바는 지도 옆에 그대로 떠있어서, 색을 조정하는 동안 실시간으로 바뀌는 지도를 같이 볼 수 있다.
  // add 모드는 "+"로 여러 행을 동시에 편집할 수 있어서 배열, edit 모드는 항상 원소 1개.
  colorEditThresholds: ColorScaleThreshold[]
  colorEditMode: 'add' | 'edit'
  onChangeColorEditThreshold: (rowIndex: number, percent: number) => void
  onChangeColorEditColor: (rowIndex: number, color: string, colorLabel: string | null) => void
  onAddColorEditRow: () => void
  onApplyColorEdit: () => void
  onCancelColorEdit: () => void
  isSavingColorEdit: boolean
}

export default function MarketMapFilterSidebar({
  market,
  onMarketChange,
  colorEditThresholds,
  colorEditMode,
  onChangeColorEditThreshold,
  onChangeColorEditColor,
  onAddColorEditRow,
  onApplyColorEdit,
  onCancelColorEdit,
  isSavingColorEdit,
}: Props) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={`relative shrink-0 bg-[var(--surface)] text-sm transition-[width] duration-200 ${collapsed ? 'w-4' : 'w-56'}`}
    >
      <div className={`flex h-full flex-col overflow-hidden transition-[width] duration-200 ${collapsed ? 'w-0' : 'w-56'}`}>
        <div className="w-56 shrink-0 border-b border-gray-700 p-4">
          <p className="mb-2 font-bold text-white">FILTER</p>
          <ul className="flex list-none flex-col gap-1">
            {FILTER_ITEMS.map(({ label, market: m }) => (
              <li key={label}>
                {m ? (
                  <button
                    type="button"
                    onClick={() => onMarketChange(m)}
                    className={`w-full rounded border-0 bg-transparent px-2 py-1 text-left font-bold ${
                      market === m ? 'bg-gray-700 text-[#4f8fd6]' : 'text-white hover:text-gray-300'
                    }`}
                  >
                    {label}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="w-full cursor-not-allowed rounded border-0 bg-transparent px-2 py-1 text-left font-bold text-gray-500"
                  >
                    {label}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-auto max-h-[70vh] shrink-0 overflow-y-auto">
          {colorEditThresholds.length > 0 && (
            <MarketMapColorThresholdEditorPanel
              mode={colorEditMode}
              thresholds={colorEditThresholds}
              onChangeThreshold={onChangeColorEditThreshold}
              onChangeColor={onChangeColorEditColor}
              onAddRow={onAddColorEditRow}
              onApply={onApplyColorEdit}
              onCancel={onCancelColorEdit}
              isSaving={isSavingColorEdit}
            />
          )}
        </div>
      </div>
      <button
        type="button"
        aria-label={collapsed ? '사이드바 열기' : '사이드바 닫기'}
        onClick={e => {
          setCollapsed(prev => !prev)
          // 클릭 후에도 포커스가 남아있으면 브라우저 기본 포커스 링이 테두리처럼 계속 보인다.
          e.currentTarget.blur()
        }}
        className="absolute right-0 top-0 z-10 flex h-full w-4 items-center justify-center border-0 bg-[var(--surface)] text-white outline-none hover:bg-gray-700"
      >
        <ChevronLeftIcon className={`h-3 w-3 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
      </button>
    </aside>
  )
}
