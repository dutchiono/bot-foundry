import { Context } from 'telegraf'
import type { UserSession, BotDefinition } from '../types/index.js'
import { loadPersistedState, savePersistedState } from './persist.js'

export interface BotFoundryContext extends Context {
  session?: UserSession
}

const loaded = loadPersistedState()
const sessions = loaded.sessions
const bots = loaded.bots

function persist(): void {
  savePersistedState(sessions, bots)
}

export function createUserSession(telegramId: number): UserSession {
  return {
    telegramId,
    phase: -1,
    messages: [],
  }
}

export function getUserSession(telegramId: number): UserSession {
  let session = sessions.get(telegramId)
  if (!session) {
    session = createUserSession(telegramId)
    sessions.set(telegramId, session)
    persist()
  }
  return session
}

export function updateUserSession(telegramId: number, updates: Partial<UserSession>): UserSession {
  const session = getUserSession(telegramId)
  Object.assign(session, updates)
  persist()
  return session
}

export function createBotDefinition(
  name: string,
  description: string,
  creatorId: number,
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
    creatorId,
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

export function listBotsForUser(telegramId: number): BotDefinition[] {
  return [...bots.values()].filter(b => b.creatorId === telegramId)
}
