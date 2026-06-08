import {
  getUserSession,
  updateUserSession,
  getBot,
  listBotsForUser,
  issueLinkCode,
  applyLinkCode,
  getBotsMap,
} from '../types.js'
import { findLatestReadyBotForUser } from '../persist.js'
import { findLatestWorkspaceDir } from '../handlers/deploy.js'
import { deployMenuText } from '../deploy-guides.js'
import { escapeMarkdown } from '../format.js'
import { stopAllLocalBots, stopLocalBot } from '../../deploy/runner.js'
import type { FoundryMessenger } from '../platform/types.js'
import type { PipelineOrchestrator } from '../../pipeline/orchestrator.js'
import type { OpenCodeClient } from '../../opencode/client.js'

export async function runNewBotCommand(messenger: FoundryMessenger): Promise<void> {
  const userSession = getUserSession(messenger.userKey)
  userSession.phase = 0

  await messenger.reply(
    `*New order.*

Describe the bot — what it does, key features, any APIs, TypeScript or Python.

Example: _"Price alert bot. Lookup, alerts. CoinGecko. TypeScript."_

Send it when ready.`,
  )
}

export async function runDeployCommand(messenger: FoundryMessenger): Promise<void> {
  try {
    const userSession = getUserSession(messenger.userKey)
    let bot = userSession.activeBotId ? getBot(userSession.activeBotId) : undefined

    if (userSession.activeBotId && !bot) {
      updateUserSession(messenger.userKey, { activeBotId: undefined })
    }

    if (!bot) {
      const recovered = findLatestReadyBotForUser(getBotsMap(), messenger.userKey)
      if (recovered?.id && recovered.name) {
        updateUserSession(messenger.userKey, { activeBotId: recovered.id, phase: 9 })
        bot = recovered
        await messenger.reply(`♻️ Recovered *${escapeMarkdown(recovered.name)}* from saved state.`)
      }
    }

    if (!bot) {
      const wsDir = findLatestWorkspaceDir()
      if (wsDir) {
        updateUserSession(messenger.userKey, {
          awaitingDeployChoice: true,
          workspaceDir: wsDir,
          phase: 9,
        })
        await messenger.reply(
          `No session in memory (server likely restarted), but your code is still on disk:\n\`${escapeMarkdown(wsDir)}\`\n\nReply \`windows\`, \`mac\`, \`linux\`, or \`docker\` for run instructions.`,
        )
        return
      }
      await messenger.reply('No active bot. Use /newbot to create one first.')
      return
    }

    if (bot.status !== 'ready') {
      await messenger.reply(`Bot is still in "${bot.status}" phase. Complete the pipeline first. Check status with /status`)
      return
    }

    updateUserSession(messenger.userKey, { awaitingDeployChoice: true, phase: 9 })
    await messenger.reply(deployMenuText(bot.name))
  } catch (err) {
    console.error('[deploy]', err)
    await messenger.reply('❌ Deploy failed. Try /status or /newbot.')
  }
}

export async function runStatusCommand(
  messenger: FoundryMessenger,
  getOrchestrator: () => PipelineOrchestrator,
): Promise<void> {
  const userSession = getUserSession(messenger.userKey)
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
${state.phases.map((p) => {
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

  await messenger.reply(message)
}

export async function runStopBotCommand(messenger: FoundryMessenger): Promise<void> {
  const userSession = getUserSession(messenger.userKey)
  const ws = userSession.workspaceDir ?? findLatestWorkspaceDir()
  if (ws && await stopLocalBot(ws)) {
    await messenger.reply('🛑 Stopped your hosted bot.')
    return
  }

  const n = await stopAllLocalBots()
  if (n > 0) {
    await messenger.reply(`🛑 Stopped ${n} hosted bot process(es).`)
    return
  }

  await messenger.reply('No hosted bots are running.')
}

export async function runOpenCodeCommand(
  messenger: FoundryMessenger,
  getOC: () => OpenCodeClient,
): Promise<void> {
  const oc = getOC()
  const sessions = await oc.listSessions()
  const health = await oc.healthCheck()
  const agents = await oc.listAgents()

  const sessionList = sessions.slice(0, 5).map(s =>
    `  - ${(s.id ?? '').slice(0, 8)}... | ${s.title || 'Untitled'}`,
  ).join('\n')

  const message = [
    '*OpenCode Server Status*',
    health ? '🟢 Connected' : '🔴 Disconnected',
    '',
    '*Active Sessions*: ' + sessions.length,
    sessionList,
    '',
    '*Agents Available*:',
    '  ' + agents.join(', '),
  ].join('\n')

  await messenger.reply(message)
}

export async function runLinkCommand(messenger: FoundryMessenger, args: string): Promise<void> {
  const trimmed = args.trim()
  if (!trimmed) {
    const issued = issueLinkCode(messenger.userKey)
    if (!issued.ok) {
      await messenger.reply(`❌ ${issued.error}`)
      return
    }
    await messenger.reply(
      `🔗 *Link your accounts*

Your code: \`${issued.code}\`

On your *other* platform (Telegram or Discord), run:
\`/link ${issued.code}\`

Codes expire in 10 minutes. After linking, your bots and pipeline progress are shared.`,
    )
    return
  }

  const result = applyLinkCode(trimmed, messenger.userKey)
  if (!result.ok) {
    await messenger.reply(`❌ ${result.error}`)
    return
  }

  await messenger.reply(
    `✅ Accounts linked! Your session is now shared across platforms.

Active bots: ${listBotsForUser(messenger.userKey).length}
Use /status to pick up where you left off.`,
  )
}
