import { useState } from 'react'
import {
  useVersions,
  useCurrentVersion,
  useSaveVersion,
  useOverwriteVersion,
  useRestoreVersion,
  useDeleteVersion,
} from '@/hooks/useMarketMapAdmin'
import Spinner from './Spinner'

export default function AdminVersionSaveSection() {
  const [label, setLabel] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const { data: versions, isLoading: isVersionsLoading } = useVersions()
  const { data: currentVersion, isLoading: isCurrentVersionLoading } = useCurrentVersion()
  const isLoading = isVersionsLoading || isCurrentVersionLoading
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
    <div className="border-t border-gray-700 p-4">
      <p className="mb-2 font-bold text-white">버전관리</p>
      <div className="flex flex-col gap-1 border-b border-gray-700 pb-2">
        <span className="text-xs text-white">현재버전</span>
        {isLoading ? (
          <div className="flex justify-center p-2">
            <Spinner className="h-5 w-5" />
          </div>
        ) : currentVersion ? (
          <div className="nes-container is-rounded is-dark flex w-full flex-col gap-1 px-2 py-1 text-white">
            <span className="truncate text-[9px]">{currentVersion.label}</span>
            <span className="text-[7px]">{currentVersion.createdAt.slice(0, 10)}</span>
          </div>
        ) : (
          <span className="text-xs text-gray-400">없음</span>
        )}
      </div>
      <div className="mt-2 flex max-h-48 flex-col gap-1 overflow-y-auto">
        {versions?.map(version => (
          <div
            key={version.id}
            className={`nes-container is-rounded is-dark flex flex-col gap-1 px-2 py-1 text-white ${
              selectedId === version.id ? 'border-2 border-[#4f8fd6]' : ''
            }`}
          >
            <button
              type="button"
              onClick={() => handleSelect(version.id, version.label)}
              className="flex min-w-0 flex-col truncate border-0 bg-transparent text-left text-white hover:text-[#4f8fd6]"
            >
              <span className="truncate text-[9px]">{version.label}</span>
              <span className="text-[7px]">{version.createdAt.slice(0, 10)}</span>
            </button>
            <div className="flex shrink-0 items-center gap-2 text-[9px]">
              <button
                type="button"
                onClick={() => handleRestore(version.id, version.label)}
                className="border-0 bg-transparent text-[#4f8fd6] hover:brightness-125"
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
      <div className="mt-2 flex flex-col gap-1">
        <input
          type="text"
          className="nes-input is-dark text-xs"
          value={label}
          onChange={e => handleLabelChange(e.target.value)}
          placeholder="버전 태그명"
        />
        <button type="button" className="nes-btn is-save text-xs" onClick={handleSubmit}>
          {selectedId !== null ? '덮어쓰기' : '저장'}
        </button>
      </div>
    </div>
  )
}
