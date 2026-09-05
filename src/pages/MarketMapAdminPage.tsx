import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { isAxiosError } from 'axios'
import NavBar from '@/components/NavBar'
import SubNavBar from '@/components/SubNavBar'
import MarketMapColorThresholdEditorPanel from '@/components/MarketMapColorThresholdEditorPanel'
import GlobalSettingsSidebar from '@/components/GlobalSettingsSidebar'
import MarketMapShareModal from '@/components/MarketMapShareModal'
import PermissionDenied from '@/components/PermissionDenied'
import AdminCategoryTable from '@/components/AdminCategoryTable'
import AdminStockTable from '@/components/AdminStockTable'
import Spinner from '@/components/Spinner'
import NavBarPageActions from '@/components/NavBarPageActions'
import { useAdminCategories, useStockCategories } from '@/hooks/useMarketMapAdmin'
import { useGlobalSettings } from '@/hooks/useGlobalSettings'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { captureElementToClipboard } from '@/utils/captureToClipboard'
import { captureElementToDownload } from '@/utils/captureToDownload'

type CopyStatus = 'idle' | 'copying' | 'copied' | 'error'
type DownloadStatus = 'idle' | 'downloading' | 'error'

export default function MarketMapAdminPage() {
  const [searchParams] = useSearchParams()
  const mode = searchParams.get('mode') === 'category' ? 'category' : 'stock'
  // AdminStockTable의 툴바(종목수/실행취소·다시실행/필터/엑셀 등)를 이 DOM 노드로 포털링해서 세
  // 번째 바 안에 그린다 — useRef 대신 useState인 이유는, ref 콜백이 커밋 단계에서 실행되므로
  // useState로 받아야 그 노드가 준비된 뒤 리렌더가 한 번 더 일어나 AdminStockTable에 null이 아닌
  // 실제 노드가 확실히 전달된다.
  const [toolbarContainer, setToolbarContainer] = useState<HTMLDivElement | null>(null)
  const {
    data: categories,
    error: categoriesError,
    isLoading,
    refetch: refetchCategories,
    isRefetching: isRefetchingCategories,
  } = useAdminCategories()
  const { data: stockCategories } = useStockCategories()

  const { settingsModalProps, colorEditorPanelProps } = useGlobalSettings({ needsTree: false })
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>('idle')
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()
  const captureRef = useRef<HTMLDivElement>(null)

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
      onToggleSettings={() => settingsModalProps.onOpenChange(!settingsModalProps.isOpen)}
      onOpenShare={() => setIsShareOpen(true)}
      isNativeFullscreen={isNativeFullscreen}
      onToggleFullscreen={handleToggleNativeFullscreen}
    />
  )

  // 로딩 중엔 admin 여부를 아직 모르므로, 403으로 걸러지기 전까지 사이드바/테이블 같은 실제
  // 콘텐츠가 먼저 그려졌다가 사라지지 않도록 상단바+스피너만 보여준다(AdminPage.tsx와 동일 패턴).
  if (isLoading) {
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

  if (isAxiosError(categoriesError) && categoriesError.response?.status === 403) {
    return <PermissionDenied />
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <NavBar />
      <SubNavBar actions={actions} />
      {/* 좌측 사이드바(종목/카테고리 전환 + 버전관리 저장) 삭제 — 종목/카테고리 전환은 SubNavBar의
          "커스텀" 탭 hover 목록으로 이동. 버전관리 저장(AdminVersionSaveSection)은 기능 검증과
          위치 재검토가 더 필요해서 일단 뺐다 — 다시 넣을 땐 이 컴포넌트를 재사용하면 된다. */}
      <div className="flex min-h-0 flex-1">
        {colorEditorPanelProps && (
          <div className="w-56 shrink-0 overflow-y-auto bg-[var(--surface)]">
            <MarketMapColorThresholdEditorPanel {...colorEditorPanelProps} />
          </div>
        )}
        {/* 설정 사이드바가 열려있으면 공유 캡처에도 같이 포함되도록, captureRef를 세 번째 바(고정) +
            테이블/사이드바(밀리는 영역) 전체를 감싸는 바깥 wrapper로 둔다 — 다른 페이지와 동일한 구조. */}
        <div ref={captureRef} className="flex min-h-0 flex-1 flex-col bg-black">
          <div className="flex h-7 w-full shrink-0 items-center bg-black/70 pl-1 pr-3 text-sm font-bold text-white">
            {/* 종목수/실행취소·다시실행/필터/엑셀 등 — AdminStockTable이 이 노드로 포털링해서 그린다.
                카테고리 모드일 땐 그런 툴바 자체가 없어서 빈 채로 둔다. */}
            {mode === 'stock' && <div ref={setToolbarContainer} className="flex h-full min-h-0 flex-1 items-center" />}
          </div>
          <div className="flex min-h-0 flex-1">
            <div
              className={`flex min-h-0 flex-1 flex-col px-4 pt-2 pb-4 ${mode === 'category' ? 'overflow-y-auto' : ''}`}
            >
              {mode === 'stock' ? (
                <AdminStockTable
                  items={stockCategories?.items ?? []}
                  categories={categories ?? []}
                  snapshotTime={stockCategories?.snapshotTime ?? null}
                  onRefetchCategories={() => refetchCategories()}
                  isRefetchingCategories={isRefetchingCategories}
                  toolbarContainer={toolbarContainer}
                />
              ) : (
                <AdminCategoryTable categories={categories ?? []} />
              )}
            </div>
            <GlobalSettingsSidebar {...settingsModalProps} />
          </div>
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
