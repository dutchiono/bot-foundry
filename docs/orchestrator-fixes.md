# Getting the Pipeline Orchestrator Working

What we had to fix for Bot Foundry's 9-phase pipeline to run end-to-end.

## Prerequisites

Two services must run:

| Service | Command |
|---------|---------|
| OpenCode | `opencode serve --port 4096` |
| Bot Foundry | `npm run dev` |

Or on Windows: `npm run start:all`

**Common startup failures:**

- Stale `BOT_TOKEN` in shell overrides `.env` → 401
- Multiple `npm run dev` instances → Telegram 409 Conflict
- Missing OpenCode → pipeline starts but phases fail immediately

## Architecture

```
/newbot → chat.ts → orchestrator.startPipeline()
                         ├─ createBotWorkspace()  → workspace/bot-<id>/
                         └─ runPipeline()           → 9 phases via OpenCode
```

Phases: preflight → research → scaffold → enrich → regenerate → review → agent-readiness → comparative → ship

## Fixes by Layer

### 1. OpenCode client (`src/opencode/client.ts`)

**Model / JSON format** — `json_schema` API uses `tool_choice`, which breaks on free models. Fix: append schema to prompt as plain text; parse with `extractJsonFromParts()`.

**Timeouts** — scaffold/regenerate take 3–10+ min. Default fetch died at ~300s (`TypeError: fetch failed`). Fix: 20-min timeout + 3 retries on connection drops.

**Error handling** — OpenCode errors could leave `result.parts` undefined and crash the bot. Fix: `unwrapData()` + provider error checks.

### 2. Orchestrator (`src/pipeline/orchestrator.ts`)

- **Progress sink** — `emitProgress()` → Telegram live updates
- **Heartbeats** — `sendPromptWithProgress()` posts `⏳ AI working... (Ns elapsed)` every 12s
- **Phase resume** — skip phases already marked `completed` after tsx restart
- **Activity log** — rolling log in pipeline state for Telegram status message
- **awaiting_input** — pause for user input (e.g. `skip` on regenerate), resume on reply

### 3. Telegram layer (`src/bot/handlers/chat.ts`)

- `setupTelegramProgress()` — edits one status message as phases run
- `formatPipelineProgress()` — phase name, timer, activity log
- `checkPipelineProgress()` — polls until completed / failed / awaiting_input
- `escapeMarkdown()` — underscores in bot names broke Telegram parsing
- Deploy replies (`windows`, `/windows`) no longer fall through to "Added to context"

### 4. Session persistence (`src/bot/persist.ts`)

`.foundry-state.json` saves `activeBotId`, `workspaceDir`, deploy flags across Foundry restarts.

### 5. Local hosting (`src/deploy/runner.ts`)

After pipeline completes: reply `windows`/`mac`/`linux` → paste @BotFather token → Foundry runs `npm install` + `npm run dev` for the child bot.

## Dev scripts

| Command | Action |
|---------|--------|
| `npm run start:all` | Start OpenCode + Foundry |
| `npm run stop` | Kill processes |
| `npm run reset` | Stop + clear state + delete `workspace/bot-*` |

## Working flow

1. `npm run start:all`
2. Telegram: `/newbot` → describe bot
3. Watch Telegram status message through 9 phases (~10–30 min on free model)
4. `🎉 Bot is ready!` → reply `windows`
5. Paste new child bot token → Foundry hosts it locally
6. `/stopbot` to stop hosted child

## Key files

| File | Role |
|------|------|
| `src/pipeline/orchestrator.ts` | Phase loop + progress |
| `src/opencode/client.ts` | OpenCode HTTP + retries |
| `src/bot/handlers/chat.ts` | Telegram ↔ orchestrator bridge |
| `src/bot/persist.ts` | Session recovery |
| `src/deploy/runner.ts` | Local child bot hosting |
| `scripts/start-all.ps1` | Windows one-command startup |
