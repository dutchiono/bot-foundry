import fs from 'node:fs'
import path from 'node:path'
import type { BotDefinition, UserSession } from '../types/index.js'
import { platformKey } from '../identity/user-key.js'
import type { AccountLinkState } from '../identity/link.js'
import { createEmptyLinkState } from '../identity/link.js'

const STATE_FILE = path.join(process.cwd(), '.foundry-state.json')

interface PersistedStateV1 {
  sessions: [number, UserSession][]
  bots: [string, BotDefinition][]
}

interface PersistedStateV2 {
  version: 2
  sessions: [string, UserSession][]
  bots: [string, BotDefinition][]
  links: AccountLinkState
}

function migrateBot(bot: BotDefinition & { creatorId?: number }): BotDefinition {
  if (bot.creatorKey) return bot
  const legacy = (bot as { creatorId?: number }).creatorId
  return {
    ...bot,
    creatorKey: typeof legacy === 'number' ? platformKey('telegram', legacy) : 'tg:0',
  }
}

function migrateSession(key: string | number, session: UserSession): [string, UserSession] {
  if (typeof key === 'number') {
    const userKey = platformKey('telegram', key)
    return [userKey, {
      ...session,
      userKey,
      telegramId: session.telegramId ?? key,
    }]
  }
  const userKey = session.userKey ?? String(key)
  return [userKey, { ...session, userKey }]
}

function migrateProgressChannel(session: UserSession): UserSession {
  if (session.progressChannel) return session
  if (session.progressChatId != null) {
    session.progressChannel = {
      platform: 'telegram',
      chatId: session.progressChatId,
      messageId: session.progressMessageId,
    }
  }
  return session
}

export function loadPersistedState(): {
  sessions: Map<string, UserSession>
  bots: Map<string, BotDefinition>
  links: AccountLinkState
} {
  try {
    if (!fs.existsSync(STATE_FILE)) {
      return { sessions: new Map(), bots: new Map(), links: createEmptyLinkState() }
    }
    const raw = fs.readFileSync(STATE_FILE, 'utf8')
    const data = JSON.parse(raw) as PersistedStateV1 | PersistedStateV2

    if ('version' in data && data.version === 2) {
      const sessions = new Map(
        (data.sessions ?? []).map(([k, s]) => {
          const [userKey, session] = migrateSession(k, s)
          return [userKey, migrateProgressChannel(session)] as const
        }),
      )
      const bots = new Map((data.bots ?? []).map(([id, b]) => [id, migrateBot(b)] as const))
      const links = data.links ?? createEmptyLinkState()
      if (!links.limits) links.limits = {}
      return { sessions, bots, links }
    }

    const v1 = data as PersistedStateV1
    const sessions = new Map(
      (v1.sessions ?? []).map(([k, s]) => {
        const [userKey, session] = migrateSession(k, s)
        return [userKey, migrateProgressChannel(session)] as const
      }),
    )
    const bots = new Map((v1.bots ?? []).map(([id, b]) => [id, migrateBot(b)] as const))
    const links = createEmptyLinkState()
    return { sessions, bots, links }
  } catch (err) {
    console.warn('[persist] Failed to load state, starting fresh:', err)
    return { sessions: new Map(), bots: new Map(), links: createEmptyLinkState() }
  }
}

export function savePersistedState(
  sessions: Map<string, UserSession>,
  bots: Map<string, BotDefinition>,
  links: AccountLinkState,
): void {
  try {
    const data: PersistedStateV2 = {
      version: 2,
      sessions: [...sessions.entries()],
      bots: [...bots.entries()],
      links,
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2), 'utf8')
  } catch (err) {
    console.error('[persist] Failed to save state:', err)
  }
}

export function findLatestReadyBotForUser(
  bots: Map<string, BotDefinition>,
  creatorKey: string,
): BotDefinition | undefined {
  return [...bots.values()]
    .filter(b => b.creatorKey === creatorKey && b.status === 'ready')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
}
