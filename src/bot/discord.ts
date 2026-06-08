import {
  Client,
  GatewayIntentBits,
  Partials,
  type Message,
} from 'discord.js'
import type { PipelineOrchestrator } from '../pipeline/orchestrator.js'
import type { OpenCodeClient } from '../opencode/client.js'
import { getUserSessionForPlatform } from './types.js'
import { createDiscordMessenger } from './platform/discord-messenger.js'
import { handleFoundryMessage } from './core/message-handler.js'
import {
  runNewBotCommand,
  runDeployCommand,
  runStatusCommand,
  runStopBotCommand,
  runOpenCodeCommand,
  runLinkCommand,
} from './core/commands.js'
import type { FoundryMessenger } from './platform/types.js'

const COMMAND_PREFIX = '/'

type CommandHandler = (
  messenger: FoundryMessenger,
  text: string,
  getOrchestrator: () => PipelineOrchestrator,
  getOC: () => OpenCodeClient,
) => Promise<void>

async function showDiscordHelp(messenger: FoundryMessenger): Promise<void> {
  await messenger.reply(
    `FOUNDRY — Bot Works No. 7

${messenger.displayName}, you bring the orders. She runs the line.

/newbot /deploy /status /stopbot /link /opencode /help

/link here, then /link CODE on Telegram to share the same session.`,
    { markdown: false },
  )
}

const COMMAND_HANDLERS: Record<string, CommandHandler> = {
  start: async (messenger) => showDiscordHelp(messenger),
  help: async (messenger) => showDiscordHelp(messenger),
  newbot: async (messenger) => runNewBotCommand(messenger),
  deploy: async (messenger) => runDeployCommand(messenger),
  stopbot: async (messenger) => runStopBotCommand(messenger),
  status: async (messenger, _text, getOrchestrator) => runStatusCommand(messenger, getOrchestrator),
  opencode: async (messenger, _text, _orch, getOC) => runOpenCodeCommand(messenger, getOC),
  link: async (messenger, text) => {
    const args = text.replace(/^\/link\s*/i, '').trim()
    await runLinkCommand(messenger, args)
  },
}

export function createDiscordBot(
  token: string,
  getOrchestrator: () => PipelineOrchestrator,
  getOC: () => OpenCodeClient,
): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
  })

  client.once('ready', () => {
    console.log(`✅ Discord connected as ${client.user?.tag}`)
  })

  client.on('messageCreate', async (message: Message) => {
    if (message.author.bot) return
    if (!message.content.trim()) return

    const userKey = getUserSessionForPlatform('discord', message.author.id).userKey
    const messenger = createDiscordMessenger(
      message,
      userKey,
      message.author.displayName ?? message.author.username,
      getOrchestrator,
    )

    const text = message.content.trim()

    try {
      const commandName = text.startsWith(COMMAND_PREFIX)
        ? text.slice(1).split(/\s+/)[0]?.toLowerCase()
        : undefined

      if (commandName && COMMAND_HANDLERS[commandName]) {
        await COMMAND_HANDLERS[commandName](messenger, text, getOrchestrator, getOC)
        return
      }

      await handleFoundryMessage(messenger, text, getOrchestrator, getOC)
    } catch (err) {
      console.error('[discord][messageCreate]', err)
      await messenger.reply('❌ Something went wrong. Try again.', { markdown: false }).catch(() => {})
    }
  })

  client.on('error', (err) => {
    console.error('[discord]', err)
  })

  void client.login(token)
  return client
}
