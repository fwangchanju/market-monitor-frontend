import { useEffect, useSyncExternalStore } from 'react'
import { getCurrentAppDialog, resolveCurrentAppDialog, subscribeAppDialogs } from '@/utils/appDialogBus'
import { HINT_BUBBLE_COLOR_CLASS } from './hintBubbleStyle'

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

  // 바깥(어두운 배경)을 눌러도 닫히지 않는다 — 반드시 버튼이나 Esc로 답해야 한다.
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="app-dialog-title"
        aria-describedby="app-dialog-message"
        // 색은 설정창 말풍선·NXT 안내창과 같은 크림색 계열이다.
        className={`w-full max-w-sm p-5 ${HINT_BUBBLE_COLOR_CLASS}`}
      >
        <h2 id="app-dialog-title" className="text-base font-bold text-black">{dialog.kind === 'confirm' ? '확인' : '안내'}</h2>
        <p id="app-dialog-message" className="mt-3 whitespace-pre-line text-sm leading-relaxed text-black">{dialog.message}</p>
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
