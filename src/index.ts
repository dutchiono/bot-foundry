import 'dotenv/config'
import { createBot } from './bot/telegram.js'
import { OpenCodeClient } from './opencode/client.js'
import { PipelineOrchestrator } from './pipeline/orchestrator.js'

const BOT_TOKEN: string = process.env.BOT_TOKEN ?? ''
if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN environment variable is required')
  console.error('   Get one from @BotFather on Telegram')
  process.exit(1)
}

const OPENCODE_SERVER_URL = process.env.OPENCODE_SERVER_URL || 'http://127.0.0.1:4096'
const OPENCODE_SERVER_PASSWORD = process.env.OPENCODE_SERVER_PASSWORD || ''

console.log(`╔══════════════════════════════════════════╗`)
console.log(`║        🤖 Bot Foundry v0.1              ║`)
console.log(`║   Telegram bot that makes Telegram bots  ║`)
console.log(`╠══════════════════════════════════════════╣`)
console.log(`║  OpenCode: ${OPENCODE_SERVER_URL.padEnd(27)}║`)
console.log(`╚══════════════════════════════════════════╝`)

const oc = new OpenCodeClient({
  baseUrl: OPENCODE_SERVER_URL,
  password: OPENCODE_SERVER_PASSWORD,
})

let orchestratorInstance: PipelineOrchestrator | null = null

function getOrchestrator(): PipelineOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new PipelineOrchestrator(
      oc,
      async (botId: string, message: string) => {
        console.log(`[${botId.slice(0, 8)}] ${message}`)
      },
    )
  }
  return orchestratorInstance
}

function getOC(): OpenCodeClient {
  return oc
}

async function main() {
  // Health check on startup
  const health = await oc.healthCheck()
  if (!health) {
    console.warn(`⚠️  OpenCode server not reachable at ${OPENCODE_SERVER_URL}`)
    console.warn('   Start it with: opencode serve --port 4096')
    console.warn('   The bot will work but can\'t generate new bots until OpenCode is running.')
  } else {
    console.log(`✅ OpenCode server connected`)
    const agents = await oc.listAgents()
    console.log(`   Agents available: ${agents.length}`)
  }

  const bot = createBot(BOT_TOKEN, getOrchestrator, getOC)

  // Graceful shutdown
  process.once('SIGINT', async () => {
    console.log('\nShutting down...')
    bot.stop('SIGINT')
    process.exit(0)
  })
  process.once('SIGTERM', async () => {
    console.log('\nShutting down...')
    bot.stop('SIGTERM')
    process.exit(0)
  })

  await bot.launch()
  console.log(`✅ Bot Foundry is running! Talk to it on Telegram.`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
