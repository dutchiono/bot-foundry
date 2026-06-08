import type { PhaseHandler } from './phases/types.js'
import { appendActivity, createPipelineState, PHASES } from './state.js'
import type { PipelineState } from './state.js'
import { summarizePhaseResult } from './summarize.js'
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
  private progressSinks = new Map<string, (message: string) => Promise<void>>()

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

  constructor(oc: OpenCodeClient) {
    this.oc = oc
  }

  registerProgressSink(botId: string, sink: (message: string) => Promise<void>) {
    this.progressSinks.set(botId, sink)
  }

  unregisterProgressSink(botId: string) {
    this.progressSinks.delete(botId)
  }

  private async emitProgress(botId: string, message: string, state?: PipelineState) {
    console.log(`[${botId.slice(0, 8)}] ${message}`)
    if (state) appendActivity(state, message)
    const sink = this.progressSinks.get(botId)
    if (!sink) return
    try {
      await sink(message)
    } catch (err) {
      console.error(`[${botId.slice(0, 8)}] progress update failed`, err)
    }
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
    const ctx = getContext(userSession.userKey)
    if (!ctx) throw new Error('No session context')

    for (const phase of PHASES) {
      if (state.status === 'failed') break

      const phaseState = state.phases[phase.number]
      if (phaseState.status === 'completed') continue

      state.currentPhase = phase.number
      state.phaseName = phase.name
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
        await this.emitProgress(bot.id, `▶ Phase ${phase.number}: ${phase.name}`, state)

        const result = await handler({
          oc: this.oc,
          sessionId: ctx.ocSessionId,
          bot,
          pipelineState: state,
          onProgress: (msg) => this.emitProgress(bot.id, msg, state),
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
          await this.emitProgress(bot.id, `❌ Phase ${phase.number} failed: ${result.error}`, state)
          return
        }

        phaseState.status = 'completed'
        phaseState.result = result.data
        phaseState.completedAt = new Date().toISOString()
        await this.emitProgress(bot.id, `✅ Phase ${phase.number} complete`, state)
        if (result.data && typeof result.data === 'object') {
          const summary = summarizePhaseResult(phase.name, result.data as Record<string, unknown>)
          if (summary) await this.emitProgress(bot.id, summary, state)
        }
      } catch (err) {
        phaseState.status = 'failed'
        phaseState.error = err instanceof Error ? err.message : String(err)
        state.status = 'failed'
        state.error = err instanceof Error ? err.message : String(err)
        await this.emitProgress(bot.id, `❌ Phase ${phase.number} error: ${err}`, state)
        return
      }
    }

    state.status = 'completed'
    state.completedAt = new Date().toISOString()
    await this.emitProgress(bot.id, '🎉 Pipeline complete', state)
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
    state.data.lastUserInput = input

    const ctx = getContext(userSession.userKey)
    if (!ctx) throw new Error('No session context')

    await this.oc.sendPrompt(ctx.ocSessionId, `User provided input for the current phase: ${input}`, { noReply: true })

    this.runPipeline(state, bot, userSession).catch(err => {
      state.status = 'failed'
      state.error = err instanceof Error ? err.message : String(err)
    })

    return state
  }
}
