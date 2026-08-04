import { useState } from 'react'
import type { CategoryItem } from '@/types/api'

export function useCategoryDrilldown(categories: CategoryItem[] | undefined) {
  const [currentCategoryId, setCurrentCategoryId] = useState<number | null>(null)

  const currentCategory = categories?.find(c => c.id === currentCategoryId) ?? null
  const currentDepthCategories = (categories ?? [])
    .filter(c => c.parentId === currentCategoryId)
    .sort((a, b) => a.displayOrder - b.displayOrder)

  const enterCategory = (id: number) => setCurrentCategoryId(id)
  const goBack = () => setCurrentCategoryId(currentCategory?.parentId ?? null)

  return { currentCategoryId, currentCategory, currentDepthCategories, enterCategory, goBack }
}
