/**
 * Rotate E2E_TEST_CHILD_BOT_TOKEN into the next built bot and start it.
 *
 * Usage:
 *   npm run e2e:rotate -- --next
 *   npm run e2e:rotate -- --index 0
 *   npm run e2e:rotate -- --id price-alert
 *   npm run e2e:rotate -- --stop
 */

import { loadManifest, rotateTokenToIndex, saveManifest } from './e2e/lib.js'
import { stopAllLocalBots } from '../src/deploy/runner.js'

function parseArgs() {
  const args = process.argv.slice(2)
  return {
    next: args.includes('--next'),
    stop: args.includes('--stop'),
    foreground: args.includes('--fg') || args.includes('--foreground'),
    index: (() => {
      const i = args.indexOf('--index')
      return i >= 0 ? parseInt(args[i + 1], 10) : undefined
    })(),
    id: (() => {
      const i = args.indexOf('--id')
      return i >= 0 ? args[i + 1] : undefined
    })(),
  }
}

async function main() {
  const { next, stop, index, id, foreground } = parseArgs()

  if (stop) {
    const n = await stopAllLocalBots()
    const manifest = loadManifest()
    if (manifest) {
      manifest.rotation.currentIndex = null
      manifest.rotation.lastWorkspaceDir = undefined
      manifest.rotation.lastUsername = undefined
      saveManifest(manifest)
    }
    console.log(n > 0 ? `Stopped ${n} bot process tree(s).` : 'No child bots running.')
    return
  }

  const manifest = loadManifest()
  if (!manifest) throw new Error('No manifest — run npm run e2e:batch first')

  const completed = manifest.cases
    .map((c, i) => ({ ...c, manifestIndex: i }))
    .filter(c => c.status === 'completed' && c.workspaceDir)

  if (completed.length === 0) throw new Error('No completed bots to rotate into')

  let targetIndex: number

  if (id) {
    const found = completed.findIndex(c => c.id === id)
    if (found < 0) throw new Error(`No completed case with id "${id}"`)
    targetIndex = found
  } else if (index !== undefined) {
    targetIndex = index
  } else if (next) {
    const cur = manifest.rotation.currentIndex
    const curCompleted = cur === null ? -1 : completed.findIndex(c => c.manifestIndex === cur)
    targetIndex = curCompleted < 0 ? 0 : (curCompleted + 1) % completed.length
  } else {
    targetIndex = 0
    console.log('No --next/--index/--id — defaulting to first completed bot')
  }

  await rotateTokenToIndex(targetIndex, { foreground })
}

main().catch(err => {
  console.error(err.message || err)
  process.exit(1)
})
