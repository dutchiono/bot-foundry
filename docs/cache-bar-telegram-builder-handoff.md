# Foundry → .cache Telegram Builder Handoff

> **Canonical copy for cache-bar:** `../cache-bar/docs/foundry-telegram-builder-handoff.md`  
> This file is a mirror so you can open it from the bot-foundry workspace.

How patterns from **bot-foundry** (`Playground/New folder/bot-foundry`) map onto **.cache** (`Playground/cache-bar`) — especially Telegram routing, durable session state, and the “describe a thing → multi-phase line → shipped artifact” flow.

This is an implementation guide, not marketing copy.

---

## What bot-foundry actually does

Foundry is a Telegram (+ Discord) operator that **fabricates whole programs** (child Telegram bots) from a plain-English order:

1. User sends `/newbot` then describes what they want.
2. A **session state machine** (`phase`, `awaiting*` flags) drives the conversation.
3. A **nine-phase pipeline** (OpenCode-backed) researches, scaffolds, reviews, and ships code into `workspace/bot-{id}/`.
4. **Live progress** edits one message in-chat while phases run.
5. After completion, a **deploy funnel** (platform choice → paste bot token → local host) finishes the loop.
6. **Restart recovery** uses persisted session + on-disk workspace when in-memory pipeline state is gone.

The important architectural move is not OpenCode itself — it is the **split**:

```
Platform (Telegram / Discord)
  → Messenger adapter (reply, progress edits)
    → Core commands + message handler (platform-agnostic)
      → Session store + orchestrator + external builder (OpenCode)
```

---

## What .cache already has

| Layer | .cache today | Primary files |
| --- | --- | --- |
| **Persistence** | Convex tables, no client store | `convex/schema.ts` |
| **Telegram routing** | Webhook → `processUpdate` → if/else on commands/callbacks | `convex/telegramStoreBot.ts`, `convex/telegramManagerBot.ts`, `convex/telegramWebhook.ts` |
| **Shop session** | `telegramSessions`: `bot`, `chatId`, `mode` (`menu` \| `chat`), `cart[]` | `convex/telegramSessions.ts` |
| **Agent chat** | Eliza proxy + local fallbacks | `convex/lib/elizaCloudChat.ts`, `convex/lib/shopConcierge.ts` |
| **Agent → store (safe)** | Proposal-only capability API; human review | `convex/capabilityHttp.ts`, `capabilityProposals` table |
| **Launch demo** | Simulated Foundry provisioning UI | `foundryDemoLaunches`, `src/pages/Launchpad.tsx` |
| **Provisioner prototype** | Idempotent step journal (not wired to prod Convex) | `platform/provisioner/provisioner.ts` |

**Gap:** Telegram is a **shop concierge** (menu, cart, optional Eliza chat). There is no multi-step **builder** that produces a durable artifact (repo, bot, capability install, product draft) with phased progress and recovery.

---

## Side-by-side: session models

### bot-foundry `UserSession` (JSON persist)

| Field | Role |
| --- | --- |
| `userKey` | Canonical id: `tg:{chatId}` / `dc:{id}` |
| `phase` | UX state: `-1` idle, `0` awaiting spec, `9` deploy |
| `activeBotId` | Current build job |
| `workspaceDir` | Output path on disk |
| `pipelineRunId` | In-memory run (weakly persisted) |
| `awaitingDeployChoice` / `awaitingChildBotToken` | Post-build funnel |
| `progressChannel` | `{ platform, chatId, messageId }` for live edits |

### .cache `telegramSessions` (Convex)

| Field | Role |
| --- | --- |
| `bot` | `store` \| `manager` |
| `chatId` | Telegram chat |
| `mode` | `menu` \| `chat` |
| `cart` | `{ sku, qty }[]` |

**Takeaway:** Shop session is too thin for a builder. Extend it or add a sibling table — do not overload `cart` / `mode` for pipeline state.

---

## Recommended Convex additions

