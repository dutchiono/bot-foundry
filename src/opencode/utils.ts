import type { Part } from '@opencode-ai/sdk'

export function extractStructuredOutput(parts: Part[]): string | undefined {
  for (const part of parts) {
    if (part.type === 'tool' && 'state' in part) {
      const toolPart = part as any
      if (toolPart.state?.status === 'completed') {
        return toolPart.state.output
      }
    }
  }
  const textParts = parts.filter((p): p is any => p.type === 'text')
  return textParts.map(p => p.text).join('\n') || undefined
}

export function extractJsonFromParts<T = any>(parts: Part[]): T | null {
  const output = extractStructuredOutput(parts)
  if (!output) return null
  try {
    return JSON.parse(output) as T
  } catch {
    const jsonMatch = output.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]) as T
      } catch {
        return null
      }
    }
    return null
  }
}
