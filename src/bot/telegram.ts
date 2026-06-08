import { Telegraf } from 'telegraf'
import type { BotFoundryContext } from './types.js'
import { registerNewBotCommand } from './handlers/newbot.js'
import { registerDeployCommand } from './handlers/deploy.js'
import { registerStatusCommand } from './handlers/status.js'
import { registerOpenCodeCommand } from './handlers/opencode.js'
import { registerChatHandler } from './handlers/chat.js'
import { registerStopBotCommand } from './handlers/stopbot.js'
import { registerLinkCommand } from './handlers/link.js'
import type { PipelineOrchestrator } from '../pipeline/orchestrator.js'
import type { OpenCodeClient } from '../opencode/client.js'
import { isElizaCloudEnabled } from '../integrations/eliza-cloud.js'
import { escapeMarkdown } from './format.js'

export function createTelegramBot(
  token: string,
  getOrchestrator: () => PipelineOrchestrator,
  getOC: () => OpenCodeClient,
): Telegraf {
  const bot = new Telegraf<BotFoundryContext>(token)

  bot.start(async (ctx) => {
    const name = escapeMarkdown(ctx.from?.first_name || 'friend')
    await ctx.reply(
      `👋 Welcome to *Bot Foundry*, ${name}!

I'm a bot factory that builds Telegram bots — powered by OpenCode.

*Commands:*
/newbot — Create a new Telegram bot
/deploy — Deploy your finished bot
/stopbot — Stop a hosted bot on this machine
/status — Check pipeline progress
/link — Link Telegram + Discord accounts
/opencode — OpenCode server status
/help — Show this message

*Cross-platform:* run /link here, then /link CODE on Discord to share progress.

Let's build something! 🚀`,
      { parse_mode: 'Markdown' },
    )
  })

  bot.command('newbot', registerNewBotCommand(getOrchestrator, getOC))
  bot.command('deploy', registerDeployCommand(getOrchestrator, getOC))
  bot.command('stopbot', registerStopBotCommand(getOrchestrator))
  bot.command('status', registerStatusCommand(getOrchestrator))
  bot.command('opencode', registerOpenCodeCommand(getOrchestrator, getOC))
  bot.command('link', registerLinkCommand(getOrchestrator))

  bot.help(async (ctx) => {
    const eliza = isElizaCloudEnabled() ? '\n🧠 Eliza Cloud memory: connected' : ''
    await ctx.reply(
      `*Bot Foundry Help*

/newbot — Start creating a new Telegram bot
/deploy — Deploy your finished bot to production
/stopbot — Stop locally hosted child bots
/status — Check current pipeline or bot status
/link — Share session with Discord
/opencode — View OpenCode server connection info
/help — This message${eliza}

*Phase Pipeline:*
0️⃣ Preflight — Validate your bot spec
1️⃣ Research — Analyze existing bots & market
2️⃣ Scaffold — Generate the bot code
3️⃣ Enrich — Identify improvements
4️⃣ Regenerate — Apply improvements
5️⃣ Review — Lint, typecheck, test
6️⃣ Agent Readiness — Score for AI maintainability
7️⃣ Comparative — Compare with alternatives
8️⃣ Ship — Generate deployment artifacts`,
      { parse_mode: 'Markdown' },
    )
  })

  bot.on('text', registerChatHandler(getOrchestrator, getOC))

  bot.catch((err, ctx) => {
    console.error('Telegraf error:', err)
    ctx.reply('❌ Something went wrong. Try /newbot again.').catch(() => {})
  })

  return bot
}

/** @deprecated use createTelegramBot */
export const createBot = createTelegramBot
