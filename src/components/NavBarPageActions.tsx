import { CalendarIcon, ClockIcon, MaximizeIcon, MinimizeIcon, RefreshIcon, SettingsIcon, ShareIcon } from '@/components/icons/MarketMapIcons'

interface Props {
  onToggleSettings: () => void
  isSettingsOpen: boolean
  onOpenShare: () => void
  isNativeFullscreen: boolean
  onToggleFullscreen: () => void
  showSnapshotControls?: boolean
}

const BUTTON_CLASS =
  'flex h-7 w-7 items-center justify-center border-0 bg-transparent outline-none hover:text-[var(--accent)]'
const INACTIVE_BUTTON_CLASS = `${BUTTON_CLASS} text-gray-400`

// SubNavBar 우측에 들어가는 공용 액션 버튼 — 지도/커스텀/요약/섹터 페이지가 전부 동일하게 쓴다.
// 설정 토글/공유 열기/풀스크린 토글은 페이지마다 다른 상태에 붙어있어 콜백으로 받는다.
export default function NavBarPageActions({
  onToggleSettings,
  isSettingsOpen,
  onOpenShare,
  isNativeFullscreen,
  onToggleFullscreen,
  showSnapshotControls = false,
}: Props) {
  return (
    <>
      {showSnapshotControls && (
        <>
          <button type="button" aria-label="스냅샷 날짜" className={INACTIVE_BUTTON_CLASS}>
            <CalendarIcon className="h-4 w-4" />
          </button>
          <button type="button" aria-label="스냅샷 시간" className={INACTIVE_BUTTON_CLASS}>
            <ClockIcon className="h-4 w-4" />
          </button>
        </>
      )}
      <button type="button" aria-label="새로고침" className={INACTIVE_BUTTON_CLASS} onClick={() => window.location.reload()}>
        <RefreshIcon className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="설정"
        className={`${BUTTON_CLASS} ${isSettingsOpen ? 'text-[var(--accent)]' : 'text-gray-400'}`}
        onClick={onToggleSettings}
      >
        <SettingsIcon className="h-4 w-4" />
      </button>
      <button type="button" aria-label="공유" className={INACTIVE_BUTTON_CLASS} onClick={onOpenShare}>
        <ShareIcon className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="F11"
        className={`flex h-7 w-7 items-center justify-center border-0 bg-transparent outline-none hover:text-[var(--accent)] ${
          isNativeFullscreen ? 'text-[var(--accent)]' : 'text-gray-400'
        }`}
        onClick={onToggleFullscreen}
      >
        {isNativeFullscreen ? <MinimizeIcon className="h-4 w-4" /> : <MaximizeIcon className="h-4 w-4" />}
      </button>
    </>
  )
}
