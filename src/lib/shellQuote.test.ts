import { expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { shellQuote } from './shellQuote'
it('preserves shell metacharacters as literal argument content', () => {
  const payload = `notes=Kid's "snow" $(printf injected) \u0060printf backtick\u0060\nsecond line`
  expect(execFileSync('/bin/sh', ['-c', `printf '%s' ${shellQuote(payload)}`], { encoding: 'utf8' })).toBe(payload)
})
