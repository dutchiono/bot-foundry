import type { BotFoundryContext } from '../types.js'
import { getUserSession, getBot } from '../types.js'
import type { PipelineOrchestrator } from '../../pipeline/orchestrator.js'
import type { OpenCodeClient } from '../../opencode/client.js'

export function registerOpenCodeCommand(
  getOrchestrator: () => PipelineOrchestrator,
  getOC: () => OpenCodeClient,
) {
  return async (ctx: BotFoundryContext) => {
    const telegramId = ctx.from?.id
    if (!telegramId) return

    const oc = getOC()
    const sessions = await oc.listSessions()
    const health = await oc.healthCheck()
    const agents = await oc.listAgents()

    const sessionList = sessions.slice(0, 5).map(s =>
      `  - ${(s.id ?? '').slice(0, 8)}... | ${s.title || 'Untitled'}`
    ).join('\n')

    const message = [
      '*OpenCode Server Status*',
      health ? '🟢 Connected' : '🔴 Disconnected',
      'Server: ' + ((oc as any).config?.baseUrl ?? 'unknown'),
      '',
      '*Active Sessions*: ' + sessions.length,
      sessionList,
      '',
      '*Agents Available*:',
      '  ' + agents.join(', '),
      '',
      'Use this bot to:',
      'Create OpenCode sessions right from Telegram',
      'Get AI-powered code assistance through the attached pipeline session',
      'Run commands, read files, and browse the codebase',
      '',
      'OpenCode exposes a full REST API via `opencode serve` and the SDK lets us drive it programmatically.',
    ].join('\n')

    await ctx.reply(message, { parse_mode: 'Markdown' })
  }
}
