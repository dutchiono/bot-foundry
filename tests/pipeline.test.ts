import { describe, it, expect } from 'vitest'

describe('Pipeline Phases', () => {
  const PHASES = [
    { number: 0, name: 'preflight' },
    { number: 1, name: 'research' },
    { number: 2, name: 'scaffold' },
    { number: 3, name: 'enrich' },
    { number: 4, name: 'regenerate' },
    { number: 5, name: 'review' },
    { number: 6, name: 'agent-readiness' },
    { number: 7, name: 'comparative' },
    { number: 8, name: 'ship' },
  ]

  it('has 9 phases', () => {
    expect(PHASES).toHaveLength(9)
  })

  it('phases are in sequential order', () => {
    PHASES.forEach((phase, i) => {
      expect(phase.number).toBe(i)
    })
  })

  it('each phase has a name', () => {
    PHASES.forEach(phase => {
      expect(phase.name).toBeTruthy()
      expect(typeof phase.name).toBe('string')
    })
  })

  it('pipeline starts at phase 0', () => {
    expect(PHASES[0].number).toBe(0)
    expect(PHASES[0].name).toBe('preflight')
  })

  it('pipeline ends at phase 8 (ship)', () => {
    expect(PHASES[8].number).toBe(8)
    expect(PHASES[8].name).toBe('ship')
  })
})
