import { useState } from 'react'
import { hslToHex, UNSET_COLOR_SCALE_THRESHOLD_COLOR, type ColorScaleThreshold } from '@/utils/marketMapColorScale'

const SATURATION = 75

interface HuePreset {
  name: string
  label: string
  hue: number
  colorLabel: string | null
}

const HUE_PRESETS: HuePreset[] = [
  { name: 'red', label: '빨강', hue: 0, colorLabel: 'red' },
  { name: 'orange', label: '주황', hue: 28, colorLabel: 'orange' },
  { name: 'yellow', label: '노랑', hue: 50, colorLabel: 'yellow' },
  { name: 'green', label: '초록', hue: 142, colorLabel: 'green' },
  { name: 'teal', label: '청록', hue: 172, colorLabel: null },
  { name: 'cyan', label: '하늘', hue: 190, colorLabel: null },
  { name: 'blue', label: '파랑', hue: 217, colorLabel: 'blue' },
  { name: 'navy', label: '남색', hue: 232, colorLabel: 'navy' },
  { name: 'purple', label: '보라', hue: 271, colorLabel: 'purple' },
  { name: 'pink', label: '분홍', hue: 330, colorLabel: null },
]

const GRAY_LIGHTNESSES = [98, 87, 76, 65, 54, 43, 32, 21, 10, 0]
const COLOR_LIGHTNESSES = [82, 70, 58, 46, 34, 22]

interface ThresholdRowProps {
  threshold: ColorScaleThreshold
  active: boolean
  autoFocus: boolean
  onFocusRow: () => void
  onChangeThreshold: (percent: number) => void
}

// 하나의 threshold 행 — 부호(+/−) 토글 + 크기(항상 0 이상) 입력 + 색 미리보기만 담당한다.
// 아래 색상 팔레트에서 고른 색은 현재 활성 행에 적용된다.
function ThresholdRow({ threshold, active, autoFocus, onFocusRow, onChangeThreshold }: ThresholdRowProps) {
  // 새 행의 임시 색만 빈 값으로 표시한다. 백엔드는 colorLabel이 없는 저장 색상도 허용한다.
  const isUnset = threshold.id === undefined
    && threshold.colorLabel === null
    && threshold.color === UNSET_COLOR_SCALE_THRESHOLD_COLOR
  const [magnitudeText, setMagnitudeText] = useState(() => (isUnset ? '' : String(Math.abs(threshold.thresholdPercent))))
  const [sign, setSign] = useState<'+' | '-'>(threshold.thresholdPercent < 0 ? '-' : '+')

  // 크기가 0이면 부호는 의미가 없다(0%는 그냥 0%) — 어느 부호를 선택했든 무조건 0으로 정규화해서 커밋.
  const commit = (nextSign: '+' | '-', text: string) => {
    const magnitude = Number(text)
    if (!Number.isFinite(magnitude) || magnitude < 0 || magnitude > 30) {
      setMagnitudeText(isUnset ? '' : String(Math.abs(threshold.thresholdPercent)))
      return
    }
    onChangeThreshold(magnitude === 0 ? 0 : nextSign === '-' ? -magnitude : magnitude)
  }
  const handlePickSign = (nextSign: '+' | '-') => {
    setSign(nextSign)
    commit(nextSign, magnitudeText)
  }

  return (
    <div
      onClick={onFocusRow}
      className={`flex items-center gap-1.5 rounded px-1 py-1 ${active ? 'bg-white/10' : ''}`}
    >
      <div className="flex overflow-hidden rounded border border-gray-600">
        <button
          type="button"
          onClick={() => handlePickSign('+')}
          aria-label="상승(+)"
          className={`flex h-7 w-7 items-center justify-center text-sm ${sign === '+' ? 'bg-[var(--accent)] text-black' : 'bg-transparent text-gray-400 hover:text-white'}`}
        >
          +
        </button>
        <button
          type="button"
          onClick={() => handlePickSign('-')}
          aria-label="하락(-)"
          className={`flex h-7 w-7 items-center justify-center border-l border-gray-600 text-sm ${sign === '-' ? 'bg-[var(--accent)] text-black' : 'bg-transparent text-gray-400 hover:text-white'}`}
        >
          −
        </button>
      </div>
      <input
        type="number"
        min={0}
        max={30}
        step={0.1}
        placeholder="0"
        value={magnitudeText}
        onFocus={onFocusRow}
        onChange={e => setMagnitudeText(e.target.value)}
        onBlur={() => commit(sign, magnitudeText)}
        autoFocus={autoFocus}
        className="h-7 w-16 rounded border border-gray-600 bg-gray-800 px-2 text-xs text-white outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
      />
      <span className="text-xs text-gray-400">%</span>
      {isUnset ? (
        <span className="h-5 w-5 shrink-0 rounded border border-dashed border-gray-500" />
      ) : (
        <span className="h-5 w-5 shrink-0 rounded border border-gray-600" style={{ backgroundColor: threshold.color }} />
      )}
    </div>
  )
}

