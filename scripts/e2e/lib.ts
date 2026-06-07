import fs from 'node:fs'
import path from 'node:path'
import 'dotenv/config'
import { OpenCodeClient } from '../../src/opencode/client.js'
import { PipelineOrchestrator } from '../../src/pipeline/orchestrator.js'
import type { PipelineState } from '../../src/pipeline/state.js'
import { getContext } from '../../src/opencode/session.js'
import type { BotDefinition, UserSession } from '../../src/types/index.js'
import type { E2EBotCase } from '../../tests/fixtures/e2e-bots.js'
import { startLocalBot, stopLocalBot, listRunningBots } from '../../src/deploy/runner.js'

export const E2E_TELEGRAM_ID = 999_001
export const MANIFEST_PATH = path.join(process.cwd(), '.e2e-manifest.json')

export interface E2ECaseResult {
  id: string
  name: string
  status: 'completed' | 'failed' | 'pending' | 'skipped'
  workspaceDir?: string
  botId?: string
  pipelineRunId?: string
  error?: string
  durationMs?: number
  telegramChecks: string[]
  startedAt?: string
  completedAt?: string
}

export interface E2EManifest {
  generatedAt: string
  opencodeUrl: string
  cases: E2ECaseResult[]
  rotation: {
    currentIndex: number | null
    lastWorkspaceDir?: string
    lastUsername?: string
  }
}

export function createOpenCodeClient(): OpenCodeClient {
  return new OpenCodeClient({
    baseUrl: process.env.OPENCODE_SERVER_URL || 'http://127.0.0.1:4096',
    password: process.env.OPENCODE_SERVER_PASSWORD,
    providerId: process.env.PROVIDER_ID,
    modelId: process.env.MODEL_ID,
  })
}

export async function requireOpenCode(oc: OpenCodeClient): Promise<void> {
  const ok = await oc.healthCheck()
  if (!ok) {
    throw new Error(
      `OpenCode not reachable at ${process.env.OPENCODE_SERVER_URL || 'http://127.0.0.1:4096'}. Run: opencode serve --port 4096`,
    )
  }
}

export function loadManifest(): E2EManifest | null {
  if (!fs.existsSync(MANIFEST_PATH)) return null
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as E2EManifest
}

export function saveManifest(manifest: E2EManifest): void {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8')
}

