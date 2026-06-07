import type { PhaseHandler } from './types.js'
import { extractJsonFromParts } from '../../opencode/utils.js'

export const agentReadiness: PhaseHandler = async ({ oc, sessionId, bot }) => {
  const prompt = `Evaluate the generated bot for "agent readiness" — how well it can be maintained, extended, and debugged by an AI coding agent:

Score 1-10 on these dimensions:
1. Code clarity — clear naming, single responsibility, no magic numbers
2. Documentation — JSDoc/TSDoc on public API, README completeness
3. Error handling — all user-facing errors caught and reported gracefully
4. Configurability — environment variables, config objects, no hardcoded values
5. Testability — are functions testable? any tests?
6. Type safety — strict TypeScript, no any, proper generics

Respond with JSON:
{
  "clarity_score": number,
  "documentation_score": number,
  "error_handling_score": number,
  "configurability_score": number,
  "testability_score": number,
  "overall_score": number,
  "verdict": "pass" | "warn" | "degrade",
  "improvements_needed": string[]
}`

  const result = await oc.sendPrompt(sessionId, prompt, {
    format: {
      type: 'json_schema',
      schema: {
        type: 'object',
        properties: {
          clarity_score: { type: 'number' },
          documentation_score: { type: 'number' },
          error_handling_score: { type: 'number' },
          configurability_score: { type: 'number' },
          testability_score: { type: 'number' },
          overall_score: { type: 'number' },
          verdict: { type: 'string', enum: ['pass', 'warn', 'degrade'] },
          improvements_needed: { type: 'array', items: { type: 'string' } },
        },
        required: ['overall_score', 'verdict'],
      },
    },
  })

  const data = extractJsonFromParts(result.parts) ?? {}

  return {
    success: data.verdict !== 'degrade',
    data,
    error: data.verdict === 'degrade' ? `Agent readiness score too low: ${data.overall_score}/10` : undefined,
  }
}
