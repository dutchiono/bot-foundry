import { createOpencodeClient, type OpencodeClient as SDKClient } from '@opencode-ai/sdk'
import type { Session, TextPartInput, Part } from '@opencode-ai/sdk'
import type { AssistantMessage } from '@opencode-ai/sdk'

export interface OpenCodeConfig {
  baseUrl: string
  password?: string
}

export class OpenCodeClient {
  private client: SDKClient
  private config: OpenCodeConfig

  constructor(config: OpenCodeConfig) {
    this.config = config
    const baseUrl = config.baseUrl.replace(/\/$/, '')
    this.client = createOpencodeClient({
      baseUrl,
      fetch: (request: Request) => {
        if (config.password) {
          const auth = Buffer.from(`opencode:${config.password}`).toString('base64')
          const headers = new Headers(request.headers)
          headers.set('Authorization', `Basic ${auth}`)
          return fetch(new Request(request, { headers }))
        }
        return fetch(request)
      },
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
    return (res as any).data
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
    const parts: TextPartInput[] = [{ type: 'text', text }]
    const res = await this.client.session.prompt({
      path: { id: sessionId },
      body: {
        parts: parts as any,
        ...(opts?.model ? { model: opts.model } : {}),
        ...(opts?.format ? { format: opts.format } : {}),
        ...(opts?.noReply ? { noReply: true } : {}),
      },
    })
    return (res as any).data
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
