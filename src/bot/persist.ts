import fs from 'node:fs'
import path from 'node:path'
import type { BotDefinition, UserSession } from '../types/index.js'

const STATE_FILE = path.join(process.cwd(), '.foundry-state.json')

interface PersistedState {
  sessions: [number, UserSession][]
  bots: [string, BotDefinition][]
}

export function loadPersistedState(): {
  sessions: Map<number, UserSession>
  bots: Map<string, BotDefinition>
} {
  try {
    if (!fs.existsSync(STATE_FILE)) {
      return { sessions: new Map(), bots: new Map() }
    }
    const raw = fs.readFileSync(STATE_FILE, 'utf8')
    const data = JSON.parse(raw) as PersistedState
    return {
      sessions: new Map(data.sessions ?? []),
      bots: new Map(data.bots ?? []),
    }
  } catch (err) {
    console.warn('[persist] Failed to load state, starting fresh:', err)
    return { sessions: new Map(), bots: new Map() }
  }
}

export function savePersistedState(
  sessions: Map<number, UserSession>,
  bots: Map<string, BotDefinition>,
): void {
  try {
    const data: PersistedState = {
      sessions: [...sessions.entries()],
      bots: [...bots.entries()],
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2), 'utf8')
  } catch (err) {
    console.error('[persist] Failed to save state:', err)
  }
}

export function findLatestReadyBotForUser(
  bots: Map<string, BotDefinition>,
  telegramId: number,
): BotDefinition | undefined {
  return [...bots.values()]
    .filter(b => b.creatorId === telegramId && b.status === 'ready')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
}
