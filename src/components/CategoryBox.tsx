import type { ReactNode } from 'react'
import { useDroppable } from '@dnd-kit/core'

export interface EditingProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onCancel: () => void
}

interface Props {
  categoryId: number
  name: string
  onSelect: () => void
  highlighted: boolean
  children?: ReactNode
  renameButton?: ReactNode
  deleteButton?: ReactNode
  dragHandleProps?: Record<string, unknown>
  editing?: EditingProps
  chipDropHighlightActive?: boolean
}

export default function CategoryBox({
  categoryId,
  name,
  onSelect,
  highlighted,
  children,
  renameButton,
  deleteButton,
  dragHandleProps,
  editing,
  chipDropHighlightActive = false,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: `category-content-${categoryId}`,
    data: { type: 'category-content', categoryId },
  })
  const isChipDropTarget = isOver && chipDropHighlightActive

  return (
    <div
      className={`nes-container is-dark w-64 shrink-0 ${
        highlighted ? 'outline outline-2 outline-offset-2 outline-yellow-400 brightness-125' : ''
      }`}
    >
      <div {...dragHandleProps} className="mb-2 flex items-center justify-between gap-2">
        {editing ? (
          <input
            type="text"
            autoFocus
            value={editing.value}
            onChange={e => editing.onChange(e.target.value)}
            onFocus={e => e.target.select()}
            onBlur={editing.onCancel}
            onKeyDown={e => {
              if (e.key === 'Enter') editing.onSubmit()
              if (e.key === 'Escape') editing.onCancel()
            }}
            className="nes-input is-dark min-w-0 flex-1 border-[#4f8fd6] text-xs"
          />
        ) : (
          <button
            type="button"
            onClick={onSelect}
            className="truncate border-0 bg-transparent text-left text-sm font-bold text-white hover:text-[#4f8fd6]"
          >
            {name}
          </button>
        )}
        {!editing && (
          <div className="flex shrink-0 items-center gap-1">
            {renameButton}
            {deleteButton}
          </div>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={`flex h-40 flex-col gap-2 overflow-y-auto rounded border-2 p-1 ${
          isChipDropTarget ? 'border-yellow-400 bg-gray-700 brightness-125' : 'border-transparent'
        }`}
      >
        {children}
      </div>
    </div>
  )
}
