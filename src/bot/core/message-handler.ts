import type { UserSession } from '../../types/index.js'
import {
  getUserSession,
  updateUserSession,
  getBot,
  updateBot,
  createBotDefinition,
} from '../types.js'
import type { PipelineOrchestrator } from '../../pipeline/orchestrator.js'
import type { OpenCodeClient } from '../../opencode/client.js'
import { getContext } from '../../opencode/session.js'
import { extractJsonFromParts } from '../../opencode/utils.js'
import { escapeMarkdown } from '../format.js'
import { deployGuide, isLocalHostTarget, parseDeployChoice } from '../deploy-guides.js'
import { findLatestWorkspaceDir } from '../handlers/deploy.js'
import { isBotToken, startLocalBot } from '../../deploy/runner.js'
import type { FoundryMessenger } from '../platform/types.js'
import { pushElizaMemory } from '../../integrations/eliza-cloud.js'

export async function handleFoundryMessage(
  messenger: FoundryMessenger,
  rawText: string,
  getOrchestrator: () => PipelineOrchestrator,
  getOC: () => OpenCodeClient,
): Promise<void> {
  const text = rawText.startsWith('/') && !rawText.match(/^\/(newbot|deploy|status|opencode|help|start|link|stopbot)\b/)
    ? rawText.slice(1)
    : rawText
  if (text.startsWith('/')) return

  const userSession = getUserSession(messenger.userKey)

  await pushElizaMemory({
    userKey: userSession.userKey,
    platform: messenger.platform,
    role: 'user',
    text,
    timestamp: new Date().toISOString(),
  })

  if (userSession.awaitingChildBotToken) {
    const ws = userSession.workspaceDir ?? findLatestWorkspaceDir()
    if (!ws) {
      await messenger.reply('No workspace found. Run /newbot first.')
      return
    }
    if (!isBotToken(text)) {
      await messenger.reply(
        'That does not look like a bot token.\n\nPaste the full token from @BotFather (format: `123456789:AAH...`).',
      )
      return
    }
    await messenger.reply('⏳ Installing deps and starting your bot on this machine...')
    const result = await startLocalBot(ws, text.trim())
    updateUserSession(messenger.userKey, { awaitingChildBotToken: false })
    if (userSession.activeBotId) {
      updateBot(userSession.activeBotId, { status: 'deployed' })
    }
    await messenger.reply(result.message, { markdown: false })
    return
  }

  if (userSession.awaitingDeployChoice || userSession.phase === 9) {
    const deployTarget = parseDeployChoice(text)
    if (deployTarget) {
      const bot = userSession.activeBotId ? getBot(userSession.activeBotId) : undefined
      const ws = userSession.workspaceDir
        ?? getContext(userSession.userKey)?.workspaceDir
        ?? findLatestWorkspaceDir()
        ?? 'workspace/bot-???'
      const botName = bot?.name ?? ws.split('/').pop() ?? 'your-bot'
      await messenger.reply(deployGuide(deployTarget, ws, botName))
      updateUserSession(messenger.userKey, {
        awaitingDeployChoice: false,
        workspaceDir: ws,
        ...(isLocalHostTarget(deployTarget)
          ? { awaitingChildBotToken: true }
          : {}),
      })
      if (isLocalHostTarget(deployTarget)) {
        await messenger.reply(
          '👇 *Paste your new bot token* from @BotFather below and I\'ll start it on this PC.',
        )
      }
      return
    }
    if (userSession.awaitingDeployChoice || userSession.phase === 9) {
      await messenger.reply(
        'Send a deploy option: `1` Windows, `2` macOS, `3` Linux, `4` Docker — or type e.g. `windows`.',
      )
      return
    }
  }

  if (userSession.pipelineRunId && userSession.phase >= 0) {
    const state = getOrchestrator().getState(userSession.pipelineRunId)
    if (state?.status === 'awaiting_input') {
      const bot = getBot(userSession.activeBotId!)
      const orchestrator = getOrchestrator()
      if (bot) {
        await messenger.setupProgress?.(
          bot,
          userSession,
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
        checkPipelineProgress(messenger, userSession, orchestrator, () => {
          orchestrator.unregisterProgressSink(bot.id)
        })
      }
      return
    }
  }

  if (userSession.phase === 0 && !userSession.activeBotId) {
    await messenger.reply('📝 Analyzing your bot idea...')

    const oc = getOC()
    const health = await oc.healthCheck()
    if (!health) {
      await messenger.reply('❌ OpenCode server is not running. Start it with:\n`opencode serve --port 4096`\n\nThen try again.')
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
      await messenger.reply(`❌ Failed to analyze your bot idea.\n\n${msg}\n\nTry again with /newbot.`)
      return
    }

    const spec: Record<string, unknown> | null = extractJsonFromParts(result.parts ?? [])

    if (!spec) {
      await messenger.reply(
        `I couldn't parse that. Let me try a simpler approach.

I'll create a bot with name from your description. Let me ask you a few questions to refine it.

First: what should the bot be called? (One word, no spaces)`,
        { markdown: false },
      )
      return
    }

    const bot = createBotDefinition(
      String(spec.name),
      String(spec.description),
      messenger.userKey,
      (spec.language as 'typescript' | 'python') ?? 'typescript',
      String(spec.framework ?? 'telegraf'),
    )
    bot.features = (spec.features as string[]) || []
    bot.externalApis = (spec.externalApis as string[]) || []

    updateUserSession(messenger.userKey, { activeBotId: bot.id })

    await messenger.reply(
      `✅ *Parsed your idea!*

*Name*: ${escapeMarkdown(bot.name)}
*Description*: ${escapeMarkdown(bot.description)}
*Language*: ${escapeMarkdown(bot.language)}
*Framework*: ${escapeMarkdown(bot.framework)}
*Features*: ${escapeMarkdown(bot.features.join(', ') || 'None specified')}
*APIs*: ${escapeMarkdown(bot.externalApis.join(', ') || 'None')}`,
    )

    const orchestrator = getOrchestrator()
    await messenger.setupProgress?.(
      bot,
      userSession,
      orchestrator,
      'Phase 0: preflight — starting...',
    )

    const wsCtx = getContext(userSession.userKey)
    if (wsCtx) {
      updateUserSession(messenger.userKey, { workspaceDir: wsCtx.workspaceDir })
    }

    await orchestrator.startPipeline(bot, userSession)

    checkPipelineProgress(messenger, userSession, orchestrator, () => {
      orchestrator.unregisterProgressSink(bot.id)
    })
    return
  }

  if (userSession.phase !== 9 && userSession.activeBotId && userSession.pipelineRunId) {
    const oc = getOC()
    const ctxSession = getContext(userSession.userKey)
    if (ctxSession) {
      await messenger.reply('🤔 Processing...')
      await oc.sendPrompt(ctxSession.ocSessionId, text, { noReply: true })
      await messenger.reply('✅ Added to context.')
    }
  }
}

async function checkPipelineProgress(
  messenger: FoundryMessenger,
  userSession: UserSession,
  orchestrator: PipelineOrchestrator,
  onDone?: () => void,
): Promise<void> {
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
        updateUserSession(userSession.userKey, { awaitingDeployChoice: true, phase: 9 })
        await messenger.reply(
          `🎉 *Bot is ready!*

*${escapeMarkdown(bot.name)}*
${escapeMarkdown(bot.description)}

*Run it on this PC:* reply \`windows\`, \`mac\`, or \`linux\`, then paste your new bot token from @BotFather — Foundry will install and start it here.

Cloud deploy: /deploy (Docker, Fly, Railway)
/status — pipeline details`,
        )
      }
      return
    }

    if (state.status === 'failed') {
      onDone?.()
      await messenger.reply(`❌ *Pipeline failed*

${escapeMarkdown(state.error || 'Unknown error')}

Use /newbot to try again.`)
      return
    }

    if (state.status === 'awaiting_input') {
      const prompt = state.data.pendingInputPrompt as string
      if (prompt) {
        await messenger.reply(`✋ *Input needed*\n\n${escapeMarkdown(prompt)}`)
      }
      return
    }

    setTimeout(check, 2000)
  }

  setTimeout(check, 2000)
}
