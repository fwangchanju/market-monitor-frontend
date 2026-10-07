import { useEffect, useSyncExternalStore } from 'react'
import { getCurrentAppDialog, resolveCurrentAppDialog, subscribeAppDialogs } from '@/utils/appDialogBus'

export default function AppDialogHost() {
  const dialog = useSyncExternalStore(subscribeAppDialogs, getCurrentAppDialog, getCurrentAppDialog)

  useEffect(() => {
    if (!dialog) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        resolveCurrentAppDialog(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [dialog])

  if (!dialog) return null

  const dismiss = () => resolveCurrentAppDialog(false)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={dismiss}>
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="app-dialog-title"
        aria-describedby="app-dialog-message"
        className="w-full max-w-sm border border-gray-600 bg-[var(--surface)] p-5 shadow-xl"
        onClick={event => event.stopPropagation()}
      >
        <h2 id="app-dialog-title" className="text-base font-bold text-white">{dialog.kind === 'confirm' ? '확인' : '안내'}</h2>
        <p id="app-dialog-message" className="mt-3 whitespace-pre-line text-sm leading-relaxed text-gray-200">{dialog.message}</p>
        <div className="mt-6 flex justify-end gap-2">
          {dialog.kind === 'confirm' && (
            <button type="button" onClick={dismiss} className="nes-btn border-gray-600 bg-black px-4 py-2 text-sm text-white hover:bg-gray-800">
              취소
            </button>
          )}
          <button
            type="button"
            autoFocus
            onClick={() => resolveCurrentAppDialog(true)}
            className="nes-btn border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-sm font-bold text-black hover:bg-[var(--accent-hover)]"
          >
            {dialog.kind === 'confirm' ? '확인' : '닫기'}
          </button>
        </div>
      </section>
    </div>
  )
}
