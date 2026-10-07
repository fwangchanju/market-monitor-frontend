export type AppDialogRequest = {
  id: number
  kind: 'alert' | 'confirm'
  message: string
  resolve?: (confirmed: boolean) => void
}

let queue: AppDialogRequest[] = []
let nextId = 0
const subscribers = new Set<() => void>()

function notify() {
  subscribers.forEach(subscriber => subscriber())
}

export function subscribeAppDialogs(subscriber: () => void) {
  subscribers.add(subscriber)
  return () => subscribers.delete(subscriber)
}

export function getCurrentAppDialog() {
  return queue[0] ?? null
}

function enqueue(request: Omit<AppDialogRequest, 'id'>) {
  queue = [...queue, { ...request, id: ++nextId }]
  notify()
}

export function appAlert(message: string) {
  enqueue({ kind: 'alert', message })
}

export function appConfirm(message: string): Promise<boolean> {
  return new Promise(resolve => enqueue({ kind: 'confirm', message, resolve }))
}

export function resolveCurrentAppDialog(confirmed: boolean) {
  const [current, ...remaining] = queue
  if (!current) return
  queue = remaining
  current.resolve?.(confirmed)
  notify()
}
