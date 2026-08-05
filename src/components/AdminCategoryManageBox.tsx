import type { CategoryItem } from '@/types/api'
import { useCategoryDeleteFlow } from '@/hooks/useCategoryDeleteFlow'
import CategoryBox from './CategoryBox'
import SortableCategoryBox from './SortableCategoryBox'
import AdminDraggableCategoryChip from './AdminDraggableCategoryChip'

interface Props {
  category: CategoryItem
  childCategories: CategoryItem[] | undefined
  sortable: boolean
  highlighted: boolean
  onSelect: () => void
}

export default function AdminCategoryManageBox({ category, childCategories, sortable, highlighted, onSelect }: Props) {
  const { remove } = useCategoryDeleteFlow()

  const content = sortable
    ? childCategories?.map(child => (
        <AdminDraggableCategoryChip key={child.id} categoryId={child.id} categoryName={child.name} parentId={category.id} />
      ))
    : undefined

  const deleteButton =
    sortable && !category.isLocked ? (
      <button
        type="button"
        onClick={() => remove(category.id, category.name)}
        className="border-2 border-red-500 bg-transparent px-1 text-xs text-red-500 hover:brightness-125"
      >
        ✕
      </button>
    ) : undefined

  return sortable ? (
    <SortableCategoryBox categoryId={category.id} name={category.name} onSelect={onSelect} highlighted={highlighted} deleteButton={deleteButton}>
      {content}
    </SortableCategoryBox>
  ) : (
    <CategoryBox categoryId={category.id} name={category.name} onSelect={onSelect} highlighted={highlighted}>
      {content}
    </CategoryBox>
  )
}
