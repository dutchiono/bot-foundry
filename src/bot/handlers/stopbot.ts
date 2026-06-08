import type { BotFoundryContext } from '../types.js'
import type { PipelineOrchestrator } from '../../pipeline/orchestrator.js'
import { runStopBotCommand } from '../core/commands.js'
import { withTelegramMessenger } from './with-telegram.js'

export function registerStopBotCommand(getOrchestrator: () => PipelineOrchestrator) {
  return async (ctx: BotFoundryContext) => {
    await withTelegramMessenger(ctx, getOrchestrator, runStopBotCommand)
  }
}
