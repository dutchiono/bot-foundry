import type { BotFoundryContext } from '../types.js'
import type { PipelineOrchestrator } from '../../pipeline/orchestrator.js'
import type { OpenCodeClient } from '../../opencode/client.js'
import { handleFoundryMessage } from '../core/message-handler.js'
import { withTelegramMessenger } from './with-telegram.js'

export function registerChatHandler(
  getOrchestrator: () => PipelineOrchestrator,
  getOC: () => OpenCodeClient,
) {
  return async (ctx: BotFoundryContext) => {
    const rawText = ctx.message && 'text' in ctx.message ? ctx.message.text : ''
    if (!rawText) return

    await withTelegramMessenger(ctx, getOrchestrator, async (messenger) => {
      await handleFoundryMessage(messenger, rawText, getOrchestrator, getOC)
    })
  }
}
