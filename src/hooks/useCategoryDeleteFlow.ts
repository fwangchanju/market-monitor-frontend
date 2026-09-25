import { isAxiosError } from 'axios'
import { useSectorDeletePreview, useDeleteSector } from './useMarketMapCustom'
import type { StockSectorItem } from '@/types/api'
import { getErrorDetail } from '@/utils/errorMessage'

function confirmDeletable(categoryName: string, deletableCategories: string[]) {
  const list = deletableCategories.length > 0 ? deletableCategories.join(', ') : '없음'
  return window.confirm(`${categoryName}\n세부카테고리: ${list}\n삭제하시겠습니까?`)
}

function alertBlocked(categoryName: string, blockingStocks: StockSectorItem[]) {
  const base = `${categoryName}\n이 카테고리는 삭제할 수 없습니다.`
  if (blockingStocks.length === 0) {
    window.alert(base)
    return
  }
  const list = blockingStocks.map(s => `${s.sectorName} - ${s.stockName}`).join('\n')
  window.alert(`${base}\n${list}`)
}

function alertDeleteFailed(categoryName: string, error: unknown) {
  window.alert(`${categoryName}\n${getErrorDetail(error)}`)
}

/** 카테고리 삭제 미리보기→확인→삭제 플로우. 삭제 실행 자체가 409(레이스)로 실패하면
 * 미리보기를 재조회해서 그 시점 기준 차단 사유를 다시 보여준다(#95). */
export function useCategoryDeleteFlow() {
  const deletePreview = useSectorDeletePreview()
  const deleteSector = useDeleteSector()

  const remove = async (categoryId: number, categoryName: string) => {
    let preview
    try {
      preview = await deletePreview.mutateAsync(categoryId)
    } catch (e) {
      alertDeleteFailed(categoryName, e)
      return
    }

    if (!preview.deletable) {
      alertBlocked(preview.sectorName, preview.blockingStocks)
      return
    }
    if (!confirmDeletable(preview.sectorName, preview.deletableSectors)) return

    try {
      await deleteSector.mutateAsync(categoryId)
    } catch (e) {
      if (isAxiosError(e) && e.response?.status === 409) {
        try {
          const retried = await deletePreview.mutateAsync(categoryId)
          alertBlocked(retried.sectorName, retried.blockingStocks)
        } catch (retryError) {
          alertDeleteFailed(categoryName, retryError)
        }
        return
      }
      alertDeleteFailed(categoryName, e)
    }
  }

  return { remove }
}
