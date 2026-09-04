import type { ZodIssue } from 'zod'

export function collectErrors(issues: ZodIssue[]): Record<string, string> {
  const collected: Record<string, string> = {}
  for (const issue of issues) {
    const key = String(issue.path[0])
    if (!collected[key]) {
      collected[key] = issue.message
    }
  }
  return collected
}
