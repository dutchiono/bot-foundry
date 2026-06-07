# Bot Foundry 🤖

**A Telegram bot that builds other Telegram bots — powered by [OpenCode](https://opencode.ai).**

Describe a bot in plain English and Bot Foundry runs a 9-phase pipeline (Preflight → Research → Scaffold → Enrich → Regenerate → Review → Agent Readiness → Comparative → Ship) to produce a production-ready Telegram bot with full CI/CD.

**Pipeline troubleshooting & architecture:** [docs/orchestrator-fixes.md](docs/orchestrator-fixes.md)

**Foundry agent launch (waifu.fun):** [docs/foundry-brand.md](docs/foundry-brand.md) · [website](website/index.html) · [imagery brief](docs/foundry-imagery-brief.md)

## Quick Start

```bash
# 1. Start OpenCode server
opencode serve --port 4097

# 2. Clone and configure
git clone https://github.com/Dexploarer/bot-foundry
cd bot-foundry
cp .env.example .env
# Edit .env → set your BOT_TOKEN from @BotFather

# 3. Run
npm install
npm run dev
```

## Docker

```bash
# Build and run with OpenCode sidecar
docker compose up -d

# Or build standalone
docker build -t bot-foundry .
docker run -e BOT_TOKEN=your_token bot-foundry
```

## Production Deploy

### VPS (Ubuntu/Debian)

```bash
ssh your-server
git clone https://github.com/Dexploarer/bot-foundry /opt/bot-foundry
cd /opt/bot-foundry
cp .env.example .env
# Edit .env with production values
docker compose up -d
```

### GitHub Actions (recommended)

Push a tag to trigger the release pipeline:

```bash
git tag v0.1.0
git push origin v0.1.0
```

This builds and pushes a Docker image to `ghcr.io`, then you can deploy via the Deploy workflow.

### Required Secrets (for CI/CD)

| Secret | Description |
|--------|-------------|
| `BOT_TOKEN` | Telegram bot token from @BotFather |
| `OPENCODE_SERVER_PASSWORD` | Password for OpenCode server auth |
| `DEPLOY_HOST` | Your VPS hostname/IP |
| `DEPLOY_USER` | SSH user (usually `root`) |
| `DEPLOY_SSH_KEY` | SSH private key for deploy access |

## Architecture

```
User → Telegram → Bot Foundry (Node.js + Telegraf)
                       ↓
              OpenCode SDK (opencode serve)
                       ↓
              9-Phase Pipeline
    ┌──────────────────────────────────┐
    │ 0. Preflight   — Validate specs  │
    │ 1. Research    — Market analysis │
    │ 2. Scaffold    — Generate code   │
    │ 3. Enrich      — Find gaps       │
    │ 4. Regenerate  — Apply fixes     │
    │ 5. Review      — Lint & audit    │
    │ 6. Readiness   — AI score        │
    │ 7. Compare     — Benchmark       │
    │ 8. Ship        — Deploy artifacts│
    └──────────────────────────────────┘
                       ↓
            Production ready bot 🚀
```

## Commands

- `/newbot` — Create a new Telegram bot
- `/deploy` — Deploy your finished bot
- `/status` — Check pipeline progress
- `/opencode` — View OpenCode server status
- `/help` — Show help

## Development

```bash
npm run dev          # Watch mode
npm run typecheck    # TypeScript check
npm run test         # Run tests
npm run build        # Production build
npm run ci           # Full CI pipeline locally
```

## How It Works

Bot Foundry prints the Printing Press methodology — a rigorous multi-phase pipeline originally used to generate Go CLIs from API specs — applied to Telegram bot generation. Each phase uses OpenCode's AI to:

1. **Preflight**: Validate the user's bot specification, score readiness
2. **Research**: Analyze existing bots, score novelty
3. **Scaffold**: Generate complete bot code via OpenCode prompts
4. **Enrich**: Identify missing features, UX issues, security gaps
5. **Regenerate**: Apply enrichments without breaking existing code
6. **Review**: Run TypeScript compile check + AI code audit
7. **Agent Readiness**: Score for AI maintainability (6 axes)
8. **Comparative**: Compare vs alternatives on 6 dimensions (0-100)
9. **Ship**: Generate Dockerfile, CI/CD, deployment docs

## License

MIT
