import type { CategoryItem } from '@/types/api'

/** 카테고리의 루트 → 자신까지 전체 경로(이름 배열). parentId를 계속 따라 올라가며 구성한다. */
export function getCategoryPath(category: CategoryItem, categories: CategoryItem[]): string[] {
  const path = [category.name]
  let current = category
  while (current.parentId !== null) {
    const parent = categories.find(c => c.id === current.parentId)
    if (!parent) break
    path.unshift(parent.name)
    current = parent
  }
  return path
}
