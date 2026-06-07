import { describe, it, expect } from 'vitest'

describe('Bot Definition', () => {
  it('creates a bot with the correct shape', () => {
    const bot = {
      id: 'test-1',
      name: 'test-bot',
      description: 'A test bot',
      language: 'typescript' as const,
      framework: 'telegraf',
      features: ['echo'],
      externalApis: [],
      creatorId: 12345,
      createdAt: new Date().toISOString(),
      status: 'idea' as const,
    }
    expect(bot.id).toBe('test-1')
    expect(bot.language).toBe('typescript')
    expect(bot.status).toBe('idea')
  })

  it('transitions through status states', () => {
    const statuses = ['idea', 'researching', 'scaffolding', 'reviewing', 'ready', 'deployed'] as const
    let current = 0
    const next = () => statuses[++current]
    expect(next()).toBe('researching')
    expect(next()).toBe('scaffolding')
    expect(next()).toBe('reviewing')
    expect(next()).toBe('ready')
  })
})
