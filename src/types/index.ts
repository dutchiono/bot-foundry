export interface BotDefinition {
  id: string
  name: string
  description: string
  language: 'typescript' | 'python'
  framework: string
  features: string[]
  externalApis: string[]
  creatorId: number
  createdAt: string
  status: BotStatus
}

export type BotStatus =
  | 'idea'
  | 'researching'
  | 'scaffolding'
  | 'regenerating'
  | 'reviewing'
  | 'ready'
  | 'deploying'
  | 'deployed'
  | 'failed'

export interface PipelineRun {
  id: string
  botId: string
  phase: number
  phaseName: string
  status: 'running' | 'completed' | 'failed' | 'awaiting_input'
  startedAt: string
  completedAt?: string
  error?: string
  state: Record<string, unknown>
}

export interface UserSession {
  telegramId: number
  activeBotId?: string
  activeOcSessionId?: string
  pipelineRunId?: string
  phase: number
  messages: { role: 'user' | 'assistant'; text: string; timestamp: string }[]
}

export interface DeployConfig {
  type: 'docker' | 'fly' | 'railway' | 'self-hosted'
  env: Record<string, string>
  botToken: string
  webhookUrl?: string
}

export interface BotTemplate {
  name: string
  description: string
  language: 'typescript' | 'python'
  framework: string
  prompts: {
    system: string
    scaffold: string
  }
  files: Record<string, string>
}