export interface ColorThresholdEditorProps {
  mode: 'add' | 'edit'
  // 이번 세션에서 편집 중인 threshold들(행 순서) — 이 패널이 열려있는 동안 조정할 때마다 부모(페이지)가
  // draft를 즉시 갱신해서 실제 지도에 실시간으로 반영한다(패널 자체는 로컬 값을 들고 있지 않음).
  // edit 모드에선 항상 1개, add 모드에선 "+"로 늘어날 수 있다.
  thresholds: ColorScaleThreshold[]
  onChangeThreshold: (rowIndex: number, percent: number) => void
  onChangeColor: (rowIndex: number, color: string, colorLabel: string | null) => void
  // add 모드에서만 쓰인다 — 입력칸/색이 비어있는 새 행을 하나 더 추가.
  onAddRow: () => void
  onApply: () => void
  onCancel: () => void
  isSaving: boolean
}

// 범례 아래에서 편집하는 색상 추가/수정 패널. 색상칸을 고르면 지도에 즉시 반영되고,
// 적용 시 서버에 저장된다. 취소 시에는 부모가 세션 시작 전 값으로 되돌린다.
export default function MarketMapColorThresholdEditorPanel({
  mode,
  thresholds,
  onChangeThreshold,
  onChangeColor,
  onAddRow,
  onApply,
  onCancel,
  isSaving,
}: ColorThresholdEditorProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const safeActiveIndex = Math.min(activeIndex, thresholds.length - 1)
  const activeThreshold = thresholds[safeActiveIndex]

  return (
    <div className="mt-3 border-t border-gray-700 pt-3 text-sm text-white">
      <div className="flex shrink-0 items-center justify-between">
        <p className="font-bold">{mode === 'add' ? '색상 추가' : '색상 수정'}</p>
        {/* 여러 포인트를 동시에 편집하면 헷갈리니 수정 모드에선 한 포인트만 — 이 버튼 자체가 add
            모드에서만 보인다. */}
        {mode === 'add' && (
          <button
            type="button"
            onClick={onAddRow}
            aria-label="항목 추가"
            className="flex h-8 w-8 items-center justify-center border-0 bg-transparent text-lg text-white hover:text-[var(--accent)]"
          >
            +
          </button>
        )}
      </div>

      <div className="mt-2 max-h-36 space-y-1 overflow-y-auto pr-1">
        {thresholds.map((threshold, index) => (
          <ThresholdRow
            key={index}
            threshold={threshold}
            active={index === safeActiveIndex}
            autoFocus={mode === 'add' && thresholds.length > 1 && index === thresholds.length - 1}
            onFocusRow={() => setActiveIndex(index)}
            onChangeThreshold={percent => onChangeThreshold(index, percent)}
          />
        ))}
      </div>

      <div className="mt-3 border-t border-gray-700 pt-3">
        <div className="mb-2 flex items-center gap-2 text-xs text-gray-300">
          <span className="h-5 w-5 border border-white/60" style={{ backgroundColor: activeThreshold?.color }} />
          <span>색상 선택</span>
        </div>
        <div className="grid grid-cols-10 gap-1 rounded bg-white/10 p-1" role="group" aria-label="색상 선택">
          {GRAY_LIGHTNESSES.map(lightness => {
            const color = hslToHex(0, 0, lightness)
            return (
              <button
                key={`gray-${lightness}`}
                type="button"
                aria-label={`회색 밝기 ${lightness}`}
                aria-pressed={activeThreshold?.color.toLowerCase() === color}
                onClick={() => onChangeColor(safeActiveIndex, color, 'gray')}
                className={`aspect-square min-w-0 border-2 p-0 ${activeThreshold?.color.toLowerCase() === color ? 'border-white ring-1 ring-black' : 'border-transparent hover:border-white'}`}
                style={{ backgroundColor: color }}
              />
            )
          })}
          {COLOR_LIGHTNESSES.flatMap(lightness =>
            HUE_PRESETS.map(preset => {
              const color = hslToHex(preset.hue, SATURATION, lightness)
              return (
                <button
                  key={`${preset.name}-${lightness}`}
                  type="button"
                  aria-label={`${preset.label} 밝기 ${lightness}`}
                  aria-pressed={activeThreshold?.color.toLowerCase() === color}
                  onClick={() => onChangeColor(safeActiveIndex, color, preset.colorLabel)}
                  className={`aspect-square min-w-0 border-2 p-0 ${activeThreshold?.color.toLowerCase() === color ? 'border-white ring-1 ring-black' : 'border-transparent hover:border-white'}`}
                  style={{ backgroundColor: color }}
                />
              )
            }),
          )}
        </div>
      </div>

      <div className="mt-4 flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onApply}
          disabled={isSaving}
          className="flex-1 rounded border border-[var(--accent)] bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-black transition-colors hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
        >
          {isSaving ? '적용 중...' : '적용'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded border border-gray-600 bg-transparent px-3 py-1.5 text-xs text-gray-200 transition-colors hover:bg-white/10 hover:text-white"
        >
          취소
        </button>
      </div>
    </div>
  )
}
