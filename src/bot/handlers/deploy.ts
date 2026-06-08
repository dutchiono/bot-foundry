import type { BotFoundryContext } from '../types.js'
import { getUserSessionForPlatform } from '../types.js'
import type { PipelineOrchestrator } from '../../pipeline/orchestrator.js'
import type { OpenCodeClient } from '../../opencode/client.js'
import { createTelegramMessenger } from '../platform/telegram-messenger.js'
import { runDeployCommand } from '../core/commands.js'
import { deployGuide, parseDeployChoice } from '../deploy-guides.js'
import fs from 'node:fs'
import path from 'node:path'

export function registerDeployCommand(
  getOrchestrator: () => PipelineOrchestrator,
  _getOC: () => OpenCodeClient,
) {
  return async (ctx: BotFoundryContext) => {
    const telegramId = ctx.from?.id
    if (!telegramId) return

    const userSession = getUserSessionForPlatform('telegram', telegramId)
    const messenger = createTelegramMessenger(
      ctx,
      userSession.userKey,
      ctx.from?.first_name ?? 'friend',
      getOrchestrator,
    )
    await runDeployCommand(messenger)
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
