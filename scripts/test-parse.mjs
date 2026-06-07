import 'dotenv/config'
import { OpenCodeClient } from '../dist/opencode/client.js'
import { extractJsonFromParts } from '../dist/opencode/utils.js'

const oc = new OpenCodeClient({
  baseUrl: 'http://127.0.0.1:4096',
  providerId: process.env.PROVIDER_ID,
  modelId: process.env.MODEL_ID,
})

const s = await oc.createSession('parse-test')
const r = await oc.sendPrompt(s.id,
  `Parse this bot description into a structured specification:
"A bot that tracks cryptocurrency prices. Features: price lookup, alerts. APIs: CoinGecko. TypeScript."
Extract name, description, language, framework, features, externalApis. Respond JSON only.`,
  {
    format: {
      type: 'json_schema',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          language: { type: 'string' },
          framework: { type: 'string' },
          features: { type: 'array', items: { type: 'string' } },
          externalApis: { type: 'array', items: { type: 'string' } },
        },
        required: ['name', 'description', 'language', 'framework', 'features'],
      },
    },
  },
)

const spec = extractJsonFromParts(r.parts)
console.log('model:', r.info?.providerID, r.info?.modelID)
console.log('spec:', JSON.stringify(spec, null, 2))
