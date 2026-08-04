import type { ReactNode } from 'react'
import { useDroppable } from '@dnd-kit/core'

interface Props {
  categoryId: number
  name: string
  onSelect: () => void
  highlighted: boolean
  children?: ReactNode
  deleteButton?: ReactNode
  dragHandleProps?: Record<string, unknown>
}

export default function CategoryBox({
  categoryId,
  name,
  onSelect,
  highlighted,
  children,
  deleteButton,
  dragHandleProps,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: `category-content-${categoryId}`,
    data: { type: 'category-content', categoryId },
  })

  return (
    <div
      className={`nes-container is-dark w-64 shrink-0 ${
        highlighted ? 'outline outline-2 outline-offset-2 outline-yellow-400 brightness-125' : ''
      }`}
    >
      <div {...dragHandleProps} className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onSelect}
          className="truncate border-0 bg-transparent text-left text-sm font-bold text-white hover:text-[#4f8fd6]"
        >
          {name}
        </button>
        {deleteButton}
      </div>
      <div
        ref={setNodeRef}
        {...dragHandleProps}
        className={`flex h-40 flex-col gap-2 overflow-y-auto rounded border-2 p-1 ${
          isOver ? 'border-yellow-400 bg-gray-700 brightness-125' : 'border-transparent'
        }`}
      >
        {children}
      </div>
    </div>
  )
}
