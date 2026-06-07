import type { PhaseHandler } from './types.js'

export const regenerate: PhaseHandler = async ({ oc, sessionId, bot, pipelineState, onProgress }) => {
  const userInput = (pipelineState.data.lastUserInput as string | undefined)?.trim()
  if (userInput?.toLowerCase() === 'skip') {
    await onProgress('Skipping regeneration per your request')
    return { success: true, data: { regenerated: false, reason: 'user skipped' } }
  }

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

  const applyAll = !userInput || /^all$/i.test(userInput)
  const improvementBlock = applyAll
    ? improvements.map((i: string) => `- ${i}`).join('\n')
    : `- User-selected changes: ${userInput}\n\nContext from analysis:\n${improvements.map((i: string) => `- ${i}`).join('\n')}`

  const prompt = `Regenerate the bot in the workspace, applying these improvements:

${improvementBlock}

Keep all existing functionality. Only add/modify what's needed for these improvements.
Ensure TypeScript compiles with strict mode.
Ensure all imports are correct.
Don't break existing features.

After regenerating, run the typecheck to verify.`

  const result = await oc.sendPromptWithProgress(sessionId, prompt, onProgress)
  const output = result.parts.map(p => 'text' in p ? p.text : '').join('\n')

  return { success: true, output, data: { regenerated: true } }
}
