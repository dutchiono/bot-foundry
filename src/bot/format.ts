import type { BotDefinition } from '../types/index.js'
import type { PipelineState } from '../pipeline/state.js'

/** Escape dynamic text for Telegram legacy Markdown parse_mode. */
export function escapeMarkdown(text: string): string {
  return text.replace(/([_*`\[])/g, '\\$1')
}

function formatElapsed(startedAt?: string): string {
  if (!startedAt) return ''
  const secs = Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000))
  if (secs < 60) return `${secs}s`
  return `${Math.floor(secs / 60)}m ${secs % 60}s`
}

export function formatPipelineProgress(
  bot: BotDefinition,
  state: PipelineState | undefined,
  latestLine: string,
): string {
  const lines = [
    '🔄 *Building your bot*',
    '',
    `*Name*: ${escapeMarkdown(bot.name)}`,
    `*Now*: ${escapeMarkdown(latestLine)}`,
  ]

  if (state) {
    const running = state.phases.find(p => p.status === 'running')
    if (running) {
      lines.push(`*Phase timer*: ${formatElapsed(running.startedAt)} on ${escapeMarkdown(running.name)}`)
    }

    lines.push('', '*Phases*:')
    for (const phase of state.phases) {
      const icon =
        phase.status === 'completed'
          ? '✅'
          : phase.status === 'running'
            ? '🔄'
            : phase.status === 'failed'
              ? '❌'
              : '⬜'
      lines.push(`${icon} ${phase.number}. ${escapeMarkdown(phase.name)}`)
    }

    const activity = (state.data.activityLog as string[] | undefined) ?? []
    if (activity.length) {
      lines.push('', '*Activity*:')
      for (const entry of activity.slice(-6)) {
        lines.push(`• ${escapeMarkdown(entry)}`)
      }
    }
  }

  return lines.join('\n')
}
