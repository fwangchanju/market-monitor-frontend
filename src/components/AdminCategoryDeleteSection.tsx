import { useState } from 'react'
import { useAdminCategories } from '@/hooks/useMarketMapAdmin'
import { useCategoryDeleteFlow } from '@/hooks/useCategoryDeleteFlow'
import { getCategoryPath } from '@/utils/category'
import AdminSection from './AdminSection'

export default function AdminCategoryDeleteSection() {
  const [query, setQuery] = useState('')
  const { data: categories } = useAdminCategories()
  const { remove } = useCategoryDeleteFlow()

  const trimmed = query.trim().toLowerCase()
  const allCategories = categories ?? []
  const visibleCategories = trimmed
    ? allCategories.filter(c => c.name.toLowerCase().includes(trimmed))
    : allCategories

  const handleDeleteByName = () => {
    const match = allCategories.find(c => c.name === query.trim())
    if (!match) return
    remove(match.id, match.name)
  }

  return (
    <AdminSection title="카테고리 삭제">
      <div className="scrollbar-thin flex flex-1 flex-col gap-2 overflow-y-auto">
        {visibleCategories.length === 0 ? (
          <p className="nes-text is-disabled text-xs">
            {trimmed ? '검색 결과가 없습니다' : '삭제 가능한 카테고리가 없습니다'}
          </p>
        ) : (
          visibleCategories.map(category => {
            const ancestorPath = getCategoryPath(category, categories ?? [])
              .slice(0, -1)
              .join(' - ')
            return (
              <div
                key={category.id}
                className="nes-container is-rounded is-dark flex items-center justify-between gap-2 px-2 py-1 text-white"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1 truncate">
                  <span className="truncate text-[9px]">{category.name}</span>
                  <span className="truncate text-[7px]">{ancestorPath}</span>
                </div>
                <button
                  type="button"
                  onClick={() => remove(category.id, category.name)}
                  className="border-0 bg-transparent text-red-500 hover:text-red-400"
                >
                  ✕
                </button>
              </div>
            )
          })
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        <input
          type="text"
          className="nes-input is-dark min-w-0 flex-1 text-xs"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="카테고리명 검색"
        />
        <button
          type="button"
          onClick={handleDeleteByName}
          className="nes-btn shrink-0 border-red-600 bg-red-600 text-xs text-white hover:bg-red-700"
        >
          삭제
        </button>
      </div>
    </AdminSection>
  )
}
