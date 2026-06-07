import type { BotFoundryContext } from '../types.js'
import { getUserSession } from '../types.js'
import { listRunningBots, stopLocalBot } from '../../deploy/runner.js'
import { findLatestWorkspaceDir } from './deploy.js'

export function registerStopBotCommand() {
  return async (ctx: BotFoundryContext) => {
    const telegramId = ctx.from?.id
    if (!telegramId) return

    const userSession = getUserSession(telegramId)
    const ws = userSession.workspaceDir ?? findLatestWorkspaceDir()
    const running = listRunningBots()

    if (ws && await stopLocalBot(ws)) {
      await ctx.reply('🛑 Stopped your hosted bot.')
      return
    }

    if (running.length > 0) {
      for (const bot of running) {
        await stopLocalBot(bot.workspaceDir)
      }
      await ctx.reply(`🛑 Stopped ${running.length} hosted bot(s).`)
      return
    }

    await ctx.reply('No hosted bots are running.')
  }
}
