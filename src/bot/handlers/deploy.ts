import type { BotFoundryContext } from '../types.js'
import { getUserSession, getBot } from '../types.js'
import type { PipelineOrchestrator } from '../../pipeline/orchestrator.js'
import type { OpenCodeClient } from '../../opencode/client.js'

export function registerDeployCommand(
  getOrchestrator: () => PipelineOrchestrator,
  getOC: () => OpenCodeClient,
) {
  return async (ctx: BotFoundryContext) => {
    const telegramId = ctx.from?.id
    if (!telegramId) return

    const userSession = getUserSession(telegramId)
    if (!userSession.activeBotId) {
      await ctx.reply('No active bot. Use /newbot to create one first.')
      return
    }

    const bot = getBot(userSession.activeBotId)
    if (!bot) {
      await ctx.reply('Bot not found. Start again with /newbot.')
      return
    }

    if (bot.status !== 'ready') {
      await ctx.reply(`Bot is still in "${bot.status}" phase. Complete the pipeline first. Check status with /status`)
      return
    }

    await ctx.reply(
      `🚀 *Ready to deploy*: ${bot.name}

Deployment options:
1. *Docker* — Build a Docker image, run anywhere
2. *Fly.io* — Deploy to Fly.io (free tier available)
3. *Railway* — Deploy to Railway (easy, free tier)
4. *Self-hosted* — Get deploy script for your VPS

Which deployment method do you prefer? (reply with 1, 2, 3, or 4)`,
      { parse_mode: 'Markdown' }
    )
  }
}
