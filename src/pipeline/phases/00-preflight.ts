import type { PhaseHandler } from './types.js'
import { extractJsonFromParts } from '../../opencode/utils.js'

export const preflight: PhaseHandler = async ({ oc, sessionId, bot, onProgress }) => {
  await onProgress('Validating bot spec with AI...')
  const health = await oc.healthCheck()
  if (!health) {
    return { success: false, error: 'OpenCode server is not reachable' }
  }

  const prompt = `You are running preflight validation for generating a Telegram bot.

Bot specification:
- Name: ${bot.name}
- Description: ${bot.description}
- Language: ${bot.language}
- Framework: ${bot.framework}
- Features: ${bot.features.join(', ')}
- External APIs: ${bot.externalApis.join(', ')}

Validate this specification:
1. Is the description detailed enough to generate a working bot? (Yes/No)
2. Are the chosen framework and language compatible? (Yes/No)
3. List any missing critical features (e.g., error handling, logging, rate limiting)
4. Suggest 1-3 improvements to the spec
5. Score the spec readiness from 1-10

Respond with a JSON object matching this schema:
{
  "spec_complete": boolean,
  "compatible": boolean,
  "missing_features": string[],
  "suggestions": string[],
  "readiness_score": number,
  "estimated_complexity": "simple" | "moderate" | "complex"
}`

  const result = await oc.sendPromptWithProgress(sessionId, prompt, onProgress, {
    format: {
      type: 'json_schema',
      schema: {
        type: 'object',
        properties: {
          spec_complete: { type: 'boolean' },
          compatible: { type: 'boolean' },
          missing_features: { type: 'array', items: { type: 'string' } },
          suggestions: { type: 'array', items: { type: 'string' } },
          readiness_score: { type: 'number' },
          estimated_complexity: { type: 'string', enum: ['simple', 'moderate', 'complex'] },
        },
        required: ['spec_complete', 'compatible', 'readiness_score', 'estimated_complexity'],
      },
    },
  })

  const data = extractJsonFromParts(result.parts) ?? {}

  if (!data.spec_complete || !data.compatible) {
    return {
      success: false,
      error: 'Spec validation failed',
      data,
      requiresInput: true,
      inputPrompt: `Spec needs improvement (score: ${data.readiness_score}/10). Suggestions:\n${(data.suggestions || []).join('\n')}\n\nMissing: ${(data.missing_features || []).join(', ')}\n\nReply with refinements to continue.`,
    }
  }

  return { success: true, data }
}
