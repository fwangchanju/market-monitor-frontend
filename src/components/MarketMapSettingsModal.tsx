import { useEffect, useRef, useState } from 'react'
import { useIsAdmin } from '@/hooks/useAccess'
import { SettingsIcon } from '@/components/icons/MarketMapIcons'
import type { ColorScaleConfig, ColorScaleThreshold } from '@/utils/marketMapColorScale'
import type { MarketValueTierItem } from '@/types/api'

interface ExcludedCategory {
  categoryId: number
  categoryName: string
}

interface Props {
  isCustom: boolean
  onToggleCustom: () => void
  // null이면 제한 없음(=availableMaxDepth 전체 다 보여줌). 슬라이더가 다룰 수 있는 실제 상한은
  // 지금 트리(exclude/tier 필터링까지 반영된)의 최대 뎁스라 따로 내려받는다.
  maxDepth: number | null
  availableMaxDepth: number
  onChangeMaxDepth: (value: number) => void
  // 셋 다 슬라이더 인덱스 기준(0=OFF, 1=뎁스0, 2=뎁스1, ...) — 실제 뎁스 범위로의 변환은 호출부(페이지) 책임.
  marketValueDepthMinIndex: number
  marketValueDepthMaxIndex: number
  onChangeMarketValueDepthRange: (minIndex: number, maxIndex: number) => void
  avgChangeRateDepthMinIndex: number
  avgChangeRateDepthMaxIndex: number
  onChangeAvgChangeRateDepthRange: (minIndex: number, maxIndex: number) => void
  upDownCountDepthMinIndex: number
  upDownCountDepthMaxIndex: number
  onChangeUpDownCountDepthRange: (minIndex: number, maxIndex: number) => void
  // 등락률 태그/툴팁에 가중평균 대신 산술평균을 쓸지.
  avgChangeRateUseSimple: boolean
  onToggleAvgChangeRateUseSimple: () => void
  // 오름차순(소→초) 정렬된 시가총액 구간 정의 — GET /market-map/value-tiers 조회 결과(useMarketValueTiers).
  // 아직 로딩 전이면 빈 배열.
  tiers: MarketValueTierItem[]
  // tiers 배열 기준 인덱스. 이 구간(포함) 밖의 시가총액 등급은 마켓맵에서 제외된다.
  tierRangeMinIndex: number
  tierRangeMaxIndex: number
  onChangeTierRange: (minIndex: number, maxIndex: number) => void
  // 개별 섹터를 켜고 끄는 토글이 아니라, "섹터 제외를 적용할지 말지" 자체를 한 번에 켜고 끄는 스위치.
  // 어떤 섹터를 제외 목록에 넣을지는 마켓맵에서 우클릭으로 추가/이 목록에서 X로 제거하는 것으로만 관리한다.
  sectorFilterEnabled: boolean
  onToggleSectorFilter: () => void
  excludedCategories: ExcludedCategory[]
  onRemoveExcludedCategory: (categoryId: number) => void
  // 마켓맵 등락률 컬러 스케일 draft(및 그 setter) — null이면 아직 서버 조회 전. 실제 트리맵/범례에
  // 쓰이는 값과 동일한 참조라, 여기서 편집하는 즉시 지도 색이 실시간으로 바뀐다(별도 미리보기 불필요).
  // admin이 아니거나 아직 로딩 전이면 "색상 설정" 섹션 자체가 안 보인다.
  colorScaleDraft: ColorScaleConfig | null
  // "색상 커스텀 모드" 토글 — 순수 로컬(세션스토리지) 상태. draft(=저장 대상)와는 분리돼 있어서
  // 껐다 켜도 draft에 저장해둔 값은 건드리지 않는다.
  colorCustomOn: boolean
  onChangeColorCustomOn: (on: boolean) => void
  // 추가/수정은 이 팝업이 아니라 좌측 필터 바 하단 패널(MarketMapColorThresholdEditorPanel)에서 진행된다
  // — 이 팝업은 그 세션이 시작되면(onAddColorThreshold/onEditColorThreshold) 잠깐 닫히고, 세션이
  // 끝나면(적용/취소) 페이지가 다시 열어준다. 저장은 그 패널의 "적용"과 이 팝업의 삭제-확인이 각자
  // 알아서 하므로 이 팝업 자체엔 더 이상 "저장" 버튼이 없다.
  onAddColorThreshold: () => void
  onEditColorThreshold: (index: number) => void
  onDeleteColorThreshold: (index: number) => void
  // 팝업 열림 상태를 페이지가 들고 있어야 위 세션 전환(잠깐 닫혔다가 다시 열리는 것)이 가능하다.
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  compact?: boolean
}

