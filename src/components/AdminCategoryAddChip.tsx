import { useState } from 'react'
import { useCreateCategory } from '@/hooks/useMarketMapAdmin'

interface Props {
  parentId: number
}

export default function AdminCategoryAddChip({ parentId }: Props) {
  const [isAdding, setIsAdding] = useState(false)
  const [name, setName] = useState('')
  const createCategory = useCreateCategory()

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    createCategory.mutate({ name: trimmed, parentId })
    setName('')
    setIsAdding(false)
  }

  const cancel = () => {
    setName('')
    setIsAdding(false)
  }

  if (!isAdding) {
    return (
      <button
        type="button"
        onClick={() => setIsAdding(true)}
        className="nes-container is-rounded is-dark flex items-center justify-center px-2 py-1 text-white hover:border-yellow-400 hover:brightness-125"
      >
        +
      </button>
    )
  }

  return (
    <input
      type="text"
      autoFocus
      value={name}
      onChange={e => setName(e.target.value)}
      onBlur={cancel}
      onKeyDown={e => {
        if (e.key === 'Enter') submit()
        if (e.key === 'Escape') cancel()
      }}
      placeholder="카테고리명"
      className="nes-input is-dark border-[#4f8fd6] px-2 py-1 text-[10.5px]"
    />
  )
}
