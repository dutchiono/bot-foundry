import { loadManifest } from './e2e/lib.js'

const manifest = loadManifest()
if (!manifest) {
  console.log('No .e2e-manifest.json — run: npm run e2e:batch')
  process.exit(0)
}

console.log(`\nE2E manifest (${manifest.generatedAt})`)
console.log(`OpenCode: ${manifest.opencodeUrl}`)
if (manifest.rotation.lastUsername) {
  console.log(`Active test bot: @${manifest.rotation.lastUsername} → ${manifest.rotation.lastWorkspaceDir}`)
}
console.log('')

for (const [i, c] of manifest.cases.entries()) {
  const active = manifest.rotation.currentIndex === i ? ' ← LIVE' : ''
  const ws = c.workspaceDir ? ` ${c.workspaceDir}` : ''
  const dur = c.durationMs ? ` ${Math.round(c.durationMs / 1000)}s` : ''
  console.log(`${c.status.padEnd(9)} ${c.id.padEnd(18)}${dur}${ws}${active}`)
  if (c.error) console.log(`           ${c.error}`)
}

const completed = manifest.cases.filter(c => c.status === 'completed').length
console.log(`\n${completed}/${manifest.cases.length} completed`)
console.log('Rotate: npm run e2e:rotate -- --next')
console.log('        npm run e2e:rotate -- --id price-alert\n')
