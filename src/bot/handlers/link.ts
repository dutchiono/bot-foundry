import type { BotFoundryContext } from '../types.js'
import type { PipelineOrchestrator } from '../../pipeline/orchestrator.js'
import { runLinkCommand } from '../core/commands.js'
import { withTelegramMessenger } from './with-telegram.js'

export function registerLinkCommand(getOrchestrator: () => PipelineOrchestrator) {
  return async (ctx: BotFoundryContext) => {
    const rawText = ctx.message && 'text' in ctx.message ? ctx.message.text : ''
    const args = rawText.replace(/^\/link\s*/i, '').trim()

    await withTelegramMessenger(ctx, getOrchestrator, (messenger) =>
      runLinkCommand(messenger, args),
    )
  }
}
