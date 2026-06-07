import type { BotFoundryContext } from '../types.js'
import type { UserSession } from '../../types/index.js'
import { getUserSession, updateUserSession } from '../types.js'
import type { PipelineOrchestrator } from '../../pipeline/orchestrator.js'
import type { OpenCodeClient } from '../../opencode/client.js'
import { getBot, updateBot, createBotDefinition } from '../types.js'
import { getContext } from '../../opencode/session.js'
import { extractJsonFromParts } from '../../opencode/utils.js'

export function registerChatHandler(
  getOrchestrator: () => PipelineOrchestrator,
  getOC: () => OpenCodeClient,
) {
  return async (ctx: BotFoundryContext) => {
    const telegramId = ctx.from?.id
    if (!telegramId) return
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : ''
    if (!text || text.startsWith('/')) return

    const userSession = getUserSession(telegramId)

    // Handle pipeline await_input state
    if (userSession.pipelineRunId && userSession.phase >= 0) {
      const state = getOrchestrator().getState(userSession.pipelineRunId)
      if (state?.status === 'awaiting_input') {
        await ctx.reply('🔄 Processing your input...')

        const bot = getBot(userSession.activeBotId!)
        if (bot) {
          await getOrchestrator().handleUserInput(
            userSession.pipelineRunId,
            text,
            bot,
            userSession,
          )
        }
        return
      }
    }

    // Handle deployment option selection
    if (userSession.phase === 9) {
      const bot = getBot(userSession.activeBotId!)
      if (bot && ['1', '2', '3', '4'].includes(text.trim())) {
        const methods: Record<string, string> = {
          '1': 'docker',
          '2': 'fly',
          '3': 'railway',
          '4': 'self-hosted',
        }
        await ctx.reply(`Deploying via ${methods[text.trim()]}... This feature is under construction.`)
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

      const parseSession = await oc.createSession('Parsing bot idea')
      const result = await oc.sendPrompt(parseSession.id,
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

      const spec: any = extractJsonFromParts(result.parts)

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

*Name*: ${bot.name}
*Description*: ${bot.description}
*Language*: ${bot.language}
*Framework*: ${bot.framework}
*Features*: ${bot.features.join(', ') || 'None specified'}
*APIs*: ${bot.externalApis.join(', ') || 'None'}

Starting the pipeline now... I'll build this bot step by step.

🔄 Phase 0: Preflight — validating your spec...`,
        { parse_mode: 'Markdown' }
      )

      const orchestrator = getOrchestrator()
      await orchestrator.startPipeline(bot, userSession)

      // Polling mechanism to push updates
      checkPipelineProgress(ctx, userSession, getOrchestrator())
      return
    }

    // Generic chat prompt into the OpenCode session
    if (userSession.activeBotId && userSession.pipelineRunId) {
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
) {
  const check = async () => {
    if (!userSession.pipelineRunId) return
    const state = orchestrator.getState(userSession.pipelineRunId)
    if (!state) return

    if (state.status === 'completed') {
      const bot = getBot(userSession.activeBotId!)
      if (bot) {
        updateBot(bot.id, { status: 'ready' })
        userSession.phase = 9
        await ctx.reply(
          `🎉 *Bot is ready!*

*${bot.name}*
${bot.description}

To deploy, use /deploy
To check the files, use /files
To see full status, use /status

Or start a new bot with /newbot`,
          { parse_mode: 'Markdown' }
        )
      }
      return
    }

    if (state.status === 'failed') {
      await ctx.reply(`❌ *Pipeline failed*

${state.error || 'Unknown error'}

Use /newbot to try again.`,
        { parse_mode: 'Markdown' }
      )
      return
    }

    if (state.status === 'awaiting_input') {
      const prompt = state.data.pendingInputPrompt as string
      if (prompt) {
        await ctx.reply(`✋ *Input needed*\n\n${prompt}`, { parse_mode: 'Markdown' })
      }
      return
    }

    // Keep polling while running
    setTimeout(check, 2000)
  }

  setTimeout(check, 2000)
}
