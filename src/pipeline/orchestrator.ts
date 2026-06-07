import type { PhaseHandler } from './phases/types.js'
import { createPipelineState, PHASES } from './state.js'
import type { PipelineState } from './state.js'
import type { OpenCodeClient } from '../opencode/client.js'
import { createBotWorkspace, getContext } from '../opencode/session.js'
import type { BotDefinition, UserSession } from '../types/index.js'

import { preflight } from './phases/00-preflight.js'
import { research } from './phases/10-research.js'
import { scaffold } from './phases/20-scaffold.js'
import { enrich } from './phases/30-enrich.js'
import { regenerate } from './phases/40-regenerate.js'
import { review } from './phases/50-review.js'
import { agentReadiness } from './phases/55-agent-readiness.js'
import { comparative } from './phases/70-comparative.js'
import { ship } from './phases/80-ship.js'

export class PipelineOrchestrator {
  private runs = new Map<string, PipelineState>()
  private oc: OpenCodeClient
  private onProgress: (botId: string, message: string) => Promise<void>

  private phaseHandlers: PhaseHandler[] = [
    preflight,
    research,
    scaffold,
    enrich,
    regenerate,
    review,
    agentReadiness,
    comparative,
    ship,
  ]

  constructor(
    oc: OpenCodeClient,
    onProgress: (botId: string, message: string) => Promise<void>,
  ) {
    this.oc = oc
    this.onProgress = onProgress
  }

  getState(runId: string): PipelineState | undefined {
    return this.runs.get(runId)
  }

  async startPipeline(bot: BotDefinition, userSession: UserSession): Promise<PipelineState> {
    const state = createPipelineState(bot.id)
    state.status = 'running'
    this.runs.set(state.id, state)

    userSession.pipelineRunId = state.id
    userSession.phase = 0

    await createBotWorkspace(this.oc, userSession)

    this.runPipeline(state, bot, userSession).catch(err => {
      state.status = 'failed'
      state.error = err instanceof Error ? err.message : String(err)
    })

    return state
  }

  private async runPipeline(
    state: PipelineState,
    bot: BotDefinition,
    userSession: UserSession,
  ): Promise<void> {
    const ctx = getContext(userSession.telegramId)
    if (!ctx) throw new Error('No session context')

    for (const phase of PHASES) {
      if (state.status === 'failed') break

      state.currentPhase = phase.number
      state.phaseName = phase.name
      const phaseState = state.phases[phase.number]
      phaseState.status = 'running'
      phaseState.startedAt = new Date().toISOString()

      const handler = this.phaseHandlers[phase.number]
      if (!handler) {
        phaseState.status = 'failed'
        phaseState.error = `No handler for phase ${phase.number}`
        state.status = 'failed'
        return
      }

      try {
        await this.onProgress(bot.id, `Phase ${phase.number}: ${phase.name}...`)

        const result = await handler({
          oc: this.oc,
          sessionId: ctx.ocSessionId,
          bot,
          pipelineState: state,
          onProgress: (msg) => this.onProgress(bot.id, msg),
        })

        if (result.requiresInput) {
          phaseState.status = 'completed'
          state.status = 'awaiting_input'
          phaseState.result = result.data
          state.data.pendingInputPrompt = result.inputPrompt
          return
        }

        if (!result.success) {
          phaseState.status = 'failed'
          phaseState.error = result.error
          state.status = 'failed'
          state.error = result.error
          await this.onProgress(bot.id, `Phase ${phase.number} failed: ${result.error}`)
          return
        }

        phaseState.status = 'completed'
        phaseState.result = result.data
        phaseState.completedAt = new Date().toISOString()
        await this.onProgress(bot.id, `Phase ${phase.number} complete`)
      } catch (err) {
        phaseState.status = 'failed'
        phaseState.error = err instanceof Error ? err.message : String(err)
        state.status = 'failed'
        state.error = err instanceof Error ? err.message : String(err)
        await this.onProgress(bot.id, `Phase ${phase.number} error: ${err}`)
        return
      }
    }

    state.status = 'completed'
    state.completedAt = new Date().toISOString()
  }

  async handleUserInput(
    runId: string,
    input: string,
    bot: BotDefinition,
    userSession: UserSession,
  ): Promise<PipelineState> {
    const state = this.runs.get(runId)
    if (!state) throw new Error('Pipeline run not found')
    if (state.status !== 'awaiting_input') throw new Error('Pipeline is not awaiting input')

    state.status = 'running'
    delete state.data.pendingInputPrompt

    const ctx = getContext(userSession.telegramId)
    if (!ctx) throw new Error('No session context')

    await this.oc.sendPrompt(ctx.ocSessionId, `User provided input for the current phase: ${input}`, { noReply: true })

    this.runPipeline(state, bot, userSession).catch(err => {
      state.status = 'failed'
      state.error = err instanceof Error ? err.message : String(err)
    })

    return state
  }
}
