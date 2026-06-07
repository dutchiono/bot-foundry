import type { BotTemplate } from '../types/index.js'

export const TELEGRAM_BOT_TS_TEMPLATE: BotTemplate = {
  name: 'telegram-bot-ts',
  description: 'Production-ready Telegram bot in TypeScript using Telegraf',
  language: 'typescript',
  framework: 'telegraf',
  prompts: {
    system: 'You are generating a production-ready Telegram bot in TypeScript using Telegraf v4.',
    scaffold: 'Generate a complete Telegram bot with the given specification.',
  },
  files: {
    'package.json': `{
  "name": "{{botName}}",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "telegraf": "^4.16.3",
    "dotenv": "^16.4.7"
  },
  "devDependencies": {
    "@types/node": "^22.10.5",
    "tsx": "^4.19.2",
    "typescript": "^5.7.3"
  }
}`,
    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}`,
    '.env.example': `# Telegram Bot Token from @BotFather
BOT_TOKEN=your_bot_token_here

# Optional: Webhook configuration
# WEBHOOK_URL=https://your-domain.com/webhook
# PORT=3000`,
    'src/index.ts': `import { Telegraf } from 'telegraf'
import { message } from 'telegraf/filters'
import { config } from './config.js'
import { logger } from './utils/logger.js'
import { rateLimiter } from './utils/rate-limiter.js'

const bot = new Telegraf(config.botToken)

bot.use(rateLimiter)
bot.use((ctx, next) => {
  logger.info('Incoming update', { from: ctx.from?.id, type: ctx.updateType })
  return next()
})

bot.start(async (ctx) => {
  await ctx.reply(
    \`Welcome to {{botName}}! 👋

I'm here to help you. Here's what I can do:
\${config.handlers.map(h => \`/\\\${h.command} — \\\${h.description}\`).join('\\n')}

Use /help to see all commands.\`
  )
})

bot.help(async (ctx) => {
  const commands = config.handlers.map(h => \`/\${h.command} — \${h.description}\`)
  await ctx.reply(\`*Available Commands*
\\n\${commands.join('\\n')}

*Need more help?*
Just send me a message and I'll do my best to help!\`, { parse_mode: 'Markdown' })
})

bot.on(message('text'), async (ctx) => {
  try {
    logger.debug('Processing message', { text: ctx.message.text })
    await ctx.reply(\`You said: "\${ctx.message.text}". I'm still learning! Try /help to see what I can do.\`)
  } catch (error) {
    logger.error('Error handling message', error)
    await ctx.reply('Sorry, something went wrong. Please try again.').catch(() => {})
  }
})

// Graceful shutdown
process.once('SIGINT', async () => {
  logger.info('Shutting down (SIGINT)')
  bot.stop('SIGINT')
})
process.once('SIGTERM', async () => {
  logger.info('Shutting down (SIGTERM)')
  bot.stop('SIGTERM')
})

// Start
bot.launch().then(() => {
  logger.info('Bot started', { name: '{{botName}}' })
}).catch((err) => {
  logger.error('Failed to start bot', err)
  process.exit(1)
})
`,
    'src/config.ts': `import 'dotenv/config'

function requireEnv(name: string): string {
  const val = process.env[name]
  if (!val) {
    console.error(\`Missing required environment variable: \${name}\`)
    process.exit(1)
  }
  return val
}

export interface HandlerDef {
  command: string
  description: string
}

export const config = {
  botToken: requireEnv('BOT_TOKEN'),
  webhookUrl: process.env.WEBHOOK_URL || null,
  port: parseInt(process.env.PORT || '3000', 10),
  handlers: [] as HandlerDef[],
  rateLimit: {
    windowMs: 1000,
    maxRequests: 30,
  },
  logLevel: process.env.LOG_LEVEL || 'info',
} as const

export type Config = typeof config
`,
    'src/utils/logger.ts': `type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const currentLevel = (process.env.LOG_LEVEL || 'info') as LogLevel

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[currentLevel]
}

export const logger = {
  debug: (msg: string, data?: unknown) => {
    if (shouldLog('debug')) console.debug(\`[DEBUG] \${new Date().toISOString()} \${msg}\`, data ?? '')
  },
  info: (msg: string, data?: unknown) => {
    if (shouldLog('info')) console.info(\`[INFO] \${new Date().toISOString()} \${msg}\`, data ?? '')
  },
  warn: (msg: string, data?: unknown) => {
    if (shouldLog('warn')) console.warn(\`[WARN] \${new Date().toISOString()} \${msg}\`, data ?? '')
  },
  error: (msg: string, err?: unknown) => {
    if (shouldLog('error')) console.error(\`[ERROR] \${new Date().toISOString()} \${msg}\`, err ?? '')
  },
}
`,
    'src/utils/rate-limiter.ts': `import type { Middleware } from 'telegraf'
import type { Context } from 'telegraf'

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<number, RateLimitEntry>()

const WINDOW_MS = 1000
const MAX_REQUESTS = 30

export const rateLimiter: Middleware<Context> = (ctx, next) => {
  const userId = ctx.from?.id
  if (!userId) return next()

  const now = Date.now()
  const entry = store.get(userId)

  if (!entry || now > entry.resetAt) {
    store.set(userId, { count: 1, resetAt: now + WINDOW_MS })
    return next()
  }

  entry.count++
  if (entry.count > MAX_REQUESTS) {
    return
  }

  return next()
}
`,
    'Dockerfile': `FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm ci
COPY src/ ./src/
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY package.json ./
RUN npm ci --production
COPY --from=builder /app/dist ./dist
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
`,
    'README.md': `# {{botName}}

{{description}}

## Setup

1. Create a bot with [@BotFather](https://t.me/BotFather) and get your token
2. Copy \`.env.example\` to \`.env\` and add your token
3. Install dependencies: \`npm install\`
4. Run: \`npm run dev\`

## Deploy

\`\`\`bash
docker build -t {{botName}} .
docker run -e BOT_TOKEN=your_token {{botName}}
\`\`\`

## Commands

- /start — Start the bot
- /help — Show help
`,
  },
}

const registry = new Map<string, BotTemplate>()

registry.set(TELEGRAM_BOT_TS_TEMPLATE.name, TELEGRAM_BOT_TS_TEMPLATE)

export function getTemplate(name: string): BotTemplate | undefined {
  return registry.get(name)
}

export function getTemplateForLanguage(language: string, framework: string): BotTemplate | undefined {
  for (const tpl of registry.values()) {
    if (tpl.language === language && tpl.framework === framework) {
      return tpl
    }
  }
  return TELEGRAM_BOT_TS_TEMPLATE
}

export function registerTemplate(template: BotTemplate): void {
  registry.set(template.name, template)
}
