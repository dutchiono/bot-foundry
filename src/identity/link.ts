import crypto from 'node:crypto'
import type { UserSession } from '../types/index.js'

export const LINK_CODE_PATTERN = /^[A-F0-9]{6}$/

const MAX_ISSUE_PER_HOUR = 5
const MAX_APPLY_PER_MINUTE = 10
const ISSUE_WINDOW_MS = 60 * 60 * 1000
const APPLY_WINDOW_MS = 60 * 1000

export interface UserLinkLimits {
  issueAt: number[]
  applyAt: number[]
}

export interface AccountLinkState {
  /** alias userKey → canonical userKey */
  canonical: Record<string, string>
  pending: Record<string, { from: string; expiresAt: string }>
  limits: Record<string, UserLinkLimits>
}

export function createEmptyLinkState(): AccountLinkState {
  return { canonical: {}, pending: {}, limits: {} }
}

function getLimits(links: AccountLinkState, userKey: string): UserLinkLimits {
  if (!links.limits[userKey]) {
    links.limits[userKey] = { issueAt: [], applyAt: [] }
  }
  return links.limits[userKey]
}

function pruneTimestamps(timestamps: number[], windowMs: number): number[] {
  const cutoff = Date.now() - windowMs
  return timestamps.filter(t => t > cutoff)
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

export function createLinkCode(
  fromUserKey: string,
  links: AccountLinkState,
): { ok: true; code: string } | { ok: false; error: string } {
  const limits = getLimits(links, fromUserKey)
  limits.issueAt = pruneTimestamps(limits.issueAt, ISSUE_WINDOW_MS)
  if (limits.issueAt.length >= MAX_ISSUE_PER_HOUR) {
    return { ok: false, error: 'Too many link codes requested. Try again later.' }
  }

  const code = crypto.randomBytes(3).toString('hex').toUpperCase()
  links.pending[code] = {
    from: fromUserKey,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  }
  limits.issueAt.push(Date.now())
  return { ok: true, code }
}

export function consumeLinkCode(
  code: string,
  toUserKey: string,
  links: AccountLinkState,
): { ok: true; mergedInto: string } | { ok: false; error: string } {
  const normalized = code.trim().toUpperCase()
  if (!LINK_CODE_PATTERN.test(normalized)) {
    return { ok: false, error: 'Invalid link code format.' }
  }

  const limits = getLimits(links, toUserKey)
  limits.applyAt = pruneTimestamps(limits.applyAt, APPLY_WINDOW_MS)
  if (limits.applyAt.length >= MAX_APPLY_PER_MINUTE) {
    return { ok: false, error: 'Too many link attempts. Wait a minute and try again.' }
  }
  limits.applyAt.push(Date.now())

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