Add a **builder session** table separate from shop cart state. Keeps store bot simple; manager bot or a third “builder” surface can share it.

```ts
// convex/schema.ts — proposed
builderSessions: defineTable({
  userKey: v.string(),           // "tg:123456789"
  bot: v.union(v.literal("store"), v.literal("manager"), v.literal("builder")),
  chatId: v.number(),
  phase: v.number(),             // -1 idle, 0 spec, 1..N pipeline, 9 post-build
  activeJobId: v.optional(v.string()),
  jobKind: v.optional(v.union(
    v.literal("telegram-bot"),   // bot-foundry parity
    v.literal("product-draft"),    // lands in capabilityProposals
    v.literal("capability-install"),
  )),
  workspaceRef: v.optional(v.string()),  // storage id or external path
  pipelineRunId: v.optional(v.string()),
  awaitingInput: v.optional(v.boolean()),
  inputPrompt: v.optional(v.string()),
  progressMessageId: v.optional(v.number()),
  progressChatId: v.optional(v.number()),
  updatedAt: v.number(),
})
  .index("by_user_key", ["userKey"])
  .index("by_bot_chat", ["bot", "chatId"]),
```

Add a **builder jobs** table (mirrors `BotDefinition`):

```ts
builderJobs: defineTable({
  publicId: v.string(),
  creatorKey: v.string(),
  kind: v.string(),
  name: v.string(),
  description: v.string(),
  status: v.union(
    v.literal("idea"),
    v.literal("running"),
    v.literal("awaiting_input"),
    v.literal("ready"),
    v.literal("failed"),
    v.literal("deployed"),
  ),
  spec: v.optional(v.any()),
  workspaceRef: v.optional(v.string()),
  error: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_creator", ["creatorKey"])
  .index("by_public_id", ["publicId"]),
```

**Pipeline run state** (optional but fixes foundry’s restart gap):

```ts
builderRuns: defineTable({
  jobId: v.id("builderJobs"),
  currentPhase: v.number(),
  phaseName: v.string(),
  status: v.union(
    v.literal("running"),
    v.literal("awaiting_input"),
    v.literal("completed"),
    v.literal("failed"),
  ),
  activityLog: v.array(v.string()),
  pendingInputPrompt: v.optional(v.string()),
  startedAt: v.number(),
  completedAt: v.optional(v.number()),
  error: v.optional(v.string()),
}).index("by_job", ["jobId"]),
```

Persist orchestrator state in Convex instead of process memory so `/status` survives deploys.

---

## Routing: port the adapter → core split

Today `telegramStoreBot.ts` is one file with nested `if` chains. Foundry uses:

| Foundry file | .cache equivalent |
| --- | --- |
| `src/bot/handlers/with-telegram.ts` | `convex/lib/telegramContext.ts` — resolve session, try/catch, call core |
| `src/bot/platform/types.ts` (`FoundryMessenger`) | `TelegramMessenger` interface: `reply`, `editProgress` |
| `src/bot/core/commands.ts` | `convex/builder/commands.ts` (or `convex/lib/builderCore.ts`) |
| `src/bot/core/message-handler.ts` | Same — state machine for free text |
| `src/bot/handlers/chat.ts` | Thin: webhook → messenger → `handleBuilderMessage` |

### Target flow (store bot keeps shop; builder is additive)

```
POST /telegram/store/webhook
  processUpdate
    ├─ callback_query → existing shop handlers (unchanged)
    ├─ /build, /newbot → builderCommands.startJob()
    ├─ /status, /deploy → builderCommands.*
    └─ free text
         ├─ if builderSession.phase >= 0 → handleBuilderMessage()
         └─ else existing shop / Eliza paths
```

Manager bot can expose the same builder commands without cart logic — share `builderCore`, different `TelegramMessenger` wiring.

### `TelegramMessenger` (minimal interface)

