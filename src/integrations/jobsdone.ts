/** Jobs Done -> Bot Foundry planning import.
 *
 * Convert a reviewed customer automation brief into Bot Foundry's BotDefinition.
 * This file deliberately does NOT launch a pipeline, use credentials, or deploy anything.
 */
import { randomUUID } from 'node:crypto'
import type { BotDefinition } from '../types/index.js'

export interface JobsDoneAutomationBrief {
  schema: 'jobsdone.automation-brief.v1'
  business: string
  goal: string
  features: string[]
  externalApis: string[]
  language?: 'typescript' | 'python'
}

const MAX_FEATURES = 20
const MAX_APIS = 12

const textField = (v: unknown, max: number, label: string): string => {
  if (typeof v !== 'string' || !v.trim() || v.trim().length > max) {
    throw new Error(`Invalid ${label}: expected nonempty string of at most ${max} characters`)
  }
  return v.trim()
}
const boundedStrings = (v: unknown, limit: number, label: string): string[] => {
  if (!Array.isArray(v) || v.length > limit || v.some(x => typeof x !== 'string' || !x.trim() || x.length > 120)) {
    throw new Error(`Invalid ${label}`)
  }
  return [...new Set(v.map((x: string) => x.trim()))]
}

export function importJobsDoneBrief(input: unknown, creatorId: number): BotDefinition {
  if (!Number.isSafeInteger(creatorId) || creatorId <= 0) throw new Error('A verified operator Telegram ID is required')
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid request')
  const b = input as Record<string, unknown>
  if (b.schema !== 'jobsdone.automation-brief.v1') throw new Error('Unsupported brief schema')
  const business = textField(b.business, 120, 'business')
  const goal = textField(b.goal, 1200, 'goal')
  const features = boundedStrings(b.features, MAX_FEATURES, 'features')
  const externalApis = boundedStrings(b.externalApis, MAX_APIS, 'externalApis')
  if (b.language !== undefined && b.language !== 'typescript' && b.language !== 'python') {
    throw new Error('Unsupported language')
  }
  return {
    id: randomUUID(),
    name: `${business} automation`.slice(0, 120),
    description: goal,
    language: b.language === 'python' ? 'python' : 'typescript',
    framework: b.language === 'python' ? 'python-telegram-bot' : 'telegraf',
    features,
    externalApis,
    creatorId,
    createdAt: new Date().toISOString(),
    status: 'idea',
  }
}
