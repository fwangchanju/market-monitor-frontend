import { isAxiosError } from 'axios'
import { useSectorDeletePreview, useDeleteSector } from './useMarketMapCustom'
import type { StockSectorItem } from '@/types/api'
import { getErrorDetail } from '@/utils/errorMessage'

function confirmDeletable(sectorName: string, deletableSectors: string[]) {
  const list = deletableSectors.length > 0 ? deletableSectors.join(', ') : '없음'
  return window.confirm(`${sectorName}\n세부섹터: ${list}\n삭제하시겠습니까?`)
}

function alertBlocked(sectorName: string, blockingStocks: StockSectorItem[]) {
  const base = `${sectorName}\n이 섹터는 삭제할 수 없습니다.`
  if (blockingStocks.length === 0) {
    window.alert(base)
    return
  }
  const list = blockingStocks.map(s => `${s.sectorName} - ${s.stockName}`).join('\n')
  window.alert(`${base}\n${list}`)
}

function alertDeleteFailed(sectorName: string, error: unknown) {
  window.alert(`${sectorName}\n${getErrorDetail(error)}`)
}

/** 섹터 삭제 미리보기→확인→삭제 플로우. 삭제 실행 자체가 409(레이스)로 실패하면
 * 미리보기를 재조회해서 그 시점 기준 차단 사유를 다시 보여준다(#95). */
export function useSectorDeleteFlow() {
  const deletePreview = useSectorDeletePreview()
  const deleteSector = useDeleteSector()

  const remove = async (sectorId: number, sectorName: string) => {
    let preview
    try {
      preview = await deletePreview.mutateAsync(sectorId)
    } catch (e) {
      alertDeleteFailed(sectorName, e)
      return
    }

    if (!preview.deletable) {
      alertBlocked(preview.sectorName, preview.blockingStocks)
      return
    }
    if (!confirmDeletable(preview.sectorName, preview.deletableSectors)) return

    try {
      await deleteSector.mutateAsync(sectorId)
    } catch (e) {
      if (isAxiosError(e) && e.response?.status === 409) {
        try {
          const retried = await deletePreview.mutateAsync(sectorId)
          alertBlocked(retried.sectorName, retried.blockingStocks)
        } catch (retryError) {
          alertDeleteFailed(sectorName, retryError)
        }
        return
      }
      alertDeleteFailed(sectorName, e)
    }
  }

  return { remove }
}
