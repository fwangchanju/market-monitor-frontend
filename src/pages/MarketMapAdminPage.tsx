import { useSearchParams } from 'react-router-dom'
import { isAxiosError } from 'axios'
import NavBar from '@/components/NavBar'
import AdminSidebar from '@/components/AdminSidebar'
import PermissionDenied from '@/components/PermissionDenied'
import AdminCategoryTable from '@/components/AdminCategoryTable'
import AdminStockTable from '@/components/AdminStockTable'
import { useAdminCategories, useStockCategories } from '@/hooks/useMarketMapAdmin'

export default function MarketMapAdminPage() {
  const [searchParams] = useSearchParams()
  const mode = searchParams.get('mode') === 'stock' ? 'stock' : 'category'
  const { data: categories, error: categoriesError } = useAdminCategories()
  const { data: stockCategories } = useStockCategories()

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
