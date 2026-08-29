import { useEffect, useRef, useState } from 'react'
import { useRafThrottledCallback } from '@/hooks/useRafThrottledCallback'
import { hexToHsl, hslToHex, type ColorScaleThreshold } from '@/utils/marketMapColorScale'

const SATURATION = 75

interface HuePreset {
  name: string
  hue: number
  // 무채색(회색) 프리셋만 채도 0으로 별도 지정 — 나머지는 공통 SATURATION을 쓴다.
  saturation?: number
}

// 8개 = 4x4 그리드로 정확히 2줄에 나눠 떨어지도록 회색을 추가했다.
const HUE_PRESETS: HuePreset[] = [
  { name: 'red', hue: 0 },
  { name: 'orange', hue: 28 },
  { name: 'yellow', hue: 50 },
  { name: 'green', hue: 142 },
  { name: 'blue', hue: 217 },
  { name: 'navy', hue: 232 },
  { name: 'purple', hue: 271 },
  { name: 'gray', hue: 0, saturation: 0 },
]

// 명도(lightness) 그라데이션 바 — 왼쪽(밝음, 95%)에서 오른쪽(어두움, 8%)으로, Tailwind 50~950
// 램프와 같은 방향. 드래그 좌표는 rAF로 프레임당 한 번만 onChange에 커밋한다 — 이 값이 그대로
// colorScaleDraft로 흘러가 실제 지도가 즉시 리렌더되므로(memo 없는 트리맵 전체), mousemove를
// 그대로 반영하면 안 된다.
function LightnessBar({
  hue,
  saturation,
  lightness,
  onChange,
}: {
  hue: number
  saturation: number
  lightness: number
  onChange: (lightness: number) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const throttledChange = useRafThrottledCallback(onChange)

  const lightnessFromClientX = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return lightness
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return Math.round(95 - ratio * 87)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    const apply = (clientX: number) => throttledChange(lightnessFromClientX(clientX))
    apply(e.clientX)
    const handleMove = (ev: MouseEvent) => apply(ev.clientX)
    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }

  return (
    <div
      ref={trackRef}
      onMouseDown={handleMouseDown}
      className="relative h-4 w-full cursor-pointer rounded"
      style={{
        background: `linear-gradient(to right, hsl(${hue} ${saturation}% 95%), hsl(${hue} ${saturation}% 50%), hsl(${hue} ${saturation}% 8%))`,
      }}
    >
      <div
        className="pointer-events-none absolute top-0 h-4 w-1.5 -translate-x-1/2 bg-white shadow"
        style={{ left: `${((95 - lightness) / 87) * 100}%` }}
      />
    </div>
  )
}

interface ThresholdRowProps {
  threshold: ColorScaleThreshold
  active: boolean
  autoFocus: boolean
  onFocusRow: () => void
  onChangeThreshold: (percent: number) => void
}

