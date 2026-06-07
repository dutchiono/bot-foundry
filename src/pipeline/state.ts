export interface PipelineState {
  id: string
  botId: string
  currentPhase: number
  phaseName: string
  status: 'idle' | 'running' | 'awaiting_input' | 'completed' | 'failed'
  startedAt: string
  completedAt?: string
  error?: string
  phases: PhaseState[]
  data: Record<string, unknown>
}

export interface PhaseState {
  number: number
  name: string
  status: 'pending' | 'running' | 'completed' | 'skipped' | 'failed'
  result?: unknown
  error?: string
  startedAt?: string
  completedAt?: string
}

export const PHASES = [
  { number: 0, name: 'preflight' },
  { number: 1, name: 'research' },
  { number: 2, name: 'scaffold' },
  { number: 3, name: 'enrich' },
  { number: 4, name: 'regenerate' },
  { number: 5, name: 'review' },
  { number: 6, name: 'agent-readiness' },
  { number: 7, name: 'comparative' },
  { number: 8, name: 'ship' },
] as const

export function createPipelineState(botId: string): PipelineState {
  return {
    id: crypto.randomUUID(),
    botId,
    currentPhase: 0,
    phaseName: 'preflight',
    status: 'idle',
    startedAt: new Date().toISOString(),
    phases: PHASES.map(p => ({
      number: p.number,
      name: p.name,
      status: 'pending',
    })),
    data: {
      activityLog: [] as string[],
    },
  }
}

export function appendActivity(state: PipelineState, line: string, max = 12): void {
  const log = (state.data.activityLog as string[]) ?? []
  log.push(line)
  if (log.length > max) log.splice(0, log.length - max)
  state.data.activityLog = log
}

import crypto from 'node:crypto'
