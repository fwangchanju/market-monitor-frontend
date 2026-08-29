import { useSearchParams } from 'react-router-dom'
import { isAxiosError } from 'axios'
import NavBar from '@/components/NavBar'
import SubNavBar from '@/components/SubNavBar'
import PermissionDenied from '@/components/PermissionDenied'
import AdminCategoryTable from '@/components/AdminCategoryTable'
import AdminStockTable from '@/components/AdminStockTable'
import Spinner from '@/components/Spinner'
import { useAdminCategories, useStockCategories } from '@/hooks/useMarketMapAdmin'

export default function MarketMapAdminPage() {
  const [searchParams] = useSearchParams()
  const mode = searchParams.get('mode') === 'category' ? 'category' : 'stock'
  const {
    data: categories,
    error: categoriesError,
    isLoading,
    refetch: refetchCategories,
    isRefetching: isRefetchingCategories,
  } = useAdminCategories()
  const { data: stockCategories } = useStockCategories()

  // 로딩 중엔 admin 여부를 아직 모르므로, 403으로 걸러지기 전까지 사이드바/테이블 같은 실제
  // 콘텐츠가 먼저 그려졌다가 사라지지 않도록 상단바+스피너만 보여준다(AdminPage.tsx와 동일 패턴).
  if (isLoading) {
    return (
      <div className="flex h-screen flex-col overflow-hidden">
        <NavBar />
        <SubNavBar />
        <div className="flex justify-center p-16">
          <Spinner />
        </div>
      </div>
    )
  }

  if (isAxiosError(categoriesError) && categoriesError.response?.status === 403) {
    return <PermissionDenied />
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <NavBar />
      <SubNavBar />
      {/* 좌측 사이드바(종목/카테고리 전환 + 버전관리 저장) 삭제 — 종목/카테고리 전환은 SubNavBar의
          "커스텀" 탭 hover 목록으로 이동. 버전관리 저장(AdminVersionSaveSection)은 기능 검증과
          위치 재검토가 더 필요해서 일단 뺐다 — 다시 넣을 땐 이 컴포넌트를 재사용하면 된다. */}
      <div className={`flex min-h-0 flex-1 flex-col px-4 pt-2 pb-4 ${mode === 'category' ? 'overflow-y-auto' : ''}`}>
        {mode === 'stock' ? (
          <AdminStockTable
            items={stockCategories?.items ?? []}
            categories={categories ?? []}
            snapshotTime={stockCategories?.snapshotTime ?? null}
            onRefetchCategories={() => refetchCategories()}
            isRefetchingCategories={isRefetchingCategories}
          />
        ) : (
          <AdminCategoryTable categories={categories ?? []} />
        )}
      </div>
    </div>
  )
}
