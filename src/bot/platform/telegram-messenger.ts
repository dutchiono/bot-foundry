import type { BotFoundryContext } from '../types.js'
import type { BotDefinition, UserSession } from '../../types/index.js'
import type { PipelineOrchestrator } from '../../pipeline/orchestrator.js'
import type { PipelineState } from '../../pipeline/state.js'
import { updateUserSession } from '../types.js'
import { escapeMarkdown, formatPipelineProgress } from '../format.js'
import type { FoundryMessenger } from './types.js'

function isMissingMessageError(err: unknown): boolean {
  const detail = err instanceof Error ? err.message : String(err)
  return detail.includes('message to edit not found')
    || detail.includes("message can't be edited")
    || detail.includes('MESSAGE_ID_INVALID')
}

async function editOrRecreateProgress(
  ctx: BotFoundryContext,
  userKey: string,
  chatId: number,
  messageId: number | undefined,
  text: string,
): Promise<number> {
  if (messageId) {
    try {
      await ctx.telegram.editMessageText(chatId, messageId, undefined, text, { parse_mode: 'Markdown' })
      return messageId
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      if (!detail.includes('message is not modified')) {
        console.error('[telegram-edit-progress]', detail)
      }
      if (!isMissingMessageError(err)) return messageId
    }
  }

  const statusMsg = await ctx.reply(text, { parse_mode: 'Markdown' })
  updateUserSession(userKey, {
    progressChannel: { platform: 'telegram', chatId, messageId: statusMsg.message_id },
    progressChatId: chatId,
    progressMessageId: statusMsg.message_id,
  })
  return statusMsg.message_id
}

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

      const text = formatPipelineProgress(bot, state, initialLine)
      messageId = await editOrRecreateProgress(ctx, userKey, chatId, messageId, text)

      registerTelegramProgressSink(ctx, userKey, chatId, messageId, bot, userSession, orchestrator, getOrchestrator)
    },
    async editProgress(bot, state, line, userSession) {
      if (!chatId) return
      const channel = userSession.progressChannel
      const targetChat = (channel?.chatId as number) ?? chatId
      const targetMsg = (channel?.messageId as number) ?? userSession.progressMessageId
      if (!targetMsg) return
      await editOrRecreateProgress(
        ctx,
        userKey,
        targetChat,
        targetMsg,
        formatPipelineProgress(bot, state, line),
      )
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
    await editOrRecreateProgress(ctx, userKey, targetChat, targetMsg, text)
  })
}

export function formatTelegramPipelineState(state: PipelineState | undefined): string {
  return state ? formatPipelineProgress({ id: state.botId, name: state.botId } as BotDefinition, state, '') : ''
}
