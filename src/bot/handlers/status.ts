import type { BotFoundryContext } from '../types.js'
import type { PipelineOrchestrator } from '../../pipeline/orchestrator.js'
import { runStatusCommand } from '../core/commands.js'
import { withTelegramMessenger } from './with-telegram.js'

export function registerStatusCommand(
  getOrchestrator: () => PipelineOrchestrator,
) {
  return async (ctx: BotFoundryContext) => {
    await withTelegramMessenger(ctx, getOrchestrator, (messenger) =>
      runStatusCommand(messenger, getOrchestrator),
    )
  }
}
