import { Telegraf } from 'telegraf'
import type { BotFoundryContext } from './types.js'
import { registerNewBotCommand } from './handlers/newbot.js'
import { registerDeployCommand } from './handlers/deploy.js'
import { registerStatusCommand } from './handlers/status.js'
import { registerOpenCodeCommand } from './handlers/opencode.js'
import { registerChatHandler } from './handlers/chat.js'
import { registerStopBotCommand } from './handlers/stopbot.js'
import type { PipelineOrchestrator } from '../pipeline/orchestrator.js'
import type { OpenCodeClient } from '../opencode/client.js'

export function createBot(
  token: string,
  getOrchestrator: () => PipelineOrchestrator,
  getOC: () => OpenCodeClient,
): Telegraf {
  const bot = new Telegraf<BotFoundryContext>(token)

  bot.start(async (ctx) => {
    const name = ctx.from?.first_name || 'friend'
    await ctx.reply(
      `👋 Welcome to *Bot Foundry*, ${name}!

I'm a Telegram bot that builds other Telegram bots — powered by OpenCode.

*Commands:*
/newbot — Create a new Telegram bot
/deploy — Deploy your finished bot
/stopbot — Stop a hosted bot on this machine
/status — Check pipeline progress
/opencode — OpenCode server status
/help — Show this message

*How it works:*
1. Tell me what bot you want (describe it)
2. I spin up an *OpenCode* AI coding session
3. A 9-phase pipeline researches, scaffolds, reviews, and ships your bot
4. You get a deploy-ready Telegram bot

Let's build something! 🚀`,
      { parse_mode: 'Markdown' }
    )
  })

  bot.command('newbot', registerNewBotCommand(getOrchestrator, getOC))
  bot.command('deploy', registerDeployCommand(getOrchestrator, getOC))
  bot.command('stopbot', registerStopBotCommand())
  bot.command('status', registerStatusCommand(getOrchestrator))
  bot.command('opencode', registerOpenCodeCommand(getOrchestrator, getOC))

  bot.help(async (ctx) => {
    await ctx.reply(
      `*Bot Foundry Help*

/newbot — Start creating a new Telegram bot
/deploy — Deploy your finished bot to production
/status — Check current pipeline or bot status
/opencode — View OpenCode server connection info
/help — This message

*Phase Pipeline:*
0️⃣ Preflight — Validate your bot spec
1️⃣ Research — Analyze existing bots & market
2️⃣ Scaffold — Generate the bot code
3️⃣ Enrich — Identify improvements
4️⃣ Regenerate — Apply improvements
5️⃣ Review — Lint, typecheck, test
6️⃣ Agent Readiness — Score for AI maintainability
7️⃣ Comparative — Compare with alternatives
8️⃣ Ship — Generate deployment artifacts

Made with 🧠 + OpenCode SDK`,
      { parse_mode: 'Markdown' }
    )
  })

  bot.on('text', registerChatHandler(getOrchestrator, getOC))

  bot.catch((err, ctx) => {
    console.error('Telegraf error:', err)
    ctx.reply('❌ Something went wrong. Try /newbot again.').catch(() => {})
  })

  return bot
}
