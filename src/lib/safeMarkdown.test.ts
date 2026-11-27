import { describe, it, expect } from 'vitest'
import { renderUntrustedMarkdown } from './safeMarkdown'

describe('untrusted forecast Markdown', () => {
  it('keeps ordinary readable Markdown', () => {
    const html = renderUntrustedMarkdown('## Forecast\n\n**Snow** and [district](https://example.com).')
    expect(html).toContain('<h2>Forecast</h2>')
    expect(html).toContain('<strong>Snow</strong>')
    expect(html).toContain('href="https://example.com"')
  })
  it('escapes raw active HTML instead of passing it to the DOM', () => {
    const html = renderUntrustedMarkdown('<script>alert(1)</script>\n<img src=x onerror=alert(1)>\n<svg onload=alert(1)>')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<svg')
    expect(html).toContain('&lt;script&gt;')
  })
  it.each(['javascript:alert%281%29', 'data:text/html,test', 'vbscript:test'])('blocks active link scheme %s', href => {
    expect(renderUntrustedMarkdown(`[open](${href})`)).not.toContain('href=')
  })
  it('does not load remote tracking images', () => {
    expect(renderUntrustedMarkdown('![snow](https://example.com/pixel.gif)')).not.toContain('<img')
  })
})
