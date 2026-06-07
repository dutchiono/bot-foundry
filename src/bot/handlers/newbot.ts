import type { BotFoundryContext } from '../types.js'
import { getUserSession, createBotDefinition, updateUserSession, getBot, updateBot } from '../types.js'
import type { PipelineOrchestrator } from '../../pipeline/orchestrator.js'
import type { OpenCodeClient } from '../../opencode/client.js'

export function registerNewBotCommand(
  getOrchestrator: () => PipelineOrchestrator,
  getOC: () => OpenCodeClient,
) {
  return async (ctx: BotFoundryContext) => {
    const telegramId = ctx.from?.id
    if (!telegramId) return

    const userSession = getUserSession(telegramId)
    userSession.phase = 0

    await ctx.reply(
      `🧠 *Bot Foundry* — Let's build a Telegram bot!

Tell me about the bot you want to create. Describe:

1. *What it does* — its purpose in one sentence
2. *Key features* — what users can do with it
3. *External APIs* — any services it needs to talk to (optional)
4. *Language preference* — TypeScript (default) or Python

Example:
_"A bot that tracks cryptocurrency prices and alerts me when BTC moves more than 5%. Features: price lookup, price alerts, portfolio tracking. APIs: CoinGecko, Binance. TypeScript."_

Send me your description and I'll start building!`,
      { parse_mode: 'Markdown' }
    )
  }
}
