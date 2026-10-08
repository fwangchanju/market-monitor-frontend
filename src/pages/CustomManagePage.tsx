import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import NavBar from '@/components/NavBar'
import SubNavBar from '@/components/SubNavBar'
import MarketMapShareModal from '@/components/MarketMapShareModal'
import AdminSectorTable from '@/components/AdminSectorTable'
import AdminStockTable from '@/components/AdminStockTable'
import Spinner from '@/components/Spinner'
import NavBarPageActions from '@/components/NavBarPageActions'
import SettingsSidebar from '@/components/SettingsSidebar'
import { FONT_BAR_MODE_STATUS } from '@/components/FontStyle'
import CustomManageModeCombobox from '@/components/CustomManageModeCombobox'
import ReadOnlyHeatmapSheet from '@/components/ReadOnlyHeatmapSheet'
import MarketryPublishControls from '@/components/MarketryPublishControls'
import { usePersistedState } from '@/hooks/usePersistedState'
import { useSettingsSidebarSide } from '@/hooks/useSettingsSidebarSide'
import { useHeatmapSelection, type HeatmapSelection } from '@/hooks/useHeatmapSelection'
import { useCustomSectors, useStockSectors } from '@/hooks/useMarketMapCustom'
import { useMarketMap } from '@/hooks/useMarketMap'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { useSession, useIsLoggedIn } from '@/hooks/useSession'
import { useLoginGate } from '@/hooks/useLoginGate'
import { captureElementToClipboard, copyDataUrlToClipboard } from '@/utils/captureToClipboard'
import { captureElementToDownload, downloadDataUrl, captureFileName } from '@/utils/captureToDownload'
import { HEATMAP_NAMES } from '@/utils/heatmapNames'

type CopyStatus = 'idle' | 'copying' | 'copied' | 'error'
type DownloadStatus = 'idle' | 'downloading' | 'error'

