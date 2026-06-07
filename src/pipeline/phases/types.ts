import type { OpenCodeClient } from '../../opencode/client.js'
import type { PipelineState } from '../state.js'
import type { BotDefinition } from '../../types/index.js'

export interface PhaseContext {
  oc: OpenCodeClient
  sessionId: string
  bot: BotDefinition
  pipelineState: PipelineState
  onProgress: (message: string) => Promise<void>
}

export interface PhaseResult {
  success: boolean
  output?: string
  data?: Record<string, unknown>
  error?: string
  requiresInput?: boolean
  inputPrompt?: string
}

export type PhaseHandler = (ctx: PhaseContext) => Promise<PhaseResult>
