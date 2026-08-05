import { useDroppable } from '@dnd-kit/core'

interface Props {
  categoryId: number
  name: string
  selected: boolean
  onClick: () => void
}

export default function AdminCategorySearchTarget({ categoryId, name, selected, onClick }: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: `category-target-${categoryId}`,
    data: selected ? { type: 'category-target', categoryId } : undefined,
  })

  return (
    <button
      type="button"
      ref={setNodeRef}
      onClick={onClick}
      className={`truncate rounded border-2 bg-black/70 px-3 py-1 text-left text-sm font-bold text-white ${
        isOver ? 'border-yellow-400 brightness-125' : selected ? 'border-[#4f8fd6]' : 'border-transparent'
      }`}
    >
      {name}
    </button>
  )
}
