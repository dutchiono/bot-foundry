// Local, approval-gated import path for Jobs Done automation briefs.
// Prints a draft BotDefinition JSON. Does not start a job or deploy it.
import { readFileSync } from 'node:fs'
import { importJobsDoneBrief } from '../integrations/jobsdone.js'

const [, , filepath, creatorIdArg] = process.argv
if (!filepath || !creatorIdArg) {
  console.error('Usage: npx tsx src/cli/import-jobsdone.ts <brief.json> <verified-operator-telegram-id>')
  process.exit(2)
}
try {
  const creatorId = Number(creatorIdArg)
  const body = JSON.parse(readFileSync(filepath, 'utf8')) as unknown
  const draft = importJobsDoneBrief(body, creatorId)
  process.stdout.write(JSON.stringify(draft, null, 2) + '\n')
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e))
  process.exitCode = 1
}
