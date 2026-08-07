import { useState } from 'react'
import { useAdminCategories, useCreateCategory } from '@/hooks/useMarketMapAdmin'
import AdminSection from './AdminSection'

export default function AdminSubCategoryCreateSection() {
  const [name, setName] = useState('')
  const [query, setQuery] = useState('')
  const [parentId, setParentId] = useState<number | null>(null)
  const { data: categories } = useAdminCategories()
  const createCategory = useCreateCategory()

  const trimmedQuery = query.trim().toLowerCase()
  const matches = trimmedQuery ? categories?.filter(c => c.name.toLowerCase().includes(trimmedQuery)) : []
  const selectedParent = categories?.find(c => c.id === parentId)

  const handleQueryChange = (value: string) => {
    setQuery(value)
    setParentId(null)
  }

  const handleSubmit = () => {
    const trimmedName = name.trim()
    if (!trimmedName || parentId === null) return
    createCategory.mutate({ name: trimmedName, parentId })
    setName('')
    setQuery('')
    setParentId(null)
  }

  return (
    <AdminSection title="세부카테고리 추가">
      <input
        type="text"
        className="nes-input is-dark text-xs"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="카테고리명"
      />
      <input
        type="text"
        className="nes-input is-dark text-xs"
        value={query}
        onChange={e => handleQueryChange(e.target.value)}
        placeholder="모카테고리 검색"
      />
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {!trimmedQuery ? null : matches && matches.length === 0 ? (
          <p className="nes-text is-disabled text-xs">검색 결과가 없습니다</p>
        ) : (
          matches?.map(category => (
            <button
              key={category.id}
              type="button"
              onClick={() => setParentId(prev => (prev === category.id ? null : category.id))}
              className={`truncate rounded border-2 bg-black/70 px-3 py-1 text-left text-sm font-bold text-white hover:border-yellow-400 hover:brightness-125 ${
                parentId === category.id ? 'border-[#4f8fd6]' : 'border-transparent'
              }`}
            >
              {category.name}
            </button>
          ))
        )}
      </div>
      <button
        type="button"
        disabled={!name.trim() || parentId === null}
        className="nes-btn is-primary text-xs disabled:opacity-40"
        onClick={handleSubmit}
      >
        추가{selectedParent ? ` (${selectedParent.name} 하위)` : ''}
      </button>
    </AdminSection>
  )
}
