import { createOpencodeClient } from '@opencode-ai/sdk'

const c = createOpencodeClient({ baseUrl: 'http://127.0.0.1:4096' })
const s = await c.session.create({ body: { title: 'probe-test' } })
console.log('create:', JSON.stringify(s, null, 2).slice(0, 800))

const sid = s.data?.id ?? s.id
if (!sid) {
  console.error('No session id')
  process.exit(1)
}

const r = await c.session.prompt({
  path: { id: sid },
  body: {
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
console.log('prompt:', JSON.stringify(r, null, 2).slice(0, 3000))