// checked가 꺼지면 라벨 텍스트도 같이 옅어져서, 꺼져있다는 게 스위치 색뿐 아니라 글자로도 드러난다.
function ToggleSwitch({
  checked,
  onChange,
  label,
  hint,
  disabled = false,
  bold = false,
  labelClassName = '',
}: {
  checked: boolean
  onChange: () => void
  label: string
  hint?: string
  disabled?: boolean
  bold?: boolean
  labelClassName?: string
}) {
  // justify-between으로 라벨/스위치를 양 끝으로 벌리지 않고, 스위치를 맨 왼쪽 고정 위치에 두고
  // 그 뒤에 라벨 - (hint) 순서로 붙인다 — 라벨 길이가 설정마다 달라도 스위치 위치는 항상 같은
  // x좌표에 정렬된다(라벨이 뒤에 있으면 라벨 길이만큼 스위치 위치가 들쭉날쭉해짐).
  return (
    <div className={`flex items-center gap-2 ${disabled ? 'opacity-40' : ''}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onChange}
        disabled={disabled}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-[#4f8fd6]' : 'bg-gray-600'} ${disabled ? 'cursor-not-allowed' : ''}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`}
        />
      </button>
      <span className={`${labelClassName} ${bold ? 'font-bold' : ''} ${checked ? 'text-white' : 'text-gray-500'}`}>{label}</span>
      {hint && <span className="text-[10.5px] text-gray-500">{hint}</span>}
    </div>
  )
}

// 뎁스 범위 슬라이더의 맨 왼쪽 칸(인덱스 0)은 실제 뎁스가 아니라 OFF 자리 — 두 핸들이 전부 여기 있으면
// 완전히 꺼진 상태다. 그 오른쪽부터 1차 분류(뎁스0), 2차 분류(뎁스1), ...로 이어진다.
function depthRangeLabel(index: number): string {
  return index === 0 ? '끄기' : `${index}차 분류`
}

// 뎁스 범위 슬라이더 라벨(등락률/등락 종목수/시가총액 합)도 ToggleSwitch와 같은 방식으로
// OFF면 회색, 켜져있으면 흰색으로 표시한다.
function depthRangeSliderLabelClass(maxIndex: number): string {
  return maxIndex > 0 ? 'text-white' : 'text-gray-500'
}

