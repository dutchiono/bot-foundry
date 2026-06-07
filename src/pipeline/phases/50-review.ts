import type { PhaseHandler } from './types.js'
import { extractJsonFromParts } from '../../opencode/utils.js'

export const review: PhaseHandler = async ({ oc, sessionId, bot, onProgress }) => {
  await onProgress('Running code quality checks...')

  const npmResult = await oc.runCommand(sessionId,
    `cd workspace && ls bot-*/ 2>/dev/null | head -1 | xargs -I {} sh -c 'cd {} && npm install 2>&1 | tail -3; npm run typecheck 2>&1; echo "EXIT:$?"'`
  )

  const lintResult = await oc.runCommand(sessionId,
    `cd workspace && ls bot-*/ 2>/dev/null | head -1 | xargs -I {} sh -c 'cd {} && npx tsc --noEmit 2>&1; echo "EXIT:$?"'`
  )

  const typecheckPassed = npmResult.includes('EXIT:0') || npmResult.includes('TESTS_PASSED')
  const lintPassed = lintResult.includes('EXIT:0')

  const prompt = `Review the generated bot code in the workspace. Check for:

1. Security issues (command injection, token leaks, unvalidated input)
2. Error handling gaps
3. Missing input validation
4. Proper async/await usage
5. No hardcoded secrets
6. Proper TypeScript types
7. Correct Telegraf v4 API usage (message filters, ctx methods)
8. Proper rate limiting and flood control

Respond with JSON:
{
  "security_issues": { "count": number, "items": string[] },
  "code_quality_score": number,
  "recommendations": string[],
  "blockers": string[],
  "verdict": "pass" | "warn" | "fail"
}`

  const result = await oc.sendPrompt(sessionId, prompt, {
    format: {
      type: 'json_schema',
      schema: {
        type: 'object',
        properties: {
          security_issues: {
            type: 'object',
            properties: {
              count: { type: 'number' },
              items: { type: 'array', items: { type: 'string' } },
            },
            required: ['count'],
          },
          code_quality_score: { type: 'number' },
          recommendations: { type: 'array', items: { type: 'string' } },
          blockers: { type: 'array', items: { type: 'string' } },
          verdict: { type: 'string', enum: ['pass', 'warn', 'fail'] },
        },
        required: ['code_quality_score', 'verdict'],
      },
    },
  })

  const data = extractJsonFromParts(result.parts) ?? {}

  return {
    success: data.verdict !== 'fail',
    data: { ...data, typecheckPassed, lintPassed },
    error: data.verdict === 'fail' ? 'Code review failed' : undefined,
    requiresInput: data.verdict === 'warn',
    inputPrompt: data.verdict === 'warn'
      ? `Code review warnings:\n${data.recommendations?.join('\n')}\n\nReply "fix" to address them or "continue" to proceed.`
      : undefined,
  }
}
