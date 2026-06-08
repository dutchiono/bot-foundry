import type { Message, TextBasedChannel } from 'discord.js'
import type { BotDefinition, UserSession } from '../../types/index.js'
import type { PipelineOrchestrator } from '../../pipeline/orchestrator.js'
import { updateUserSession } from '../types.js'
import { formatPipelineProgress } from '../format.js'
import type { FoundryMessenger } from './types.js'

/** Discord-safe text: strip Telegram-style markdown escapes */
function toDiscordText(text: string): string {
  return text
    .replace(/\\([_*`[\]()])/g, '$1')
    .replace(/\*([^*]+)\*/g, '**$1**')
}

export function createDiscordMessenger(
  message: Message,
  userKey: string,
  displayName: string,
  getOrchestrator: () => PipelineOrchestrator,
): FoundryMessenger {
  const channel = message.channel

  const messenger: FoundryMessenger = {
    userKey,
    platform: 'discord',
    displayName,
    async reply(text, options) {
      const body = options?.markdown === false ? text : toDiscordText(text)
      const textChannel = channel as TextBasedChannel
      if (!textChannel.isSendable()) return
      try {
        await textChannel.send(body)
      } catch (err) {
        console.error('[discord-reply]', err)
        throw err
      }
    },
    async setupProgress(bot, userSession, orchestrator, initialLine) {
      const textChannel = channel as TextBasedChannel
      if (!textChannel.isSendable()) return

      const state = userSession.pipelineRunId
        ? orchestrator.getState(userSession.pipelineRunId)
        : undefined

      let progressMsg: Message
      try {
        progressMsg = await textChannel.send(
          toDiscordText(formatPipelineProgress(bot, state, initialLine)),
        )
      } catch (err) {
        console.error('[discord-setup-progress]', err)
        return
      }

      updateUserSession(userKey, {
        progressChannel: {
          platform: 'discord',
          chatId: channel.id,
          messageId: progressMsg.id,
        },
      })

      registerDiscordProgressSink(progressMsg, userKey, bot, userSession, orchestrator, getOrchestrator)
    },
  }

  return messenger
}

function registerDiscordProgressSink(
  progressMsg: Message,
  userKey: string,
  bot: BotDefinition,
  userSession: UserSession,
  orchestrator: PipelineOrchestrator,
  getOrchestrator: () => PipelineOrchestrator,
): void {
  orchestrator.unregisterProgressSink(bot.id)
  orchestrator.registerProgressSink(bot.id, async (line) => {
    const currentState = userSession.pipelineRunId
      ? getOrchestrator().getState(userSession.pipelineRunId)
      : undefined
    const text = toDiscordText(formatPipelineProgress(bot, currentState, line))
    await progressMsg.edit(text).catch((err: unknown) => {
      console.error('[discord-progress]', err instanceof Error ? err.message : err)
    })
  })
}
