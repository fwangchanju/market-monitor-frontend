import type { ReactNode } from 'react'

interface Props {
  title: string
  unit?: ReactNode
  actions?: ReactNode
  stale?: boolean
  children: ReactNode
}

export default function WidgetSection({ title, unit, actions, stale, children }: Props) {
  return (
    <section className={`section nes-container is-dark ${stale ? 'border-red-500' : ''}`}>
      <div className="relative z-10 mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-gray-600 pb-2">
        <h2 className={`whitespace-nowrap text-sm font-bold ${stale ? 'text-red-400' : ''}`}>{title}</h2>
        {(unit || actions) && (
          <div className="flex flex-wrap items-center gap-4">
            {unit && <div className="text-xs text-white">{unit}</div>}
            {actions}
          </div>
        )}
      </div>
      {children}
    </section>
  )
}