// 양쪽 끝에 핸들이 있으면 전체 구간 다 보여주고, 핸들을 안쪽으로 옮기면 그 구간(포함) 밖은 제외된다.
// 두 핸들은 서로를 지나칠 수 없다(겹치는 건 허용 — 그러면 그 한 칸만 표시).
function RangeSlider({
  minIndex,
  maxIndex,
  steps,
  labels,
  minAriaLabel,
  maxAriaLabel,
  onChange,
  disabled = false,
  offIndex,
}: {
  minIndex: number
  maxIndex: number
  steps: number
  labels: string[]
  minAriaLabel: string
  maxAriaLabel: string
  onChange: (minIndex: number, maxIndex: number) => void
  disabled?: boolean
  // OFF 전용 칸의 인덱스(주로 0). 있으면: 드래그로는 이 칸에 들어가거나 나갈 수 없다(항상 offIndex+1
  // 이상만 드래그 가능) — OFF ↔ ON 전환은 아래 라벨 클릭으로만 한다.
  offIndex?: number
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const isOff = offIndex !== undefined && minIndex === offIndex && maxIndex === offIndex

  // 핸들 버튼은 순전히 시각적 표시일 뿐, 실제 클릭/드래그는 트랙 전체가 받는다 — 두 핸들이 겹치면
  // DOM상 나중에 그려지는 쪽(max)이 항상 클릭을 가로채 반대쪽 핸들을 못 잡는 문제를 이렇게 피한다.
  // 클릭 지점이 두 핸들의 중점보다 왼쪽이면 min을, 오른쪽이면 max를 그 위치로 옮긴다.
  //
  // offIndex가 있는 슬라이더(등락률/등락 종목수/시가총액 합)는 드래그와 클릭을 다르게 취급한다 —
  // 포인터가 실제로 움직였으면(threshold 이상) "드래그"로 보고 OFF 칸은 건드리지 않는 기존 범위
  // 조정만, 움직임 없이 그냥 뗐으면("클릭") OFF 칸을 클릭했으면 완전히 꺼짐, 다른 칸을 클릭했으면
  // 좌측은 첫 뎁스로 우측은 그 칸으로 한번에 점프 — 그래야 드래그만으로는 OFF에 들어가거나
  // 나갈 수 없으면서도(핸들끼리 서로 못 지나치는 규칙 때문에 트랩에 빠짐), 클릭 한 번으로 켜고 끌 수 있다.
  const CLICK_MOVE_THRESHOLD = 4
  const startDrag = (e: React.PointerEvent) => {
    if (disabled) return
    e.preventDefault()
    const track = trackRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    const rawIndexFromClientX = (clientX: number) => {
      const ratio = rect.width > 0 ? Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) : 0
      return Math.round(ratio * steps)
    }
    // OFF 칸으로는 드래그가 들어갈 수 없다 — 실제 뎁스값 중 최소인 offIndex+1이 바닥.
    const dragIndexFromClientX = (clientX: number) => {
      const index = rawIndexFromClientX(clientX)
      return offIndex !== undefined ? Math.max(index, offIndex + 1) : index
    }
    const which: 'min' | 'max' = dragIndexFromClientX(e.clientX) <= (minIndex + maxIndex) / 2 ? 'min' : 'max'
    const startX = e.clientX
    let dragged = false
    const handleMove = (ev: PointerEvent) => {
      if (!dragged && Math.abs(ev.clientX - startX) < CLICK_MOVE_THRESHOLD) return
      dragged = true
      if (offIndex !== undefined && isOff) return // OFF 상태에서는 드래그 자체가 무효
      const index = dragIndexFromClientX(ev.clientX)
      if (which === 'min') onChange(Math.min(index, maxIndex), maxIndex)
      else onChange(minIndex, Math.max(index, minIndex))
    }
    const handleUp = (ev: PointerEvent) => {
      document.removeEventListener('pointermove', handleMove)
      document.removeEventListener('pointerup', handleUp)
      if (dragged) return
      // 움직이지 않고 뗐다 = 클릭. offIndex가 없는(시가총액 구간) 슬라이더는 그냥 가까운 핸들을 그 자리로.
      if (offIndex === undefined) {
        const index = dragIndexFromClientX(ev.clientX)
        if (which === 'min') onChange(Math.min(index, maxIndex), maxIndex)
        else onChange(minIndex, Math.max(index, minIndex))
        return
      }
      const clickedIndex = rawIndexFromClientX(ev.clientX)
      if (clickedIndex === offIndex) {
        onChange(offIndex, offIndex) // OFF 클릭 → 항상 완전히 꺼짐
      } else if (isOff) {
        onChange(offIndex + 1, clickedIndex) // OFF에서 켜질 땐 좌측 첫 뎁스 + 클릭한 칸
      } else {
        // 이미 켜져있으면 더 가까운 핸들만 그 자리로 — 드래그와 동일하게 동작.
        const index = Math.max(clickedIndex, offIndex + 1)
        if (which === 'min') onChange(Math.min(index, maxIndex), maxIndex)
        else onChange(minIndex, Math.max(index, minIndex))
      }
    }
    document.addEventListener('pointermove', handleMove)
    document.addEventListener('pointerup', handleUp)
  }

  // 데이터가 얕아서 steps가 minIndex/maxIndex(기본값 등으로 미리 정해진 값)보다 작아질 수 있다 —
  // 그대로 두면 핸들이 트랙 밖(100% 너머)으로 밀려나므로 표시 위치만 안전하게 클램프한다.
  const minPct = (Math.min(minIndex, steps) / steps) * 100
  const maxPct = (Math.min(maxIndex, steps) / steps) * 100

  return (
    <div>
      <div
        ref={trackRef}
        className={`relative h-4 w-full ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        onPointerDown={startDrag}
      >
        <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded bg-gray-600" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded bg-[#4f8fd6]"
          style={{ left: `${minPct}%`, width: `${maxPct - minPct}%` }}
        />
        <div
          aria-label={minAriaLabel}
          className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 touch-none rounded-full bg-[#4f8fd6]"
          style={{ left: `${minPct}%` }}
        />
        <div
          aria-label={maxAriaLabel}
          className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 touch-none rounded-full bg-[#4f8fd6]"
          style={{ left: `${maxPct}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs text-gray-400">
        {labels.map((label, index) => (
          <span key={index}>{label}</span>
        ))}
      </div>
    </div>
  )
}

function colorThresholdLabel(threshold: ColorScaleThreshold): string {
  if (threshold.thresholdPercent === 0) return '0% (기준)'
  return `${threshold.thresholdPercent > 0 ? '+' : ''}${threshold.thresholdPercent}%`
}

type SectionId = 'display' | 'exclude' | 'color'

export default function MarketMapSettingsModal({
  isCustom,
  onToggleCustom,
  maxDepth,
  availableMaxDepth,
  onChangeMaxDepth,
  marketValueDepthMinIndex,
  marketValueDepthMaxIndex,
  onChangeMarketValueDepthRange,
  avgChangeRateDepthMinIndex,
  avgChangeRateDepthMaxIndex,
  onChangeAvgChangeRateDepthRange,
  upDownCountDepthMinIndex,
  upDownCountDepthMaxIndex,
  onChangeUpDownCountDepthRange,
  avgChangeRateUseSimple,
  onToggleAvgChangeRateUseSimple,
  tiers,
  tierRangeMinIndex,
  tierRangeMaxIndex,
  onChangeTierRange,
  sectorFilterEnabled,
  onToggleSectorFilter,
  excludedCategories,
  onRemoveExcludedCategory,
  colorScaleDraft,
  colorCustomOn,
  onChangeColorCustomOn,
  onAddColorThreshold,
  onEditColorThreshold,
  onDeleteColorThreshold,
  isOpen,
  onOpenChange,
  compact = false,
}: Props) {
  const isAdmin = useIsAdmin()
  const [activeSection, setActiveSection] = useState<SectionId>('display')
  const scrollRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Partial<Record<SectionId, HTMLDivElement | null>>>({})
  const stickyToggleRef = useRef<HTMLDivElement>(null)

  const showColorSection = isAdmin && colorScaleDraft !== null
  const sections: { id: SectionId; label: string }[] = [
    { id: 'display', label: '표시 범위' },
    { id: 'exclude', label: '제외 설정' },
    ...(showColorSection ? [{ id: 'color' as const, label: '색상 설정' }] : []),
  ]

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onOpenChange])

  // "커스텀 모드" 토글이 본문 컬럼 안에서 sticky로 상단에 붙어있는 만큼, 그 높이만큼은 스크롤
  // 타겟/판정 기준에서 빼줘야 섹션 제목이 토글 바 밑에 가려지지 않는다.
  const stickyToggleHeight = () => stickyToggleRef.current?.offsetHeight ?? 0

  // 좌측 대분류 목록 클릭 → 우측 본문에서 해당 섹션 위치로 부드럽게 스크롤.
  const scrollToSection = (id: SectionId) => {
    const container = scrollRef.current
    const target = sectionRefs.current[id]
    if (!container || !target) return
    const offset =
      target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - stickyToggleHeight()
    container.scrollTo({ top: offset, behavior: 'smooth' })
  }

  // 우측 본문을 직접 스크롤해도 좌측 목록의 강조가 따라가도록 — 각 섹션 중 상단(=sticky 토글 바로
  // 아래)에 가장 가깝게 올라온(이미 지나친) 섹션을 "현재 위치"로 판단한다.
  const handleScroll = () => {
    const container = scrollRef.current
    if (!container) return
    const containerTop = container.getBoundingClientRect().top + stickyToggleHeight()
    let current: SectionId = sections[0]?.id ?? 'display'
    for (const { id } of sections) {
      const el = sectionRefs.current[id]
      if (!el) continue
      const top = el.getBoundingClientRect().top - containerTop
      if (top <= 24) current = id
    }
    setActiveSection(current)
  }

  // 색상 추가/수정 세션이 끝나고 이 팝업이 다시 열릴 때, 본문은 새로 마운트되며 스크롤이 맨 위로
  // 리셋되지만 activeSection(좌측 강조)은 이전 값("색상 설정")이 그대로 남아있어 서로 어긋난다 —
  // 열릴 때마다 activeSection이 가리키는 위치로 다시 스크롤을 맞춰준다.
  useEffect(() => {
    if (!isOpen) return
    const raf = requestAnimationFrame(() => scrollToSection(activeSection))
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 열릴 때 한 번만 맞추면 됨, activeSection이 그 뒤에 바뀌는 건(스크롤 추적) 반응 대상이 아님
  }, [isOpen])

  const depthValue = Math.min(maxDepth ?? availableMaxDepth, availableMaxDepth)
  const isDepthDisabled = !isCustom || availableMaxDepth <= 1

  const sortedColorThresholds = (colorScaleDraft?.thresholds ?? [])
    .map((threshold, index) => ({ threshold, index }))
    .sort((a, b) => b.threshold.thresholdPercent - a.threshold.thresholdPercent)

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        aria-label="설정"
        className={`flex items-center justify-center rounded text-gray-700 hover:bg-gray-100 hover:text-[#4f8fd6] ${compact ? 'p-1' : 'h-9 w-9'}`}
      >
        <SettingsIcon className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
      </button>
      {isOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70" onClick={() => onOpenChange(false)}>
          <div
            className="flex max-h-[80vh] w-full max-w-3xl flex-col border border-gray-700 bg-[var(--surface)]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-gray-700 p-6">
              <p className="flex h-8 items-center text-xl font-bold leading-none text-white">설정</p>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="닫기"
                className="nes-btn flex h-12 w-12 items-center justify-center border-gray-600 bg-black p-0 text-2xl text-white hover:bg-gray-800"
              >
                ✕
              </button>
            </div>

            <div className="flex min-h-0 flex-1">
              <div className="w-64 shrink-0 overflow-y-auto">
                {sections.map(section => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => scrollToSection(section.id)}
                    className={`block w-full border-0 px-4 py-2.5 text-left text-lg outline-none focus:outline-none ${
                      activeSection === section.id ? 'bg-white/10 text-white' : 'bg-transparent text-gray-500 hover:text-white'
                    }`}
                  >
                    {section.label}
                  </button>
                ))}
              </div>

              {/* 마지막 섹션도 컨테이너 맨 위까지 스크롤될 수 있도록 하단에 여유 패딩을 둔다 —
                  그래야 스크롤스파이(top<=임계값 판정)가 마지막 섹션에서도 정상 동작한다. */}
              <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 pb-[32rem] text-sm">
                {/* 스크롤하거나 좌측 목록으로 점프해도 늘 맨 위에 고정 — 컨테이너 자체엔 top 패딩을
                    아예 안 둬서(위 className에 pt/p 없음) sticky가 음수 마진 트릭 없이 그냥 top:0에
                    정확히 붙는다(음수 마진+sticky 조합은 스크롤 후 픽셀 단위로 어긋나 이전 섹션 일부가
                    위로 삐져나오는 경우가 있었음). 좌우 폭만 -mx-4로 컨테이너의 px-4를 상쇄해 꽉 채운다.
                    구분선 아래 여백은 각 섹션 자신의 pt-8로 준다 — 그래야 어느 섹션으로 점프해도
                    (좌측 클릭/스크롤 무관) 항상 이 바로 아래에서 같은 간격을 유지한다. */}
                <div
                  ref={stickyToggleRef}
                  className="sticky top-0 z-10 -mx-4 border-b border-gray-700 bg-[var(--surface)] px-4 pt-4 pb-3"
                >
                  <ToggleSwitch checked={isCustom} onChange={onToggleCustom} label="커스텀 모드" labelClassName="text-lg" />
                </div>
                <div ref={el => { sectionRefs.current.display = el }} className="pt-8 text-white">
                  <p className="text-base">표시 범위</p>
                  <div className={`mt-2 pl-2 text-sm ${isCustom ? '' : 'opacity-40'}`}>
                    <span className="text-white">시가총액</span>
                    <div className="mt-2 max-w-[16rem]">
                      <RangeSlider
                        minIndex={tierRangeMinIndex}
                        maxIndex={tierRangeMaxIndex}
                        steps={Math.max(tiers.length - 1, 1)}
                        labels={tiers.map(tier => tier.label)}
                        minAriaLabel="최소 시가총액 구간"
                        maxAriaLabel="최대 시가총액 구간"
                        onChange={onChangeTierRange}
                        disabled={!isCustom || tiers.length === 0}
                      />
                    </div>
                  </div>
                  <div className={`mt-3 pl-2 text-sm ${isDepthDisabled ? 'opacity-40' : ''}`}>
                    <div className="flex max-w-[16rem] items-center justify-between">
                      <span className="text-white">분류 차수 범위</span>
                      <span className="text-gray-400">
                        {depthValue}/{availableMaxDepth}
                      </span>
                    </div>
                    <div className="mt-2 max-w-[16rem]">
                      <input
                        type="range"
                        min={1}
                        max={availableMaxDepth}
                        value={depthValue}
                        onChange={e => onChangeMaxDepth(Number(e.target.value))}
                        disabled={isDepthDisabled}
                        className="w-full accent-[#4f8fd6] disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                  <div className={`mt-3 pl-2 text-sm ${isCustom ? '' : 'opacity-40'}`}>
                    <span className={depthRangeSliderLabelClass(avgChangeRateDepthMaxIndex)}>등락률</span>
                    <div className="mt-2 max-w-[16rem]">
                      <RangeSlider
                        minIndex={avgChangeRateDepthMinIndex}
                        maxIndex={avgChangeRateDepthMaxIndex}
                        steps={availableMaxDepth}
                        labels={Array.from({ length: availableMaxDepth + 1 }, (_, index) => depthRangeLabel(index))}
                        minAriaLabel="최소 등락률 표시 뎁스"
                        offIndex={0}
                        maxAriaLabel="최대 등락률 표시 뎁스"
                        onChange={onChangeAvgChangeRateDepthRange}
                        disabled={!isCustom}
                      />
                    </div>
                    <div className="mt-2">
                      <ToggleSwitch
                        checked={avgChangeRateUseSimple}
                        onChange={onToggleAvgChangeRateUseSimple}
                        label="산술평균 사용"
                        hint="(기본: 가중평균)"
                      />
                    </div>
                  </div>
                  <div className={`mt-3 pl-2 text-sm ${isCustom ? '' : 'opacity-40'}`}>
                    <span className={depthRangeSliderLabelClass(upDownCountDepthMaxIndex)}>등락 종목수</span>
                    <div className="mt-2 max-w-[16rem]">
                      <RangeSlider
                        minIndex={upDownCountDepthMinIndex}
                        maxIndex={upDownCountDepthMaxIndex}
                        steps={availableMaxDepth}
                        labels={Array.from({ length: availableMaxDepth + 1 }, (_, index) => depthRangeLabel(index))}
                        minAriaLabel="최소 등락 종목수 표시 뎁스"
                        offIndex={0}
                        maxAriaLabel="최대 등락 종목수 표시 뎁스"
                        onChange={onChangeUpDownCountDepthRange}
                        disabled={!isCustom}
                      />
                    </div>
                  </div>
                  <div className={`mt-3 pl-2 text-sm ${isCustom ? '' : 'opacity-40'}`}>
                    <span className={depthRangeSliderLabelClass(marketValueDepthMaxIndex)}>시가총액 합</span>
                    <div className="mt-2 max-w-[16rem]">
                      <RangeSlider
                        minIndex={marketValueDepthMinIndex}
                        maxIndex={marketValueDepthMaxIndex}
                        steps={availableMaxDepth}
                        labels={Array.from({ length: availableMaxDepth + 1 }, (_, index) => depthRangeLabel(index))}
                        minAriaLabel="최소 시가총액 합 표시 뎁스"
                        offIndex={0}
                        maxAriaLabel="최대 시가총액 합 표시 뎁스"
                        onChange={onChangeMarketValueDepthRange}
                        disabled={!isCustom}
                      />
                    </div>
                  </div>
                </div>

                <div ref={el => { sectionRefs.current.exclude = el }} className="mt-6 border-t border-gray-700 pt-8 text-white">
                  <p className="text-base">제외 설정</p>
                  <div className="mt-3 text-sm">
                    <ToggleSwitch
                      checked={sectorFilterEnabled}
                      onChange={onToggleSectorFilter}
                      label="섹터 기준"
                      disabled={!isCustom}
                    />
                    {isCustom && (
                      <div className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto pl-2">
                        {excludedCategories.length === 0 ? (
                          <p className="text-xs text-gray-500">제외된 섹터 없음</p>
                        ) : (
                          excludedCategories.map(category => (
                            <div key={category.categoryId} className="flex items-center justify-between gap-1 px-1 py-0.5">
                              <span className="min-w-0 truncate text-xs text-white">{category.categoryName}</span>
                              <button
                                type="button"
                                onClick={() => onRemoveExcludedCategory(category.categoryId)}
                                className="shrink-0 border-0 bg-transparent text-red-500 hover:text-red-400"
                              >
                                ✕
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {showColorSection && colorScaleDraft && (
                  <div ref={el => { sectionRefs.current.color = el }} className="mt-6 border-t border-gray-700 pt-8 text-white">
                    <p className="text-base">색상 설정</p>
                    <div className="mt-3">
                      <ToggleSwitch
                        checked={colorCustomOn}
                        onChange={() => onChangeColorCustomOn(!colorCustomOn)}
                        label="색상 커스텀 모드"
                        disabled={!isCustom}
                      />
                    </div>
                    <div className={`mt-3 flex flex-col gap-1 text-sm ${isCustom && colorCustomOn ? '' : 'pointer-events-none opacity-40'}`}>
                      <button
                        type="button"
                        onClick={onAddColorThreshold}
                        className="nes-btn self-start border-[#4f8fd6] bg-[#4f8fd6] px-3 py-1 text-xs text-white hover:brightness-125"
                      >
                        + 추가
                      </button>
                      {sortedColorThresholds.length === 0 ? (
                        <p className="px-2 py-1 text-gray-500">설정된 값이 없습니다</p>
                      ) : (
                        sortedColorThresholds.map(({ threshold, index }) => (
                          <div key={index} className="group flex items-center justify-between gap-3 rounded px-2 py-1.5 hover:bg-white/5">
                            <div className="flex items-center gap-2">
                              <span
                                className="h-3.5 w-3.5 shrink-0 rounded border border-gray-600"
                                style={{ backgroundColor: threshold.color }}
                              />
                              <span className="text-white">{colorThresholdLabel(threshold)}</span>
                            </div>
                            <div className="hidden items-center gap-3 group-hover:flex">
                              <button
                                type="button"
                                onClick={() => onEditColorThreshold(index)}
                                className="border-0 bg-transparent text-xs text-white hover:text-yellow-400"
                              >
                                수정
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteColorThreshold(index)}
                                className="border-0 bg-transparent text-xs text-red-500 hover:text-red-400"
                              >
                                삭제
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
