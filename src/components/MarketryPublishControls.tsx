import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  getMarketryPublications,
  publishMarketry,
  restoreMarketryPublication,
  type MarketryPublication,
} from '@/api/marketryPublish'
import { marketMapKeys } from '@/hooks/queryKeys'
import { appAlert, appConfirm } from '@/utils/appDialogBus'

const BUTTON_CLASS =
  'h-6 whitespace-nowrap border border-[var(--brand)] bg-transparent px-2 text-sm font-medium text-[var(--brand)] hover:bg-[var(--brand)]/15 disabled:cursor-not-allowed disabled:opacity-50'

function pad(value: number) {
  return String(value).padStart(2, '0')
}

// 고정본 버전 이름 — 브라우저 시각(한국)으로 "고정본 2026-10-08 14:30"처럼 만든다.
function createPublicationLabel(now: Date) {
  return `고정본 ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

// 관리자 전용 — 내 히트맵을 MARKETRY 고정본으로 올리고, 이전 버전으로 되돌린다. 다른 사용자의 데이터는 건드리지 않는다.
export default function MarketryPublishControls() {
  const queryClient = useQueryClient()
  const [isBusy, setIsBusy] = useState(false)
  const [isVersionsOpen, setIsVersionsOpen] = useState(false)
  const [versions, setVersions] = useState<MarketryPublication[] | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isVersionsOpen) return
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsVersionsOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [isVersionsOpen])

  const refreshMaps = () => queryClient.invalidateQueries({ queryKey: marketMapKeys.all })

  const handlePublish = async () => {
    const confirmed = await appConfirm(
      '지금 내 히트맵을 MARKETRY로 올릴까요?\n모든 사용자에게 보이는 고정본이 바뀝니다. 이전 버전은 남아서 되돌릴 수 있습니다.',
    )
    if (!confirmed) return
    setIsBusy(true)
    try {
      const published = await publishMarketry(createPublicationLabel(new Date()))
      setVersions(null)
      await refreshMaps()
      appAlert(`MARKETRY에 올렸습니다. (${published.label})`)
    } catch {
      appAlert('MARKETRY에 올리지 못했습니다.')
    } finally {
      setIsBusy(false)
    }
  }

  const handleToggleVersions = async () => {
    if (isVersionsOpen) {
      setIsVersionsOpen(false)
      return
    }
    setIsVersionsOpen(true)
    if (versions !== null) return
    try {
      setVersions(await getMarketryPublications())
    } catch {
      setIsVersionsOpen(false)
      appAlert('이전 버전 목록을 불러오지 못했습니다.')
    }
  }

  const handleRestore = async (version: MarketryPublication) => {
    const confirmed = await appConfirm(`MARKETRY를 "${version.label}"로 되돌릴까요?\n모든 사용자에게 보이는 고정본이 바뀝니다.`)
    if (!confirmed) return
    setIsBusy(true)
    try {
      await restoreMarketryPublication(version.id)
      setIsVersionsOpen(false)
      await refreshMaps()
      appAlert(`MARKETRY를 "${version.label}"로 되돌렸습니다.`)
    } catch {
      appAlert('MARKETRY를 되돌리지 못했습니다.')
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div ref={rootRef} className="relative ml-auto flex shrink-0 items-center gap-1 pr-2">
      <button type="button" onClick={handlePublish} disabled={isBusy} className={BUTTON_CLASS}>
        MARKETRY에 올리기
      </button>
      <button type="button" onClick={handleToggleVersions} disabled={isBusy} className={BUTTON_CLASS}>
        이전 버전
      </button>
      {isVersionsOpen && (
        <div className="absolute right-0 top-full z-50 mt-1 max-h-72 w-72 overflow-y-auto border border-[var(--brand)] bg-black p-1 text-sm font-normal">
          {versions === null ? (
            <p className="px-2 py-1 text-gray-400">불러오는 중…</p>
          ) : versions.length === 0 ? (
            <p className="px-2 py-1 text-gray-400">올린 버전이 없습니다.</p>
          ) : (
            versions.map(version => (
              <button
                key={version.id}
                type="button"
                onClick={() => handleRestore(version)}
                disabled={isBusy}
                className="flex w-full items-center justify-between border-0 bg-transparent px-2 py-1 text-left text-white hover:bg-white/10 disabled:opacity-50"
              >
                <span className="truncate">{version.label}</span>
                <span className="ml-2 shrink-0 text-[var(--brand)]">되돌리기</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
