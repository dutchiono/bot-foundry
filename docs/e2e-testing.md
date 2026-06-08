# E2E Bot Matrix

Automated pipeline runs + one test Telegram token rotated across outputs.

## Setup

1. OpenCode running: `opencode serve --port 4096`
2. In `.env` — **separate** from Foundry:

```
BOT_TOKEN=...                    # @dot_bot_foundry_bot — the factory
E2E_TEST_CHILD_BOT_TOKEN=...   # your test child bot — NOT Foundry
```

## Build the bot series (unattended)

Runs each case through all 9 phases. Auto-replies `skip` if regenerate asks for input.

```powershell
# All 6 bots (~30-60+ min each on free model — run overnight)
npm run e2e:batch

# Subset only
npm run e2e:batch -- --only price-alert,quote-daily

# Resume from case 3
npm run e2e:batch -- --from 2
```

Writes `.e2e-manifest.json` with workspace paths and status.

## Test on Telegram (token rotation)

One test bot token → inject into each built workspace in turn:

```powershell
npm run e2e:rotate -- --next          # first, then cycles
npm run e2e:rotate -- --id price-alert
npm run e2e:rotate -- --index 0
npm run e2e:rotate -- --stop
npm run e2e:status
```

Each rotate:
1. Stops any running child bot
2. Writes `E2E_TEST_CHILD_BOT_TOKEN` into that workspace `.env`
3. `npm install` + starts `npm run dev`
4. Prints `@username` + commands to try

## Bot matrix

| id | bot | telegram checks |
|----|-----|-----------------|
| price-alert | btc_price_alert | /start, /price btc, /alert 5 |
| dice-leaderboard | dice_roller | /start, /roll, /leaderboard |
| todo-dm | todo_list_bot | /start, /add, /list, /done 1 |
| weather-zip | weather_zip_bot | /start, zip code, /help |
| quote-daily | builder_quotes | /start, /quote, /today |
| standup-reminder | standup_reminder | /start, /standup, /help |

Edit cases in `tests/fixtures/e2e-bots.ts`.

## Vitest smoke (one bot)

```powershell
$env:E2E=1
npm run test:e2e
```

Optional: `$env:E2E_SMOKE_CASE='quote-daily'` (default, fastest-ish).

Fixture tests run without `E2E=1`; full pipeline smoke is skipped unless set.
