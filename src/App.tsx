import { Route, Routes } from 'react-router-dom'
import { AppShell } from './components/shell/AppShell'
import { AccountPage } from './pages/Account'
import { AllSportsPage } from './pages/AllSports'
import { ComingSoonPage } from './pages/ComingSoon'
import { DepositPage } from './pages/Deposit'
import { EventPage } from './pages/Event'
import { HomePage } from './pages/Home'
import { LeaguePage } from './pages/League'
import { LivePage } from './pages/Live'
import { MyBetsPage } from './pages/MyBets'
import { NotFoundPage } from './pages/NotFound'
import { ParlayHubPage } from './pages/ParlayHub'
import { PromotionsPage } from './pages/Promotions'
import { RewardsPage } from './pages/Rewards'
import { SearchPage } from './pages/Search'
import { SettingsPage } from './pages/Settings'
import { StaticPage } from './pages/Static'
import { TransactionsPage } from './pages/Transactions'
import { WithdrawPage } from './pages/Withdraw'

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/navigation/:slug" element={<LeaguePage />} />
        <Route path="/live" element={<LivePage />} />
        <Route path="/my-bets" element={<MyBetsPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/account/deposit" element={<DepositPage />} />
        <Route path="/account/withdraw" element={<WithdrawPage />} />
        <Route path="/account/transactions" element={<TransactionsPage />} />
        <Route path="/account/settings" element={<SettingsPage />} />
        <Route path="/promotions" element={<PromotionsPage />} />
        <Route path="/rewards" element={<RewardsPage />} />
        <Route path="/parlay-hub" element={<ParlayHubPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/all-sports" element={<AllSportsPage />} />
        <Route path="/casino" element={<ComingSoonPage title="Casino" />} />
        <Route path="/racing" element={<ComingSoonPage title="Racing" />} />
        <Route path="/fantasy" element={<ComingSoonPage title="Fantasy" />} />
        <Route path="/tv" element={<ComingSoonPage title="FakeDuel TV+" />} />
        <Route path="/learn" element={<StaticPage kind="learn" />} />
        <Route path="/terms" element={<StaticPage kind="terms" />} />
        <Route path="/responsible-gaming" element={<StaticPage kind="rg" />} />
        <Route path="/house-rules" element={<StaticPage kind="rules" />} />
        <Route path="/support" element={<StaticPage kind="support" />} />
        <Route path="/:sport/:leagueId/:slug" element={<EventPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  )
}