// 하나의 threshold 행 — 부호(+/−) 토글 + 크기(항상 0 이상) 입력 + 색 미리보기만 담당한다. 톤 프리셋/명도
// 바는 패널 하단에 하나만 공유되고, 지금 커서가 들어가 있는(활성) 행에만 적용된다(아래 패널 참고).
function ThresholdRow({ threshold, active, autoFocus, onFocusRow, onChangeThreshold }: ThresholdRowProps) {
  // colorLabel이 null이면 "아직 아무 톤도 고르지 않은" 새 행 — 입력칸도 비워둔 채로 시작한다.
  const isUnset = threshold.colorLabel === null
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
          className={`flex h-7 w-7 items-center justify-center text-sm ${sign === '+' ? 'bg-[#4f8fd6] text-white' : 'bg-transparent text-gray-400 hover:text-white'}`}
        >
          +
        </button>
        <button
          type="button"
          onClick={() => handlePickSign('-')}
          aria-label="하락(-)"
          className={`flex h-7 w-7 items-center justify-center border-l border-gray-600 text-sm ${sign === '-' ? 'bg-[#4f8fd6] text-white' : 'bg-transparent text-gray-400 hover:text-white'}`}
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
        className="nes-input is-dark h-7 w-16 text-xs"
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

interface Props {
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

// 좌측 필터 바 맨 아래에 붙는 색상 추가/수정 패널 — 설정 팝업이 지도를 가리는 것과 달리 이 패널은
// 지도를 가리지 않아서, 색을 조정하는 동안 실제 지도 색 변화를 바로바로 볼 수 있다. "적용"을 눌러야
// 서버에 실제로 저장되고, "취소"를 누르면 이 세션에서 바꾼 값이 전부 되돌아간다(부모가 관리).
//
// 패널 전체 높이는 행 개수와 무관하게 고정이다 — 목록 영역만 정해진 높이(대략 4행) 안에서 자체
// 스크롤되고, 톤 프리셋/명도 바/적용·취소 버튼은 항상 같은 위치에 머문다.
export default function MarketMapColorThresholdEditorPanel({
  mode,
  thresholds,
  onChangeThreshold,
  onChangeColor,
  onAddRow,
  onApply,
  onCancel,
  isSaving,
}: Props) {
  const [activeIndex, setActiveIndex] = useState(0)
  const safeActiveIndex = Math.min(activeIndex, thresholds.length - 1)
  const activeThreshold = thresholds[safeActiveIndex]

  const [hue, setHue] = useState(0)
  const [saturation, setSaturation] = useState(SATURATION)
  const [lightness, setLightness] = useState(50)
  // 활성 행이 바뀔 때만(그 행의 색이 바뀔 때마다가 아니라) 톤 피커를 그 행의 현재 색으로 재동기화한다
  // — color 자체를 deps에 넣으면 드래그로 값을 바꾸는 도중에도 매번 되튕기며 싸운다.
  useEffect(() => {
    if (!activeThreshold) return
    const hsl = hexToHsl(activeThreshold.color)
    setHue(hsl.h)
    setSaturation(hsl.s)
    setLightness(hsl.l)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 위 주석 참고, 활성 인덱스에만 반응해야 함
  }, [safeActiveIndex])

  const handlePickHue = (preset: HuePreset) => {
    const nextSaturation = preset.saturation ?? SATURATION
    setHue(preset.hue)
    setSaturation(nextSaturation)
    onChangeColor(safeActiveIndex, hslToHex(preset.hue, nextSaturation, lightness), preset.name)
  }
  const handleLightnessChange = (newLightness: number) => {
    setLightness(newLightness)
    onChangeColor(safeActiveIndex, hslToHex(hue, saturation, newLightness), activeThreshold?.colorLabel ?? null)
  }

  return (
    <div className="flex h-[24rem] w-56 flex-col border-t border-gray-700 p-4 text-sm text-white">
      <div className="flex shrink-0 items-center justify-between">
        <p className="font-bold">{mode === 'add' ? '색상 추가' : '색상 수정'}</p>
        {/* 여러 포인트를 동시에 편집하면 헷갈리니 수정 모드에선 한 포인트만 — 이 버튼 자체가 add
            모드에서만 보인다. */}
        {mode === 'add' && (
          <button
            type="button"
            onClick={onAddRow}
            aria-label="항목 추가"
            className="flex h-8 w-8 items-center justify-center border-0 bg-transparent text-lg text-white hover:text-[#4f8fd6]"
          >
            +
          </button>
        )}
      </div>

      <div className="mt-3 h-40 shrink-0 space-y-1 overflow-y-auto pr-1">
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

      <div className="mt-3 shrink-0 border-t border-gray-800 pt-3">
        <div className="grid grid-cols-4 gap-2">
          {HUE_PRESETS.map(preset => (
            <button
              key={preset.name}
              type="button"
              title={preset.name}
              onClick={() => handlePickHue(preset)}
              className={`h-6 w-6 border-2 ${activeThreshold?.colorLabel === preset.name ? 'border-white' : 'border-transparent'}`}
              style={{ backgroundColor: hslToHex(preset.hue, preset.saturation ?? SATURATION, 50) }}
            />
          ))}
        </div>
        <div className="mt-2">
          <LightnessBar hue={hue} saturation={saturation} lightness={lightness} onChange={handleLightnessChange} />
        </div>
      </div>

      <div className="mt-4 flex shrink-0 items-center gap-2">
        <button type="button" onClick={onApply} disabled={isSaving} className="nes-btn is-save flex-1 text-xs">
          {isSaving ? '적용 중...' : '적용'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="nes-btn flex-1 border-gray-600 bg-black text-xs text-white hover:bg-gray-800"
        >
          취소
        </button>
      </div>
    </div>
  )
}
