export interface BotDefinition {
  id: string
  name: string
  description: string
  language: 'typescript' | 'python'
  framework: string
  features: string[]
  externalApis: string[]
  /** Canonical cross-platform owner key, e.g. tg:123 or dc:456 */
  creatorKey: string
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
  userKey: string
  telegramId?: number
  discordId?: string
  activeBotId?: string
  workspaceDir?: string
  awaitingDeployChoice?: boolean
  awaitingChildBotToken?: boolean
  activeOcSessionId?: string
  pipelineRunId?: string
  progressChannel?: {
    platform: 'telegram' | 'discord'
    chatId: string | number
    messageId?: string | number
  }
  /** @deprecated migrated to progressChannel */
  progressChatId?: number
  /** @deprecated migrated to progressChannel */
  progressMessageId?: number
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
