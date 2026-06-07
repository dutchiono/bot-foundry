/**
 * Run the full e2e bot matrix through the 9-phase pipeline.
 * Writes .e2e-manifest.json — use e2e:rotate to test on Telegram.
 *
 * Usage:
 *   npm run e2e:batch
 *   npm run e2e:batch -- --only price-alert,dice-leaderboard
 *   npm run e2e:batch -- --from 2
 */

import { E2E_BOT_CASES } from '../tests/fixtures/e2e-bots.js'
import {
  initManifest,
  loadManifest,
  runE2ECase,
  saveManifest,
  requireOpenCode,
  createOpenCodeClient,
} from './e2e/lib.js'

function parseArgs() {
  const args = process.argv.slice(2)
  let only: string[] | undefined
  let from = 0
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--only' && args[i + 1]) {
      only = args[++i].split(',').map(s => s.trim())
    }
    if (args[i] === '--from' && args[i + 1]) {
      from = parseInt(args[++i], 10)
    }
  }
  return { only, from }
}

async function main() {
  const { only, from } = parseArgs()
  let cases = [...E2E_BOT_CASES]
  if (only?.length) {
    cases = cases.filter(c => only.includes(c.id))
    if (cases.length === 0) {
      console.error(`No cases match --only ${only.join(',')}`)
      console.error('Available:', E2E_BOT_CASES.map(c => c.id).join(', '))
      process.exit(1)
    }
  }
  cases = cases.slice(from)

  const oc = createOpenCodeClient()
  await requireOpenCode(oc)

  const existing = loadManifest()
  const manifest = existing ?? initManifest(E2E_BOT_CASES)

  console.log(`\n🔧 E2E batch — ${cases.length} case(s)`)
  console.log(`OpenCode: ${manifest.opencodeUrl}\n`)

  for (const testCase of cases) {
    console.log(`\n━━━ ${testCase.id}: ${testCase.name} ━━━`)
    const result = await runE2ECase(testCase, { timeoutMs: 45 * 60 * 1000 })

    const idx = manifest.cases.findIndex(c => c.id === testCase.id)
    if (idx >= 0) manifest.cases[idx] = result
    else manifest.cases.push(result)
    manifest.generatedAt = new Date().toISOString()
    saveManifest(manifest)

    const icon = result.status === 'completed' ? '✅' : '❌'
    console.log(`${icon} ${testCase.id}: ${result.status}${result.workspaceDir ? ` → ${result.workspaceDir}` : ''}`)
    if (result.error) console.log(`   ${result.error}`)
  }

  const done = manifest.cases.filter(c => c.status === 'completed').length
  const failed = manifest.cases.filter(c => c.status === 'failed').length
  console.log(`\nDone: ${done} completed, ${failed} failed`)
  console.log('Manifest:', '.e2e-manifest.json')
  console.log('Next: npm run e2e:rotate -- --next')
  console.log('      npm run e2e:status\n')

  if (failed > 0) process.exit(1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
