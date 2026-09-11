# FakeDuel

A practice sportsbook that mirrors the FanDuel Sportsbook experience with play money.

Live: https://divyambanga.github.io/fakeduel/

- Real schedules, scores and lines from ESPN's public feeds (DraftKings game lines, real player-prop lines) with synthesized prices where no real price exists.
- Every bet type: straights, parlays, Same Game Parlays and SGP+, round robins, teasers, live in-play betting, cash out, futures, player props, alternate lines, profit boosts and no-sweat tokens.
- Bets settle automatically from real box scores.
- Phone layout mirrors the app (bottom tabs, sheet betslip, installable PWA); desktop mirrors the three-column website.
- Everything is stored in your browser. Export/import a backup from Settings.

## Develop

```
npm install
npm run dev
```

`npm run build` produces `dist/`, which the GitHub Actions workflow deploys to GitHub Pages on every push to `main`.