```ts
export type TelegramMessenger = {
  userKey: string;
  chatId: number;
  reply: (text: string, opts?: { parseMode?: "HTML" | "Markdown" }) => Promise<void>;
  editProgress: (text: string) => Promise<void>;
};
```

Implementation lives next to `sendTelegramMessage` in `convex/lib/telegramApi.ts`. On progress update: `editMessageText` if `progressMessageId` set, else `sendMessage` + persist ids via `builderSessions` mutation.

---

## Pipeline / “makes a whole program”

Foundry phases (`bot-foundry/src/pipeline/`):

| Phase | What it does | .cache mapping |
| --- | --- | --- |
| 0 preflight | Validate spec | Validate builder job + policy (capability auth, size limits) |
| 1 research | API/docs research | Eliza or OpenCode research step |
| 2 scaffold | Generate skeleton | Write files to workspace / Convex storage |
| 3–4 enrich/regen | Fill gaps | Same |
| 5 review | Lint/test | `bun test`, typecheck hook |
| 6–7 readiness/compare | Quality gates | Optional for v1 |
| 8 ship | Dockerfile, CI artifacts | Prodigi listing draft, deploy script, or capability manifest |

**Where the builder runs:**

| Option | Pros | Cons |
| --- | --- | --- |
| **A. Convex action → external OpenCode** (foundry parity) | Real code gen, same as bot-foundry | Needs long-running worker; Convex action timeouts |
| **B. Convex action → Eliza tool loop** | Already integrated | Weaker file/workspace story today |
| **C. Sidecar worker** (Node process like bot-foundry) | Full pipeline, no timeout fight | Another deploy unit; call via HTTP + webhooks back to Convex |

**Practical v1 for .cache:** **C** — a small `builder-worker` service (fork bot-foundry orchestrator) that:

1. Receives `POST /jobs/start` from Convex with `jobId`, spec, callback URL.
2. Runs phases; `POST` progress + terminal status to Convex HTTP routes.
3. Stores workspace on disk or uploads tarball to Convex `_storage`.
4. Convex updates `builderRuns` + edits Telegram progress message via internal action.

This matches how you already treat heavy work (workflows, Prodigi) as **durable jobs** rather than inline webhook logic.

---

## Connecting builder output to the store

Do not let agents auto-publish. Align with existing **proposal-only** boundary.

| Builder output | Store integration |
| --- | --- |
| **Telegram bot** (foundry parity) | Deliver zip + deploy instructions; optional link from `creators` agent row |
| **Product draft** | `capabilityProposals` action `product-draft` with `builderJobId` in payload — staff accepts in `/app` |
| **Capability install** | `foundryDemoLaunches` / real `platform/provisioner` step — append `completedSteps` |
| **Catalog sync** | Replace hardcoded `liveShopCatalog.ts` SKU path with Convex `products` query once draft is accepted |

Foundry reference for recovery (port the logic, Convex backing):

```
/deploy recovery order:
  1. builderSession.activeJobId → builderJobs row
  2. else latest builderJobs where creatorKey + status=ready
  3. else workspaceRef still on disk/storage
  4. else "no active job"
```

---

## Cross-platform identity (optional)

Foundry uses `userKey` + `/link` codes (`bot-foundry/src/identity/`). .cache can adopt lightly:

- `userKey = "tg:" + chatId` for Telegram-only v1.
- When Discord or web builder exists: same `userKey` space + `accountLinks` table (copy foundry’s `links.canonical` map).
- Tie to `creators` where `type: "agent"` — human operators use staff auth; Telegram customers use `userKey`.

---

## Progress + error handling (copy these behaviors)

From foundry review-hardening — worth porting outright:

1. **Per-user message queue** — serialize concurrent Telegram messages per `userKey` (foundry `enqueueUserMessage`).
2. **Single progress message** — edit in place; recreate if Telegram returns “message not found”.
3. **try/catch at webhook boundary** — one generic user reply, full error in logs.
4. **Terminal poll cleanup** — stop polling when run is `completed` / `failed` / `awaiting_input`.
5. **Rate limits on sensitive actions** — foundry `/link` pattern; apply to `/build` starts per chat.