// 커스텀 섹터·종목 배정 관리 화면 — 예전 관리자 페이지를 대체한다. 이제는 admin 역할이 아니라 로그인 여부로
// 접근을 가른다(가입/로그인 전환 지시서 4) — 누구든
// 로그인하면 자신의 커스텀 섹터를 관리할 수 있다. 비로그인으로 직접 URL 진입/새로고침해도 로그인
// 팝업을 띄우고, 성공하면 이 경로로 돌아온다.
export default function CustomManagePage() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  // /custom/industry는 업종 화면이고, /custom/stock은 종목 화면이다.
  const mode = pathname === '/custom/stock' || searchParams.get('mode') === 'stock' ? 'stock' : 'sector'
  // 히트맵 시트 — 내 히트맵(mymap)만 편집할 수 있다. ?sheet=krx는 읽기 전용 KRX 시트, ?sheet=marketry는 올린
  // MARKETRY를 읽기 전용으로 보여준다(MARKETRY는 내 히트맵에서 올려서 바꾼다).
  // 예전 주소(?sheet=nxt)는 KRX 시트에서 "NXT 종목만 보기"를 켠 상태로 연다.
  const sheetParam = searchParams.get('sheet')
  const [selectedHeatmap, setSelectedHeatmap] = useHeatmapSelection()
  const explicitSheet =
    sheetParam === 'krx' || sheetParam === 'nxt' ? 'krx' : sheetParam === 'marketry' || sheetParam === 'mymap' ? sheetParam : null
  const sheet = explicitSheet ?? selectedHeatmap
  const isReadOnlySheet = sheet !== 'mymap'
  const [sectorSettingsActionsTarget, setSectorSettingsActionsTarget] = useState<HTMLDivElement | null>(null)
  // 종목 화면의 실행취소·다시실행 아이콘이 들어갈 설정창 안의 자리.
  const [stockHistoryTarget, setStockHistoryTarget] = useState<HTMLDivElement | null>(null)
  const handleSelectSheet = (next: HeatmapSelection) => {
    setSelectedHeatmap(next)
    setSearchParams(previous => {
      const params = new URLSearchParams(previous)
      params.delete('sheet')
      return params
    })
  }
  // KRX 시트에서 NXT 거래 종목만 남기는 보기 옵션 — 새로고침해도 유지된다.
  const [isNxtOnlyView, setIsNxtOnlyView] = usePersistedState('customPage.krxNxtOnly', false)
  const nxtOnly = sheet === 'krx' && (isNxtOnlyView || sheetParam === 'nxt')
  // 기존 시트 링크는 처음부터 적용하고 브라우저 공통 선택으로 옮겨 URL이 이후 선택을 덮지 않게 한다.
  useEffect(() => {
    if (!explicitSheet) return
    setSelectedHeatmap(explicitSheet)
    if (sheetParam === 'nxt') setIsNxtOnlyView(true)
    setSearchParams(previous => {
      const params = new URLSearchParams(previous)
      params.delete('sheet')
      return params
    }, { replace: true })
  }, [explicitSheet, sheetParam, setSelectedHeatmap, setIsNxtOnlyView, setSearchParams])
  // AdminStockTable의 툴바(종목수/실행취소·다시실행/필터/엑셀 등)를 이 DOM 노드로 포털링해서 세
  // 번째 바 안에 그린다 — useRef 대신 useState인 이유는, ref 콜백이 커밋 단계에서 실행되므로
  // useState로 받아야 그 노드가 준비된 뒤 리렌더가 한 번 더 일어나 AdminStockTable에 null이 아닌
  // 실제 노드가 확실히 전달된다.
  const [toolbarContainer, setToolbarContainer] = useState<HTMLDivElement | null>(null)
  // 표 위 검색창 옆에 두던 "27/27업종" 개수 — 표가 올려 보내면 설정창 머리글 오른쪽에 보여준다.
  const [countLabel, setCountLabel] = useState<string | undefined>()

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
    isLoading: isStockSectorsLoading,
    refetch: refetchStockSectors,
    isRefetching: isRefetchingStockSectors,
  } = useStockSectors({ enabled: isLoggedIn })

  // 선택한 분류에 맞는 최종 갱신 시각을 가져오며 거래소 시트에서는 본문 데이터도 함께 쓴다.
  const {
    data: classificationMap,
    isLoading: isClassificationLoading,
    refetch: refetchClassification,
    isRefetching: isRefetchingClassification,
  } = useMarketMap('ALL_STOCK', sheet, false, { enabled: isLoggedIn })

  const nxtStockCodes = useMemo(
    () => new Set((stockSectors?.items ?? []).filter(item => item.nxtEnabled).map(item => item.stockCode)),
    [stockSectors],
  )
  const stockMarkets = useMemo(
    () => new Map((stockSectors?.items ?? []).map(item => [item.stockCode, item.market])),
    [stockSectors],
  )

  const [isShareOpen, setIsShareOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(true)
  const { isOnLeft: isSettingsOnLeft, toggleSide: toggleSettingsSide } = useSettingsSidebarSide()
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

  const handleCopy = async (previewSrc?: string | null) => {
    if (!previewSrc && !captureRef.current) return
    setCopyStatus('copying')
    try {
      if (previewSrc) await copyDataUrlToClipboard(previewSrc)
      else if (captureRef.current) await captureElementToClipboard(captureRef.current)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('error')
    } finally {
      setTimeout(() => setCopyStatus('idle'), 2000)
    }
  }

  const handleDownload = async (previewSrc?: string | null) => {
    if (!previewSrc && !captureRef.current) return
    setDownloadStatus('downloading')
    try {
      if (previewSrc) downloadDataUrl(previewSrc, captureFileName('CUSTOM'))
      else if (captureRef.current) await captureElementToDownload(captureRef.current, captureFileName('CUSTOM'))
    } catch {
      setDownloadStatus('error')
    } finally {
      setTimeout(() => setDownloadStatus('idle'), 2000)
    }
  }

  const copyLabel =
    copyStatus === 'copying' ? 'Copying' : copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Failed' : 'Copy'
  const downloadLabel = downloadStatus === 'error' ? '다운로드 실패' : '다운로드'

  const actions = (
    <NavBarPageActions
      onRefresh={() => {
        void refetchClassification()
        if (isReadOnlySheet) return
        void refetchSectors()
        if (mode === 'stock') void refetchStockSectors()
      }}
      isRefreshing={
        isRefetchingClassification || (!isReadOnlySheet && (
          isRefetchingSectors || (mode === 'stock' && isRefetchingStockSectors)
        ))
      }
      onOpenShare={() => setIsShareOpen(true)}
      isCaptureOpen={isShareOpen}
      onToggleSettings={() => setIsSettingsOpen(previous => !previous)}
      isSettingsOpen={isSettingsOpen}
      isNativeFullscreen={isNativeFullscreen}
      onToggleFullscreen={handleToggleNativeFullscreen}
    />
  )

  // 세션 확인 중이거나(로그인 여부를 아직 모름) 로그인 사용자의 섹터 목록을 받아오는 동안은 상단바+
  // 스피너만 보여준다 — 비로그인용 안내와 실제 테이블이 뒤섞여 잠깐 보였다 사라지는 걸 막는다.
  if (isSessionLoading || (isLoggedIn && isSectorsLoading)) {
    return (
      <div className="flex h-screen select-none flex-col overflow-hidden bg-black">
        <NavBar />
        <SubNavBar />
        <div className="flex min-h-0 flex-1 items-center justify-center p-8">
          <Spinner showElapsed />
        </div>
      </div>
    )
  }

  if (!isLoggedIn) {
    return (
      <div className="flex h-screen select-none flex-col overflow-hidden bg-black">
        <NavBar />
        <SubNavBar />
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <p className="text-sm text-white">로그인 후 이용 가능합니다.</p>
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
    <div className="flex h-screen select-none flex-col overflow-hidden bg-black">
      <NavBar />
      <SubNavBar actions={actions} />
      {/* 좌측 사이드바(종목/섹터 전환 + 버전관리 저장) 삭제 — 종목/섹터 전환은 SubNavBar의
          "커스텀" 탭 hover 목록으로 이동. 버전관리 저장(AdminVersionSaveSection)은 기능 검증과
          위치 재검토가 더 필요해서 일단 뺐다 — 다시 넣을 땐 이 컴포넌트를 재사용하면 된다. */}
      <div className="flex min-h-0 flex-1">
        {/* 공유 캡처(captureRef)는 [세 번째 바+본문] 열만 찍는다 — 설정 사이드바는 캡처에 넣지 않는다. */}
        <div className="relative z-10 -mt-[10.5px] flex min-h-0 min-w-0 flex-1 overflow-hidden bg-black text-white">
          {/* min-w-0: 이 컬럼의 자동 최소 폭을 0으로 눌러서 창을 좁혀도 사이드바(w-80)가 항상 같은
              폭을 유지하게 한다(지도/섹터/요약 페이지와 동일). */}
          <div ref={captureRef} className="flex min-h-0 min-w-0 flex-1 flex-col bg-black text-white">
            <div className="mt-[5.25px] mb-[5.25px] flex h-7 w-full shrink-0 items-center justify-between bg-black/70 pl-[7px] pr-[7px] text-sm font-bold text-white">
              <div className="flex h-full shrink-0 items-center gap-2">
                <CustomManageModeCombobox
                  mode={mode === 'stock' ? 'stock' : 'category'}
                  onSelect={path => navigate(path)}
                />
                {sheet === 'krx' && (
                  <span className="whitespace-nowrap text-sm font-normal text-gray-400">키움 REST API</span>
                )}
              </div>
              {/* 종목수/실행취소·다시실행/필터/엑셀 등 — AdminStockTable이 이 노드로 포털링해서 그린다. */}
              {!isReadOnlySheet && mode === 'stock' && <div ref={setToolbarContainer} className="flex h-full min-h-0 min-w-0 flex-1 items-center" />}
              {/* 관리자만 — 내 히트맵을 MARKETRY로 올리고 이전 버전으로 되돌린다. */}
              {session?.role === 'ADMIN' && !isReadOnlySheet && <MarketryPublishControls />}
              <div className={`${FONT_BAR_MODE_STATUS} ml-2 flex min-w-0 items-center justify-end text-gray-400`}>
                <span className="flex min-w-0 items-center justify-end">
                  <span className="min-w-0 truncate bg-[var(--brand)] px-2 py-1 text-black">{HEATMAP_NAMES[sheet].title}</span>
                </span>
              </div>
            </div>
            <div className="flex min-h-0 flex-1">
              <div
                className={`flex min-h-0 flex-1 flex-col ${mode === 'sector' ? 'overflow-y-auto' : ''}`}
              >
                {isReadOnlySheet ? (
                  <ReadOnlyHeatmapSheet
                    mode={mode === 'stock' ? 'stock' : 'category'}
                    data={classificationMap}
                    isLoading={isClassificationLoading}
                    source={sheet === 'marketry' ? 'marketry' : 'krx'}
                    nxtOnly={nxtOnly}
                    onNxtOnlyChange={setIsNxtOnlyView}
                    nxtStockCodes={nxtStockCodes}
                    stockMarkets={stockMarkets}
                    isNxtLoading={isStockSectorsLoading}
                    onCountLabelChange={setCountLabel}
                  />
                ) : mode === 'stock' ? (
                  <AdminStockTable
                    items={stockSectors?.items ?? []}
                    sectors={sectors ?? []}
                    snapshotTime={stockSectors?.snapshotTime ?? null}
                    toolbarContainer={toolbarContainer}
                    historyContainer={stockHistoryTarget}
                    onCountLabelChange={setCountLabel}
                  />
                ) : (
                  <AdminSectorTable
                    sectors={sectors ?? []}
                    settingsActionsTarget={sectorSettingsActionsTarget}
                    onCountLabelChange={setCountLabel}
                  />
                )}
              </div>
            </div>
          </div>
          <div className={`flex shrink-0 pt-[7px] ${isSettingsOnLeft ? 'order-first' : ''}`}>
            <SettingsSidebar
              pageLabel="CUSTOM"
              stockCountLabel={countLabel}
              // 저장·초기화는 기능 검토 전 임시 숨김. 재요청 시 새 버튼을 만들지 말고 이 옵션을 true로 바꿔 기존 버튼을 복원한다.
              showPreferenceActions={false}
              isOpen={isSettingsOpen}
              onOpenChange={setIsSettingsOpen}
              isOnLeft={isSettingsOnLeft}
              onToggleSide={toggleSettingsSide}
              onRequestLogin={() => requireLogin(pathname)}
              plainContent={mode === 'sector' && !isReadOnlySheet ? (
                <div>
                  <div ref={setSectorSettingsActionsTarget} />
                </div>
              ) : mode === 'stock' && !isReadOnlySheet ? (
                <div>
                  <div ref={setStockHistoryTarget} />
                </div>
              ) : null}
              classificationAtBottom
              snapshotTime={classificationMap?.classificationUpdatedAt}
              heatmap={sheet}
              onSelectHeatmap={next => handleSelectSheet(next === 'krx' || next === 'nxt' ? 'krx' : next)}
            />
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
