import { createOpencodeClient, type OpencodeClient as SDKClient } from '@opencode-ai/sdk'
import type { Session, TextPartInput, Part } from '@opencode-ai/sdk'
import type { AssistantMessage } from '@opencode-ai/sdk'
import { extractTextFromParts, snippet } from './utils.js'

export interface OpenCodeConfig {
  baseUrl: string
  password?: string
  providerId?: string
  modelId?: string
}

function resolveModel(config: OpenCodeConfig): { providerID: string; modelID: string } {
  const providerID = config.providerId ?? process.env.PROVIDER_ID ?? 'opencode'
  const modelID = config.modelId ?? process.env.MODEL_ID ?? 'mimo-v2.5-free'
  return { providerID, modelID }
}

function appendJsonSchemaInstructions(
  text: string,
  schema: Record<string, unknown>,
): string {
  return `${text}

Respond with valid JSON only (no markdown, no code fences) matching this schema:
${JSON.stringify(schema, null, 2)}`
}

const FETCH_TIMEOUT_MS = 20 * 60 * 1000 // 20 min — scaffold/regenerate can run long

function isRetryableFetchError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /fetch failed|ECONNRESET|ETIMEDOUT|socket hang up|aborted/i.test(msg)
}

function unwrapData<T>(res: unknown, label: string): T {
  const body = res as { data?: T; error?: { data?: { message?: string }; name?: string } }
  if (body.error) {
    const msg = body.error.data?.message ?? body.error.name ?? 'Unknown OpenCode error'
    throw new Error(`${label}: ${msg}`)
  }
  if (body.data === undefined) {
    throw new Error(`${label}: empty response from OpenCode`)
  }
  return body.data
}

export class OpenCodeClient {
  private client: SDKClient
  private config: OpenCodeConfig

  constructor(config: OpenCodeConfig) {
    this.config = config
    const baseUrl = config.baseUrl.replace(/\/$/, '')
    this.client = createOpencodeClient({
      baseUrl,
      fetch: (request: Request) => this.sdkFetch(request),
    })
  }

  private sdkFetch(request: Request): Promise<Response> {
    const headers = new Headers(request.headers)
    if (this.config.password) {
      const auth = Buffer.from(`opencode:${this.config.password}`).toString('base64')
      headers.set('Authorization', `Basic ${auth}`)
    }
    return fetch(new Request(request, { headers }), {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
  }

  async healthCheck(): Promise<boolean> {
    try {
      const url = `${this.config.baseUrl.replace(/\/$/, '')}/global/health`
      const headers: Record<string, string> = {}
      if (this.config.password) {
        const auth = Buffer.from(`opencode:${this.config.password}`).toString('base64')
        headers['Authorization'] = `Basic ${auth}`
      }
      const res = await fetch(url, { headers })
      const data = await res.json() as any
      return data?.healthy === true
    } catch {
      return false
    }
  }

  async createSession(title: string): Promise<Session> {
    const res = await this.client.session.create({ body: { title } })
    return unwrapData<Session>(res, 'createSession')
  }

  async getSession(id: string): Promise<Session> {
    const res = await this.client.session.get({ path: { id } })
    return (res as any).data
  }

  async listSessions(): Promise<Session[]> {
    const res = await this.client.session.list()
    return (res as any).data ?? []
  }

  async deleteSession(id: string): Promise<boolean> {
    const res = await this.client.session.delete({ path: { id } })
    return (res as any).data
  }

  async listMessages(sessionId: string): Promise<{ info: any; parts: Part[] }[]> {
    const res = await this.client.session.messages({ path: { id: sessionId } })
    return (res as any).data ?? []
  }

  async sendPrompt(
    sessionId: string,
    text: string,
    opts?: {
      model?: { providerID: string; modelID: string }
      format?: { type: 'json_schema'; schema: Record<string, unknown> }
      noReply?: boolean
    },
  ): Promise<{ info: AssistantMessage; parts: Part[] }> {
    // json_schema uses tool_choice which breaks on several free models (e.g. DeepSeek).
    // Ask for JSON in plain text instead; extractJsonFromParts handles parsing.
    const promptText = opts?.format?.type === 'json_schema'
      ? appendJsonSchemaInstructions(text, opts.format.schema)
      : text

    const parts: TextPartInput[] = [{ type: 'text', text: promptText }]
    const model = opts?.model ?? resolveModel(this.config)

    let lastErr: unknown
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await this.client.session.prompt({
          path: { id: sessionId },
          body: {
            parts: parts as any,
            model,
            ...(opts?.noReply ? { noReply: true } : {}),
          },
        })
        const data = unwrapData<{ info: AssistantMessage & { error?: { data?: { message?: string } } }; parts: Part[] }>(res, 'sendPrompt')
        const providerError = data.info?.error?.data?.message
        if (providerError) {
          throw new Error(`sendPrompt: ${providerError}`)
        }
        return data
      } catch (err) {
        lastErr = err
        if (attempt < 3 && isRetryableFetchError(err)) {
          await new Promise(r => setTimeout(r, 3000 * attempt))
          continue
        }
        throw err
      }
    }
    throw lastErr
  }

  async sendPromptWithProgress(
    sessionId: string,
    text: string,
    onProgress: (message: string) => Promise<void>,
    opts?: {
      model?: { providerID: string; modelID: string }
      format?: { type: 'json_schema'; schema: Record<string, unknown> }
      noReply?: boolean
      heartbeatSecs?: number
    },
  ): Promise<{ info: AssistantMessage; parts: Part[] }> {
    const start = Date.now()
    const heartbeatMs = (opts?.heartbeatSecs ?? 12) * 1000
    const heartbeat = setInterval(() => {
      const secs = Math.round((Date.now() - start) / 1000)
      void onProgress(`⏳ AI working... (${secs}s elapsed)`)
    }, heartbeatMs)

    try {
      await onProgress('🧠 Sending prompt to OpenCode...')
      let result: { info: AssistantMessage; parts: Part[] }
      try {
        result = await this.sendPrompt(sessionId, text, opts)
      } catch (err) {
        if (isRetryableFetchError(err)) {
          await onProgress('⚠️ Connection dropped — retrying...')
          result = await this.sendPrompt(sessionId, text, opts)
        } else {
          throw err
        }
      }
      const textOut = extractTextFromParts(result.parts)
      if (textOut) {
        await onProgress(`💭 ${snippet(textOut)}`)
      } else {
        await onProgress('✓ Got AI response')
      }
      return result
    } finally {
      clearInterval(heartbeat)
    }
  }

  async readFile(path: string): Promise<string | null> {
    try {
      const res = await this.client.file.read({ query: { path } })
      const data = (res as any).data
      return data?.content ?? null
    } catch {
      return null
    }
  }

  async searchCode(pattern: string): Promise<{ path: string; lines: string; line_number: number }[]> {
    const res = await this.client.find.text({ query: { pattern } })
    return (res as any).data ?? []
  }

  async runCommand(
    sessionId: string,
    command: string,
  ): Promise<string> {
    const res = await this.client.session.shell({
      path: { id: sessionId },
      body: { command, agent: 'build' },
    })
    const data = (res as any).data
    const parts: Part[] = data?.parts ?? []
    return parts.map((p: Part) => (p as any).text ?? '').join('\n')
  }

  async listAgents(): Promise<string[]> {
    try {
      const res = await this.client.app.agents()
      const data = (res as any).data
      return (data as any[])?.map((a: any) => a.name) ?? []
    } catch {
      return []
    }
  }
}