---

## What not to port blindly

| Foundry piece | Why skip or adapt |
| --- | --- |
| JSON file `.foundry-state.json` | .cache already has Convex — use tables |
| `deploy/runner.ts` local PID hosting | .cache checkout is web/Prodigi; different deploy target |
| Discord bot | Add only if .cache needs it; store bot is enough for v1 |
| OpenCode hard dependency | Can swap for Eliza tool loop + worker; keep phase interface |
| Nine phases on day one | Start with 3: **preflight → scaffold → ship**; expand |

---

## Implementation phases

### Phase 1 — Routing refactor (no builder yet)

- Extract `TelegramMessenger` + `withTelegramContext` from store bot.
- Move shop commands to `convex/shop/commands.ts`.
- Webhook file stays thin.

### Phase 2 — Schema + `/build` stub

- Add `builderSessions`, `builderJobs`, `builderRuns`.
- `/build` sets `phase=0`, prompts for description.
- Free text in build phase echoes spec back (no pipeline).

### Phase 3 — Worker + progress

- Deploy builder-worker with 3 phases.
- Convex HTTP callbacks update runs + Telegram progress.
- `/status` reads `builderRuns`.

### Phase 4 — Store bridge

- On `ready` + `jobKind=product-draft`, auto-insert `capabilityProposals` (pending).
- Staff UI shows builder provenance on product `provenance.runId`.

### Phase 5 — Provisioner link

- `jobKind=capability-install` drives `platform/provisioner/provisioner.ts` with Convex `ProvisioningStore` adapter.

---

## File reference

### bot-foundry (source)

| Concern | Path |
| --- | --- |
| Boot | `src/index.ts` |
| Session CRUD + persist | `src/bot/types.ts`, `src/bot/persist.ts` |
| Identity | `src/identity/user-key.ts`, `src/identity/link.ts` |
| Telegram adapter | `src/bot/telegram.ts`, `src/bot/handlers/with-telegram.ts` |
| Messenger | `src/bot/platform/telegram-messenger.ts`, `src/bot/platform/types.ts` |
| Core logic | `src/bot/core/message-handler.ts`, `src/bot/core/commands.ts` |
| Pipeline | `src/pipeline/orchestrator.ts`, `src/pipeline/phases/*.ts` |
| OpenCode workspace | `src/opencode/session.ts`, `src/opencode/client.ts` |
| Deploy guides | `src/bot/deploy-guides.ts` |
| Local host (reference only) | `src/deploy/runner.ts` |

### .cache (integration targets)

| Concern | Path |
| --- | --- |
| Schema | `convex/schema.ts` |
| Store bot | `convex/telegramStoreBot.ts` |
| Sessions | `convex/telegramSessions.ts` |
| Webhooks | `convex/telegramWebhook.ts`, `convex/http.ts` |
| Eliza | `convex/lib/elizaCloudChat.ts` |
| Capability API | `convex/capabilityHttp.ts`, `platform/capabilities/cachebar/` |
| Provisioner | `platform/provisioner/provisioner.ts` |
| Launch demo | `convex/foundryDemo.ts`, `src/pages/Launchpad.tsx` |
| Existing foundry blueprint | `docs/agent-foundry-blueprint.md` (onchain launch — orthogonal to Telegram builder) |

---

## One-paragraph summary

.cache should keep its Convex store and proposal-only safety model, but adopt Foundry’s **messenger → core → orchestrator** Telegram routing and a **richer builder session** than `mode`/`cart`. The “makes a whole program” flow belongs in a **sidecar worker** (or Eliza-backed equivalent) that reports into `builderRuns` and feeds the store through **`capabilityProposals`** — not direct catalog writes. Shop Telegram stays a shop; builder commands are an additive mode gated by `builderSessions.phase`.
