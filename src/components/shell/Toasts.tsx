import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccount } from '@/store/account'

export function Toasts() {
  const notifications = useAccount((s) => s.notifications)
  const markRead = useAccount((s) => s.markNotificationsRead)
  const [shown, setShown] = useState<typeof notifications>([])
  useEffect(() => {
    const unread = notifications.filter((n) => !n.read)
    if (!unread.length) return
    setShown(unread.slice(0, 3))
    markRead()
    const t = window.setTimeout(() => setShown([]), 6000)
    return () => window.clearTimeout(t)
  }, [notifications, markRead])
  if (!shown.length) return null
  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] w-[min(92vw,420px)] space-y-2">
      {shown.map((n) => (
        <Link key={n.id} to="/my-bets" onClick={() => setShown([])} className="block rounded-md px-4 py-3 shadow-lg fade-in border" style={{ background: 'var(--fd-surface)', borderColor: n.title.includes('won') ? '#128000' : 'var(--fd-line)' }}>
          <div className="text-[14px] font-bold" style={{ color: n.title.includes('won') ? '#41e878' : 'var(--fd-fg)' }}>
            {n.title}
          </div>
          <div className="text-[13px]" style={{ color: 'var(--fd-fg-2)' }}>
            {n.body}
          </div>
        </Link>
      ))}
    </div>
  )
}
