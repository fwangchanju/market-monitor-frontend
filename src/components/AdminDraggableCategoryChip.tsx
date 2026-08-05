import { useDraggable } from '@dnd-kit/core'

interface Props {
  categoryId: number
  categoryName: string
  parentId: number
}

export default function AdminDraggableCategoryChip({ categoryId, categoryName, parentId }: Props) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `category-chip-${categoryId}`,
    data: { type: 'category-chip', categoryId, categoryName, parentId },
  })
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onPointerDown={e => {
        listeners?.onPointerDown?.(e)
        e.stopPropagation()
      }}
      className="nes-container is-rounded is-dark flex cursor-grab flex-col gap-1 px-2 py-1 hover:border-yellow-400 hover:brightness-125"
    >
      <span className="text-[10.5px] text-white">{categoryName}</span>
    </div>
  )
}
