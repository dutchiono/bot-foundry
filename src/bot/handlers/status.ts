import type { BotFoundryContext } from '../types.js'
import { getUserSession, getBot, updateBot } from '../types.js'
import type { PipelineOrchestrator } from '../../pipeline/orchestrator.js'

export function registerStatusCommand(
  getOrchestrator: () => PipelineOrchestrator,
) {
  return async (ctx: BotFoundryContext) => {
    const telegramId = ctx.from?.id
    if (!telegramId) return

    const userSession = getUserSession(telegramId)
    const botId = userSession.activeBotId
    const runId = userSession.pipelineRunId

    let message = ''

    if (runId) {
      const state = getOrchestrator().getState(runId)
      if (state) {
        message = `*Pipeline Status*
Bot: ${state.botId}
Phase: ${state.currentPhase} (${state.phaseName})
Status: ${state.status}
Started: ${state.startedAt}
${state.error ? `\nError: ${state.error}` : ''}
${state.data.pendingInputPrompt ? `\n⏳ Awaiting your input` : ''}

*Phase Breakdown:*
${state.phases.map((p, i) => {
  const icon = p.status === 'completed' ? '✅' : p.status === 'running' ? '🔄' : p.status === 'failed' ? '❌' : '⬜'
  return `${icon} Phase ${p.number}: ${p.name} (${p.status})`
}).join('\n')}`
      } else {
        message = 'No active pipeline run.'
      }
    } else if (botId) {
      const bot = getBot(botId)
      message = bot
        ? `*Bot*: ${bot.name}\n*Status*: ${bot.status}\n*Description*: ${bot.description}`
        : 'Bot not found.'
    } else {
      message = 'No active bot. Use /newbot to create one.'
    }

    await ctx.reply(message, { parse_mode: 'Markdown' })
  }
}
