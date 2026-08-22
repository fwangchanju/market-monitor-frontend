import { useSearchParams } from 'react-router-dom'
import { isAxiosError } from 'axios'
import NavBar from '@/components/NavBar'
import AdminSidebar from '@/components/AdminSidebar'
import PermissionDenied from '@/components/PermissionDenied'
import AdminCategoryTable from '@/components/AdminCategoryTable'
import AdminStockTable from '@/components/AdminStockTable'
import Spinner from '@/components/Spinner'
import { useAdminCategories, useStockCategories } from '@/hooks/useMarketMapAdmin'

export default function MarketMapAdminPage() {
  const [searchParams] = useSearchParams()
  const mode = searchParams.get('mode') === 'category' ? 'category' : 'stock'
  const { data: categories, error: categoriesError, isLoading } = useAdminCategories()
  const { data: stockCategories } = useStockCategories()

  // 로딩 중엔 admin 여부를 아직 모르므로, 403으로 걸러지기 전까지 사이드바/테이블 같은 실제
  // 콘텐츠가 먼저 그려졌다가 사라지지 않도록 상단바+스피너만 보여준다(AdminPage.tsx와 동일 패턴).
  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <NavBar />
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
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <div className="flex flex-1">
        <AdminSidebar mode={mode} />
        <div className="flex-1 p-4">
          <div className="mt-4">
            {mode === 'stock' ? (
              <AdminStockTable items={stockCategories ?? []} categories={categories ?? []} />
            ) : (
              <AdminCategoryTable categories={categories ?? []} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
