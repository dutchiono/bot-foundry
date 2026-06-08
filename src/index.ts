import 'dotenv/config'
import { createTelegramBot } from './bot/telegram.js'
import { createDiscordBot } from './bot/discord.js'
import { OpenCodeClient } from './opencode/client.js'
import { PipelineOrchestrator } from './pipeline/orchestrator.js'
import { isElizaCloudEnabled } from './integrations/eliza-cloud.js'

const BOT_TOKEN = process.env.BOT_TOKEN?.trim() ?? ''
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN?.trim() ?? ''

if (!BOT_TOKEN && !DISCORD_BOT_TOKEN) {
  console.error('❌ Set BOT_TOKEN (Telegram) and/or DISCORD_BOT_TOKEN')
  process.exit(1)
}

const OPENCODE_SERVER_URL = process.env.OPENCODE_SERVER_URL || 'http://127.0.0.1:4096'
const OPENCODE_SERVER_PASSWORD = process.env.OPENCODE_SERVER_PASSWORD || ''

console.log(`╔══════════════════════════════════════════╗`)
console.log(`║   FOUNDRY — Bot Works No. 7              ║`)
console.log(`║   Telegram + Discord                     ║`)
console.log(`╠══════════════════════════════════════════╣`)
console.log(`║  OpenCode: ${OPENCODE_SERVER_URL.padEnd(27)}║`)
console.log(`║  Telegram: ${(BOT_TOKEN ? 'on' : 'off').padEnd(27)}║`)
console.log(`║  Discord:  ${(DISCORD_BOT_TOKEN ? 'on' : 'off').padEnd(27)}║`)
console.log(`║  Eliza:    ${(isElizaCloudEnabled() ? 'on' : 'off').padEnd(27)}║`)
console.log(`╚══════════════════════════════════════════╝`)

const oc = new OpenCodeClient({
  baseUrl: OPENCODE_SERVER_URL,
  password: OPENCODE_SERVER_PASSWORD,
  providerId: process.env.PROVIDER_ID,
  modelId: process.env.MODEL_ID,
})

let orchestratorInstance: PipelineOrchestrator | null = null

function getOrchestrator(): PipelineOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new PipelineOrchestrator(oc)
  }
  return orchestratorInstance
}

function getOC(): OpenCodeClient {
  return oc
}

async function main() {
  const health = await oc.healthCheck()
  if (!health) {
    console.warn(`⚠️  OpenCode server not reachable at ${OPENCODE_SERVER_URL}`)
    console.warn('   Start it with: opencode serve --port 4096')
  } else {
    console.log(`✅ OpenCode server connected`)
    const agents = await oc.listAgents()
    const provider = process.env.PROVIDER_ID ?? 'opencode'
    const model = process.env.MODEL_ID ?? 'mimo-v2.5-free'
    console.log(`   Model: ${provider}/${model}`)
    console.log(`   Agents available: ${agents.length}`)
  }

  const shutdowns: Array<() => void | Promise<void>> = []

  if (BOT_TOKEN) {
    const telegram = createTelegramBot(BOT_TOKEN, getOrchestrator, getOC)
    await telegram.launch()
    console.log(`✅ Telegram Foundry is running`)
    shutdowns.push(() => telegram.stop('shutdown'))
  }

  if (DISCORD_BOT_TOKEN) {
    createDiscordBot(DISCORD_BOT_TOKEN, getOrchestrator, getOC)
    console.log(`✅ Discord Foundry is running`)
  }

  const shutdown = async () => {
    console.log('\nShutting down...')
    for (const fn of shutdowns) {
      await fn()
    }
    process.exit(0)
  }

  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
