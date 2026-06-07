export function summarizePhaseResult(
  phaseName: string,
  data: Record<string, unknown>,
): string | null {
  switch (phaseName) {
    case 'preflight': {
      const score = data.readiness_score
      const complexity = data.estimated_complexity
      if (score != null) return `Preflight score: ${score}/10 (${complexity ?? 'unknown'} complexity)`
      return null
    }
    case 'research': {
      const novelty = data.novelty_score
      const insight = data.market_insight
      if (typeof insight === 'string' && insight) return `Research: ${insight.slice(0, 180)}`
      if (novelty != null) return `Research novelty score: ${novelty}/10`
      return null
    }
    case 'scaffold':
      return 'Scaffold: bot code generation requested'
    case 'enrich': {
      const missing = data.missing_features
      if (Array.isArray(missing) && missing.length) {
        return `Enrich: ${missing.length} missing feature(s) identified`
      }
      return null
    }
    case 'review': {
      const verdict = data.verdict
      if (verdict != null) return `Review verdict: ${verdict}`
      return null
    }
    case 'agent-readiness': {
      const score = data.overall_score
      if (score != null) return `Agent readiness: ${score}/100`
      return null
    }
    case 'comparative': {
      const score = data.total_score
      if (score != null) return `Comparative score: ${score}/100`
      return null
    }
    case 'ship':
      return 'Ship: deployment artifacts prepared'
    default:
      return null
  }
}
