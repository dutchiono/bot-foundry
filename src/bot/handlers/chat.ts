import type { BotFoundryContext } from '../types.js'
import type { BotDefinition, UserSession } from '../../types/index.js'
import { getUserSession, updateUserSession } from '../types.js'
import type { PipelineOrchestrator } from '../../pipeline/orchestrator.js'
import type { OpenCodeClient } from '../../opencode/client.js'
import { getBot, updateBot, createBotDefinition } from '../types.js'
import { getContext } from '../../opencode/session.js'
import { extractJsonFromParts } from '../../opencode/utils.js'
import { escapeMarkdown, formatPipelineProgress } from '../format.js'
import { deployGuide, isLocalHostTarget, parseDeployChoice } from '../deploy-guides.js'
import { findLatestWorkspaceDir } from './deploy.js'
import { isBotToken, startLocalBot } from '../../deploy/runner.js'

async function setupTelegramProgress(
  ctx: BotFoundryContext,
  userSession: UserSession,
  bot: BotDefinition,
  orchestrator: PipelineOrchestrator,
  initialLine: string,
  options?: { newMessage?: boolean },
): Promise<void> {
  const chatId = ctx.chat?.id
  if (!chatId) return

  const state = userSession.pipelineRunId
    ? orchestrator.getState(userSession.pipelineRunId)
    : undefined

  const forceNew = options?.newMessage === true
  let messageId = forceNew ? undefined : userSession.progressMessageId

  if (!messageId) {
    const statusMsg = await ctx.reply(
      formatPipelineProgress(bot, state, initialLine),
      { parse_mode: 'Markdown' },
    )
    messageId = statusMsg.message_id
    updateUserSession(userSession.telegramId, {
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

  orchestrator.unregisterProgressSink(bot.id)
  orchestrator.registerProgressSink(bot.id, async (message) => {
    const currentState = userSession.pipelineRunId
      ? orchestrator.getState(userSession.pipelineRunId)
      : undefined
    const text = formatPipelineProgress(bot, currentState, message)
    const targetChat = userSession.progressChatId ?? chatId
    const targetMsg = userSession.progressMessageId ?? messageId
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

export function registerChatHandler(
  getOrchestrator: () => PipelineOrchestrator,
  getOC: () => OpenCodeClient,
) {
  return async (ctx: BotFoundryContext) => {
    const telegramId = ctx.from?.id
    if (!telegramId) return
    const rawText = ctx.message && 'text' in ctx.message ? ctx.message.text : ''
    if (!rawText) return
    // Allow /windows style replies for deploy
    const text = rawText.startsWith('/') && !rawText.match(/^\/(newbot|deploy|status|opencode|help|start)\b/)
      ? rawText.slice(1)
      : rawText
    if (text.startsWith('/')) return

    const userSession = getUserSession(telegramId)

    // Start hosted bot when user pastes @BotFather token
    if (userSession.awaitingChildBotToken) {
      const ws = userSession.workspaceDir ?? findLatestWorkspaceDir()
      if (!ws) {
        await ctx.reply('No workspace found. Run /newbot first.')
        return
      }
      if (!isBotToken(text)) {
        await ctx.reply(
          'That does not look like a bot token.\n\nPaste the full token from @BotFather (format: `123456789:AAH...`).',
          { parse_mode: 'Markdown' },
        )
        return
      }
      await ctx.reply('⏳ Installing deps and starting your bot on this machine...')
      const result = await startLocalBot(ws, text.trim())
      updateUserSession(telegramId, { awaitingChildBotToken: false })
      if (userSession.activeBotId) {
        updateBot(userSession.activeBotId, { status: 'deployed' })
      }
      await ctx.reply(result.message)
      return
    }

    // Deploy platform choice (including after session recovery)
    if (userSession.awaitingDeployChoice || userSession.phase === 9) {
      const deployTarget = parseDeployChoice(text)
      if (deployTarget) {
        const bot = userSession.activeBotId ? getBot(userSession.activeBotId) : undefined
        const ws = userSession.workspaceDir
          ?? getContext(telegramId)?.workspaceDir
          ?? findLatestWorkspaceDir()
          ?? 'workspace/bot-???'
        const botName = bot?.name ?? ws.split('/').pop() ?? 'your-bot'
        await ctx.reply(deployGuide(deployTarget, ws, botName), { parse_mode: 'Markdown' })
        updateUserSession(telegramId, {
          awaitingDeployChoice: false,
          workspaceDir: ws,
          ...(isLocalHostTarget(deployTarget)
            ? { awaitingChildBotToken: true }
            : {}),
        })
        if (isLocalHostTarget(deployTarget)) {
          await ctx.reply(
            '👇 *Paste your new bot token* from @BotFather below and I\'ll start it on this PC.',
            { parse_mode: 'Markdown' },
          )
        }
        return
      }
      if (userSession.awaitingDeployChoice || userSession.phase === 9) {
        await ctx.reply(
          'Send a deploy option: `1` Windows, `2` macOS, `3` Linux, `4` Docker — or type e.g. `windows`.',
          { parse_mode: 'Markdown' },
        )
        return
      }
    }

    // Handle pipeline await_input state
    if (userSession.pipelineRunId && userSession.phase >= 0) {
      const state = getOrchestrator().getState(userSession.pipelineRunId)
      if (state?.status === 'awaiting_input') {
        const bot = getBot(userSession.activeBotId!)
        const orchestrator = getOrchestrator()
        if (bot) {
          await setupTelegramProgress(
            ctx,
            userSession,
            bot,
            orchestrator,
            `Applying your input: "${text.slice(0, 80)}${text.length > 80 ? '…' : ''}"`,
            { newMessage: true },
          )
          await orchestrator.handleUserInput(
            userSession.pipelineRunId,
            text,
            bot,
            userSession,
          )
          checkPipelineProgress(ctx, userSession, orchestrator, () => {
            orchestrator.unregisterProgressSink(bot.id)
          })
        }
        return
      }
    }

    // Handle /newbot flow: parse initial description
    if (userSession.phase === 0 && !userSession.activeBotId) {
      await ctx.reply('📝 Analyzing your bot idea...')

      const oc = getOC()
      const health = await oc.healthCheck()
      if (!health) {
        await ctx.reply('❌ OpenCode server is not running. Start it with:\n`opencode serve --port 4096`\n\nThen try again.', { parse_mode: 'Markdown' })
        return
      }

      let parseSession
      let result
      try {
        parseSession = await oc.createSession('Parsing bot idea')
        result = await oc.sendPrompt(parseSession.id,
        `Parse this bot description into a structured specification:

"${text}"

Extract:
- name: a short, descriptive name (snake_case, no spaces)
- description: one-sentence summary
- language: "typescript" or "python"
- framework: "telegraf" for TS, "python-telegram-bot" for Python
- features: an array of feature descriptions
- externalApis: any APIs it needs to call

Respond JSON only.`,
        {
          format: {
            type: 'json_schema',
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                language: { type: 'string', enum: ['typescript', 'python'] },
                framework: { type: 'string' },
                features: { type: 'array', items: { type: 'string' } },
                externalApis: { type: 'array', items: { type: 'string' } },
              },
              required: ['name', 'description', 'language', 'framework', 'features'],
            },
          },
        },
      )
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[parse-bot-idea]', msg)
        await ctx.reply(
          `❌ Failed to analyze your bot idea.\n\n${msg}\n\nTry again with /newbot.`,
        )
        return
      }

      const spec: any = extractJsonFromParts(result.parts ?? [])

      if (!spec) {
        await ctx.reply(
          `I couldn't parse that. Let me try a simpler approach.

I'll create a bot with name from your description. Let me ask you a few questions to refine it.

First: what should the bot be called? (One word, no spaces)`
        )
        return
      }

      const bot = createBotDefinition(
        spec.name,
        spec.description,
        telegramId,
        spec.language,
        spec.framework,
      )
      bot.features = spec.features || []
      bot.externalApis = spec.externalApis || []

      updateUserSession(telegramId, { activeBotId: bot.id })

      await ctx.reply(
        `✅ *Parsed your idea!*

*Name*: ${escapeMarkdown(bot.name)}
*Description*: ${escapeMarkdown(bot.description)}
*Language*: ${escapeMarkdown(bot.language)}
*Framework*: ${escapeMarkdown(bot.framework)}
*Features*: ${escapeMarkdown(bot.features.join(', ') || 'None specified')}
*APIs*: ${escapeMarkdown(bot.externalApis.join(', ') || 'None')}`,
        { parse_mode: 'Markdown' },
      )

      const orchestrator = getOrchestrator()
      await setupTelegramProgress(
        ctx,
        userSession,
        bot,
        orchestrator,
        'Phase 0: preflight — starting...',
      )

      const wsCtx = getContext(telegramId)
      if (wsCtx) {
        updateUserSession(telegramId, { workspaceDir: wsCtx.workspaceDir })
      }

      await orchestrator.startPipeline(bot, userSession)

      checkPipelineProgress(ctx, userSession, orchestrator, () => {
        orchestrator.unregisterProgressSink(bot.id)
      })
      return
    }

    // Generic chat prompt into the OpenCode session (not during deploy)
    if (userSession.phase !== 9 && userSession.activeBotId && userSession.pipelineRunId) {
      const oc = getOC()
      const ctx_session = getContext(telegramId)
      if (ctx_session) {
        await ctx.reply('🤔 Processing...')
        await oc.sendPrompt(ctx_session.ocSessionId, text, { noReply: true })
        await ctx.reply('✅ Added to context.')
      }
    }
  }
}

async function checkPipelineProgress(
  ctx: BotFoundryContext,
  userSession: UserSession,
  orchestrator: PipelineOrchestrator,
  onDone?: () => void,
) {
  const check = async () => {
    if (!userSession.pipelineRunId) return
    const state = orchestrator.getState(userSession.pipelineRunId)
    if (!state) return

    if (state.status === 'completed') {
      onDone?.()
      const bot = getBot(userSession.activeBotId!)
      if (bot) {
        updateBot(bot.id, { status: 'ready' })
        userSession.phase = 9
        updateUserSession(userSession.telegramId, { awaitingDeployChoice: true, phase: 9 })
        await ctx.reply(
          `🎉 *Bot is ready!*

*${escapeMarkdown(bot.name)}*
${escapeMarkdown(bot.description)}

*Run it on this PC:* reply \`windows\`, \`mac\`, or \`linux\`, then paste your new bot token from @BotFather — Foundry will install and start it here.

Cloud deploy: /deploy (Docker, Fly, Railway)
/files — browse generated code
/status — pipeline details`,
          { parse_mode: 'Markdown' }
        )
      }
      return
    }

    if (state.status === 'failed') {
      onDone?.()
      await ctx.reply(`❌ *Pipeline failed*

${escapeMarkdown(state.error || 'Unknown error')}

Use /newbot to try again.`,
        { parse_mode: 'Markdown' }
      )
      return
    }

    if (state.status === 'awaiting_input') {
      const prompt = state.data.pendingInputPrompt as string
      if (prompt) {
        await ctx.reply(`✋ *Input needed*\n\n${escapeMarkdown(prompt)}`, { parse_mode: 'Markdown' })
      }
      return
    }

    // Keep polling while running
    setTimeout(check, 2000)
  }

  setTimeout(check, 2000)
}