export function initManifest(cases: E2EBotCase[]): E2EManifest {
  return {
    generatedAt: new Date().toISOString(),
    opencodeUrl: process.env.OPENCODE_SERVER_URL || 'http://127.0.0.1:4096',
    cases: cases.map(c => ({
      id: c.id,
      name: c.name,
      status: 'pending',
      telegramChecks: c.telegramChecks,
    })),
    rotation: { currentIndex: null },
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

export async function waitForPipeline(
  orchestrator: PipelineOrchestrator,
  state: PipelineState,
  bot: BotDefinition,
  userSession: UserSession,
  options?: { timeoutMs?: number; onProgress?: (line: string) => void },
): Promise<PipelineState> {
  const timeoutMs = options?.timeoutMs ?? 45 * 60 * 1000
  const deadline = Date.now() + timeoutMs
  let lastPhase = -1

  while (Date.now() < deadline) {
    const current = orchestrator.getState(state.id)
    if (!current) throw new Error('Pipeline state disappeared')

    if (current.currentPhase !== lastPhase) {
      lastPhase = current.currentPhase
      options?.onProgress?.(`phase ${current.currentPhase}: ${current.phaseName} (${current.status})`)
    }

    if (current.status === 'completed') return current
    if (current.status === 'failed') {
      throw new Error(current.error || `Pipeline failed at phase ${current.currentPhase}`)
    }
    if (current.status === 'awaiting_input') {
      options?.onProgress?.('awaiting_input → auto-reply skip')
      await orchestrator.handleUserInput(state.id, 'skip', bot, userSession)
    }

    await sleep(3000)
  }

  throw new Error(`Pipeline timed out after ${timeoutMs / 1000}s`)
}

export function buildBotFromCase(testCase: E2EBotCase, creatorId: number): BotDefinition {
  return {
    id: `e2e-${testCase.id}-${Date.now()}`,
    name: testCase.name,
    description: testCase.description,
    language: testCase.language,
    framework: testCase.framework,
    features: testCase.features,
    externalApis: testCase.externalApis,
    creatorId,
    createdAt: new Date().toISOString(),
    status: 'idea',
  }
}

export async function runE2ECase(
  testCase: E2EBotCase,
  options?: { timeoutMs?: number },
): Promise<E2ECaseResult> {
  const startedAt = new Date().toISOString()
  const t0 = Date.now()
  const oc = createOpenCodeClient()
  await requireOpenCode(oc)

  const orchestrator = new PipelineOrchestrator(oc)
  const bot = buildBotFromCase(testCase, E2E_TELEGRAM_ID)
  const userSession: UserSession = {
    telegramId: E2E_TELEGRAM_ID,
    phase: 0,
    messages: [],
  }

  orchestrator.registerProgressSink(bot.id, async msg => {
    process.stdout.write(`  [${testCase.id}] ${msg}\n`)
  })

  try {
    const state = await orchestrator.startPipeline(bot, userSession)
    await waitForPipeline(orchestrator, state, bot, userSession, {
      timeoutMs: options?.timeoutMs,
      onProgress: line => process.stdout.write(`  [${testCase.id}] ${line}\n`),
    })

    const ctx = getContext(E2E_TELEGRAM_ID)
    return {
      id: testCase.id,
      name: testCase.name,
      status: 'completed',
      workspaceDir: ctx?.workspaceDir,
      botId: bot.id,
      pipelineRunId: state.id,
      durationMs: Date.now() - t0,
      telegramChecks: testCase.telegramChecks,
      startedAt,
      completedAt: new Date().toISOString(),
    }
  } catch (err) {
    const ctx = getContext(E2E_TELEGRAM_ID)
    return {
      id: testCase.id,
      name: testCase.name,
      status: 'failed',
      workspaceDir: ctx?.workspaceDir,
      botId: bot.id,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - t0,
      telegramChecks: testCase.telegramChecks,
      startedAt,
      completedAt: new Date().toISOString(),
    }
  } finally {
    orchestrator.unregisterProgressSink(bot.id)
  }
}

export function getChildTestToken(): string {
  const token = process.env.E2E_TEST_CHILD_BOT_TOKEN?.trim()
  if (!token) {
    throw new Error('Set E2E_TEST_CHILD_BOT_TOKEN in .env (a spare @BotFather bot for rotation)')
  }
  return token
}

export async function rotateTokenToIndex(index: number): Promise<void> {
  const manifest = loadManifest()
  if (!manifest) throw new Error('No .e2e-manifest.json — run npm run e2e:batch first')

  const completed = manifest.cases.filter(c => c.status === 'completed' && c.workspaceDir)
  if (completed.length === 0) throw new Error('No completed cases in manifest')

  if (index < 0 || index >= completed.length) {
    throw new Error(`Index ${index} out of range (0-${completed.length - 1})`)
  }

  const target = completed[index]
  const token = getChildTestToken()

  for (const running of listRunningBots()) {
    await stopLocalBot(running.workspaceDir)
  }

  console.log(`\nRotating test token → ${target.id} (${target.workspaceDir})`)
  const result = await startLocalBot(target.workspaceDir!, token)
  console.log(result.message)

  manifest.rotation.currentIndex = manifest.cases.findIndex(c => c.id === target.id)
  manifest.rotation.lastWorkspaceDir = target.workspaceDir
  manifest.rotation.lastUsername = result.username
  saveManifest(manifest)

  console.log('\nTelegram checks for this bot:')
  for (const check of target.telegramChecks) {
    console.log(`  • ${check}`)
  }
}
