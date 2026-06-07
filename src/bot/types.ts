import { Context } from 'telegraf'
import type { UserSession, BotDefinition } from '../types/index.js'

export interface BotFoundryContext extends Context {
  session?: UserSession
}

export function createUserSession(telegramId: number): UserSession {
  return {
    telegramId,
    phase: -1,
    messages: [],
  }
}

const sessions = new Map<number, UserSession>()

export function getUserSession(telegramId: number): UserSession {
  let session = sessions.get(telegramId)
  if (!session) {
    session = createUserSession(telegramId)
    sessions.set(telegramId, session)
  }
  return session
}

export function updateUserSession(telegramId: number, updates: Partial<UserSession>): UserSession {
  const session = getUserSession(telegramId)
  Object.assign(session, updates)
  return session
}

const bots = new Map<string, BotDefinition>()

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
  return bot
}

export function getBot(id: string): BotDefinition | undefined {
  return bots.get(id)
}

export function updateBot(id: string, updates: Partial<BotDefinition>): BotDefinition | undefined {
  const bot = bots.get(id)
  if (bot) {
    Object.assign(bot, updates)
  }
  return bot
}
