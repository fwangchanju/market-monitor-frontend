import { useState } from 'react'
import { useAdminCategories } from '@/hooks/useMarketMapAdmin'
import { useCategoryDeleteFlow } from '@/hooks/useCategoryDeleteFlow'
import AdminSection from './AdminSection'

export default function AdminCategoryDeleteSection() {
  const [query, setQuery] = useState('')
  const { data: categories } = useAdminCategories()
  const { remove } = useCategoryDeleteFlow()

  const trimmed = query.trim().toLowerCase()
  const matches = trimmed ? categories?.filter(c => !c.isSynced && c.name.toLowerCase().includes(trimmed)) : []

  return (
    <AdminSection title="카테고리 삭제">
      <input
        type="text"
        className="nes-input is-dark text-xs"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="카테고리명 검색"
      />
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {!trimmed ? null : matches && matches.length === 0 ? (
          <p className="nes-text is-disabled text-xs">검색 결과가 없습니다</p>
        ) : (
          matches?.map(category => (
            <div
              key={category.id}
              className="flex items-center justify-between gap-2 rounded border-2 border-transparent bg-black/70 px-3 py-1 text-sm font-bold text-white"
            >
              <span className="truncate">{category.name}</span>
              <button
                type="button"
                onClick={() => remove(category.id, category.name)}
                className="border-0 bg-transparent text-red-500 hover:text-red-400"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </AdminSection>
  )
}
