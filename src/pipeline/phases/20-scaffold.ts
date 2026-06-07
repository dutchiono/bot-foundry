import type { PhaseHandler } from './types.js'

const DEFAULT_TELEGRAM_BOT_TEMPLATE = `import { Telegraf } from 'telegraf'
import { message } from 'telegraf/filters'

const BOT_TOKEN = process.env.BOT_TOKEN
if (!BOT_TOKEN) {
  console.error('BOT_TOKEN environment variable is required')
  process.exit(1)
}

const bot = new Telegraf(BOT_TOKEN)

bot.start((ctx) => {
  ctx.reply('Welcome! I am {{botName}}. {{description}}')
})

bot.help((ctx) => {
  ctx.reply(
    'Available commands:\\n' +
    '/start - Start the bot\\n' +
    '/help - Show this help'
  )
})

bot.on(message('text'), async (ctx) => {
  try {
    {{handlerLogic}}
  } catch (error) {
    console.error('Error handling message:', error)
    ctx.reply('Sorry, something went wrong. Please try again.')
  }
})

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

bot.launch().then(() => {
  console.log('Bot started: {{botName}}')
})
`

export const scaffold: PhaseHandler = async ({ oc, sessionId, bot, onProgress }) => {
  await onProgress('Generating bot scaffold...')

  const prompt = `Generate a complete, production-ready Telegram bot in ${bot.language} using ${bot.framework}.

Bot: "${bot.name}"
Description: "${bot.description}"
Features needed:
${bot.features.map(f => `- ${f}`).join('\n')}
External APIs:
${bot.externalApis.map(a => `- ${a}`).join('\n')}

Requirements:
1. Full error handling with user-friendly messages
2. Rate limiting to avoid Telegram API flood limits
3. Graceful shutdown on SIGINT/SIGTERM
4. Logging with timestamps
5. TypeScript strict mode types (if TS)
6. Environment variable validation at startup
7. Session/state management if needed
8. Webhook support or polling mode (make configurable)
9. Dockerfile for deployment

Create the files in the workspace directory. Generate at minimum:
- package.json with all dependencies
- src/index.ts (main entry point)
- src/config.ts (configuration)
- src/handlers/ (command handlers)
- src/utils/ (utilities like rate limiter, logger)
- Dockerfile
- .env.example
- README.md

Use "telegraf" framework for TypeScript bots — latest v4 API with message filters.
Use "python-telegram-bot" v20+ for Python bots with Application class.

Make the bot complete and functional, not a stub. Every feature should be implemented.`

  const result = await oc.sendPrompt(sessionId, prompt)
  const output = result.parts.map(p => 'text' in p ? p.text : '').join('\n')

  return { success: true, output, data: { generated: true } }
}
