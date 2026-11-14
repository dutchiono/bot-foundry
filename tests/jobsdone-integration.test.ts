import { describe, expect, it } from 'vitest'
import { importJobsDoneBrief } from '../src/integrations/jobsdone.js'

const brief = {
  schema: 'jobsdone.automation-brief.v1',
  business: 'Local HVAC Co',
  goal: 'Draft a Telegram assistant to handle intake and appointment requests.',
  features: ['Customer intake','Appointment requests','Customer intake'],
  externalApis: ['Calendar API'],
} as const

describe('Jobs Done intake adapter', () => {
  it('maps a validated brief to an unstarted Bot Foundry draft', () => {
    const draft = importJobsDoneBrief({ ...brief, features: [...brief.features], externalApis: [...brief.externalApis] }, 12345)
    expect(draft.name).toBe('Local HVAC Co automation')
    expect(draft.features).toEqual(['Customer intake','Appointment requests'])
    expect(draft.status).toBe('idea')
    expect(draft.language).toBe('typescript')
    expect(draft.creatorId).toBe(12345)
  })
  it('rejects unverified operator identifiers', () => {
    expect(() => importJobsDoneBrief(brief, 0)).toThrow('verified operator')
  })
  it('rejects malformed or unsupported briefs', () => {
    expect(() => importJobsDoneBrief({ ...brief, schema: 'old' }, 12345)).toThrow('Unsupported')
    expect(() => importJobsDoneBrief({ ...brief, features: 'all' }, 12345)).toThrow('features')
  })
})
