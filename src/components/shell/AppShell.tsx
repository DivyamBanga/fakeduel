import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { useSettlement } from '@/hooks/useSettlement'
import { pruneCacheStorage } from '@/lib/cache'
import { pruneLineMemory } from '@/lib/lines'
import { useSettings } from '@/store/settings'
import { Betslip } from '../betslip/Betslip'
import { MobileBetslip } from '../betslip/MobileBetslip'
import { BottomTabs } from './BottomTabs'
import { DesktopHeader } from './DesktopHeader'
import { ErrorBoundary } from './ErrorBoundary'
import { MobileHeader } from './MobileHeader'
import { Sidebar } from './Sidebar'
import { Toasts } from './Toasts'

const MOBILE_TITLES: [RegExp, string][] = [
  [/^\/my-bets/, 'My Bets'],
  [/^\/account\/deposit/, 'Deposit'],
  [/^\/account\/withdraw/, 'Withdraw'],
  [/^\/account\/transactions/, 'Transactions'],
  [/^\/account\/settings/, 'Settings'],
  [/^\/account/, 'Account'],
  [/^\/promotions/, 'Promotions'],
  [/^\/rewards/, 'Rewards Hub'],
  [/^\/parlay-hub/, 'Parlay Hub'],
  [/^\/live/, 'Live now'],
  [/^\/search/, 'Search'],
  [/^\/all-sports/, 'All Sports'],
  [/^\/casino/, 'Casino'],
  [/^\/racing/, 'Racing'],
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const desktop = useIsDesktop()
  const theme = useSettings((s) => s.theme)
  const loc = useLocation()
  useSettlement()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#003d81' : '#1493ff')
  }, [theme])

  useEffect(() => {
    pruneCacheStorage()
    pruneLineMemory()
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [loc.pathname])

  if (desktop) {
    return (
      <div className="min-h-dvh" style={{ background: 'var(--fd-bg)' }}>
        <DesktopHeader />
        <div className="flex items-start">
          <div className="sticky top-[102px] h-[calc(100dvh-102px)] overflow-y-auto no-scrollbar shrink-0">
            <Sidebar />
          </div>
          <main className="flex-1 min-w-0 pt-4 pb-16 px-8" style={{ maxWidth: 780 + 64 }}>
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
          <aside className="w-[376px] shrink-0 sticky top-[102px] h-[calc(100dvh-102px)] mr-5 pt-4 pb-4">
            <div className="h-full rounded-md overflow-hidden" style={{ background: 'var(--fd-bg)' }}>
              <ErrorBoundary>
                <Betslip />
              </ErrorBoundary>
            </div>
          </aside>
        </div>
        <Toasts />
      </div>
    )
  }

  const title = MOBILE_TITLES.find(([re]) => re.test(loc.pathname))?.[1]
  return (
    <div className="min-h-dvh" style={{ background: 'var(--fd-bg)' }}>
      <MobileHeader title={title} />
      <main className="pb-[140px]">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
      <ErrorBoundary>
        <MobileBetslip />
      </ErrorBoundary>
      <BottomTabs />
      <Toasts />
    </div>
  )
}
