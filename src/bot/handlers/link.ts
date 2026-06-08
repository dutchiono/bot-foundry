import type { BotFoundryContext } from '../types.js'
import { getUserSessionForPlatform } from '../types.js'
import type { PipelineOrchestrator } from '../../pipeline/orchestrator.js'
import { createTelegramMessenger } from '../platform/telegram-messenger.js'
import { runLinkCommand } from '../core/commands.js'

export function registerLinkCommand(getOrchestrator: () => PipelineOrchestrator) {
  return async (ctx: BotFoundryContext) => {
    const telegramId = ctx.from?.id
    if (!telegramId) return

    const rawText = ctx.message && 'text' in ctx.message ? ctx.message.text : ''
    const args = rawText.replace(/^\/link\s*/i, '').trim()

    const userSession = getUserSessionForPlatform('telegram', telegramId)
    const messenger = createTelegramMessenger(
      ctx,
      userSession.userKey,
      ctx.from?.first_name ?? 'friend',
      getOrchestrator,
    )
    await runLinkCommand(messenger, args)
  }
}
