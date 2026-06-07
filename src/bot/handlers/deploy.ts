import type { BotFoundryContext } from '../types.js'
import { getUserSession, getBot, updateUserSession, listBotsForUser } from '../types.js'
import type { PipelineOrchestrator } from '../../pipeline/orchestrator.js'
import type { OpenCodeClient } from '../../opencode/client.js'
import { deployMenuText, deployGuide, parseDeployChoice } from '../deploy-guides.js'
import { findLatestReadyBotForUser } from '../persist.js'
import { escapeMarkdown } from '../format.js'
import fs from 'node:fs'
import path from 'node:path'

export function registerDeployCommand(
  _getOrchestrator: () => PipelineOrchestrator,
  _getOC: () => OpenCodeClient,
) {
  return async (ctx: BotFoundryContext) => {
    const telegramId = ctx.from?.id
    if (!telegramId) return

    const userSession = getUserSession(telegramId)
    let bot = userSession.activeBotId ? getBot(userSession.activeBotId) : undefined

    if (!bot) {
      const recovered = findLatestReadyBotForUser(
        new Map(listBotsForUser(telegramId).map(b => [b.id, b])),
        telegramId,
      )
      if (recovered) {
        updateUserSession(telegramId, { activeBotId: recovered.id, phase: 9 })
        bot = recovered
        await ctx.reply(
          `♻️ Recovered *${escapeMarkdown(recovered.name)}* from saved state.`,
          { parse_mode: 'Markdown' },
        )
      }
    }

    if (!bot) {
      const wsDir = findLatestWorkspaceDir()
      if (wsDir) {
        updateUserSession(telegramId, {
          awaitingDeployChoice: true,
          workspaceDir: wsDir,
          phase: 9,
        })
        await ctx.reply(
          `No session in memory (server likely restarted), but your code is still on disk:\n\`${escapeMarkdown(wsDir)}\`\n\nReply \`windows\`, \`mac\`, \`linux\`, or \`docker\` for run instructions.`,
          { parse_mode: 'Markdown' },
        )
        return
      }
      await ctx.reply(
        'No active bot. Use /newbot to create one first.',
      )
      return
    }
    if (bot.status !== 'ready') {
      await ctx.reply(`Bot is still in "${bot.status}" phase. Complete the pipeline first. Check status with /status`)
      return
    }

    updateUserSession(telegramId, { awaitingDeployChoice: true, phase: 9 })
    await ctx.reply(deployMenuText(bot.name), { parse_mode: 'Markdown' })
  }
}

export function findLatestWorkspaceDir(): string | null {
  const root = path.join(process.cwd(), 'workspace')
  if (!fs.existsSync(root)) return null
  const dirs = fs.readdirSync(root, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name.startsWith('bot-'))
    .map(d => ({
      name: `workspace/${d.name}`,
      mtime: fs.statSync(path.join(root, d.name)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime)
  return dirs[0]?.name ?? null
}

export function tryDeployFromText(
  text: string,
  workspaceDir: string,
  botName: string,
): string | null {
  const target = parseDeployChoice(text)
  if (!target) return null
  return deployGuide(target, workspaceDir, botName)
}
