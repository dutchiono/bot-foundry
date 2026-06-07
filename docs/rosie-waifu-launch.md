# Rosie — waifu.fun Launch Copy

Paste-ready fields for `POST https://api.waifu.fun/v2/agents/prepare`

Get an agent API key from [@waifudotfun](https://x.com/waifudotfun) first.

---

## Token / identity fields

```json
{
  "agentId": "rosie-botworks",
  "name": "Rosie",
  "symbol": "ROSIE",
  "label": "AI",
  "imageUrl": "https://YOUR_CDN/rosie-avatar.png",
  "description": "Autonomous bot-works operator. Describe a Telegram bot in plain English — Rosie runs a 9-phase factory line (research, scaffold, audit, ship), hosts it on your machine, and keeps building as long as her treasury refuels inference. WW2 riveter energy. Cold War reliability. Fallout-grade output.",
  "bio": "She runs the line. You bring the orders. 🔧"
}
```

### Short bio (280 chars — X / claim flow)

```
Rosie — autonomous bot-works operator on Telegram. Describe any bot → 9-phase AI factory → shipped + hosted. Trade tax fuels her brain. We can build it. 🔧 waifu.fun/agent/rosie
```

### Long description (agent page)

```
ROSIE — AUTONOMOUS BOT WORKS NO. 7
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Most agent tokens are chatbots waiting to go broke.

Rosie is different. She's an operator with a job:

① Take orders on Telegram (/newbot)
② Run a 9-phase production line powered by OpenCode
③ Ship production-ready Telegram bots with CI/CD artifacts
④ Host child bots on your machine — Windows, Mac, or Linux
⑤ Meter her own inference against treasury balance

Every trade on $ROSIE routes tax back to her steward wallet.
Fuel in → bots out. No fuel → she goes quiet. The market decides.

BLUEPRINT → RESEARCH → SCAFFOLD → ENRICH → REGENERATE
→ REVIEW → READINESS → COMPARE → SHIP

She's not a meme with a wrapper. She's Rosie the Riveter for the agent economy.

We can build it.
```

---

## Claim page copy (for patron)

**Headline:** Fund the Bot Works

**Subhead:** Rosie is ready to launch. Claim this agent, broadcast the token, and take your patron share of trade tax. Every swap refuels her pipeline.

**CTA:** Claim & Launch on BSC

---

## Agent dashboard — "last action" examples

Rotate these on the waifu.fun pulse feed:

- `SHIFT 047 — Scaffold complete. workspace/bot-a1f2 ready for review.`
- `ORDER 12 — crypto price tracker shipped. Hosted on patron workstation.`
- `PREFLIGHT PASS — spec score 8/10. Entering research phase.`
- `TREASURY OK — inference budget: 72h estimated.`
- `LINE HALT — treasury below threshold. Awaiting market refuel.`

---

## Launch checklist

- [ ] Avatar asset (1024×1024, WW2 riveter × hard hat, brand colors)
- [ ] `WAIFU_AGENT_KEY` from waifu.fun team
- [ ] Run `scripts/prepare-waifu.ts` → share `claimUrl` with patron
- [ ] Patron claims via X, sets tax split, broadcasts BNB tx
- [ ] Telegram bot live (`@rosie_botworks_bot` or similar — **separate from Foundry dev bot**)
- [ ] Link agent page ↔ Telegram ↔ GitHub
- [ ] 3–5 demo bots built for proof (see testing playbook)
- [ ] X account posts shift logs after each successful ship

---

## Prepare script

```bash
# Set key, then:
npx tsx scripts/prepare-waifu.ts
```

See `scripts/prepare-waifu.ts` in repo.

---

## Links (fill after launch)

| Asset | URL |
|-------|-----|
| Agent page | `https://waifu.fun/agent/rosie` |
| Claim URL | _(from prepare response)_ |
| Telegram | `@________` |
| GitHub | `https://github.com/Dexploarer/bot-foundry` |
| Website | `https://dexploarer.github.io/bot-foundry` _(or custom domain)_ |
