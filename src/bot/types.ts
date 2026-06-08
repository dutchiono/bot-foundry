import { Context } from 'telegraf'
import type { UserSession, BotDefinition } from '../types/index.js'
import { loadPersistedState, savePersistedState } from './persist.js'
import { platformKey, type Platform } from '../identity/user-key.js'
import {
  resolveCanonical,
  mergeSessions,
  createLinkCode,
  consumeLinkCode,
  type AccountLinkState,
} from '../identity/link.js'

export interface BotFoundryContext extends Context {
  session?: UserSession
}

const loaded = loadPersistedState()
const sessions = loaded.sessions
const bots = loaded.bots
let linkState: AccountLinkState = loaded.links

function persist(): void {
  savePersistedState(sessions, bots, linkState)
}

export function getLinkState(): AccountLinkState {
  return linkState
}

export function getBotsMap(): Map<string, BotDefinition> {
  return bots
}

export function resolveUserKey(aliasKey: string): string {
  return resolveCanonical(aliasKey, linkState)
}

export function createUserSession(userKey: string, platform: Platform, platformId: string | number): UserSession {
  return {
    userKey,
    ...(platform === 'telegram' ? { telegramId: Number(platformId) } : { discordId: String(platformId) }),
    phase: -1,
    messages: [],
  }
}

export function getUserSession(userKey: string): UserSession {
  const canonical = resolveUserKey(userKey)
  let session = sessions.get(canonical)
  if (!session) {
    const parsed = userKey.match(/^(tg|dc):(.+)$/)
    const platform: Platform = parsed?.[1] === 'dc' ? 'discord' : 'telegram'
    const id = parsed?.[2] ?? userKey
    session = createUserSession(canonical, platform, id)
    sessions.set(canonical, session)
    persist()
  }
  return session
}

export function getUserSessionForPlatform(platform: Platform, platformId: string | number): UserSession {
  return getUserSession(platformKey(platform, platformId))
}

export function updateUserSession(userKey: string, updates: Partial<UserSession>): UserSession {
  const canonical = resolveUserKey(userKey)
  const session = getUserSession(canonical)
  Object.assign(session, updates)
  persist()
  return session
}

export function mergeUserSessions(aliasKey: string, canonicalKey: string): UserSession {
  if (aliasKey === canonicalKey) return getUserSession(canonicalKey)

  const source = sessions.get(aliasKey)
  const target = getUserSession(canonicalKey)
  if (source) {
    mergeSessions(target, source)
    sessions.delete(aliasKey)
    persist()
  }
  return target
}

export function issueLinkCode(
  userKey: string,
): { ok: true; code: string } | { ok: false; error: string } {
  const result = createLinkCode(resolveUserKey(userKey), linkState)
  if (result.ok) persist()
  return result
}

export function applyLinkCode(
  code: string,
  toUserKey: string,
): { ok: true; mergedInto: string } | { ok: false; error: string } {
  const result = consumeLinkCode(code, toUserKey, linkState)
  if (result.ok) {
    mergeUserSessions(toUserKey, result.mergedInto)
    persist()
  }
  return result
}

export function createBotDefinition(
  name: string,
  description: string,
  creatorKey: string,
  language: 'typescript' | 'python' = 'typescript',
  framework: string = 'telegraf',
): BotDefinition {
  const id = `bot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const bot: BotDefinition = {
    id,
    name,
    description,
    language,
    framework,
    features: [],
    externalApis: [],
    creatorKey: resolveUserKey(creatorKey),
    createdAt: new Date().toISOString(),
    status: 'idea',
  }
  bots.set(id, bot)
  persist()
  return bot
}

export function getBot(id: string): BotDefinition | undefined {
  return bots.get(id)
}

export function updateBot(id: string, updates: Partial<BotDefinition>): BotDefinition | undefined {
  const bot = bots.get(id)
  if (bot) {
    Object.assign(bot, updates)
    persist()
  }
  return bot
}

export function listBotsForUser(userKey: string): BotDefinition[] {
  const canonical = resolveUserKey(userKey)
  return [...bots.values()].filter(b => b.creatorKey === canonical)
}
