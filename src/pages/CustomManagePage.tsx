import { useEffect, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import NavBar from '@/components/NavBar'
import SubNavBar from '@/components/SubNavBar'
import MarketMapColorThresholdEditorPanel from '@/components/MarketMapColorThresholdEditorPanel'
import SettingsSidebar from '@/components/SettingsSidebar'
import MarketMapShareModal from '@/components/MarketMapShareModal'
import AdminSectorTable from '@/components/AdminSectorTable'
import AdminStockTable from '@/components/AdminStockTable'
import Spinner from '@/components/Spinner'
import NavBarPageActions from '@/components/NavBarPageActions'
import { useCustomSectors, useStockSectors } from '@/hooks/useMarketMapCustom'
import { useGlobalSettings } from '@/hooks/useGlobalSettings'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { useSession, useIsLoggedIn } from '@/hooks/useSession'
import { useLoginGate } from '@/hooks/useLoginGate'
import { captureElementToClipboard } from '@/utils/captureToClipboard'
import { captureElementToDownload } from '@/utils/captureToDownload'

type CopyStatus = 'idle' | 'copying' | 'copied' | 'error'
type DownloadStatus = 'idle' | 'downloading' | 'error'

// 커스텀 섹터·종목 배정 관리 화면 — 옛 /admin/sector, /admin/stock(MarketMapAdminPage, IP 관리자 전용)를
// 대체한다. 이제는 admin 역할이 아니라 로그인 여부로 접근을 가른다(가입/로그인 전환 지시서 4) — 누구든
// 로그인하면 자신의 커스텀 섹터를 관리할 수 있다. 비로그인으로 직접 URL 진입/새로고침해도 로그인
// 팝업을 띄우고, 성공하면 이 경로로 돌아온다.
export default function CustomManagePage() {
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  // mode 파라미터 없이 "커스텀" 탭 자체를 클릭했을 때는 섹터 페이지로 간다(SubNavBar의
  // CUSTOM_MODE_LIST_ITEMS와 동일하게 섹터를 기본으로 취급).
  const mode = pathname === '/admin/stock' || searchParams.get('mode') === 'stock' ? 'stock' : 'sector'
  // AdminStockTable의 툴바(종목수/실행취소·다시실행/필터/엑셀 등)를 이 DOM 노드로 포털링해서 세
  // 번째 바 안에 그린다 — useRef 대신 useState인 이유는, ref 콜백이 커밋 단계에서 실행되므로
  // useState로 받아야 그 노드가 준비된 뒤 리렌더가 한 번 더 일어나 AdminStockTable에 null이 아닌
  // 실제 노드가 확실히 전달된다.
  const [toolbarContainer, setToolbarContainer] = useState<HTMLDivElement | null>(null)

  const { data: session, isLoading: isSessionLoading } = useSession()
  const isLoggedIn = useIsLoggedIn()
  const { requireLogin } = useLoginGate()

  const {
    data: sectors,
    isLoading: isSectorsLoading,
    refetch: refetchSectors,
    isRefetching: isRefetchingSectors,
  } = useCustomSectors({ enabled: isLoggedIn })
  const {
    data: stockSectors,
    refetch: refetchStockSectors,
    isRefetching: isRefetchingStockSectors,
  } = useStockSectors({ enabled: isLoggedIn })

  const { settingsModalProps, colorEditorPanelProps } = useGlobalSettings({ needsTree: false })
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>('idle')
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()
  const captureRef = useRef<HTMLDivElement>(null)

  // 세션 확인이 끝났는데 비로그인이면 곧바로 로그인 팝업을 띄운다 — 메뉴 클릭이 아니라 직접 URL
  // 진입/새로고침으로 들어온 경우도 동일하게 막는다. returnTo는 지금 이 경로 그대로.
  useEffect(() => {
    if (!isSessionLoading && session && !session.authenticated) requireLogin(pathname)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 세션 로딩이 끝나 인증 여부가 바뀔 때만 반응하면 됨
  }, [isSessionLoading, session])

  const handleCopy = async () => {
    if (!captureRef.current) return
    setCopyStatus('copying')
    try {
      await captureElementToClipboard(captureRef.current)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('error')
    } finally {
      setTimeout(() => setCopyStatus('idle'), 2000)
    }
  }

  const handleDownload = async () => {
    if (!captureRef.current) return
    setDownloadStatus('downloading')
    try {
      await captureElementToDownload(captureRef.current, 'market-map-admin.png')
    } catch {
      setDownloadStatus('error')
    } finally {
      setTimeout(() => setDownloadStatus('idle'), 2000)
    }
  }

  const copyLabel =
    copyStatus === 'copying' ? 'Copying' : copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Failed' : 'Copy'
  const downloadLabel = downloadStatus === 'error' ? 'Failed' : 'Download'

  const actions = (
    <NavBarPageActions
      onRefresh={mode === 'stock' ? refetchStockSectors : refetchSectors}
      isRefreshing={mode === 'stock' ? isRefetchingStockSectors : isRefetchingSectors}
      onToggleSettings={() => settingsModalProps.onOpenChange(!settingsModalProps.isOpen)}
      isSettingsOpen={settingsModalProps.isOpen}
      onOpenShare={() => setIsShareOpen(true)}
      isNativeFullscreen={isNativeFullscreen}
      onToggleFullscreen={handleToggleNativeFullscreen}
    />
  )

  // 세션 확인 중이거나(로그인 여부를 아직 모름) 로그인 사용자의 섹터 목록을 받아오는 동안은 상단바+
  // 스피너만 보여준다 — 비로그인용 안내와 실제 테이블이 뒤섞여 잠깐 보였다 사라지는 걸 막는다.
  if (isSessionLoading || (isLoggedIn && isSectorsLoading)) {
    return (
      <div className="flex h-screen flex-col overflow-hidden">
        <NavBar />
        <SubNavBar />
        <div className="flex justify-center p-16">
          <Spinner />
        </div>
      </div>
    )
  }

  if (!isLoggedIn) {
    return (
      <div className="flex h-screen flex-col overflow-hidden">
        <NavBar />
        <SubNavBar />
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <p className="text-sm text-white">로그인이 필요합니다.</p>
          <button
            type="button"
            onClick={() => requireLogin(pathname)}
            className="nes-btn border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-sm font-bold text-black hover:bg-[var(--accent-hover)]"
          >
            로그인
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <NavBar />
      <SubNavBar actions={actions} />
      {/* 좌측 사이드바(종목/섹터 전환 + 버전관리 저장) 삭제 — 종목/섹터 전환은 SubNavBar의
          "커스텀" 탭 hover 목록으로 이동. 버전관리 저장(AdminVersionSaveSection)은 기능 검증과
          위치 재검토가 더 필요해서 일단 뺐다 — 다시 넣을 땐 이 컴포넌트를 재사용하면 된다. */}
      <div className="flex min-h-0 flex-1">
        {colorEditorPanelProps && (
          <div className="w-56 shrink-0 overflow-y-auto bg-[var(--surface)]">
            <MarketMapColorThresholdEditorPanel {...colorEditorPanelProps} />
          </div>
        )}
        {/* 설정 사이드바가 열려있으면 공유 캡처에도 같이 포함되도록, captureRef를 [세 번째 바+본문] 열 +
            사이드바를 감싸는 바깥 wrapper로 둔다 — 다른 페이지와 동일한 구조. 사이드바가 열리면 세
            번째 바(툴바)까지 같이 밀려서 좁아진다(본문만 밀리지 않는다). */}
        <div ref={captureRef} className="flex min-h-0 flex-1 bg-black">
          {/* min-w-0: 이 컬럼의 자동 최소 폭을 0으로 눌러서 창을 좁혀도 사이드바(w-80)가 항상 같은
              폭을 유지하게 한다(지도/섹터/요약 페이지와 동일). */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex h-7 w-full shrink-0 items-center bg-black/70 pl-1 pr-3 text-sm font-bold text-white">
              {/* 종목수/실행취소·다시실행/필터/엑셀 등 — AdminStockTable이 이 노드로 포털링해서 그린다.
                  섹터 모드일 땐 그런 툴바 자체가 없어서 빈 채로 둔다. */}
              {mode === 'stock' && <div ref={setToolbarContainer} className="flex h-full min-h-0 flex-1 items-center" />}
            </div>
            <div className="flex min-h-0 flex-1">
              <div
                className={`flex min-h-0 flex-1 flex-col px-4 pt-2 pb-4 ${mode === 'sector' ? 'overflow-y-auto' : ''}`}
              >
                {mode === 'stock' ? (
                  <AdminStockTable
                    items={stockSectors?.items ?? []}
                    sectors={sectors ?? []}
                    snapshotTime={stockSectors?.snapshotTime ?? null}
                    onRefetchSectors={() => refetchSectors()}
                    isRefetchingSectors={isRefetchingSectors}
                    toolbarContainer={toolbarContainer}
                  />
                ) : (
                  <AdminSectorTable sectors={sectors ?? []} />
                )}
              </div>
            </div>
          </div>
          <SettingsSidebar {...settingsModalProps} pageLabel="커스텀" />
        </div>
      </div>

      {isShareOpen && (
        <MarketMapShareModal
          onClose={() => setIsShareOpen(false)}
          onCopy={handleCopy}
          onDownload={handleDownload}
          copyLabel={copyLabel}
          downloadLabel={downloadLabel}
          isCopying={copyStatus === 'copying'}
          isDownloading={downloadStatus === 'downloading'}
          captureTarget={captureRef.current}
        />
      )}
    </div>
  )
}
