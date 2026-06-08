import crypto from 'node:crypto'
import type { UserSession } from '../types/index.js'

export interface AccountLinkState {
  /** alias userKey → canonical userKey */
  canonical: Record<string, string>
  pending: Record<string, { from: string; expiresAt: string }>
}

export function createEmptyLinkState(): AccountLinkState {
  return { canonical: {}, pending: {} }
}

export function resolveCanonical(userKey: string, links: AccountLinkState): string {
  let current = userKey
  const seen = new Set<string>()
  while (links.canonical[current] && !seen.has(current)) {
    seen.add(current)
    current = links.canonical[current]
  }
  return current
}

export function createLinkCode(fromUserKey: string, links: AccountLinkState): string {
  const code = crypto.randomBytes(3).toString('hex').toUpperCase()
  links.pending[code] = {
    from: fromUserKey,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  }
  return code
}

export function consumeLinkCode(
  code: string,
  toUserKey: string,
  links: AccountLinkState,
): { ok: true; mergedInto: string } | { ok: false; error: string } {
  const normalized = code.trim().toUpperCase()
  const pending = links.pending[normalized]
  if (!pending) return { ok: false, error: 'Invalid or expired link code.' }

  if (new Date(pending.expiresAt) < new Date()) {
    delete links.pending[normalized]
    return { ok: false, error: 'Link code expired. Run /link again on the other platform.' }
  }

  const from = resolveCanonical(pending.from, links)
  const to = resolveCanonical(toUserKey, links)
  delete links.pending[normalized]

  if (from === to) return { ok: false, error: 'Already linked to this account.' }

  links.canonical[to] = from
  return { ok: true, mergedInto: from }
}

export function mergeSessions(
  target: UserSession,
  source: UserSession,
): UserSession {
  if (source.activeBotId && !target.activeBotId) target.activeBotId = source.activeBotId
  if (source.workspaceDir && !target.workspaceDir) target.workspaceDir = source.workspaceDir
  if (source.pipelineRunId && !target.pipelineRunId) target.pipelineRunId = source.pipelineRunId
  if (source.phase > target.phase) target.phase = source.phase
  target.messages = [...source.messages, ...target.messages].slice(-50)
  if (source.awaitingDeployChoice) target.awaitingDeployChoice = true
  if (source.awaitingChildBotToken) target.awaitingChildBotToken = true
  if (source.discordId) target.discordId = source.discordId
  if (source.telegramId) target.telegramId = source.telegramId
  return target
}
