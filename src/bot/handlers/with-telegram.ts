import type { BotFoundryContext } from '../types.js'
import { getUserSessionForPlatform } from '../types.js'
import type { PipelineOrchestrator } from '../../pipeline/orchestrator.js'
import { createTelegramMessenger } from '../platform/telegram-messenger.js'
import type { FoundryMessenger } from '../platform/types.js'

export async function withTelegramMessenger(
  ctx: BotFoundryContext,
  getOrchestrator: () => PipelineOrchestrator,
  fn: (messenger: FoundryMessenger) => Promise<void>,
): Promise<void> {
  const telegramId = ctx.from?.id
  if (!telegramId) return

  const userSession = getUserSessionForPlatform('telegram', telegramId)
  if (!userSession.userKey) return

  const messenger = createTelegramMessenger(
    ctx,
    userSession.userKey,
    ctx.from?.first_name ?? 'friend',
    getOrchestrator,
  )

  try {
    await fn(messenger)
  } catch (err) {
    console.error('[telegram]', err)
    await messenger.reply('❌ Something went wrong. Try again.', { markdown: false }).catch(() => {})
  }
}
