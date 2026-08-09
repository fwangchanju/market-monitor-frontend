import { useState } from 'react'
import { useCreateCategory } from '@/hooks/useMarketMapAdmin'

interface Props {
  parentId: number | null
}

export default function AdminCategoryAddBox({ parentId }: Props) {
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

  return (
    <div className="nes-container is-dark flex h-[13.5rem] w-64 shrink-0 items-center justify-center">
      {isAdding ? (
        <div className="flex w-full flex-col gap-2 px-3">
          <input
            type="text"
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') submit()
              if (e.key === 'Escape') cancel()
            }}
            placeholder="카테고리명"
            className="nes-input is-dark text-xs"
          />
          <button
            type="button"
            disabled={!name.trim()}
            className="nes-btn is-primary text-xs disabled:opacity-40"
            onClick={submit}
          >
            추가
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="border-0 bg-transparent text-4xl text-white hover:text-[#4f8fd6]"
        >
          +
        </button>
      )}
    </div>
  )
}
