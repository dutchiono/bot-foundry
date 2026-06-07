import type { PhaseHandler } from './types.js'
import { extractJsonFromParts } from '../../opencode/utils.js'

export const comparative: PhaseHandler = async ({ oc, sessionId, bot, onProgress }) => {
  await onProgress('Comparing bot against alternatives...')
  const prompt = `Compare the generated bot against alternatives and best practices:

Bot: "${bot.name}" (${bot.description})
Framework: ${bot.framework}

Compare against:
1. Official Telegram Bot API examples
2. Popular open-source bots in the same category
3. Best practices from the ${bot.framework} documentation

Score on 6 dimensions (0-100):
- Feature Completeness: does it have all expected features?
- Code Quality: is it well-structured and maintainable?
- UX Polish: are messages clear, helpful, well-formatted?
- Error Handling: does it gracefully handle all failure modes?
- Performance: efficient API usage, proper caching?
- Security: input validation, token safety, rate limiting?

Respond with JSON:
{
  "feature_completeness": number,
  "code_quality": number,
  "ux_polish": number,
  "error_handling": number,
  "performance": number,
  "security": number,
  "total_score": number,
  "recommendation": "ship" | "hold" | "rework",
  "competitive_edge": string,
  "weaknesses": string[]
}`

  const result = await oc.sendPromptWithProgress(sessionId, prompt, onProgress, {
    format: {
      type: 'json_schema',
      schema: {
        type: 'object',
        properties: {
          feature_completeness: { type: 'number' },
          code_quality: { type: 'number' },
          ux_polish: { type: 'number' },
          error_handling: { type: 'number' },
          performance: { type: 'number' },
          security: { type: 'number' },
          total_score: { type: 'number' },
          recommendation: { type: 'string', enum: ['ship', 'hold', 'rework'] },
          competitive_edge: { type: 'string' },
          weaknesses: { type: 'array', items: { type: 'string' } },
        },
        required: ['total_score', 'recommendation'],
      },
    },
  })

  const data = extractJsonFromParts(result.parts) ?? {}

  return {
    success: data.recommendation !== 'rework',
    data,
    error: data.recommendation === 'rework' ? 'Bot needs significant rework before shipping' : undefined,
  }
}
