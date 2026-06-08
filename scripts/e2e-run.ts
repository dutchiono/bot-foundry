/**
 * Run the current rotated bot in the foreground — Ctrl+C stops it.
 * Usage: npm run e2e:run
 */

import { loadManifest, rotateTokenToIndex } from './e2e/lib.js'

async function main() {
  const manifest = loadManifest()
  if (!manifest) throw new Error('No manifest — run npm run e2e:rotate:next first')

  const completed = manifest.cases.filter(c => c.status === 'completed' && c.workspaceDir)
  if (completed.length === 0) throw new Error('No completed bots')

  const idx = manifest.rotation.currentIndex
  let targetIndex = 0
  if (idx !== null && idx >= 0 && idx < manifest.cases.length) {
    const found = completed.findIndex(c => c.id === manifest.cases[idx]?.id)
    targetIndex = found >= 0 ? found : 0
  }

  await rotateTokenToIndex(targetIndex, { foreground: true })
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
