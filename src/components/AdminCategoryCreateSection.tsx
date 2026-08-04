import { useState } from 'react'
import { useCreateCategory } from '@/hooks/useMarketMapAdmin'
import AdminSection from './AdminSection'

export default function AdminCategoryCreateSection() {
  const [name, setName] = useState('')
  const createCategory = useCreateCategory()

  const handleSubmit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    createCategory.mutate({ name: trimmed, parentId: null })
    setName('')
  }

  return (
    <AdminSection title="카테고리 추가">
      <input
        type="text"
        className="nes-input is-dark text-xs"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="카테고리명"
      />
      <button type="button" className="nes-btn is-primary text-xs" onClick={handleSubmit}>
        추가
      </button>
    </AdminSection>
  )
}
