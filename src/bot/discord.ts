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
import { isElizaCloudEnabled } from '../integrations/eliza-cloud.js'

const COMMAND_PREFIX = '/'

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

    if (text === `${COMMAND_PREFIX}start` || text === `${COMMAND_PREFIX}help`) {
      const eliza = isElizaCloudEnabled() ? '\nEliza Cloud memory: connected' : ''
      await messenger.reply(
        `Welcome to **Bot Foundry**, ${messenger.displayName}!

I'm a bot factory that builds Telegram bots — same session as Telegram when you /link.

**Commands:** /newbot /deploy /stopbot /status /link /opencode /help${eliza}

**Cross-platform:** /link here, then paste the code on Telegram with /link CODE`,
        { markdown: false },
      )
      return
    }

    if (text.startsWith(`${COMMAND_PREFIX}newbot`)) {
      await runNewBotCommand(messenger)
      return
    }
    if (text.startsWith(`${COMMAND_PREFIX}deploy`)) {
      await runDeployCommand(messenger)
      return
    }
    if (text.startsWith(`${COMMAND_PREFIX}stopbot`)) {
      await runStopBotCommand(messenger)
      return
    }
    if (text.startsWith(`${COMMAND_PREFIX}status`)) {
      await runStatusCommand(messenger, getOrchestrator)
      return
    }
    if (text.startsWith(`${COMMAND_PREFIX}opencode`)) {
      await runOpenCodeCommand(messenger, getOC)
      return
    }
    if (text.startsWith(`${COMMAND_PREFIX}link`)) {
      const args = text.replace(/^\/link\s*/i, '').trim()
      await runLinkCommand(messenger, args)
      return
    }

    await handleFoundryMessage(messenger, text, getOrchestrator, getOC)
  })

  client.on('error', (err) => {
    console.error('[discord]', err)
  })

  void client.login(token)
  return client
}
