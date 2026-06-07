import type { PhaseHandler } from './types.js'
import { extractJsonFromParts } from '../../opencode/utils.js'

export const research: PhaseHandler = async ({ oc, sessionId, bot, onProgress }) => {
  await onProgress('Researching similar bots and market...')
  const prompt = `Research existing Telegram bots similar to "${bot.name}: ${bot.description}".

Search for:
1. Existing Telegram bots with similar functionality on GitHub
2. Popular libraries and frameworks for this kind of bot
3. Best practices and common pitfalls
4. API availability and documentation quality

Also search the web for existing Telegram bots that serve this purpose.

Analyze:
- How many similar bots exist? (none/few/many)
- What's the quality gap? (opportunity for improvement)
- What unique angle could this bot take?
- Score novelty from 1-10 (1 = saturated market, 10 = entirely new)

Respond with JSON:
{
  "similar_bots_found": number,
  "notable_examples": string[],
  "novelty_score": number,
  "market_insight": string,
  "recommended_approach": string,
  "key_libraries": string[],
  "risk_factors": string[]
}`

  const result = await oc.sendPromptWithProgress(sessionId, prompt, onProgress, {
    format: {
      type: 'json_schema',
      schema: {
        type: 'object',
        properties: {
          similar_bots_found: { type: 'number' },
          notable_examples: { type: 'array', items: { type: 'string' } },
          novelty_score: { type: 'number' },
          market_insight: { type: 'string' },
          recommended_approach: { type: 'string' },
          key_libraries: { type: 'array', items: { type: 'string' } },
          risk_factors: { type: 'array', items: { type: 'string' } },
        },
        required: ['similar_bots_found', 'novelty_score', 'recommended_approach'],
      },
    },
  })

  const data = extractJsonFromParts(result.parts) ?? {}

  return { success: true, data }
}
