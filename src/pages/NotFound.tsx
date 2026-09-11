import { Link } from 'react-router-dom'
import { Card, EmptyState } from '@/components/shell/SectionHeader'

export function NotFoundPage() {
  return (
    <div className="px-4 lg:px-0">
      <Card className="mt-3">
        <EmptyState title="Page not found" body="The page you're looking for doesn't exist or has moved." />
        <div className="pb-6 text-center">
          <Link to="/" className="inline-flex items-center justify-center h-[40px] px-6 rounded text-[14px] font-semibold text-white" style={{ background: '#128000' }}>
            Go home
          </Link>
        </div>
      </Card>
    </div>
  )
}
