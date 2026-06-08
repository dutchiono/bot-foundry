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
      `*FOUNDRY* — Bot Works No. 7

${name}, you bring the orders. She runs the line.

/newbot — describe a bot
/deploy — ship it
/status — line progress
/stopbot — stop local host
/link — tie Discord session
/help — commands`,
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
      `*Foundry — the line*

/newbot — new order
/deploy — deploy menu
/status — where the run is
/stopbot — kill local child bot
/link — share session with Discord
/opencode — server check
/help — this${eliza}

*Phases:* 0 preflight → 8 ship`,
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
