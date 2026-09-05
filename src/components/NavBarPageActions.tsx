import { ShareIcon, SettingsIcon, MaximizeIcon, MinimizeIcon } from '@/components/icons/MarketMapIcons'

interface Props {
  onToggleSettings: () => void
  onOpenShare: () => void
  isNativeFullscreen: boolean
  onToggleFullscreen: () => void
}

const BUTTON_CLASS =
  'flex h-7 w-7 items-center justify-center border-0 bg-transparent text-gray-400 outline-none hover:text-white'

// SubNavBar 우측에 들어가는 공용 액션 버튼 3개(설정/공유/F11) — 지도/커스텀/요약/섹터 페이지가 전부
// 동일하게 쓴다. 설정 토글/공유 열기/풀스크린 토글은 페이지마다 다른 상태에 붙어있어 콜백으로 받는다.
export default function NavBarPageActions({ onToggleSettings, onOpenShare, isNativeFullscreen, onToggleFullscreen }: Props) {
  return (
    <>
      <button type="button" aria-label="설정" className={BUTTON_CLASS} onClick={onToggleSettings}>
        <SettingsIcon className="h-4 w-4" />
      </button>
      <button type="button" aria-label="공유" className={BUTTON_CLASS} onClick={onOpenShare}>
        <ShareIcon className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="F11"
        className={`flex h-7 w-7 items-center justify-center border-0 bg-transparent outline-none hover:text-white ${
          isNativeFullscreen ? 'text-[#4f8fd6]' : 'text-gray-400'
        }`}
        onClick={onToggleFullscreen}
      >
        {isNativeFullscreen ? <MinimizeIcon className="h-4 w-4" /> : <MaximizeIcon className="h-4 w-4" />}
      </button>
    </>
  )
}
