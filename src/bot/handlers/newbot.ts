import type { BotFoundryContext } from '../types.js'
import { getUserSessionForPlatform } from '../types.js'
import type { PipelineOrchestrator } from '../../pipeline/orchestrator.js'
import type { OpenCodeClient } from '../../opencode/client.js'
import { createTelegramMessenger } from '../platform/telegram-messenger.js'
import { runNewBotCommand } from '../core/commands.js'

export function registerNewBotCommand(
  getOrchestrator: () => PipelineOrchestrator,
  _getOC: () => OpenCodeClient,
) {
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
    await runNewBotCommand(messenger)
  }
}
