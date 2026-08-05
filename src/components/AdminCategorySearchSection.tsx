import { useState } from 'react'
import { useAdminCategories } from '@/hooks/useMarketMapAdmin'
import AdminSection from './AdminSection'
import AdminCategorySearchTarget from './AdminCategorySearchTarget'

export default function AdminCategorySearchSection() {
  const [query, setQuery] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const { data: categories } = useAdminCategories()

  const trimmed = query.trim().toLowerCase()
  const matches = trimmed ? categories?.filter((c) => c.name.toLowerCase().includes(trimmed)) : []

  const handleQueryChange = (value: string) => {
    setQuery(value)
    setSelectedCategoryId(null)
  }

  return (
    <AdminSection title="카테고리 검색">
      <input
        type="text"
        className="nes-input is-dark text-xs"
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        placeholder="카테고리명 검색"
      />
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {!trimmed ? null : matches && matches.length === 0 ? (
          <p className="nes-text is-disabled text-xs">검색 결과가 없습니다</p>
        ) : (
          matches?.map((category) => (
            <AdminCategorySearchTarget
              key={category.id}
              categoryId={category.id}
              name={category.name}
              selected={selectedCategoryId === category.id}
              onClick={() => setSelectedCategoryId((prev) => (prev === category.id ? null : category.id))}
            />
          ))
        )}
      </div>
    </AdminSection>
  )
}
