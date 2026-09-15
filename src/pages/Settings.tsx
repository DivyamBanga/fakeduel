import { useRef, useState } from 'react'
import { clearCacheStorage } from '@/lib/cache'
import { Toggle } from '@/components/betslip/Betslip'
import { Card, SectionHeader } from '@/components/shell/SectionHeader'
import type { OddsFormat } from '@/lib/types'
import { useAccount } from '@/store/account'
import { useBetslip } from '@/store/betslip'
import { useSettings, type Theme } from '@/store/settings'

function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--fd-line-2)' }}>
      <div className="min-w-0">
        <div className="text-[15px]" style={{ color: 'var(--fd-fg)' }}>
          {label}
        </div>
        {sub ? (
          <div className="text-[12px]" style={{ color: 'var(--fd-fg-3)' }}>
            {sub}
          </div>
        ) : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Segment<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded overflow-hidden border" style={{ borderColor: 'var(--fd-line)' }}>
      {options.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)} className="h-8 px-3 text-[13px] font-semibold" style={{ background: value === o.id ? '#2b90ff' : 'transparent', color: value === o.id ? '#fff' : 'var(--fd-link)' }}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function SettingsPage() {
  const s = useSettings()
  const account = useAccount()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [name, setName] = useState(s.displayName)

  const exportData = () => {
    const data = { version: 1, exportedAt: new Date().toISOString(), account: { balance: account.balance, bonusBalance: account.bonusBalance, bets: account.bets, transactions: account.transactions, tokens: account.tokens, rewards: account.rewards, claimed: account.claimed, createdAt: account.createdAt }, settings: { theme: s.theme, oddsFormat: s.oddsFormat, acceptOddsMovements: s.acceptOddsMovements, keepSelectionsAfterBet: s.keepSelectionsAfterBet, displayName: s.displayName } }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fakeduel-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMsg('Backup downloaded.')
  }
  const importData = async (file: File) => {
    try {
      const j = JSON.parse(await file.text())
      if (!j.account) throw new Error('Not a FakeDuel backup')
      account.importState(j.account)
      if (j.settings) {
        s.setTheme(j.settings.theme ?? 'dark')
        s.setOddsFormat(j.settings.oddsFormat ?? 'american')
        s.setDisplayName(j.settings.displayName ?? 'Player')
      }
      useBetslip.getState().clear()
      setMsg('Backup restored.')
    } catch (e) {
      setMsg(`Import failed: ${(e as Error).message}`)
    }
  }

  return (
    <div className="px-4 lg:px-0">
      <h1 className="hidden lg:block text-[20px] font-bold mt-2 mb-3" style={{ color: 'var(--fd-fg)' }}>
        Settings
      </h1>
      <Card className="mt-3">
        <SectionHeader title="Display" />
        <Row label="Theme" sub="FanDuel's default is dark">
          <Segment<Theme> value={s.theme} options={[{ id: 'dark', label: 'Dark' }, { id: 'light', label: 'Light' }]} onChange={s.setTheme} />
        </Row>
        <Row label="Odds format">
          <Segment<OddsFormat> value={s.oddsFormat} options={[{ id: 'american', label: 'American' }, { id: 'decimal', label: 'Decimal' }, { id: 'fractional', label: 'Fractional' }]} onChange={s.setOddsFormat} />
        </Row>
      </Card>
      <Card>
        <SectionHeader title="FanDuel odds (The Odds API)" />
        <div className="px-4 py-3 text-[13px] leading-5" style={{ color: 'var(--fd-fg-2)' }}>
          Paste a free key from <a href="https://the-odds-api.com" target="_blank" rel="noreferrer" style={{ color: 'var(--fd-link)' }}>the-odds-api.com</a> and game lines, alternates and player props switch to FanDuel's actual prices wherever FanDuel posts them. Prices are cached so 500 credits a month covers normal use.
        </div>
        <Row label="API key">
          <input
            value={s.oddsApiKey}
            onChange={(e) => s.setOddsApiKey(e.target.value.trim())}
            placeholder="Paste key"
            spellCheck={false}
            className="h-9 px-3 rounded border text-[13px] w-[220px] font-mono"
            style={{ borderColor: 'var(--fd-line)', background: 'var(--fd-input-bg)', color: 'var(--fd-fg)' }}
          />
        </Row>
        <Row label="Use FanDuel prices" sub={s.oddsApiKey ? (s.oddsApiStatus.lastError ? s.oddsApiStatus.lastError : s.oddsApiStatus.remaining !== null ? `${s.oddsApiStatus.remaining} credits left this month` : 'Key saved. Prices load on the next page you open.') : 'Add a key to enable'}>
          <Toggle on={s.useFanDuelPrices} onChange={s.setUseFanDuelPrices} />
        </Row>
        <Row label="Clear cached odds" sub="Forces fresh prices on the next load (uses credits)">
          <button onClick={() => { clearCacheStorage(); try { for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k?.startsWith('fd.oa.')) localStorage.removeItem(k) } } catch { /* ignore */ } setMsg('Cached odds cleared.') }} className="h-9 px-4 rounded border text-[13px] font-semibold" style={{ borderColor: '#ced4db', color: 'var(--fd-fg)' }}>
            Clear
          </button>
        </Row>
      </Card>
      <Card>
        <SectionHeader title="Betting" />
        <Row label="Accept odds movements" sub="Place bets even if the price moves">
          <Toggle on={s.acceptOddsMovements} onChange={s.setAcceptOddsMovements} />
        </Row>
        <Row label="Keep selections after placing a bet">
          <Toggle on={s.keepSelectionsAfterBet} onChange={s.setKeepSelections} />
        </Row>
      </Card>
      <Card>
        <SectionHeader title="Profile" />
        <Row label="Display name">
          <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => s.setDisplayName(name.trim() || 'Player')} className="h-9 px-3 rounded border text-[14px] w-[160px]" style={{ borderColor: 'var(--fd-line)', background: 'var(--fd-input-bg)', color: 'var(--fd-fg)' }} />
        </Row>
      </Card>
      <Card>
        <SectionHeader title="Data" />
        <Row label="Export backup" sub="Download balance, bets and history as JSON">
          <button onClick={exportData} className="h-9 px-4 rounded border text-[13px] font-semibold" style={{ borderColor: '#ced4db', color: 'var(--fd-fg)' }}>
            Export
          </button>
        </Row>
        <Row label="Import backup" sub="Restore from a JSON file exported on another device">
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
          <button onClick={() => fileRef.current?.click()} className="h-9 px-4 rounded border text-[13px] font-semibold" style={{ borderColor: '#ced4db', color: 'var(--fd-fg)' }}>
            Import
          </button>
        </Row>
        {msg ? (
          <div className="px-4 py-3 text-[13px]" style={{ color: '#41e878' }}>
            {msg}
          </div>
        ) : null}
      </Card>
      <div className="text-[11px] text-center py-4" style={{ color: 'var(--fd-fg-3)' }}>
        FakeDuel v0.1 · Data lives in this browser only.
      </div>
    </div>
  )
}
