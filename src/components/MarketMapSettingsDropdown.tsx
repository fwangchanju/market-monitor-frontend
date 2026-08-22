import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useExcludedStocks } from '@/hooks/useExcludedStocks'
import { unregisterExcludedStock } from '@/api/marketMap'
import { marketMapKeys } from '@/hooks/queryKeys'
import { SettingsIcon } from '@/components/icons/MarketMapIcons'

interface Props {
  isExclude: boolean
  onToggleExclude: () => void
  isCustom: boolean
  onToggleCustom: () => void
  showMarketValue: boolean
  onToggleShowMarketValue: () => void
  compact?: boolean
}

function ToggleSwitch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <div className="flex items-center justify-between gap-2 whitespace-nowrap text-white">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onChange}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-[#4f8fd6]' : 'bg-gray-600'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`}
        />
      </button>
    </div>
  )
}

export default function MarketMapSettingsDropdown({
  isExclude,
  onToggleExclude,
  isCustom,
  onToggleCustom,
  showMarketValue,
  onToggleShowMarketValue,
  compact = false,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const { data: excluded } = useExcludedStocks()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const handleRemove = async (stockCode: string) => {
    await unregisterExcludedStock(stockCode)
    queryClient.invalidateQueries({ queryKey: marketMapKeys.all })
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        aria-label="설정"
        className={`flex items-center justify-center rounded text-gray-700 hover:bg-gray-100 hover:text-[#4f8fd6] ${compact ? 'p-1' : 'h-9 w-9'}`}
      >
        <SettingsIcon className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full z-30 mt-2 w-56 border border-gray-700 bg-[var(--surface)] p-4 text-left text-sm shadow-lg">
          <ToggleSwitch checked={showMarketValue} onChange={onToggleShowMarketValue} label="시가총액 표시" />
          <div className="mt-6">
            <ToggleSwitch checked={isCustom} onChange={onToggleCustom} label="커스텀 모드" />
          </div>
          <div className="mt-6">
            <ToggleSwitch checked={isExclude} onChange={onToggleExclude} label="일부섹터 제외" />
            <div className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto">
              {excluded?.map(stock => (
                <div key={stock.stockCode} className="flex items-center justify-between gap-1 px-1 py-0.5">
                  <span className="truncate text-[10.5px] text-white">- {stock.stockName}</span>
                  <button
                    type="button"
                    onClick={() => handleRemove(stock.stockCode)}
                    className="shrink-0 border-0 bg-transparent text-red-500 hover:text-red-400"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
