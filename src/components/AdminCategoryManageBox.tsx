import { useState } from 'react'
import type { CategoryItem } from '@/types/api'
import { useCategoryDeleteFlow } from '@/hooks/useCategoryDeleteFlow'
import { useRenameCategory } from '@/hooks/useMarketMapAdmin'
import CategoryBox from './CategoryBox'
import SortableCategoryBox from './SortableCategoryBox'
import AdminDraggableCategoryChip from './AdminDraggableCategoryChip'
import AdminCategoryAddChip from './AdminCategoryAddChip'

interface Props {
  category: CategoryItem
  childCategories: CategoryItem[] | undefined
  sortable: boolean
  highlighted: boolean
  chipDropHighlightActive: boolean
  onSelect: () => void
}

export default function AdminCategoryManageBox({
  category,
  childCategories,
  sortable,
  highlighted,
  chipDropHighlightActive,
  onSelect,
}: Props) {
  const { remove } = useCategoryDeleteFlow()
  const renameCategory = useRenameCategory()
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(category.name)

  const content = sortable
    ? [
        <AdminCategoryAddChip key="add" parentId={category.id} />,
        ...(childCategories?.map(child => (
          <AdminDraggableCategoryChip key={child.id} categoryId={child.id} categoryName={child.name} parentId={category.id} />
        )) ?? []),
      ]
    : undefined

  const startRename = () => {
    setEditValue(category.name)
    setIsEditing(true)
  }

  const cancelRename = () => setIsEditing(false)

  const submitRename = () => {
    const trimmed = editValue.trim()
    setIsEditing(false)
    if (!trimmed || trimmed === category.name) return
    renameCategory.mutate({ id: category.id, name: trimmed })
  }

  const renameButton =
    sortable ? (
      <button
        type="button"
        onClick={startRename}
        className="border-2 border-[#4f8fd6] bg-transparent px-1 text-xs text-[#4f8fd6] hover:brightness-125"
      >
        ✎
      </button>
    ) : undefined

  const deleteButton =
    sortable ? (
      <button
        type="button"
        onClick={() => remove(category.id, category.name)}
        className="border-2 border-red-500 bg-transparent px-1 text-xs text-red-500 hover:brightness-125"
      >
        ✕
      </button>
    ) : undefined

  const editing = isEditing
    ? { value: editValue, onChange: setEditValue, onSubmit: submitRename, onCancel: cancelRename }
    : undefined

  return sortable ? (
    <SortableCategoryBox
      categoryId={category.id}
      name={category.name}
      onSelect={onSelect}
      highlighted={highlighted}
      renameButton={renameButton}
      deleteButton={deleteButton}
      editing={editing}
      chipDropHighlightActive={chipDropHighlightActive}
    >
      {content}
    </SortableCategoryBox>
  ) : (
    <CategoryBox
      categoryId={category.id}
      name={category.name}
      onSelect={onSelect}
      highlighted={highlighted}
      chipDropHighlightActive={chipDropHighlightActive}
    >
      {content}
    </CategoryBox>
  )
}
