import type { PhaseHandler } from './types.js'
import { extractJsonFromParts } from '../../opencode/utils.js'

export const enrich: PhaseHandler = async ({ oc, sessionId, bot }) => {
  const prompt = `Review the generated bot in the workspace and identify what can be enriched:

Current bot spec:
- Name: ${bot.name}
- Description: ${bot.description}
- Features: ${bot.features.join(', ')}

Analyze the generated code and produce an overlay of improvements:
1. What's missing from the original spec?
2. What edge cases aren't handled?
3. What UX improvements could be made?
4. What security considerations are missing?

Respond with JSON:
{
  "missing_features": string[],
  "edge_cases": string[],
  "ux_improvements": string[],
  "security_gaps": string[],
  "code_quality_issues": string[],
  "enrichment_priority": "low" | "medium" | "high"
}`

  const result = await oc.sendPrompt(sessionId, prompt, {
    format: {
      type: 'json_schema',
      schema: {
        type: 'object',
        properties: {
          missing_features: { type: 'array', items: { type: 'string' } },
          edge_cases: { type: 'array', items: { type: 'string' } },
          ux_improvements: { type: 'array', items: { type: 'string' } },
          security_gaps: { type: 'array', items: { type: 'string' } },
          code_quality_issues: { type: 'array', items: { type: 'string' } },
          enrichment_priority: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
        required: ['missing_features', 'enrichment_priority'],
      },
    },
  })

  const data = extractJsonFromParts(result.parts) ?? {}

  if (data.enrichment_priority !== 'low') {
    return {
      success: true,
      data,
      requiresInput: true,
      inputPrompt: `I found areas to improve:\n\nMissing features:\n${(data.missing_features || []).join('\n')}\n\nUX improvements:\n${(data.ux_improvements || []).join('\n')}\n\nSecurity gaps:\n${(data.security_gaps || []).join('\n')}\n\nReply with which improvements to apply, or "skip" to proceed.`,
    }
  }

  return { success: true, data }
}
