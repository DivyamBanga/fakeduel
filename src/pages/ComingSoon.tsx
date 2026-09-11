import { Link } from 'react-router-dom'
import { Card, EmptyState } from '@/components/shell/SectionHeader'

export function ComingSoonPage({ title }: { title: string }) {
  return (
    <div className="px-4 lg:px-0">
      <h1 className="hidden lg:block text-[20px] font-bold mt-2 mb-3" style={{ color: 'var(--fd-fg)' }}>
        {title}
      </h1>
      <Card className="mt-3">
        <EmptyState title={`${title} is coming soon`} body="FakeDuel is a practice sportsbook. Casino, Racing and Fantasy are not part of the practice experience yet." />
        <div className="pb-6 text-center">
          <Link to="/" className="inline-flex items-center justify-center h-[40px] px-6 rounded text-[14px] font-semibold text-white" style={{ background: '#128000' }}>
            Back to Sportsbook
          </Link>
        </div>
      </Card>
    </div>
  )
}
