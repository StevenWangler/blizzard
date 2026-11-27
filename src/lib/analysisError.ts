/** Older saved analyses can contain an error instead of their success payload. */
export function getAnalysisError(analysis: unknown): string | null {
  if (typeof analysis !== 'object' || analysis === null || !('error' in analysis)) return null
  return typeof analysis.error === 'string' ? analysis.error : null
}
