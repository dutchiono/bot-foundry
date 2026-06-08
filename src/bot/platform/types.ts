import type { BotDefinition, UserSession } from '../../types/index.js'
import type { PipelineOrchestrator } from '../../pipeline/orchestrator.js'
import type { PipelineState } from '../../pipeline/state.js'

export type FoundryPlatform = 'telegram' | 'discord'

export interface FoundryMessenger {
  userKey: string
  platform: FoundryPlatform
  displayName: string
  reply(text: string, options?: { markdown?: boolean }): Promise<void>
  setupProgress?(
    bot: BotDefinition,
    userSession: UserSession,
    orchestrator: PipelineOrchestrator,
    initialLine: string,
    options?: { newMessage?: boolean },
  ): Promise<void>
  editProgress?(
    bot: BotDefinition,
    state: PipelineState | undefined,
    line: string,
    userSession: UserSession,
  ): Promise<void>
}
