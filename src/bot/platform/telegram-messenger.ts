import type { BotFoundryContext } from '../types.js'
import type { BotDefinition, UserSession } from '../../types/index.js'
import type { PipelineOrchestrator } from '../../pipeline/orchestrator.js'
import type { PipelineState } from '../../pipeline/state.js'
import { updateUserSession } from '../types.js'
import { escapeMarkdown, formatPipelineProgress } from '../format.js'
import type { FoundryMessenger } from './types.js'

export function createTelegramMessenger(
  ctx: BotFoundryContext,
  userKey: string,
  displayName: string,
  getOrchestrator: () => PipelineOrchestrator,
): FoundryMessenger {
  const chatId = ctx.chat?.id

  const messenger: FoundryMessenger = {
    userKey,
    platform: 'telegram',
    displayName,
    async reply(text, options) {
      await ctx.reply(text, options?.markdown === false ? {} : { parse_mode: 'Markdown' })
    },
    async setupProgress(bot, userSession, orchestrator, initialLine, options) {
      if (!chatId) return

      const state = userSession.pipelineRunId
        ? orchestrator.getState(userSession.pipelineRunId)
        : undefined

      const forceNew = options?.newMessage === true
      let messageId = forceNew ? undefined : userSession.progressChannel?.messageId as number | undefined
        ?? userSession.progressMessageId

      if (!messageId) {
        const statusMsg = await ctx.reply(
          formatPipelineProgress(bot, state, initialLine),
          { parse_mode: 'Markdown' },
        )
        messageId = statusMsg.message_id
        updateUserSession(userKey, {
          progressChannel: { platform: 'telegram', chatId, messageId },
          progressChatId: chatId,
          progressMessageId: messageId,
        })
      } else {
        await ctx.telegram
          .editMessageText(
            chatId,
            messageId,
            undefined,
            formatPipelineProgress(bot, state, initialLine),
            { parse_mode: 'Markdown' },
          )
          .catch(() => {})
      }

      registerTelegramProgressSink(ctx, userKey, chatId, messageId, bot, userSession, orchestrator, getOrchestrator)
    },
    async editProgress(bot, state, line, userSession) {
      if (!chatId) return
      const channel = userSession.progressChannel
      const targetChat = (channel?.chatId as number) ?? chatId
      const targetMsg = (channel?.messageId as number) ?? userSession.progressMessageId
      if (!targetMsg) return
      await ctx.telegram
        .editMessageText(targetChat, targetMsg, undefined, formatPipelineProgress(bot, state, line), { parse_mode: 'Markdown' })
        .catch(() => {})
    },
  }

  return messenger
}

function registerTelegramProgressSink(
  ctx: BotFoundryContext,
  userKey: string,
  chatId: number,
  messageId: number,
  bot: BotDefinition,
  userSession: UserSession,
  orchestrator: PipelineOrchestrator,
  getOrchestrator: () => PipelineOrchestrator,
): void {
  orchestrator.unregisterProgressSink(bot.id)
  orchestrator.registerProgressSink(bot.id, async (message) => {
    const currentState = userSession.pipelineRunId
      ? getOrchestrator().getState(userSession.pipelineRunId)
      : undefined
    const text = formatPipelineProgress(bot, currentState, message)
    const channel = userSession.progressChannel
    const targetChat = (channel?.chatId as number) ?? chatId
    const targetMsg = (channel?.messageId as number) ?? messageId
    await ctx.telegram
      .editMessageText(targetChat, targetMsg, undefined, text, { parse_mode: 'Markdown' })
      .catch((err: unknown) => {
        const detail = err instanceof Error ? err.message : String(err)
        if (!detail.includes('message is not modified')) {
          console.error('[telegram-progress]', detail)
        }
      })
  })
}

export function formatTelegramPipelineState(state: PipelineState | undefined): string {
  return state ? formatPipelineProgress({ id: state.botId, name: state.botId } as BotDefinition, state, '') : ''
}
