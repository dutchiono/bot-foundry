import type { BotFoundryContext } from '../types.js'
import { getUserSessionForPlatform } from '../types.js'
import { createTelegramMessenger } from '../platform/telegram-messenger.js'
import { runStopBotCommand } from '../core/commands.js'
import type { PipelineOrchestrator } from '../../pipeline/orchestrator.js'

export function registerStopBotCommand(getOrchestrator: () => PipelineOrchestrator) {
  return async (ctx: BotFoundryContext) => {
    const telegramId = ctx.from?.id
    if (!telegramId) return

    const userSession = getUserSessionForPlatform('telegram', telegramId)
    const messenger = createTelegramMessenger(
      ctx,
      userSession.userKey,
      ctx.from?.first_name ?? 'friend',
      getOrchestrator,
    )
    await runStopBotCommand(messenger)
  }
}
