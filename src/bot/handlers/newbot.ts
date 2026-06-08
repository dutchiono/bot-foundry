import type { BotFoundryContext } from '../types.js'
import type { PipelineOrchestrator } from '../../pipeline/orchestrator.js'
import type { OpenCodeClient } from '../../opencode/client.js'
import { runNewBotCommand } from '../core/commands.js'
import { withTelegramMessenger } from './with-telegram.js'

export function registerNewBotCommand(
  getOrchestrator: () => PipelineOrchestrator,
  _getOC: () => OpenCodeClient,
) {
  return async (ctx: BotFoundryContext) => {
    await withTelegramMessenger(ctx, getOrchestrator, runNewBotCommand)
  }
}
