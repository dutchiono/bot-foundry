import { describe, it, expect } from 'vitest'
import { extractJsonFromParts } from '../src/opencode/utils.js'
import type { Part } from '@opencode-ai/sdk'

function makeToolPart(output: string): Part {
  return {
    type: 'tool',
    id: 't1',
    sessionID: 's1',
    messageID: 'm1',
    callID: 'c1',
    tool: 'test',
    state: {
      status: 'completed',
      input: {},
      output,
      title: 'test',
      metadata: {},
      time: { start: 0, end: 1 },
    },
  } as Part
}

function makeTextPart(text: string): Part {
  return {
    type: 'text',
    id: 't2',
    sessionID: 's1',
    messageID: 'm1',
    text,
  } as Part
}

describe('extractJsonFromParts', () => {
  it('extracts JSON from tool completed output', () => {
    const parts = [makeToolPart('{"name": "test", "score": 10}')]
    const result = extractJsonFromParts(parts)
    expect(result).toEqual({ name: 'test', score: 10 })
  })

  it('returns null for parts without JSON', () => {
    const parts = [makeTextPart('Hello world')]
    const result = extractJsonFromParts(parts)
    expect(result).toBeNull()
  })

  it('extracts JSON from text parts when no tool part', () => {
    const parts = [makeTextPart('Here is the result: {"key": "value"}')]
    const result = extractJsonFromParts(parts)
    expect(result).toEqual({ key: 'value' })
  })

  it('returns null for empty parts', () => {
    const result = extractJsonFromParts([])
    expect(result).toBeNull()
  })

  it('prefers tool output over text parts', () => {
    const parts = [
      makeTextPart('Some text'),
      makeToolPart('{"from_tool": true}'),
    ]
    const result = extractJsonFromParts(parts)
    expect(result).toEqual({ from_tool: true })
  })

  it('handles malformed JSON gracefully', () => {
    const parts = [makeToolPart('not json at all')]
    const result = extractJsonFromParts(parts)
    expect(result).toBeNull()
  })
})
