import { useState } from 'react'
import { useVersions, useSaveVersion, useOverwriteVersion, useRestoreVersion, useDeleteVersion } from '@/hooks/useMarketMapAdmin'
import { toYyMmDd } from '@/utils/format'
import AdminSection from './AdminSection'

export default function AdminVersionSaveSection() {
  const [label, setLabel] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const { data: versions } = useVersions()
  const saveVersion = useSaveVersion()
  const overwriteVersion = useOverwriteVersion()
  const restoreVersion = useRestoreVersion()
  const deleteVersion = useDeleteVersion()

  const handleLabelChange = (value: string) => {
    setLabel(value)
    setSelectedId(null)
  }

  const handleSelect = (id: number, versionLabel: string) => {
    setSelectedId(id)
    setLabel(versionLabel)
  }

  const handleRestore = (id: number, versionLabel: string) => {
    if (!window.confirm(`${versionLabel}\n이 버전으로 불러오시겠습니까?`)) return
    restoreVersion.mutate(id)
  }

  const handleDelete = (id: number, versionLabel: string) => {
    if (!window.confirm(`${versionLabel}\n삭제하시겠습니까?`)) return
    deleteVersion.mutate(id)
    if (selectedId === id) {
      setSelectedId(null)
      setLabel('')
    }
  }

  const handleSubmit = () => {
    const trimmed = label.trim()
    if (!trimmed) return
    if (selectedId !== null) {
      overwriteVersion.mutate({ id: selectedId, label: trimmed })
    } else {
      saveVersion.mutate(trimmed)
    }
    setLabel('')
    setSelectedId(null)
  }

  return (
    <AdminSection title="버전 관리">
      <input
        type="text"
        className="nes-input is-dark text-xs"
        value={label}
        onChange={e => handleLabelChange(e.target.value)}
        placeholder="버전 태그명"
      />
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {versions?.map(version => (
          <div
            key={version.id}
            className={`flex items-center justify-between gap-2 rounded border-2 bg-black/70 px-3 py-1 text-sm font-bold text-white ${
              selectedId === version.id ? 'border-[#4f8fd6]' : 'border-transparent'
            }`}
          >
            <button
              type="button"
              onClick={() => handleSelect(version.id, version.label)}
              className="flex min-w-0 flex-1 flex-col gap-1 truncate border-0 bg-transparent text-left hover:text-[#4f8fd6]"
            >
              <span className="truncate">{version.label}</span>
              <span className="text-[10.5px] font-normal">{toYyMmDd(version.createdAt)}</span>
            </button>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => handleRestore(version.id, version.label)}
                className="border-0 bg-transparent text-xs text-[#4f8fd6] hover:brightness-125"
              >
                불러오기
              </button>
              <button
                type="button"
                onClick={() => handleDelete(version.id, version.label)}
                className="border-0 bg-transparent text-red-500 hover:text-red-400"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="nes-btn is-primary text-xs" onClick={handleSubmit}>
        {selectedId !== null ? '덮어쓰기' : '저장'}
      </button>
    </AdminSection>
  )
}
