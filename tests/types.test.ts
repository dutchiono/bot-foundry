import { describe, it, expect } from 'vitest'
import type { BotDefinition, DeployConfig, PipelineRun } from '../src/types/index.js'

describe('Types', () => {
  it('BotDefinition has required fields', () => {
    const bot: BotDefinition = {
      id: 'b1',
      name: 'test',
      description: 'test',
      language: 'typescript',
      framework: 'telegraf',
      features: [],
      externalApis: [],
      creatorId: 1,
      createdAt: new Date().toISOString(),
      status: 'idea',
    }
    expect(bot.id).toBeTruthy()
    expect(bot.status).toBe('idea')
  })

  it('DeployConfig supports all deployment types', () => {
    const docker: DeployConfig = { type: 'docker', env: {}, botToken: 'x' }
    const fly: DeployConfig = { type: 'fly', env: {}, botToken: 'x' }
    const railway: DeployConfig = { type: 'railway', env: {}, botToken: 'x' }
    expect(docker.type).toBe('docker')
    expect(fly.type).toBe('fly')
    expect(railway.type).toBe('railway')
  })

  it('PipelineRun tracks phases', () => {
    const run: PipelineRun = {
      id: 'r1',
      botId: 'b1',
      phase: 0,
      phaseName: 'preflight',
      status: 'running',
      startedAt: new Date().toISOString(),
      state: {},
    }
    expect(run.phase).toBe(0)
    run.phase = 3
    expect(run.phase).toBe(3)
  })
})
