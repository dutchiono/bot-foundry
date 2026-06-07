import { describe, it, expect } from 'vitest'
import { E2E_BOT_CASES } from '../fixtures/e2e-bots.js'
import {
  createOpenCodeClient,
  requireOpenCode,
  runE2ECase,
} from '../../scripts/e2e/lib.js'

const E2E_ENABLED = process.env.E2E === '1'
const SMOKE_ID = process.env.E2E_SMOKE_CASE ?? 'quote-daily'

describe.skipIf(!E2E_ENABLED)('e2e pipeline smoke', () => {
  it('OpenCode is reachable', async () => {
    const oc = createOpenCodeClient()
    await requireOpenCode(oc)
  }, 30_000)

  it(`builds one bot end-to-end (${SMOKE_ID})`, async () => {
    const testCase = E2E_BOT_CASES.find(c => c.id === SMOKE_ID)
    expect(testCase).toBeDefined()

    const result = await runE2ECase(testCase!, { timeoutMs: 45 * 60 * 1000 })
    expect(result.status).toBe('completed')
    expect(result.workspaceDir).toMatch(/^workspace\/bot-/)
  }, 45 * 60 * 1000)
})

describe('e2e fixtures', () => {
  it('has at least 5 bot cases', () => {
    expect(E2E_BOT_CASES.length).toBeGreaterThanOrEqual(5)
  })

  it('each case has telegram checks', () => {
    for (const c of E2E_BOT_CASES) {
      expect(c.telegramChecks.length).toBeGreaterThan(0)
    }
  })
})
