/**
 * Eliza Cloud memory bridge — no-op until ELIZA_CLOUD_URL + ELIZA_CLOUD_API_KEY are set.
 * When Eliza Cloud comes online, Foundry syncs cross-platform context here automatically.
 */

export interface ElizaMemoryEvent {
  userKey: string
  platform: 'telegram' | 'discord'
  role: 'user' | 'assistant' | 'system'
  text: string
  timestamp: string
  metadata?: Record<string, unknown>
}

export function isElizaCloudEnabled(): boolean {
  return Boolean(process.env.ELIZA_CLOUD_URL?.trim() && process.env.ELIZA_CLOUD_API_KEY?.trim())
}

export async function pushElizaMemory(event: ElizaMemoryEvent): Promise<void> {
  if (!isElizaCloudEnabled()) return

  const base = process.env.ELIZA_CLOUD_URL!.replace(/\/$/, '')
  const agentId = process.env.ELIZA_AGENT_ID ?? 'foundry'

  try {
    const res = await fetch(`${base}/api/v1/agents/${agentId}/memory`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.ELIZA_CLOUD_API_KEY}`,
      },
      body: JSON.stringify(event),
    })
    if (!res.ok) {
      console.warn(`[eliza-cloud] memory push ${res.status}`)
    }
  } catch (err) {
    console.warn('[eliza-cloud] unreachable:', err instanceof Error ? err.message : err)
  }
}

export async function pullElizaContext(userKey: string): Promise<string | null> {
  if (!isElizaCloudEnabled()) return null

  const base = process.env.ELIZA_CLOUD_URL!.replace(/\/$/, '')
  const agentId = process.env.ELIZA_AGENT_ID ?? 'foundry'

  try {
    const res = await fetch(`${base}/api/v1/agents/${agentId}/memory?userKey=${encodeURIComponent(userKey)}`, {
      headers: { authorization: `Bearer ${process.env.ELIZA_CLOUD_API_KEY}` },
    })
    if (!res.ok) return null
    const data = await res.json() as { context?: string }
    return data.context ?? null
  } catch {
    return null
  }
}
