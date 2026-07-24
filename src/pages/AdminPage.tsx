import { useQueryClient } from '@tanstack/react-query'
import NavBar from '@/components/NavBar'
import IpSegmentInput from '@/components/IpSegmentInput'
import { useAllowedIps } from '@/hooks/useAllowedIps'
import { allowedIpKeys } from '@/hooks/queryKeys'
import { registerAllowedIp, deleteAllowedIp } from '@/api/allowedIp'
import { toDateTimeLabel } from '@/utils/format'

export default function AdminPage() {
  const { data, isLoading, isError } = useAllowedIps()
  const queryClient = useQueryClient()

  const invalidate = () => queryClient.invalidateQueries({ queryKey: allowedIpKeys.all })

  const handleRegister = async (ip: string) => {
    await registerAllowedIp(ip)
    invalidate()
  }

  const handleDelete = async (ip: string) => {
    await deleteAllowedIp(ip)
    invalidate()
  }

  return (
    <div className="min-h-screen">
      <NavBar />
      <div className="p-4">
        <div className="mx-auto flex max-w-[800px] flex-col gap-4 md:flex-row">
          <div className="nes-container with-title is-dark md:w-1/2">
            <p className="title">IP 등록</p>
            <IpSegmentInput onSubmit={handleRegister} />
          </div>

          <div className="nes-container with-title is-dark md:w-1/2">
            <p className="title">허용된 IP{data ? ` (${data.length})` : ''}</p>
            {isLoading && <p className="nes-text is-disabled text-xs">불러오는 중...</p>}
            {isError && <p className="nes-text is-error text-xs">목록을 불러오지 못했습니다</p>}
            {!isLoading && !isError && (!data || data.length === 0) && (
              <p className="nes-text is-disabled text-xs">등록된 IP가 없습니다</p>
            )}
            {data && data.length > 0 && (
              <div className="flex h-64 flex-col gap-2 overflow-y-auto">
                {data.map(item => (
                  <div key={item.ip} className="flex items-center justify-between gap-2 text-xs">
                    <span>{item.ip}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">{toDateTimeLabel(item.createdAt)}</span>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.ip)}
                        className="text-gray-400 hover:text-white"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
