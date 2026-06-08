import { OpenCodeClient } from './client.js'
import type { UserSession } from '../types/index.js'
import crypto from 'node:crypto'

export interface SessionContext {
  ocSessionId: string
  workspaceDir: string
  filesCreated: string[]
  lastOutput: string
}

const contexts = new Map<string, SessionContext>()

export async function createBotWorkspace(
  oc: OpenCodeClient,
  userSession: UserSession,
): Promise<SessionContext> {
  const wsId = crypto.randomUUID().slice(0, 8)
  const workspaceDir = `workspace/bot-${wsId}`

  const ocSession = await oc.createSession(`Bot Foundry: bot-${wsId}`)
  await oc.sendPrompt(ocSession.id, 
    `You are generating a new Telegram bot. The workspace is ${workspaceDir}.`,
    { noReply: true }
  )

  await oc.runCommand(ocSession.id, `mkdir -p ${workspaceDir}`)

  const ctx: SessionContext = {
    ocSessionId: ocSession.id,
    workspaceDir,
    filesCreated: [],
    lastOutput: '',
  }
  contexts.set(userSession.userKey, ctx)
  return ctx
}

export function getContext(userKey: string): SessionContext | undefined {
  return contexts.get(userKey)
}

export function destroyContext(userKey: string): void {
  contexts.delete(userKey)
}

export async function writeGeneratedFile(
  oc: OpenCodeClient,
  ctx: SessionContext,
  filePath: string,
  content: string,
): Promise<void> {
  const fullPath = `${ctx.workspaceDir}/${filePath}`
  await oc.runCommand(ctx.ocSessionId, 
    `mkdir -p ${ctx.workspaceDir}/$(dirname ${filePath}) && cat > ${fullPath} << 'ENDOFFILE'\n${content}\nENDOFFILE`
  )
  ctx.filesCreated.push(fullPath)
}

export async function runBotTests(
  oc: OpenCodeClient,
  ctx: SessionContext,
): Promise<{ passed: boolean; output: string }> {
  const output = await oc.runCommand(ctx.ocSessionId,
    `cd ${ctx.workspaceDir} && npm install 2>&1 && npm run typecheck 2>&1 && echo "TESTS_PASSED" || echo "TESTS_FAILED"`
  )
  return {
    passed: output.includes('TESTS_PASSED'),
    output,
  }
}
