import { createOpencodeClient } from '@opencode-ai/sdk'

const models = [
  ['opencode', 'big-pickle'],
  ['opencode', 'mimo-v2.5-free'],
  ['opencode', 'nemotron-3-ultra-free'],
  ['opencode', 'deepseek-v4-flash-free'],
]

const c = createOpencodeClient({ baseUrl: 'http://127.0.0.1:4096' })

for (const [providerID, modelID] of models) {
  const s = await c.session.create({ body: { title: `probe-${modelID}` } })
  const sid = s.data.id
  const r = await c.session.prompt({
    path: { id: sid },
    body: {
      model: { providerID, modelID },
      parts: [{ type: 'text', text: 'Return JSON only: {"msg":"hi"}' }],
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: { msg: { type: 'string' } },
          required: ['msg'],
        },
      },
    },
  })
  const err = r.data?.info?.error?.data?.message ?? r.error?.data?.message ?? null
  const parts = r.data?.parts?.length ?? 0
  console.log(`${providerID}/${modelID}: parts=${parts} err=${err ?? 'none'}`)
}
