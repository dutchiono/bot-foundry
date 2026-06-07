import type { PhaseHandler } from './types.js'

export const regenerate: PhaseHandler = async ({ oc, sessionId, bot, pipelineState, onProgress }) => {
  await onProgress('Regenerating bot with enrichments...')

  const enrichData = pipelineState.phases.find(p => p.number === 3)?.result as any
  const improvements = [
    ...(enrichData?.missing_features || []),
    ...(enrichData?.ux_improvements || []),
    ...(enrichData?.security_gaps || []),
  ]

  if (improvements.length === 0) {
    return { success: true, data: { regenerated: false, reason: 'no improvements needed' } }
  }

  const prompt = `Regenerate the bot in the workspace, applying these improvements:

${improvements.map((i: string) => `- ${i}`).join('\n')}

Keep all existing functionality. Only add/modify what's needed for these improvements.
Ensure TypeScript compiles with strict mode.
Ensure all imports are correct.
Don't break existing features.

After regenerating, run the typecheck to verify.`

  const result = await oc.sendPrompt(sessionId, prompt)
  const output = result.parts.map(p => 'text' in p ? p.text : '').join('\n')

  return { success: true, output, data: { regenerated: true } }
}
