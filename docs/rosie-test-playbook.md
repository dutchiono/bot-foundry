# Rosie — Bot Testing Playbook

Before launch on waifu.fun, run **5+ orders** through the full line. Each successful ship = proof for the agent dashboard and X feed.

## Setup

```powershell
npm run reset      # clean slate
npm run start:all  # OpenCode + Rosie runtime
```

## Test matrix

| # | Bot idea (paste to /newbot) | Proves |
|---|----------------------------|--------|
| 1 | BTC price alert bot — notify when BTC moves 5% in 1h | Crypto APIs, alerts, scaffold |
| 2 | Daily standup reminder — asks team 3 questions at 9am | Scheduling, groups |
| 3 | GitHub PR notifier — watch repo, post new PRs | Webhooks, external API |
| 4 | Dice roller + leaderboard for group chat | Stateless fun, UX |
| 5 | Portfolio tracker — add coins, show total value | Persistence, SQLite |
| 6 | Weather bot — zip code → forecast | Simple API, error handling |
| 7 | Todo list in DM — add/list/done | CRUD, single-user |
| 8 | Quote of the day from famous builders | Content, cron |

**Minimum for launch:** pass 1, 2, 4, 5, and 8 end-to-end (scaffold → ship → host).

## Per-run checklist

- [ ] `/newbot` → pipeline completes (all 9 phases)
- [ ] Telegram progress message updates live (not frozen)
- [ ] `workspace/bot-*` has `package.json`, compiles
- [ ] `windows` + child token → bot responds on Telegram
- [ ] `/stopbot` stops hosted child
- [ ] Screenshot + log line for waifu.fun / X

## Log template (post to X)

```
🔧 ROSIE — SHIFT ___
Order: [bot name]
Phases: 9/9 ✓
Host: [windows/mac/linux]
Status: LIVE @_____
#ROSIE #waifufun
```

## Known failure modes

| Symptom | Fix |
|---------|-----|
| 409 Conflict | `npm run stop` — only one Foundry instance |
| fetch failed @ ~300s | OpenCode timeout — retry phase or `skip` on regenerate |
| No workspace after restart | `.foundry-state.json` — use `/deploy` recovery |
| Child bot silent | Wrong token — must be **new** @BotFather bot, not Rosie's |
